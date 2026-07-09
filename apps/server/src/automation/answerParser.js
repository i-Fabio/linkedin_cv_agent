// Heurísticas de parseo segun docs/05_PLAYWRIGHT_FLOW.md: no hay selectores CSS
// fiables en LinkedIn, así que se trabaja sobre el texto plano (body.innerText()).

const BLOCK_START_MARKERS = ['Respuestas a preguntas de preselección'];
const BLOCK_END_MARKERS = ['Mostrar menos'];

export function extractAnswersBlock(pageText) {
  const startMarker = BLOCK_START_MARKERS.find((marker) => pageText.includes(marker));
  if (!startMarker) return null;

  const startIdx = pageText.indexOf(startMarker) + startMarker.length;
  let endIdx = pageText.length;
  for (const marker of BLOCK_END_MARKERS) {
    const idx = pageText.indexOf(marker, startIdx);
    if (idx !== -1 && idx < endIdx) endIdx = idx;
  }

  return pageText.slice(startIdx, endIdx);
}

// Cada pregunta puede venir como:
//   <pregunta>
//   <respuesta>
// o con la "respuesta ideal" configurada por el reclutador de por medio:
//   <pregunta>
//   Respuesta ideal: <respuesta ideal>
//   <respuesta real del candidato>
export function parseQuestionAnswers(blockText) {
  const lines = blockText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const pairs = [];
  let currentQuestion = null;
  let awaitingRealAnswer = false;

  for (const line of lines) {
    if (/^Respuesta ideal:/i.test(line)) {
      awaitingRealAnswer = true;
      continue;
    }

    if (awaitingRealAnswer) {
      if (currentQuestion) {
        pairs.push({ question: currentQuestion, answer: line });
      }
      currentQuestion = null;
      awaitingRealAnswer = false;
      continue;
    }

    if (currentQuestion === null) {
      currentQuestion = line;
      continue;
    }

    pairs.push({ question: currentQuestion, answer: line });
    currentQuestion = null;
  }

  return pairs;
}

export function parseCandidateAnswers(pageText) {
  const block = extractAnswersBlock(pageText);
  if (!block) return [];
  return parseQuestionAnswers(block);
}

const BOOLEAN_TRUE = new Set(['si', 'sí', 'yes']);
const BOOLEAN_FALSE = new Set(['no']);

export function guessFieldType(answer) {
  const value = answer.trim().toLowerCase();
  if (BOOLEAN_TRUE.has(value) || BOOLEAN_FALSE.has(value)) return 'boolean';
  if (/\d/.test(value) && /^[\d.,\s€$]+$/.test(value)) return 'number';
  return 'text';
}

export function normalizeAnswer(rawAnswer, fieldType) {
  const value = rawAnswer.trim();
  if (fieldType === 'boolean') {
    const lower = value.toLowerCase();
    if (BOOLEAN_TRUE.has(lower)) return true;
    if (BOOLEAN_FALSE.has(lower)) return false;
    return null;
  }
  if (fieldType === 'number') {
    const cleaned = value
      .replace(/[€$]/g, '')
      .replace(/\s/g, '')
      .replace(/\.(?=\d{3}(\D|$))/g, '')
      .replace(',', '.');
    const num = Number(cleaned);
    return Number.isNaN(num) ? null : num;
  }
  return value;
}

export function slugifyField(question) {
  return question
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[¿?¡!]/g, '')
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}
