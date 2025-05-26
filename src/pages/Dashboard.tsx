import React, { useMemo, useState } from 'react';
import type { RetellCall, CallStats, FilterCriteria } from '../types';
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

// Ejemplo de datos para el gráfico de distribución de llamadas por hora del día
function generateHourlyDistributionData(calls: RetellCall[]) {
  // Inicializar un array con 24 horas
  const hourlyData = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    calls: 0,
    label: `${i}:00`
  }));

  // Filtrar llamadas que duraron más de 16 segundos
  const significantCalls = calls.filter(call => {
    const startTime = call.start_timestamp;
    const endTime = call.end_timestamp;
    return startTime && endTime && (endTime - startTime) > 16000;
  });

  // Contar llamadas por hora
  significantCalls.forEach(call => {
    if (call.start_timestamp) {
      const date = new Date(call.start_timestamp);
      const hour = date.getHours();
      hourlyData[hour].calls++;
    }
  });

  return hourlyData;
}

// Ejemplo de datos para el gráfico de distribución de razones de desconexión
function generateDisconnectionData(calls: RetellCall[]) {
  const disconnectionCounts: Record<string, number> = {};
  
  calls.forEach(call => {
    if (call.disconnection_reason) {
      disconnectionCounts[call.disconnection_reason] = 
        (disconnectionCounts[call.disconnection_reason] || 0) + 1;
    }
  });
  
  return Object.entries(disconnectionCounts)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5); // Top 5 razones
}

// Tipos para el filtro temporal
type TimeRange = 'day' | 'week' | 'month';

// Generar datos para el gráfico de llamadas por día
function generateDailyCallsData(calls: RetellCall[], timeRange: TimeRange) {
  let daysToShow = 7;
  let formatOption: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric' };
  
  switch (timeRange) {
    case 'day':
      daysToShow = 1; // Solo hoy
      formatOption = { hour: '2-digit' }; // Formato de hora
      break;
    case 'week':
      daysToShow = 7; // Últimos 7 días
      formatOption = { weekday: 'short', day: 'numeric' };
      break;
    case 'month':
      daysToShow = 30; // Últimos 30 días
      formatOption = { day: 'numeric', month: 'short' };
      break;
  }
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (daysToShow - 1));
  startDate.setHours(0, 0, 0, 0);
  
  // Función para generar los puntos de datos según el rango temporal
  const generateDataPoints = () => {
    if (timeRange === 'day') {
      // Para "día", mostrar 24 horas
      return Array.from({ length: 24 }, (_, i) => {
        const date = new Date();
        date.setHours(i, 0, 0, 0);
        return {
          date: date.toISOString(),
          hour: i,
          llamadas: 0,
          completadas: 0,
          fallidas: 0,
          label: date.toLocaleTimeString('es-ES', { hour: '2-digit' })
        };
      });
    } else {
      // Para semana o mes
      return Array.from({ length: daysToShow }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (daysToShow - 1) + i);
        date.setHours(0, 0, 0, 0);
        return {
          date: date.toISOString().split('T')[0],
          llamadas: 0,
          completadas: 0,
          fallidas: 0,
          label: date.toLocaleDateString('es-ES', formatOption)
        };
      });
    }
  };
  
  const dataPoints = generateDataPoints();
  
  // Contar llamadas por día/hora y por estado
  calls.forEach(call => {
    if (call.start_timestamp) {
      const callDate = new Date(call.start_timestamp);
      
      // Verificar si la llamada está dentro del rango de tiempo
      if (callDate >= startDate) {
        // Encontrar el índice correspondiente según el rango temporal
        let index: number;
        
        if (timeRange === 'day') {
          // Para "día", el índice es la hora
          index = callDate.getHours();
        } else {
          // Para semana/mes, encontrar el día correspondiente
          const callDateString = callDate.toISOString().split('T')[0];
          index = dataPoints.findIndex(d => d.date === callDateString);
        }
        
        // Si encontramos un índice válido, incrementar los contadores
        if (index >= 0 && index < dataPoints.length) {
          dataPoints[index].llamadas++;
          
          // Clasificar por estado
          const status = (call.call_status || call.status || '').toLowerCase();
          if (status === 'completed' || status === 'ended' || status === 'success') {
            dataPoints[index].completadas++;
          } else if (status === 'failed' || status === 'error' || status === 'failed_to_start') {
            dataPoints[index].fallidas++;
          }
        }
      }
    }
  });
  
  return dataPoints;
}

