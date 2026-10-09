import { BASE_URL } from './config';
import { authedFetch } from './http';

// Campañas de CallShift del cliente (backend: /api/callshift/:clientId/...).
// El backend solo devuelve lo que cuelga de los agentes asignados al cliente desde
// gestion_dashboard; la API key de CallShift nunca llega al navegador.

export interface CallshiftStatus {
  enabled: boolean;
  agents: number;
}

export interface CallshiftAgent {
  agent_id: string;
  name: string | null;
}

export interface CallshiftPhone {
  phone_id: string;
  phone_number: string | null;
  agent_id: string;
  agent_name: string | null;
}

export type CallshiftCampaignStatus =
  | 'in_progress'
  | 'scheduled'
  | 'schedule_failed'
  | 'paused'
  | 'draft'
  | 'completed';

export interface CallshiftCampaign {
  campaign_id: string;
  name: string | null;
  status: CallshiftCampaignStatus;
  active: boolean;
  agent_id: string | null;
  agent_name: string | null;
  phone_id: string | null;
  phone_number: string | null;
  metrics: { totalCalls: number; reached: number; callsCompleted: number } | null;
  scheduled_at: string | null;
  schedule_error: string | null;
  contacts_total: number | null;
  skipped_total: number | null;
  created_at: string | null;
  created_by: string | null;
}

export interface CallshiftContactInput {
  phone_number: string;
  first_name?: string;
  last_name?: string;
  metadata?: Record<string, string>;
}

export interface SkippedContact {
  index: number;
  phone_number: string | null;
  reason: 'telefono_invalido' | 'no_llamar' | 'duplicado' | 'metadata_no_es_objeto';
}

export interface LaunchResult {
  campaign_id: string;
  name: string;
  active: boolean;
  status: 'in_progress' | 'scheduled' | 'draft';
  scheduled_at: string | null;
  contacts_pushed: number;
  skipped: SkippedContact[];
  webhook: { verified: boolean; agent_repaired: boolean };
}

// Error con los datos extra que manda el backend en fallos parciales.
export class CallshiftApiError extends Error {
  code?: string;
  campaignId?: string;
  contactsPushed?: number;
  skipped?: SkippedContact[];
  constructor(message: string, data: Record<string, unknown>) {
    super(message);
    this.code = data.code as string | undefined;
    this.campaignId = data.campaign_id as string | undefined;
    this.contactsPushed = data.contacts_pushed as number | undefined;
    this.skipped = data.skipped as SkippedContact[] | undefined;
  }
}

async function call<T>(clientId: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await authedFetch(`${BASE_URL}/api/callshift/${encodeURIComponent(clientId)}${path}`, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new CallshiftApiError(data.error || `Error ${res.status}`, data);
  return data as T;
}

export const fetchCallshiftStatus = (clientId: string) => call<CallshiftStatus>(clientId, '/status');

export const fetchCallshiftAgents = async (clientId: string) =>
  (await call<{ agents: CallshiftAgent[] }>(clientId, '/agents')).agents;

export const fetchCallshiftPhones = async (clientId: string) =>
  (await call<{ phones: CallshiftPhone[] }>(clientId, '/phones')).phones;

export const fetchCallshiftCampaigns = async (clientId: string) =>
  (await call<{ campaigns: CallshiftCampaign[] }>(clientId, '/campaigns')).campaigns;

export const launchCallshiftCampaign = (
  clientId: string,
  body: {
    name: string;
    agent_id: string;
    phone_id: string;
    start: boolean;
    scheduled_at?: number | null;
    contacts: CallshiftContactInput[];
  },
) => call<LaunchResult>(clientId, '/campaigns', { method: 'POST', body: JSON.stringify(body) });

export const setCallshiftCampaignActive = (clientId: string, campaignId: string, isActive: boolean) =>
  call<{ campaign_id: string; active: boolean }>(clientId, `/campaigns/${encodeURIComponent(campaignId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active: isActive }),
  });

export const deleteCallshiftCampaign = (clientId: string, campaignId: string) =>
  call<{ deleted: boolean; queued_calls_deleted: number | null; warnings: string[] }>(
    clientId,
    `/campaigns/${encodeURIComponent(campaignId)}`,
    { method: 'DELETE' },
  );
