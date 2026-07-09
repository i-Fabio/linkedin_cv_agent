import { Router } from 'express';
import { db } from '../db/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { readRunLog } from '../utils/logger.js';

export const runsRouter = Router();

// GET /api/runs/:id/logs
runsRouter.get(
  '/:id/logs',
  asyncHandler(async (req, res) => {
    const run = db.prepare('SELECT * FROM extraction_runs WHERE id = ?').get(req.params.id);
    if (!run) {
      return res.status(404).json({ error: 'Run no encontrado' });
    }
    const lines = readRunLog(run.log_path);
    res.json({ run, lines });
  })
);
