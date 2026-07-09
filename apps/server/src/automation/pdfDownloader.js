import path from 'node:path';
import { db } from '../db/index.js';
import { getSession } from './browserManager.js';
import { findOrCreateCandidateStub, deriveNameFromTitle } from './candidateStore.js';
import { normalizeFilename } from '../utils/normalizeFilename.js';

// LinkedIn cambia el texto de los botones con frecuencia (ver
// docs/09_IMPLEMENTATION_NOTES.md), asi que se busca por nombre accesible
// visible en vez de clases CSS.
const CV_LINK_PATTERN = /descargar\s*cv|download\s*(resume|cv)|curriculum(\s*vitae)?|ver\s*cv/i;

async function findCvTrigger(page) {
  const locators = [page.getByRole('link', { name: CV_LINK_PATTERN }), page.getByRole('button', { name: CV_LINK_PATTERN })];
  for (const locator of locators) {
    if ((await locator.count()) > 0) {
      return locator.first();
    }
  }
  return null;
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

  const trigger = await findCvTrigger(page);
  if (!trigger) {
    runLogger.warn('No se encontro un enlace/boton de descarga de CV en la pagina actual');
    throw new Error('No se encontro un enlace de descarga de CV en esta pagina');
  }

  const downloadPromise = context.waitForEvent('download', { timeout: 15000 }).catch(() => null);
  const popupPromise = page.waitForEvent('popup', { timeout: 3000 }).catch(() => null);

  await trigger.click();

  let download = await downloadPromise;
  if (!download) {
    // El CV puede abrirse en una pestana nueva en vez de descargarse directamente.
    const popup = await popupPromise;
    if (popup) {
      download = await popup.waitForEvent('download', { timeout: 10000 }).catch(() => null);
      await popup.close().catch(() => {});
    }
  }

  if (!download) {
    runLogger.error('El CV se abrio (posiblemente en un visor) pero no se detecto una descarga real');
    throw new Error('No se pudo descargar el PDF (puede haberse abierto en un visor en vez de descargarse)');
  }

  const profileUrl = page.url();
  const derivedName = deriveNameFromTitle(await page.title());
  const candidate = findOrCreateCandidateStub(job.id, profileUrl, derivedName);

  const baseName = candidate.name ? normalizeFilename(candidate.name) : `candidato_${candidate.id}`;
  const fileName = `${baseName}.pdf`;
  const targetPath = path.join(job.download_dir, fileName);

  await download.saveAs(targetPath);
  runLogger.info(`CV descargado: ${fileName}`);

  const newStatus = candidate.raw_answers_json ? 'ok' : candidate.extraction_status;
  db.prepare(
    'UPDATE candidates SET pdf_filename = ?, pdf_path = ?, extraction_status = ?, updated_at = ? WHERE id = ?'
  ).run(fileName, targetPath, newStatus, nowIso(), candidate.id);

  return db.prepare('SELECT * FROM candidates WHERE id = ?').get(candidate.id);
}
