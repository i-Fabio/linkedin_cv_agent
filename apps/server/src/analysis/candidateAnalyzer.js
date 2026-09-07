import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { db } from '../db/index.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

export const PROMPT_VERSION = 'cv_analysis_v1';

// Error de precondición del análisis: el endpoint lo traduce al código HTTP.
export class AnalysisError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// El modelo trabaja con el contrato en español del PRD (y del prompt versionado);
// en BD los valores van en inglés como el resto de estados de la app.
const RECOMMENDATION_MAP = {
  entrevistar: 'interview',
  dudoso: 'maybe',
  descartar: 'discard',
};

// Esquema de salida estructurada. Las restricciones numéricas (0-100) no las
// soporta structured outputs, así que se validan en validateModelOutput().
function buildOutputSchema() {
  const evidenceItem = (extraProps) => ({
    type: 'object',
    additionalProperties: false,
    required: ['criterio_id', 'evidencia', ...Object.keys(extraProps)],
    properties: {
      criterio_id: { type: 'integer' },
      evidencia: { type: 'string' },
      ...extraProps,
    },
  });

  return {
    type: 'object',
    additionalProperties: false,
    required: [
      'must_haves',
      'nice_to_haves',
      'fortalezas',
      'debilidades_o_gaps',
      'red_flags',
      'resumen_ejecutivo',
      'recomendacion',
    ],
    properties: {
      must_haves: { type: 'array', items: evidenceItem({ cumplido: { type: 'boolean' } }) },
      nice_to_haves: { type: 'array', items: evidenceItem({ puntos: { type: 'integer' } }) },
      fortalezas: { type: 'array', items: { type: 'string' } },
      debilidades_o_gaps: { type: 'array', items: { type: 'string' } },
      red_flags: { type: 'array', items: { type: 'string' } },
      resumen_ejecutivo: { type: 'string' },
      recomendacion: { type: 'string', enum: Object.keys(RECOMMENDATION_MAP) },
    },
  };
}

function loadPromptTemplate() {
  const promptPath = path.join(config.promptsDir, `${PROMPT_VERSION}.md`);
  if (!fs.existsSync(promptPath)) {
    throw new AnalysisError(500, `No se encuentra el prompt de análisis: ${promptPath}`);
  }
  return fs.readFileSync(promptPath, 'utf8');
}

function formatCriteria(criteria) {
  return criteria
    .map((c) => {
      const weight = c.type === 'nice_to_have' ? ` (peso ${c.weight})` : '';
      const description = c.description ? ` — ${c.description}` : '';
      return `- [criterio_id ${c.id}] ${c.name}${weight}${description}`;
    })
    .join('\n');
}

function formatAnswers(candidate) {
  const raw = candidate.raw_answers_json ? JSON.parse(candidate.raw_answers_json) : null;
  if (!raw || Object.keys(raw).length === 0) return '(sin respuestas registradas)';
  return Object.entries(raw)
    .map(([question, answer]) => `- ${question}: ${answer}`)
    .join('\n');
}

export function buildPrompt({ job, candidate, criteria, cvText }) {
  const mustHaves = criteria.filter((c) => c.type === 'must_have');
  const niceToHaves = criteria.filter((c) => c.type === 'nice_to_have');

  return loadPromptTemplate()
    .replace('{{TODAY}}', new Date().toISOString().slice(0, 10))
    .replace('{{JOB_NAME}}', job.name)
    .replace('{{MUST_HAVE_CRITERIA}}', mustHaves.length ? formatCriteria(mustHaves) : '(ninguno)')
    .replace('{{NICE_TO_HAVE_CRITERIA}}', niceToHaves.length ? formatCriteria(niceToHaves) : '(ninguno)')
    .replace('{{ANSWERS}}', formatAnswers(candidate))
    .replace('{{CV_TEXT}}', cvText);
}

