import { db, runMigrations } from './index.js';
import { saveCvTextForCandidate } from '../analysis/cvTextExtractor.js';
import { logger } from '../utils/logger.js';

// Extrae el texto de los CVs descargados antes de que existiera el hook de
// extraccion automatica (Fase 2). Solo procesa candidatos con PDF y sin fila
// en cv_texts, asi que se puede relanzar sin coste.
export async function backfillCvTexts() {
  runMigrations();

  const pending = db
    .prepare(
      `SELECT c.* FROM candidates c
       LEFT JOIN cv_texts t ON t.candidate_id = c.id
       WHERE c.pdf_path IS NOT NULL AND t.candidate_id IS NULL`
    )
    .all();

  logger.info(`Backfill de texto de CV: ${pending.length} candidatos pendientes`);

  let ok = 0;
  let failed = 0;
  for (const candidate of pending) {
    const { result } = await saveCvTextForCandidate(candidate);
    if (result.success) {
      ok++;
    } else {
      failed++;
      logger.error(`Candidato ${candidate.id} (${candidate.name ?? 'sin nombre'}): ${result.error}`);
    }
  }

  logger.info(`Backfill terminado: ${ok} extraidos, ${failed} marcados como cv_unreadable`);
  return { total: pending.length, ok, failed };
}

// Permite ejecutarlo directamente: node src/db/backfillCvTexts.js
if (import.meta.url === `file://${process.argv[1]}`) {
  await backfillCvTexts();
}
