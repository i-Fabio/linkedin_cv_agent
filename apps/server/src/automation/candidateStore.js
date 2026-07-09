import { db } from '../db/index.js';

function nowIso() {
  return new Date().toISOString();
}

// El titulo de la pestana en las paginas de detalle de candidato de LinkedIn
// suele incluir el nombre antes de un separador ("Jane Doe | LinkedIn").
// Heuristica de mejor esfuerzo, sin selectores CSS (ver docs/09_IMPLEMENTATION_NOTES.md).
export function deriveNameFromTitle(title) {
  if (!title) return null;
  const first = title.split(/[|\-–—]/)[0]?.trim();
  return first && first.length > 1 && first.length < 100 ? first : null;
}

export function findCandidateByProfileUrl(jobId, profileUrl) {
  return db
    .prepare('SELECT * FROM candidates WHERE job_id = ? AND linkedin_profile_url = ?')
    .get(jobId, profileUrl);
}

export function findOrCreateCandidateStub(jobId, profileUrl, derivedName) {
  const existing = findCandidateByProfileUrl(jobId, profileUrl);
  if (existing) return existing;

  const timestamp = nowIso();
  const insert = db
    .prepare(
      `INSERT INTO candidates (job_id, name, linkedin_profile_url, extraction_status, raw_answers_json, normalized_answers_json, created_at, updated_at)
       VALUES (?, ?, ?, 'pending', NULL, NULL, ?, ?)`
    )
    .run(jobId, derivedName ?? null, profileUrl, timestamp, timestamp);

  return db.prepare('SELECT * FROM candidates WHERE id = ?').get(insert.lastInsertRowid);
}

export function getCandidateById(id) {
  return db.prepare('SELECT * FROM candidates WHERE id = ?').get(id);
}
