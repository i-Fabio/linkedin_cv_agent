# Arquitectura técnica

## Stack recomendado

- Frontend: React + Vite + TypeScript
- Backend: Node.js + Express
- Automatización navegador: Playwright
- Base de datos local: SQLite
- ORM ligero: better-sqlite3 o Prisma
- Exportación Excel: exceljs
- CSV: csv-stringify
- UI: shadcn/ui o componentes simples
- Logs en tiempo real: Server-Sent Events o WebSocket

## Estructura del proyecto

```text
linkedin-cv-agent/
├── apps/
│   ├── web/
│   │   ├── src/
│   │   └── package.json
│   └── server/
│       ├── src/
│       │   ├── routes/
│       │   ├── services/
│       │   ├── playwright/
│       │   ├── db/
│       │   └── utils/
│       └── package.json
├── data/
│   ├── app.sqlite
│   ├── browser-session/
│   └── downloads/
├── docs/
└── package.json
```

## Componentes

### Frontend

Responsabilidades:
- Configurar vacantes.
- Configurar mapeo de preguntas.
- Lanzar procesos.
- Ver logs.
- Ver tabla de candidatos.
- Descargar exportaciones.

### Backend

Responsabilidades:
- Persistencia SQLite.
- Exponer API REST.
- Controlar Playwright.
- Gestionar descargas.
- Normalizar respuestas.
- Exportar CSV/XLSX/ZIP.

### Playwright Worker

Responsabilidades:
- Abrir navegador persistente.
- Navegar por LinkedIn.
- Leer datos visibles.
- Descargar PDFs.
- Emitir logs.
- Guardar resultados.

## Seguridad

- No guardar credenciales.
- Login manual.
- Sesión persistente local en `data/browser-session`.
- Datos almacenados solo en local.
- PDFs en `data/downloads/{jobId}`.
