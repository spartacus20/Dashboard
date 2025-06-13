import { RetellCall, FilterCriteria, CallStats, RetellPhoneNumber, RetellAgent, RetellBatchCall, ClientData, Agenda } from './types';

const WEBHOOK_URL = 'https://n8n.aiagencyusa.com/webhook/ed980be2-4957-44cf-8f61-8b8c4d4957e8';
const GET_CLIENT_WEBHOOK_URL = 'https://n8n.aiagencyusa.com/webhook/get-client';
const GET_DASHBOARD_WEBHOOK_URL = 'https://n8n.aiagencyusa.com/webhook/get-dashboard';
const GET_AGENDAS_WEBHOOK_URL = 'https://n8n.aiagencyusa.com/webhook/get-agendas';
const API_URL = 'https://api.retellai.com/v2/list-calls';

async function fetchAllCalls(
  apiKey: string,
  filterCriteria?: FilterCriteria,
  clientId?: string
): Promise<RetellCall[]> {
  let allCalls: RetellCall[] = [];
  let page = 1;
  let hasMore = true;
  let totalPages = 0;
  
  while (hasMore) {
    const response = await fetchCalls(apiKey, undefined, filterCriteria, page, clientId);
    allCalls = [...allCalls, ...response.calls];
    
    // Si es la primera página, obtener el total de páginas
    if (page === 1 && response.totalPages) {
      totalPages = response.totalPages;
    }
    
    // Determinar si hay más páginas
    if (totalPages > 0) {
      hasMore = page < totalPages;
    } else {
      // Si no conocemos el total, usar la heurística
      hasMore = response.calls.length === 100;
    }
    
    if (hasMore) {
      page++;
    }
  }
  
  return allCalls;
}

