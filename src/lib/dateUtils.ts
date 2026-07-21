// Fuente única de verdad para cálculo de períodos ("hoy/semana/mes/personalizado")
// y componentes de fecha en una zona horaria arbitraria.
//
// DEFAULT_TIMEZONE es fija por ahora (decisión de julio 2026: Madrid por
// defecto para todos los clientes). Fase 2 pendiente: cuando cada cliente
// pueda configurar la suya (se guardaría en `metadata.timezone`, ya presente
// en sessionStorage), cada caller pasa esa zona en vez del default — ninguna
// función de acá necesita cambiar, ya reciben `timezone` como parámetro.
//
// Todo lo que construye un INSTANTE (zonedTimeToUtc, getPeriodRange) usa el
// algoritmo "adivinar y corregir" con Intl.DateTimeFormat — nunca reinterpreta
// un string con `new Date(...)`, que depende de una zona horaria "local"
// ambigua (la del navegador) y da resultados corridos por el offset real de
// la zona pedida.

export const DEFAULT_TIMEZONE = 'Europe/Madrid';

export function getMadridYmdParts(date: Date = new Date(), timezone: string = DEFAULT_TIMEZONE): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0', 10);
  return { year: get('year'), month: get('month'), day: get('day') };
}

export function addDaysUTC(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 86400000);
}

// El instante UTC exacto que corresponde a esa hora de pared en `timezone`.
export function zonedTimeToUtc(
  year: number, month: number, day: number,
  hour: number = 0, minute: number = 0, second: number = 0,
  timezone: string = DEFAULT_TIMEZONE,
): Date {
  let guess = Date.UTC(year, month - 1, day, hour, minute, second);
  const wantMillis = guess;

  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    }).formatToParts(new Date(guess));
    const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0', 10);
    const gotMillis = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
    const diff = wantMillis - gotMillis;
    if (diff === 0) break;
    guess += diff;
  }
  return new Date(guess);
}

// Medianoche (00:00:00.000) de la fecha actual en `timezone`, como instante UTC real.
export function getMadridMidnight(date: Date = new Date(), timezone: string = DEFAULT_TIMEZONE): Date {
  const { year, month, day } = getMadridYmdParts(date, timezone);
  return zonedTimeToUtc(year, month, day, 0, 0, 0, timezone);
}

export function formatMadridDateYYYYMMDD(date: Date, timezone: string = DEFAULT_TIMEZONE): string {
  const { year, month, day } = getMadridYmdParts(date, timezone);
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

export interface PeriodRange {
  fechaInicio: string;
  fechaFin: string;
}

// Rango [fechaInicio, fechaFin) en UTC para cada período soportado.
//   - today:  medianoche de hoy (zona) -> medianoche de mañana (zona)
//   - week:   últimos 7 días incluyendo hoy -> ventana rodante, NO semana
//             calendario (decisión de julio 2026: unificado en toda la app)
//   - month:  día 1 del mes actual (zona) -> día 1 del mes siguiente (zona)
//   - custom: customStart/customEnd 'YYYY-MM-DD'; customStartTime/customEndTime
//             'HH:MM' (default 00:00 / 23:59) — instante UTC real de esa hora
//             de pared en `timezone`, no los dígitos tecleados relabeleados como UTC.
export function getPeriodRange(
  period: string,
  opts: {
    timezone?: string;
    customStart?: string;
    customEnd?: string;
    customStartTime?: string;
    customEndTime?: string;
  } = {},
): PeriodRange | null {
  const timezone = opts.timezone ?? DEFAULT_TIMEZONE;

  switch (period) {
    case 'today': {
      const start = getMadridMidnight(new Date(), timezone);
      return { fechaInicio: start.toISOString(), fechaFin: addDaysUTC(start, 1).toISOString() };
    }

    case 'week': {
      const todayMidnight = getMadridMidnight(new Date(), timezone);
      const start = addDaysUTC(todayMidnight, -6);
      return { fechaInicio: start.toISOString(), fechaFin: addDaysUTC(todayMidnight, 1).toISOString() };
    }

    case 'month': {
      const { year, month } = getMadridYmdParts(new Date(), timezone);
      const start = zonedTimeToUtc(year, month, 1, 0, 0, 0, timezone);
      const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
      const end = zonedTimeToUtc(next.y, next.m, 1, 0, 0, 0, timezone);
      return { fechaInicio: start.toISOString(), fechaFin: end.toISOString() };
    }

    case 'custom': {
      const { customStart, customEnd, customStartTime, customEndTime } = opts;
      if (!customStart || !customEnd) return null;

      const [yS, mS, dS] = customStart.split('-').map(Number);
      const [yE, mE, dE] = customEnd.split('-').map(Number);
      const [hS, minS] = (customStartTime || '00:00').split(':').map(Number);
      const [hE, minE] = (customEndTime || '23:59').split(':').map(Number);

      const start = zonedTimeToUtc(yS, mS || 1, dS || 1, hS || 0, minS || 0, 0, timezone);
      // Rango semiabierto [inicio, fin): fin = el instante en que arranca el
      // minuto siguiente al de fin pedido (23:59:59 + 1000ms = 00:00:00 del
      // minuto/día siguiente).
      let end = zonedTimeToUtc(yE, mE || 1, dE || 1, hE ?? 23, minE ?? 59, 59, timezone);
      end = new Date(end.getTime() + 1000);

      // Mismo día con hora de fin <= hora de inicio: se asume que cruza medianoche.
      if (customStart === customEnd && (hE ?? 23) * 60 + (minE ?? 59) <= (hS || 0) * 60 + (minS || 0)) {
        end = addDaysUTC(end, 1);
      }

      return { fechaInicio: start.toISOString(), fechaFin: end.toISOString() };
    }

    default:
      return null;
  }
}
