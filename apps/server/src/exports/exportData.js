import { db } from '../db/index.js';

// Columnas base + una columna por cada question_mapping de la vacante,
// usando los valores normalizados (no las respuestas en bruto).
export function buildExportData(jobId) {
  const mappings = db
    .prepare('SELECT * FROM question_mappings WHERE job_id = ? ORDER BY id')
    .all(jobId);
  const candidates = db
    .prepare('SELECT * FROM candidates WHERE job_id = ? ORDER BY created_at')
    .all(jobId);

  const baseColumns = ['name', 'linkedin_profile_url', 'extraction_status', 'pdf_filename'];
  const mappingColumns = mappings.map((m) => m.internal_field);
  const headers = [...baseColumns, ...mappingColumns];

  const rows = candidates.map((candidate) => {
    const normalized = candidate.normalized_answers_json
      ? JSON.parse(candidate.normalized_answers_json)
      : {};

    const row = {
      name: candidate.name ?? '',
      linkedin_profile_url: candidate.linkedin_profile_url ?? '',
      extraction_status: candidate.extraction_status,
      pdf_filename: candidate.pdf_filename ?? '',
    };
    for (const column of mappingColumns) {
      const value = normalized[column];
      row[column] = value === undefined || value === null ? '' : value;
    }
    return row;
  });

  return { headers, rows, candidates };
}
