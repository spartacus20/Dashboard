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

export interface RetellLLMEdge {
  description: string;
  destination_state_name: string;
  speak_during_transition?: boolean;
  [key: string]: unknown;
}

export interface RetellLLMState {
  name: string;
  state_prompt: string;
  edges?: RetellLLMEdge[];
  tools?: Array<{ name?: string; type?: string; description?: string; [key: string]: unknown }>;
}

export interface RetellLLM {
  llm_id: string;
  general_prompt?: string | null;
  begin_message?: string | null;
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

// El listado solo trae un resumen: response_engine, voice_id y language vienen de acá.
export async function fetchAgentDetail(clientId: string, agentId: string, workspaceIndex = 0): Promise<RetellAgent> {
  const response = await fetch(
    `${BASE_URL}/api/agents/${encodeURIComponent(clientId)}/agent/${encodeURIComponent(agentId)}?workspaceIndex=${workspaceIndex}`,
    { headers: await authHeaders() }
  );
  const data = await response.json();
  if (!data.success) throw new Error(data.error || 'Error al obtener el agente');
  return data.agent as RetellAgent;
}

export interface RetellVoice {
  voice_id: string;
  voice_name: string;
  provider?: string;
  gender?: string;
  accent?: string;
}

export async function fetchVoices(clientId: string, workspaceIndex = 0): Promise<RetellVoice[]> {
  const response = await fetch(
    `${BASE_URL}/api/agents/${encodeURIComponent(clientId)}/voices?workspaceIndex=${workspaceIndex}`,
    { headers: await authHeaders() }
  );
  const data = await response.json();
  if (!data.success) throw new Error(data.error || 'Error al obtener las voces');
  return data.voices as RetellVoice[];
}

export interface CreateAgentInput {
  agent_name: string;
  voice_id: string;
  language: string;
  start_speaker: 'agent' | 'user';
  with_stages: boolean;
  webhook_from_agent_id?: string;
}

export async function createAgent(clientId: string, input: CreateAgentInput, workspaceIndex = 0): Promise<RetellAgent> {
  const response = await fetch(
    `${BASE_URL}/api/agents/${encodeURIComponent(clientId)}/create`,
    {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ workspaceIndex, ...input }),
    }
  );
  const data = await response.json();
  if (!data.success) throw new Error(data.error || 'Error al crear el agente');
  return data.agent as RetellAgent;
}

export async function duplicateAgent(
  clientId: string,
  agentId: string,
  agentName: string,
  workspaceIndex = 0
): Promise<RetellAgent> {
  const response = await fetch(
    `${BASE_URL}/api/agents/${encodeURIComponent(clientId)}/agent/${encodeURIComponent(agentId)}/duplicate`,
    {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ workspaceIndex, agent_name: agentName }),
    }
  );
  const data = await response.json();
  if (!data.success) throw new Error(data.error || 'Error al duplicar el agente');
  return data.agent as RetellAgent;
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
