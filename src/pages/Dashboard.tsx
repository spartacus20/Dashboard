import React, { useMemo, useState } from 'react';
import type { CallStats, FilterCriteria } from '../types';
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Chart } from "../components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from "recharts";

// Helpers de zona horaria (Europa/Madrid)
function getMadridYmdParts(date: Date = new Date()): { year: number; month: number; day: number } {
  const fmt = new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const parts = fmt.formatToParts(date);
  const day = Number(parts.find(p => p.type === 'day')?.value || '1');
  const month = Number(parts.find(p => p.type === 'month')?.value || '1');
  const year = Number(parts.find(p => p.type === 'year')?.value || '1970');
  return { year, month, day };
}

function getMadridMidnight(date: Date = new Date()): Date {
  const { year, month, day } = getMadridYmdParts(date);
  // Devuelve el instante UTC correspondiente a 00:00:00 en Madrid de ese día
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function addDaysUTC(base: Date, days: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function formatMadridDateYYYYMMDD(date: Date): string {
  // Formatea a YYYY-MM-DD según la fecha de Madrid representada por "date"
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Componente para mostrar esqueletos de carga
const DashboardSkeleton = () => {
  return (
    <div className="space-y-8">
      {/* Skeleton para las tarjetas de estadísticas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, index) => (
          <Card key={index} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-gray-800 rounded w-1/2 mb-2"></div>
            </CardHeader>
            <CardContent>
              <div className="h-6 bg-gray-800 rounded w-1/3 mb-2"></div>
              <div className="h-4 bg-gray-800 rounded w-1/4"></div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Skeleton para los gráficos */}
      <div className="grid gap-4 md:grid-cols-2">
        {[...Array(2)].map((_, index) => (
          <Card key={index} className="animate-pulse">
            <CardHeader>
              <div className="h-5 bg-gray-800 rounded w-1/3 mb-2"></div>
              <div className="h-4 bg-gray-800 rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] bg-gray-800 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

// Función para traducir razones de desconexión
function translateDisconnectionReason(reason: string): string {
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
function translateHousingType(type: string): string {
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

// Función para generar datos del gráfico de desconexión
function generateDisconnectionData(calls: any[], dashboardData?: any) {
  // Si tenemos datos del dashboard, usarlos directamente
  if (dashboardData?.dashboard_data?.razones_desconexion && Array.isArray(dashboardData.dashboard_data.razones_desconexion)) {
    return dashboardData.dashboard_data.razones_desconexion
      .map((item: any) => ({ 
        reason: translateDisconnectionReason(item.razon || 'Desconocida'), 
        count: item.total || 0,
        percentage: item.porcentaje || 0
      }))
      .slice(0, 5); // Top 5 razones
  }
  
  return [];
}

// Función para generar datos del gráfico de llamadas por día
function generateDailyCallsData(dashboardData?: any) {
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
function generateEffectiveCallsData(dashboardData?: any, hourStart?: string, hourEnd?: string) {
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

// Función para generar datos del gráfico de tipos de vivienda
function generateHousingTypeData(dashboardData?: any) {
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

// Función para generar datos del gráfico de agendamientos por hora
function generateHourlyAgendasData(dashboardData?: any, hourStart?: string, hourEnd?: string) {
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

interface DashboardProps {
  stats: CallStats;
  loading: boolean;
  error: string | null;
  onReload: () => void;
  filterCriteria: FilterCriteria;
  onFilterChange: (key: keyof FilterCriteria, value: any) => void;
  disconnectionReasons: string[];
  totalCalls: number;
  filteredCallsCount: number;
  dashboardData?: any;
  loadDashboardData?: (fechaInicio?: string, fechaFin?: string, timePeriod?: string) => void;
  agendaEnabled?: boolean;
}

export function Dashboard({
  stats,
  loading,
  error,
  onReload,
  filterCriteria,
  onFilterChange,
  disconnectionReasons,
  totalCalls,
  filteredCallsCount,
  dashboardData,
  loadDashboardData,
  agendaEnabled = true
}: DashboardProps) {
  // Error boundary simple
  const [hasError, setHasError] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string>('');

  React.useEffect(() => {
    const handleError = (error: ErrorEvent) => {
      console.error('Error capturado en Dashboard:', error);
      setHasError(true);
      setErrorMessage(error.message || 'Error desconocido');
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Error en el Dashboard</h2>
          <p className="text-red-700 mb-4">{errorMessage}</p>
          <button 
            onClick={() => {
              setHasError(false);
              setErrorMessage('');
              window.location.reload();
            }}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Recargar página
          </button>
        </div>
      </div>
    );
  }

  // Estados para filtros de período (persistir para evitar "rebote" tras remount)
  const [timePeriod, setTimePeriod] = useState<string>(() => {
    try {
      return localStorage.getItem('dashboard_time_period') || 'today';
    } catch {
      return 'today';
    }
  });
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  
  // Estados para filtro de rango de horas (agendamientos)
  const [hourRangeStart, setHourRangeStart] = useState<string>('8');
  const [hourRangeEnd, setHourRangeEnd] = useState<string>('23');
  
  // Estados para filtro de rango de horas (llamadas efectivas)
  const [effectiveCallsHourStart, setEffectiveCallsHourStart] = useState<string>('0');
  const [effectiveCallsHourEnd, setEffectiveCallsHourEnd] = useState<string>('23');
  
  // Función para validar y actualizar el rango de horas (agendamientos)
  const handleHourRangeChange = (type: 'start' | 'end', value: string) => {
    const startHour = parseInt(type === 'start' ? value : hourRangeStart);
    const endHour = parseInt(type === 'end' ? value : hourRangeEnd);
    
    if (type === 'start') {
      setHourRangeStart(value);
      // Si la hora de inicio es mayor que la de fin, ajustar la de fin
      if (startHour > endHour) {
        setHourRangeEnd(value);
      }
    } else {
      setHourRangeEnd(value);
      // Si la hora de fin es menor que la de inicio, ajustar la de inicio
      if (endHour < startHour) {
        setHourRangeStart(value);
      }
    }
  };
  
  // Función para validar y actualizar el rango de horas (llamadas efectivas)
  const handleEffectiveCallsHourRangeChange = (type: 'start' | 'end', value: string) => {
    const startHour = parseInt(type === 'start' ? value : effectiveCallsHourStart);
    const endHour = parseInt(type === 'end' ? value : effectiveCallsHourEnd);
    
    if (type === 'start') {
      setEffectiveCallsHourStart(value);
      // Si la hora de inicio es mayor que la de fin, ajustar la de fin
      if (startHour > endHour) {
        setEffectiveCallsHourEnd(value);
      }
    } else {
      setEffectiveCallsHourEnd(value);
      // Si la hora de fin es menor que la de inicio, ajustar la de inicio
      if (endHour < startHour) {
        setEffectiveCallsHourStart(value);
      }
    }
  };
  
  // Log para depurar
  React.useEffect(() => {
    console.log('Dashboard - dashboardData:', dashboardData);
    if (dashboardData) {
      console.log('Dashboard - estadisticas:', dashboardData.estadisticas);
      console.log('Dashboard - razones_desconexion:', dashboardData.razones_desconexion);
    }
  }, [dashboardData]);

  // Persistir selección de período para evitar que vuelva al anterior por remounts
  React.useEffect(() => {
    try {
      localStorage.setItem('dashboard_time_period', timePeriod);
    } catch {}
  }, [timePeriod]);

  // Efecto para cargar datos la primera vez con el período seleccionado
  React.useEffect(() => {
    if (!loadDashboardData) return;
    // Solo cargar en el primer render
    if (timePeriod === 'today') {
      // Para 'today', usar el endpoint específico sin fechas
      loadDashboardData(undefined, undefined, 'today');
    }
  }, [loadDashboardData]);

  // Función para calcular las fechas según el período seleccionado (zona horaria Madrid)
  const calculateDatesForPeriod = (period: string, customStart?: string, customEnd?: string) => {
    const todayMadrid = getMadridMidnight();
    
    switch (period) {
      case 'today':
        const todayStr = formatMadridDateYYYYMMDD(todayMadrid);
        const tomorrow = addDaysUTC(todayMadrid, 1);
        const tomorrowStr = formatMadridDateYYYYMMDD(tomorrow);
        return { fechaInicio: todayStr, fechaFin: tomorrowStr };
      
      case 'week':
        const weekStart = addDaysUTC(todayMadrid, -7);
        const weekStartStr = formatMadridDateYYYYMMDD(weekStart);
        const tomorrowStr2 = addDaysUTC(todayMadrid, 1);
        return { fechaInicio: weekStartStr, fechaFin: formatMadridDateYYYYMMDD(tomorrowStr2) };
      
      case 'month':
        // Restar 30 días como aproximación a "último mes" respecto a Madrid
        const monthStart = addDaysUTC(todayMadrid, -30);
        const monthStartStr = formatMadridDateYYYYMMDD(monthStart);
        const tomorrowStr3 = addDaysUTC(todayMadrid, 1);
        return { fechaInicio: monthStartStr, fechaFin: formatMadridDateYYYYMMDD(tomorrowStr3) };
      
      case 'custom':
        if (customStart && customEnd) {
          // Interpretar fechas YYYY-MM-DD en zona Madrid y convertir a rango [start, end+1)
          const [yS, mS, dS] = customStart.split('-').map(Number);
          const [yE, mE, dE] = customEnd.split('-').map(Number);
          const startMadrid = new Date(Date.UTC(yS, (mS || 1) - 1, dS || 1, 0, 0, 0, 0));
          const endMadridPlusOne = addDaysUTC(new Date(Date.UTC(yE, (mE || 1) - 1, dE || 1, 0, 0, 0, 0)), 1);
          return { fechaInicio: formatMadridDateYYYYMMDD(startMadrid), fechaFin: formatMadridDateYYYYMMDD(endMadridPlusOne) };
        }
        return null;
      
      default: // 'all'
        return null;
    }
  };

  // Efecto para recargar datos cuando cambia el filtro de período
  React.useEffect(() => {
    if (!loadDashboardData) return;
    
    if (timePeriod === 'all') {
      // Para "all", cargar sin fechas usando el endpoint genérico
      console.log('Recargando datos del dashboard sin filtros de fecha');
      loadDashboardData(undefined, undefined, 'all');
    } else if (timePeriod === 'custom' && customStartDate && customEndDate) {
      // Para período personalizado, usar fechas específicas
      const dates = calculateDatesForPeriod(timePeriod, customStartDate, customEndDate);
      if (dates) {
        console.log('Recargando datos del dashboard con fechas personalizadas:', dates);
        loadDashboardData(dates.fechaInicio, dates.fechaFin, 'custom');
      }
    } else if (timePeriod === 'today' || timePeriod === 'week' || timePeriod === 'month') {
      // Para otros períodos (today, week, month), usar endpoints específicos
      console.log('Recargando datos del dashboard para período:', timePeriod);
      loadDashboardData(undefined, undefined, timePeriod);
    } else if (timePeriod === 'custom') {
      // No cargar nada hasta que ambas fechas estén seleccionadas
      console.log('Período personalizado seleccionado sin fechas completas: esperando selección de rangos');
    }
  }, [timePeriod, customStartDate, customEndDate, loadDashboardData]);

  // Función para filtrar datos por período (usando medianoche en Madrid)
  const filterDataByPeriod = (data: any[], dateField: string = 'fecha') => {
    if (!data || !Array.isArray(data)) return data;
    
    try {
      const today = getMadridMidnight();
      
      switch (timePeriod) {
        case 'today':
          const tomorrowForFilter = addDaysUTC(today, 1);
          return data.filter(item => {
            try {
              const itemDate = new Date(item[dateField]);
              return (
                !isNaN(itemDate.getTime()) && 
                itemDate >= today && 
                itemDate < tomorrowForFilter
              );
            } catch (error) {
              console.warn('Error procesando fecha:', item[dateField], error);
              return false;
            }
          });
        
        case 'week':
          const weekStart = addDaysUTC(today, -7);
          return data.filter(item => {
            try {
              const itemDate = new Date(item[dateField]);
              return !isNaN(itemDate.getTime()) && itemDate >= weekStart;
            } catch (error) {
              console.warn('Error procesando fecha:', item[dateField], error);
              return false;
            }
          });
        
        case 'month':
          const monthStart = addDaysUTC(today, -30);
          return data.filter(item => {
            try {
              const itemDate = new Date(item[dateField]);
              return !isNaN(itemDate.getTime()) && itemDate >= monthStart;
            } catch (error) {
              console.warn('Error procesando fecha:', item[dateField], error);
              return false;
            }
          });
        
        case 'custom':
          if (customStartDate && customEndDate) {
            try {
              const [yS, mS, dS] = customStartDate.split('-').map(Number);
              const [yE, mE, dE] = customEndDate.split('-').map(Number);
              const startDate = new Date(Date.UTC(yS, (mS || 1) - 1, dS || 1, 0, 0, 0, 0));
              const endDateExclusive = addDaysUTC(new Date(Date.UTC(yE, (mE || 1) - 1, dE || 1, 0, 0, 0, 0)), 1);
              return data.filter(item => {
                try {
                  const itemDate = new Date(item[dateField]);
                  return !isNaN(itemDate.getTime()) && itemDate >= startDate && itemDate < endDateExclusive;
                } catch (error) {
                  console.warn('Error procesando fecha:', item[dateField], error);
                  return false;
                }
              });
            } catch (error) {
              console.warn('Error procesando fechas personalizadas:', error);
              return data;
            }
          }
          return data;
        
        default:
          return data;
      }
    } catch (error) {
      console.error('Error en filterDataByPeriod:', error);
      return data;
    }
  };
  
  // Datos para los gráficos con filtrado
  const filteredDailyData = useMemo(() => {
    try {
      if (dashboardData?.dashboard_data?.llamadas_por_dia) {
        console.log('Datos originales de llamadas_por_dia:', dashboardData.dashboard_data.llamadas_por_dia);
        const filtered = filterDataByPeriod(dashboardData.dashboard_data.llamadas_por_dia, 'fecha');
        console.log('Datos filtrados:', filtered);
        return filtered;
      }
      console.log('No hay datos de llamadas_por_dia en dashboardData');
      return [];
    } catch (error) {
      console.error('Error procesando filteredDailyData:', error);
      return [];
    }
  }, [dashboardData, timePeriod, customStartDate, customEndDate]);

  const disconnectionData = useMemo(() => generateDisconnectionData([], dashboardData), [dashboardData]);
  const dailyCallsData = useMemo(() => {
    console.log('Procesando dailyCallsData con filteredDailyData:', filteredDailyData);
    try {
      if (filteredDailyData && filteredDailyData.length > 0) {
        const processedData = filteredDailyData.map((item: any) => {
          try {
            return {
              label: item.dia_label || item.fecha || 'Fecha desconocida',
              llamadas: Number(item.total_llamadas) || 0,
              costo: Number(item.costo_dia) || 0,
              fecha: item.fecha || ''
            };
          } catch (error) {
            console.warn('Error procesando item en dailyCallsData:', item, error);
            return {
              label: 'Error',
              llamadas: 0,
              costo: 0,
              fecha: ''
            };
          }
        });
        console.log('dailyCallsData procesado:', processedData);
        return processedData;
      }
      console.log('No hay datos filtrados para dailyCallsData');
      return [];
    } catch (error) {
      console.error('Error procesando dailyCallsData:', error);
      return [];
    }
  }, [filteredDailyData]);
  
  const hourlyAgendasData = useMemo(() => generateHourlyAgendasData(dashboardData, hourRangeStart, hourRangeEnd), [dashboardData, hourRangeStart, hourRangeEnd]);
  const housingTypeData = useMemo(() => generateHousingTypeData(dashboardData), [dashboardData]);
  const effectiveCallsData = useMemo(() => generateEffectiveCallsData(dashboardData, effectiveCallsHourStart, effectiveCallsHourEnd), [dashboardData, effectiveCallsHourStart, effectiveCallsHourEnd]);

  // Log para verificar datos del gráfico
  React.useEffect(() => {
    console.log('Renderizando Chart con datos:', dailyCallsData);
  }, [dailyCallsData]);
  
  // Métricas calculadas con datos filtrados
  const filteredMetrics = useMemo(() => {
    if (!filteredDailyData || filteredDailyData.length === 0) {
      return {
        totalLlamadas: dashboardData?.dashboard_data?.metricas_generales?.total_llamadas || 0,
        costoTotal: dashboardData?.dashboard_data?.llamadas_por_dia 
          ? dashboardData.dashboard_data.llamadas_por_dia.reduce((sum: number, item: any) => sum + (item.costo_dia || 0), 0)
          : 0
      };
    }
    
    const totalLlamadas = filteredDailyData.reduce((sum: number, item: any) => sum + (item.total_llamadas || 0), 0);
    const costoTotal = filteredDailyData.reduce((sum: number, item: any) => sum + (item.costo_dia || 0), 0);
    
    return { totalLlamadas, costoTotal };
  }, [filteredDailyData, dashboardData]);

  // Eliminar la Card y el contenido del gráfico de llamadas por día
  
  // Procesar los datos para el gráfico apilado (efectivas/fallidas) optimizado
  const stackedDailyChartData = React.useMemo(() => {
    // Filtrar días sin llamadas
    const filtered = filteredDailyData.filter(item => {
      const anyItem = item as any;
      const total = (typeof anyItem.llamadas_efectivas === 'number' ? anyItem.llamadas_efectivas : 0)
        + (typeof anyItem.llamadas_fallidas === 'number' ? anyItem.llamadas_fallidas : 0);
      return total > 0;
    });
    // Limitar a los últimos 30 días si hay muchos datos
    const limited = filtered.length > 30 ? filtered.slice(-30) : filtered;
    return limited.map(item => {
      const anyItem = item as any;
      return {
        label: item.label,
        efectivas: typeof anyItem.llamadas_efectivas === 'number' ? anyItem.llamadas_efectivas : 0,
        fallidas: typeof anyItem.llamadas_fallidas === 'number' ? anyItem.llamadas_fallidas : 0,
        fecha: item.fecha,
        costo: typeof anyItem.costo_dia === 'number' ? anyItem.costo_dia : 0
      };
    });
  }, [filteredDailyData]);
  
  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-indigo-800 mb-2">Dashboard</h2>
        <p className="text-slate-600">
          Análisis de llamadas con uMindsAI
        </p>
        {dashboardData && (
          <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Datos actualizados del servidor
          </div>
        )}
      </div>


      {/* Filtros de período */}
      {dashboardData && (
        <div className="mb-6 flex flex-wrap gap-4 items-center p-4 bg-slate-100 rounded-lg border border-slate-200">
          <div className="flex items-center gap-2">
            <label htmlFor="timePeriod" className="text-sm font-medium text-slate-700">
              Período:
            </label>
            <Select value={timePeriod} onValueChange={setTimePeriod}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Seleccionar período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los datos</SelectItem>
                <SelectItem value="today">Hoy</SelectItem>
                <SelectItem value="week">Última semana</SelectItem>
                <SelectItem value="month">Último mes</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {timePeriod === 'custom' && (
            <div className="flex gap-4 items-center">
              <div className="flex items-center gap-2">
                <label htmlFor="startDate" className="text-sm font-medium text-slate-700">
                  Desde:
                </label>
                <input
                  type="date"
                  id="startDate"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="endDate" className="text-sm font-medium text-slate-700">
                  Hasta:
                </label>
                <input
                  type="date"
                  id="endDate"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
          
          <div className="text-xs text-slate-600">
            {timePeriod === 'all' && 'Mostrando todos los datos disponibles'}
            {timePeriod === 'today' && 'Mostrando datos de hoy'}
            {timePeriod === 'week' && 'Mostrando datos de los últimos 7 días'}
            {timePeriod === 'month' && 'Mostrando datos del último mes'}
            {timePeriod === 'custom' && customStartDate && customEndDate && 
              `Mostrando datos del ${customStartDate} al ${customEndDate}`}
          </div>
        </div>
      )}
      
      {loading ? (
        <DashboardSkeleton />
      ) : error ? (
        <div className="p-8 bg-red-50 rounded-xl border border-red-200">
          <p className="text-red-700">{error}</p>
        </div>
      ) : !dashboardData ? (
        <div className="p-8 bg-yellow-50 rounded-xl border border-yellow-200">
          <p className="text-yellow-700 text-lg mb-4">⚠️ No se han cargado los datos del dashboard desde el servidor.</p>
          {loadDashboardData && (
            <Button onClick={() => loadDashboardData && loadDashboardData(undefined, undefined, timePeriod)} variant="default">
              Cargar datos del servidor
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Sección de estadísticas del servidor */}
          <div className={`grid gap-4 mb-4 ${
            agendaEnabled 
              ? 'md:grid-cols-2 lg:grid-cols-4' 
              : 'md:grid-cols-2 lg:grid-cols-4'
          }`}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-center gap-2 pb-2">
                <CardTitle className="text-sm font-medium text-center">Llamadas Lanzadas</CardTitle>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  className="h-4 w-4 text-muted-foreground"
                >
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                </svg>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center text-center">
                <div className="text-xl font-bold text-center">
                  {dashboardData?.dashboard_data?.metricas_generales?.total_llamadas?.toLocaleString() || 0}
                </div>
                <p className="text-xs text-slate-600 text-center">Total registrado en el servidor</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-center gap-2 pb-2">
                <CardTitle className="text-sm font-medium text-center">Costo Total</CardTitle>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  className="h-4 w-4 text-muted-foreground"
                >
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center text-center">
                <div className="text-xl font-bold text-center">
                  ${dashboardData?.dashboard_data?.metricas_generales?.costo_total?.toFixed(2) || "0.00"}
                </div>
                <p className="text-xs text-slate-600 text-center">Costo total de llamadas</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-center gap-2 pb-2">
                <CardTitle className="text-sm font-medium text-center">Llamadas Contestadas</CardTitle>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  className="h-4 w-4 text-emerald-400"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22,4 12,14.01 9,11.01"/>
                </svg>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center text-center">
                <div className="text-xl font-bold text-center">
                  {(() => {
                    const total = dashboardData?.dashboard_data?.metricas_generales?.total_llamadas || 0;
                    const efectivas = dashboardData?.dashboard_data?.metricas_generales?.llamadas_efectivas || 0;
                    if (total > 0) {
                      return <span className="font-bold">{((efectivas / total) * 100).toFixed(2)}%</span>;
                    }
                    return <span className="font-bold">0%</span>;
                  })()}
                </div>
                <div className="text-xs text-slate-600 text-center">
                  {dashboardData?.dashboard_data?.metricas_generales?.llamadas_efectivas?.toLocaleString() || 0} llamadas contestadas
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-center gap-2 pb-2">
                <CardTitle className="text-sm font-medium text-center">Llamadas Fallidas</CardTitle>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  className="h-4 w-4 text-red-400"
                >
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center text-center">
                <div className="text-xl font-bold text-center">
                  {(() => {
                    const total = dashboardData?.dashboard_data?.metricas_generales?.total_llamadas || 0;
                    const fallidas = dashboardData?.dashboard_data?.metricas_generales?.llamadas_fallidas || 0;
                    if (total > 0) {
                      return <span className="font-bold">{((fallidas / total) * 100).toFixed(2)}%</span>;
                    }
                    return <span className="font-bold">0%</span>;
                  })()}
                </div>
                <div className="text-xs text-slate-600 text-center">
                  {dashboardData?.dashboard_data?.metricas_generales?.llamadas_fallidas?.toLocaleString() || 0} llamadas fallidas
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="grid gap-4 mb-8 md:grid-cols-2 lg:grid-cols-4">
            {agendaEnabled && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-center gap-2 pb-2">
                  <CardTitle className="text-sm font-medium text-center">Total Agendamientos</CardTitle>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    className="h-4 w-4 text-blue-400"
                  >
                    <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
                    <line x1="16" x2="16" y1="2" y2="6"/>
                    <line x1="8" x2="8" y1="2" y2="6"/>
                    <line x1="3" x2="21" y1="10" y2="10"/>
                  </svg>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center text-center">
                  <div className="text-xl font-bold text-center">
                    {(() => {
                      const efectivas = dashboardData?.dashboard_data?.metricas_generales?.llamadas_efectivas || 0;
                      const agendas = dashboardData?.dashboard_data?.metricas_generales?.total_agendamientos || 0;
                      if (efectivas > 0) {
                        return <span className="font-bold">{((agendas / efectivas) * 100).toFixed(2)}%</span>;
                      }
                      return <span className="font-bold">0%</span>;
                    })()}
                  </div>
                  <div className="text-xs text-slate-600 text-center">
                    {dashboardData?.dashboard_data?.metricas_generales?.total_agendamientos?.toLocaleString() || 0} agendamientos
                  </div>
                </CardContent>
              </Card>
            )}
            {agendaEnabled && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-center gap-2 pb-2">
                  <CardTitle className="text-sm font-medium text-center">Costo por Agenda</CardTitle>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    className="h-4 w-4 text-emerald-400"
                  >
                    <line x1="12" x2="12" y1="2" y2="22"/>
                    <path d="M17 5H7L12 2l5 3z"/>
                    <path d="M17 19H7L12 22l5-3z"/>
                    <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
                  </svg>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center text-center">
                  <div className="text-xl font-bold text-center">
                    {(() => {
                      const costo = dashboardData?.dashboard_data?.metricas_generales?.costo_total || 0;
                      const agendas = dashboardData?.dashboard_data?.metricas_generales?.total_agendamientos || 0;
                      if (agendas > 0) {
                        return <span className="font-bold">${(costo / agendas).toFixed(2)}</span>;
                      }
                      return <span className="font-bold">$0.00</span>;
                    })()}
                  </div>
                  <div className="text-xs text-slate-600 text-center">
                    {dashboardData?.dashboard_data?.metricas_generales?.total_agendamientos?.toLocaleString() || 0} agendamientos
                  </div>
                </CardContent>
              </Card>
            )}
            {agendaEnabled && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-center gap-2 pb-2">
                  <CardTitle className="text-sm font-medium text-center">Promedio de Agenda</CardTitle>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    className="h-4 w-4 text-indigo-400"
                  >
                    <path d="M9 12l2 2 4-4"/>
                    <path d="M21 12c.552 0 1-.448 1-1V5c0-.552-.448-1-1-1H3c-.552 0-1 .448-1 1v6c0 .552.448 1 1 1h18z"/>
                    <path d="M3 12h18"/>
                  </svg>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center text-center">
                  <div className="text-xl font-bold text-center">
                    {(() => {
                      const efectivas = dashboardData?.dashboard_data?.metricas_generales?.llamadas_efectivas || 0;
                      const agendas = dashboardData?.dashboard_data?.metricas_generales?.total_agendamientos || 0;
                      if (agendas > 0) {
                        const promedio = efectivas / agendas;
                        return <span className="font-bold">{promedio.toFixed(1)}</span>;
                      }
                      return <span className="font-bold">0.0</span>;
                    })()}
                  </div>
                  <div className="text-xs text-slate-600 text-center">
                    llamadas por agenda
                  </div>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader className="flex flex-row items-center justify-center gap-2 pb-2">
                <CardTitle className="text-sm font-medium text-center">Duración Total de Llamadas</CardTitle>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  className="h-4 w-4 text-slate-400"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center text-center">
                <div className="text-xl font-bold text-center">
                  {(() => {
                    const minutes = dashboardData?.dashboard_data?.metricas_generales?.total_duration_minutes || 0;
                    return <span className="font-bold">{minutes.toLocaleString()} min</span>;
                  })()}
                </div>
                <div className="text-xs text-slate-600 text-center">
                  Suma de duración de llamadas (en minutos)
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Gráfico de llamadas por día */}
          {/* Eliminar la Card y el contenido del gráfico de llamadas por día */}
          
          {/* Gráficos de distribución */}
          <div className={`grid gap-4 mb-8 ${
            agendaEnabled 
              ? 'md:grid-cols-2' 
              : 'md:grid-cols-1'
          }`}>
            {/* Gráfico de agendamientos por hora */}
            {agendaEnabled && hourlyAgendasData && hourlyAgendasData.length > 0 && (
              <Card className="mb-8 shadow-lg border border-slate-200">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <CardTitle className="text-base font-semibold text-slate-800">Agendamientos por Hora</CardTitle>
                      <CardDescription className="text-slate-500">
                        Distribución de agendamientos por hora del día
                      </CardDescription>
                    </div>
                    
                    {/* Filtro de rango de horas */}
                    <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex items-center gap-2">
                        <label htmlFor="hourStart" className="text-xs font-medium text-slate-700">
                          Desde:
                        </label>
                        <Select value={hourRangeStart} onValueChange={(value) => handleHourRangeChange('start', value)}>
                          <SelectTrigger className="w-20 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 24 }, (_, i) => (
                              <SelectItem key={i} value={i.toString()}>
                                {i.toString().padStart(2, '0')}:00
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <label htmlFor="hourEnd" className="text-xs font-medium text-slate-700">
                          Hasta:
                        </label>
                        <Select value={hourRangeEnd} onValueChange={(value) => handleHourRangeChange('end', value)}>
                          <SelectTrigger className="w-20 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 24 }, (_, i) => (
                              <SelectItem key={i} value={i.toString()}>
                                {i.toString().padStart(2, '0')}:00
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="text-xs text-slate-600">
                        {hourRangeStart === '8' && hourRangeEnd === '23' 
                          ? 'Horario laboral (8:00 - 23:00)' 
                          : `${hourRangeStart.padStart(2, '0')}:00 - ${hourRangeEnd.padStart(2, '0')}:00`}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0 md:p-6">
                  <div className="h-[300px] bg-white rounded-xl p-4 md:p-6">
                    <Chart 
                      data={hourlyAgendasData}
                      type="line"
                      xKey="label"
                      yKey="agendas"
                      height={300}
                      colors={["#10b981"]}
                      showLegend={false}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Gráfico de tipos de vivienda */}
            {agendaEnabled && housingTypeData && housingTypeData.length > 0 && (
              <Card className="mb-8 shadow-lg border border-slate-200">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-slate-800">Tipos de Vivienda</CardTitle>
                  <CardDescription className="text-slate-500">
                    Distribución de tipos de vivienda de los clientes
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0 md:p-6">
                  <div className="h-[300px] bg-white rounded-xl p-4 md:p-6">
                    <Chart 
                      data={housingTypeData}
                      type="pie"
                      xKey="label"
                      yKey="cantidad"
                      height={300}
                      colors={["#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ef4444"]}
                      showLegend={true}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          
          {/* Gráficos adicionales */}
          <div className={`grid gap-4 mb-8 ${
            agendaEnabled 
              ? 'md:grid-cols-2' 
              : 'md:grid-cols-1'
          }`}>
            {/* Gráfico de llamadas efectivas por hora */}
            {effectiveCallsData && effectiveCallsData.length > 0 && (
              <Card className="mb-8 shadow-lg border border-slate-200">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <CardTitle className="text-base font-semibold text-slate-800">Llamadas Efectivas por Hora</CardTitle>
                      <CardDescription className="text-slate-500">
                        Distribución de llamadas efectivas a lo largo del día
                      </CardDescription>
                    </div>
                    
                    {/* Filtro de rango de horas */}
                    <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex items-center gap-2">
                        <label htmlFor="effectiveCallsHourStart" className="text-xs font-medium text-slate-700">
                          Desde:
                        </label>
                        <Select value={effectiveCallsHourStart} onValueChange={(value) => handleEffectiveCallsHourRangeChange('start', value)}>
                          <SelectTrigger className="w-20 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 24 }, (_, i) => (
                              <SelectItem key={i} value={i.toString()}>
                                {i.toString().padStart(2, '0')}:00
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <label htmlFor="effectiveCallsHourEnd" className="text-xs font-medium text-slate-700">
                          Hasta:
                        </label>
                        <Select value={effectiveCallsHourEnd} onValueChange={(value) => handleEffectiveCallsHourRangeChange('end', value)}>
                          <SelectTrigger className="w-20 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 24 }, (_, i) => (
                              <SelectItem key={i} value={i.toString()}>
                                {i.toString().padStart(2, '0')}:00
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="text-xs text-slate-600">
                        {effectiveCallsHourStart === '0' && effectiveCallsHourEnd === '23' 
                          ? 'Todas las horas' 
                          : `${effectiveCallsHourStart.padStart(2, '0')}:00 - ${effectiveCallsHourEnd.padStart(2, '0')}:00`}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0 md:p-6">
                  <div className="h-[300px] bg-white rounded-xl p-4 md:p-6">
                    <Chart 
                      data={effectiveCallsData}
                      type="line"
                      xKey="label"
                      yKey="llamadas"
                      height={300}
                      colors={["#dc2626"]}
                      showLegend={false}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Gráfico de razones de desconexión */}
            {disconnectionData && disconnectionData.length > 0 && (
              <Card className="mb-8 shadow-lg border border-slate-200">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-slate-800">Principales Razones de Desconexión</CardTitle>
                  <CardDescription className="text-slate-500">
                    Top {Math.min(5, disconnectionData.length)} razones con porcentajes
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0 md:p-6">
                  <div className="h-[300px] bg-white rounded-xl p-4 md:p-6">
                    <Chart 
                      data={disconnectionData}
                      type="pie"
                      xKey="reason"
                      yKey="count"
                      height={300}
                      colors={["#8b5cf6", "#d946ef", "#a855f7", "#6366f1", "#3b82f6"]}
                      showLegend={true}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          
          {/* Resumen detallado de llamadas efectivas por hora */}
          {dashboardData?.dashboard_data?.llamadas_efectivas_por_hora && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Resumen de Llamadas Efectivas por Hora</CardTitle>
                <CardDescription>
                  Horas con mayor actividad de llamadas efectivas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {dashboardData.dashboard_data.llamadas_efectivas_por_hora
                    .sort((a: any, b: any) => (b.cantidad_llamadas || 0) - (a.cantidad_llamadas || 0))
                    .slice(0, 8)
                    .map((item: any, index: number) => (
                      <div key={`${item.hora}-${index}`} className="bg-gradient-to-br from-red-50 to-rose-100 p-4 rounded-lg border border-red-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-red-700">
                            {item.hora_label || `${item.hora.toString().padStart(2, '0')}:00`}
                          </span>
                          <span className="text-xs text-red-600">
                            #{index + 1}
                          </span>
                        </div>
                        <div className="text-2xl font-bold text-red-900 mb-2">
                          {item.cantidad_llamadas.toLocaleString()}
                        </div>
                        <div className="text-xs text-red-600">
                          llamadas efectivas
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Resumen detallado de tipos de vivienda */}
          {agendaEnabled && dashboardData?.dashboard_data?.tipos_vivienda && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Resumen Detallado de Tipos de Vivienda</CardTitle>
                <CardDescription>
                  Estadísticas completas de distribución de viviendas (excluyendo no identificados)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dashboardData.dashboard_data.tipos_vivienda
                    .filter((item: any) => item.tipo !== 'no_identificado')
                    .map((item: any, index: number) => {
                      // Calcular porcentaje basado en datos filtrados
                      const totalFiltered = dashboardData.dashboard_data.tipos_vivienda
                        .filter((filterItem: any) => filterItem.tipo !== 'no_identificado')
                        .reduce((sum: number, filterItem: any) => sum + (filterItem.cantidad || 0), 0);
                      const porcentaje = totalFiltered > 0 ? ((item.cantidad || 0) / totalFiltered * 100).toFixed(2) : '0';
                      
                      return (
                        <div key={`${item.tipo}-${index}`} className="bg-gradient-to-br from-orange-50 to-amber-100 p-4 rounded-lg border border-orange-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-orange-700">
                              {translateHousingType(item.tipo)}
                            </span>
                            <span className="text-xs text-orange-600">
                              {porcentaje}%
                            </span>
                          </div>
                          <div className="text-2xl font-bold text-orange-900 mb-2">
                            {item.cantidad.toLocaleString()}
                          </div>
                          <div className="w-full bg-orange-200 rounded-full h-2">
                            <div 
                              className="bg-gradient-to-r from-orange-600 to-amber-600 h-2 rounded-full transition-all duration-500"
                              style={{ width: `${porcentaje}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Resumen detallado de desconexiones */}
          {dashboardData?.dashboard_data?.razones_desconexion && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Resumen Detallado de Desconexiones</CardTitle>
                <CardDescription>
                  Estadísticas completas con números y porcentajes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dashboardData.dashboard_data.razones_desconexion.slice(0, 6).map((item: any, index: number) => (
                    <div key={`${item.razon}-${index}`} className="bg-gradient-to-br from-purple-50 to-violet-100 p-4 rounded-lg border border-purple-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-purple-700">
                          {translateDisconnectionReason(item.razon)}
                        </span>
                        <span className="text-xs text-purple-600">
                          {item.porcentaje}%
                        </span>
                      </div>
                      <div className="text-2xl font-bold text-purple-900 mb-2">
                        {item.total.toLocaleString()}
                      </div>
                      <div className="w-full bg-purple-200 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-purple-600 to-indigo-600 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${item.porcentaje}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Tabla detallada de llamadas efectivas por hora */}
          {dashboardData?.dashboard_data?.llamadas_efectivas_por_hora && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Análisis Detallado de Llamadas Efectivas por Hora</CardTitle>
                <CardDescription>
                  Distribución completa de llamadas efectivas a lo largo del día
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Hora</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">Llamadas Efectivas</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">Porcentaje</th>
                        <th className="py-3 px-4 text-sm font-medium text-slate-600">Distribución</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardData.dashboard_data.llamadas_efectivas_por_hora
                        .sort((a: any, b: any) => parseInt(a.hora) - parseInt(b.hora))
                        .map((item: any, index: number) => {
                          const total = dashboardData.dashboard_data.llamadas_efectivas_por_hora
                            .reduce((sum: number, totalItem: any) => sum + (totalItem.cantidad_llamadas || 0), 0);
                          const porcentaje = total > 0 ? ((item.cantidad_llamadas || 0) / total * 100).toFixed(2) : '0';
                          
                          return (
                            <tr key={`${item.hora}-${index}`} className="border-b border-slate-200 hover:bg-slate-50">
                              <td className="py-3 px-4 text-sm text-slate-700 font-medium">
                                {item.hora_label || `${item.hora.toString().padStart(2, '0')}:00`}
                              </td>
                              <td className="py-3 px-4 text-sm text-slate-600 text-right">
                                {(item.cantidad_llamadas || 0).toLocaleString()}
                              </td>
                              <td className="py-3 px-4 text-sm text-slate-600 text-right">
                                {porcentaje}%
                              </td>
                              <td className="py-3 px-4">
                                <div className="w-full bg-slate-200 rounded-full h-2">
                                  <div 
                                    className="bg-gradient-to-r from-red-600 to-rose-600 h-2 rounded-full transition-all duration-500"
                                    style={{ width: `${porcentaje}%` }}
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-slate-200 bg-slate-50">
                        <td className="py-3 px-4 text-sm font-medium text-slate-600">Total</td>
                        <td className="py-3 px-4 text-sm font-medium text-slate-800 text-right">
                          {dashboardData.dashboard_data.llamadas_efectivas_por_hora
                            .reduce((sum: number, item: any) => sum + (item.cantidad_llamadas || 0), 0)
                            .toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-sm font-medium text-slate-600 text-right">
                          100%
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Tabla detallada de tipos de vivienda */}
          {agendaEnabled && dashboardData?.dashboard_data?.tipos_vivienda && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Análisis Detallado de Tipos de Vivienda</CardTitle>
                <CardDescription>
                  Distribución completa de los tipos de vivienda de los clientes (excluyendo no identificados)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Tipo de Vivienda</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">Cantidad</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">Porcentaje</th>
                        <th className="py-3 px-4 text-sm font-medium text-slate-600">Distribución</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardData.dashboard_data.tipos_vivienda
                        .filter((item: any) => item.tipo !== 'no_identificado')
                        .map((item: any, index: number) => {
                          // Calcular porcentaje basado en datos filtrados
                          const totalFiltered = dashboardData.dashboard_data.tipos_vivienda
                            .filter((filterItem: any) => filterItem.tipo !== 'no_identificado')
                            .reduce((sum: number, filterItem: any) => sum + (filterItem.cantidad || 0), 0);
                          const porcentaje = totalFiltered > 0 ? ((item.cantidad || 0) / totalFiltered * 100).toFixed(2) : '0';
                          
                          return (
                            <tr key={`${item.tipo}-${index}`} className="border-b border-slate-200 hover:bg-slate-50">
                              <td className="py-3 px-4 text-sm text-slate-700 font-medium">
                                {translateHousingType(item.tipo || 'Desconocido')}
                              </td>
                              <td className="py-3 px-4 text-sm text-slate-600 text-right">
                                {(item.cantidad || 0).toLocaleString()}
                              </td>
                              <td className="py-3 px-4 text-sm text-slate-600 text-right">
                                {porcentaje}%
                              </td>
                              <td className="py-3 px-4">
                                <div className="w-full bg-slate-200 rounded-full h-2">
                                  <div 
                                    className="bg-gradient-to-r from-orange-600 to-amber-600 h-2 rounded-full transition-all duration-500"
                                    style={{ width: `${porcentaje}%` }}
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-slate-200 bg-slate-50">
                        <td className="py-3 px-4 text-sm font-medium text-slate-600">Total</td>
                        <td className="py-3 px-4 text-sm font-medium text-slate-800 text-right">
                          {dashboardData.dashboard_data.tipos_vivienda
                            .filter((item: any) => item.tipo !== 'no_identificado')
                            .reduce((sum: number, item: any) => sum + (item.cantidad || 0), 0)
                            .toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-sm font-medium text-slate-600 text-right">
                          100%
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Tabla detallada de razones de desconexión */}
          {dashboardData?.dashboard_data?.razones_desconexion && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Análisis Detallado de Desconexiones</CardTitle>
                <CardDescription>
                  Distribución completa de las razones por las que terminan las llamadas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Razón</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">Total</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">Porcentaje</th>
                        <th className="py-3 px-4 text-sm font-medium text-slate-600">Distribución</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardData.dashboard_data.razones_desconexion.map((item: any, index: number) => (
                        <tr key={`${item.razon}-${index}`} className="border-b border-slate-200 hover:bg-slate-50">
                          <td className="py-3 px-4 text-sm text-slate-700 font-medium">
                            {translateDisconnectionReason(item.razon || 'Desconocida')}
                          </td>
                          <td className="py-3 px-4 text-sm text-slate-600 text-right">
                            {(item.total || 0).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-sm text-slate-600 text-right">
                            {item.porcentaje || 0}%
                          </td>
                          <td className="py-3 px-4">
                            <div className="w-full bg-slate-200 rounded-full h-2">
                              <div 
                                className="bg-gradient-to-r from-purple-600 to-indigo-600 h-2 rounded-full transition-all duration-500"
                                style={{ width: `${item.porcentaje || 0}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-slate-200 bg-slate-50">
                        <td className="py-3 px-4 text-sm font-medium text-slate-600">Total</td>
                        <td className="py-3 px-4 text-sm font-medium text-slate-800 text-right">
                          {dashboardData.dashboard_data.razones_desconexion
                            .reduce((sum: number, item: any) => sum + (item.total || 0), 0)
                            .toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-sm font-medium text-slate-600 text-right">
                          100%
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}