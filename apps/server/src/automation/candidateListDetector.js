// Heuristica de deteccion de la lista de candidatos: LinkedIn no tiene
// clases CSS estables, pero las URLs de detalle de candidato en la vista de
// reclutador siguen el patron /applicants/{id}/detail (ver docs/05_PLAYWRIGHT_FLOW.md).
const DETAIL_URL_PATTERN = /\/applicants\/\d+\/detail/;

const NEXT_PAGE_PATTERN = /^(siguiente|next|pr[oó]xima?)$/i;

async function collectCandidateLinks(page) {
  return page.$$eval(
    'a[href]',
    (anchors, patternSource) => {
      const pattern = new RegExp(patternSource);
      const seen = new Map();
      for (const a of anchors) {
        if (pattern.test(a.href) && !seen.has(a.href)) {
          seen.set(a.href, a.innerText?.trim() || null);
        }
      }
      return [...seen.entries()].map(([url, name]) => ({ url, name }));
    },
    DETAIL_URL_PATTERN.source
  );
}

async function scrollToBottom(page) {
  const before = await page.evaluate(() => document.body.scrollHeight);
  await page.mouse.wheel(0, 2500);
  await page.waitForTimeout(500 + Math.random() * 400);
  const after = await page.evaluate(() => document.body.scrollHeight);
  return after > before;
}

async function clickNextPage(page) {
  const next = page.getByRole('link', { name: NEXT_PAGE_PATTERN }).or(
    page.getByRole('button', { name: NEXT_PAGE_PATTERN })
  );
  if ((await next.count()) === 0) return false;
  const button = next.first();
  if (await button.isDisabled().catch(() => true)) return false;
  await button.click().catch(() => {});
  await page.waitForTimeout(800 + Math.random() * 400);
  return true;
}

// Detecta si la pagina actual es una lista de candidatos y, si lo es,
// recorre scroll infinito y/o paginacion hasta agotar resultados nuevos.
export async function detectAllCandidateLinks(page, { maxScrolls = 30, maxPages = 20 } = {}) {
  const all = new Map();
  let pages = 0;

  while (pages < maxPages) {
    let links = await collectCandidateLinks(page);
    for (const link of links) all.set(link.url, link.name);

    let stableRounds = 0;
    for (let i = 0; i < maxScrolls && stableRounds < 2; i++) {
      const grew = await scrollToBottom(page);
      const updated = await collectCandidateLinks(page);
      const before = all.size;
      for (const link of updated) all.set(link.url, link.name);
      stableRounds = all.size > before ? 0 : stableRounds + 1;
      if (!grew && stableRounds >= 2) break;
    }

    pages += 1;
    const advanced = await clickNextPage(page);
    if (!advanced) break;
  }

  return [...all.entries()].map(([url, name]) => ({ url, name }));
}

export function looksLikeCandidateDetailPage(url) {
  return DETAIL_URL_PATTERN.test(url);
}
