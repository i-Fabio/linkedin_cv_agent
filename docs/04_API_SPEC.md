# API interna

## Jobs

### GET /api/jobs
Devuelve todas las vacantes.

### POST /api/jobs
Crea una vacante.

Body:
```json
{
  "name": "Full Stack Developer",
  "linkedin_url": "https://www.linkedin.com/..."
}
```

### GET /api/jobs/:id
Devuelve una vacante.

### PUT /api/jobs/:id
Actualiza una vacante.

### DELETE /api/jobs/:id
Elimina una vacante.

## Question mappings

### GET /api/jobs/:id/question-mappings

### POST /api/jobs/:id/question-mappings

Body:
```json
{
  "question_text": "¿Tienes disponibilidad inmediata?",
  "internal_field": "disponibilidad_inmediata",
  "field_type": "boolean"
}
```

### PUT /api/question-mappings/:id

### DELETE /api/question-mappings/:id

## Extraction

### POST /api/jobs/:id/open-browser
Abre navegador Playwright (sesión persistente) en la URL de la vacante.
Si ya hay uno abierto para esa vacante, lo reutiliza (`reused: true`).

Respuesta:
```json
{ "run": { "id": 1, "status": "awaiting_login", "...": "..." }, "reused": false }
```

### POST /api/jobs/:id/confirm-login
Confirma que el usuario ha iniciado sesión manualmente en el navegador abierto.
Marca el run como `awaiting_extraction` (la extracción real de candidatos llega
en la Fase 4). Devuelve 409 si no hay navegador abierto para la vacante.

### POST /api/jobs/:id/start-extraction
Inicia extracción.

Body:
```json
{
  "mode": "all"
}
```

### GET /api/runs/:id/logs
Devuelve logs.

### GET /api/runs/:id/events
Stream SSE de eventos.

## Candidates

### GET /api/jobs/:id/candidates

### GET /api/candidates/:id

### PUT /api/candidates/:id

## Export

### GET /api/jobs/:id/export.csv

### GET /api/jobs/:id/export.xlsx

### GET /api/jobs/:id/export.zip
