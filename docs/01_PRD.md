# PRD — LinkedIn CV Agent

## 1. Objetivo

Crear una aplicación web local que permita configurar una o varias URLs de LinkedIn Jobs / Recruiter, navegar por las candidaturas, descargar los CVs adjuntos en PDF, leer las respuestas de preselección y guardar toda la información en una tabla estructurada.

## 2. Problema

Actualmente la revisión de candidaturas en LinkedIn requiere:
- Entrar manualmente en cada candidato.
- Descargar manualmente el CV.
- Copiar respuestas de preselección.
- Crear una tabla resumen.
- Revisar salario, experiencia, disponibilidad, presencialidad y tecnologías.

Esto consume mucho tiempo y es propenso a errores.

## 3. Usuarios

Usuario principal:
- Responsable de selección / PM / dirección técnica.

Uso:
- Ejecutar la app en un Mac local.
- Configurar una URL de vacante.
- Descargar todos los CVs.
- Exportar una tabla con datos de cada candidato.

## 4. Alcance funcional

### 4.1 Interfaz web

La aplicación debe tener una interfaz web local con:

- Dashboard de vacantes configuradas.
- Alta/edición de una vacante.
- Campo para URL de LinkedIn.
- Nombre interno de la vacante.
- Estado del proceso.
- Botón “Abrir navegador”.
- Botón “Iniciar extracción”.
- Botón “Exportar CSV/Excel”.
- Vista de candidatos extraídos.
- Vista de mapeo de preguntas.

### 4.2 Configuración de vacante

Por cada vacante se debe poder guardar:

- Nombre de la vacante.
- URL de LinkedIn.
- Carpeta local de descarga.
- Fecha de creación.
- Estado:
  - Pendiente
  - En curso
  - Completada
  - Error
- Preguntas mapeadas.

### 4.3 Mapeo de preguntas

La app debe permitir mapear preguntas de LinkedIn a campos internos.

Ejemplo:

| Pregunta detectada | Campo interno | Tipo |
|---|---|---|
| ¿Tienes disponibilidad inmediata? | disponibilidad_inmediata | boolean |
| ¿Puedes trabajar presencialmente en Barcelona? | presencial_barcelona | boolean |
| ¿Cuántos años de experiencia tienes en desarrollo web? | anos_experiencia_web | number |
| Expectativa salarial bruta anual | expectativa_salarial | number |
| ¿Has trabajado con React y TypeScript? | react_typescript | boolean |
| ¿Has adjuntado CV PDF? | cv_pdf_adjuntado | boolean |
| ¿Tienes experiencia desarrollando APIs o backend? | backend_apis | boolean |

El sistema debe permitir:
- Detectar preguntas automáticamente desde la primera candidatura.
- Sugerir campos internos.
- Editar manualmente el mapeo.
- Guardar el mapeo por vacante.
- Reutilizar mapeos entre vacantes.

### 4.4 Navegación automatizada

El sistema debe usar Playwright para:
- Abrir Chromium visible.
- Reutilizar sesión persistente.
- Permitir login manual en LinkedIn.
- Navegar a la URL configurada.
- Recorrer candidatos.
- Abrir ficha de candidato.
- Leer nombre, URL de perfil, respuestas y datos visibles.
- Descargar CV si existe.
- Volver a la lista.
- Continuar hasta finalizar.

### 4.5 Descarga de PDFs

Por cada candidato:
- Descargar el CV en PDF.
- Guardarlo en carpeta de la vacante.
- Renombrarlo con formato seguro:

```text
YYYY-MM-DD_Nombre_Apellido_LinkedIn.pdf
```

Si hay duplicados:
```text
YYYY-MM-DD_Nombre_Apellido_LinkedIn_2.pdf
```

### 4.6 Tabla de candidatos

Guardar por candidato:

- ID interno.
- ID vacante.
- Nombre.
- URL perfil LinkedIn.
- Fecha de extracción.
- Estado de extracción.
- Ruta local del PDF.
- Nombre archivo PDF.
- Respuestas originales en JSON.
- Respuestas normalizadas.
- Campos mapeados:
  - disponibilidad_inmediata
  - presencial_barcelona
  - anos_experiencia_web
  - react_typescript
  - expectativa_salarial
  - cv_pdf_adjuntado
  - backend_apis

### 4.7 Exportación

Exportar:
- CSV.
- Excel XLSX.
- ZIP con:
  - Excel
  - CSV
  - PDFs descargados

## 5. Requisitos no funcionales

- Ejecutable en macOS Intel.
- Node.js LTS.
- App local.
- No guardar contraseñas.
- Reutilizar sesión de navegador en carpeta local.
- Logs visibles en interfaz.
- Pausas humanas para evitar automatización agresiva.
- Manejo de errores candidato por candidato.
- Posibilidad de reanudar proceso.

## 6. Fuera de alcance inicial

- Enviar mensajes a candidatos.
- Cambiar estado de candidatos en LinkedIn.
- Scraping masivo fuera de candidaturas propias.
- Integración directa con LinkedIn API.
- Subida automática a SharePoint.
- Análisis IA del CV.
