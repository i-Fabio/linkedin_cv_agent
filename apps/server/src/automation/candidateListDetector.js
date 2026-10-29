// Heuristica de deteccion de la lista de candidatos: LinkedIn no tiene
// clases CSS estables, pero las URLs de detalle de candidato en la vista de
// reclutador siguen el patron /applicants/{id}/detail (ver docs/05_PLAYWRIGHT_FLOW.md).
const DETAIL_URL_PATTERN = /\/applicants\/(\d+)\/detail/;

const NEXT_PAGE_EXACT = /^(siguiente|next|pr[oó]xima?( p[aá]gina)?)$/i;

async function collectCandidateLinks(page) {
  return page.$$eval(
    'a[href]',
    (anchors, patternSource) => {
      const pattern = new RegExp(patternSource);
      const seen = new Map();
      for (const a of anchors) {
        const match = pattern.exec(a.href);
        // Clave por id de solicitante, no por href completo: el mismo candidato
        // puede aparecer con query params distintos segun la pagina de la lista.
        if (match && !seen.has(match[1])) {
          // La miniatura de foto vive dentro del mismo <a> que el enlace de
          // detalle (ver derivePhotoUrlFromPage en candidateStore.js para el
          // porque de esta clase concreta); se captura aqui de una vez porque
          // solo existe en el DOM mientras la fila esta cargada/paginada, y
          // visitar cada candidato por su URL despues no la trae de vuelta.
          const img = a.querySelector('img.hiring-selectable-entity__entity[src]');
          seen.set(match[1], {
            url: a.href,
            name: a.innerText?.trim() || null,
            photoUrl: img ? img.getAttribute('src') : null,
          });
        }
      }
      return [...seen.entries()].map(([id, v]) => ({ id, ...v }));
    },
    DETAIL_URL_PATTERN.source
  );
}

// La lista de solicitantes de LinkedIn se desplaza dentro de un panel lateral,
// no en el body, asi que se busca el ancestro con scroll de los propios enlaces.
async function scrollCandidateList(page) {
  return page
    .evaluate((patternSource) => {
      const pattern = new RegExp(patternSource);
      const anchor = [...document.querySelectorAll('a[href]')].find((a) => pattern.test(a.href));
      let el = anchor?.parentElement ?? null;
      while (el && el !== document.body && el.scrollHeight <= el.clientHeight + 10) {
        el = el.parentElement;
      }
      const target =
        el && el.scrollHeight > el.clientHeight + 10 ? el : document.scrollingElement;
      if (!target) return false;
      const before = target.scrollTop;
      target.scrollTop = target.scrollHeight;
      return target.scrollTop > before;
    }, DETAIL_URL_PATTERN.source)
    .catch(() => false);
}

// La paginacion de LinkedIn (artdeco) puede ser un boton con texto
// "Siguiente", solo-icono con aria-label, o botones numerados por pagina.
// Se prueban varias estrategias de mas especifica a mas generica, y dentro
// de cada una se descartan candidatos deshabilitados.
async function findNextPageTrigger(page, nextPageNumber) {
  const locators = [
    // Clase estable de la paginacion artdeco de LinkedIn.
    page.locator('button.artdeco-pagination__button--next'),
    page.getByRole('button', { name: NEXT_PAGE_EXACT }),
    page.getByRole('link', { name: NEXT_PAGE_EXACT }),
    page.locator(
      'button[aria-label*="siguiente" i], a[aria-label*="siguiente" i], button[aria-label*="next" i], a[aria-label*="next" i]'
    ),
    // Paginacion numerada: el boton de la pagina N.
    page.getByRole('button', { name: new RegExp(`^(p[aá]gina |page )?${nextPageNumber}$`, 'i') }),
  ];

  for (const locator of locators) {
    const count = await locator.count().catch(() => 0);
    for (let i = 0; i < count; i++) {
      const el = locator.nth(i);
      const disabled = await el.isDisabled().catch(() => false);
      const ariaDisabled = await el.getAttribute('aria-disabled').catch(() => null);
      if (disabled || ariaDisabled === 'true') continue;
      return el;
    }
  }
  return null;
}

// El boton puede estar fuera del area visible del panel o tapado por otra
// capa: se intenta el click normal con timeout corto y se degrada a click
// forzado y a click via DOM antes de rendirse.
async function clickTrigger(trigger) {
  await trigger.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
  try {
    await trigger.click({ timeout: 5000 });
    return true;
  } catch {
    // sigue con el siguiente metodo
  }
  try {
    await trigger.click({ timeout: 3000, force: true });
    return true;
  } catch {
    // sigue con el siguiente metodo
  }
  return trigger
    .evaluate((el) => {
      el.click();
      return true;
    })
    .catch(() => false);
}

// Detecta si la pagina actual es una lista de candidatos y, si lo es,
// recorre scroll infinito y/o paginacion hasta agotar resultados nuevos.
export async function detectAllCandidateLinks(
  page,
  { maxScrolls = 30, maxPages = 20, log = () => {} } = {}
) {
  const all = new Map();

  const absorb = (links) => {
    let added = 0;
    for (const link of links) {
      if (!all.has(link.id)) {
        all.set(link.id, link);
        added += 1;
      }
    }
    return added;
  };

  for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
    absorb(await collectCandidateLinks(page));

    let stableRounds = 0;
    for (let i = 0; i < maxScrolls && stableRounds < 2; i++) {
      const scrolled = await scrollCandidateList(page);
      await page.waitForTimeout(400 + Math.random() * 300);
      const added = absorb(await collectCandidateLinks(page));
      stableRounds = added > 0 ? 0 : stableRounds + 1;
      if (!scrolled && stableRounds >= 2) break;
    }

    log(`Pagina ${pageNum} de la lista: ${all.size} candidatos acumulados`);

    const next = await findNextPageTrigger(page, pageNum + 1);
    if (!next) {
      log('No se encontro boton de pagina siguiente; se asume fin de la lista.');
      break;
    }

    const firstIdBefore = (await collectCandidateLinks(page))[0]?.id ?? null;
    const clicked = await clickTrigger(next);
    if (!clicked) {
      log('No se pudo pulsar el boton de pagina siguiente; se asume fin de la lista.');
      break;
    }

    // Espera a que la nueva pagina de la lista se renderice de verdad
    // (cambia el primer candidato visible o aparecen ids nuevos), en vez
    // de confiar en un sleep fijo.
    let progressed = false;
    for (let i = 0; i < 20 && !progressed; i++) {
      await page.waitForTimeout(500);
      const fresh = await collectCandidateLinks(page);
      const added = absorb(fresh);
      if (added > 0 || (fresh.length > 0 && fresh[0].id !== firstIdBefore)) progressed = true;
    }

    if (!progressed) {
      log('La lista no cambio tras pulsar "Siguiente"; se asume fin de la lista.');
      break;
    }
  }

  return [...all.values()].map(({ url, name, photoUrl }) => ({ url, name, photoUrl }));
}

export function looksLikeCandidateDetailPage(url) {
  return DETAIL_URL_PATTERN.test(url);
}
