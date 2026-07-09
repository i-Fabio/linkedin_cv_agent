import path from 'node:path';
import { chromium } from 'playwright';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { createRunLogger } from '../utils/logger.js';

// jobId -> { context, page, runId, runLogger }
// Un unico navegador persistente por vacante a la vez (herramienta local, uso manual).
const sessions = new Map();

function nowIso() {
  return new Date().toISOString();
}

function sessionUserDataDir(jobId) {
  return path.join(config.browserSessionDir, `job-${jobId}`);
}

export function getActiveRun(jobId) {
  return db
    .prepare(
      `SELECT * FROM extraction_runs
       WHERE job_id = ? AND status NOT IN ('completed', 'error')
       ORDER BY id DESC LIMIT 1`
    )
    .get(jobId);
}

export function hasOpenSession(jobId) {
  return sessions.has(jobId);
}

export async function openBrowserForJob(job) {
  const existing = sessions.get(job.id);
  if (existing) {
    await existing.page.bringToFront();
    const run = db.prepare('SELECT * FROM extraction_runs WHERE id = ?').get(existing.runId);
    return { run, reused: true };
  }

  const startedAt = nowIso();
  const insert = db
    .prepare(
      `INSERT INTO extraction_runs (job_id, status, started_at, log_path)
       VALUES (?, 'opening', ?, '')`
    )
    .run(job.id, startedAt);
  const runId = insert.lastInsertRowid;

  const runLogger = createRunLogger(runId);
  db.prepare('UPDATE extraction_runs SET log_path = ? WHERE id = ?').run(runLogger.logPath, runId);
  runLogger.info(`Abriendo navegador para la vacante "${job.name}"`);

  let context;
  try {
    context = await chromium.launchPersistentContext(sessionUserDataDir(job.id), {
      headless: false,
      slowMo: 75,
      viewport: null,
    });
  } catch (err) {
    runLogger.error(`No se pudo abrir el navegador: ${err.message}`);
    db.prepare("UPDATE extraction_runs SET status = 'error', finished_at = ? WHERE id = ?").run(
      nowIso(),
      runId
    );
    throw err;
  }

  const page = context.pages()[0] ?? (await context.newPage());

  context.on('close', () => {
    sessions.delete(job.id);
  });

  runLogger.info(`Navegando a ${job.linkedin_url}`);
  try {
    await page.goto(job.linkedin_url, { waitUntil: 'domcontentloaded' });
  } catch (err) {
    runLogger.error(`Error al navegar a la URL: ${err.message}`);
  }

  runLogger.info('Navegador abierto. Inicia sesion manualmente en LinkedIn y pulsa "Estoy logueado, continuar".');
  db.prepare("UPDATE extraction_runs SET status = 'awaiting_login' WHERE id = ?").run(runId);

  sessions.set(job.id, { context, page, runId, runLogger });

  const run = db.prepare('SELECT * FROM extraction_runs WHERE id = ?').get(runId);
  return { run, reused: false };
}

export function confirmLogin(jobId) {
  const session = sessions.get(jobId);
  if (!session) {
    return null;
  }

  session.runLogger.info(
    'Usuario confirmo login manual. La extraccion automatica de candidatos llega en la Fase 4.'
  );
  db.prepare("UPDATE extraction_runs SET status = 'awaiting_extraction' WHERE id = ?").run(
    session.runId
  );

  return db.prepare('SELECT * FROM extraction_runs WHERE id = ?').get(session.runId);
}
