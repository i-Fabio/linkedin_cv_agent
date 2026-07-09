# Notas de implementación

## Comandos esperados

```bash
npm install
npm run dev
```

Debe levantar:
- backend en `http://localhost:4000`
- frontend en `http://localhost:5173`

## Variables de entorno

Crear `.env.example`:

```env
PORT=4000
DATABASE_PATH=./data/app.sqlite
DOWNLOADS_DIR=./data/downloads
BROWSER_SESSION_DIR=./data/browser-session
```

## Logs

Cada run debe crear log en:
```text
data/logs/run-{runId}.log
```

## Normalizador de nombres

Eliminar:
- acentos
- caracteres raros
- espacios múltiples
- barras
- dos puntos

Ejemplo:
```text
José Pérez García -> Jose_Perez_Garcia.pdf
```

## Estrategia de selectores

No confiar demasiado en clases CSS de LinkedIn.

Preferir:
- texto visible
- roles accesibles
- botones por nombre
- fallback con `body.innerText()`

## Errores comunes

- LinkedIn cambia el texto de botones.
- El CV puede abrirse en nueva pestaña.
- El PDF puede no descargarse si se abre en visor.
- Algunos candidatos no tendrán PDF.
- El bloque de respuestas puede estar colapsado.
- Puede haber scroll virtualizado en la lista.
