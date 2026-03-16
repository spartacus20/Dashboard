export function getMadridYmdParts(date: Date = new Date()): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  }).formatToParts(date);

  const year = parseInt(parts.find(p => p.type === 'year')?.value || '0', 10);
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '0', 10);
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '0', 10);

  return { year, month, day };
}

export function getMadridMidnight(date: Date = new Date()): Date {
  const { year, month, day } = getMadridYmdParts(date);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

export function addDaysUTC(base: Date, days: number): Date {
  const next = new Date(base.getTime());
  next.setUTCDate(base.getUTCDate() + days);
  return next;
}

export function formatMadridDateYYYYMMDD(date: Date): string {
  const { year, month, day } = getMadridYmdParts(date);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function formatDiaLabel(fechaStr: string): string {
  const partes = fechaStr.split('-');
  if (partes.length === 3) {
    return `${partes[2]}/${partes[1]}`;
  }
  return fechaStr;
}

export function formatTime(time: number): string {
  if (time == null || isNaN(time)) return '00:00';
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function formatTimestampUTC(ts: number | string | undefined): string {
  if (!ts) return "N/A";
  let tsNum: number;
  if (typeof ts === 'string') {
    tsNum = parseInt(ts, 10);
    if (isNaN(tsNum)) return ts;
  } else {
    tsNum = ts;
  }
  const date = new Date(tsNum);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}
