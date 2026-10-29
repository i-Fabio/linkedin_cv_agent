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

// Datos para el visualizador estatico exportable: a diferencia de
// buildExportData, usa el perfil publico de LinkedIn (no la URL de la
// solicitud) y deja la ruta del PDF en disco para que el caller decida como
// empaquetarlo (el visualizador le da un nombre de archivo aleatorio).
export function buildViewerData(jobId) {
  const mappings = db
    .prepare('SELECT * FROM question_mappings WHERE job_id = ? ORDER BY id')
    .all(jobId);
  const candidates = db
    .prepare('SELECT * FROM candidates WHERE job_id = ? ORDER BY created_at')
    .all(jobId);

  const questionColumns = mappings.map((m) => ({ field: m.internal_field, label: m.question_text }));

  const rows = candidates.map((candidate) => {
    const normalized = candidate.normalized_answers_json
      ? JSON.parse(candidate.normalized_answers_json)
      : {};
    const answers = {};
    for (const { field } of questionColumns) {
      const value = normalized[field];
      answers[field] = value === undefined || value === null ? '' : String(value);
    }
    return {
      name: candidate.name ?? '(sin nombre)',
      publicProfileUrl: candidate.public_profile_url ?? '',
      pdfPath: candidate.pdf_path ?? null,
      photoPath: candidate.photo_path ?? null,
      answers,
    };
  });

  return { questionColumns, rows };
}
