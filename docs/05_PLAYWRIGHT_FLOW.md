# Flujo Playwright

## Principios

- Navegador visible.
- Slow motion moderado.
- Pausas aleatorias.
- Login manual.
- Sesión persistente.
- No acciones destructivas.
- No enviar mensajes.
- No cambiar estados en LinkedIn.

## Flujo principal

1. Abrir Chromium con `launchPersistentContext`.
2. Ir a la URL de la vacante.
3. Si aparece login, esperar intervención manual.
4. Esperar confirmación del usuario desde la interfaz.
5. Detectar lista de candidatos.
6. Iterar candidatos visibles.
7. Abrir candidato.
8. Leer:
   - nombre
   - URL perfil
   - bloque “Respuestas a preguntas de preselección”
   - botones/enlaces de descarga de CV
9. Descargar PDF.
10. Guardar candidato.
11. Volver a lista.
12. Continuar con siguiente.
13. Si hay paginación o scroll infinito, avanzar.
14. Finalizar run.

## Lectura de respuestas

Estrategia inicial:
- Leer `body.innerText()`.
- Buscar bloque entre:
  - `Respuestas a preguntas de preselección`
  - `Mostrar menos` o siguiente sección.
- Extraer preguntas por líneas.
- Detectar “Respuesta ideal”.
- La línea posterior a “Respuesta ideal: ...” suele ser la respuesta real.

## Normalización

- Yes / Sí / Si => true
- No => false
- Números => number
- Salario => number eliminando símbolos y puntos
- Texto libre => string

## Descarga de PDF

Usar:

```js
const [download] = await Promise.all([
  page.waitForEvent('download'),
  downloadButton.click()
]);
await download.saveAs(targetPath);
```

## Reanudación

Antes de guardar un candidato:
- Comprobar si ya existe por URL de perfil o nombre + job_id.
- Si ya existe, actualizar.
- Si el PDF ya existe, no duplicar salvo que se fuerce.