// Comprueba lo que el esquema estructurado no puede garantizar: que el modelo
// cubre exactamente los criterios pedidos y que los puntos están en rango.
function validateModelOutput(output, criteria) {
  const problems = [];
  const expectIds = (type, items) => {
    const expected = criteria.filter((c) => c.type === type).map((c) => c.id);
    const received = items.map((i) => i.criterio_id);
    const missing = expected.filter((id) => !received.includes(id));
    const unknown = received.filter((id) => !expected.includes(id));
    if (missing.length) problems.push(`faltan criterios ${type}: ${missing.join(', ')}`);
    if (unknown.length) problems.push(`criterios ${type} desconocidos: ${unknown.join(', ')}`);
  };
  expectIds('must_have', output.must_haves);
  expectIds('nice_to_have', output.nice_to_haves);
  for (const item of output.nice_to_haves) {
    if (item.puntos < 0 || item.puntos > 100) {
      problems.push(`puntos fuera de rango (0-100) en criterio_id ${item.criterio_id}`);
    }
  }
  return problems;
}

async function callModel(client, prompt, schema) {
  const response = await client.messages.create({
    model: config.anthropicModel,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { format: { type: 'json_schema', schema } },
    messages: [{ role: 'user', content: prompt }],
  });

  if (response.stop_reason === 'refusal') {
    throw new AnalysisError(502, 'El modelo rechazó la petición de análisis');
  }

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock) {
    throw new AnalysisError(502, 'El modelo no devolvió contenido de texto');
  }
  return { response, text: textBlock.text };
}

// Llama al modelo y parsea/valida su salida. Ante JSON malformado o esquema
// incompleto, reintenta UNA vez con la instrucción de corrección (PHASES F4).
async function getValidatedAnalysis(client, prompt, criteria) {
  const schema = buildOutputSchema();
  let usage = { input_tokens: 0, output_tokens: 0 };
  let lastProblem = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const fullPrompt =
      attempt === 1
        ? prompt
        : `${prompt}\n\nTu respuesta anterior no fue válida (${lastProblem}). Corrígela y responde únicamente con el JSON del esquema, cubriendo exactamente los criterio_id listados.`;

    const { response, text } = await callModel(client, fullPrompt, schema);
    usage.input_tokens += response.usage.input_tokens;
    usage.output_tokens += response.usage.output_tokens;

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      lastProblem = 'JSON malformado';
      continue;
    }

    const problems = validateModelOutput(parsed, criteria);
    if (problems.length === 0) {
      return { parsed, usage, model: response.model };
    }
    lastProblem = problems.join('; ');
  }

  throw new AnalysisError(502, `La respuesta del modelo no superó la validación tras un reintento: ${lastProblem}`);
}

// Score global determinista a partir de los pesos configurados (el ranking
// debe reflejar los pesos, no la aritmética del modelo). Si falla algún
// imprescindible se penaliza fuerte pero el candidato sigue visible.
const MUST_HAVE_FAIL_FACTOR = 0.25;

export function computeScore(criteria, output) {
  const byId = new Map(criteria.map((c) => [c.id, c]));
  const weighted = output.nice_to_haves.reduce((sum, item) => {
    const criterion = byId.get(item.criterio_id);
    return sum + (item.puntos * criterion.weight) / 100;
  }, 0);
  // Vacante solo con imprescindibles: cumplirlos todos vale 100.
  const base = output.nice_to_haves.length === 0 ? 100 : weighted;

  const mustHavesMet = output.must_haves.every((item) => item.cumplido);
  return {
    score: Math.round(mustHavesMet ? base : base * MUST_HAVE_FAIL_FACTOR),
    mustHavesMet,
  };
}

export function serializeAnalysis(row) {
  return {
    ...row,
    criteria_scores_json: row.criteria_scores_json ? JSON.parse(row.criteria_scores_json) : null,
    strengths_json: row.strengths_json ? JSON.parse(row.strengths_json) : null,
    weaknesses_json: row.weaknesses_json ? JSON.parse(row.weaknesses_json) : null,
    red_flags_json: row.red_flags_json ? JSON.parse(row.red_flags_json) : null,
    must_haves_met: row.must_haves_met === null ? null : Boolean(row.must_haves_met),
  };
}

