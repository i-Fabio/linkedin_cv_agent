import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// apps/server/src -> project root (three levels up)
export const ROOT_DIR = path.resolve(__dirname, '../../..');

dotenv.config({ path: path.join(ROOT_DIR, '.env') });

function resolveFromRoot(value, fallback) {
  const raw = value || fallback;
  return path.isAbsolute(raw) ? raw : path.join(ROOT_DIR, raw);
}

export const config = {
  port: Number(process.env.PORT) || 4000,
  databasePath: resolveFromRoot(process.env.DATABASE_PATH, './data/app.sqlite'),
  downloadsDir: resolveFromRoot(process.env.DOWNLOADS_DIR, './data/downloads'),
  browserSessionDir: resolveFromRoot(process.env.BROWSER_SESSION_DIR, './data/browser-session'),
  logsDir: resolveFromRoot(process.env.LOGS_DIR, './data/logs'),
};
