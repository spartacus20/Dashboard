import { formatDiaLabel } from './dateUtils';



// Función para traducir razones de desconexión
export function translateDisconnectionReason(reason: string): string {
  const translations: Record<string, string> = {
    'agent_hangup': 'Agente colgó',
    'dial_busy': 'Línea ocupada',
    'dial_no_answer': 'Sin respuesta',
    'user_hangup': 'Usuario colgó',
    'dial_failed': 'Llamada fallida',
    'voicemail_reached': 'Buzón de voz',
    'call_transfer': 'Llamada transferida',
    'inactivity': 'Inactividad',
    'machine_detected': 'Máquina detectada',
    'error': 'Error',
    'unknown': 'Desconocida'
  };
  
  return translations[reason] || reason;
}



// Función para traducir tipos de vivienda
export function translateHousingType(type: string): string {
  const translations: Record<string, string> = {
    'no_identificado': 'No identificado',
    'casa': 'Casa',
    'alquiler': 'Alquiler',
    'piso': 'Piso',
    'apartamento': 'Apartamento',
    'duplex': 'Dúplex',
    'chalet': 'Chalet',
    'estudio': 'Estudio'
  };
  
  return translations[type] || type;
}



// Función para traducir interés
export function translateInterest(interest: string): string {
  const translations: Record<string, string> = {
    'call_after': 'Call After',
    'not_interested': 'No Interesado',
    'yes_call': 'Sí Llamar'
  };
  
  return translations[interest] || interest;
}



// Función para generar datos del gráfico de desconexión
export function generateDisconnectionData(calls: any[], dashboardData?: any) {
  // Si tenemos datos del dashboard, usarlos directamente
  if (dashboardData?.dashboard_data?.razones_desconexion && Array.isArray(dashboardData.dashboard_data.razones_desconexion)) {
    return dashboardData.dashboard_data.razones_desconexion
      .map((item: any) => ({ 
        reason: item.razon || 'Desconocida', 
        count: item.total || 0,
        percentage: item.porcentaje || 0
      }))
      .slice(0, 5); // Top 5 razones
  }
  
  return [];
}



// Función para generar datos del gráfico de llamadas por día
export function generateDailyCallsData(dashboardData?: any) {
  if (dashboardData?.dashboard_data?.llamadas_por_dia && Array.isArray(dashboardData.dashboard_data.llamadas_por_dia)) {
    return dashboardData.dashboard_data.llamadas_por_dia.map((item: any) => ({
      label: item.dia_label || item.fecha,
      llamadas: item.total_llamadas || 0,
      costo: item.costo_dia || 0,
      fecha: item.fecha
    }));
  }
  
  return [];
}



// Función para generar datos del gráfico de llamadas efectivas por hora
export function generateEffectiveCallsData(dashboardData?: any, hourStart?: string, hourEnd?: string) {
  if (dashboardData?.dashboard_data?.llamadas_efectivas_por_hora && Array.isArray(dashboardData.dashboard_data.llamadas_efectivas_por_hora)) {
    const startHour = parseInt(hourStart || '0');
    const endHour = parseInt(hourEnd || '23');
    
    // Crear un mapa de los datos existentes para acceso rápido
    const dataMap = new Map();
    dashboardData.dashboard_data.llamadas_efectivas_por_hora.forEach((item: any) => {
      dataMap.set(parseInt(item.hora), item.cantidad_llamadas || 0);
    });
    
    // Generar datos solo para las horas que tienen registros
    const dataWithRecords = [];
    for (let hour = startHour; hour <= endHour; hour++) {
      const llamadas = dataMap.get(hour) || 0;
      if (llamadas > 0) { // Solo incluir horas con registros
        dataWithRecords.push({
          label: `${hour.toString().padStart(2, '0')}:00`,
          llamadas: llamadas,
          hour: hour
        });
      }
    }
    
    return dataWithRecords;
  }
  
  return [];
}



// Función para generar datos del gráfico de tipos de vivienda (por llamadas)
export function generateHousingTypeData(dashboardData?: any) {
  if (dashboardData?.dashboard_data?.tipos_vivienda && Array.isArray(dashboardData.dashboard_data.tipos_vivienda)) {
    // Filtrar excluyendo "no_identificado"
    const filteredData = dashboardData.dashboard_data.tipos_vivienda.filter((item: any) => 
      item.tipo !== 'no_identificado'
    );
    
    // Calcular el total de los datos filtrados para recalcular porcentajes
    const totalFiltered = filteredData.reduce((sum: number, item: any) => sum + (item.cantidad || 0), 0);
    
    return filteredData.map((item: any) => ({
      label: translateHousingType(item.tipo),
      cantidad: item.cantidad || 0,
      porcentaje: totalFiltered > 0 ? ((item.cantidad || 0) / totalFiltered * 100).toFixed(2) : '0',
      tipo: item.tipo
    }));
  }
  
  return [];
}



