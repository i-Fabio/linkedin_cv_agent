import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { apiRouter } from './routes/index.js';
import { logger } from './utils/logger.js';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(morgan('dev'));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api', apiRouter);

  app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    logger.error(err.message, { stack: err.stack });
    res.status(err.status || 500).json({ error: err.message || 'Error interno del servidor' });
  });

  return app;
}
