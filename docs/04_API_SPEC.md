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
Marca el run como `awaiting_extraction`. Devuelve 409 si no hay navegador
abierto para la vacante.

### POST /api/jobs/:id/extract-current-candidate
Lee el `body.innerText()` de la página actualmente abierta en el navegador de
la vacante, extrae el bloque "Respuestas a preguntas de preselección", parsea
las preguntas/respuestas, crea `question_mappings` sugeridos para preguntas
nuevas y guarda/actualiza el candidato (deduplicado por
`linkedin_profile_url`). Devuelve el candidato serializado. 409 si no hay
navegador abierto. La descarga de PDF (Fase 5) y el recorrido automático de
la lista completa de candidatos (Fase 6) no están implementados todavía —
esta acción opera sobre un único candidato a la vez, navegado manualmente.

### POST /api/jobs/:id/download-current-candidate-pdf
Busca un enlace/botón de descarga de CV en la página actualmente abierta
(por nombre accesible, no por clase CSS), descarga el PDF a la carpeta de
descarga de la vacante con el nombre normalizado del candidato (o
`candidato_{id}.pdf` si no se pudo derivar un nombre), y guarda
`pdf_filename`/`pdf_path` en el candidato (deduplicado por
`linkedin_profile_url`, igual que `extract-current-candidate`). 409 si no
hay navegador abierto, si no se encuentra un enlace de descarga, o si el CV
se abre en un visor sin disparar una descarga real.

### POST /api/jobs/:id/start-extraction
Inicia extracción automática de todos los candidatos (Fase 6, pendiente).

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
