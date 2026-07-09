import Database from 'better-sqlite3';
import { config } from '../config.js';
import { ensureAppDirs } from '../utils/ensureDirs.js';
import { SCHEMA_SQL } from './schema.js';
import { logger } from '../utils/logger.js';

ensureAppDirs();

export const db = new Database(config.databasePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function runMigrations() {
  db.exec(SCHEMA_SQL);
  logger.info('Database ready', { path: config.databasePath });
}

// Al arrancar el servidor no puede haber ningun navegador Playwright vivo
// (viven en memoria del proceso anterior), asi que cualquier run que se haya
// quedado a medias se marca como error para no dejar la UI en un estado fantasma.
export function recoverStaleRuns() {
  const result = db
    .prepare(
      `UPDATE extraction_runs SET status = 'error', finished_at = ?
       WHERE status NOT IN ('completed', 'error')`
    )
    .run(new Date().toISOString());
  if (result.changes > 0) {
    logger.info('Runs huerfanos marcados como error tras reinicio', { count: result.changes });
  }
}
