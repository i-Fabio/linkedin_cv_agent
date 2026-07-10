import { db } from '../db/index.js';
import { getSession, isBusy, setBusy, setRunStatus } from './browserManager.js';
import { detectAllCandidateLinks, looksLikeCandidateDetailPage } from './candidateListDetector.js';
import { extractCurrentCandidate } from './candidateExtractor.js';
import { downloadCurrentCandidatePdf } from './pdfDownloader.js';
import { cleanCandidateName } from './candidateStore.js';

function nowIso() {
  return new Date().toISOString();
}

function randomDelay(min = 400, max = 1200) {
  return new Promise((resolve) => setTimeout(resolve, min + Math.random() * (max - min)));
}

// Valida y arranca la extraccion en segundo plano; devuelve el run
// inmediatamente en estado 'processing' sin esperar a que termine.
export function startFullExtraction(job) {
  const session = getSession(job.id);
  if (!session) {
    throw new Error('No hay ningun navegador abierto para esta vacante');
  }
  if (isBusy(job.id)) {
    throw new Error('Ya hay una extraccion en curso para esta vacante');
  }

  setBusy(job.id, true);
  const run = setRunStatus(job.id, 'processing');
  session.runLogger.info('Iniciando extraccion de toda la lista de candidatos');

  runFullExtractionInBackground(job, session).catch((err) => {
    session.runLogger.error(`Extraccion abortada: ${err.message}`);
  });

  return run;
}

async function runFullExtractionInBackground(job, session) {
  const { page, runLogger } = session;

  try {
    let links = await detectAllCandidateLinks(page, { log: (msg) => runLogger.info(msg) });

    if (links.length === 0 && looksLikeCandidateDetailPage(page.url())) {
      runLogger.info('La pagina actual ya es el detalle de un unico candidato; se procesara solo ese.');
      links = [{ url: page.url(), name: null }];
    }

    if (links.length === 0) {
      runLogger.warn('No se detecto ninguna lista de candidatos ni una pagina de detalle en la URL actual');
    } else {
      runLogger.info(`Detectados ${links.length} candidatos`);
    }

    db.prepare('UPDATE extraction_runs SET total_candidates = ? WHERE id = ?').run(
      links.length,
      session.runId
    );

    let processed = 0;
    let errors = 0;

    for (const link of links) {
      try {
        if (page.url() !== link.url) {
          await page.goto(link.url, { waitUntil: 'domcontentloaded' });
        }
        // La primera linea de la tarjeta de la lista suele ser el nombre;
        // sirve de respaldo si la pagina de detalle no lo expone.
        await extractCurrentCandidate(job, { fallbackName: cleanCandidateName(link.name) });
        try {
          await downloadCurrentCandidatePdf(job);
        } catch (pdfErr) {
          runLogger.warn(`Sin PDF para ${link.url}: ${pdfErr.message}`);
        }
        processed += 1;
      } catch (err) {
        errors += 1;
        runLogger.error(`Error procesando ${link.url}: ${err.message}`);
      }

      db.prepare(
        'UPDATE extraction_runs SET processed_candidates = ?, errors_count = ? WHERE id = ?'
      ).run(processed, errors, session.runId);

      await randomDelay();
    }

    runLogger.info(`Extraccion finalizada: ${processed} procesados, ${errors} errores`);
    db.prepare("UPDATE extraction_runs SET status = 'completed', finished_at = ? WHERE id = ?").run(
      nowIso(),
      session.runId
    );
    db.prepare(
      "UPDATE jobs SET status = 'completed', last_run_at = ?, updated_at = ? WHERE id = ?"
    ).run(nowIso(), nowIso(), job.id);
  } catch (err) {
    runLogger.error(`Extraccion abortada: ${err.message}`);
    db.prepare("UPDATE extraction_runs SET status = 'error', finished_at = ? WHERE id = ?").run(
      nowIso(),
      session.runId
    );
    db.prepare("UPDATE jobs SET status = 'error', updated_at = ? WHERE id = ?").run(nowIso(), job.id);
  } finally {
    setBusy(job.id, false);
    // Cierra el navegador al terminar: si se dejara abierto, el run pasa a un
    // estado terminal (completed/error) pero la sesion en memoria seguiria
    // "activa", y un futuro "Abrir navegador" para esta vacante reutilizaria
    // ese navegador sin crear un run nuevo, dejando la UI bloqueada.
    runLogger.info('Cerrando navegador al finalizar la extraccion.');
    await session.context.close().catch(() => {});
  }
}
