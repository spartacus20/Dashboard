import { RetellCall, FilterCriteria, CallStats, RetellPhoneNumber, RetellAgent, RetellBatchCall, ClientData, Agenda, Callback, CallbackResponse, CallsByPhoneResponse } from './types';
import { get_client_id } from './lib/supabase';

// Obtener la URL base según el entorno
const IS_PRODUCTION = import.meta.env.VITE_PRODUCTION_API === 'on';
const BASE_URL = IS_PRODUCTION ? 'https://n8n.aiagencyusa.com/webhook/ed980be2-4957-44cf-8f61-8b8c4d4957e8' : 'https://api.iacreatorhub.com';
const WEBHOOK_URL = BASE_URL;
const GET_CLIENT_WEBHOOK_URL = IS_PRODUCTION ? 'https://n8n.aiagencyusa.com/webhook/get-client' : `${BASE_URL}/get-client`;
const GET_DASHBOARD_WEBHOOK_URL = `${BASE_URL}/api/dashboard/get-dashboard`;
const GET_AGENDAS_WEBHOOK_URL =  `${BASE_URL}/api/agenda/get-agenda`;
const API_URL = 'https://api.retellai.com/v2/list-calls';

// Función helper para obtener el client_id del localStorage
function getClientId(): string | null {
  return localStorage.getItem(get_client_id);
}

