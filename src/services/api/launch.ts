import { BASE_URL, getClientId } from "./config";
import { authHeaders } from "./http";


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
      headers: await authHeaders(),
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
    // console.error('Error al obtener métricas de lanzamiento:', error);
    throw error;
  }
}

// Obtener métricas de lanzamiento de hoy (por país, derivado del teléfono)
export async function fetchLanzamientoMetricsToday(): Promise<{
  success: boolean;
  fecha: string;
  total_llamadas: number;
  llamadas_contestadas: number;
  llamadas_fallidas: number;
  total_enlaces_enviados: number;
  total_clicks_totales: number;
  total_no_llamar: number;
  metrics_by_country: Array<{
    pais: string;
    total_llamadas: number;
    llamadas_contestadas: number;
    llamadas_fallidas: number;
    enlaces_enviados: number;
    clicks_totales: number;
    no_llamar: number;
  }>;
}> {
  try {
    const url = `${BASE_URL}/api/lanzamiento/calls/metrics/today`;

    const response = await fetch(url, {
      method: 'POST',
      headers: await authHeaders(),
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
    // console.error('Error al obtener métricas de lanzamiento de hoy:', error);
    throw error;
  }
}

// Obtener métricas de lanzamiento personalizado (por país, derivado del teléfono)
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
  metrics_by_country: Array<{
    pais: string;
    total_llamadas: number;
    llamadas_contestadas: number;
    llamadas_fallidas: number;
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
      headers: await authHeaders(),
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
    // console.error('Error al obtener métricas de lanzamiento personalizado:', error);
    throw error;
  }
}

// Obtener llamadas por hora del día (gráfico horario de Lanzamiento v2).
// El backend reetiqueta las horas a la zona horaria del usuario (tz-aware).
// Endpoint nuevo (requiere desplegar mas-sol-dashboard): si aún no existe,
// el llamador debe hacer fallback a datos de ejemplo.
export async function fetchLanzamientoCallsByHour(
  fechaInicio?: string,
  fechaFin?: string
): Promise<{ hora: number; total_llamadas: number; llamadas_efectivas: number }[]> {
  const url = `${BASE_URL}/api/lanzamiento/calls/metrics/by-hour`;
  const body: any = { client_id: getClientId() };
  if (fechaInicio) body.fecha_inicio = fechaInicio;
  if (fechaFin) body.fecha_fin = fechaFin;

  const response = await fetch(url, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Error en fetchLanzamientoCallsByHour: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error || 'Error al obtener llamadas por hora');
  }
  return data.data || [];
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
      headers: await authHeaders(),
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
    // console.error('Error al obtener métricas de lanzamiento de la semana:', error);
    throw error;
  }
}

// Obtener métricas de lanzamiento por día (para gráfico de área en rango personalizado)
export interface DailyLanzamientoMetric {
  fecha: string;
  total_llamadas: number;
  llamadas_contestadas: number;
  total_enlaces_enviados: number;
  total_clicks_totales: number;
  tasa_contestacion: number;
  pct_enlaces: number;
  tasa_clicks: number;
}

export async function fetchLanzamientoMetricsDailyRange(
  fechaInicio: string,
  fechaFin: string,
  maxDays = 31
): Promise<DailyLanzamientoMetric[]> {
  const dates: string[] = [];
  const [ys, ms, ds] = fechaInicio.split('-').map(Number);
  const [ye, me, de] = fechaFin.split('-').map(Number);
  const start = new Date(Date.UTC(ys, ms - 1, ds));
  const end = new Date(Date.UTC(ye, me - 1, de));

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
    if (dates.length >= maxDays) break;
  }

  const results = await Promise.all(
    dates.map(async (date) => {
      try {
        const data = await fetchLanzamientoMetricsCustom(date, date);
        const total = data.total_llamadas ?? 0;
        const contestadas = data.llamadas_contestadas ?? 0;
        const enlaces = data.total_enlaces_enviados ?? 0;
        const clicks = data.total_clicks_totales ?? 0;
        return {
          fecha: date,
          total_llamadas: total,
          llamadas_contestadas: contestadas,
          total_enlaces_enviados: enlaces,
          total_clicks_totales: clicks,
          tasa_contestacion: total > 0 ? Math.round((contestadas / total) * 100) : 0,
          pct_enlaces: contestadas > 0 ? Math.round((enlaces / contestadas) * 100) : 0,
          tasa_clicks: enlaces > 0 ? Math.round((clicks / enlaces) * 100) : 0,
        } as DailyLanzamientoMetric;
      } catch {
        return null;
      }
    })
  );

  return results.filter(Boolean) as DailyLanzamientoMetric[];
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
      headers: await authHeaders(),
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
    // console.error('Error al obtener métricas de lanzamiento del mes:', error);
    throw error;
  }
}

