import { BASE_URL } from './config';
import { authHeaders } from './http';

export interface RetellAgent {
  agent_id: string;
  agent_name: string;
  response_engine?: {
    type: string;
    llm_id: string;
  };
  voice_id?: string;
  language?: string;
  [key: string]: unknown;
}

export interface RetellLLMState {
  name: string;
  state_prompt: string;
  edges?: Array<{ description: string; destination_state_name: string; speak_during_transition: boolean }>;
  tools?: unknown[];
}

export interface RetellLLM {
  llm_id: string;
  general_prompt?: string;
  begin_message?: string;
  states?: RetellLLMState[];
  starting_state?: string;
  [key: string]: unknown;
}

export async function fetchAgentsList(clientId: string, workspaceIndex = 0): Promise<RetellAgent[]> {
  const response = await fetch(
    `${BASE_URL}/api/agents/${encodeURIComponent(clientId)}/list?workspaceIndex=${workspaceIndex}`,
    { headers: await authHeaders() }
  );
  const data = await response.json();
  if (!data.success) throw new Error(data.error || 'Error al obtener los agentes');
  return data.agents as RetellAgent[];
}

export async function fetchAgentLLM(clientId: string, llmId: string, workspaceIndex = 0): Promise<RetellLLM> {
  const response = await fetch(
    `${BASE_URL}/api/agents/${encodeURIComponent(clientId)}/llm/${encodeURIComponent(llmId)}?workspaceIndex=${workspaceIndex}`,
    { headers: await authHeaders() }
  );
  const data = await response.json();
  if (!data.success) throw new Error(data.error || 'Error al obtener el LLM');
  return data.llm;
}

export async function updateAgentLLM(
  clientId: string,
  llmId: string,
  updates: Record<string, unknown>,
  workspaceIndex = 0
): Promise<RetellLLM> {
  const response = await fetch(
    `${BASE_URL}/api/agents/${encodeURIComponent(clientId)}/llm/${encodeURIComponent(llmId)}`,
    {
      method: 'PATCH',
      headers: await authHeaders(),
      body: JSON.stringify({ workspaceIndex, ...updates }),
    }
  );
  const data = await response.json();
  if (!data.success) throw new Error(data.error || 'Error al actualizar el LLM');
  return data.llm;
}
