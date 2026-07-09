import { Router } from 'express';
import { db } from '../db/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { FIELD_TYPES } from '../utils/constants.js';

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

function findMappingOr404(id, res) {
  const mapping = db.prepare('SELECT * FROM question_mappings WHERE id = ?').get(id);
  if (!mapping) {
    res.status(404).json({ error: 'Mapeo de pregunta no encontrado' });
    return null;
  }
  return mapping;
}

function validateFieldType(fieldType, res) {
  if (fieldType !== undefined && !FIELD_TYPES.includes(fieldType)) {
    res.status(400).json({ error: `"field_type" debe ser uno de: ${FIELD_TYPES.join(', ')}` });
    return false;
  }
  return true;
}

// Router anidado bajo /api/jobs/:jobId/question-mappings (requiere mergeParams)
export const jobQuestionMappingsRouter = Router({ mergeParams: true });

// GET /api/jobs/:jobId/question-mappings
jobQuestionMappingsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    if (!findJobOr404(req.params.jobId, res)) return;
    const mappings = db
      .prepare('SELECT * FROM question_mappings WHERE job_id = ? ORDER BY created_at ASC')
      .all(req.params.jobId);
    res.json(mappings);
  })
);

// POST /api/jobs/:jobId/question-mappings
jobQuestionMappingsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const job = findJobOr404(req.params.jobId, res);
    if (!job) return;

    const { question_text, internal_field, field_type = 'text', is_required = false } =
      req.body || {};

    if (!question_text || !question_text.trim()) {
      return res.status(400).json({ error: 'El campo "question_text" es obligatorio' });
    }
    if (!internal_field || !internal_field.trim()) {
      return res.status(400).json({ error: 'El campo "internal_field" es obligatorio' });
    }
    if (!validateFieldType(field_type, res)) return;

    const timestamp = nowIso();
    try {
      const insert = db
        .prepare(
          `INSERT INTO question_mappings
             (job_id, question_text, internal_field, field_type, is_required, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          job.id,
          question_text.trim(),
          internal_field.trim(),
          field_type,
          is_required ? 1 : 0,
          timestamp,
          timestamp
        );

      const mapping = db
        .prepare('SELECT * FROM question_mappings WHERE id = ?')
        .get(insert.lastInsertRowid);
      res.status(201).json(mapping);
    } catch (err) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res
          .status(409)
          .json({ error: 'Esta pregunta ya esta mapeada para esta vacante' });
      }
      throw err;
    }
  })
);

// Router plano bajo /api/question-mappings/:id
export const questionMappingsRouter = Router();

// PUT /api/question-mappings/:id
questionMappingsRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const mapping = findMappingOr404(req.params.id, res);
    if (!mapping) return;

    const { question_text, internal_field, field_type, is_required } = req.body || {};
    if (!validateFieldType(field_type, res)) return;

    const updated = {
      question_text: question_text !== undefined ? question_text.trim() : mapping.question_text,
      internal_field: internal_field !== undefined ? internal_field.trim() : mapping.internal_field,
      field_type: field_type !== undefined ? field_type : mapping.field_type,
      is_required: is_required !== undefined ? (is_required ? 1 : 0) : mapping.is_required,
    };

    try {
      db.prepare(
        `UPDATE question_mappings
         SET question_text = ?, internal_field = ?, field_type = ?, is_required = ?, updated_at = ?
         WHERE id = ?`
      ).run(
        updated.question_text,
        updated.internal_field,
        updated.field_type,
        updated.is_required,
        nowIso(),
        mapping.id
      );
    } catch (err) {
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res
          .status(409)
          .json({ error: 'Esta pregunta ya esta mapeada para esta vacante' });
      }
      throw err;
    }

    const fresh = db.prepare('SELECT * FROM question_mappings WHERE id = ?').get(mapping.id);
    res.json(fresh);
  })
);

// DELETE /api/question-mappings/:id
questionMappingsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const mapping = findMappingOr404(req.params.id, res);
    if (!mapping) return;

    db.prepare('DELETE FROM question_mappings WHERE id = ?').run(mapping.id);
    res.status(204).send();
  })
);
