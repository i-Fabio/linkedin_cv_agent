import { Router } from 'express';
import { db } from '../db/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { CANDIDATE_EXTRACTION_STATUSES } from '../utils/constants.js';

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

function findCandidateOr404(id, res) {
  const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(id);
  if (!candidate) {
    res.status(404).json({ error: 'Candidato no encontrado' });
    return null;
  }
  return candidate;
}

export function serializeCandidate(candidate) {
  return {
    ...candidate,
    raw_answers_json: candidate.raw_answers_json ? JSON.parse(candidate.raw_answers_json) : null,
    normalized_answers_json: candidate.normalized_answers_json
      ? JSON.parse(candidate.normalized_answers_json)
      : null,
  };
}

// Router anidado bajo /api/jobs/:jobId/candidates (requiere mergeParams)
export const jobCandidatesRouter = Router({ mergeParams: true });

// GET /api/jobs/:jobId/candidates
jobCandidatesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    if (!findJobOr404(req.params.jobId, res)) return;
    const candidates = db
      .prepare('SELECT * FROM candidates WHERE job_id = ? ORDER BY created_at DESC')
      .all(req.params.jobId);
    res.json(candidates.map(serializeCandidate));
  })
);

// Router plano bajo /api/candidates/:id
export const candidatesRouter = Router();

// GET /api/candidates/:id
candidatesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const candidate = findCandidateOr404(req.params.id, res);
    if (!candidate) return;
    res.json(serializeCandidate(candidate));
  })
);

// PUT /api/candidates/:id
candidatesRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const candidate = findCandidateOr404(req.params.id, res);
    if (!candidate) return;

    const {
      name,
      linkedin_profile_url,
      extraction_status,
      pdf_filename,
      pdf_path,
      raw_answers_json,
      normalized_answers_json,
    } = req.body || {};

    if (extraction_status && !CANDIDATE_EXTRACTION_STATUSES.includes(extraction_status)) {
      return res.status(400).json({
        error: `"extraction_status" debe ser uno de: ${CANDIDATE_EXTRACTION_STATUSES.join(', ')}`,
      });
    }

    const updated = {
      name: name !== undefined ? name : candidate.name,
      linkedin_profile_url:
        linkedin_profile_url !== undefined ? linkedin_profile_url : candidate.linkedin_profile_url,
      extraction_status: extraction_status !== undefined ? extraction_status : candidate.extraction_status,
      pdf_filename: pdf_filename !== undefined ? pdf_filename : candidate.pdf_filename,
      pdf_path: pdf_path !== undefined ? pdf_path : candidate.pdf_path,
      raw_answers_json:
        raw_answers_json !== undefined ? JSON.stringify(raw_answers_json) : candidate.raw_answers_json,
      normalized_answers_json:
        normalized_answers_json !== undefined
          ? JSON.stringify(normalized_answers_json)
          : candidate.normalized_answers_json,
    };

    db.prepare(
      `UPDATE candidates
       SET name = ?, linkedin_profile_url = ?, extraction_status = ?, pdf_filename = ?, pdf_path = ?,
           raw_answers_json = ?, normalized_answers_json = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      updated.name,
      updated.linkedin_profile_url,
      updated.extraction_status,
      updated.pdf_filename,
      updated.pdf_path,
      updated.raw_answers_json,
      updated.normalized_answers_json,
      nowIso(),
      candidate.id
    );

    const fresh = db.prepare('SELECT * FROM candidates WHERE id = ?').get(candidate.id);
    res.json(serializeCandidate(fresh));
  })
);
