import { db, runMigrations } from './index.js';
import { logger } from '../utils/logger.js';

const SEED_JOB_NAME = '[SEED] Full Stack Developer — prueba análisis CV';

// Criterios de ejemplo para validar la Fase 1: 2 must-have y 2 nice-to-have
// cuyos pesos suman 100 (regla del PRD para nice_to_have).
const SEED_CRITERIA = [
  {
    name: 'Experiencia en React y TypeScript',
    type: 'must_have',
    weight: 0,
    description: 'Al menos 2 años de experiencia demostrable con React y TypeScript en proyectos reales.',
  },
  {
    name: 'Disponibilidad presencial en Barcelona',
    type: 'must_have',
    weight: 0,
    description: 'Puede trabajar presencialmente en Barcelona al menos 3 días por semana.',
  },
  {
    name: 'Experiencia backend con Node.js',
    type: 'nice_to_have',
    weight: 60,
    description: 'Ha desarrollado APIs o servicios backend con Node.js/Express.',
  },
  {
    name: 'Inglés B2 o superior',
    type: 'nice_to_have',
    weight: 40,
    description: 'Nivel de inglés suficiente para reuniones y documentación técnica.',
  },
];

export function seedCvAnalysis() {
  runMigrations();

  const existing = db.prepare('SELECT id FROM jobs WHERE name = ?').get(SEED_JOB_NAME);
  if (existing) {
    logger.info('Seed ya presente, no se duplica', { jobId: existing.id });
    return existing.id;
  }

  const now = new Date().toISOString();
  const jobId = db.transaction(() => {
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO jobs (name, linkedin_url, status, created_at, updated_at)
         VALUES (?, ?, 'pending', ?, ?)`
      )
      .run(SEED_JOB_NAME, 'https://www.linkedin.com/jobs/seed-cv-analysis', now, now);

    const insertCriterion = db.prepare(
      `INSERT INTO job_criteria (job_id, name, type, weight, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    for (const c of SEED_CRITERIA) {
      insertCriterion.run(lastInsertRowid, c.name, c.type, c.weight, c.description, now, now);
    }
    return lastInsertRowid;
  })();

  logger.info('Seed de análisis de CV creado', { jobId, criteria: SEED_CRITERIA.length });
  return jobId;
}

// Permite ejecutarlo directamente: node src/db/seedCvAnalysis.js
if (import.meta.url === `file://${process.argv[1]}`) {
  seedCvAnalysis();
}
