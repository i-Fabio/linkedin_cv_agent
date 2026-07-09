import { useEffect, useRef, useState } from 'react';
import { subscribeToRunEvents } from '../api/client';
import { ExtractionRun, RUN_STATUS_LABELS } from '../types';
import StatusBadge from './StatusBadge';

interface Props {
  activeRun: ExtractionRun | null;
}

export default function LogsPanel({ activeRun }: Props) {
  const [lines, setLines] = useState<string[]>([]);
  const [status, setStatus] = useState(activeRun?.status ?? null);
  const boxRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    setLines([]);
    setStatus(activeRun?.status ?? null);

    if (!activeRun) return;

    const unsubscribe = subscribeToRunEvents(activeRun.id, {
      onLog: (line) => setLines((prev) => [...prev, line]),
      onStatus: (next) => setStatus(next as ExtractionRun['status']),
    });

    return unsubscribe;
  }, [activeRun?.id]);

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight });
  }, [lines]);

  return (
    <div className="card">
      <h2>Logs de extracción</h2>

      {!activeRun ? (
        <div className="empty-state">
          Todavía no se ha abierto ningún navegador para esta vacante.
        </div>
      ) : (
        <>
          {status && <StatusBadge status={status} label={RUN_STATUS_LABELS[status as keyof typeof RUN_STATUS_LABELS]} />}
          <pre className="logs-box" ref={boxRef} style={{ marginTop: 10 }}>
            {lines.length > 0 ? lines.join('\n') : 'Esperando actividad...'}
          </pre>
        </>
      )}
    </div>
  );
}
