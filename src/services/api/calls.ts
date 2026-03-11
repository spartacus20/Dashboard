import { RetellCall, FilterCriteria, CallStats } from '../../types';
import { getClientId, BASE_URL, WEBHOOK_URL, API_URL } from './config';

import { fetchCalls } from '../api';



export interface CallCountByFromNumber {
  from_number: string;
  from_number_norm: string | null;
  total: number;
  fallidas: number;
  efectivas: number;
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
    
    // console.log('Enviando petición al webhook con:', requestBody);
    
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
    // console.log('Respuesta del webhook de llamadas:', data);
    
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
        // Mantener el metadata original de la llamada si existe, y agregar campos adicionales
        metadata: {
          ...webhookCall.metadata, // Preservar metadata original de la llamada
          // Agregar campos específicos de la base de datos como campos adicionales
          db_id: webhookCall.id,
          db_client_id: webhookCall.client_id,
          db_summary: webhookCall.summary,
          db_interest: webhookCall.interest,
          db_tipo_vivienda: webhookCall.tipo_vivienda,
          db_created_at: webhookCall.created_at,
          db_end_reason: webhookCall.end_reason
        }
      }));
      
      // console.log(`Página ${page}: ${calls.length} llamadas transformadas`);
      
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
    // console.warn('Formato de respuesta inesperado del webhook');
    return { calls: [], pagination_key: undefined };
    
  } catch (error) {
    // console.error('Error al obtener llamadas del webhook:', error);
    
    // Fallback a la API original de Retell si el webhook falla
    // console.log('Intentando con la API de Retell directamente...');
    
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
  
  // console.log('Estadísticas calculadas:', { total, completed, failed, averageDuration, averageDurationSeconds: Math.round(avgDuration), callsWithDuration });
  
  return {
    total,
    completed,
    failed,
    averageDuration,
    averageDurationSeconds: Math.round(avgDuration)
  };
}



