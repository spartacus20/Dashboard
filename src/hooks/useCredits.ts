import { useCallback, useEffect, useRef, useState } from 'react';
import { CreditsEnabled, CreditsInfo, fetchCredits } from '../services/api/credits';

// Estado de créditos prepago del cliente. Sin estado global: cada pantalla que lo
// necesita usa el hook (y le pasa el resultado a sus hijos).
//
// Si el pedido falla (red, backend caído) NO se asume nada: `credits` queda null y la UI
// se comporta como un cliente sin créditos. El control real lo hace el backend (402/403).
export interface UseCreditsResult {
  credits: CreditsEnabled | null; // null = sin créditos, cargando o error
  loading: boolean; // true solo hasta la primera respuesta
  error: string | null;
  blocked: boolean;
  refresh: () => Promise<void>;
}

export function useCredits(
  clientId: string | null | undefined,
  opts: { pollMs?: number } = {},
): UseCreditsResult {
  const [info, setInfo] = useState<CreditsInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Descarta respuestas viejas si cambia el cliente con un pedido en vuelo.
  const requestSeq = useRef(0);

  const refresh = useCallback(async () => {
    if (!clientId) return;
    const seq = ++requestSeq.current;
    try {
      const data = await fetchCredits(clientId);
      if (seq !== requestSeq.current) return;
      setInfo(data);
      setError(null);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los créditos');
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    setInfo(null);
    setError(null);
    if (!clientId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void refresh();
    if (!opts.pollMs) return;
    const timer = window.setInterval(() => void refresh(), opts.pollMs);
    return () => window.clearInterval(timer);
  }, [clientId, refresh, opts.pollMs]);

  const credits = info && info.enabled ? info : null;
  return { credits, loading, error, blocked: credits?.blocked === true, refresh };
}
