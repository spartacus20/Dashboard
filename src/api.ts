import { RetellCall, FilterCriteria, CallStats, RetellPhoneNumber, RetellAgent, RetellBatchCall } from './types';

const API_URL = 'https://api.retellai.com/v2/list-calls';

async function fetchAllCalls(
  apiKey: string,
  filterCriteria?: FilterCriteria
): Promise<RetellCall[]> {
  let allCalls: RetellCall[] = [];
  let paginationKey: string | undefined;
  
  do {
    const response = await fetchCalls(apiKey, paginationKey, filterCriteria);
    allCalls = [...allCalls, ...response.calls];
    paginationKey = response.pagination_key;
  } while (paginationKey);
  
  return allCalls;
}

export async function fetchCalls(
  apiKey: string,
  paginationKey?: string,
  filterCriteria?: FilterCriteria
): Promise<{ calls: RetellCall[]; pagination_key?: string }> {
  // Preparar el cuerpo de la petición con todos los parámetros
  const requestBody = {
    limit: 1000,
    pagination_key: paginationKey,
    sort_order: 'descending',
    filter_criteria: filterCriteria,
  };
  
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`Error al obtener llamadas: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  // Manejar el formato de respuesta
  // Si es un array, es la lista de llamadas directamente
  // Si es un objeto, buscamos la propiedad 'calls'
  const calls = Array.isArray(data) ? data : data.calls || [];
  
  return { 
    calls, 
    pagination_key: Array.isArray(data) ? 
      (calls.length > 0 ? calls[calls.length - 1].call_id : undefined) : 
      data.pagination_key 
  };
}

export function calculateStats(calls: RetellCall[]): CallStats {
  const total = calls.length;
  
  // Contar llamadas completadas y fallidas
  // Los estados de llamada pueden venir en diferentes formatos según la API
  const completed = calls.filter(call => {
    const status = (call.call_status || call.status || '').toLowerCase();
    return status === 'completed' || status === 'ended' || status === 'success';
  }).length;
  
  const failed = calls.filter(call => {
    const status = (call.call_status || call.status || '').toLowerCase();
    return status === 'failed' || status === 'error' || status === 'failed_to_start';
  }).length;
  
  // Calcular duración promedio
  let totalDuration = 0;
  let callsWithDuration = 0;
  
  calls.forEach(call => {
    // Usar la duración directa si está disponible
    if (call.duration) {
      totalDuration += call.duration;
      callsWithDuration++;
    } 
    // Si no, calcular la duración con los timestamps si están disponibles
    else if (call.start_timestamp && call.end_timestamp) {
      const duration = (call.end_timestamp - call.start_timestamp) / 1000; // convertir a segundos
      totalDuration += duration;
      callsWithDuration++;
    }
  });
  
  const avgDuration = callsWithDuration > 0 ? totalDuration / callsWithDuration : 0;
  
  // Formatear la duración promedio en minutos:segundos
  const minutes = Math.floor(avgDuration / 60);
  const seconds = Math.floor(avgDuration % 60);
  const averageDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  
  console.log('Estadísticas calculadas:', { total, completed, failed, averageDuration, callsWithDuration });
  
  return {
    total,
    completed,
    failed,
    averageDuration
  };
}

export async function fetchPhoneNumbers(apiKey: string): Promise<RetellPhoneNumber[]> {
  const response = await fetch('https://api.retellai.com/list-phone-numbers', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }
  });

  if (!response.ok) {
    throw new Error(`Error al obtener números de teléfono: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  // La respuesta debería ser un array de números de teléfono
  if (!Array.isArray(data)) {
    throw new Error('Formato de respuesta inesperado');
  }
  
  return data;
}

interface CreatePhoneCallParams {
  from_number: string;
  to_number: string;
  override_agent_id?: string;
  retell_llm_dynamic_variables?: Record<string, any>;
}

export async function createPhoneCall(apiKey: string, params: CreatePhoneCallParams): Promise<any> {
  const response = await fetch('https://api.retellai.com/v2/create-phone-call', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al crear llamada: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return await response.json();
}

export async function fetchAgents(apiKey: string): Promise<RetellAgent[]> {
  const response = await fetch('https://api.retellai.com/list-agents', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }
  });

  if (!response.ok) {
    throw new Error(`Error al obtener agentes: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  // La respuesta debería ser un array de agentes
  if (!Array.isArray(data)) {
    throw new Error('Formato de respuesta inesperado');
  }
  
  return data;
}

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
    console.error('La respuesta no es un array:', data);
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
    console.error('La respuesta no es un array:', data);
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
    console.log('Batch call eliminado correctamente (status 204)');
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

export { fetchAllCalls };