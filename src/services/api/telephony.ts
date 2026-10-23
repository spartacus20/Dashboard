import { RetellPhoneNumber } from '../../types';
import { BASE_URL } from './config';
import { getWorkspaceNameFromWebhook } from './calls';
import { authHeaders } from './http';

interface CreatePhoneCallParams {
  from_number: string;
  to_number: string;
  override_agent_id?: string;
  retell_llm_dynamic_variables?: Record<string, any>;
}

// ─── Números de teléfono ──────────────────────────────────────────────────────

// Obtiene todos los números del cliente (todos los workspaces) via backend proxy.
// El backend enriquece cada número con workspace_index.
export async function fetchPhoneNumbers(clientId: string): Promise<RetellPhoneNumber[]> {
  const response = await fetch(
    `${BASE_URL}/api/telephony/${encodeURIComponent(clientId)}/phone-numbers`,
    { headers: await authHeaders() }
  );

  if (!response.ok) {
    throw new Error(`Error al obtener números de teléfono: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  const items: any[] = result.data || [];

  return items.map((phone) => ({
    ...phone,
    workspace_name: phone.workspace_name || getWorkspaceNameFromWebhook(phone.inbound_webhook_url) || undefined,
  }));
}

// ─── Llamadas de prueba ───────────────────────────────────────────────────────

export async function createPhoneCall(
  clientId: string,
  params: CreatePhoneCallParams,
  workspaceIndex = 0
): Promise<any> {
  const response = await fetch(
    `${BASE_URL}/api/telephony/${encodeURIComponent(clientId)}/phone-call`,
    {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ workspace_index: workspaceIndex, ...params }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al crear llamada: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const result = await response.json();
  return result.data || result;
}

// ─── Importar número ──────────────────────────────────────────────────────────

export async function importPhoneNumber(
  clientId: string,
  phoneData: {
    phone_number: string;
    termination_uri?: string;
    sip_trunk_auth_username?: string;
    sip_trunk_auth_password?: string;
    nickname?: string;
    [key: string]: any;
  },
  workspaceIndex = 0
): Promise<any> {
  const response = await fetch(
    `${BASE_URL}/api/telephony/${encodeURIComponent(clientId)}/import-phone-number`,
    {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ workspace_index: workspaceIndex, ...phoneData }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al importar número de teléfono: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const result = await response.json();
  return result.data || result;
}

// ─── Actualizar número ────────────────────────────────────────────────────────

export async function updatePhoneNumber(
  clientId: string,
  phoneNumber: string,
  data: {
    nickname?: string | null;
    inbound_webhook_url?: string | null;
    inbound_sms_webhook_url?: string | null;
    fallback_number?: string | null;
    allowed_inbound_country_list?: string[] | null;
    allowed_outbound_country_list?: string[] | null;
    termination_uri?: string;
    auth_username?: string;
    auth_password?: string;
    transport?: string | null;
    inbound_agents?: { agent_id: string; weight: number }[] | null;
    outbound_agents?: { agent_id: string; weight: number }[] | null;
  },
  workspaceIndex = 0
): Promise<any> {
  const response = await fetch(
    `${BASE_URL}/api/telephony/${encodeURIComponent(clientId)}/phone-number/${encodeURIComponent(phoneNumber)}`,
    {
      method: 'PATCH',
      headers: await authHeaders(),
      body: JSON.stringify({ workspace_index: workspaceIndex, ...data }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al actualizar número: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const result = await response.json();
  return result.data || result;
}

// ─── Eliminar número ──────────────────────────────────────────────────────────

export async function deletePhoneNumber(
  clientId: string,
  phoneNumber: string,
  workspaceIndex = 0
): Promise<any> {
  const response = await fetch(
    `${BASE_URL}/api/telephony/${encodeURIComponent(clientId)}/phone-number/${encodeURIComponent(phoneNumber)}?workspace_index=${workspaceIndex}`,
    {
      method: 'DELETE',
      headers: await authHeaders(),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al eliminar número de teléfono: ${response.status} ${response.statusText} - ${errorText}`);
  }

  if (response.status === 204) return { success: true };
  const result = await response.json();
  return result.data || result;
}
