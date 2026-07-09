import { Router } from 'express';
import fs from 'node:fs';
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

// GET /api/runs/:id/events (SSE)
runsRouter.get('/:id/events', (req, res) => {
  const run = db.prepare('SELECT * FROM extraction_runs WHERE id = ?').get(req.params.id);
  if (!run) {
    return res.status(404).json({ error: 'Run no encontrado' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  let lastSize = 0;
  let lastStatus = null;

  function sendLine(line) {
    res.write(`event: log\ndata: ${JSON.stringify({ line })}\n\n`);
  }

  function sendStatus(status) {
    res.write(`event: status\ndata: ${JSON.stringify({ status })}\n\n`);
  }

  function poll() {
    const current = db.prepare('SELECT * FROM extraction_runs WHERE id = ?').get(run.id);
    if (!current) return;

    if (current.status !== lastStatus) {
      lastStatus = current.status;
      sendStatus(current.status);
    }

    if (current.log_path && fs.existsSync(current.log_path)) {
      const { size } = fs.statSync(current.log_path);
      if (size > lastSize) {
        const chunk = fs
          .readFileSync(current.log_path, 'utf-8')
          .slice(lastSize)
          .split('\n')
          .filter((line) => line.trim().length > 0);
        chunk.forEach(sendLine);
        lastSize = size;
      }
    }
  }

  poll();
  const interval = setInterval(poll, 1000);

  req.on('close', () => {
    clearInterval(interval);
  });
});
