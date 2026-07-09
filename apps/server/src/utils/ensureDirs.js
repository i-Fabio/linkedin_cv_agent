import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

export function ensureAppDirs() {
  const dirs = [
    config.downloadsDir,
    config.browserSessionDir,
    config.logsDir,
    path.dirname(config.databasePath),
  ];

  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