export async function fetchCalls(
  apiKey: string,
  paginationKey?: string,
  filterCriteria?: FilterCriteria,
  page: number = 1,
  clientId?: string
): Promise<{ calls: RetellCall[]; pagination_key?: string; totalPages?: number; totalCallsFiltered?: number | null }> {
  try {
    // Usar el webhook de n8n para obtener las llamadas
    const requestBody: any = {
      per_page: 100,
      page: page
    };
    
    // Incluir client_id si está disponible
    if (clientId) {
      requestBody.client_id = clientId;
    }
    
    // Incluir filtros de fecha si están disponibles
    if (filterCriteria?.date_range) {
      if (filterCriteria.date_range.start) {
        // Convertir a formato ISO si no lo está
        const startDate = new Date(filterCriteria.date_range.start);
        requestBody.fecha_inicio = startDate.toISOString().split('T')[0];
      }
      
      if (filterCriteria.date_range.end) {
        // Convertir a formato ISO si no lo está
        const endDate = new Date(filterCriteria.date_range.end);
        // Asegurar que incluya todo el día final
        endDate.setHours(23, 59, 59, 999);
        requestBody.fecha_fin = endDate.toISOString().split('T')[0];
      }
    }
    
    console.log('Enviando petición al webhook con:', requestBody);
    
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Error al obtener llamadas: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Respuesta del webhook de llamadas:', data);
    
    // El webhook devuelve un array con un objeto que contiene las llamadas
    if (Array.isArray(data) && data.length > 0) {
      const responseData = data[0];
      
      // Transformar las llamadas del formato del webhook al formato RetellCall
      const calls: RetellCall[] = (responseData.llamadas || []).map((webhookCall: any) => ({
        call_id: webhookCall.call_id || webhookCall.id || '',
        duration: parseInt(webhookCall.duration) || 0,
        start_time: webhookCall.created_at,
        start_timestamp: new Date(webhookCall.created_at).getTime(),
        end_timestamp: webhookCall.end_timestamp || (webhookCall.created_at && webhookCall.duration ? 
          new Date(webhookCall.created_at).getTime() + (parseInt(webhookCall.duration) * 1000) : 
          undefined),
        disconnection_reason: webhookCall.end_reason,
        status: webhookCall.status === 'fallida' ? 'failed' : (webhookCall.status || 'completed'),
        call_status: webhookCall.status === 'fallida' ? 'failed' : (webhookCall.status || 'completed'),
        transcript: webhookCall.transcript,
        recording_url: webhookCall.recordings,
        to_number: webhookCall.phone_number,
        metadata: {
          id: webhookCall.id,
          client_id: webhookCall.client_id,
          summary: webhookCall.summary,
          interest: webhookCall.interest,
          tipo_vivienda: webhookCall.tipo_vivienda,
          created_at: webhookCall.created_at,
          end_reason: webhookCall.end_reason
        }
      }));
      
      console.log(`Página ${page}: ${calls.length} llamadas transformadas`);
      
      // Obtener información de paginación
      const totalPages = parseInt(responseData.total_paginas) || 0;
      const totalCallsFiltered = responseData.total_llamadas || null;
      
      return { 
        calls, 
        pagination_key: undefined, // El webhook usa paginación por página
        totalPages: totalPages,
        totalCallsFiltered: totalCallsFiltered
      };
    }
    
    // Si no es el formato esperado, devolver array vacío
    console.warn('Formato de respuesta inesperado del webhook');
    return { calls: [], pagination_key: undefined };
    
  } catch (error) {
    console.error('Error al obtener llamadas del webhook:', error);
    
    // Fallback a la API original de Retell si el webhook falla
    console.log('Intentando con la API de Retell directamente...');
    
    const requestBody = {
      limit: 100,
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
    const calls = Array.isArray(data) ? data : data.calls || [];
    
    return { 
      calls, 
      pagination_key: Array.isArray(data) ? 
        (calls.length > 0 ? calls[calls.length - 1].call_id : undefined) : 
        data.pagination_key 
    };
  }
}

export function calculateStats(calls: RetellCall[]): CallStats {
  const total = calls.length;
  
  // Contar llamadas efectivas y fallidas
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
    // Usar la duración directa si está disponible (viene en milisegundos del webhook)
    if (call.duration) {
      totalDuration += call.duration / 1000; // Convertir de milisegundos a segundos
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
  
  console.log('Estadísticas calculadas:', { total, completed, failed, averageDuration, averageDurationSeconds: Math.round(avgDuration), callsWithDuration });
  
  return {
    total,
    completed,
    failed,
    averageDuration,
    averageDurationSeconds: Math.round(avgDuration)
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

// Función para obtener la API key del cliente
export async function getClientApiKey(email: string): Promise<{ apiKey: string | null; clientId: string | null }> {
  try {
    console.log('Solicitando API key para el email:', email);
    
    const response = await fetch(GET_CLIENT_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email
      }),
    });

    if (!response.ok) {
      throw new Error(`Error al obtener API key: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Respuesta del webhook:', data);
    
    // El webhook devuelve un array con los datos del cliente
    if (Array.isArray(data) && data.length > 0) {
      const clientData: ClientData = data[0];
      console.log('Cliente encontrado:', {
        client_id: clientData.client_id,
        email: clientData.email,
        full_name: clientData.full_name || 'Sin nombre'
      });
      return {
        apiKey: clientData.api_key || null,
        clientId: clientData.client_id || null
      };
    }
    
    // Si no es un array, intentar obtener directamente
    if (data && typeof data === 'object') {
      return {
        apiKey: data.api_key || data.apiKey || null,
        clientId: data.client_id || data.clientId || null
      };
    }
    
    console.warn('No se encontró información del cliente');
    return { apiKey: null, clientId: null };
  } catch (error) {
    console.error('Error al obtener API key del cliente:', error);
    return { apiKey: null, clientId: null };
  }
}

// Función para obtener datos del dashboard
export async function getDashboardData(
  clientId: string, 
  fechaInicio?: string, 
  fechaFin?: string
): Promise<any> {
  try {
    console.log('Solicitando datos del dashboard para client_id:', clientId);
    console.log('Fechas de filtro:', { fechaInicio, fechaFin });
    
    const requestBody: any = {
      client_id: clientId
    };
    
    // Agregar fechas al body si se proporcionan
    if (fechaInicio && fechaFin) {
      requestBody.fecha_inicio = fechaInicio;
      requestBody.fecha_fin = fechaFin;
    }
    
    const response = await fetch(GET_DASHBOARD_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Error al obtener datos del dashboard: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Respuesta completa del webhook dashboard:', data);
    
    // El webhook devuelve un array con los datos
    if (Array.isArray(data) && data.length > 0) {
      const dashboardResponse = data[0];
      console.log('Objeto dashboard extraído:', dashboardResponse);
      
      if (dashboardResponse.dashboard_data) {
        console.log('Dashboard data encontrado:', dashboardResponse.dashboard_data);
        console.log('Métricas generales:', dashboardResponse.dashboard_data.metricas_generales);
        console.log('Razones de desconexión:', dashboardResponse.dashboard_data.razones_desconexion);
        console.log('Llamadas por día:', dashboardResponse.dashboard_data.llamadas_por_dia);
        console.log('Llamadas por hora:', dashboardResponse.dashboard_data.llamadas_por_hora);
        
        return dashboardResponse; // Retorna todo el objeto que incluye dashboard_data
      } else {
        console.warn('No se encontró dashboard_data en la respuesta');
        return dashboardResponse;
      }
    }
    
    console.warn('Formato inesperado de respuesta del dashboard:', data);
    return data;
  } catch (error) {
    console.error('Error al obtener datos del dashboard:', error);
    throw error;
  }
}

// Función para obtener agendas
export async function fetchAgendas(clientId: string): Promise<Agenda[]> {
  try {
    console.log('Solicitando agendas para client_id:', clientId);
    
    const response = await fetch(GET_AGENDAS_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId
      }),
    });

    if (!response.ok) {
      throw new Error(`Error al obtener agendas: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Respuesta completa del webhook de agendas:', data);
    
    // Manejar diferentes formatos de respuesta posibles
    let agendas: Agenda[] = [];
    
    if (Array.isArray(data)) {
      if (data.length > 0) {
        const firstItem = data[0];
        // Si el primer elemento tiene una propiedad 'agendas'
        if (firstItem && typeof firstItem === 'object' && firstItem.agendas) {
          agendas = Array.isArray(firstItem.agendas) ? firstItem.agendas : [];
        }
        // Si el primer elemento tiene una propiedad 'agendamientos' 
        else if (firstItem && typeof firstItem === 'object' && firstItem.agendamientos) {
          agendas = Array.isArray(firstItem.agendamientos) ? firstItem.agendamientos : [];
        }
        // Si el array contiene directamente las agendas
        else if (firstItem && firstItem.id) {
          agendas = data;
        }
        // Si es un objeto que contiene las agendas como array
        else {
          agendas = [];
        }
      }
    }
    // Si la respuesta es un objeto directamente
    else if (data && typeof data === 'object') {
      if (data.agendas && Array.isArray(data.agendas)) {
        agendas = data.agendas;
      } else if (data.agendamientos && Array.isArray(data.agendamientos)) {
        agendas = data.agendamientos;
      } else {
        agendas = [];
      }
    }
    
    console.log(`Se procesaron ${agendas.length} agendas`);
    console.log('Agendas procesadas:', agendas);
    
    // Asegurar que devolvemos un array válido
    return Array.isArray(agendas) ? agendas : [];
    
  } catch (error) {
    console.error('Error al obtener agendas del webhook:', error);
    // En caso de error, devolver array vacío en lugar de lanzar la excepción
    return [];
  }
}

export { fetchAllCalls };