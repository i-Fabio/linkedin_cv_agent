# PHASES.md — Análisis y Ranking de Candidatos

Metodología: incremental, con validación manual al final de cada fase antes de pasar a la siguiente. No avanzar de fase sin confirmación explícita.

---

## Fase 1 — Modelo de datos y migración

- [x] Crear migración SQL para las tablas nuevas: `job_criteria`, `cv_texts`, `cv_analyses` (nombres en inglés, acordado en sesión 2026-07-12).
- [x] Añadir columna `process_status` a `candidates`.
- [x] Script de migración idempotente (comprobar si la tabla/columna ya existe antes de crear).
- [x] Seed de prueba: 1 vacante con 4 criterios de ejemplo (`apps/server/src/db/seedCvAnalysis.js`).

**Validación**: correr la migración sobre una copia de la DB real, comprobar integridad con `PRAGMA foreign_key_check`.

---

## Fase 2 — Extracción de texto de CV

- [x] Integrar `pdf-parse`.
- [x] Función `extractCvText(pdfPath)` con manejo de errores (PDF corrupto, escaneado sin OCR, vacío) — `apps/server/src/analysis/cvTextExtractor.js`.
- [x] Hook en el flujo de scraping existente: al descargar un CV, extraer texto automáticamente y guardar en `cv_texts` (`pdfDownloader.js`; un fallo de extracción no aborta la descarga).
- [x] Endpoint manual `POST /api/candidates/:id/reextract-text` para reintentos (409 si no hay PDF).
- [x] Marcar candidato como `cv_unreadable` si la extracción falla (y vuelta a `pending_analysis` si una reextracción posterior funciona).

**Validación**: probar con 5-10 CVs reales variados (con y sin formato complejo, con imágenes, etc.) y revisar manualmente la calidad del texto extraído.

---

## Fase 3 — Configuración de criterios (interfaz)

- [x] Vista "Criterios de evaluación": pestaña nueva en el detalle de vacante (`JobCriteriaTable.tsx`).
- [x] CRUD de criterios (nombre, tipo, peso, descripción) con edición en línea.
- [x] Validación en frontend: indicador "Suma de pesos valorables: X/100" con aviso si ≠ 100 (no bloquea, para permitir construir la lista de forma incremental).
- [x] API: `GET/POST /api/jobs/:jobId/criteria`, `PUT/DELETE /api/criteria/:id` (`apps/server/src/routes/jobCriteria.js`).

**Validación**: crear, editar y borrar criterios de una vacante de prueba; comprobar persistencia.

---

## Fase 4 — Motor de análisis IA (individual)

- [x] Integrar `@anthropic-ai/sdk`, variable `ANTHROPIC_API_KEY` en `.env` (+ `ANTHROPIC_MODEL` opcional, por defecto `claude-opus-4-8`).
- [x] Diseñar y guardar el prompt en `/prompts/cv_analysis_v1.md`.
- [x] Función `analyzeCandidate(candidateId)` (`apps/server/src/analysis/candidateAnalyzer.js`):
  - Construye el prompt con texto del CV + respuestas + criterios (con `criterio_id` para casar la salida).
  - Llama a la API con salida JSON estructurada (`output_config.format` json_schema) + adaptive thinking.
  - Valida la respuesta (criterios cubiertos exactamente, puntos 0-100).
  - Calcula el `overall_score` en código a partir de los pesos (no se fía de la aritmética del modelo); must-have fallido → score × 0.25 y recomendación `discard`.
  - Guarda en `cv_analyses` (histórico: fila nueva por análisis) con modelo, versión de prompt y tokens.
  - Actualiza `process_status` a `analyzed` (solo desde `pending_analysis`; estados humanos no se tocan).
- [x] Endpoint `POST /api/candidates/:id/analyze` (+ `GET /api/candidates/:id/analyses` para el histórico).
- [x] Manejo de errores: JSON malformado o esquema incompleto → reintento único con instrucción de corrección.
- [x] Backfill de texto de CV para los candidatos anteriores a la Fase 2 (`apps/server/src/db/backfillCvTexts.js`): 104 extraídos, 4 `cv_unreadable`.

**Validación**: 5 candidatos reales de la vacante "Full stack" (job 19) analizados el 2026-07-13 con criterios reales configurados (~6 cts/candidato). Resultados coherentes: 4 descartes por must-have estricto (menos de 2 años React/TS) con evidencia citada, 1 `interview` (score 86-89). Reanálisis probado (histórico OK). Pendiente el visto bueno de Fabio sobre los resultados.

---

## Fase 5 — Análisis en lote

- [ ] Endpoint `POST /proyectos/:id/analizar-lote`.
- [ ] Cola secuencial con delay entre llamadas (evitar rate limit).
- [ ] Progreso en tiempo real (reutilizar patrón de log del scraping, ej. Server-Sent Events o polling).
- [ ] Reintentos automáticos (máx. 2) ante fallos transitorios de la API.

**Validación**: correr sobre una vacante con 10+ candidatos pendientes, comprobar que todos quedan procesados o marcados con error legible.

---

## Fase 6 — Vista de ranking

- [ ] Tabla ordenable por score, con badges de recomendación (color).
- [ ] Filtros: score mínimo, recomendación, estado, pendientes de analizar.
- [ ] Ficha de detalle del candidato con análisis completo + visor/descarga del CV.

**Validación**: revisar visualmente con datos reales de al menos una vacante completa.

---

## Fase 7 — Comparación de candidatos

- [ ] Selección múltiple (2-4) desde el ranking.
- [ ] Vista comparativa lado a lado.

**Validación**: comparar 3 candidatos reales y verificar que la información coincide con sus fichas individuales.

---

## Fase 8 — Gestión de estado y exportación

- [ ] Cambios de estado manuales desde la interfaz (`preseleccionado`, `descartado`, `entrevista_agendada`).
- [ ] Exportación de shortlist a CSV/Excel.

**Validación**: flujo completo de principio a fin sobre una vacante real, desde scraping hasta exportación de shortlist.

---

## Fase 9 (opcional/futuro) — Sugerencia de criterios con IA

- [ ] A partir de la descripción de la vacante, la IA propone criterios iniciales editables.

*No implementar hasta confirmar que las fases 1-8 funcionan bien en producción.*
