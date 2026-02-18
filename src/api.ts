import { RetellCall, FilterCriteria, CallStats, RetellPhoneNumber, RetellAgent, RetellBatchCall, ClientData, Agenda, Callback, CallbackResponse, CallsByPhoneResponse, RetellFolder } from './types';
import { get_client_id } from './lib/supabase';

// Obtener la URL base según el entorno
const IS_PRODUCTION = import.meta.env.VITE_PRODUCTION_API === 'true';
const BASE_PROD = import.meta.env.VITE_BASE_PROD;
const BASE_DEV = import.meta.env.VITE_BASE_DEV;
const BASE_URL = IS_PRODUCTION ? BASE_PROD : BASE_DEV;


const WEBHOOK_URL = BASE_URL;
const GET_CLIENT_WEBHOOK_URL = `${BASE_URL}/get-client`;
const GET_DASHBOARD_WEBHOOK_URL = `${BASE_URL}/api/dashboard/get-dashboard`;
const GET_DASHBOARD_CUSTOM_WEBHOOK_URL = `${BASE_URL}/api/dashboard/get-dashboard-custom`;
const GET_AGENDAS_WEBHOOK_URL =  `${BASE_URL}/api/agenda/get-agenda`;
const DELETE_AGENDA_WEBHOOK_URL = `${BASE_URL}/api/agenda/delete`;
const AVERAGE_CALLS_PER_AGENDA_URL = `${BASE_URL}/api/agenda/average-calls-per-agenda`;
const API_URL = 'https://api.retellai.com/v2/list-calls';
const ASISTENCIA_FUNNEL_URL = `${BASE_URL}/api/asistencia/funnel`;

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

