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
Abre navegador en la URL de la vacante.

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
