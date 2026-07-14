import { RetellBatchCall } from '../../types';
import { BASE_URL } from './config';
import { authHeaders } from './http';

const telephonyBase = (clientId: string) =>
  `${BASE_URL}/api/telephony/${encodeURIComponent(clientId)}`;

// ─────────────────────────────────────────────────────────────────────────────
// Obtiene todos los batch calls del cliente (todos los workspaces por defecto).
// Pasar workspaceIndex para filtrar a un workspace específico.
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchBatchCalls(
  clientId: string,
  workspaceIndex?: number
): Promise<RetellBatchCall[]> {
  const url = new URL(`${telephonyBase(clientId)}/batch-calls`);
  if (workspaceIndex !== undefined) url.searchParams.set('workspace_index', String(workspaceIndex));

  const response = await fetch(url.toString(), { headers: await authHeaders() });
  if (!response.ok) {
    throw new Error(`Error al obtener batch calls: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  return Array.isArray(result.data) ? result.data : [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Descarga el archivo de tareas de un batch call desde la URL que devuelve Retell.
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchBatchCallTasks(tasksUrl: string): Promise<any[]> {
  const response = await fetch(tasksUrl);
  if (!response.ok) {
    throw new Error(`Error al obtener tareas: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Crea un batch call.
// Body que espera el backend: { workspace_index?, from_number, tasks, name? }
// ─────────────────────────────────────────────────────────────────────────────
export async function createBatchCall(
  clientId: string,
  fromNumber: string,
  tasks: { to_number: string; retell_llm_dynamic_variables?: Record<string, any> }[],
  name?: string,
  workspaceIndex?: number
): Promise<any> {
  const response = await fetch(`${telephonyBase(clientId)}/batch-call`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({
      workspace_index: workspaceIndex ?? 0,
      from_number: fromNumber,
      tasks,
      ...(name && name.trim() ? { name: name.trim() } : {}),
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Error al crear batch call: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  return result.data ?? result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Obtiene el agent_id y agent_name de una llamada dentro del batch.
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchAgentIdForBatch(
  clientId: string,
  batchCallId: string,
  workspaceIndex?: number
): Promise<{ agent_id: string | null; agent_name: string | null }> {
  const url = new URL(`${telephonyBase(clientId)}/batch-call/${encodeURIComponent(batchCallId)}/agent`);
  if (workspaceIndex !== undefined) url.searchParams.set('workspace_index', String(workspaceIndex));

  try {
    const response = await fetch(url.toString(), { headers: await authHeaders() });
    if (!response.ok) return { agent_id: null, agent_name: null };
    const result = await response.json();
    return result.data ?? { agent_id: null, agent_name: null };
  } catch {
    return { agent_id: null, agent_name: null };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Elimina un batch call.
// ─────────────────────────────────────────────────────────────────────────────
export async function deleteBatchCall(
  clientId: string,
  batchCallId: string,
  workspaceIndex?: number
): Promise<any> {
  const url = new URL(`${telephonyBase(clientId)}/batch-call/${encodeURIComponent(batchCallId)}`);
  if (workspaceIndex !== undefined) url.searchParams.set('workspace_index', String(workspaceIndex));

  const response = await fetch(url.toString(), { method: 'DELETE', headers: await authHeaders() });

  if (response.status === 204) return { success: true };

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || `Error al eliminar batch call: ${response.status} ${response.statusText}`);
  }
  return result;
}
