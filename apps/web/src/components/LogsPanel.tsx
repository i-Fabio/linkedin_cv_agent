interface Props {
  lastRunAt: string | null;
}

export default function LogsPanel({ lastRunAt }: Props) {
  return (
    <div className="card">
      <h2>Logs de extracción</h2>
      {lastRunAt ? (
        <p className="muted">Última ejecución: {new Date(lastRunAt).toLocaleString()}</p>
      ) : (
        <div className="empty-state">
          Los logs aparecerán aquí cuando se ejecute una extracción con Playwright (disponible a
          partir de la Fase 3).
        </div>
      )}
    </div>
  );
}
