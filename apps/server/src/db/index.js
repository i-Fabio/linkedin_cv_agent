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
