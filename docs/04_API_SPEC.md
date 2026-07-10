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
navegador abierto. Pensada para uso manual sobre un único candidato; el
recorrido automático de toda la lista usa `start-extraction` (abajo), que
llama a esta misma lógica por cada candidato detectado.

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
Requiere un run en estado `awaiting_extraction` (navegador abierto, login
confirmado). Detecta la lista de candidatos en la página actual (por
patrón de URL `/applicants/{id}/detail`, con scroll infinito y paginación
"siguiente"/"next"); si no encuentra ninguno pero la página actual ya es
el detalle de un candidato, procesa solo ese. Por cada candidato: navega,
llama a `extract-current-candidate` y `download-current-candidate-pdf`
(los fallos de PDF no detienen el run), con una pausa aleatoria entre
candidatos. Marca el run como `processing` y responde **inmediatamente**
con `202` — el trabajo continúa en segundo plano; sigue el progreso via
`GET /api/runs/:id/events` o consultando `GET /api/jobs/:id`
(`active_run.processed_candidates` / `total_candidates`). Al terminar,
marca el run `completed` y la vacante `completed` (o `error` si el propio
recorrido falla). 409 si no hay navegador abierto o si ya hay una
extracción en curso para esa vacante.

Respuesta (202):
```json
{ "run": { "id": 1, "status": "processing", "...": "..." } }
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