// Función auxiliar para obtener nombre de workspace a partir de la URL del webhook (exportada para páginas como Campaña y PhoneNumbers)
export function getWorkspaceNameFromWebhook(webhookUrl?: string): string | null {
  if (!webhookUrl) return null;

  try {
    const url = new URL(webhookUrl);
    const segments = url.pathname.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1] || '';

    // Intentar cortar por "-workspace" o el typo "-worspace" si existe
    const workspaceSlug =
      lastSegment.split(/-workspace|-worspace/i)[0].trim() || lastSegment.trim();

    if (!workspaceSlug) return null;

    const prettyName = workspaceSlug
      .replace(/[-_]+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    return prettyName || null;
  } catch {
    return null;
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
    agent_id?: string;
    end_reason?: string;
    interest?: string;
    tipo_vivienda?: string;
    to_number_norm?: string;
    bdd?: string;
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
    // console.log('Solicitando llamadas con parámetros:', params);
    
    // Usar siempre el endpoint de iacreatorhub
    const url = `${BASE_URL}/api/calls/list-calls`;
    
    // console.log('URL de la petición:', url);
    // console.log('Body de la petición:', params);
    
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
      // console.error('Error en la respuesta:', response.status, response.statusText, errorText);
      throw new Error(`Error al obtener llamadas: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    // console.log('Respuesta del endpoint list-calls:', data);
    
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
      agent_id: call.agent_id, // Incluir agent_id del backend
      tipo_vivienda: call.tipo_vivienda, // Incluir tipo_vivienda del backend
      metadata: call.metadata || {}
    }));
    
    return {
      calls,
      total_pages: data.total_pages || data.total_paginas,
      total_calls: data.total_calls || data.total_llamadas,
      current_page: data.current_page || data.pagina_actual || params.page || 1
    };
    
  } catch (error) {
    // console.error('Error al obtener llamadas con list-calls:', error);
    throw error;
  }
}



// Nuevo: listar TODAS las llamadas (sin paginación) para exportación usando backend propio
export async function listAllCalls(
  apiKey: string,
  params: {
    client_id: string;
    from_number?: string;
    to_number?: string;
    status?: string;
    fecha_inicio?: string; // Debe venir en ISO UTC o con sufijo 'Z'
    fecha_fin?: string;    // Debe venir en ISO UTC o con sufijo 'Z'
    sort_order?: 'ASC' | 'DESC';
  }
): Promise<{ calls: RetellCall[]; total_calls: number }>{
  try {
    if (!params?.client_id) throw new Error('client_id es obligatorio para listAllCalls');
    const url = `${BASE_URL}/api/calls/list-calls-all`;
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
      throw new Error(`Error en listAllCalls: ${response.status} ${response.statusText} - ${errorText}`);
    }
    const data = await response.json();
    // Transformar a RetellCall[]
    const calls: RetellCall[] = (data.llamadas || data.calls || []).map((call: any) => ({
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
      metadata: call.metadata || {}
    }));
    return { calls, total_calls: data.total_llamadas || calls.length };
  } catch (error) {
    // console.error('Error en listAllCalls:', error);
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
    // console.log('Obteniendo todas las llamadas con list-calls:', params);
    
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
          // console.warn('Límite de páginas alcanzado (100), deteniendo paginación');
          break;
        }
      }
    }
    
    // console.log(`Total de llamadas obtenidas con list-calls: ${allCalls.length}`);
    return allCalls;
    
  } catch (error) {
    // console.error('Error al obtener todas las llamadas con list-calls:', error);
    throw error;
  }
}


// Obtener todos los motivos de desconexión únicos
export async function getDisconnectionReasons(
  apiKey: string,
  clientId: string
): Promise<string[]> {
  try {
    if (!clientId) {
      throw new Error('client_id es obligatorio para getDisconnectionReasons');
    }
    
    // console.log('🔍 Obteniendo motivos de desconexión para client_id:', clientId);
    
    const url = `${BASE_URL}/api/calls/get-disconnection-reasons`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ client_id: clientId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error al obtener motivos de desconexión: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    // console.log('✅ Motivos de desconexión obtenidos para client_id:', data.client_id || clientId);
    if (data.client_id && data.client_id !== clientId) {
      // console.warn('⚠️ Advertencia: El client_id de la respuesta no coincide con el solicitado');
    }
    
    return data.disconnection_reasons || [];
  } catch (error) {
    // console.error('❌ Error al obtener motivos de desconexión:', error);
    throw error;
  }
}

export async function getCallCountsByFromNumber(clientId: string): Promise<CallCountByFromNumber[]> {
  try {
    const response = await fetch(`${BASE_URL}/api/calls/call-counts-by-from-number`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error en call-counts-by-from-number: ${response.status} ${response.statusText} - ${errorText}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    // console.error('Error al obtener conteos por número:', error);
    throw error;
  }
}

export async function exportCallsWithColumns(
  apiKey: string,
  params: {
    client_id: string;
    columns: string[];
    fecha_inicio?: string;
    fecha_fin?: string;
    from_number?: string;
    to_number?: string;
    to_number_norm?: string;
    status?: string;
    interest?: string;
    tipo_vivienda?: string;
    end_reason?: string;
    bdd?: string;
    sort_order?: 'ASC' | 'DESC';
  }
): Promise<{ calls: any[]; total_llamadas: number; columns_selected: string[] }> {
  try {
    if (!params?.client_id) {
      throw new Error('client_id es obligatorio para exportCallsWithColumns');
    }
    
    if (!params?.columns || params.columns.length === 0) {
      throw new Error('Debe seleccionar al menos una columna para exportar');
    }
    
    // console.log('Exportando llamadas con columnas seleccionadas:', params);
    
    const url = `${BASE_URL}/api/calls/export-calls-with-columns`;
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
      throw new Error(`Error en exportCallsWithColumns: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    // console.log('Llamadas exportadas con columnas:', data);
    
    return {
      calls: data.llamadas || [],
      total_llamadas: data.total_llamadas || 0,
      columns_selected: data.columns_selected || params.columns
    };
  } catch (error) {
    // console.error('Error al exportar llamadas con columnas:', error);
    throw error;
  }
}
