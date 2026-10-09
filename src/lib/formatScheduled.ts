// Formatea el timestamp "programado" (scheduled_at / scheduled_timestamp) de un
// batch call. Acepta segundos o milisegundos y autodetecta la unidad: un valor
// > 1e12 ya está en ms; si no, se asume en segundos y se multiplica ×1000.
//
// Esto evita el bug de multiplicar ×1000 un valor que YA venía en ms (el
// Batch-Call-Service guarda scheduled_at en ms), que producía fechas absurdas
// como el año 58532. Se muestra en la zona horaria del batch (o la del navegador
// si no hay / es inválida). Devuelve null si el valor no es válido.
export function formatScheduledDate(value: unknown, timezone?: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  const raw = Number(value);
  if (!Number.isFinite(raw)) return null;

  const ms = raw > 1e12 ? raw : raw * 1000;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return null;

  const opts: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  };

  try {
    return date.toLocaleString('es-ES', { ...opts, timeZone: timezone || undefined });
  } catch {
    // Zona horaria inválida → formatear en la zona del navegador.
    return date.toLocaleString('es-ES', opts);
  }
}
