export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  linkedin_url TEXT NOT NULL,
  download_dir TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_run_at TEXT
);

CREATE TABLE IF NOT EXISTS question_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  internal_field TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text',
  is_required INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  UNIQUE(job_id, question_text)
);

CREATE TABLE IF NOT EXISTS candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL,
  name TEXT,
  linkedin_profile_url TEXT,
  extraction_status TEXT NOT NULL DEFAULT 'pending',
  pdf_filename TEXT,
  pdf_path TEXT,
  raw_answers_json TEXT,
  normalized_answers_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS extraction_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  total_candidates INTEGER DEFAULT 0,
  processed_candidates INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  log_path TEXT,
  FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS job_criteria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('must_have', 'nice_to_have')),
  weight INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cv_texts (
  candidate_id INTEGER PRIMARY KEY,
  extracted_text TEXT,
  extraction_success INTEGER NOT NULL DEFAULT 1,
  extraction_error TEXT,
  extracted_at TEXT NOT NULL,
  FOREIGN KEY(candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cv_analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  candidate_id INTEGER NOT NULL,
  overall_score INTEGER,
  criteria_scores_json TEXT,
  must_haves_met INTEGER,
  strengths_json TEXT,
  weaknesses_json TEXT,
  red_flags_json TEXT,
  executive_summary TEXT,
  recommendation TEXT CHECK(recommendation IN ('interview', 'maybe', 'discard')),
  model_used TEXT,
  prompt_version TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  created_at TEXT NOT NULL,
  FOREIGN KEY(candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_question_mappings_job_id ON question_mappings(job_id);
CREATE INDEX IF NOT EXISTS idx_candidates_job_id ON candidates(job_id);
CREATE INDEX IF NOT EXISTS idx_extraction_runs_job_id ON extraction_runs(job_id);
CREATE INDEX IF NOT EXISTS idx_job_criteria_job_id ON job_criteria(job_id);
CREATE INDEX IF NOT EXISTS idx_cv_analyses_candidate_id ON cv_analyses(candidate_id);
`;

// Columnas añadidas sobre tablas ya desplegadas: SQLite no soporta
// "ADD COLUMN IF NOT EXISTS", asi que runMigrations() las aplica solo si faltan.
export const COLUMN_MIGRATIONS = [
  {
    table: 'candidates',
    column: 'process_status',
    definition: "TEXT NOT NULL DEFAULT 'pending_analysis'",
  },
  {
    table: 'cv_texts',
    column: 'extraction_error',
    definition: 'TEXT',
  },
  {
    table: 'cv_analyses',
    column: 'input_tokens',
    definition: 'INTEGER',
  },
  {
    table: 'cv_analyses',
    column: 'output_tokens',
    definition: 'INTEGER',
  },
];
