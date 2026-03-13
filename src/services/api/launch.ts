import { BASE_URL, getClientId } from "./config";


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
    // console.error('Error al obtener métricas de lanzamiento personalizado:', error);
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
    // console.error('Error al obtener métricas de lanzamiento de la semana:', error);
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
    // console.error('Error al obtener métricas de lanzamiento del mes:', error);
    throw error;
  }
}

