import { Agenda, AgendaSlot } from '../../types';
import { getClientId, GET_AGENDAS_WEBHOOK_URL, GET_AGENDAS_BY_SCHEDULED_URL, DELETE_AGENDA_WEBHOOK_URL, AVERAGE_CALLS_PER_AGENDA_URL, MOTIVOS_RECHAZO_URL } from './config';
import { supabase } from '../../lib/supabase';

/** Body para filtrar agendas sin motivo de rechazo (NULL o vacío); debe coincidir con el backend */
export const MOTIVO_RECHAZO_FILTRO_SIN = '__sin_motivo__';

/** Motivos válidos al crear/filtrar agendas (misma lista que createAgenda en el API) */
export const MOTIVOS_RECHAZO_AGENDA_FILTRO = [
  'Edad',
  'Pago mensual bajo',
  'Otros',
  'Ubicacion fuera alcance',
  'Casco historico',
  'No interesado',
  'Detecta IA',
  'Tiene bateria',
  'Incidencia',
] as const;

// Función para obtener todas las agendas con paginación
export async function fetchAllAgendas(
  clientId?: string,
  searchTerm?: string,
  filterType?: string,
  dateFrom?: string,
  dateTo?: string,
  sortOrder?: 'ASC' | 'DESC',
  agentId?: string,
  motivoRechazo?: string,
): Promise<Agenda[]> {
  try {
    // Usar el client_id proporcionado o el del localStorage
    const actualClientId = clientId || getClientId();
    
    if (!actualClientId) {
      throw new Error('No se encontró client_id. Por favor, inicia sesión nuevamente.');
    }
    
    // console.log('Solicitando TODAS las agendas para client_id:', actualClientId);
    // console.log('Filtros aplicados:', { searchTerm, filterType, dateFrom, dateTo, sortOrder, agentId });
    
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

      if (motivoRechazo != null && motivoRechazo !== '' && motivoRechazo !== 'all') {
        requestBody.motivo_rechazo = motivoRechazo;
      }

      // console.log(`Página ${page}:`, requestBody);
      
      const response = await fetch(GET_AGENDAS_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        // console.error('Error en la respuesta:', response.status, response.statusText, errorText);
        throw new Error(`Error al obtener agendas: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      // console.log(`Respuesta página ${page}:`, data);
      
      // Procesar la respuesta
      let agendas: Agenda[] = [];
      let responseData = data;
      
      // Si es un array, tomar el primer elemento
      if (Array.isArray(data)) {
        if (data.length > 0) {
          responseData = data[0];
        } else {
          // console.log('Respuesta vacía');
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
          // console.log('Estructura de respuesta inesperada:', responseData);
          break;
        }
      }
      
      // console.log(`Página ${page}: ${agendas.length} agendas obtenidas`);
      
      // Si no obtuvimos agendas, probablemente es el final
      if (agendas.length === 0) {
        // console.log('No se obtuvieron agendas en esta página, finalizando paginación');
        break;
      }
      
      // Agregar las agendas de esta página al total
      allAgendas = [...allAgendas, ...agendas];
      
      // Determinar si hay más páginas
      // Si obtenemos menos de 10000 agendas, probablemente es la última página
      // También verificar si la respuesta indica el total de páginas
      const totalPages = data.total_paginas || data.totalPages || 0;
      const totalAgendas = data.total_agendas || data.totalAgendas || 0;
      
      // console.log(`Página ${page}: ${agendas.length} agendas, Total páginas: ${totalPages}, Total agendas: ${totalAgendas}`);
      
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
          // console.warn('Límite de páginas alcanzado (10), deteniendo paginación');
          break;
        }
      }
    }
    
    // console.log(`Total de agendas obtenidas: ${allAgendas.length}`);
    return allAgendas;
    
  } catch (error) {
    // console.error('Error al obtener todas las agendas:', error);
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
    
    // console.log('Solicitando agendas para client_id:', actualClientId);
    // console.log('URL del endpoint:', GET_AGENDAS_WEBHOOK_URL);
    
    const requestBody = {
      client_id: actualClientId
    };
    
    // console.log('Body de la petición:', requestBody);
    
    const response = await fetch(GET_AGENDAS_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // console.error('Error en la respuesta:', response.status, response.statusText, errorText);
      throw new Error(`Error al obtener agendas: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    // console.log('Respuesta completa del webhook de agendas:', data);
    // console.log('Tipo de respuesta:', typeof data, Array.isArray(data) ? 'Array' : 'Object');
    
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
    
    // console.log(`Se procesaron ${agendas.length} agendas`);
    // console.log('Agendas procesadas:', agendas);
    
    // Asegurar que devolvemos un array válido
    return Array.isArray(agendas) ? agendas : [];
    
  } catch (error) {
    // console.error('Error al obtener agendas del webhook:', error);
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
    // console.error('Error al obtener promedio de llamadas por agenda:', error);
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

    // console.log('Eliminando agenda:', { agendaId, clientId });
    // console.log('URL del endpoint:', `${DELETE_AGENDA_WEBHOOK_URL}/${agendaId}`);

    const response = await fetch(`${DELETE_AGENDA_WEBHOOK_URL}/${agendaId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ client_id: clientId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // console.error('Error en la respuesta:', response.status, response.statusText, errorText);
      
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
    // console.log('Agenda eliminada exitosamente:', data);
    
    return;
  } catch (error) {
    // console.error('Error al eliminar agenda:', error);
    throw error;
  }
}



// Actualizar estado de una agenda (aprobada / revisada / detalles / estado)
export async function updateAgendaStatus(
  params: { id: number; aprobada?: boolean; revisada?: boolean; detalles?: string; motivo_rechazo?: string | null; url_maps?: string | null }
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
    if ('detalles' in params) {
      body.detalles = params.detalles ?? '';
    }
    if ('motivo_rechazo' in params) {
      body.motivo_rechazo = params.motivo_rechazo ?? null;
    }
    if ('url_maps' in params) {
      body.url_maps = params.url_maps ?? null;
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
    // console.error('Error al actualizar estado de agenda:', error);
    throw error;
  }
}

function normalizeSlotText(value?: string | null): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD') // Quitar acentos/tildes
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function extractAgendaDateAndTime(fechaAgendamiento?: string | null): { fecha: string; hora: string } | null {
  if (!fechaAgendamiento) return null;

  // Preferimos extraer directo del string para evitar desplazamientos por timezone.
  const match = fechaAgendamiento.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})(?::(\d{2}))?/);
  if (match) {
    const fecha = match[1];
    const hora = `${match[2]}:${match[3] ?? '00'}`;
    return { fecha, hora };
  }

  // Fallback por si el formato viene distinto.
  const date = new Date(fechaAgendamiento);
  if (Number.isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return {
    fecha: `${year}-${month}-${day}`,
    hora: `${hours}:${minutes}:${seconds}`,
  };
}

// Si una agenda queda revisada y no aprobada, libera 1 cupo del slot correspondiente.
export async function releaseAgendaSlotOccupancy(agenda: Agenda): Promise<boolean> {
  const dateTime = extractAgendaDateAndTime(agenda.fecha_agendamiento);
  if (!dateTime) {
    return false;
  }

  const provinceCandidates = [agenda.ciudad, agenda.region]
    .map((value) => normalizeSlotText(value))
    .filter((value, index, arr) => value.length > 0 && arr.indexOf(value) === index);

  try {
    const { data, error } = await supabase
      .from('slots')
      .select('*')
      .eq('fecha', dateTime.fecha)
      .eq('hora', dateTime.hora);

    if (error) {
      throw new Error(error.message);
    }

    const slots = (data ?? []) as AgendaSlot[];
    if (slots.length === 0) {
      return false;
    }

    const matchedSlot = slots.find((slot) => {
      if (provinceCandidates.length === 0) return true;
      const normalizedProvince = normalizeSlotText(slot.provincia);
      return provinceCandidates.includes(normalizedProvince);
    });

    if (!matchedSlot || matchedSlot.ocupadas <= 0) {
      return false;
    }

    const { error: updateError } = await supabase
      .from('slots')
      .update({ ocupadas: matchedSlot.ocupadas - 1 })
      .eq('id', matchedSlot.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return true;
  } catch (error) {
    // console.error('Error al liberar cupo de slot para agenda revisada/no aprobada:', error);
    return false;
  }
}



// Obtener slots con filtros opcionales (se aplican directamente en la base de datos)
export async function fetchAgendaSlots(filters?: {
  provincia?: string;
  fecha?: string;
  fecha_desde?: string;
  tipo?: 'placas_solares' | 'bateria';
}): Promise<AgendaSlot[]> {
  try {
    let query = supabase
      .from('slots')
      .select('*')
      .order('fecha', { ascending: true })
      .order('hora', { ascending: true });

    if (filters?.provincia) {
      query = query.eq('provincia', filters.provincia);
    }

    if (filters?.fecha) {
      query = query.eq('fecha', filters.fecha);
    } else if (filters?.fecha_desde) {
      query = query.gte('fecha', filters.fecha_desde);
    }

    if (filters?.tipo) {
      query = query.eq('tipo', filters.tipo);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []) as AgendaSlot[];
  } catch (error) {
    // console.error('Error al obtener slots:', error);
    throw error;
  }
}



// Obtener provincias disponibles desde la base de datos (opcionalmente filtradas por tipo)
export async function fetchSlotProvinces(tipo?: 'placas_solares' | 'bateria'): Promise<string[]> {
  try {
    let query = supabase
      .from('slots')
      .select('provincia')
      .not('provincia', 'is', null);

    if (tipo) {
      query = query.eq('tipo', tipo);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    const unique = Array.from(
      new Set(
        (data ?? [])
          .map((item) => item.provincia)
          .filter((provincia): provincia is string => typeof provincia === 'string' && provincia.trim().length > 0)
      )
    );

    return unique.sort((a, b) => a.localeCompare(b, 'es'));
  } catch (error) {
    // console.error('Error al obtener provincias de slots:', error);
    throw error;
  }
}



export async function createAgendaSlot(payload: {
  fecha: string;
  hora: string;
  provincia: string;
  max_citas: number;
  ocupadas?: number;
  tipo?: 'placas_solares' | 'bateria';
}): Promise<AgendaSlot> {
  try {
    const tipo = payload.tipo ?? 'placas_solares';
    const insertPayload: Record<string, unknown> = {
      fecha: payload.fecha,
      hora: payload.hora,
      provincia: payload.provincia,
      max_citas: payload.max_citas,
      ocupadas: payload.ocupadas ?? 0,
      tipo,
    };

    const { data, error } = await supabase
      .from('slots')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data as AgendaSlot;
  } catch (error) {
    // console.error('Error al crear slot:', error);
    throw error;
  }
}



export async function updateAgendaSlot(
  id: string,
  payload: {
    fecha: string;
    hora: string;
    provincia: string;
    max_citas: number;
    ocupadas: number;
  }
): Promise<AgendaSlot> {
  try {
    const { data, error } = await supabase
      .from('slots')
      .update({
        fecha: payload.fecha,
        hora: payload.hora,
        provincia: payload.provincia,
        max_citas: payload.max_citas,
        ocupadas: payload.ocupadas,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data as AgendaSlot;
  } catch (error) {
    // console.error('Error al actualizar slot:', error);
    throw error;
  }
}



export async function deleteAgendaSlot(id: string): Promise<void> {
  try {
    const { error } = await supabase.from('slots').delete().eq('id', id);

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    // console.error('Error al eliminar slot:', error);
    throw error;
  }
}

export interface MotivoRechazoStat {
  motivo: string;
  total: number;
  porcentaje: number;
}

export async function fetchMotivosRechazo(
  clientId: string,
  fechaInicio?: string,
  fechaFin?: string,
): Promise<MotivoRechazoStat[]> {
  const body: Record<string, string> = { client_id: clientId };
  if (fechaInicio) body.fecha_inicio = fechaInicio;
  if (fechaFin) body.fecha_fin = fechaFin;

  const response = await fetch(MOTIVOS_RECHAZO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Error al obtener motivos de rechazo: ${response.status}`);
  }

  const data = await response.json();
  return (data.motivos ?? []) as MotivoRechazoStat[];
}

// Obtener agendas filtradas por fecha de visita (fecha_agendamiento) — mes a mes para el calendario de visitas
// ─── Auditor: lock en tiempo real y registro de auditoría ───────────────────

export interface AgendaLock {
  agenda_id: number;
  locked_by_email: string;
  locked_by_name: string;
  client_id: string;
  locked_at: string;
}

export interface AgendaAudit {
  id: number;
  agenda_id: number;
  audited_by_email: string;
  audited_by_name: string;
  client_id: string;
  audited_at: string;
}

/**
 * Intenta adquirir el lock de una agenda.
 * Retorna null si lo adquirió, o el lock existente si ya está tomado por otro.
 */
export async function acquireAgendaLock(
  agendaId: number,
  userEmail: string,
  userName: string,
  clientId: string,
): Promise<AgendaLock | null> {
  const { error } = await supabase
    .from('agenda_locks')
    .insert({ agenda_id: agendaId, locked_by_email: userEmail, locked_by_name: userName, client_id: clientId });

  if (!error) return null; // Lock adquirido

  // El insert falló (duplicate PK u otro error): verificar si hay lock activo
  const { data } = await supabase
    .from('agenda_locks')
    .select('*')
    .eq('agenda_id', agendaId)
    .single();

  return (data as AgendaLock) ?? null;
}

export async function releaseAgendaLock(agendaId: number): Promise<void> {
  await supabase.from('agenda_locks').delete().eq('agenda_id', agendaId);
}

export async function getAgendaLock(agendaId: number): Promise<AgendaLock | null> {
  const { data } = await supabase
    .from('agenda_locks')
    .select('*')
    .eq('agenda_id', agendaId)
    .maybeSingle();
  return (data as AgendaLock) ?? null;
}

export async function recordAgendaAudit(
  agendaId: number,
  auditorEmail: string,
  auditorName: string,
  clientId: string,
): Promise<void> {
  await supabase.from('agenda_audits').insert({
    agenda_id: agendaId,
    audited_by_email: auditorEmail,
    audited_by_name: auditorName,
    client_id: clientId,
  });
}

/** Retorna un mapa agenda_id → último auditor para el client_id dado. */
export async function fetchLastAuditsMap(
  clientId: string,
): Promise<Record<number, { name: string; at: string }>> {
  const { data } = await supabase
    .from('agenda_audits')
    .select('agenda_id, audited_by_name, audited_at')
    .eq('client_id', clientId)
    .order('audited_at', { ascending: false });

  if (!data) return {};

  const map: Record<number, { name: string; at: string }> = {};
  for (const row of data as { agenda_id: number; audited_by_name: string; audited_at: string }[]) {
    if (!(row.agenda_id in map)) {
      map[row.agenda_id] = { name: row.audited_by_name, at: row.audited_at };
    }
  }
  return map;
}

export async function fetchAgendasByScheduledDate(
  clientId: string,
  year: number,
  month: number,
  motivoRechazo?: string,
): Promise<Agenda[]> {
  const mm = String(month + 1).padStart(2, '0');
  const lastDay = new Date(year, month + 1, 0).getDate();
  const fechaInicio = `${year}-${mm}-01`;
  const fechaFin = `${year}-${mm}-${String(lastDay).padStart(2, '0')}`;

  let allAgendas: Agenda[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const body: Record<string, unknown> = {
      client_id: clientId,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      per_page: 500,
      page,
      sort_order: 'ASC',
    };
    if (motivoRechazo != null && motivoRechazo !== '' && motivoRechazo !== 'all') {
      body.motivo_rechazo = motivoRechazo;
    }

    const response = await fetch(GET_AGENDAS_BY_SCHEDULED_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error al obtener agendas por fecha de visita: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const agendas: Agenda[] = data.agendas || [];
    allAgendas = [...allAgendas, ...agendas];

    if (page >= (data.total_paginas || 1) || agendas.length === 0) {
      hasMore = false;
    } else {
      page += 1;
    }
  }

  return allAgendas;
}
