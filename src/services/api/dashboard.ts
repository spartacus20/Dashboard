import { getClientId, BASE_URL, GET_DASHBOARD_WEBHOOK_URL, GET_DASHBOARD_CUSTOM_WEBHOOK_URL, PROMEDIO_DURACION_LLAMADAS_EFECTIVAS_URL } from './config';




// Función para obtener datos del dashboard (endpoint genérico con fechas)
export async function getDashboardData(
  clientId?: string, 
  fechaInicio?: string, 
  fechaFin?: string,
  bdd?: string,
  cliente?: string
): Promise<any> {
  try {
    // Usar el client_id proporcionado o el del localStorage
    const actualClientId = clientId || getClientId();
    
    if (!actualClientId) {
      throw new Error('No se encontró client_id. Por favor, inicia sesión nuevamente.');
    }
    
    // console.log('Solicitando datos del dashboard para client_id:', actualClientId);
    // console.log('Fechas de filtro:', { fechaInicio, fechaFin });
    
    const requestBody: any = {
      client_id: actualClientId
    };
    
    // Completar fechaFin si sólo viene fechaInicio
    const effectiveFechaInicio = fechaInicio;
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

    // Agregar filtro de cliente (metadata->>'cliente') si se proporciona
    if (cliente && cliente.trim()) {
      requestBody.cliente = cliente.trim();
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
    // console.log('Respuesta completa del webhook dashboard:', data);
    
    return transformDashboardData(data);
  } catch (error) {
    // console.error('Error al obtener datos del dashboard:', error);
    throw error;
  }
}



// Nuevo: obtener datos del dashboard usando el endpoint custom explícitamente
export async function getDashboardCustom(
  clientId?: string,
  fechaInicio?: string,
  fechaFin?: string,
  bdd?: string,
  cliente?: string
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

    // Agregar filtro de cliente si se proporciona
    if (cliente && cliente.trim()) {
      requestBody.cliente = cliente.trim();
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
    // console.error('Error en getDashboardCustom:', error);
    throw error;
  }
}



// Función para obtener datos del dashboard de hoy
export async function getDashboardToday(clientId?: string, bdd?: string, cliente?: string): Promise<any> {
  try {
    const actualClientId = clientId || getClientId();
    
    if (!actualClientId) {
      throw new Error('No se encontró client_id. Por favor, inicia sesión nuevamente.');
    }
    
    // console.log('Solicitando datos del dashboard de HOY para client_id:', actualClientId);
    
    const requestBody: any = { client_id: actualClientId };
    if (bdd && bdd.trim()) {
      requestBody.bdd = bdd.trim();
    }
    if (cliente && cliente.trim()) {
      requestBody.cliente = cliente.trim();
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
    // console.log('Respuesta del dashboard de hoy:', data);
    
    return transformDashboardData(data);
  } catch (error) {
    // console.error('Error al obtener datos del dashboard de hoy:', error);
    throw error;
  }
}



// Función para obtener datos del dashboard de la semana
export async function getDashboardWeek(clientId?: string, bdd?: string, cliente?: string): Promise<any> {
  try {
    const actualClientId = clientId || getClientId();
    
    if (!actualClientId) {
      throw new Error('No se encontró client_id. Por favor, inicia sesión nuevamente.');
    }
    
    // console.log('Solicitando datos del dashboard de la SEMANA para client_id:', actualClientId);
    
    const requestBody: any = { client_id: actualClientId };
    if (bdd && bdd.trim()) {
      requestBody.bdd = bdd.trim();
    }
    if (cliente && cliente.trim()) {
      requestBody.cliente = cliente.trim();
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
    // console.log('Respuesta del dashboard de la semana:', data);
    
    return transformDashboardData(data);
  } catch (error) {
    // console.error('Error al obtener datos del dashboard de la semana:', error);
    throw error;
  }
}



// Función para obtener datos del dashboard del mes
export async function getDashboardMonth(clientId?: string, bdd?: string, cliente?: string): Promise<any> {
  try {
    const actualClientId = clientId || getClientId();
    
    if (!actualClientId) {
      throw new Error('No se encontró client_id. Por favor, inicia sesión nuevamente.');
    }
    
    // console.log('Solicitando datos del dashboard del MES para client_id:', actualClientId);
    
    const requestBody: any = { client_id: actualClientId };
    if (bdd && bdd.trim()) {
      requestBody.bdd = bdd.trim();
    }
    if (cliente && cliente.trim()) {
      requestBody.cliente = cliente.trim();
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
    // console.log('Respuesta del dashboard del mes:', data);
    
    return transformDashboardData(data);
  } catch (error) {
    // console.error('Error al obtener datos del dashboard del mes:', error);
    throw error;
  }
}

/** POST `/api/dashboard/promedio-duracion-llamadas-efectivas` — mismos filtros opcionales que el dashboard (`fecha_inicio`, `fecha_fin`, `bdd`, `cliente`). */
export async function getPromedioDuracionLlamadasEfectivas(
  clientId?: string,
  fechaInicio?: string,
  fechaFin?: string,
  bdd?: string,
  cliente?: string
): Promise<{
  promedio_duracion_efectivas_segundos: number;
  promedio_duracion_efectivas_minutos: number;
  efectivas_con_duracion: number;
}> {
  const actualClientId = clientId || getClientId();
  if (!actualClientId) {
    throw new Error('No se encontró client_id. Por favor, inicia sesión nuevamente.');
  }
  const body: Record<string, string> = { client_id: actualClientId };
  if (fechaInicio) body.fecha_inicio = fechaInicio;
  if (fechaFin) body.fecha_fin = fechaFin;
  if (bdd?.trim()) body.bdd = bdd.trim();
  if (cliente?.trim()) body.cliente = cliente.trim();

  const response = await fetch(PROMEDIO_DURACION_LLAMADAS_EFECTIVAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(
      `Error al obtener promedio de duración (efectivas): ${response.status} ${response.statusText}`
    );
  }
  const data = await response.json();
  if (data?.error) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Error del servidor');
  }
  return {
    promedio_duracion_efectivas_segundos: Number(data.promedio_duracion_efectivas_segundos) || 0,
    promedio_duracion_efectivas_minutos: Number(data.promedio_duracion_efectivas_minutos) || 0,
    efectivas_con_duracion: Number(data.efectivas_con_duracion) || 0,
  };
}



// Función para obtener los valores únicos de metadata->>'cliente' para el filtro de clientes
export async function getAvailableClientes(clientId: string): Promise<string[]> {
  try {
    const response = await fetch(`${BASE_URL}/api/dashboard/available-clientes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId }),
    });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data?.clientes) ? data.clientes : [];
  } catch {
    return [];
  }
}

// Estructura vacía segura para evitar pantalla en blanco si falla la transformación
const EMPTY_DASHBOARD = {
  dashboard_data: {
    metricas_generales: {
      total_llamadas: 0, llamadas_efectivas: 0, llamadas_fallidas: 0, costo_total: 0,
      total_duration_seconds: 0, total_duration_minutes: 0,
      promedio_duracion_efectivas_segundos: 0, promedio_duracion_efectivas_minutos: 0, efectivas_con_duracion: 0,
      total_agendamientos: 0, total_agendamientos_paneles: 0, costo_por_agenda: 0
    },
    llamadas_por_dia: [], llamadas_por_hora: [], razones_desconexion: [], tipos_vivienda: [],
    tipos_vivienda_agendas: [], interes: [], llamadas_efectivas_por_hora: [], agentes_por_agendas: [],
    duracion_llamadas_efectivas: null, identidad: []
  }
};

// Función auxiliar para transformar los datos del dashboard
function transformDashboardData(data: any): any {
  try {
  if (data && typeof data === 'object') {
    // console.log('Datos del dashboard recibidos:', data);
    
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
          ...(() => {
            const promoSeg = Number(data.promedio_duracion_efectivas_segundos) || 0;
            const promoMin =
              data.promedio_duracion_efectivas_minutos != null && data.promedio_duracion_efectivas_minutos !== ''
                ? Number(data.promedio_duracion_efectivas_minutos)
                : Math.round((promoSeg / 60) * 10) / 10;
            return {
              promedio_duracion_efectivas_segundos: promoSeg,
              promedio_duracion_efectivas_minutos: promoMin,
              efectivas_con_duracion: Number(data.efectivas_con_duracion) || 0,
            };
          })(),
          total_agendamientos: data.total_agendamientos || 0,
          total_agendamientos_paneles: data.total_agendamientos_paneles || 0,
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
        // Transformar distribucion_por_hora a llamadas_por_hora (Array.isArray evita crash si el backend devuelve formato distinto)
        llamadas_por_hora: Array.isArray(data.distribucion_por_hora) ? data.distribucion_por_hora.map((item: any) => ({
          hora: item.hora,
          hora_label: `${item.hora}:00`,
          llamadas_mas_16_segundos: (item.cantidad_agendas || 0) * 5, // Estimación: 5 llamadas por agenda
          cantidad_agendas: item.cantidad_agendas || 0
        })) : [],
        // Transformar razones_desconexion
        razones_desconexion: Array.isArray(data.razones_desconexion) ? data.razones_desconexion.map((item: any) => ({
          razon: item.razon,
          total: item.cantidad,
          porcentaje: ((item.cantidad / (data.total_llamadas || 1)) * 100).toFixed(2)
        })) : [],
        // Transformar tipos_vivienda (por llamadas)
        tipos_vivienda: Array.isArray(data.tipos_vivienda) ? data.tipos_vivienda.map((item: any) => ({
          tipo: item.tipo,
          cantidad: item.cantidad,
          porcentaje: ((item.cantidad / (data.total_llamadas || 1)) * 100).toFixed(2)
        })) : [],
        // Transformar tipos_vivienda_agendas (por agendas)
        tipos_vivienda_agendas: Array.isArray(data.tipos_vivienda_agendas) ? data.tipos_vivienda_agendas.map((item: any) => ({
          tipo: item.tipo,
          cantidad: item.cantidad,
          porcentaje: ((item.cantidad / (data.total_agendamientos || 1)) * 100).toFixed(2)
        })) : [],
        // Transformar interes
        interes: Array.isArray(data.interes) ? data.interes.map((item: any) => ({
          interes: item.interes,
          cantidad: item.cantidad,
          porcentaje: ((item.cantidad / (data.total_llamadas || 1)) * 100).toFixed(2)
        })) : [],
        // Transformar llamadas_efectivas_por_hora
        llamadas_efectivas_por_hora: Array.isArray(data.llamadas_efectivas_por_hora) ? data.llamadas_efectivas_por_hora.map((item: any) => ({
          hora: item.hora,
          hora_label: `${String(item.hora ?? '').padStart(2, '0')}:00`,
          cantidad_llamadas: item.cantidad_llamadas || 0
        })) : [],
        // Transformar duracion_llamadas_efectivas
        duracion_llamadas_efectivas: data.duracion_llamadas_efectivas ? {
          rango_0_30: data.duracion_llamadas_efectivas.rango_0_30 || 0,
          rango_30_50: data.duracion_llamadas_efectivas.rango_30_50 || 0,
          rango_50_plus: data.duracion_llamadas_efectivas.rango_50_plus || 0
        } : null,
        // Transformar agentes_por_agendas
        agentes_por_agendas: Array.isArray(data.agentes_por_agendas) ? data.agentes_por_agendas.map((item: any) => ({
          agent_id: item.agent_id,
          cantidad_agendas: item.cantidad_agendas || 0
        })) : [],
        // Transformar identidad
        identidad: Array.isArray(data.identidad) ? data.identidad.map((item: any) => ({
          identidad: item.identidad,
          cantidad: item.cantidad || 0
        })) : []
      }
    };
    
    // console.log('Datos transformados:', transformedData);
    return transformedData;
  }
  
  // console.warn('Formato inesperado de respuesta del dashboard:', data);
  return data ?? EMPTY_DASHBOARD;
  } catch (_err) {
    return EMPTY_DASHBOARD;
  }
}

