import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Phone, PhoneCall, PhoneOff, Link, MousePointer, Ban, RefreshCw, Calendar, TrendingUp, Globe, CalendarDays, Lock } from 'lucide-react';
import { fetchLanzamientoMetricsToday, fetchLanzamientoMetricsCustom } from '../api';
import { useCallsContext } from '../context/CallsContext';

interface LanzamientoMetrics {
  total_llamadas: number;
  llamadas_contestadas: number;
  llamadas_fallidas: number;
  total_enlaces_enviados: number;
  total_clicks_totales: number;
  total_no_llamar: number;
  porRegion: {
    europa: {
      total_llamadas: number;
      llamadas_contestadas: number;
      llamadas_fallidas: number;
      enlaces_enviados: number;
      clicks_totales: number;
      no_llamar: number;
    };
    latam: {
      total_llamadas: number;
      llamadas_contestadas: number;
      llamadas_fallidas: number;
      enlaces_enviados: number;
      clicks_totales: number;
      no_llamar: number;
    };
    espana: {
      total_llamadas: number;
      llamadas_contestadas: number;
      llamadas_fallidas: number;
      enlaces_enviados: number;
      clicks_totales: number;
      no_llamar: number;
    };
  };
}


const Lanzamiento: React.FC = () => {
  const { launchEnabled } = useCallsContext();
  const [metrics, setMetrics] = useState<LanzamientoMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'today' | 'custom'>('today');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Función helper para procesar los datos de la API y asegurar que siempre se muestren las 3 regiones
  const processApiData = (apiData: any): LanzamientoMetrics => {
    // Crear un mapa de las regiones recibidas
    const regionMap = new Map();
    apiData.metrics_by_region.forEach((region: any) => {
      regionMap.set(region.region.toLowerCase(), region);
    });

    // Función helper para obtener datos de región o valores por defecto
    const getRegionData = (regionName: string) => {
      const regionData = regionMap.get(regionName.toLowerCase());
      return {
        total_llamadas: regionData?.total_llamadas || 0,
        llamadas_contestadas: regionData?.llamadas_contestadas || 0,
        llamadas_fallidas: regionData?.llamadas_fallidas || 0,
        enlaces_enviados: regionData?.enlaces_enviados || 0,
        clicks_totales: regionData?.clicks_totales || 0,
        no_llamar: regionData?.no_llamar || 0,
      };
    };

    return {
      total_llamadas: apiData.total_llamadas,
      llamadas_contestadas: apiData.llamadas_contestadas,
      llamadas_fallidas: apiData.llamadas_fallidas,
      total_enlaces_enviados: apiData.total_enlaces_enviados,
      total_clicks_totales: apiData.total_clicks_totales,
      total_no_llamar: apiData.total_no_llamar,
      porRegion: {
        europa: getRegionData('Europa'),
        latam: getRegionData('Latam'),
        espana: getRegionData('España'),
      },
    };
  };

  const loadMetrics = async (range: 'today' | 'custom', fechaInicio?: string, fechaFin?: string) => {
    setLoading(true);
    setError(null);
    
    try {
      let apiData: any;
      
      if (range === 'today') {
        apiData = await fetchLanzamientoMetricsToday();
      } else if (range === 'custom') {
        if (!fechaInicio || !fechaFin) {
          throw new Error('Fechas de inicio y fin son requeridas para el rango personalizado');
        }
        apiData = await fetchLanzamientoMetricsCustom(fechaInicio, fechaFin);
      } else {
        throw new Error('Rango de tiempo no válido');
      }
      
      // Procesar los datos de la API para asegurar que siempre se muestren las 3 regiones
      const data = processApiData(apiData);
      setMetrics(data);
    } catch (err) {
      console.error('Error al cargar métricas:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar las métricas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (timeRange === 'custom' && startDate && endDate) {
      loadMetrics(timeRange, startDate, endDate);
    } else if (timeRange !== 'custom') {
      loadMetrics(timeRange);
    }
  }, [timeRange, startDate, endDate]);

  // Función para manejar el cambio de período
  const handleTimeRangeChange = (range: 'today' | 'custom') => {
    setTimeRange(range);
    if (range === 'custom') {
      setShowDatePicker(true);
      // Establecer fechas por defecto (última semana)
      const today = new Date();
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      setEndDate(today.toISOString().split('T')[0]);
      setStartDate(weekAgo.toISOString().split('T')[0]);
    } else {
      setShowDatePicker(false);
    }
  };

  // Función para aplicar las fechas seleccionadas
  const handleApplyCustomDates = () => {
    if (startDate && endDate) {
      if (new Date(startDate) > new Date(endDate)) {
        setError('La fecha de inicio debe ser anterior a la fecha de fin');
        return;
      }
      loadMetrics('custom', startDate, endDate);
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-ES').format(num);
  };

  const calculatePercentage = (value: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  };

  const MetricCard = ({ title, value, icon: Icon, color = "text-blue-600", bgColor = "bg-blue-100" }: {
    title: string;
    value: number;
    icon: React.ComponentType<any>;
    color?: string;
    bgColor?: string;
  }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">
          {title}
        </CardTitle>
        <div className={`p-2 rounded-full ${bgColor}`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatNumber(value)}</div>
      </CardContent>
    </Card>
  );

  const RegionCard = ({ region, data, flag }: { region: string; data: any; flag: string }) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-2xl">{flag}</span>
          {region}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Llamadas:</span>
            <span className="font-medium text-blue-600">{formatNumber(data.total_llamadas || 0)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Contestadas:</span>
            <span className="font-medium text-green-600">{formatNumber(data.llamadas_contestadas || 0)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Fallidas:</span>
            <span className="font-medium text-red-600">{formatNumber(data.llamadas_fallidas || 0)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Enlaces:</span>
            <span className="font-medium text-blue-600">{formatNumber(data.enlaces_enviados || 0)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Clicks:</span>
            <span className="font-medium text-purple-600">{formatNumber(data.clicks_totales || 0)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">No Llamar:</span>
            <span className="font-medium text-orange-600">{formatNumber(data.no_llamar || 0)}</span>
          </div>
        </div>
        
        {/* Barras de progreso */}
        <div className="space-y-2">
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Tasa de Contestación</span>
              <span>{calculatePercentage(data.llamadas_contestadas || 0, data.total_llamadas || 0)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full" 
                style={{ width: `${calculatePercentage(data.llamadas_contestadas || 0, data.total_llamadas || 0)}%` }}
              ></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Tasa de Clicks</span>
              <span>{calculatePercentage(data.clicks_totales || 0, data.enlaces_enviados || 0)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-purple-500 h-2 rounded-full" 
                style={{ width: `${calculatePercentage(data.clicks_totales || 0, data.enlaces_enviados || 0)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // Si no tiene permisos, mostrar mensaje de acceso denegado
  if (!launchEnabled) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="p-4 bg-red-50 rounded-full">
          <Lock className="h-12 w-12 text-red-500" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Acceso Restringido</h2>
          <p className="text-gray-600 max-w-md">
            No tienes permisos para acceder a la página de Lanzamiento. 
            Contacta con tu administrador si crees que esto es un error.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lanzamiento</h1>
          <p className="text-muted-foreground">
            Métricas de campañas de lanzamiento
          </p>
        </div>
        
        {/* Selector de período */}
        <div className="flex items-center gap-2">
          <Button
            variant={timeRange === 'today' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleTimeRangeChange('today')}
          >
            Hoy
          </Button>
          <Button
            variant={timeRange === 'custom' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleTimeRangeChange('custom')}
          >
            <CalendarDays className="h-4 w-4 mr-1" />
            Personalizado
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadMetrics(timeRange, startDate, endDate)}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Datepicker para fechas personalizadas */}
      {showDatePicker && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Seleccionar Rango de Fechas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha de Inicio
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  max={endDate || new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha de Fin
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min={startDate}
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleApplyCustomDates}
                  disabled={!startDate || !endDate || loading}
                  className="px-6"
                >
                  Aplicar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDatePicker(false);
                    setTimeRange('today');
                    setStartDate('');
                    setEndDate('');
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
            {startDate && endDate && (
              <div className="mt-3 text-sm text-gray-600">
                <span className="font-medium">Período seleccionado:</span> 
                {' '}{new Date(startDate).toLocaleDateString('es-ES')} - {new Date(endDate).toLocaleDateString('es-ES')}
                {' '}({Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))} días)
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Métricas principales */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="flex items-center space-x-2">
            <RefreshCw className="animate-spin h-5 w-5 text-blue-600" />
            <span className="text-gray-600">Cargando métricas...</span>
          </div>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={() => loadMetrics(timeRange)}>
            Reintentar
          </Button>
        </div>
      ) : metrics ? (
        <>
        {/* Resumen de rendimiento */}
        <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Resumen de Rendimiento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {calculatePercentage(metrics.llamadas_contestadas, metrics.total_llamadas)}%
                  </div>
                  <div className="text-sm text-gray-600">Tasa de Contestación</div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {calculatePercentage(metrics.total_enlaces_enviados, metrics.total_llamadas)}%
                  </div>
                  <div className="text-sm text-gray-600">Enlaces Enviados</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {calculatePercentage(metrics.total_clicks_totales, metrics.total_enlaces_enviados)}%
                  </div>
                  <div className="text-sm text-gray-600">Tasa de Clicks</div>
                </div>
                
              </div>
            </CardContent>
          </Card>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <MetricCard
              title="Total Llamadas"
              value={metrics.total_llamadas}
              icon={Phone}
              color="text-blue-600"
              bgColor="bg-blue-100"
            />
            <MetricCard
              title="Llamadas Contestadas"
              value={metrics.llamadas_contestadas}
              icon={PhoneCall}
              color="text-green-600"
              bgColor="bg-green-100"
            />
            <MetricCard
              title="Llamadas Fallidas"
              value={metrics.llamadas_fallidas}
              icon={PhoneOff}
              color="text-red-600"
              bgColor="bg-red-100"
            />
            <MetricCard
              title="Enlaces Enviados"
              value={metrics.total_enlaces_enviados}
              icon={Link}
              color="text-blue-600"
              bgColor="bg-blue-100"
            />
            <MetricCard
              title="Clicks Totales"
              value={metrics.total_clicks_totales}
              icon={MousePointer}
              color="text-purple-600"
              bgColor="bg-purple-100"
            />
            <MetricCard
              title="No Llamar"
              value={metrics.total_no_llamar}
              icon={Ban}
              color="text-orange-600"
              bgColor="bg-orange-100"
            />
          </div>

          {/* Métricas por región */}
          <div>
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Globe className="h-6 w-6" />
              Métricas por Región
            </h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <RegionCard 
                region="Europa" 
                data={metrics.porRegion.europa} 
                flag="🇪🇺"
              />
              <RegionCard 
                region="Latam" 
                data={metrics.porRegion.latam} 
                flag="🌎"
              />
              <RegionCard 
                region="España" 
                data={metrics.porRegion.espana} 
                flag="🇪🇸"
              />
            </div>
          </div>

          
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500">No hay datos disponibles</p>
        </div>
      )}
    </div>
  );
};

export default Lanzamiento;
