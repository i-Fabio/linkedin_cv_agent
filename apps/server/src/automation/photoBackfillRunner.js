import { db } from '../db/index.js';
import { getSession, isBusy, setBusy, setRunStatus } from './browserManager.js';
import { detectAllCandidateLinks } from './candidateListDetector.js';
import { canonicalProfileUrl } from './candidateStore.js';
import { downloadCandidatePhoto } from './candidateExtractor.js';

function nowIso() {
  return new Date().toISOString();
}

// Repasa los candidatos ya procesados que se quedaron sin foto (extraidos
// antes de que esta funcion existiera, o para los que no se encontro en su
// momento). Requiere un navegador abierto con login confirmado, igual que
// "Iniciar extraccion", y reutiliza el mismo run/slot de "ocupado" (no
// pueden correr a la vez).
export function startPhotoBackfill(job) {
  const session = getSession(job.id);
  if (!session) {
    throw new Error('No hay ningun navegador abierto para esta vacante');
  }
  if (isBusy(job.id)) {
    throw new Error('Ya hay una extraccion en curso para esta vacante');
  }

  const candidates = db
    .prepare(
      `SELECT * FROM candidates
       WHERE job_id = ? AND photo_path IS NULL AND linkedin_profile_url IS NOT NULL`
    )
    .all(job.id);

  if (candidates.length === 0) {
    throw new Error('No hay candidatos pendientes de foto');
  }

  setBusy(job.id, true);
  const run = setRunStatus(job.id, 'processing');
  session.runLogger.info(`Buscando foto de perfil para ${candidates.length} candidato(s) ya procesados`);

  runPhotoBackfillInBackground(job, session, candidates).catch((err) => {
    session.runLogger.error(`Backfill de fotos abortado: ${err.message}`);
  });

  return run;
}

async function runPhotoBackfillInBackground(job, session, candidates) {
  const { page, runLogger } = session;

  db.prepare('UPDATE extraction_runs SET total_candidates = ? WHERE id = ?').run(
    candidates.length,
    session.runId
  );

  try {
    // Recorre la lista de solicitantes paginando UNA sola vez y lee la foto
    // directamente de cada fila, en vez de visitar la pagina de cada
    // candidato: su miniatura solo existe en el DOM mientras esa fila esta
    // cargada/paginada en la lista lateral, y navegar directo a su URL no la
    // trae de vuelta si no esta en la primera pagina (confirmado con datos
    // reales el 2026-09-16: 76/88 candidatos sin foto por esta razon).
    const links = await detectAllCandidateLinks(page, { log: (msg) => runLogger.info(msg) });
    const photoByUrl = new Map();
    for (const link of links) {
      if (link.photoUrl) photoByUrl.set(canonicalProfileUrl(link.url), link.photoUrl);
    }
    runLogger.info(`Lista recorrida: ${photoByUrl.size} foto(s) disponibles de ${links.length} fila(s)`);

    let processed = 0;
    let found = 0;

    for (const candidate of candidates) {
      const label = candidate.name ?? `candidato ${candidate.id}`;
      const photoUrl = photoByUrl.get(canonicalProfileUrl(candidate.linkedin_profile_url));

      if (photoUrl) {
        const photo = await downloadCandidatePhoto(session.context, job, candidate, photoUrl);
        if (photo) {
          db.prepare(
            'UPDATE candidates SET photo_filename = ?, photo_path = ?, updated_at = ? WHERE id = ?'
          ).run(photo.fileName, photo.targetPath, nowIso(), candidate.id);
          found += 1;
          runLogger.info(`Foto encontrada para ${label}`);
        } else {
          runLogger.warn(`No se pudo descargar la foto de ${label}`);
        }
      } else {
        runLogger.warn(`Sin foto en la lista para ${label} (ya no esta en el listado actual de la vacante?)`);
      }

      processed += 1;
      db.prepare('UPDATE extraction_runs SET processed_candidates = ? WHERE id = ?').run(
        processed,
        session.runId
      );
    }

    runLogger.info(`Backfill de fotos finalizado: ${found} de ${candidates.length} candidato(s) con foto nueva`);
    db.prepare("UPDATE extraction_runs SET status = 'completed', finished_at = ? WHERE id = ?").run(
      nowIso(),
      session.runId
    );
  } catch (err) {
    runLogger.error(`Backfill de fotos abortado: ${err.message}`);
    db.prepare("UPDATE extraction_runs SET status = 'error', finished_at = ? WHERE id = ?").run(
      nowIso(),
      session.runId
    );
  } finally {
    setBusy(job.id, false);
    runLogger.info('Cerrando navegador al finalizar la busqueda de fotos.');
    await session.context.close().catch(() => {});
  }
}
