import { config } from './config.js';
import { ensureAppDirs } from './utils/ensureDirs.js';
import { runMigrations, recoverStaleRuns } from './db/index.js';
import { createApp } from './app.js';
import { logger } from './utils/logger.js';

ensureAppDirs();
runMigrations();
recoverStaleRuns();

const app = createApp();

app.listen(config.port, () => {
  logger.info(`Servidor escuchando en http://localhost:${config.port}`);
});
