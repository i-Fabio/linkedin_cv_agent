# Prompt principal para Codex

Quiero que desarrolles una aplicación web local llamada `linkedin-cv-agent`.

Objetivo:
Automatizar, mediante Playwright, la descarga de CVs PDF desde candidaturas de una vacante de LinkedIn y extraer las respuestas de preselección para guardarlas en una tabla configurable.

Stack obligatorio:
- Node.js
- Express
- React + Vite + TypeScript
- Playwright
- SQLite
- ExcelJS para exportación XLSX
- CSV export
- ZIP export

Requisitos importantes:
- La app debe ejecutarse en macOS Intel.
- No debe guardar contraseñas.
- Debe usar sesión persistente de Playwright en `data/browser-session`.
- Debe abrir navegador visible, no headless.
- El usuario hará login manual en LinkedIn.
- La app debe tener una interfaz web para configurar:
  - URL de la vacante
  - Nombre de la vacante
  - Mapeo de preguntas a campos internos
- Por cada candidato debe guardar:
  - nombre
  - URL del perfil
  - respuestas brutas JSON
  - respuestas normalizadas JSON
  - campos mapeados
  - ruta del PDF descargado
- Debe poder exportar CSV, XLSX y ZIP con PDFs.

Lee y respeta todos los documentos de la carpeta `/docs`.

Crea el proyecto por fases:
1. Backend + SQLite.
2. UI básica.
3. Playwright login persistente.
4. Extracción de respuestas.
5. Descarga de PDFs.
6. Recorrido completo de candidatos.
7. Exportaciones.

No implementes acciones destructivas en LinkedIn. No enviar mensajes. No modificar estados de candidatos. Solo leer información visible y descargar PDFs a los que el usuario ya tiene acceso.
