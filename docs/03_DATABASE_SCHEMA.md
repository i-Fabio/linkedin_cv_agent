# Esquema de base de datos

## Tabla jobs

```sql
CREATE TABLE jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  linkedin_url TEXT NOT NULL,
  download_dir TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_run_at TEXT
);
```

## Tabla question_mappings

```sql
CREATE TABLE question_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  internal_field TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text',
  is_required INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(job_id) REFERENCES jobs(id)
);
```

## Tabla candidates

```sql
CREATE TABLE candidates (
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
  FOREIGN KEY(job_id) REFERENCES jobs(id)
);
```

## Tabla extraction_runs

```sql
CREATE TABLE extraction_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  total_candidates INTEGER DEFAULT 0,
  processed_candidates INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  log_path TEXT,
  FOREIGN KEY(job_id) REFERENCES jobs(id)
);
```

## Campos internos iniciales

```text
disponibilidad_inmediata
presencial_barcelona
anos_experiencia_web
react_typescript
expectativa_salarial
cv_pdf_adjuntado
backend_apis
```
