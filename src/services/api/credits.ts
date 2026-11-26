import { BASE_URL } from './config';
import { authedFetch } from './http';

// Créditos prepago del cliente (backend: GET /api/credits/:clientId).
// Solo algunos clientes los tienen: al resto el backend les responde { enabled: false }
// y la UI no muestra nada. El cliente ve SOLO créditos (nunca dinero).

export interface CreditsPausedCampaign {
  provider: 'batch' | 'callshift';
  campaign_id: string;
  campaign_name: string | null;
  stopped_at: string | null;
}

export interface CreditsMovement {
  kind: 'usage' | 'grant' | 'adjustment';
  day: string; // YYYY-MM-DD en la zona pedida
  credits: number; // negativo en consumo
  calls: number | null;
  duration_ms: number | null;
  note: string | null;
  created_at: string;
}

export interface CreditsEnabled {
  enabled: true;
  balance_credits: number; // puede ser negativo
  rate_per_minute: number;
  approx_minutes: number;
  blocked: boolean; // sin créditos: no puede lanzar llamadas
  stopped_at: string | null;
  paused_campaigns: CreditsPausedCampaign[]; // frenadas por falta de créditos y sin reanudar
  movements: CreditsMovement[];
}

export type CreditsInfo = { enabled: false } | CreditsEnabled;

export const CREDITS_MOVEMENT_DAYS = 30;

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export async function fetchCredits(
  clientId: string,
  opts: { tz?: string; days?: number } = {},
): Promise<CreditsInfo> {
  const qs = new URLSearchParams({
    tz: opts.tz ?? browserTimezone(),
    days: String(opts.days ?? CREDITS_MOVEMENT_DAYS),
  });
  const res = await authedFetch(`${BASE_URL}/api/credits/${encodeURIComponent(clientId)}?${qs}`, {
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string })?.error || `Error ${res.status}`);
  return data as CreditsInfo;
}
