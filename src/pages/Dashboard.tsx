import React, { useMemo, useState } from 'react';
import type { CallStats, FilterCriteria } from '../types';
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Chart } from "../components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";

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

// Función para generar datos del gráfico de llamadas por hora
function generateHourlyCallsData(dashboardData?: any) {
  if (dashboardData?.dashboard_data?.llamadas_por_hora && Array.isArray(dashboardData.dashboard_data.llamadas_por_hora)) {
    return dashboardData.dashboard_data.llamadas_por_hora.map((item: any) => ({
      label: item.hora_label || `${item.hora}:00`,
      calls: item.llamadas_mas_16_segundos || 0,
      hour: item.hora
    }));
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
  loadDashboardData?: (fechaInicio?: string, fechaFin?: string) => void;
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
  loadDashboardData
}: DashboardProps) {
  // Estados para filtros de período
  const [timePeriod, setTimePeriod] = useState<string>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  
  // Log para depurar
  React.useEffect(() => {
    console.log('Dashboard - dashboardData:', dashboardData);
    if (dashboardData) {
      console.log('Dashboard - estadisticas:', dashboardData.estadisticas);
      console.log('Dashboard - razones_desconexion:', dashboardData.razones_desconexion);
    }
  }, [dashboardData]);

  // Función para calcular las fechas según el período seleccionado
  const calculateDatesForPeriod = (period: string, customStart?: string, customEnd?: string) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (period) {
      case 'today':
        const todayStr = today.toISOString().split('T')[0];
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        return { fechaInicio: todayStr, fechaFin: tomorrowStr };
      
      case 'week':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - 7);
        const weekStartStr = weekStart.toISOString().split('T')[0];
        const tomorrowStr2 = new Date(today);
        tomorrowStr2.setDate(today.getDate() + 1);
        return { fechaInicio: weekStartStr, fechaFin: tomorrowStr2.toISOString().split('T')[0] };
      
      case 'month':
        const monthStart = new Date(today);
        monthStart.setMonth(today.getMonth() - 1);
        const monthStartStr = monthStart.toISOString().split('T')[0];
        const tomorrowStr3 = new Date(today);
        tomorrowStr3.setDate(today.getDate() + 1);
        return { fechaInicio: monthStartStr, fechaFin: tomorrowStr3.toISOString().split('T')[0] };
      
      case 'custom':
        if (customStart && customEnd) {
          const endDate = new Date(customEnd);
          endDate.setDate(endDate.getDate() + 1); // Añadir un día para incluir todo el día final
          return { fechaInicio: customStart, fechaFin: endDate.toISOString().split('T')[0] };
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
      // Para "all", cargar sin fechas
      console.log('Recargando datos del dashboard sin filtros de fecha');
      loadDashboardData(undefined, undefined);
    } else {
      // Para otros períodos, calcular fechas
      const dates = calculateDatesForPeriod(timePeriod, customStartDate, customEndDate);
      if (dates) {
        console.log('Recargando datos del dashboard con nuevas fechas:', dates);
        loadDashboardData(dates.fechaInicio, dates.fechaFin);
      }
    }
  }, [timePeriod, customStartDate, customEndDate, loadDashboardData]);

  // Función para filtrar datos por período
  const filterDataByPeriod = (data: any[], dateField: string = 'fecha') => {
    if (!data || !Array.isArray(data)) return data;
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (timePeriod) {
      case 'today':
        return data.filter(item => {
          const itemDate = new Date(item[dateField]);
          return itemDate >= today;
        });
      
      case 'week':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - 7);
        return data.filter(item => {
          const itemDate = new Date(item[dateField]);
          return itemDate >= weekStart;
        });
      
      case 'month':
        const monthStart = new Date(today);
        monthStart.setMonth(today.getMonth() - 1);
        return data.filter(item => {
          const itemDate = new Date(item[dateField]);
          return itemDate >= monthStart;
        });
      
      case 'custom':
        if (customStartDate && customEndDate) {
          const startDate = new Date(customStartDate);
          const endDate = new Date(customEndDate);
          endDate.setHours(23, 59, 59, 999); // Incluir todo el día final
          return data.filter(item => {
            const itemDate = new Date(item[dateField]);
            return itemDate >= startDate && itemDate <= endDate;
          });
        }
        return data;
      
      default:
        return data;
    }
  };
  
  // Datos para los gráficos con filtrado
  const filteredDailyData = useMemo(() => {
    if (dashboardData?.dashboard_data?.llamadas_por_dia) {
      return filterDataByPeriod(dashboardData.dashboard_data.llamadas_por_dia, 'fecha');
    }
    return [];
  }, [dashboardData, timePeriod, customStartDate, customEndDate]);

  const disconnectionData = useMemo(() => generateDisconnectionData([], dashboardData), [dashboardData]);
  const dailyCallsData = useMemo(() => {
    if (filteredDailyData && filteredDailyData.length > 0) {
      return filteredDailyData.map((item: any) => ({
        label: item.dia_label || item.fecha,
        llamadas: item.total_llamadas || 0,
        costo: item.costo_dia || 0,
        fecha: item.fecha
      }));
    }
    return [];
  }, [filteredDailyData]);
  
  const hourlyCallsData = useMemo(() => generateHourlyCallsData(dashboardData), [dashboardData]);

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
  
  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Dashboard</h2>
        <p className="text-gray-400">
          Análisis de llamadas con uMindsAI
        </p>
        {dashboardData && (
          <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-900/30 text-green-400 border border-green-800">
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Datos actualizados del servidor
          </div>
        )}
      </div>

      {/* Filtros de período */}
      {dashboardData && (
        <div className="mb-6 flex flex-wrap gap-4 items-center p-4 bg-gray-900/50 rounded-lg border border-gray-800">
          <div className="flex items-center gap-2">
            <label htmlFor="timePeriod" className="text-sm font-medium text-gray-300">
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
                <label htmlFor="startDate" className="text-sm font-medium text-gray-300">
                  Desde:
                </label>
                <input
                  type="date"
                  id="startDate"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="endDate" className="text-sm font-medium text-gray-300">
                  Hasta:
                </label>
                <input
                  type="date"
                  id="endDate"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          )}
          
          <div className="text-xs text-gray-400">
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
        <div className="p-8 bg-red-900/20 rounded-xl border border-red-800">
          <p className="text-red-400">{error}</p>
        </div>
      ) : !dashboardData ? (
        <div className="p-8 bg-yellow-900/20 rounded-xl border border-yellow-800">
          <p className="text-yellow-400 text-lg mb-4">⚠️ No se han cargado los datos del dashboard desde el servidor.</p>
          {loadDashboardData && (
            <Button onClick={() => loadDashboardData && loadDashboardData()} variant="default">
              Cargar datos del servidor
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Sección de estadísticas del servidor */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total de Llamadas</CardTitle>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  className="h-4 w-4 text-purple-400"
                >
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {timePeriod === 'all' 
                    ? (dashboardData?.dashboard_data?.metricas_generales?.total_llamadas?.toLocaleString() || 0)
                    : filteredMetrics.totalLlamadas.toLocaleString()
                  }
                </div>
                <p className="text-xs text-gray-400">
                  {timePeriod === 'all' ? 'Total registrado en el servidor' : 'Total en el período seleccionado'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Llamadas Efectivas</CardTitle>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  className="h-4 w-4 text-green-400"
                >
                  <path d="M12 2v20M2 12h20" />
                </svg>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dashboardData?.dashboard_data?.metricas_generales?.llamadas_efectivas?.toLocaleString() || 0}
                </div>
                <p className="text-xs text-gray-400">
                  {dashboardData?.dashboard_data?.metricas_generales?.porcentaje_efectivas 
                    ? `${dashboardData.dashboard_data.metricas_generales.porcentaje_efectivas}% del total`
                    : "0% del total"
                  }
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Llamadas Fallidas</CardTitle>
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
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dashboardData?.dashboard_data?.metricas_generales?.llamadas_fallidas?.toLocaleString() || 0}
                </div>
                <p className="text-xs text-gray-400">
                  {dashboardData?.dashboard_data?.metricas_generales?.porcentaje_fallidas 
                    ? `${dashboardData.dashboard_data.metricas_generales.porcentaje_fallidas}% del total`
                    : "0% del total"
                  }
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Costo Total</CardTitle>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  className="h-4 w-4 text-yellow-400"
                >
                  <path d="M12 2v20M17 5H7L12 2l5 3zM17 19H7L12 22l5-3z" />
                </svg>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${filteredMetrics.costoTotal.toFixed(2)}
                </div>
                <p className="text-xs text-gray-400">
                  {timePeriod === 'all' ? 'Suma de costos por día' : 'Costo en el período seleccionado'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Agendamientos</CardTitle>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  className="h-4 w-4 text-orange-400"
                >
                  <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
                  <line x1="16" x2="16" y1="2" y2="6"/>
                  <line x1="8" x2="8" y1="2" y2="6"/>
                  <line x1="3" x2="21" y1="10" y2="10"/>
                </svg>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dashboardData?.dashboard_data?.metricas_generales?.total_agendamientos?.toLocaleString() || 0}
                </div>
                <p className="text-xs text-gray-400">
                  Citas programadas
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Costo por Agenda</CardTitle>
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
              <CardContent>
                <div className="text-2xl font-bold">
                  ${dashboardData?.dashboard_data?.metricas_generales?.coste_por_agenda?.toFixed(2) || "0.00"}
                </div>
                <p className="text-xs text-gray-400">
                  Costo promedio por cita
                </p>
              </CardContent>
            </Card>
          </div>
          
          {/* Gráfico de llamadas por día */}
          {dailyCallsData && dailyCallsData.length > 0 && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Llamadas por Día</CardTitle>
                <CardDescription>
                  {timePeriod === 'all' 
                    ? 'Evolución de llamadas en los últimos días'
                    : `Evolución de llamadas en el período seleccionado (${dailyCallsData.length} días)`
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <Chart 
                    data={dailyCallsData}
                    type="bar"
                    xKey="label"
                    yKey="llamadas"
                    height={350}
                    colors={["#6366f1"]}
                    showGrid={true}
                  />
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Tabla detallada de llamadas y costos por día */}
          {filteredDailyData && filteredDailyData.length > 0 && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Detalle de Llamadas y Costos por Día</CardTitle>
                <CardDescription>
                  {timePeriod === 'all' 
                    ? 'Análisis día a día de volumen de llamadas y costos asociados'
                    : `Análisis del período seleccionado (${filteredDailyData.length} días)`
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Fecha</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Total Llamadas</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Costo del Día</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Costo por Llamada</th>
                        <th className="py-3 px-4 text-sm font-medium text-gray-400">Tendencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDailyData.map((item: any, index: number) => {
                        const costPerCall = item.total_llamadas > 0 ? (item.costo_dia / item.total_llamadas) : 0;
                        const prevItem = index > 0 ? filteredDailyData[index - 1] : null;
                        const trend = prevItem ? 
                          (item.total_llamadas > prevItem.total_llamadas ? 'up' : 
                           item.total_llamadas < prevItem.total_llamadas ? 'down' : 'equal') : 'equal';
                        
                        return (
                          <tr key={item.fecha} className="border-b border-gray-800 hover:bg-gray-900/50">
                            <td className="py-3 px-4 text-sm text-white font-medium">
                              {item.dia_label || item.fecha}
                              <div className="text-xs text-gray-400">{item.fecha}</div>
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-300 text-right">
                              {(item.total_llamadas || 0).toLocaleString()}
                            </td>
                            <td className="py-3 px-4 text-sm text-yellow-400 text-right font-medium">
                              ${(item.costo_dia || 0).toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-300 text-right">
                              ${costPerCall.toFixed(4)}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center justify-center">
                                {trend === 'up' && (
                                  <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                                {trend === 'down' && (
                                  <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                                {trend === 'equal' && (
                                  <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-gray-700 bg-gray-900/30">
                        <td className="py-3 px-4 text-sm font-medium text-gray-400">Total</td>
                        <td className="py-3 px-4 text-sm font-medium text-white text-right">
                          {filteredMetrics.totalLlamadas.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-sm font-medium text-yellow-400 text-right">
                          ${filteredMetrics.costoTotal.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-sm font-medium text-gray-400 text-right">
                          ${filteredMetrics.totalLlamadas > 0 
                            ? (filteredMetrics.costoTotal / filteredMetrics.totalLlamadas).toFixed(4)
                            : "0.0000"
                          }
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Gráficos de distribución */}
          <div className="grid gap-4 md:grid-cols-2 mb-8">
            {/* Gráfico de llamadas por hora */}
            {dashboardData?.dashboard_data?.llamadas_por_hora && (
              <Card>
                <CardHeader>
                  <CardTitle>Distribución por Hora</CardTitle>
                  <CardDescription>
                    Llamadas por hora del día (más de 16 segundos)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <Chart 
                      data={hourlyCallsData}
                      type="bar"
                      xKey="label"
                      yKey="calls"
                      height={300}
                      colors={["#3b82f6"]}
                      showGrid={true}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Gráfico de razones de desconexión */}
            {dashboardData?.dashboard_data?.razones_desconexion && (
              <Card>
                <CardHeader>
                  <CardTitle>Principales Razones de Desconexión</CardTitle>
                  <CardDescription>
                    Top {Math.min(5, dashboardData.dashboard_data.razones_desconexion.length)} razones con porcentajes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Chart 
                    data={disconnectionData}
                    type="pie"
                    xKey="reason"
                    yKey="count"
                    height={300}
                    colors={["#8b5cf6", "#d946ef", "#a855f7", "#6366f1", "#3b82f6"]}
                  />
                </CardContent>
              </Card>
            )}
          </div>
          
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
                    <div key={index} className="bg-gray-900 p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-300">
                          {translateDisconnectionReason(item.razon)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {item.porcentaje}%
                        </span>
                      </div>
                      <div className="text-2xl font-bold text-white mb-2">
                        {item.total.toLocaleString()}
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2">
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
                      <tr className="border-b border-gray-800">
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Razón</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Total</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Porcentaje</th>
                        <th className="py-3 px-4 text-sm font-medium text-gray-400">Distribución</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardData.dashboard_data.razones_desconexion.map((item: any, index: number) => (
                        <tr key={index} className="border-b border-gray-800 hover:bg-gray-900/50">
                          <td className="py-3 px-4 text-sm text-white font-medium">
                            {translateDisconnectionReason(item.razon || 'Desconocida')}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-300 text-right">
                            {(item.total || 0).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-300 text-right">
                            {item.porcentaje || 0}%
                          </td>
                          <td className="py-3 px-4">
                            <div className="w-full bg-gray-800 rounded-full h-2">
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
                      <tr className="border-t border-gray-700">
                        <td className="py-3 px-4 text-sm font-medium text-gray-400">Total</td>
                        <td className="py-3 px-4 text-sm font-medium text-white text-right">
                          {dashboardData.dashboard_data.razones_desconexion
                            .reduce((sum: number, item: any) => sum + (item.total || 0), 0)
                            .toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-sm font-medium text-gray-400 text-right">
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