async function fetchAllCalls(
  apiKey: string,
  filterCriteria?: FilterCriteria,
  clientId?: string
): Promise<RetellCall[]> {
  let allCalls: RetellCall[] = [];
  let page = 1;
  let hasMore = true;
  let totalPages = 0;
  
  // Usar el client_id proporcionado o el del localStorage
  const actualClientId = clientId || getClientId();
  
  while (hasMore) {
    const response = await fetchCalls(apiKey, undefined, filterCriteria, page, actualClientId || undefined);
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
    
    // Incluir client_id si está disponible (usar el proporcionado o el del localStorage)
    const actualClientId = clientId || getClientId();
    if (actualClientId) {
      requestBody.client_id = actualClientId;
    }
    
    // Incluir filtros de fecha si están disponibles
    if (filterCriteria?.date_range) {
      if (filterCriteria.date_range.start) {
        // Usar el formato ISO completo si ya está en formato ISO, sino convertir
        if (filterCriteria.date_range.start.includes('T')) {
          requestBody.fecha_inicio = filterCriteria.date_range.start;
        } else {
          const startDate = new Date(filterCriteria.date_range.start);
          requestBody.fecha_inicio = startDate.toISOString();
        }
      }
      
      if (filterCriteria.date_range.end) {
        // Usar el formato ISO completo si ya está en formato ISO, sino convertir
        if (filterCriteria.date_range.end.includes('T')) {
          requestBody.fecha_fin = filterCriteria.date_range.end;
        } else {
          const endDate = new Date(filterCriteria.date_range.end);
          // Asegurar que incluya todo el día final
          endDate.setHours(23, 59, 59, 999);
          requestBody.fecha_fin = endDate.toISOString();
        }
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
export async function getClientApiKey(identifier: string): Promise<{ apiKey: string | null; clientId: string | null; config?: Record<string, any> }> {
  try {
    console.log('Solicitando API key para el identificador:', identifier);
    
    // Determinar si el identificador es un email o un client_id
    const isEmail = identifier.includes('@');
    const requestBody = isEmail ? { email: identifier } : { client_id: identifier };
    
    const response = await fetch(GET_CLIENT_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
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
        clientId: clientData.client_id || null,
        config: clientData.config ?? {
          agenda_enabled: clientData.agenda_enabled,
          calls_enabled: clientData.calls_enabled,
        }
      };
    }
    
    // Si no es un array, intentar obtener directamente
    if (data && typeof data === 'object') {
      return {
        apiKey: data.api_key || data.apiKey || null,
        clientId: data.client_id || data.clientId || null,
        config: data.config ?? {
          agenda_enabled: data.agenda_enabled,
          calls_enabled: data.calls_enabled,
        }
      };
    }
    
    console.warn('No se encontró información del cliente');
    return { apiKey: null, clientId: null };
  } catch (error) {
    console.error('Error al obtener API key del cliente:', error);
    return { apiKey: null, clientId: null };
  }
}

// Función para obtener datos del dashboard (endpoint genérico con fechas)
export async function getDashboardData(
  clientId?: string, 
  fechaInicio?: string, 
  fechaFin?: string
): Promise<any> {
  try {
    // Usar el client_id proporcionado o el del localStorage
    const actualClientId = clientId || getClientId();
    
    if (!actualClientId) {
      throw new Error('No se encontró client_id. Por favor, inicia sesión nuevamente.');
    }
    
    console.log('Solicitando datos del dashboard para client_id:', actualClientId);
    console.log('Fechas de filtro:', { fechaInicio, fechaFin });
    
    const requestBody: any = {
      client_id: actualClientId
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
    
    return transformDashboardData(data);
  } catch (error) {
    console.error('Error al obtener datos del dashboard:', error);
    throw error;
  }
}

// Función para obtener datos del dashboard de hoy
export async function getDashboardToday(clientId?: string): Promise<any> {
  try {
    const actualClientId = clientId || getClientId();
    
    if (!actualClientId) {
      throw new Error('No se encontró client_id. Por favor, inicia sesión nuevamente.');
    }
    
    console.log('Solicitando datos del dashboard de HOY para client_id:', actualClientId);
    
    const response = await fetch(`${BASE_URL}/api/dashboard/get-dashboard-today`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ client_id: actualClientId }),
    });

    if (!response.ok) {
      throw new Error(`Error al obtener datos del dashboard de hoy: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Respuesta del dashboard de hoy:', data);
    
    return transformDashboardData(data);
  } catch (error) {
    console.error('Error al obtener datos del dashboard de hoy:', error);
    throw error;
  }
}

// Función para obtener datos del dashboard de la semana
export async function getDashboardWeek(clientId?: string): Promise<any> {
  try {
    const actualClientId = clientId || getClientId();
    
    if (!actualClientId) {
      throw new Error('No se encontró client_id. Por favor, inicia sesión nuevamente.');
    }
    
    console.log('Solicitando datos del dashboard de la SEMANA para client_id:', actualClientId);
    
    const response = await fetch(`${BASE_URL}/api/dashboard/get-dashboard-week`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ client_id: actualClientId }),
    });

    if (!response.ok) {
      throw new Error(`Error al obtener datos del dashboard de la semana: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Respuesta del dashboard de la semana:', data);
    
    return transformDashboardData(data);
  } catch (error) {
    console.error('Error al obtener datos del dashboard de la semana:', error);
    throw error;
  }
}

// Función para obtener datos del dashboard del mes
export async function getDashboardMonth(clientId?: string): Promise<any> {
  try {
    const actualClientId = clientId || getClientId();
    
    if (!actualClientId) {
      throw new Error('No se encontró client_id. Por favor, inicia sesión nuevamente.');
    }
    
    console.log('Solicitando datos del dashboard del MES para client_id:', actualClientId);
    
    const response = await fetch(`${BASE_URL}/api/dashboard/get-dashboard-month`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ client_id: actualClientId }),
    });

    if (!response.ok) {
      throw new Error(`Error al obtener datos del dashboard del mes: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Respuesta del dashboard del mes:', data);
    
    return transformDashboardData(data);
  } catch (error) {
    console.error('Error al obtener datos del dashboard del mes:', error);
    throw error;
  }
}

// Función auxiliar para transformar los datos del dashboard
function transformDashboardData(data: any): any {
  if (data && typeof data === 'object') {
    console.log('Datos del dashboard recibidos:', data);
    
    // Transformar los datos al formato esperado por el frontend
    const transformedData = {
      dashboard_data: {
        metricas_generales: {
          total_llamadas: data.total_llamadas || 0,
          llamadas_efectivas: data.llamadas_efectivas || 0,
          llamadas_fallidas: data.llamadas_fallidas || 0,
          costo_total: data.costo_total || 0,
          total_agendamientos: data.total_agendamientos || 0,
          costo_por_agenda: data.costo_por_agenda || 0
        },
        // Transformar costos_por_dia a llamadas_por_dia
        llamadas_por_dia: data.costos_por_dia ? data.costos_por_dia.map((item: any) => ({
          fecha: item.fecha,
          dia_label: new Date(item.fecha).toLocaleDateString('es-ES', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric' 
          }),
          total_llamadas: Math.round(item.costo / 0.02), // Estimación basada en costo promedio por llamada
          costo_dia: item.costo,
          llamadas_efectivas: Math.round((item.costo / 0.02) * 0.2), // Estimación del 20% de efectividad
          llamadas_fallidas: Math.round((item.costo / 0.02) * 0.8) // Estimación del 80% de fallidas
        })) : [],
        // Transformar distribucion_por_hora a llamadas_por_hora
        llamadas_por_hora: data.distribucion_por_hora ? data.distribucion_por_hora.map((item: any) => ({
          hora: item.hora,
          hora_label: `${item.hora}:00`,
          llamadas_mas_16_segundos: item.cantidad_agendas * 5, // Estimación: 5 llamadas por agenda
          cantidad_agendas: item.cantidad_agendas
        })) : [],
        // Transformar razones_desconexion
        razones_desconexion: data.razones_desconexion ? data.razones_desconexion.map((item: any) => ({
          razon: item.razon,
          total: item.cantidad,
          porcentaje: ((item.cantidad / (data.total_llamadas || 1)) * 100).toFixed(2)
        })) : [],
        // Transformar tipos_vivienda
        tipos_vivienda: data.tipos_vivienda ? data.tipos_vivienda.map((item: any) => ({
          tipo: item.tipo,
          cantidad: item.cantidad,
          porcentaje: ((item.cantidad / (data.total_llamadas || 1)) * 100).toFixed(2)
        })) : [],
        // Transformar llamadas_efectivas_por_hora
        llamadas_efectivas_por_hora: data.llamadas_efectivas_por_hora ? data.llamadas_efectivas_por_hora.map((item: any) => ({
          hora: item.hora,
          hora_label: `${item.hora.toString().padStart(2, '0')}:00`,
          cantidad_llamadas: item.cantidad_llamadas || 0
        })) : []
      }
    };
    
    console.log('Datos transformados:', transformedData);
    return transformedData;
  }
  
  console.warn('Formato inesperado de respuesta del dashboard:', data);
  return data;
}

// Función para obtener todas las agendas con paginación
export async function fetchAllAgendas(
  clientId?: string, 
  searchTerm?: string, 
  filterType?: string, 
  dateFrom?: string, 
  dateTo?: string,
  sortOrder?: 'ASC' | 'DESC'
): Promise<Agenda[]> {
  try {
    // Usar el client_id proporcionado o el del localStorage
    const actualClientId = clientId || getClientId();
    
    if (!actualClientId) {
      throw new Error('No se encontró client_id. Por favor, inicia sesión nuevamente.');
    }
    
    console.log('Solicitando TODAS las agendas para client_id:', actualClientId);
    console.log('Filtros aplicados:', { searchTerm, filterType, dateFrom, dateTo, sortOrder });
    
    let allAgendas: Agenda[] = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
      const requestBody: any = {
        client_id: actualClientId,
        page: page,
        per_page: 100 // Máximo por página
      };
      
      // Agregar filtros si están disponibles
      if (searchTerm) {
        requestBody.search = searchTerm;
      }
      
      if (filterType && filterType !== 'all') {
        requestBody.tipo_agenda = filterType;
      }
      
      if (dateFrom) {
        requestBody.fecha_inicio = dateFrom;
      }
      
      if (dateTo) {
        requestBody.fecha_fin = dateTo;
      }
      
      if (sortOrder) {
        requestBody.sort_order = sortOrder;
      }
      
      console.log(`Página ${page}:`, requestBody);
      
      const response = await fetch(GET_AGENDAS_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error en la respuesta:', response.status, response.statusText, errorText);
        throw new Error(`Error al obtener agendas: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log(`Respuesta página ${page}:`, data);
      
      // Procesar la respuesta
      let agendas: Agenda[] = [];
      let responseData = data;
      
      // Si es un array, tomar el primer elemento
      if (Array.isArray(data)) {
        if (data.length > 0) {
          responseData = data[0];
        } else {
          console.log('Respuesta vacía');
          break;
        }
      }
      
      // Extraer las agendas del objeto de respuesta
      if (responseData && typeof responseData === 'object') {
        if (responseData.agendas && Array.isArray(responseData.agendas)) {
          agendas = responseData.agendas;
        } else if (responseData.agendamientos && Array.isArray(responseData.agendamientos)) {
          agendas = responseData.agendamientos;
        } else if (responseData.data && Array.isArray(responseData.data)) {
          agendas = responseData.data;
        } else if (responseData.agendas && !Array.isArray(responseData.agendas)) {
          // Si agendas no es un array, podría ser un objeto con paginación
          console.log('Estructura de respuesta inesperada:', responseData);
          break;
        }
      }
      
      console.log(`Página ${page}: ${agendas.length} agendas obtenidas`);
      
      // Si no obtuvimos agendas, probablemente es el final
      if (agendas.length === 0) {
        console.log('No se obtuvieron agendas en esta página, finalizando paginación');
        break;
      }
      
      // Agregar las agendas de esta página al total
      allAgendas = [...allAgendas, ...agendas];
      
      // Determinar si hay más páginas
      // Si obtenemos menos de 100 agendas, probablemente es la última página
      // También verificar si la respuesta indica el total de páginas
      const totalPages = data.total_paginas || data.totalPages || 0;
      const totalAgendas = data.total_agendas || data.totalAgendas || 0;
      
      console.log(`Página ${page}: ${agendas.length} agendas, Total páginas: ${totalPages}, Total agendas: ${totalAgendas}`);
      
      if (totalPages > 0) {
        // Si conocemos el total de páginas, usar esa información
        hasMore = page < totalPages;
      } else {
        // Si no conocemos el total, usar la heurística
        hasMore = agendas.length === 100;
      }
      
      if (hasMore) {
        page++;
        // Pequeña pausa para no sobrecargar el servidor
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Verificación de seguridad para evitar bucles infinitos
        if (page > 100) {
          console.warn('Límite de páginas alcanzado (100), deteniendo paginación');
          break;
        }
      }
    }
    
    console.log(`Total de agendas obtenidas: ${allAgendas.length}`);
    return allAgendas;
    
  } catch (error) {
    console.error('Error al obtener todas las agendas:', error);
    throw error;
  }
}

// Función para obtener agendas (versión original para la página)
export async function fetchAgendas(clientId?: string): Promise<Agenda[]> {
  try {
    // Usar el client_id proporcionado o el del localStorage
    const actualClientId = clientId || getClientId();
    
    if (!actualClientId) {
      throw new Error('No se encontró client_id. Por favor, inicia sesión nuevamente.');
    }
    
    console.log('Solicitando agendas para client_id:', actualClientId);
    console.log('URL del endpoint:', GET_AGENDAS_WEBHOOK_URL);
    
    const requestBody = {
      client_id: actualClientId
    };
    
    console.log('Body de la petición:', requestBody);
    
    const response = await fetch(GET_AGENDAS_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error en la respuesta:', response.status, response.statusText, errorText);
      throw new Error(`Error al obtener agendas: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Respuesta completa del webhook de agendas:', data);
    console.log('Tipo de respuesta:', typeof data, Array.isArray(data) ? 'Array' : 'Object');
    
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

// Función para importar un número de teléfono
export async function importPhoneNumber(
  apiKey: string,
  phoneData: {
    phone_number: string;
    termination_uri?: string;
    sip_trunk_auth_username?: string;
    sip_trunk_auth_password?: string;
    nickname?: string;
  }
): Promise<any> {
  try {
    console.log('Importando número de teléfono:', phoneData.phone_number);
    
    const response = await fetch('https://api.retellai.com/import-phone-number', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(phoneData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error en la respuesta:', response.status, response.statusText, errorText);
      throw new Error(`Error al importar número de teléfono: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Respuesta de importación:', data);
    
    return data;
  } catch (error) {
    console.error('Error al importar número de teléfono:', error);
    throw error;
  }
}

// Función para eliminar un número de teléfono
export async function deletePhoneNumber(
  apiKey: string,
  phoneNumber: string
): Promise<any> {
  try {
    console.log('Eliminando número de teléfono:', phoneNumber);
    
    const response = await fetch(`https://api.retellai.com/delete-phone-number/${phoneNumber}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error en la respuesta:', response.status, response.statusText, errorText);
      throw new Error(`Error al eliminar número de teléfono: ${response.status} ${response.statusText} - ${errorText}`);
    }

    // Para DELETE, la respuesta puede estar vacía (204 No Content)
    const data = response.status === 204 ? { success: true } : await response.json();
    console.log('Respuesta de eliminación:', data);
    
    return data;
  } catch (error) {
    console.error('Error al eliminar número de teléfono:', error);
    throw error;
  }
}

// Función para listar llamadas usando el endpoint list-calls con BASE_URL
export async function listCalls(
  apiKey: string,
  params: {
    client_id: string;
    from_number?: string;
    to_number?: string;
    status?: string;
    fecha_inicio?: string;
    fecha_fin?: string;
    sort_order?: 'ASC' | 'DESC';
    page?: number;
    per_page?: number;
  }
): Promise<{
  calls: RetellCall[];
  total_pages?: number;
  total_calls?: number;
  current_page?: number;
}> {
  try {
    if (!params?.client_id) {
      throw new Error('client_id es obligatorio para list-calls');
    }
    console.log('Solicitando llamadas con parámetros:', params);
    
    // Usar siempre el endpoint de iacreatorhub
    const url = `https://api.iacreatorhub.com/api/calls/list-calls`;
    
    console.log('URL de la petición:', url);
    console.log('Body de la petición:', params);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error en la respuesta:', response.status, response.statusText, errorText);
      throw new Error(`Error al obtener llamadas: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Respuesta del endpoint list-calls:', data);
    
    // Transformar las llamadas al formato RetellCall
    const calls: RetellCall[] = (data.calls || data.llamadas || []).map((call: any) => ({
      call_id: call.call_id || call.id || '',
      duration: parseInt(call.duration) || 0,
      start_time: call.created_at || call.start_time,
      start_timestamp: new Date(call.created_at || call.start_time).getTime(),
      end_timestamp: call.end_timestamp || (call.created_at && call.duration ? 
        new Date(call.created_at).getTime() + (parseInt(call.duration) * 1000) : 
        undefined),
      disconnection_reason: call.end_reason || call.disconnection_reason,
      status: call.status === 'fallida' ? 'failed' : (call.status || 'completed'),
      call_status: call.status === 'fallida' ? 'failed' : (call.status || 'completed'),
      transcript: call.transcript,
      recording_url: call.recordings || call.recording_url,
      to_number: call.phone_number || call.to_number,
      from_number: call.from_number,
      metadata: {
        id: call.id,
        client_id: call.client_id,
        summary: call.summary,
        interest: call.interest,
        tipo_vivienda: call.tipo_vivienda,
        created_at: call.created_at,
        end_reason: call.end_reason
      }
    }));
    
    return {
      calls,
      total_pages: data.total_pages || data.total_paginas,
      total_calls: data.total_calls || data.total_llamadas,
      current_page: data.current_page || data.pagina_actual || params.page || 1
    };
    
  } catch (error) {
    console.error('Error al obtener llamadas con list-calls:', error);
    throw error;
  }
}

// Función para obtener todas las llamadas usando list-calls con paginación automática
export async function fetchAllCallsWithListCalls(
  apiKey: string,
  params: {
    client_id?: string;
    from_number?: string;
    to_number?: string;
    status?: string;
    fecha_inicio?: string;
    fecha_fin?: string;
    sort_order?: 'ASC' | 'DESC';
  } = {}
): Promise<RetellCall[]> {
  try {
    console.log('Obteniendo todas las llamadas con list-calls:', params);
    
    let allCalls: RetellCall[] = [];
    let page = 1;
    let hasMore = true;
    let totalPages = 0;
    
    while (hasMore) {
      if (!params.client_id) {
        throw new Error('client_id es obligatorio para fetchAllCallsWithListCalls');
      }
      
      const response = await listCalls(apiKey, {
        ...params,
        client_id: params.client_id, // Asegurar que client_id esté definido
        page,
        per_page: 100 // Máximo por página
      });
      
      allCalls = [...allCalls, ...response.calls];
      
      // Si es la primera página, obtener el total de páginas
      if (page === 1 && response.total_pages) {
        totalPages = response.total_pages;
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
        // Pequeña pausa para no sobrecargar el servidor
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Verificación de seguridad para evitar bucles infinitos
        if (page > 100) {
          console.warn('Límite de páginas alcanzado (100), deteniendo paginación');
          break;
        }
      }
    }
    
    console.log(`Total de llamadas obtenidas con list-calls: ${allCalls.length}`);
    return allCalls;
    
  } catch (error) {
    console.error('Error al obtener todas las llamadas con list-calls:', error);
    throw error;
  }
}

// Función para obtener callbacks
export async function fetchCallbacks(
  clientId?: string,
  page: number = 1,
  limit: number = 100
): Promise<CallbackResponse> {
  try {
    // Usar el client_id proporcionado o el del localStorage
    const actualClientId = clientId || getClientId();
    
    if (!actualClientId) {
      throw new Error('No se encontró client_id. Por favor, inicia sesión nuevamente.');
    }
    
    console.log('Solicitando callbacks para client_id:', actualClientId);
    console.log('Página:', page, 'Límite:', limit);
    
    const requestBody = {
      client_id: actualClientId,
      page: page,
      limit: limit
    };
    
    const response = await fetch('https://api.iacreatorhub.com/api/calls/list-callback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error en la respuesta:', response.status, response.statusText, errorText);
      throw new Error(`Error al obtener callbacks: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data: CallbackResponse = await response.json();
    console.log('Respuesta del endpoint list-callback:', data);
    
    return data;
    
  } catch (error) {
    console.error('Error al obtener callbacks:', error);
    throw error;
  }
}

// Función para obtener todas las callbacks con paginación automática
export async function fetchAllCallbacks(
  clientId: string
): Promise<Callback[]> {
  try {
    console.log('Obteniendo todas las callbacks para client_id:', clientId);
    
    let allCallbacks: Callback[] = [];
    let page = 1;
    let hasMore = true;
    let totalPages = 0;
    
    while (hasMore) {
      const response = await fetchCallbacks(clientId, page, 100);
      
      allCallbacks = [...allCallbacks, ...response.callbacks];
      
      // Si es la primera página, obtener el total de páginas
      if (page === 1 && response.total_paginas) {
        totalPages = response.total_paginas;
      }
      
      // Determinar si hay más páginas
      if (totalPages > 0) {
        hasMore = page < totalPages;
      } else {
        // Si no conocemos el total, usar la heurística
        hasMore = response.callbacks.length === 100;
      }
      
      if (hasMore) {
        page++;
        // Pequeña pausa para no sobrecargar el servidor
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Verificación de seguridad para evitar bucles infinitos
        if (page > 100) {
          console.warn('Límite de páginas alcanzado (100), deteniendo paginación');
          break;
        }
      }
    }
    
    console.log(`Total de callbacks obtenidas: ${allCallbacks.length}`);
    return allCallbacks;
    
  } catch (error) {
    console.error('Error al obtener todas las callbacks:', error);
    throw error;
  }
}

export { fetchAllCalls };

// Obtener llamadas por número de teléfono
export async function getCallsByPhone(
  params: {
    phone_number: string;
    per_page?: number;
    page?: number;
    sort_order?: 'ASC' | 'DESC' | 'asc' | 'desc' | 'ASCENDING' | 'DESCENDING';
  }
): Promise<CallsByPhoneResponse> {
  try {
    const url = `https://api.iacreatorhub.com/api/calls/get-calls-by-phone`;
    const body = {
      phone_number: params.phone_number,
      per_page: params.per_page ?? 50,
      page: params.page ?? 1,
      sort_order: params.sort_order ?? 'DESC'
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error en get-calls-by-phone: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data: CallsByPhoneResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error al obtener llamadas por teléfono:', error);
    throw error;
  }
}