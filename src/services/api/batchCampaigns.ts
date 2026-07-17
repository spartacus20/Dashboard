// Cliente API de Campañas Programadas (Batch-Call-Service vía proxy de mas-sol).
// Todas las rutas: BASE_URL/api/batch/:clientId/* con Bearer de Supabase
// (el backend valida token + pertenencia del cliente + flag batch_campaigns).
import { BASE_URL } from './config';
import { authedFetch } from './http';
import type { BatchTaskInput } from '../../lib/parseBatchCsv';

// ── Tipos ───────────────────────────────────────────────────

export interface WorkspacePhoneNumber {
  id: string;
  number: string;
  label: string | null;
}

export interface WorkspaceAgent {
  id: string;
  retell_agent_id: string;
  name: string;
}

export interface BatchWorkspace {
  id: string;
  client_id: string | null;
  source_index: number | null;
  name: string;
  is_active: boolean;
  has_retell_api_key: boolean;
  active_number?: WorkspacePhoneNumber | null;
  active_agent?: WorkspaceAgent | null;
  // Listas completas (importadas de Retell) para elegir número/agente por campaña
  numbers?: WorkspacePhoneNumber[];
  agents?: WorkspaceAgent[];
}

export type BatchCampaignStatus = 'draft' | 'planned' | 'ongoing' | 'paused' | 'sent' | 'cancelled';

export interface CallWindow {
  windows: { start: number; end: number }[]; // minutos desde medianoche
  timezone: string;
  day: string[]; // nombres de día en inglés: Monday…
}

export interface BatchCampaign {
  id: string;
  workspace_id: string;
  name: string;
  from_number: string;
  override_agent_id: string | null;
  scheduled_at: number | null; // epoch ms
  call_window: CallWindow | null;
  status: BatchCampaignStatus;
  total_tasks: number;
  sent: number;
  picked_up: number;
  successful: number;
  failed: number;
  created_at: string;
  updated_at: string;
  tasks_by_status?: Record<string, number>;
}

export interface ReasonInfo {
  label: string;
  cause: string;
  severity: 'success' | 'info' | 'warning' | 'error';
}

export interface BatchTasksBreakdown {
  batch_id: string;
  status: BatchCampaignStatus;
  tasks: Record<string, number>;
  top_errors: { message: string; count: number }[];
  disconnection_breakdown: { reason: string; count: number }[];
  reason_info: Record<string, ReasonInfo>;
}

export interface CreateBatchCampaignPayload {
  workspace_id: string;
  name: string;
  tasks: BatchTaskInput[];
  from_number?: string;
  override_agent_id?: string;
  scheduled_at?: number | null;
  call_window?: CallWindow | null;
  // Opciones avanzadas (null/ausente = config por defecto del workspace)
  max_concurrency?: number | null;
  max_retry_attempts?: number | null; // 1 = sin reintentos
  retry_delay_no_answer?: number | null; // segundos
  retry_delay_voicemail?: number | null;
  retry_delay_busy?: number | null;
}

export interface WorkspaceConcurrency {
  current: number;
  limit: number;
  available: number;
}

// Concurrencia EN VIVO de la cuenta Retell del workspace
export function fetchWorkspaceConcurrency(clientId: string, workspaceId: string): Promise<WorkspaceConcurrency> {
  return request(`${clientId}/workspaces/${workspaceId}/concurrency`);
}

// ── Helpers ─────────────────────────────────────────────────

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await authedFetch(`${BASE_URL}/api/batch/${path}`, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string })?.error || `Error ${res.status}`);
  }
  return data as T;
}

// ── Endpoints ───────────────────────────────────────────────

export function fetchBatchWorkspaces(clientId: string): Promise<BatchWorkspace[]> {
  return request(`${clientId}/workspaces`);
}

// Sync INDIVIDUAL: importa números y agentes de Retell de UN workspace.
// La UI lo dispara al seleccionar un workspace que aún no los tiene —
// nunca se sincronizan todos de una (petición por workspace, bajo demanda).
export function syncBatchWorkspace(clientId: string, workspaceId: string): Promise<BatchWorkspace> {
  return request(`${clientId}/workspaces/${workspaceId}/sync`, { method: 'POST' });
}

export function fetchBatchCampaigns(
  clientId: string,
  opts: { status?: string; limit?: number; offset?: number; workspaceId?: string } = {}
): Promise<BatchCampaign[]> {
  const qs = new URLSearchParams();
  if (opts.status) qs.set('status', opts.status);
  // Scope por workspace: el front trae solo el workspace seleccionado (primero por
  // defecto) en vez de todos, para no saturar en clientes con muchos workspaces.
  if (opts.workspaceId) qs.set('workspace_id', opts.workspaceId);
  qs.set('limit', String(opts.limit ?? 100));
  qs.set('offset', String(opts.offset ?? 0));
  return request(`${clientId}/batches?${qs}`);
}

export function createBatchCampaign(
  clientId: string,
  payload: CreateBatchCampaignPayload
): Promise<{ batch_id: string; total_tasks: number }> {
  return request(`${clientId}/batches`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchBatchCampaign(clientId: string, batchId: string): Promise<BatchCampaign> {
  return request(`${clientId}/batches/${batchId}`);
}

export function fetchBatchTasksBreakdown(clientId: string, batchId: string): Promise<BatchTasksBreakdown> {
  return request(`${clientId}/batches/${batchId}/tasks`);
}

export interface BatchCampaignTask {
  id: string;
  to_number: string;
  status: string;
  attempts: number;
  retell_call_id: string | null;
  started_at: string | null;
  ended_at: string | null;
  disconnection_reason: string | null;
  error: string | null;
  dynamic_variables: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

// Lista de llamadas individuales de la campaña (paginada)
export function fetchBatchCampaignTasks(
  clientId: string,
  batchId: string,
  opts: { status?: string; limit?: number; offset?: number } = {}
): Promise<BatchCampaignTask[]> {
  const qs = new URLSearchParams();
  if (opts.status) qs.set('status', opts.status);
  qs.set('limit', String(opts.limit ?? 100));
  qs.set('offset', String(opts.offset ?? 0));
  return request(`${clientId}/batches/${batchId}/tasks/list?${qs}`);
}

export function pauseBatchCampaign(clientId: string, batchId: string) {
  return request<{ ok: boolean }>(`${clientId}/batches/${batchId}/pause`, { method: 'PATCH' });
}

export function resumeBatchCampaign(clientId: string, batchId: string) {
  return request<{ ok: boolean }>(`${clientId}/batches/${batchId}/resume`, { method: 'PATCH' });
}

export function cancelBatchCampaign(clientId: string, batchId: string) {
  return request<{ ok: boolean }>(`${clientId}/batches/${batchId}/cancel`, { method: 'DELETE' });
}

export function retryFailedBatchCampaign(clientId: string, batchId: string) {
  return request<{ retried: number }>(`${clientId}/batches/${batchId}/retry-failed`, { method: 'POST' });
}
