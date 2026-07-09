# Criterios de aceptación

## Vacantes

- El usuario puede crear una vacante con nombre y URL.
- El usuario puede editar o borrar una vacante.
- La URL queda guardada en SQLite.

## Mapeo

- El usuario puede crear campos mapeados.
- El usuario puede asociar una pregunta de LinkedIn a un campo interno.
- El mapeo queda guardado por vacante.
- El sistema puede guardar respuestas no mapeadas en JSON bruto.

## Navegador

- El usuario puede abrir Chromium desde la interfaz.
- La sesión de LinkedIn se conserva entre ejecuciones.
- Si no hay login, el sistema espera intervención manual.

## Extracción

- El sistema puede leer respuestas visibles.
- El sistema guarda respuestas brutas.
- El sistema aplica mapeos a campos normalizados.
- Si una pregunta no está mapeada, no se pierde.

## PDFs

- El sistema descarga el CV cuando existe.
- El archivo queda en la carpeta correcta.
- La ruta queda guardada en la base de datos.
- Si no hay PDF, el candidato queda marcado con aviso.

## Exportación

- CSV exporta todos los candidatos.
- XLSX exporta todos los candidatos.
- ZIP incluye CSV/XLSX y PDFs.

## Robustez

- Un error en un candidato no detiene todo el proceso.
- Los errores aparecen en logs.
- Se puede reintentar una vacante.
