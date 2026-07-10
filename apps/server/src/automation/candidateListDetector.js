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
          seen.set(match[1], { url: a.href, name: a.innerText?.trim() || null });
        }
      }
      return [...seen.entries()].map(([id, { url, name }]) => ({ id, url, name }));
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

// El boton de paginacion de LinkedIn suele ser solo un icono con
// aria-label="Siguiente", asi que ademas del nombre accesible exacto se
// prueba con aria-label parcial.
async function findNextPageTrigger(page) {
  const locators = [
    page.getByRole('button', { name: NEXT_PAGE_EXACT }),
    page.getByRole('link', { name: NEXT_PAGE_EXACT }),
    page.locator(
      'button[aria-label*="siguiente" i], a[aria-label*="siguiente" i], button[aria-label*="next" i], a[aria-label*="next" i]'
    ),
  ];

  for (const locator of locators) {
    if ((await locator.count()) === 0) continue;
    const first = locator.first();
    const disabled = await first.isDisabled().catch(() => false);
    const ariaDisabled = await first.getAttribute('aria-disabled').catch(() => null);
    if (!disabled && ariaDisabled !== 'true') return first;
  }
  return null;
}

// Detecta si la pagina actual es una lista de candidatos y, si lo es,
// recorre scroll infinito y/o paginacion hasta agotar resultados nuevos.
export async function detectAllCandidateLinks(page, { maxScrolls = 30, maxPages = 20 } = {}) {
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

  for (let pageNum = 0; pageNum < maxPages; pageNum++) {
    absorb(await collectCandidateLinks(page));

    let stableRounds = 0;
    for (let i = 0; i < maxScrolls && stableRounds < 2; i++) {
      const scrolled = await scrollCandidateList(page);
      await page.waitForTimeout(400 + Math.random() * 300);
      const added = absorb(await collectCandidateLinks(page));
      stableRounds = added > 0 ? 0 : stableRounds + 1;
      if (!scrolled && stableRounds >= 2) break;
    }

    const next = await findNextPageTrigger(page);
    if (!next) break;

    const firstIdBefore = (await collectCandidateLinks(page))[0]?.id ?? null;
    await next.click().catch(() => {});

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

    // Si tras el click no aparecio nada nuevo, se asume ultima pagina.
    if (!progressed) break;
  }

  return [...all.values()].map(({ url, name }) => ({ url, name }));
}

export function looksLikeCandidateDetailPage(url) {
  return DETAIL_URL_PATTERN.test(url);
}
