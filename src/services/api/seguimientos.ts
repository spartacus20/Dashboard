import { BASE_URL, getClientId } from './config';
import { authHeaders } from './http';

export interface CallBackRecord {
  id: number;
  created_at: string;
  updated_at: string | null;
  phone_number: string;
  client_id: string;
  call_id: string | null;
  nombre: string | null;
  last_name: string | null;
  direccion: string | null;
  ciudad: string | null;
  region: string | null;
  date_to_call: string | null;
  tipo_agenda: string | null;
  agent_id: string | null;
  metadata: Record<string, unknown> | null;
  intento_actual: number;
  max_intentos: number;
  contesto: boolean;
  status: 'pending' | 'answered' | 'exhausted' | 'cancelled';
  Llamado: string | null;
  batch_call_id: string | null;
}

export interface CampaignSummary {
  batch_call_id: string | null;
  campaign_name: string | null;
  total: number;
  pending: number;
  answered: number;
  exhausted: number;
  cancelled: number;
  scheduled_retries: number;
  next_retry_at: string | null;
  first_created: string;
  last_updated: string | null;
}

export interface CallBackListResponse {
  data: CallBackRecord[];
  total: number;
  page: number;
  per_page: number;
}

export interface RetellConfig {
  retell_api_key_set: boolean;
  retell_api_key_preview: string | null;
  retell_from_number: string | null;
  retell_delays: number[];
  retell_active_hours: number;
}

export async function listSeguimientos(
  clientId: string,
  params?: {
    status?: string;
    fecha_inicio?: string;
    fecha_fin?: string;
    batch_call_id?: string | null;
    page?: number;
    per_page?: number;
  }
): Promise<CallBackListResponse> {
  const response = await fetch(`${BASE_URL}/api/callback/list`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ client_id: clientId, ...params }),
  });
  if (!response.ok) throw new Error('Error al cargar seguimientos');
  return response.json();
}

export async function cancelAllPending(clientId: string): Promise<{ cancelled: number }> {
  const response = await fetch(`${BASE_URL}/api/callback/cancel-all`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ client_id: clientId }),
  });
  if (!response.ok) throw new Error('Error al cancelar pendientes');
  return response.json();
}

export async function bulkUpdateMaxIntentos(
  clientId: string,
  max_intentos: number,
  filters?: { status?: string; fecha_inicio?: string; fecha_fin?: string }
): Promise<{ updated: number }> {
  const response = await fetch(`${BASE_URL}/api/callback/bulk-update`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ client_id: clientId, max_intentos, ...filters }),
  });
  if (!response.ok) throw new Error('Error al actualizar en bulk');
  return response.json();
}

export async function updateSeguimiento(
  id: number,
  params: { max_intentos?: number; status?: string }
): Promise<void> {
  const response = await fetch(`${BASE_URL}/api/callback/update`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ id, client_id: getClientId(), ...params }),
  });
  if (!response.ok) throw new Error('Error al actualizar seguimiento');
}

export async function getRetellConfig(clientId: string): Promise<RetellConfig> {
  const response = await fetch(`${BASE_URL}/api/callback/config/get`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ client_id: clientId }),
  });
  if (!response.ok) throw new Error('Error al obtener configuración');
  return response.json();
}

export async function updateRetellConfig(
  clientId: string,
  data: { retell_api_key?: string; retell_from_number?: string; retell_delays?: number[]; retell_active_hours?: number }
): Promise<void> {
  const response = await fetch(`${BASE_URL}/api/callback/config/update`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ client_id: clientId, ...data }),
  });
  if (!response.ok) throw new Error('Error al guardar configuración');
}

export async function getCampaignsSummary(clientId: string): Promise<CampaignSummary[]> {
  const response = await fetch(`${BASE_URL}/api/callback/campaigns-summary`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ client_id: clientId }),
  });
  if (!response.ok) throw new Error('Error al cargar resumen de campañas');
  const data = await response.json();
  return data.data;
}

export async function saveBatchCallSettings(
  batchCallId: string,
  clientId: string,
  seguimiento: boolean,
  campaignName?: string
): Promise<void> {
  const response = await fetch(`${BASE_URL}/api/callback/batch-settings/save`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ batch_call_id: batchCallId, client_id: clientId, seguimiento, campaign_name: campaignName || null }),
  });
  if (!response.ok) throw new Error('Error al guardar configuración de seguimiento');
}

export async function listRetellPhoneNumbers(
  clientId: string,
  retellApiKey?: string
): Promise<string[]> {
  const response = await fetch(`${BASE_URL}/api/callback/phone-numbers`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ client_id: clientId, retell_api_key: retellApiKey || undefined }),
  });
  if (!response.ok) throw new Error('Error al obtener números de teléfono');
  const data = await response.json();
  return data.numbers ?? [];
}
