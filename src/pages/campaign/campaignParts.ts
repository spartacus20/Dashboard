// Modelo y helpers de las "partes" de una campaña programada multi-parte.
// Vive aparte del componente CampaignPartCard para no romper el Fast Refresh
// (un archivo de componente solo debería exportar componentes).
import { BatchTaskInput } from '../../lib/parseBatchCsv';

export type PartStatus = 'idle' | 'creating' | 'success' | 'error';

// Estado individual de UNA parte/campaña. Cada parte es totalmente independiente:
// su propio workspace, número, agente, horario, ventana y reintentos.
export interface CampaignPart {
  id: string;
  name: string;
  workspaceId: string;
  fromNumber: string;
  agentId: string;
  mode: 'now' | 'scheduled';
  scheduledAt: string;
  useWindow: boolean;
  windowDays: string[];
  windowStart: string;
  windowEnd: string;
  timezone: string;
  maxConcurrency: string; // vacío = sin tope propio
  retriesOn: boolean;
  maxRetries: string; // reintentos ADICIONALES a la llamada inicial (backend: max_retry_attempts = maxRetries + 1)
  delayVoicemailMin: string;
  delayNoAnswerMin: string;
  delayBusyMin: string;
  tasks: BatchTaskInput[];
  status: PartStatus;
  batchId?: string;
  errorMsg?: string;
}

export const DAYS: { id: string; label: string }[] = [
  { id: 'Monday', label: 'Lun' },
  { id: 'Tuesday', label: 'Mar' },
  { id: 'Wednesday', label: 'Mié' },
  { id: 'Thursday', label: 'Jue' },
  { id: 'Friday', label: 'Vie' },
  { id: 'Saturday', label: 'Sáb' },
  { id: 'Sunday', label: 'Dom' },
];

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function randomId(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* ignore */ }
  return `part-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

// Parte nueva "en blanco": workspace sin elegir; el resto con defaults sanos
// (los mismos que tenía el modal de una sola campaña).
export function makeBlankPart(detectedTz: string): CampaignPart {
  return {
    id: randomId(),
    name: '',
    workspaceId: '',
    fromNumber: '',
    agentId: '',
    mode: 'now',
    scheduledAt: '',
    useWindow: false,
    windowDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    windowStart: '09:00',
    windowEnd: '20:00',
    timezone: detectedTz,
    maxConcurrency: '',
    retriesOn: true,
    maxRetries: '2', // 2 reintentos = hasta 3 llamadas (la inicial + 2 reintentos) — mismo volumen que el default viejo
    delayVoicemailMin: '240',
    delayNoAnswerMin: '120',
    delayBusyMin: '60',
    tasks: [],
    status: 'idle',
  };
}

// Validación de una parte para poder crearla. Obligatorios: nombre, workspace,
// número de origen y agente (además de tener contactos y una programación válida).
export function canCreatePart(p: CampaignPart): boolean {
  return (
    p.name.trim() !== '' &&
    p.workspaceId !== '' &&
    Boolean(p.fromNumber) &&
    p.agentId !== '' &&
    p.tasks.length > 0 &&
    (p.mode === 'now' || Boolean(p.scheduledAt)) &&
    (!p.useWindow || (p.windowDays.length > 0 && toMinutes(p.windowEnd) > toMinutes(p.windowStart)))
  );
}
