# PROGRESS.md — Análisis y Ranking de Candidatos

## Estado actual

**Fase en curso**: Fase 4 — Motor de análisis IA (implementada; validación con candidatos reales pendiente de `ANTHROPIC_API_KEY`)

**Última sesión**: 2026-07-13

## Resumen de avance

| Fase | Estado | Notas |
|---|---|---|
| 1. Modelo de datos y migración | ✅ Validada (2026-07-12) | Migración aplicada a la BD real; seed jobId 20 |
| 2. Extracción de texto de CV | ✅ Validada (2026-07-13) | 108/114 CVs reales OK; 3 CVs (x2 vacantes) escaneados sin OCR → `cv_unreadable` |
| 3. Configuración de criterios (UI) | ✅ Validada (2026-07-13) | Pestaña "Criterios de evaluación" + API CRUD; aviso de suma de pesos |
| 4. Motor de análisis IA (individual) | 🟡 Hecha, pendiente visto bueno | 5 candidatos reales analizados (job 19); resultados coherentes, ~6 cts/candidato |
| 5. Análisis en lote | ⬜ Pendiente | |
| 6. Vista de ranking | ⬜ Pendiente | |
| 7. Comparación de candidatos | ⬜ Pendiente | |
| 8. Gestión de estado y exportación | ⬜ Pendiente | |
| 9. Sugerencia de criterios con IA | ⬜ Futuro / opcional |

## Decisiones tomadas

- El análisis IA nunca oculta ni borra candidatos automáticamente; solo sugiere.
- El análisis es una acción bajo demanda (individual o lote explícito), no automática al descargar el CV.
- Cada análisis guarda evidencia textual por criterio para evitar alucinaciones y permitir auditoría.
- **(2026-07-12)** Nombres de tablas/columnas en inglés para ser coherentes con el esquema existente (`jobs`, `candidates`): `job_criteria`, `cv_texts`, `cv_analyses`, `candidates.process_status`. Los "proyectos" del PRD son la tabla `jobs` real.
- **(2026-07-12)** Los valores de enumerados también en inglés, como los estados existentes de la app (`pending`, `completed`…): `recommendation` ∈ `interview`/`maybe`/`discard`; `process_status` por defecto `pending_analysis`. La UI mostrará las etiquetas en español (entrevistar/dudoso/descartar…). Si prefieres los valores en español como en el PRD, es un cambio pequeño — dilo antes de la Fase 4.
- **(2026-07-12)** La carpeta de docs del módulo se renombró de `docs/ cv-analysis` (espacio accidental) a `docs/cv-analysis`.
- **(2026-07-12)** La migración vive en `apps/server/src/db/schema.js` (+ `COLUMN_MIGRATIONS`) y se aplica en `runMigrations()` al arrancar el servidor, siguiendo el patrón existente. Seed: `node apps/server/src/db/seedCvAnalysis.js` (idempotente).
- **(2026-07-13)** Reanálisis: se guarda histórico, nunca se sobrescribe. Cada análisis es una fila nueva en `cv_analyses` con `prompt_version`, `model_used` y tokens; el vigente es el más reciente.
- **(2026-07-13)** El `overall_score` se calcula en código a partir de los pesos configurados (Σ puntos×peso/100), no lo decide el modelo, para que el ranking refleje fielmente los pesos. Must-have fallido → score × 0.25 y recomendación `discard` (anulable por humano). Vacante solo con must-haves cumplidos → score 100.

## Pendientes / dudas abiertas

- **(2026-07-13)** Iteración futura del prompt: el modelo a veces marca como red flag solapes de fechas discutibles (p.ej. "2023–2026" + "2026–Present"). Ya se le pasa la fecha actual ({{TODAY}}); si molesta, iterar con casos reales usando la variante de SESSION_PROMPT.md y versionar como cv_analysis_v2.md.
- **(2026-07-13)** Las respuestas guardadas (`raw_answers_json`) vienen con ruido del scraping (pares pregunta-respuesta desalineados, textos de la UI de LinkedIn). El prompt las marca como contexto secundario poco fiable; el análisis se apoya sobre todo en el CV. Revisar el parser (hay cambios sin commitear en `answerParser.js`) si se quiere que las respuestas pesen más.
- Definir umbral de score por defecto para el filtro "candidatos destacados" en el ranking.
- **(2026-07-12)** Hay 34 PDFs falsos de fixtures de pruebas antiguas en `data/downloads` (32 bytes, "fake cv for..."); convendría limpiarlos junto con sus vacantes de prueba.
- ~~Backfill de texto de los CVs anteriores a la Fase 2~~ → hecho el 2026-07-13 (`backfillCvTexts.js`: 104 extraídos, 4 ilegibles).

## Próxima sesión — empezar por

1. Leer este archivo y `PHASES.md`.
2. Con `ANTHROPIC_API_KEY` en `.env` → validar la Fase 4 analizando 3-5 candidatos reales (vacante con criterios configurados y pesos sumando 100).
3. Si Fabio valida la Fase 4 → empezar Fase 5 (análisis en lote).
4. Actualizar esta tabla al terminar cada tarea.