interface DashboardProps {
  calls: RetellCall[];
  stats: CallStats;
  loading: boolean;
  error: string | null;
  onReload: () => void;
  filterCriteria: FilterCriteria;
  onFilterChange: (key: keyof FilterCriteria, value: any) => void;
  disconnectionReasons: string[];
  totalCalls: number;
  filteredCallsCount: number;
}

export function Dashboard({
  calls,
  stats,
  loading,
  error,
  onReload,
  filterCriteria,
  onFilterChange,
  disconnectionReasons,
  totalCalls,
  filteredCallsCount
}: DashboardProps) {
  // Estado para el filtro temporal del gráfico de llamadas
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  
  // Datos para los gráficos
  const hourlyDistributionData = useMemo(() => generateHourlyDistributionData(calls), [calls]);
  const disconnectionData = useMemo(() => generateDisconnectionData(calls), [calls]);
  const dailyCallsData = useMemo(() => generateDailyCallsData(calls, timeRange), [calls, timeRange]);
  
  // Títulos y descripciones según el rango temporal
  const getTimeRangeTitle = () => {
    switch (timeRange) {
      case 'day': return 'Llamadas por Hora';
      case 'week': return 'Llamadas por Día';
      case 'month': return 'Llamadas por Día (último mes)';
    }
  };
  
  const getTimeRangeDescription = () => {
    switch (timeRange) {
      case 'day': return 'Distribución de llamadas en las últimas 24 horas';
      case 'week': return 'Evolución de llamadas en la última semana';
      case 'month': return 'Evolución de llamadas en los últimos 30 días';
    }
  };
  
  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Dashboard</h2>
        <p className="text-gray-400">
          Análisis de llamadas con uMindsAI
        </p>
      </div>
      
      {loading ? (
        <DashboardSkeleton />
      ) : error ? (
        <div className="p-8 bg-red-900/20 rounded-xl border border-red-800">
          <p className="text-red-400">{error}</p>
        </div>
      ) : (
        <>
          {/* Sección de estadísticas generales */}
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
                <div className="text-2xl font-bold">{stats?.total || 0}</div>
                <p className="text-xs text-gray-400">
                  {filteredCallsCount !== totalCalls ? 
                    `Mostrando ${filteredCallsCount} de ${totalCalls}` :
                    `Total de llamadas registradas`
                  }
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
                <div className="text-2xl font-bold">{stats?.completed || 0}</div>
                <p className="text-xs text-gray-400">
                  {stats && stats.total > 0
                    ? `${Math.round((stats.completed / stats.total) * 100)}% del total`
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
                <div className="text-2xl font-bold">{stats?.failed || 0}</div>
                <p className="text-xs text-gray-400">
                  {stats && stats.total > 0
                    ? `${Math.round((stats.failed / stats.total) * 100)}% del total`
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
                <div className="text-2xl font-bold">{stats?.averageDuration || "0:00"}</div>
                <p className="text-xs text-gray-400">minutos:segundos</p>
              </CardContent>
            </Card>
          </div>
          
          {/* Gráfico de llamadas por día (mejorado con filtro) */}
          <Card className="mb-8">
            <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>{getTimeRangeTitle()}</CardTitle>
                <CardDescription>
                  {getTimeRangeDescription()}
                </CardDescription>
              </div>
              <div className="flex space-x-2 mt-2 md:mt-0">
                <Button
                  variant={timeRange === 'day' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTimeRange('day')}
                >
                  Día
                </Button>
                <Button
                  variant={timeRange === 'week' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTimeRange('week')}
                >
                  Semana
                </Button>
                <Button
                  variant={timeRange === 'month' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTimeRange('month')}
                >
                  Mes
                </Button>
              </div>
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
          
          {/* Gráficos */}
          <div className="grid gap-4 md:grid-cols-2 mb-8">
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Distribución de Llamadas por Hora</CardTitle>
                <CardDescription>
                  Llamadas que duraron más de 16 segundos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Chart 
                  data={hourlyDistributionData}
                  type="bar"
                  xKey="label"
                  yKey="calls"
                  height={300}
                  colors={["#8b5cf6"]}
                />
              </CardContent>
            </Card>
            
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Principales Razones de Desconexión</CardTitle>
                <CardDescription>
                  Top 5 razones por las que terminan las llamadas
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
          </div>
        </>
      )}
    </div>
  );
}