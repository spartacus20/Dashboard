import { RetellBatchCall } from '../../types';

import { fetchBatchCalls } from '../api';



export async function fetchBatchCalls(
  apiKey: string
): Promise<RetellBatchCall[]> {
  if (!apiKey) {
    throw new Error('API key no proporcionada');
  }

  const response = await fetch('https://api.retellai.com/list-batch-call', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Error al obtener llamadas en lote: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  // Verificar si la respuesta es un array
  if (!Array.isArray(data)) {
    // console.error('La respuesta no es un array:', data);
    return [];
  }
  
  return data;
}



export async function fetchBatchCallTasks(tasksUrl: string): Promise<any[]> {
  const response = await fetch(tasksUrl);
  
  if (!response.ok) {
    throw new Error(`Error al obtener tareas: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  
  // Verificar si la respuesta es un array
  if (!Array.isArray(data)) {
    // console.error('La respuesta no es un array:', data);
    return [];
  }
  
  return data;
}



export async function createBatchCall(
  apiKey: string,
  fromNumber: string,
  tasks: { to_number: string; retell_llm_dynamic_variables?: Record<string, any> }[],
  name?: string
): Promise<any> {
  if (!apiKey) {
    throw new Error('API key no proporcionada');
  }

  const payload: {
    from_number: string;
    tasks: { to_number: string; retell_llm_dynamic_variables?: Record<string, any> }[];
    name?: string;
  } = {
    from_number: fromNumber,
    tasks: tasks
  };
  
  // Añadir el nombre si se proporciona
  if (name && name.trim() !== '') {
    payload.name = name.trim();
  }

  const response = await fetch('https://api.retellai.com/create-batch-call', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Error al crear batch call: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}



export async function fetchAgentIdForBatch(
  apiKey: string,
  batchCallId: string
): Promise<{ agent_id: string | null; agent_name: string | null }> {
  try {
    const callsRes = await fetch('https://api.retellai.com/v2/list-calls', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ filter_criteria: { batch_call_id: [batchCallId] }, limit: 1, sort_order: 'descending' }),
    });
    if (!callsRes.ok) return { agent_id: null, agent_name: null };
    const callsData = await callsRes.json();
    const calls = Array.isArray(callsData) ? callsData : (callsData.calls ?? []);
    const agent_id: string | null = calls[0]?.agent_id ?? null;
    if (!agent_id) return { agent_id: null, agent_name: null };

    const agentRes = await fetch(`https://api.retellai.com/get-agent/${agent_id}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    const agent_name: string | null = agentRes.ok ? ((await agentRes.json()).agent_name ?? null) : null;
    return { agent_id, agent_name };
  } catch {
    return { agent_id: null, agent_name: null };
  }
}



export async function deleteBatchCall(
  apiKey: string,
  batchCallId: string
): Promise<any> {
  if (!apiKey) {
    throw new Error('API key no proporcionada');
  }

  const response = await fetch(`https://api.retellai.com/delete-batch-call/${batchCallId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  // Status 204 significa éxito pero sin contenido para devolver (comportamiento normal en DELETE)
  if (response.status === 204) {
    // console.log('Batch call eliminado correctamente (status 204)');
    return { success: true, message: 'Batch call eliminado correctamente' };
  }

  if (!response.ok) {
    throw new Error(`Error al eliminar batch call: ${response.status} ${response.statusText}`);
  }

  // Intentar parsear la respuesta como JSON, si hay alguna
  try {
    return await response.json();
  } catch (err) {
    // Si no hay contenido para parsear pero la respuesta fue exitosa, devolver éxito
    return { success: true };
  }
}

