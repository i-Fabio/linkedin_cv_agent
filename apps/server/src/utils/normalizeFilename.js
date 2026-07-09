// docs/09_IMPLEMENTATION_NOTES.md: "José Pérez García" -> "Jose_Perez_Garcia"
export function normalizeFilename(rawName) {
  return rawName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\/\\:]/g, '_')
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}
