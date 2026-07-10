import path from 'node:path';
import { db } from '../db/index.js';
import { getSession } from './browserManager.js';
import { findOrCreateCandidateStub, deriveNameFromPage, cleanCandidateName } from './candidateStore.js';
import { normalizeFilename } from '../utils/normalizeFilename.js';

// LinkedIn cambia el texto de los botones con frecuencia (ver
// docs/09_IMPLEMENTATION_NOTES.md), asi que se busca por nombre accesible
// visible en vez de clases CSS.
// El enlace real de LinkedIn es un <a target="_blank"> con
// aria-label="Descargar el currículum de {nombre}" y texto visible "Descargar".
// Ojo con los acentos: "currículum" lleva tilde en la UI en castellano.
const CV_LINK_PATTERN =
  /descargar(\s+el)?\s+curr[ií]culum|descargar\s*cv|download\s+(the\s+)?(resume|cv|curr[ií]culum)|^descargar$|^download$|ver\s*cv/i;

// Extrae el nombre real del candidato del aria-label del enlace de descarga
// ("Descargar el currículum de Jane Doe" / "Download Jane Doe's resume").
function nameFromTriggerLabel(label) {
  if (!label) return null;
  const es = label.match(/descargar(?:\s+el)?\s+curr[ií]culum\s+de\s+(.+)$/i);
  if (es) return es[1].trim();
  const en = label.match(/download\s+(.+?)['’]s\s+(resume|cv)/i);
  if (en) return en[1].trim();
  return null;
}

// La primera vez que se abre la ficha de un solicitante, LinkedIn muestra
// "Analizando el currículum en busca de virus. Actualiza la página ahora."
// y no renderiza el boton de descarga hasta recargar la pagina.
const VIRUS_SCAN_PATTERN =
  /analizando el curr[ií]culum en busca de virus|actualiza la p[aá]gina ahora|scanning\s+(this\s+)?r[eé]sum[eé].*virus|refresh the page now/i;

async function findCvTrigger(page) {
  const locators = [page.getByRole('link', { name: CV_LINK_PATTERN }), page.getByRole('button', { name: CV_LINK_PATTERN })];
  for (const locator of locators) {
    if ((await locator.count()) > 0) {
      return locator.first();
    }
  }
  return null;
}

// La pagina de detalle hidrata el panel del curriculum de forma asincrona:
// se espera activamente en vez de mirar una sola vez.
async function waitForCvTrigger(page, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const trigger = await findCvTrigger(page);
    if (trigger) return trigger;
    await page.waitForTimeout(500);
  }
  return null;
}

async function findCvTriggerWithRetry(page, runLogger, maxReloads = 3) {
  let trigger = await waitForCvTrigger(page);

  for (let attempt = 0; !trigger && attempt < maxReloads; attempt++) {
    const bodyText = await page.innerText('body').catch(() => '');
    if (!VIRUS_SCAN_PATTERN.test(bodyText)) break;

    runLogger.info(
      'LinkedIn esta analizando el CV en busca de virus; recargando la pagina para que aparezca el boton de descarga...'
    );
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(1500 + Math.random() * 1500);
    trigger = await waitForCvTrigger(page);
  }

  return trigger;
}

function nowIso() {
  return new Date().toISOString();
}

export async function downloadCurrentCandidatePdf(job) {
  const session = getSession(job.id);
  if (!session) {
    throw new Error('No hay ningun navegador abierto para esta vacante');
  }

  const { page, context, runLogger } = session;

  const trigger = await findCvTriggerWithRetry(page, runLogger);
  if (!trigger) {
    runLogger.warn('No se encontro un enlace/boton de descarga de CV en la pagina actual');
    throw new Error('No se encontro un enlace de descarga de CV en esta pagina');
  }

  // El primer download de un perfil de navegador recien creado a veces no
  // emite el evento (flakiness observada en pruebas): un segundo clic lo
  // resuelve, asi que se reintenta una vez antes de rendirse.
  let download = null;
  for (let attempt = 1; attempt <= 2 && !download; attempt++) {
    const downloadPromise = context.waitForEvent('download', { timeout: 10000 }).catch(() => null);
    const popupPromise = page.waitForEvent('popup', { timeout: 3000 }).catch(() => null);

    await trigger.click().catch(() => {});

    download = await downloadPromise;
    if (!download) {
      // El CV puede abrirse en una pestana nueva en vez de descargarse directamente.
      const popup = await popupPromise;
      if (popup) {
        download = await popup.waitForEvent('download', { timeout: 10000 }).catch(() => null);
        await popup.close().catch(() => {});
      }
    }

    if (!download && attempt === 1) {
      runLogger.warn('No se detecto descarga tras el clic; reintentando una vez...');
    }
  }

  if (!download) {
    runLogger.error('El CV se abrio (posiblemente en un visor) pero no se detecto una descarga real');
    throw new Error('No se pudo descargar el PDF (puede haberse abierto en un visor en vez de descargarse)');
  }

  const profileUrl = page.url();

  // El aria-label del enlace de descarga contiene el nombre real del
  // candidato; es mas fiable que el h1 o el titulo de la pestana.
  const triggerLabel = await trigger.getAttribute('aria-label').catch(() => null);
  const derivedName =
    cleanCandidateName(nameFromTriggerLabel(triggerLabel)) ?? (await deriveNameFromPage(page));

  let candidate = findOrCreateCandidateStub(job.id, profileUrl, derivedName);
  if (derivedName && candidate.name !== derivedName) {
    db.prepare('UPDATE candidates SET name = ?, updated_at = ? WHERE id = ?').run(
      derivedName,
      nowIso(),
      candidate.id
    );
    candidate = { ...candidate, name: derivedName };
  }

  let baseName = candidate.name ? normalizeFilename(candidate.name) : '';
  if (!baseName) baseName = `candidato_${candidate.id}`;

  // Dos candidatos pueden compartir nombre: si otro candidato de esta vacante
  // ya usa este nombre de archivo, se sufija con el id para no machacar su PDF.
  let fileName = `${baseName}.pdf`;
  const clash = db
    .prepare('SELECT id FROM candidates WHERE job_id = ? AND pdf_filename = ? AND id != ?')
    .get(job.id, fileName, candidate.id);
  if (clash) {
    fileName = `${baseName}_${candidate.id}.pdf`;
  }
  const targetPath = path.join(job.download_dir, fileName);

  await download.saveAs(targetPath);
  runLogger.info(`CV descargado: ${fileName}`);

  const newStatus = candidate.raw_answers_json ? 'ok' : candidate.extraction_status;
  db.prepare(
    'UPDATE candidates SET pdf_filename = ?, pdf_path = ?, extraction_status = ?, updated_at = ? WHERE id = ?'
  ).run(fileName, targetPath, newStatus, nowIso(), candidate.id);

  return db.prepare('SELECT * FROM candidates WHERE id = ?').get(candidate.id);
}
