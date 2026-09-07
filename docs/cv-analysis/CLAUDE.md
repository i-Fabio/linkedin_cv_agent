# CLAUDE.md — Módulo de Análisis y Ranking de Candidatos

## Contexto del proyecto

Este módulo extiende la app local de extracción de candidatos de LinkedIn (Node.js + Express + SQLite + Playwright) añadiendo una **fase de análisis automatizado de CVs** y **soporte a la decisión de a quién entrevistar**.

No sustituye el criterio humano: genera un ranking explicado y auditable que Fabio usa como apoyo, no como decisión automática.

## Stack técnico (heredado + nuevo)

- Backend: Node.js + Express (ya existente)
- DB: SQLite (ya existente, se amplía el esquema)
- Frontend: HTML/JS simple (ya existente, se añaden vistas nuevas)
- **Nuevo**: extracción de texto de PDF (`pdf-parse`)
- **Nuevo**: llamadas a la API de Anthropic (`@anthropic-ai/sdk`) para el análisis
- **Nuevo**: variable de entorno `ANTHROPIC_API_KEY` en `.env` (nunca en el repo)

## Principios de diseño

1. **Explicabilidad primero**: cada score va acompañado del razonamiento del modelo. Nunca se muestra un número sin justificación.
2. **Auditabilidad**: se guarda el prompt exacto, el modelo usado y la fecha de cada análisis. Si cambia el modelo o el prompt, se puede reanalizar sin perder el histórico.
3. **Reutilización de datos**: el texto extraído del PDF se guarda una vez; no se reprocesa el PDF en cada análisis.
4. **Configuración por vacante**: los criterios de evaluación (must-have / nice-to-have y pesos) se definen por proyecto/vacante, no están hardcodeados.
5. **El modelo no descarta, prioriza**: no hay borrado automático de candidatos. El estado "descartado" siempre lo confirma un humano desde la interfaz.
6. **Coste controlado**: el análisis es una acción explícita (botón "Analizar"), no automática al descargar el CV, para evitar gasto de tokens innecesario en descargas masivas.

## Convenciones

- Idioma de trabajo con Claude Code: español.
- Commits descriptivos por fase (ver PHASES.md).
- Cada tabla nueva lleva `created_at` y, si aplica, `updated_at`.
- Los prompts usados para el análisis se versionan en `/prompts/cv_analysis_v1.md` (texto plano, no en código), para poder iterar sin tocar el backend.

## Dónde mirar primero en una sesión nueva

1. `PROGRESS.md` — qué fase está en curso y qué quedó pendiente.
2. `PHASES.md` — siguiente tarea concreta.
3. `PRD.md` — si hay duda sobre el comportamiento esperado de una funcionalidad.
