# PRD — Análisis y Ranking de Candidatos

## 1. Objetivo

Dado un conjunto de candidatos ya extraídos de LinkedIn (CV en PDF + respuestas a las preguntas de la oferta), analizar cada CV con IA contra los criterios definidos para la vacante, generar un score explicado y ofrecer herramientas para comparar y decidir a quién entrevistar.

## 2. Alcance

**Incluye:**
- Configuración de criterios de evaluación por vacante.
- Extracción de texto de los PDFs de CV.
- Análisis IA individual por candidato (bajo demanda).
- Análisis en lote (todos los candidatos pendientes de una vacante).
- Vista de ranking con score y recomendación.
- Vista de comparación entre candidatos.
- Gestión de estado del candidato en el proceso.
- Exportación de la shortlist final.

**No incluye (fuera de alcance de esta fase):**
- Contacto automático con candidatos.
- Agendamiento de entrevistas (solo se marca el estado).
- Análisis de video/audio de entrevistas.

## 3. Funcionalidades

### 3.1 Configuración de criterios por vacante

Desde la interfaz, al editar un proyecto (vacante), añadir una sección "Criterios de evaluación":

- Lista de criterios, cada uno con:
  - Nombre (ej. "Experiencia en React", "Inglés B2+", "Liderazgo de equipos")
  - Tipo: `must_have` (eliminatorio si no se cumple) o `nice_to_have` (suma puntos)
  - Peso (0-100, solo aplica a nice_to_have; deben sumar 100 entre todos los nice_to_have)
  - Descripción/criterio de evaluación (texto libre, lo que el modelo debe buscar en el CV)
- Botón "Sugerir criterios con IA" (opcional, fase 4): a partir de la descripción de la vacante, la IA propone una lista inicial editable.

### 3.2 Extracción de texto del CV

- Al descargar un CV (proceso ya existente de scraping), extraer automáticamente el texto del PDF y guardarlo asociado al candidato.
- Si la extracción falla (CV escaneado como imagen, sin texto), marcar el candidato con estado `cv_no_legible` y permitir reintento manual o marcarlo para revisión humana directa.

### 3.3 Análisis individual

- Botón "Analizar" en la ficha de cada candidato.
- Envía a la API de Claude: texto del CV + respuestas a las preguntas de la oferta + lista de criterios de la vacante.
- El modelo devuelve (formato JSON estructurado):
  - `score_global` (0-100)
  - `scores_por_criterio`: lista de `{criterio, cumplido (bool para must_have / puntos para nice_to_have), evidencia}`
  - `must_haves_cumplidos` (bool global)
  - `fortalezas` (lista corta)
  - `debilidades_o_gaps` (lista corta)
  - `red_flags` (ej. gaps de empleo sin explicar, incoherencias entre CV y respuestas, cambios de trabajo muy frecuentes) — puede estar vacío
  - `resumen_ejecutivo` (2-3 frases)
  - `recomendacion`: `entrevistar` / `dudoso` / `descartar`
- Se guarda la respuesta completa (JSON) + metadatos: modelo usado, fecha, versión del prompt.
- Si un `must_have` no se cumple, el `score_global` se penaliza fuertemente y la recomendación por defecto es `descartar`, pero el candidato **no se oculta** — sigue visible y el humano puede anular la recomendación.

### 3.4 Análisis en lote

- Botón "Analizar todos los pendientes" en la vista de proyecto.
- Cola secuencial (no paralela agresiva) para controlar rate limits y coste.
- Barra de progreso + log en tiempo real (igual que en la fase de scraping).
- Reintentos automáticos (máx. 2) ante errores de API transitorios.

### 3.5 Vista de ranking

- Tabla de candidatos de la vacante, ordenable por `score_global`.
- Columnas: nombre, score, recomendación (badge de color: verde/amarillo/rojo), must-haves cumplidos, estado del proceso, fecha de análisis.
- Filtros: score mínimo, recomendación, estado, solo pendientes de analizar.
- Click en candidato → ficha detallada con el análisis completo y el CV visible/descargable.

### 3.6 Comparación de candidatos

- Selección de 2 a 4 candidatos desde el ranking.
- Vista lado a lado: score global, cumplimiento de cada criterio, fortalezas/debilidades, red flags.

### 3.7 Estado del candidato en el proceso

Estados: `pendiente_analisis` → `analizado` → `preseleccionado` / `descartado` → `entrevista_agendada`.
Cambios de estado manuales desde la interfaz (el análisis solo sugiere, no cambia el estado automáticamente).

### 3.8 Exportación

- Exportar shortlist (candidatos con estado `preseleccionado` o `entrevista_agendada`) a CSV/Excel, incluyendo score, resumen y respuestas a las preguntas.

## 4. Modelo de datos (nuevas tablas)

```sql
-- Criterios de evaluación por vacante
CREATE TABLE job_criteria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proyecto_id INTEGER NOT NULL REFERENCES proyectos(id),
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK(tipo IN ('must_have', 'nice_to_have')),
  peso INTEGER DEFAULT 0, -- solo relevante si tipo = nice_to_have
  descripcion TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Texto extraído del CV (separado para reutilización)
CREATE TABLE cv_texto (
  candidato_id INTEGER PRIMARY KEY REFERENCES candidatos(id),
  texto_extraido TEXT,
  extraccion_exitosa BOOLEAN DEFAULT 1,
  fecha_extraccion DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Resultado del análisis IA
CREATE TABLE cv_analysis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  candidato_id INTEGER NOT NULL REFERENCES candidatos(id),
  score_global INTEGER,
  scores_detalle TEXT, -- JSON: lista de {criterio, cumplido/puntos, evidencia}
  must_haves_cumplidos BOOLEAN,
  fortalezas TEXT, -- JSON array
  debilidades TEXT, -- JSON array
  red_flags TEXT, -- JSON array
  resumen_ejecutivo TEXT,
  recomendacion TEXT CHECK(recomendacion IN ('entrevistar','dudoso','descartar')),
  modelo_usado TEXT,
  prompt_version TEXT,
  fecha_analisis DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Ampliación de la tabla candidatos existente
ALTER TABLE candidatos ADD COLUMN estado_proceso TEXT DEFAULT 'pendiente_analisis';
```

## 5. Criterios de éxito

- Analizar un candidato individual en menos de ~15 segundos.
- El ranking refleja fielmente los pesos configurados (verificable manualmente en al menos 3 casos de prueba).
- Ningún candidato se oculta u elimina automáticamente por el análisis IA.
- El análisis es reproducible: mismo CV + mismos criterios + mismo prompt_version → resultado consistente (dentro de la variabilidad normal del modelo).

## 6. Riesgos y mitigaciones

- **Sesgo del modelo**: mitigado con explicabilidad obligatoria (evidencia por criterio) y decisión final siempre humana.
- **CVs no parseables** (imágenes/escaneados): flujo de fallback a revisión manual.
- **Coste de API**: análisis bajo demanda, no automático; lote con confirmación explícita.
- **Alucinación del modelo** (inventar datos no presentes en el CV): el prompt exige citar evidencia textual del CV para cada criterio cumplido; si no hay evidencia, se marca como no cumplido.
