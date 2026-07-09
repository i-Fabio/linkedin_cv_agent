import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { db } from '../db/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { JOB_STATUSES } from '../utils/constants.js';
import { config } from '../config.js';
import { openBrowserForJob, confirmLogin, getActiveRun } from '../automation/browserManager.js';

export const jobsRouter = Router();

function nowIso() {
  return new Date().toISOString();
}

function getJobCounts(jobId) {
  const candidates = db
    .prepare('SELECT COUNT(*) AS count FROM candidates WHERE job_id = ?')
    .get(jobId).count;
  const questionMappings = db
    .prepare('SELECT COUNT(*) AS count FROM question_mappings WHERE job_id = ?')
    .get(jobId).count;
  return { candidates_count: candidates, question_mappings_count: questionMappings };
}

function findJobOr404(req, res) {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
  if (!job) {
    res.status(404).json({ error: 'Vacante no encontrada' });
    return null;
  }
  return job;
}

// GET /api/jobs
jobsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const jobs = db.prepare('SELECT * FROM jobs ORDER BY created_at DESC').all();
    const withCounts = jobs.map((job) => ({
      ...job,
      ...getJobCounts(job.id),
      active_run: getActiveRun(job.id) ?? null,
    }));
    res.json(withCounts);
  })
);

// POST /api/jobs
jobsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, linkedin_url, download_dir } = req.body || {};

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'El campo "name" es obligatorio' });
    }
    if (!linkedin_url || !linkedin_url.trim()) {
      return res.status(400).json({ error: 'El campo "linkedin_url" es obligatorio' });
    }

    const timestamp = nowIso();
    const insert = db
      .prepare(
        `INSERT INTO jobs (name, linkedin_url, download_dir, status, created_at, updated_at)
         VALUES (?, ?, ?, 'pending', ?, ?)`
      )
      .run(name.trim(), linkedin_url.trim(), download_dir || null, timestamp, timestamp);

    const jobId = insert.lastInsertRowid;

    // Si no se especifico carpeta de descarga, asignar una por defecto dentro de data/downloads.
    let finalDownloadDir = download_dir;
    if (!finalDownloadDir) {
      finalDownloadDir = path.join(config.downloadsDir, `job-${jobId}`);
      db.prepare('UPDATE jobs SET download_dir = ? WHERE id = ?').run(finalDownloadDir, jobId);
    }
    fs.mkdirSync(finalDownloadDir, { recursive: true });

    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
    res.status(201).json(job);
  })
);

// GET /api/jobs/:id
jobsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const job = findJobOr404(req, res);
    if (!job) return;
    res.json({ ...job, ...getJobCounts(job.id), active_run: getActiveRun(job.id) ?? null });
  })
);

// POST /api/jobs/:id/open-browser
jobsRouter.post(
  '/:id/open-browser',
  asyncHandler(async (req, res) => {
    const job = findJobOr404(req, res);
    if (!job) return;

    const { run, reused } = await openBrowserForJob(job);

    if (!reused) {
      db.prepare("UPDATE jobs SET status = 'in_progress', last_run_at = ?, updated_at = ? WHERE id = ?").run(
        nowIso(),
        nowIso(),
        job.id
      );
    }

    res.status(201).json({ run, reused });
  })
);

// POST /api/jobs/:id/confirm-login
jobsRouter.post(
  '/:id/confirm-login',
  asyncHandler(async (req, res) => {
    const job = findJobOr404(req, res);
    if (!job) return;

    const run = confirmLogin(job.id);
    if (!run) {
      return res.status(409).json({ error: 'No hay ningun navegador abierto para esta vacante' });
    }

    res.json({ run });
  })
);

// PUT /api/jobs/:id
jobsRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const job = findJobOr404(req, res);
    if (!job) return;

    const { name, linkedin_url, download_dir, status, last_run_at } = req.body || {};

    if (status && !JOB_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `"status" debe ser uno de: ${JOB_STATUSES.join(', ')}`,
      });
    }

    const updated = {
      name: name !== undefined ? name.trim() : job.name,
      linkedin_url: linkedin_url !== undefined ? linkedin_url.trim() : job.linkedin_url,
      download_dir: download_dir !== undefined ? download_dir : job.download_dir,
      status: status !== undefined ? status : job.status,
      last_run_at: last_run_at !== undefined ? last_run_at : job.last_run_at,
    };

    db.prepare(
      `UPDATE jobs SET name = ?, linkedin_url = ?, download_dir = ?, status = ?, last_run_at = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      updated.name,
      updated.linkedin_url,
      updated.download_dir,
      updated.status,
      updated.last_run_at,
      nowIso(),
      job.id
    );

    const fresh = db.prepare('SELECT * FROM jobs WHERE id = ?').get(job.id);
    res.json(fresh);
  })
);

// DELETE /api/jobs/:id
jobsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const job = findJobOr404(req, res);
    if (!job) return;

    db.prepare('DELETE FROM jobs WHERE id = ?').run(job.id);
    res.status(204).send();
  })
);
