# Plan de proyecto por fases

## Fase 0 — Preparación

Objetivo:
- Crear estructura base.

Tareas:
- Crear monorepo simple.
- Configurar Node.js.
- Instalar Playwright.
- Instalar SQLite.
- Crear carpetas data/downloads y data/browser-session.
- Crear README inicial.

Entregable:
- Proyecto ejecutable localmente.

## Fase 1 — Backend base

Objetivo:
- API y base de datos funcional.

Tareas:
- Crear servidor Express.
- Crear tablas SQLite.
- Crear CRUD de jobs.
- Crear CRUD de question_mappings.
- Crear endpoint candidatos.
- Crear sistema básico de logs.

Entregable:
- API REST funcional.

## Fase 2 — Interfaz web

Objetivo:
- Permitir configurar vacantes y mapeos.

Tareas:
- Crear app React/Vite.
- Pantalla listado vacantes.
- Pantalla detalle vacante.
- Formulario URL LinkedIn.
- Tabla mapeo preguntas.
- Tabla candidatos.
- Panel de logs.

Entregable:
- UI operativa.

## Fase 3 — Playwright login y navegación

Objetivo:
- Abrir navegador y entrar en LinkedIn.

Tareas:
- Implementar `open-browser`.
- Sesión persistente.
- Botón “Estoy logueado / continuar”.
- Navegar a URL configurada.
- Logs en tiempo real.

Entregable:
- Navegador controlado desde la app.

## Fase 4 — Extracción de respuestas

Objetivo:
- Leer preguntas y respuestas.

Tareas:
- Leer texto visible de candidato.
- Extraer bloque de preselección.
- Parsear preguntas/respuestas.
- Guardar JSON bruto.
- Detectar preguntas y sugerir mapeo.

Entregable:
- Respuestas guardadas por candidato.

## Fase 5 — Descarga de PDFs

Objetivo:
- Descargar CVs.

Tareas:
- Detectar botón/enlace de CV.
- Descargar PDF.
- Renombrar archivo.
- Guardar ruta en BD.
- Gestionar errores.

Entregable:
- PDFs descargados por vacante.

## Fase 6 — Recorrido completo

Objetivo:
- Procesar múltiples candidatos.

Tareas:
- Detectar lista candidatos.
- Iterar candidatos.
- Volver a lista.
- Scroll/paginación.
- Reanudar si falla.
- Evitar duplicados.

Entregable:
- Extracción completa de una vacante.

## Fase 7 — Exportaciones

Objetivo:
- Generar CSV, Excel y ZIP.

Tareas:
- Export CSV.
- Export XLSX.
- Export ZIP con PDFs.
- Botones de descarga en UI.

Entregable:
- Archivo final usable.

## Fase 8 — Mejoras

Opcional:
- Análisis IA del CV.
- Scoring candidatos.
- Subida SharePoint.
- Plantillas de mapeo.
- Multi-vacante.
- Dashboard comparativo.
