import React, { useMemo, useState } from 'react';
import type { CallStats, FilterCriteria } from '../types';
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Chart } from "../components/ui/chart";

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
  loadDashboardData?: () => void;
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
  // Log para depurar
  React.useEffect(() => {
    console.log('Dashboard - dashboardData:', dashboardData);
    if (dashboardData) {
      console.log('Dashboard - estadisticas:', dashboardData.estadisticas);
      console.log('Dashboard - razones_desconexion:', dashboardData.razones_desconexion);
    }
  }, [dashboardData]);
  
  // Datos para los gráficos
  const disconnectionData = useMemo(() => generateDisconnectionData([], dashboardData), [dashboardData]);
  const dailyCallsData = useMemo(() => generateDailyCallsData(dashboardData), [dashboardData]);
  const hourlyCallsData = useMemo(() => generateHourlyCallsData(dashboardData), [dashboardData]);
  
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
            <Button onClick={loadDashboardData} variant="default">
              Cargar datos del servidor
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Sección de estadísticas del servidor */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
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
                  {dashboardData?.dashboard_data?.metricas_generales?.total_llamadas?.toLocaleString() || 0}
                </div>
                <p className="text-xs text-gray-400">
                  Total registrado en el servidor
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Llamadas Completadas</CardTitle>
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
                  {dashboardData?.dashboard_data?.metricas_generales?.llamadas_completadas?.toLocaleString() || 0}
                </div>
                <p className="text-xs text-gray-400">
                  {dashboardData?.dashboard_data?.metricas_generales?.porcentaje_completadas 
                    ? `${dashboardData.dashboard_data.metricas_generales.porcentaje_completadas}% del total`
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
                <CardTitle className="text-sm font-medium">Duración Promedio</CardTitle>
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
                  <path d="M12 2v20M17 5H7M17 19H7" />
                </svg>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dashboardData?.dashboard_data?.metricas_generales?.duracion_promedio_segundos 
                    ? (() => {
                        const durationMs = dashboardData.dashboard_data.metricas_generales.duracion_promedio_segundos;
                        const durationSeconds = Math.floor(durationMs / 1000);
                        const minutes = Math.floor(durationSeconds / 60);
                        const seconds = durationSeconds % 60;
                        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
                      })()
                    : "0:00"
                  }
                </div>
                <p className="text-xs text-gray-400">
                  {dashboardData?.dashboard_data?.metricas_generales?.duracion_promedio_segundos 
                    ? `${(dashboardData.dashboard_data.metricas_generales.duracion_promedio_segundos / 60000).toFixed(2)} min (${Math.floor(dashboardData.dashboard_data.metricas_generales.duracion_promedio_segundos / 1000)} segundos)`
                    : "Promedio de todas las llamadas"
                  }
                </p>
              </CardContent>
            </Card>
          </div>
          
          {/* Gráfico de llamadas por día */}
          {dashboardData?.dashboard_data?.llamadas_por_dia && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Llamadas por Día</CardTitle>
                <CardDescription>
                  Evolución de llamadas en los últimos días (datos del servidor)
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