export async function analyzeCandidate(candidateId) {
  if (!config.anthropicApiKey) {
    throw new AnalysisError(409, 'Falta ANTHROPIC_API_KEY en el .env: configúrala para poder analizar');
  }

  const candidate = db.prepare('SELECT * FROM candidates WHERE id = ?').get(candidateId);
  if (!candidate) {
    throw new AnalysisError(404, 'Candidato no encontrado');
  }
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(candidate.job_id);

  const criteria = db.prepare('SELECT * FROM job_criteria WHERE job_id = ?').all(job.id);
  if (criteria.length === 0) {
    throw new AnalysisError(409, 'La vacante no tiene criterios de evaluación definidos');
  }
  const niceWeights = criteria
    .filter((c) => c.type === 'nice_to_have')
    .reduce((sum, c) => sum + c.weight, 0);
  if (niceWeights !== 0 && niceWeights !== 100) {
    throw new AnalysisError(
      409,
      `Los pesos de los criterios valorables suman ${niceWeights}, deben sumar 100`
    );
  }

  const cvText = db.prepare('SELECT * FROM cv_texts WHERE candidate_id = ?').get(candidate.id);
  if (!cvText || !cvText.extraction_success) {
    throw new AnalysisError(
      409,
      cvText?.extraction_error ??
        'El candidato no tiene texto de CV extraído (descarga el PDF o reintenta la extracción)'
    );
  }

  const prompt = buildPrompt({ job, candidate, criteria, cvText: cvText.extracted_text });
  const client = new Anthropic({ apiKey: config.anthropicApiKey });

  logger.info('Analizando candidato', { candidateId: candidate.id, model: config.anthropicModel });
  const { parsed, usage, model } = await getValidatedAnalysis(client, prompt, criteria);
  const { score, mustHavesMet } = computeScore(criteria, parsed);

  // Si falla un imprescindible la recomendación por defecto es descartar;
  // la decisión final siempre es humana (el candidato nunca se oculta).
  const recommendation = mustHavesMet ? RECOMMENDATION_MAP[parsed.recomendacion] : 'discard';

  const byId = new Map(criteria.map((c) => [c.id, c]));
  const criteriaScores = [
    ...parsed.must_haves.map((item) => ({
      criterion_id: item.criterio_id,
      name: byId.get(item.criterio_id).name,
      type: 'must_have',
      met: item.cumplido,
      evidence: item.evidencia,
    })),
    ...parsed.nice_to_haves.map((item) => ({
      criterion_id: item.criterio_id,
      name: byId.get(item.criterio_id).name,
      type: 'nice_to_have',
      weight: byId.get(item.criterio_id).weight,
      points: item.puntos,
      evidence: item.evidencia,
    })),
  ];

  const now = new Date().toISOString();
  // Histórico: cada análisis es una fila nueva; nunca se sobrescribe el anterior.
  const insert = db
    .prepare(
      `INSERT INTO cv_analyses
         (candidate_id, overall_score, criteria_scores_json, must_haves_met, strengths_json,
          weaknesses_json, red_flags_json, executive_summary, recommendation, model_used,
          prompt_version, input_tokens, output_tokens, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      candidate.id,
      score,
      JSON.stringify(criteriaScores),
      mustHavesMet ? 1 : 0,
      JSON.stringify(parsed.fortalezas),
      JSON.stringify(parsed.debilidades_o_gaps),
      JSON.stringify(parsed.red_flags),
      parsed.resumen_ejecutivo,
      recommendation,
      model,
      PROMPT_VERSION,
      usage.input_tokens,
      usage.output_tokens,
      now
    );

  // El análisis solo mueve el estado automático inicial; los estados decididos
  // por una persona (preselected, discarded, interview_scheduled) no se tocan.
  if (candidate.process_status === 'pending_analysis') {
    db.prepare(`UPDATE candidates SET process_status = 'analyzed', updated_at = ? WHERE id = ?`).run(
      now,
      candidate.id
    );
  }

  const row = db.prepare('SELECT * FROM cv_analyses WHERE id = ?').get(insert.lastInsertRowid);
  logger.info('Análisis completado', {
    candidateId: candidate.id,
    score,
    recommendation,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
  });
  return serializeAnalysis(row);
}