// Función auxiliar para obtener nombre de workspace a partir de la URL del webhook
function getWorkspaceNameFromWebhook(webhookUrl?: string): string | null {
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

// Función para obtener números de teléfono de una sola API key
async function fetchPhoneNumbersFromSingleApiKey(apiKey: string): Promise<RetellPhoneNumber[]> {
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

// Función principal para obtener números de teléfono de una o múltiples API keys
export async function fetchPhoneNumbers(apiKey: string | string[]): Promise<RetellPhoneNumber[]> {
  // Si es un array, obtener números de todas las API keys y combinarlos
  if (Array.isArray(apiKey)) {
    console.log(`📞 Obteniendo números de teléfono de ${apiKey.length} API keys`);
    
    // Obtener números de todas las API keys en paralelo y adjuntar metadata de workspace
    const results = await Promise.all(
      apiKey.map(async (key) => {
        const numbers = await fetchPhoneNumbersFromSingleApiKey(key).catch((err) => {
          console.error(
            `❌ Error obteniendo números de teléfono para API key ${key.substring(0, 10)}...:`,
            err
          );
          return [] as RetellPhoneNumber[]; // Devolver array vacío en caso de error para no romper el flujo
        });

        return numbers.map((phone) => {
          const workspaceName = getWorkspaceNameFromWebhook(phone.inbound_webhook_url);
          return {
            ...phone,
            workspace_api_key: key,
            workspace_name: workspaceName || undefined,
          };
        });
      })
    );
    
    // Combinar todos los resultados y eliminar duplicados por phone_number
    const allNumbers = results.flat();
    const uniqueNumbers = Array.from(
      new Map(allNumbers.map(phone => [phone.phone_number, phone])).values()
    );
    
    console.log(`✅ Total de números únicos obtenidos: ${uniqueNumbers.length}`);
    return uniqueNumbers;
  }
  
  // Si es una sola API key, usar la función original y adjuntar metadata de workspace
  const numbers = await fetchPhoneNumbersFromSingleApiKey(apiKey);
  return numbers.map((phone) => {
    const workspaceName = getWorkspaceNameFromWebhook(phone.inbound_webhook_url);
    return {
      ...phone,
      workspace_api_key: apiKey,
      workspace_name: workspaceName || undefined,
    };
  });
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

export async function fetchFolders(apiKey: string): Promise<RetellFolder[]> {
  const response = await fetch('https://api.retellai.com/get-folders', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al obtener folders: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error('Formato de respuesta inesperado al obtener folders');
  }

  return data;
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
export async function getClientApiKey(identifier: string): Promise<{ apiKey: string | null; apiKeyTest?: string[] | null; clientId: string | null; permissions?: Record<string, any> | null; config?: Record<string, any> }> {
  try {
    console.log('Solicitando API key para el identificador:', identifier);
    
    // Determinar si el identificador es un email o un client_id
    const isEmail = identifier.includes('@');
    const requestBody = isEmail ? { email: identifier } : { client_id: identifier };
    console.log('🔍 DEBUG - Variables de entorno:');
    console.log('VITE_PRODUCTION_API:', import.meta.env.VITE_PRODUCTION_API);
    console.log('VITE_BASE_PROD:', import.meta.env.VITE_BASE_PROD);
    console.log('VITE_BASE_DEV:', import.meta.env.VITE_BASE_DEV);
    console.log('BASE_URL que se está usando:', BASE_URL); // si usas la config que te pasé
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
      
      // Guardar metadata_llamadas en sessionStorage si está disponible
      if (clientData.metadata_llamadas) {
        sessionStorage.setItem('metadata_llamadas', JSON.stringify(clientData.metadata_llamadas));
        console.log('✅ metadata_llamadas guardado en sessionStorage');
      }

      // Guardar metadata (incluye filtro_solar y otros permisos de módulos) en sessionStorage
      if (clientData.metadata) {
        sessionStorage.setItem('metadata', JSON.stringify(clientData.metadata));
        console.log('✅ metadata guardado en sessionStorage para client_id:', clientData.client_id);
        // Notificar al resto de la app que el metadata cambió (por ejemplo, al cambiar de client_id)
        window.dispatchEvent(
          new CustomEvent('metadataUpdated', {
            detail: { metadata: clientData.metadata },
          })
        );
      } else {
        // Si no hay metadata, limpiar y notificar
        sessionStorage.removeItem('metadata');
        window.dispatchEvent(
          new CustomEvent('metadataUpdated', {
            detail: { metadata: null },
          })
        );
      }

      // Guardar uri_retell (URIs de terminación) en sessionStorage si está disponible
      if (clientData.uri_retell) {
        let uriRetell: string[] | null = null;
        if (Array.isArray(clientData.uri_retell)) {
          uriRetell = clientData.uri_retell;
        } else if (typeof clientData.uri_retell === 'string') {
          try {
            const parsed = JSON.parse(clientData.uri_retell);
            if (Array.isArray(parsed)) {
              uriRetell = parsed.filter((v): v is string => typeof v === 'string');
            }
          } catch (e) {
            console.warn('Error parseando uri_retell (string) desde get-client:', e);
          }
        }

        if (uriRetell && uriRetell.length > 0) {
          sessionStorage.setItem('uri_retell', JSON.stringify(uriRetell));
          console.log('✅ uri_retell guardado en sessionStorage:', uriRetell);
        }
      }
      
      // Guardar client_test SOLO si se está obteniendo por email (no por client_id)
      // Esto preserva el client_test original del usuario cuando se cambia el client_id
      const isEmail = identifier.includes('@');
      if (isEmail && clientData.client_test) {
        sessionStorage.setItem('client_test', JSON.stringify(clientData.client_test));
        // También guardar en localStorage para persistencia
        localStorage.setItem('user_client_test', JSON.stringify(clientData.client_test));
        console.log('✅ client_test guardado en sessionStorage y localStorage (obtenido por email):', clientData.client_test);
      } else if (!isEmail) {
        // Si se está obteniendo por client_id, NO sobrescribir el client_test original
        // Restaurar desde localStorage si existe
        const savedClientTest = localStorage.getItem('user_client_test');
        if (savedClientTest) {
          sessionStorage.setItem('client_test', savedClientTest);
          console.log('✅ client_test restaurado desde localStorage (no sobrescribir al cambiar client_id)');
        } else {
          console.log('ℹ️ No hay client_test guardado, manteniendo el actual');
        }
      }
      
      // Guardar permissions SOLO si no existen ya en sessionStorage (evitar sobrescribir en refresh)
      const existingPermissions = sessionStorage.getItem('permissions');
      if (!existingPermissions) {
        // Solo actualizar si no existen permissions previos
        if (clientData.permissions && typeof clientData.permissions === 'object') {
          const permissionsKeys = Object.keys(clientData.permissions);
          if (permissionsKeys.length > 0) {
            // Si tiene al menos una propiedad, guardarlo
            sessionStorage.setItem('permissions', JSON.stringify(clientData.permissions));
            console.log('✅ permissions guardado en sessionStorage:', clientData.permissions);
          } else {
            // Si es un objeto vacío, no guardar nada
            sessionStorage.removeItem('permissions');
            console.log('ℹ️ Permissions vacío del servidor, usuario sin limitaciones');
          }
        } else if (clientData.permissions === null || clientData.permissions === undefined) {
          // Si es null o undefined, no guardar nada
          sessionStorage.removeItem('permissions');
          console.log('ℹ️ No hay permissions definidos, usuario sin limitaciones');
        }
      } else {
        console.log('ℹ️ Permissions ya existen en sessionStorage, no se sobrescriben para evitar problemas de seguridad');
      }
      
      console.log('🔧 Configuración construida:', {
        metadata: clientData.metadata,
        permissions: clientData.permissions,
        config: {
          sales: clientData.metadata?.sales,
          agenda: clientData.metadata?.agenda,
          num_tel: clientData.metadata?.num_tel,
          records: clientData.metadata?.records,
          callbacks: clientData.metadata?.callbacks,
          launch: clientData.metadata?.launch,
          dont_call: clientData.metadata?.dont_call,
        }
      });
      
      // Determinar qué API keys usar: api_key_test si está disponible, sino api_key
      const apiKeyTest = clientData.api_key_test && Array.isArray(clientData.api_key_test) && clientData.api_key_test.length > 0
        ? clientData.api_key_test
        : null;

      return {
        apiKey: clientData.api_key || null,
        apiKeyTest: apiKeyTest,
        clientId: clientData.client_id || null,
        permissions: clientData.permissions || null,
        config: clientData.config ?? {
          agenda_enabled: clientData.agenda_enabled,
          calls_enabled: clientData.calls_enabled,
          sales: clientData.metadata?.sales,
          agenda: clientData.metadata?.agenda,
          num_tel: clientData.metadata?.num_tel,
          records: clientData.metadata?.records,
          callbacks: clientData.metadata?.callbacks,
          launch: clientData.metadata?.launch,
          dont_call: clientData.metadata?.dont_call,
        }
      };
    }
    
    // Si no es un array, intentar obtener directamente
    if (data && typeof data === 'object') {
      // Guardar metadata_llamadas en sessionStorage si está disponible
      if (data.metadata_llamadas) {
        sessionStorage.setItem('metadata_llamadas', JSON.stringify(data.metadata_llamadas));
        console.log('✅ metadata_llamadas guardado en sessionStorage (formato objeto)');
      }

      // Guardar metadata (incluye filtro_solar y otros permisos de módulos) en sessionStorage
      if ((data as any).metadata) {
        const metadata = (data as any).metadata;
        sessionStorage.setItem('metadata', JSON.stringify(metadata));
        console.log('✅ metadata guardado en sessionStorage (formato objeto)');
        window.dispatchEvent(
          new CustomEvent('metadataUpdated', {
            detail: { metadata },
          })
        );
      } else {
        sessionStorage.removeItem('metadata');
        window.dispatchEvent(
          new CustomEvent('metadataUpdated', {
            detail: { metadata: null },
          })
        );
      }

      // Guardar uri_retell (URIs de terminación) en sessionStorage si está disponible - formato objeto
      if (data.uri_retell) {
        let uriRetell: string[] | null = null;
        if (Array.isArray(data.uri_retell)) {
          uriRetell = data.uri_retell;
        } else if (typeof data.uri_retell === 'string') {
          try {
            const parsed = JSON.parse(data.uri_retell);
            if (Array.isArray(parsed)) {
              uriRetell = parsed.filter((v): v is string => typeof v === 'string');
            }
          } catch (e) {
            console.warn('Error parseando uri_retell (string, formato objeto) desde get-client:', e);
          }
        }

        if (uriRetell && uriRetell.length > 0) {
          sessionStorage.setItem('uri_retell', JSON.stringify(uriRetell));
          console.log('✅ uri_retell guardado en sessionStorage (formato objeto):', uriRetell);
        }
      }
      
      // Guardar client_test SOLO si se está obteniendo por email (no por client_id)
      // Esto preserva el client_test original del usuario cuando se cambia el client_id
      const isEmail = identifier.includes('@');
      if (isEmail && data.client_test) {
        sessionStorage.setItem('client_test', JSON.stringify(data.client_test));
        // También guardar en localStorage para persistencia
        localStorage.setItem('user_client_test', JSON.stringify(data.client_test));
        console.log('✅ client_test guardado en sessionStorage y localStorage (formato objeto, obtenido por email):', data.client_test);
      } else if (!isEmail) {
        // Si se está obteniendo por client_id, NO sobrescribir el client_test original
        // Restaurar desde localStorage si existe
        const savedClientTest = localStorage.getItem('user_client_test');
        if (savedClientTest) {
          sessionStorage.setItem('client_test', savedClientTest);
          console.log('✅ client_test restaurado desde localStorage (formato objeto, no sobrescribir al cambiar client_id)');
        } else {
          console.log('ℹ️ No hay client_test guardado, manteniendo el actual');
        }
      }
      
      // Guardar permissions SOLO si no existen ya en sessionStorage (evitar sobrescribir en refresh)
      const existingPermissions = sessionStorage.getItem('permissions');
      if (!existingPermissions) {
        // Solo actualizar si no existen permissions previos
        if (data.permissions && typeof data.permissions === 'object') {
          const permissionsKeys = Object.keys(data.permissions);
          if (permissionsKeys.length > 0) {
            // Si tiene al menos una propiedad, guardarlo
            sessionStorage.setItem('permissions', JSON.stringify(data.permissions));
            console.log('✅ permissions guardado en sessionStorage (formato objeto):', data.permissions);
          } else {
            // Si es un objeto vacío, no guardar nada
            sessionStorage.removeItem('permissions');
            console.log('ℹ️ Permissions vacío del servidor (formato objeto), usuario sin limitaciones');
          }
        } else if (data.permissions === null || data.permissions === undefined) {
          // Si es null o undefined, no guardar nada
          sessionStorage.removeItem('permissions');
          console.log('ℹ️ No hay permissions definidos (formato objeto), usuario sin limitaciones');
        }
      } else {
        console.log('ℹ️ Permissions ya existen en sessionStorage, no se sobrescriben para evitar problemas de seguridad');
      }
      
      // Determinar qué API keys usar: api_key_test si está disponible, sino api_key
      const apiKeyTest = data.api_key_test && Array.isArray(data.api_key_test) && data.api_key_test.length > 0
        ? data.api_key_test
        : null;

      return {
        apiKey: data.api_key || data.apiKey || null,
        apiKeyTest: apiKeyTest,
        clientId: data.client_id || data.clientId || null,
        permissions: data.permissions || null,
        config: data.config ?? {
          agenda_enabled: data.agenda_enabled,
          calls_enabled: data.calls_enabled,
          sales: data.metadata?.sales,
          agenda: data.metadata?.agenda,
          num_tel: data.metadata?.num_tel,
          records: data.metadata?.records,
          callbacks: data.metadata?.callbacks,
          launch: data.metadata?.launch,
          dont_call: data.metadata?.dont_call,
        }
      };
    }
    
    console.warn('No se encontró información del cliente');
    return { apiKey: null, apiKeyTest: null, clientId: null, permissions: null };
  } catch (error) {
    console.error('Error al obtener API key del cliente:', error);
    return { apiKey: null, clientId: null, permissions: null };
  }
}

// Función para obtener datos del dashboard (endpoint genérico con fechas)
export async function getDashboardData(
  clientId?: string, 
  fechaInicio?: string, 
  fechaFin?: string,
  bdd?: string
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
    
    // Completar fechaFin si sólo viene fechaInicio
    let effectiveFechaInicio = fechaInicio;
    let effectiveFechaFin = fechaFin;
    if (effectiveFechaInicio && !effectiveFechaFin) {
      effectiveFechaFin = new Date().toISOString();
    }
    
    // Agregar fechas al body si se proporcionan (tras autocompletar)
    if (effectiveFechaInicio) requestBody.fecha_inicio = effectiveFechaInicio;
    if (effectiveFechaFin) requestBody.fecha_fin = effectiveFechaFin;
    
    // Agregar filtro de base de datos si se proporciona
    if (bdd && bdd.trim()) {
      requestBody.bdd = bdd.trim();
    }
    
    // Usar endpoint custom cuando hay al menos fechaInicio
    const url = (effectiveFechaInicio)
      ? GET_DASHBOARD_CUSTOM_WEBHOOK_URL
      : GET_DASHBOARD_WEBHOOK_URL;

    const response = await fetch(url, {
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

// Nuevo: obtener datos del dashboard usando el endpoint custom explícitamente
export async function getDashboardCustom(
  clientId?: string,
  fechaInicio?: string,
  fechaFin?: string,
  bdd?: string
): Promise<any> {
  try {
    const actualClientId = clientId || getClientId();
    if (!actualClientId) {
      throw new Error('No se encontró client_id. Por favor, inicia sesión nuevamente.');
    }

    if (!fechaInicio || !fechaFin) {
      throw new Error('fecha_inicio y fecha_fin son requeridas para getDashboardCustom');
    }

    const requestBody: any = {
      client_id: actualClientId,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin
    };
    
    // Agregar filtro de base de datos si se proporciona
    if (bdd && bdd.trim()) {
      requestBody.bdd = bdd.trim();
    }

    const response = await fetch(GET_DASHBOARD_CUSTOM_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Error al obtener datos del dashboard custom: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return transformDashboardData(data);
  } catch (error) {
    console.error('Error en getDashboardCustom:', error);
    throw error;
  }
}

// Función para obtener datos del dashboard de hoy
export async function getDashboardToday(clientId?: string, bdd?: string): Promise<any> {
  try {
    const actualClientId = clientId || getClientId();
    
    if (!actualClientId) {
      throw new Error('No se encontró client_id. Por favor, inicia sesión nuevamente.');
    }
    
    console.log('Solicitando datos del dashboard de HOY para client_id:', actualClientId);
    
    const requestBody: any = { client_id: actualClientId };
    if (bdd && bdd.trim()) {
      requestBody.bdd = bdd.trim();
    }
    
    const response = await fetch(`${BASE_URL}/api/dashboard/get-dashboard-today`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
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

// Obtener distribución de clicks de asistencia por hora
export async function fetchAsistenciaClicksByHour(
  fechaInicio?: string,
  fechaFin?: string
): Promise<{ hora: number; clicks_totales: number }[]> {
  try {
    const url = `${BASE_URL}/api/asistencia/clicks-by-hour`;
    const body: any = {
      client_id: getClientId()
    };

    if (fechaInicio) body.fecha_inicio = fechaInicio;
    if (fechaFin) body.fecha_fin = fechaFin;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Error en fetchAsistenciaClicksByHour: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Error al obtener métricas de asistencia por hora');
    }

    return data.data || [];
  } catch (error) {
    console.error('Error al obtener métricas de asistencia por hora:', error);
    throw error;
  }
}

// Obtener métricas de funnel (links -> clics -> asistencia webinar)
export async function fetchAsistenciaFunnelMetrics(params?: {
  region?: string;
  pais?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
}): Promise<{
  success: boolean;
  filters_applied: {
    region: string | null;
    pais: string | null;
    fecha_inicio: string | null;
    fecha_fin: string | null;
  };
  totals: {
    total_links: number;
    total_clicks: number;
    total_attendance: number;
    total_links_unique: number;
    total_clicks_from_links: number;
    total_clicks_raw: number;
    total_attendance_from_clicks: number;
    total_attendance_from_links: number;
    pct_clicks_over_links: number;
    pct_attendance_over_clicks: number;
    pct_attendance_over_links: number;
  };
  funnel_by_phone: Array<{
    phone_norm: string;
    phone_examples: {
      links: string | null;
      asistencia: string | null;
      webinar: string | null;
    };
    has_link: boolean;
    has_click: boolean;
    has_webinar: boolean;
    campaña: string | null;
    region: string | null;
    pais: string | null;
  }>;
  no_match_records: Array<{
    source_table: string;
    phone_number: string | null;
    campaña: string | null;
    region: string | null;
    pais: string | null;
    reason: string;
    category?: string;
  }>;
}> {
  try {
    const body: any = {
      client_id: getClientId()
    };

    if (params?.region) body.region = params.region;
    if (params?.pais) body.pais = params.pais;
    if (params?.fecha_inicio) body.fecha_inicio = params.fecha_inicio;
    if (params?.fecha_fin) body.fecha_fin = params.fecha_fin;

    const response = await fetch(ASISTENCIA_FUNNEL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Error en fetchAsistenciaFunnelMetrics: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Error al obtener el funnel de asistencia');
    }
    return data;
  } catch (error) {
    console.error('Error al obtener funnel de asistencia:', error);
    throw error;
  }
}

// Función para obtener datos del dashboard de la semana
export async function getDashboardWeek(clientId?: string, bdd?: string): Promise<any> {
  try {
    const actualClientId = clientId || getClientId();
    
    if (!actualClientId) {
      throw new Error('No se encontró client_id. Por favor, inicia sesión nuevamente.');
    }
    
    console.log('Solicitando datos del dashboard de la SEMANA para client_id:', actualClientId);
    
    const requestBody: any = { client_id: actualClientId };
    if (bdd && bdd.trim()) {
      requestBody.bdd = bdd.trim();
    }
    
    const response = await fetch(`${BASE_URL}/api/dashboard/get-dashboard-week`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
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
export async function getDashboardMonth(clientId?: string, bdd?: string): Promise<any> {
  try {
    const actualClientId = clientId || getClientId();
    
    if (!actualClientId) {
      throw new Error('No se encontró client_id. Por favor, inicia sesión nuevamente.');
    }
    
    console.log('Solicitando datos del dashboard del MES para client_id:', actualClientId);
    
    const requestBody: any = { client_id: actualClientId };
    if (bdd && bdd.trim()) {
      requestBody.bdd = bdd.trim();
    }
    
    const response = await fetch(`${BASE_URL}/api/dashboard/get-dashboard-month`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
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
          total_duration_seconds: data.total_duration_seconds || 0,
          total_duration_minutes: data.total_duration_seconds ? Math.round((data.total_duration_seconds || 0) / 60) : 0,
          total_agendamientos: data.total_agendamientos || 0,
          costo_por_agenda: data.costo_por_agenda || 0
        },
        // Transformar llamadas_por_dia reales si están disponibles; si no, hacer fallback a costos_por_dia
        llamadas_por_dia: (() => {
          const agendasPorDiaMap = new Map<string, number>();
          if (Array.isArray(data.agendas_por_dia)) {
            data.agendas_por_dia.forEach((apd: any) => {
              if (apd && apd.fecha) {
                agendasPorDiaMap.set(apd.fecha, Number(apd.total_agendamientos) || 0);
              }
            });
          }

          if (Array.isArray(data.llamadas_por_dia) && data.llamadas_por_dia.length > 0) {
            return data.llamadas_por_dia.map((item: any) => {
              const fecha = item.fecha;
              const totalAgendamientos = agendasPorDiaMap.get(fecha) || 0;
              
              // Parsear fecha como fecha local (no UTC) para evitar desplazamientos de día
              let diaLabel = '';
              if (fecha) {
                const fechaParts = fecha.toString().split('T')[0].split('-');
                if (fechaParts.length === 3) {
                  const [year, month, day] = fechaParts.map(Number);
                  const fechaLocal = new Date(year, month - 1, day);
                  diaLabel = fechaLocal.toLocaleDateString('es-ES', { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric',
                    timeZone: 'Europe/Madrid'
                  });
                } else {
                  diaLabel = fecha;
                }
              }
              
              return {
                fecha,
                dia_label: diaLabel,
                total_llamadas: Number(item.total_llamadas) || 0,
                llamadas_efectivas: Number(item.llamadas_efectivas) || 0,
                llamadas_fallidas: Number(item.llamadas_fallidas) || 0,
                costo_dia: Number(item.costo_dia) || 0,
                total_agendamientos: totalAgendamientos
              };
            });
          }

          // Fallback antiguo basado en costos_por_dia si no hay llamadas_por_dia en la respuesta
          if (Array.isArray(data.costos_por_dia) && data.costos_por_dia.length > 0) {
            return data.costos_por_dia.map((item: any) => {
              const fecha = item.fecha;
              const totalAgendamientos = agendasPorDiaMap.get(fecha) || 0;

              // Parsear fecha como fecha local (no UTC) para evitar desplazamientos de día
              let diaLabel = '';
              if (fecha) {
                const fechaParts = fecha.toString().split('T')[0].split('-');
                if (fechaParts.length === 3) {
                  const [year, month, day] = fechaParts.map(Number);
                  const fechaLocal = new Date(year, month - 1, day);
                  diaLabel = fechaLocal.toLocaleDateString('es-ES', { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric',
                    timeZone: 'Europe/Madrid'
                  });
                } else {
                  diaLabel = fecha;
                }
              }

              return {
                fecha,
                dia_label: diaLabel,
                total_llamadas: Math.round(item.costo / 0.02),
                costo_dia: item.costo,
                llamadas_efectivas: Math.round((item.costo / 0.02) * 0.2),
                llamadas_fallidas: Math.round((item.costo / 0.02) * 0.8),
                total_agendamientos: totalAgendamientos
              };
            });
          }

          return [];
        })(),
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
        // Transformar tipos_vivienda (por llamadas)
        tipos_vivienda: data.tipos_vivienda ? data.tipos_vivienda.map((item: any) => ({
          tipo: item.tipo,
          cantidad: item.cantidad,
          porcentaje: ((item.cantidad / (data.total_llamadas || 1)) * 100).toFixed(2)
        })) : [],
        // Transformar tipos_vivienda_agendas (por agendas)
        tipos_vivienda_agendas: data.tipos_vivienda_agendas ? data.tipos_vivienda_agendas.map((item: any) => ({
          tipo: item.tipo,
          cantidad: item.cantidad,
          porcentaje: ((item.cantidad / (data.total_agendamientos || 1)) * 100).toFixed(2)
        })) : [],
        // Transformar interes
        interes: data.interes ? data.interes.map((item: any) => ({
          interes: item.interes,
          cantidad: item.cantidad,
          porcentaje: ((item.cantidad / (data.total_llamadas || 1)) * 100).toFixed(2)
        })) : [],
        // Transformar llamadas_efectivas_por_hora
        llamadas_efectivas_por_hora: data.llamadas_efectivas_por_hora ? data.llamadas_efectivas_por_hora.map((item: any) => ({
          hora: item.hora,
          hora_label: `${item.hora.toString().padStart(2, '0')}:00`,
          cantidad_llamadas: item.cantidad_llamadas || 0
        })) : [],
        // Transformar duracion_llamadas_efectivas
        duracion_llamadas_efectivas: data.duracion_llamadas_efectivas ? {
          rango_0_30: data.duracion_llamadas_efectivas.rango_0_30 || 0,
          rango_30_50: data.duracion_llamadas_efectivas.rango_30_50 || 0,
          rango_50_plus: data.duracion_llamadas_efectivas.rango_50_plus || 0
        } : null,
        // Transformar agentes_por_agendas
        agentes_por_agendas: data.agentes_por_agendas ? data.agentes_por_agendas.map((item: any) => ({
          agent_id: item.agent_id,
          cantidad_agendas: item.cantidad_agendas || 0
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
  sortOrder?: 'ASC' | 'DESC',
  agentId?: string
): Promise<Agenda[]> {
  try {
    // Usar el client_id proporcionado o el del localStorage
    const actualClientId = clientId || getClientId();
    
    if (!actualClientId) {
      throw new Error('No se encontró client_id. Por favor, inicia sesión nuevamente.');
    }
    
    console.log('Solicitando TODAS las agendas para client_id:', actualClientId);
    console.log('Filtros aplicados:', { searchTerm, filterType, dateFrom, dateTo, sortOrder, agentId });
    
    let allAgendas: Agenda[] = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
      const requestBody: any = {
        client_id: actualClientId,
        page: page,
        per_page: 10000 // Aumentado a 10000 para obtener todas las agendas en menos peticiones
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
      
      if (agentId) {
        requestBody.agent_id = agentId;
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
      // Si obtenemos menos de 10000 agendas, probablemente es la última página
      // También verificar si la respuesta indica el total de páginas
      const totalPages = data.total_paginas || data.totalPages || 0;
      const totalAgendas = data.total_agendas || data.totalAgendas || 0;
      
      console.log(`Página ${page}: ${agendas.length} agendas, Total páginas: ${totalPages}, Total agendas: ${totalAgendas}`);
      
      if (totalPages > 0) {
        // Si conocemos el total de páginas, usar esa información
        hasMore = page < totalPages;
      } else {
        // Si no conocemos el total, usar la heurística (actualizado para per_page=10000)
        hasMore = agendas.length === 10000;
      }
      
      if (hasMore) {
        page++;
        // Eliminado el delay ya que con per_page=10000 normalmente solo se necesita una petición
        
        // Verificación de seguridad para evitar bucles infinitos
        if (page > 10) {
          console.warn('Límite de páginas alcanzado (10), deteniendo paginación');
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

// Función para obtener el promedio de llamadas por agenda
export async function getAverageCallsPerAgenda(
  clientId?: string,
  dateFrom?: string,
  dateTo?: string
): Promise<{ total_agendas_in_range: number; total_agendas: number; total_calls: number; average_calls: number }> {
  try {
    const actualClientId = clientId || getClientId();
    
    if (!actualClientId) {
      throw new Error('No se encontró client_id. Por favor, inicia sesión nuevamente.');
    }
    
    const requestBody: any = {
      client_id: actualClientId
    };
    
    if (dateFrom) {
      requestBody.fecha_inicio = dateFrom;
    }
    
    if (dateTo) {
      requestBody.fecha_fin = dateTo;
    }
    
    const response = await fetch(AVERAGE_CALLS_PER_AGENDA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error al obtener promedio: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return {
      total_agendas_in_range: data.total_agendas_in_range ?? data.total_agendas ?? 0,
      total_agendas: data.total_agendas || 0,
      total_calls: data.total_calls || 0,
      average_calls: data.average_calls || 0
    };
  } catch (error) {
    console.error('Error al obtener promedio de llamadas por agenda:', error);
    throw error;
  }
}

// Función para eliminar una agenda
export async function deleteAgenda(agendaId: number, clientId: string): Promise<void> {
  try {
    if (!agendaId) {
      throw new Error('El ID de la agenda es requerido');
    }

    if (!clientId) {
      throw new Error('El client_id es requerido');
    }

    console.log('Eliminando agenda:', { agendaId, clientId });
    console.log('URL del endpoint:', `${DELETE_AGENDA_WEBHOOK_URL}/${agendaId}`);

    const response = await fetch(`${DELETE_AGENDA_WEBHOOK_URL}/${agendaId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ client_id: clientId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error en la respuesta:', response.status, response.statusText, errorText);
      
      let errorMessage = `Error al eliminar agenda: ${response.status} ${response.statusText}`;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('Agenda eliminada exitosamente:', data);
    
    return;
  } catch (error) {
    console.error('Error al eliminar agenda:', error);
    throw error;
  }
}

// Actualizar estado de una agenda (aprobada / revisada)
export async function updateAgendaStatus(
  params: { id: number; aprobada?: boolean; revisada?: boolean }
): Promise<Agenda> {
  try {
    const clientId = getClientId();
    if (!clientId) {
      throw new Error('No se encontró client_id. Por favor, inicia sesión nuevamente.');
    }

    const body: any = {
      id: params.id,
      client_id: clientId,
    };

    if (typeof params.aprobada === 'boolean') {
      body.aprobada = params.aprobada;
    }
    if (typeof params.revisada === 'boolean') {
      body.revisada = params.revisada;
    }

    const baseAgendaUrl = GET_AGENDAS_WEBHOOK_URL.replace('/get-agenda', '');

    const response = await fetch(`${baseAgendaUrl}/update-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error al actualizar agenda: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data.agenda as Agenda;
  } catch (error) {
    console.error('Error al actualizar estado de agenda:', error);
    throw error;
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
    console.log('Solicitando llamadas con parámetros:', params);
    
    // Usar siempre el endpoint de iacreatorhub
    const url = `${BASE_URL}/api/calls/list-calls`;
    
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
    console.error('Error al obtener llamadas con list-calls:', error);
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
    console.error('Error en listAllCalls:', error);
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
  limit: number = 100,
  fechaInicio?: string,
  fechaFin?: string
): Promise<CallbackResponse> {
  try {
    // Usar el client_id proporcionado o el del localStorage
    const actualClientId = clientId || getClientId();
    
    if (!actualClientId) {
      throw new Error('No se encontró client_id. Por favor, inicia sesión nuevamente.');
    }
    
    console.log('Solicitando callbacks para client_id:', actualClientId);
    console.log('Página:', page, 'Límite:', limit);
    console.log('Filtros de fecha:', { fechaInicio, fechaFin });
    
    const requestBody: any = {
      client_id: actualClientId,
      page: page,
      limit: limit
    };
    
    // Agregar filtros de fecha si están disponibles
    if (fechaInicio) {
      // Formatear fecha_inicio: si es solo fecha (YYYY-MM-DD), agregar hora 00:00:00Z
      let fechaInicioFormatted = fechaInicio;
      if (fechaInicio.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(fechaInicio)) {
        fechaInicioFormatted = `${fechaInicio}T00:00:00Z`;
      } else if (fechaInicio.length === 19 && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(fechaInicio)) {
        fechaInicioFormatted = `${fechaInicio}Z`;
      }
      requestBody.fecha_inicio = fechaInicioFormatted;
    }
    
    if (fechaFin) {
      // Formatear fecha_fin: si es solo fecha (YYYY-MM-DD), agregar hora 23:59:59Z
      let fechaFinFormatted = fechaFin;
      if (fechaFin.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(fechaFin)) {
        fechaFinFormatted = `${fechaFin}T23:59:59Z`;
      } else if (fechaFin.length === 19 && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(fechaFin)) {
        fechaFinFormatted = `${fechaFin}Z`;
      }
      requestBody.fecha_fin = fechaFinFormatted;
    }
    
    const response = await fetch(`${BASE_URL}/api/calls/list-callback`, {
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

// Función para obtener callbacks con límite inicial (optimizada para carga rápida)
export async function fetchCallbacksWithLimit(
  clientId: string,
  limit: number = 500,
  fechaInicio?: string,
  fechaFin?: string
): Promise<{ callbacks: Callback[]; hasMore: boolean; totalCallbacks: number }> {
  try {
    console.log(`Obteniendo primeros ${limit} callbacks para client_id:`, clientId);
    console.log('Filtros de fecha:', { fechaInicio, fechaFin });
    
    let allCallbacks: Callback[] = [];
    let page = 1;
    let hasMore = true;
    let totalCallbacks = 0;
    
    while (hasMore && allCallbacks.length < limit) {
      const response = await fetchCallbacks(clientId, page, 100, fechaInicio, fechaFin);
      
      // Si es la primera página, obtener el total de callbacks
      if (page === 1) {
        totalCallbacks = response.total_callbacks || 0;
      }
      
      // Agregar callbacks hasta alcanzar el límite
      const remainingSlots = limit - allCallbacks.length;
      const callbacksToAdd = response.callbacks.slice(0, remainingSlots);
      allCallbacks = [...allCallbacks, ...callbacksToAdd];
      
      // Si obtuvimos menos de 100 callbacks, no hay más páginas
      hasMore = response.callbacks.length === 100 && allCallbacks.length < limit;
      
      if (hasMore) {
        page++;
        // Pequeña pausa para no sobrecargar el servidor
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    const hasMoreCallbacks = allCallbacks.length < totalCallbacks;
    
    console.log(`Callbacks obtenidos: ${allCallbacks.length}/${totalCallbacks}, Hay más: ${hasMoreCallbacks}`);
    return {
      callbacks: allCallbacks,
      hasMore: hasMoreCallbacks,
      totalCallbacks
    };
    
  } catch (error) {
    console.error('Error al obtener callbacks con límite:', error);
    throw error;
  }
}

// Función para cargar más callbacks (continuación de la paginación)
export async function loadMoreCallbacks(
  clientId: string,
  currentCallbacks: Callback[],
  additionalLimit: number = 500,
  fechaInicio?: string,
  fechaFin?: string
): Promise<{ callbacks: Callback[]; hasMore: boolean; totalCallbacks: number }> {
  try {
    console.log(`Cargando ${additionalLimit} callbacks adicionales para client_id:`, clientId);
    console.log('Filtros de fecha:', { fechaInicio, fechaFin });
    
    // Calcular desde qué página continuar
    const currentPage = Math.ceil(currentCallbacks.length / 100);
    const startPage = currentPage + 1;
    
    let allCallbacks = [...currentCallbacks];
    let page = startPage;
    let hasMore = true;
    let totalCallbacks = 0;
    let loadedCount = 0;
    
    while (hasMore && loadedCount < additionalLimit) {
      const response = await fetchCallbacks(clientId, page, 100, fechaInicio, fechaFin);
      
      // Si es la primera página de esta carga, obtener el total
      if (page === startPage) {
        totalCallbacks = response.total_callbacks || 0;
      }
      
      // Agregar callbacks hasta alcanzar el límite adicional
      const remainingSlots = additionalLimit - loadedCount;
      const callbacksToAdd = response.callbacks.slice(0, remainingSlots);
      allCallbacks = [...allCallbacks, ...callbacksToAdd];
      loadedCount += callbacksToAdd.length;
      
      // Si obtuvimos menos de 100 callbacks, no hay más páginas
      hasMore = response.callbacks.length === 100 && loadedCount < additionalLimit;
      
      if (hasMore) {
        page++;
        // Pequeña pausa para no sobrecargar el servidor
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    const hasMoreCallbacks = allCallbacks.length < totalCallbacks;
    
    console.log(`Callbacks adicionales cargados: ${loadedCount}, Total: ${allCallbacks.length}/${totalCallbacks}, Hay más: ${hasMoreCallbacks}`);
    return {
      callbacks: allCallbacks,
      hasMore: hasMoreCallbacks,
      totalCallbacks
    };
    
  } catch (error) {
    console.error('Error al cargar más callbacks:', error);
    throw error;
  }
}

// Función para exportar TODOS los callbacks con filtros de fecha
export async function exportAllCallbacks(
  clientId: string,
  params: {
    fecha_inicio?: string;
    fecha_fin?: string;
    phone_number?: string;
    sort_order?: 'ASC' | 'DESC';
    sort_by?: 'date_to_call' | 'created_at';
  }
): Promise<{ callbacks: Callback[]; total_callbacks: number }> {
  try {
    if (!clientId) {
      throw new Error('client_id es obligatorio para exportAllCallbacks');
    }
    
    console.log('Exportando callbacks con parámetros:', params);
    
    const url = `${BASE_URL}/api/calls/list-callbacks-all`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        ...params
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error en exportAllCallbacks: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Callbacks exportados:', data.callbacks.length);
    
    return {
      callbacks: data.callbacks || [],
      total_callbacks: data.total_callbacks || 0
    };
  } catch (error) {
    console.error('Error al exportar callbacks:', error);
    throw error;
  }
}

// Obtener métricas de ventas (genérico con fechas)
export async function fetchSalesMetrics(fechaInicio?: string, fechaFin?: string): Promise<{
  totalLlamadas: number;
  totalVentas: number;
  totalGasto: number;
  totalFacturacion: number;
  costePorVenta: number;
  costoPorLlamada: number;
  tasaConversion: number;
  roi: number;
  clientesUnicos: number;
}> {
  try {
    const url = `${BASE_URL}/api/sales/metrics`;
    const body: any = {
      client_id: getClientId()
    };
    
    if (fechaInicio) body.fecha_inicio = fechaInicio;
    if (fechaFin) body.fecha_fin = fechaFin;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error en fetchSalesMetrics: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Error al obtener métricas de ventas');
    }

    return data.metrics;
  } catch (error) {
    console.error('Error al obtener métricas de ventas:', error);
    throw error;
  }
}

// Obtener métricas de ventas de hoy
export async function fetchSalesMetricsToday(): Promise<{
  totalLlamadas: number;
  totalVentas: number;
  totalGasto: number;
  totalFacturacion: number;
  costePorVenta: number;
  costoPorLlamada: number;
  tasaConversion: number;
  roi: number;
  clientesUnicos: number;
}> {
  try {
    const url = `${BASE_URL}/api/sales/metrics/today`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: getClientId()
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error en fetchSalesMetricsToday: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Error al obtener métricas de ventas de hoy');
    }

    return data.metrics;
  } catch (error) {
    console.error('Error al obtener métricas de ventas de hoy:', error);
    throw error;
  }
}

// Obtener métricas de ventas de la semana
export async function fetchSalesMetricsWeek(): Promise<{
  totalLlamadas: number;
  totalVentas: number;
  totalGasto: number;
  totalFacturacion: number;
  costePorVenta: number;
  costoPorLlamada: number;
  tasaConversion: number;
  roi: number;
  clientesUnicos: number;
}> {
  try {
    const url = `${BASE_URL}/api/sales/metrics/week`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: getClientId()
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error en fetchSalesMetricsWeek: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Error al obtener métricas de ventas de la semana');
    }

    return data.metrics;
  } catch (error) {
    console.error('Error al obtener métricas de ventas de la semana:', error);
    throw error;
  }
}

// Obtener métricas de ventas del mes
export async function fetchSalesMetricsMonth(): Promise<{
  totalLlamadas: number;
  totalVentas: number;
  totalGasto: number;
  totalFacturacion: number;
  costePorVenta: number;
  costoPorLlamada: number;
  tasaConversion: number;
  roi: number;
  clientesUnicos: number;
}> {
  try {
    const url = `${BASE_URL}/api/sales/metrics/month`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: getClientId()
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error en fetchSalesMetricsMonth: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Error al obtener métricas de ventas del mes');
    }

    return data.metrics;
  } catch (error) {
    console.error('Error al obtener métricas de ventas del mes:', error);
    throw error;
  }
}

// Obtener métricas de ventas de los últimos 3 meses
export async function fetchSalesMetricsQuarter(): Promise<{
  totalLlamadas: number;
  totalVentas: number;
  totalGasto: number;
  totalFacturacion: number;
  costePorVenta: number;
  costoPorLlamada: number;
  tasaConversion: number;
  roi: number;
  clientesUnicos: number;
}> {
  try {
    const url = `${BASE_URL}/api/sales/metrics/quarter`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: getClientId()
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error en fetchSalesMetricsQuarter: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Error al obtener métricas de ventas de los últimos 3 meses');
    }

    return data.metrics;
  } catch (error) {
    console.error('Error al obtener métricas de ventas de los últimos 3 meses:', error);
    throw error;
  }
}

export { fetchAllCalls };

// Obtener datos de facturación por día
export async function fetchFacturacionByDay(fechaInicio?: string, fechaFin?: string): Promise<any[]> {
  try {
    const url = `${BASE_URL}/api/sales/facturacion-by-day`;
    const body: any = {};
    if (fechaInicio) body.fecha_inicio = fechaInicio;
    if (fechaFin) body.fecha_fin = fechaFin;
    
    const response = await fetch(url, { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching facturacion by day:', error);
    throw error;
  }
}

// Obtener datos de ROI por día
export async function fetchROIByDay(fechaInicio?: string, fechaFin?: string): Promise<any[]> {
  try {
    const url = `${BASE_URL}/api/sales/roi-by-day`;
    const body: any = {};
    if (fechaInicio) body.fecha_inicio = fechaInicio;
    if (fechaFin) body.fecha_fin = fechaFin;
    
    const response = await fetch(url, { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Error fetching ROI by day:', error);
    throw error;
  }
}

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
    const url = `${BASE_URL}/api/calls/get-calls-by-phone`;
    const clientId = getClientId();
    const body = {
      phone_number: params.phone_number,
      per_page: params.per_page ?? 50,
      page: params.page ?? 1,
      sort_order: params.sort_order ?? 'DESC',
      // Enviar también el client_id para limitar la búsqueda en servidor
      ...(clientId ? { client_id: clientId } : {})
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

export interface CallCountByFromNumber {
  from_number: string;
  from_number_norm: string | null;
  total: number;
  fallidas: number;
  efectivas: number;
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
    console.error('Error al obtener conteos por número:', error);
    throw error;
  }
}

// Exportar llamadas con columnas seleccionadas
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
    
    console.log('Exportando llamadas con columnas seleccionadas:', params);
    
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
    console.log('Llamadas exportadas con columnas:', data);
    
    return {
      calls: data.llamadas || [],
      total_llamadas: data.total_llamadas || 0,
      columns_selected: data.columns_selected || params.columns
    };
  } catch (error) {
    console.error('Error al exportar llamadas con columnas:', error);
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
    
    console.log('🔍 Obteniendo motivos de desconexión para client_id:', clientId);
    
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
    console.log('✅ Motivos de desconexión obtenidos para client_id:', data.client_id || clientId);
    console.log('📋 Total de motivos:', data.total || 0);
    console.log('📋 Motivos:', data.disconnection_reasons || []);
    
    // Validar que los motivos pertenecen al client_id correcto
    if (data.client_id && data.client_id !== clientId) {
      console.warn('⚠️ Advertencia: El client_id de la respuesta no coincide con el solicitado');
    }
    
    return data.disconnection_reasons || [];
  } catch (error) {
    console.error('❌ Error al obtener motivos de desconexión:', error);
    throw error;
  }
}

// Obtener métricas de lanzamiento
export async function fetchLanzamientoMetrics(
  fechaInicio?: string, 
  fechaFin?: string
): Promise<{
  totalLlamadas: number;
  llamadasContestadas: number;
  llamadasFallidas: number;
  enlacesEnviados: number;
  clicksTotales: number;
  noLlamar: number;
  porRegion: {
    europa: {
      totalLlamadas: number;
      llamadasContestadas: number;
      llamadasFallidas: number;
      enlacesEnviados: number;
      clicksTotales: number;
      noLlamar: number;
    };
    latam: {
      totalLlamadas: number;
      llamadasContestadas: number;
      llamadasFallidas: number;
      enlacesEnviados: number;
      clicksTotales: number;
      noLlamar: number;
    };
    espana: {
      totalLlamadas: number;
      llamadasContestadas: number;
      llamadasFallidas: number;
      enlacesEnviados: number;
      clicksTotales: number;
      noLlamar: number;
    };
  };
}> {
  try {
    const url = `${BASE_URL}/api/lanzamiento/metrics`;
    const body: any = {
      client_id: getClientId()
    };
    
    if (fechaInicio) body.fecha_inicio = fechaInicio;
    if (fechaFin) body.fecha_fin = fechaFin;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error en fetchLanzamientoMetrics: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Error al obtener métricas de lanzamiento');
    }

    return data.metrics;
  } catch (error) {
    console.error('Error al obtener métricas de lanzamiento:', error);
    throw error;
  }
}

// Obtener métricas de lanzamiento de hoy
export async function fetchLanzamientoMetricsToday(): Promise<{
  success: boolean;
  fecha: string;
  total_llamadas: number;
  llamadas_contestadas: number;
  llamadas_fallidas: number;
  total_enlaces_enviados: number;
  total_clicks_totales: number;
  total_no_llamar: number;
  metrics_by_region: Array<{
    region: string;
    enlaces_enviados: number;
    clicks_totales: number;
    no_llamar: number;
  }>;
}> {
  try {
    const url = `${BASE_URL}/api/lanzamiento/calls/metrics/today`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: getClientId()
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error en fetchLanzamientoMetricsToday: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Error al obtener métricas de lanzamiento de hoy');
    }

    return data;
  } catch (error) {
    console.error('Error al obtener métricas de lanzamiento de hoy:', error);
    throw error;
  }
}

// Obtener métricas de lanzamiento personalizado
export async function fetchLanzamientoMetricsCustom(fechaInicio: string, fechaFin: string): Promise<{
  success: boolean;
  fecha_inicio: string;
  fecha_fin: string;
  total_llamadas: number;
  llamadas_contestadas: number;
  llamadas_fallidas: number;
  total_enlaces_enviados: number;
  total_clicks_totales: number;
  total_no_llamar: number;
  metrics_by_region: Array<{
    region: string;
    enlaces_enviados: number;
    clicks_totales: number;
    no_llamar: number;
  }>;
}> {
  try {
    const url = `${BASE_URL}/api/lanzamiento/calls/metrics/`;

    // Formatear fecha_inicio: si es solo fecha (YYYY-MM-DD), agregar hora 00:00:00Z
    let fechaInicioFormatted = fechaInicio;
    if (fechaInicio.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(fechaInicio)) {
      fechaInicioFormatted = `${fechaInicio}T00:00:00Z`;
    } else if (fechaInicio.length === 19 && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(fechaInicio)) {
      fechaInicioFormatted = `${fechaInicio}Z`;
    }

    // Formatear fecha_fin: si es solo fecha (YYYY-MM-DD), agregar hora 23:59:59Z
    let fechaFinFormatted = fechaFin;
    if (fechaFin.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(fechaFin)) {
      fechaFinFormatted = `${fechaFin}T23:59:59Z`;
    } else if (fechaFin.length === 19 && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(fechaFin)) {
      fechaFinFormatted = `${fechaFin}Z`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: getClientId(),
        fecha_inicio: fechaInicioFormatted,
        fecha_fin: fechaFinFormatted
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error en fetchLanzamientoMetricsCustom: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Error al obtener métricas de lanzamiento personalizado');
    }

    return data;
  } catch (error) {
    console.error('Error al obtener métricas de lanzamiento personalizado:', error);
    throw error;
  }
}

// Obtener métricas de lanzamiento de la semana
export async function fetchLanzamientoMetricsWeek(): Promise<{
  totalLlamadas: number;
  llamadasContestadas: number;
  llamadasFallidas: number;
  enlacesEnviados: number;
  clicksTotales: number;
  noLlamar: number;
  porRegion: {
    europa: {
      totalLlamadas: number;
      llamadasContestadas: number;
      llamadasFallidas: number;
      enlacesEnviados: number;
      clicksTotales: number;
      noLlamar: number;
    };
    latam: {
      totalLlamadas: number;
      llamadasContestadas: number;
      llamadasFallidas: number;
      enlacesEnviados: number;
      clicksTotales: number;
      noLlamar: number;
    };
    espana: {
      totalLlamadas: number;
      llamadasContestadas: number;
      llamadasFallidas: number;
      enlacesEnviados: number;
      clicksTotales: number;
      noLlamar: number;
    };
  };
}> {
  try {
    const url = `${BASE_URL}/api/lanzamiento/metrics/week`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: getClientId()
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error en fetchLanzamientoMetricsWeek: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Error al obtener métricas de lanzamiento de la semana');
    }

    return data.metrics;
  } catch (error) {
    console.error('Error al obtener métricas de lanzamiento de la semana:', error);
    throw error;
  }
}

// Obtener métricas de lanzamiento del mes
export async function fetchLanzamientoMetricsMonth(): Promise<{
  totalLlamadas: number;
  llamadasContestadas: number;
  llamadasFallidas: number;
  enlacesEnviados: number;
  clicksTotales: number;
  noLlamar: number;
  porRegion: {
    europa: {
      totalLlamadas: number;
      llamadasContestadas: number;
      llamadasFallidas: number;
      enlacesEnviados: number;
      clicksTotales: number;
      noLlamar: number;
    };
    latam: {
      totalLlamadas: number;
      llamadasContestadas: number;
      llamadasFallidas: number;
      enlacesEnviados: number;
      clicksTotales: number;
      noLlamar: number;
    };
    espana: {
      totalLlamadas: number;
      llamadasContestadas: number;
      llamadasFallidas: number;
      enlacesEnviados: number;
      clicksTotales: number;
      noLlamar: number;
    };
  };
}> {
  try {
    const url = `${BASE_URL}/api/lanzamiento/metrics/month`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: getClientId()
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error en fetchLanzamientoMetricsMonth: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Error al obtener métricas de lanzamiento del mes');
    }

    return data.metrics;
  } catch (error) {
    console.error('Error al obtener métricas de lanzamiento del mes:', error);
    throw error;
  }
}

// Funciones para manejar registros de "No Llamar"
export async function listDontCallRecords(
  apiKey: string,
  params: {
    client_id: string;
    per_page?: number;
    page?: number;
    fecha_inicio?: string;
    fecha_fin?: string;
    search_term?: string;
    filter_status?: 'all' | 'active' | 'inactive';
    sort_order?: 'ASC' | 'DESC';
  }
): Promise<{
  registros: any[];
  total_registros: number;
  total_paginas: number;
  pagina_actual: number;
  limit: number;
}> {
  try {
    if (!params?.client_id) {
      throw new Error('client_id es obligatorio para listDontCallRecords');
    }

    const url = `${BASE_URL}/api/dont-call/list`;
    
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
      throw new Error(`Error al obtener registros de No Llamar: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Respuesta del endpoint listDontCallRecords:', data);
    
    return {
      registros: data.registros || [],
      total_registros: data.total_registros || 0,
      total_paginas: data.total_paginas || 0,
      pagina_actual: data.pagina_actual || 1,
      limit: data.limit || 50
    };
  } catch (error) {
    console.error('Error al obtener registros de No Llamar:', error);
    throw error;
  }
}

export async function createDontCallRecord(
  apiKey: string,
  params: {
    client_id: string;
    phone_number: string;
    nombre?: string;
    motivo?: string;
    fecha_registro?: string;
    call_id?: string;
    region?: string;
  }
): Promise<{
  success: boolean;
  message: string;
  data: any;
}> {
  try {
    if (!params?.client_id || !params?.phone_number) {
      throw new Error('client_id y phone_number son obligatorios para createDontCallRecord');
    }

    const url = `${BASE_URL}/api/dont-call/create`;
    
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
      throw new Error(`Error al crear registro de No Llamar: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Respuesta del endpoint createDontCallRecord:', data);
    
    return data;
  } catch (error) {
    console.error('Error al crear registro de No Llamar:', error);
    throw error;
  }
}

export async function updateDontCallRecord(
  apiKey: string,
  id: string,
  params: {
    phone_number?: string;
    nombre?: string;
    motivo?: string;
    fecha_registro?: string;
    activo?: boolean;
    region?: string;
  }
): Promise<{
  success: boolean;
  message: string;
  data: any;
}> {
  try {
    if (!id) {
      throw new Error('ID es obligatorio para updateDontCallRecord');
    }

    const url = `${BASE_URL}/api/dont-call/${id}`;
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error en la respuesta:', response.status, response.statusText, errorText);
      throw new Error(`Error al actualizar registro de No Llamar: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Respuesta del endpoint updateDontCallRecord:', data);
    
    return data;
  } catch (error) {
    console.error('Error al actualizar registro de No Llamar:', error);
    throw error;
  }
}

export async function deleteDontCallRecord(
  apiKey: string,
  id: string
): Promise<{
  success: boolean;
  message: string;
  data: any;
}> {
  try {
    if (!id) {
      throw new Error('ID es obligatorio para deleteDontCallRecord');
    }

    const url = `${BASE_URL}/api/dont-call/${id}`;
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error en la respuesta:', response.status, response.statusText, errorText);
      throw new Error(`Error al eliminar registro de No Llamar: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Respuesta del endpoint deleteDontCallRecord:', data);
    
    return data;
  } catch (error) {
    console.error('Error al eliminar registro de No Llamar:', error);
    throw error;
  }
}

export async function getDontCallStats(
  apiKey: string,
  params: {
    client_id: string;
    fecha_inicio?: string;
    fecha_fin?: string;
  }
): Promise<{
  success: boolean;
  total_registros: number;
  registros_activos: number;
  registros_inactivos: number;
  con_region: number;
  sin_region: number;
}> {
  try {
    if (!params?.client_id) {
      throw new Error('client_id es obligatorio para getDontCallStats');
    }

    const url = `${BASE_URL}/api/dont-call/stats`;
    
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
      throw new Error(`Error al obtener estadísticas de No Llamar: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Respuesta del endpoint getDontCallStats:', data);
    
    return data;
  } catch (error) {
    console.error('Error al obtener estadísticas de No Llamar:', error);
    throw error;
  }
}