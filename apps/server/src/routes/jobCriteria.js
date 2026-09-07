import { Router } from 'express';
import { db } from '../db/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const CRITERION_TYPES = ['must_have', 'nice_to_have'];

function nowIso() {
  return new Date().toISOString();
}

function findJobOr404(jobId, res) {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
  if (!job) {
    res.status(404).json({ error: 'Vacante no encontrada' });
    return null;
  }
  return job;
}

function findCriterionOr404(id, res) {
  const criterion = db.prepare('SELECT * FROM job_criteria WHERE id = ?').get(id);
  if (!criterion) {
    res.status(404).json({ error: 'Criterio no encontrado' });
    return null;
  }
  return criterion;
}

// Valida tipo y peso. El peso solo aplica a nice_to_have (0-100); para
// must_have se fuerza a 0. La regla "los pesos nice_to_have deben sumar 100"
// se comprueba en el frontend como aviso, no aqui: bloquearla por peticion
// impediria construir la lista de criterios de forma incremental.
function validateCriterion({ type, weight }, res) {
  if (type !== undefined && !CRITERION_TYPES.includes(type)) {
    res.status(400).json({ error: `"type" debe ser uno de: ${CRITERION_TYPES.join(', ')}` });
    return false;
  }
  if (weight !== undefined && (!Number.isInteger(weight) || weight < 0 || weight > 100)) {
    res.status(400).json({ error: '"weight" debe ser un entero entre 0 y 100' });
    return false;
  }
  return true;
}

// Router anidado bajo /api/jobs/:jobId/criteria (requiere mergeParams)
export const jobCriteriaRouter = Router({ mergeParams: true });

// GET /api/jobs/:jobId/criteria
jobCriteriaRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    if (!findJobOr404(req.params.jobId, res)) return;
    const criteria = db
      .prepare(
        `SELECT * FROM job_criteria WHERE job_id = ?
         ORDER BY CASE type WHEN 'must_have' THEN 0 ELSE 1 END, created_at ASC`
      )
      .all(req.params.jobId);
    res.json(criteria);
  })
);

// POST /api/jobs/:jobId/criteria
jobCriteriaRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const job = findJobOr404(req.params.jobId, res);
    if (!job) return;

    const { name, type, weight = 0, description = null } = req.body || {};

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'El campo "name" es obligatorio' });
    }
    if (!type) {
      return res.status(400).json({ error: 'El campo "type" es obligatorio' });
    }
    if (!validateCriterion({ type, weight }, res)) return;

    const timestamp = nowIso();
    const insert = db
      .prepare(
        `INSERT INTO job_criteria (job_id, name, type, weight, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        job.id,
        name.trim(),
        type,
        type === 'must_have' ? 0 : weight,
        description ? String(description).trim() : null,
        timestamp,
        timestamp
      );

    const criterion = db.prepare('SELECT * FROM job_criteria WHERE id = ?').get(insert.lastInsertRowid);
    res.status(201).json(criterion);
  })
);

// Router plano bajo /api/criteria/:id
export const criteriaRouter = Router();

// PUT /api/criteria/:id
criteriaRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const criterion = findCriterionOr404(req.params.id, res);
    if (!criterion) return;

    const { name, type, weight, description } = req.body || {};
    if (!validateCriterion({ type, weight }, res)) return;
    if (name !== undefined && !String(name).trim()) {
      return res.status(400).json({ error: 'El campo "name" no puede estar vacío' });
    }

    const updated = {
      name: name !== undefined ? String(name).trim() : criterion.name,
      type: type !== undefined ? type : criterion.type,
      weight: weight !== undefined ? weight : criterion.weight,
      description:
        description !== undefined
          ? description
            ? String(description).trim()
            : null
          : criterion.description,
    };
    if (updated.type === 'must_have') updated.weight = 0;

    db.prepare(
      `UPDATE job_criteria SET name = ?, type = ?, weight = ?, description = ?, updated_at = ?
       WHERE id = ?`
    ).run(updated.name, updated.type, updated.weight, updated.description, nowIso(), criterion.id);

    const fresh = db.prepare('SELECT * FROM job_criteria WHERE id = ?').get(criterion.id);
    res.json(fresh);
  })
);

// DELETE /api/criteria/:id
criteriaRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const criterion = findCriterionOr404(req.params.id, res);
    if (!criterion) return;

    db.prepare('DELETE FROM job_criteria WHERE id = ?').run(criterion.id);
    res.status(204).send();
  })
);
