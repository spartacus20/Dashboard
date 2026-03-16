import { getClientId, BASE_URL } from './config';




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
    // console.error('Error al obtener métricas de ventas:', error);
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
    // console.error('Error al obtener métricas de ventas de hoy:', error);
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
    // console.error('Error al obtener métricas de ventas de la semana:', error);
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
    // console.error('Error al obtener métricas de ventas del mes:', error);
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
    // console.error('Error al obtener métricas de ventas de los últimos 3 meses:', error);
    throw error;
  }
}



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
    // console.error('Error fetching facturacion by day:', error);
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
    // console.error('Error fetching ROI by day:', error);
    throw error;
  }
}