// Función para generar datos del gráfico de agendas por tipo de vivienda (por agendas)
export function generateAgendaHousingTypeData(dashboardData?: any) {
  if (dashboardData?.dashboard_data?.tipos_vivienda_agendas && Array.isArray(dashboardData.dashboard_data.tipos_vivienda_agendas)) {
    const raw = dashboardData.dashboard_data.tipos_vivienda_agendas;
    // Calcular total de agendas para porcentajes
    const total = raw.reduce((sum: number, item: any) => sum + (item.cantidad || 0), 0);
    if (total <= 0) {
      // No hay agendas clasificadas por tipo_vivienda, pero puede haber agendas totales.
      const totalAgendamientos = dashboardData?.dashboard_data?.metricas_generales?.total_agendamientos || 0;
      if (totalAgendamientos > 0) {
        return [{
          label: 'Sin tipo de propiedad',
          cantidad: totalAgendamientos,
          porcentaje: 100,
          tipo: 'sin_tipo',
        }];
      }
      return [];
    }

    return raw
      .map((item: any) => ({
        label: translateHousingType(item.tipo),
        cantidad: item.cantidad || 0,
        porcentaje: ((item.cantidad || 0) / total) * 100,
        tipo: item.tipo
      }))
      .filter((item: any) => item.cantidad > 0);
  }
  return [];
}



// Función para generar datos del gráfico de interés
export function generateInterestData(dashboardData?: any) {
  if (dashboardData?.dashboard_data?.interes && Array.isArray(dashboardData.dashboard_data.interes)) {
    // Calcular el total para recalcular porcentajes
    const total = dashboardData.dashboard_data.interes.reduce((sum: number, item: any) => sum + (item.cantidad || 0), 0);
    
    return dashboardData.dashboard_data.interes.map((item: any) => ({
      label: translateInterest(item.interes),
      cantidad: item.cantidad || 0,
      porcentaje: total > 0 ? ((item.cantidad || 0) / total * 100).toFixed(2) : '0',
      interes: item.interes
    }));
  }
  
  return [];
}



// Función para generar datos del gráfico de agentes por agendas
export function generateAgentesPorAgendasData(dashboardData?: any) {
  if (dashboardData?.dashboard_data?.agentes_por_agendas && Array.isArray(dashboardData.dashboard_data.agentes_por_agendas)) {
    // Calcular el total para recalcular porcentajes
    const total = dashboardData.dashboard_data.agentes_por_agendas.reduce((sum: number, item: any) => sum + (item.cantidad_agendas || 0), 0);
    
    return dashboardData.dashboard_data.agentes_por_agendas.map((item: any) => ({
      label: item.agent_id || 'Sin agente',
      cantidad: item.cantidad_agendas || 0,
      porcentaje: total > 0 ? ((item.cantidad_agendas || 0) / total * 100).toFixed(2) : '0',
      agent_id: item.agent_id
    }));
  }
  
  return [];
}



// Función para generar datos del gráfico de agendamientos por hora
export function generateHourlyAgendasData(dashboardData?: any, hourStart?: string, hourEnd?: string) {
  if (dashboardData?.dashboard_data?.llamadas_por_hora && Array.isArray(dashboardData.dashboard_data.llamadas_por_hora)) {
    const startHour = parseInt(hourStart || '8');
    const endHour = parseInt(hourEnd || '23');
    
    // Crear un mapa de los datos existentes para acceso rápido
    const dataMap = new Map();
    dashboardData.dashboard_data.llamadas_por_hora.forEach((item: any) => {
      dataMap.set(parseInt(item.hora), item.cantidad_agendas || 0);
    });
    
    // Generar datos solo para las horas que tienen registros
    const dataWithRecords = [];
    for (let hour = startHour; hour <= endHour; hour++) {
      const agendas = dataMap.get(hour) || 0;
      if (agendas > 0) { // Solo incluir horas con registros
        dataWithRecords.push({
          label: `${hour.toString().padStart(2, '0')}:00`,
          agendas: agendas,
          hour: hour
        });
      }
    }
    
    return dataWithRecords;
  }
  
  return [];
}

