// Heurísticas de parseo segun docs/05_PLAYWRIGHT_FLOW.md: no hay selectores CSS
// fiables en LinkedIn, así que se trabaja sobre el texto plano (body.innerText()).

const BLOCK_START_MARKERS = ['Respuestas a preguntas de preselección'];

export function extractAnswersBlock(pageText) {
  const startMarker = BLOCK_START_MARKERS.find((marker) => pageText.includes(marker));
  if (!startMarker) return null;

  return pageText.slice(pageText.indexOf(startMarker) + startMarker.length);
}

// El bloque termina en "Mostrar menos" o, si la seccion ya esta expandida,
// directamente en el overlay de mensajeria que LinkedIn pinta al final del body.
function isBlockEndLine(line) {
  return (
    line === 'Mostrar menos' ||
    line === 'Mensajes' ||
    line === 'Redactar mensaje' ||
    line.startsWith('Estás en la superposición de mensajería')
  );
}

// Cabeceras de seccion intercaladas entre las preguntas,
// p. ej. "Requisitos indispensables (6 de 6)" o "Requisitos deseables (1 de 1)".
function isSectionHeaderLine(line) {
  return /\(\d+\s+de\s+\d+\)$/.test(line) || /^Preguntas adicionales/i.test(line);
}

// Una respuesta suelta nunca es una pregunta: evita que un desfase en el
// parseo convierta "24000" o "Sí" en pregunta.
function looksLikeAnswerOnly(line) {
  return /^[\d.,\s€$]+$/.test(line) || /^(sí|si|no|yes)$/i.test(line);
}

// Formato real de LinkedIn (ver docs/05_PLAYWRIGHT_FLOW.md):
//   <pregunta>
//   Respuesta del candidato        <- etiqueta, opcional
//   <respuesta>
// o el formato antiguo con la "respuesta ideal" del reclutador de por medio:
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

  for (const line of lines) {
    if (isBlockEndLine(line)) break;
    if (isSectionHeaderLine(line)) continue;
    if (/^Respuesta ideal\b/i.test(line) || /^Respuesta del candidato$/i.test(line)) continue;

    if (currentQuestion === null) {
      if (looksLikeAnswerOnly(line)) continue;
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

// Clave de comparacion tolerante para casar la pregunta extraida de la pagina
// con el texto del mapeo manual: ignora acentos, mayusculas y signos (¿?¡!).
export function normalizeQuestionKey(question) {
  return question
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9€$]+/g, ' ')
    .trim();
}

// Empareja una pregunta extraida con un mapeo manual: coincidencia exacta
// normalizada o por prefijo (LinkedIn puede truncar el texto con "…ver más").
export function matchesQuestion(extractedQuestion, mappingQuestion) {
  const a = normalizeQuestionKey(extractedQuestion);
  const b = normalizeQuestionKey(mappingQuestion);
  if (!a || !b) return false;
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  return shorter.length >= 15 && longer.startsWith(shorter);
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
