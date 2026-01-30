import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Phone, PhoneCall, PhoneOff, Link, MousePointer, Ban, RefreshCw, Calendar, TrendingUp, Globe, CalendarDays, Lock, Activity } from 'lucide-react';
import { fetchLanzamientoMetricsToday, fetchLanzamientoMetricsCustom, fetchAsistenciaFunnelMetrics } from '../api';
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

interface FunnelTotals {
  total_links: number;
  total_clicks: number;
  total_attendance: number;
  total_links_unique: number;
  total_clicks_from_links: number;
  total_clicks_raw: number;
  total_attendance_from_clicks: number;
  total_attendance_from_links: number;
  pct_clicks_over_links: number;
  pct_attendance_over_clicks: number;
  pct_attendance_over_links: number;
}

interface FunnelByPhone {
  phone_norm: string;
  phone_examples: {
    links: string | null;
    asistencia: string | null;
    webinar: string | null;
  };
  has_link: boolean;
  has_click: boolean;
  has_webinar: boolean;
  campaña: string | null;
  region: string | null;
  pais: string | null;
}

interface NoMatchRecord {
  source_table: string;
  phone_number: string | null;
  campaña: string | null;
  region: string | null;
  pais: string | null;
  reason: string;
  category?: string;
}

interface FunnelMetrics {
  totals: FunnelTotals;
  funnel_by_phone: FunnelByPhone[];
  no_match_records: NoMatchRecord[];
}

const REGION_OPTIONS = [
  { region: 'España' },
  { region: 'Europa' },
  { region: 'Latam' },
];

const REGION_PAISES: { region: string; paises: string }[] = [
  { region: 'España', paises: 'España' },
  { region: 'Europa', paises: 'no_detectado' },
  {
    region: 'Latam',
    paises:
      'Argentina, Bolivia, Brasil, Chile, Colombia, Costa Rica, Cuba, Ecuador, El Salvador, México, Nicaragua, Panamá, Paraguay, Perú, República Dominicana, Uruguay, USA / Canadá, Venezuela',
  },
];

function getPaisesByRegion(region: string): string[] {
  const item = REGION_PAISES.find((r) => r.region === region);
  if (!item) return [];
  return item.paises.split(', ').map((p) => p.trim());
}

const Lanzamiento: React.FC = () => {
  const { launchEnabled } = useCallsContext();
  const [metrics, setMetrics] = useState<LanzamientoMetrics | null>(null);
  const [funnel, setFunnel] = useState<FunnelMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingFunnel, setLoadingFunnel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'today' | 'custom'>('today');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const requestCounterRef = useRef<number>(0);
  const [regionFilter, setRegionFilter] = useState<string>('');
  const [countryFilter, setCountryFilter] = useState<string>('');

  const paisesOptions = regionFilter ? getPaisesByRegion(regionFilter) : [];

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

  // Carga solo el funnel según el rango actual y filtros
  const loadFunnelForRange = async (range: 'today' | 'custom', fechaInicio?: string, fechaFin?: string) => {
    setLoadingFunnel(true);
    try {
      let start = fechaInicio;
      let end = fechaFin;

      // Si el rango es "today", calculamos la fecha de hoy (formato YYYY-MM-DD)
      if (range === 'today') {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        start = `${yyyy}-${mm}-${dd}`;
        end = `${yyyy}-${mm}-${dd}`;
      }

      // Para custom, si no hay fechas válidas aún, no hacemos nada
      if (range === 'custom' && (!start || !end)) {
        setLoadingFunnel(false);
        return;
      }

      const funnelResponse = await fetchAsistenciaFunnelMetrics({
        region: regionFilter || undefined,
        pais: countryFilter || undefined,
        fecha_inicio: start,
        fecha_fin: end
      });

      setFunnel({
        totals: funnelResponse.totals,
        funnel_by_phone: funnelResponse.funnel_by_phone,
        no_match_records: funnelResponse.no_match_records
      });
    } catch (funnelError) {
      console.error('Error al cargar funnel de asistencia:', funnelError);
    } finally {
      setLoadingFunnel(false);
    }
  };

  const loadMetrics = async (range: 'today' | 'custom', fechaInicio?: string, fechaFin?: string) => {
    // Incrementar contador de peticiones
    requestCounterRef.current += 1;
    const currentRequest = requestCounterRef.current;
    
    setLoading(true);
    setLoadingFunnel(true);
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
      
      // Verificar si esta es todavía la petición más reciente
      if (currentRequest !== requestCounterRef.current) {
        console.log('Petición obsoleta ignorada');
        return;
      }
      
      // Procesar los datos de la API para asegurar que siempre se muestren las 3 regiones
      const data = processApiData(apiData);
      setMetrics(data);

      // Cargar funnel con los mismos filtros de fechas
      if (currentRequest === requestCounterRef.current) {
        await loadFunnelForRange(range, fechaInicio, fechaFin);
      }
    } catch (err) {
      // Solo procesar errores si esta es la petición más reciente
      if (currentRequest !== requestCounterRef.current) {
        console.log('Error de petición obsoleta ignorado');
        return;
      }
      console.error('Error al cargar métricas:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar las métricas');
    } finally {
      // Solo actualizar loading si esta es la petición más reciente
      if (currentRequest === requestCounterRef.current) {
        setLoading(false);
        setLoadingFunnel(false);
      }
    }
  };

  useEffect(() => {
    // Solo cargar automáticamente cuando cambia el timeRange
    // Para 'custom', solo cargar cuando se aplican las fechas explícitamente
    if (timeRange === 'today') {
      loadMetrics(timeRange);
    }
    // No cargar automáticamente para 'custom' - esperar a que el usuario haga clic en "Aplicar"
  }, [timeRange]);

  // Al cambiar la región, limpiar país si no pertenece a la nueva región
  useEffect(() => {
    if (!regionFilter) {
      setCountryFilter('');
      return;
    }
    const paises = getPaisesByRegion(regionFilter);
    if (countryFilter && !paises.includes(countryFilter)) {
      setCountryFilter('');
    }
  }, [regionFilter]);

  // Función para manejar el cambio de período
  const handleTimeRangeChange = (range: 'today' | 'custom') => {
    // Invalidar peticiones anteriores incrementando el contador
    requestCounterRef.current += 1;
    
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
      // Limpiar fechas cuando se cambia a 'today' para evitar efectos secundarios
      setStartDate('');
      setEndDate('');
    }
  };

  // Función para aplicar las fechas seleccionadas
  const handleApplyCustomDates = () => {
    if (startDate && endDate) {
      // Validar fechas usando UTC para evitar problemas de zona horaria
      const [yearStart, monthStart, dayStart] = startDate.split('-').map(Number);
      const [yearEnd, monthEnd, dayEnd] = endDate.split('-').map(Number);
      
      const start = new Date(Date.UTC(yearStart, monthStart - 1, dayStart));
      const end = new Date(Date.UTC(yearEnd, monthEnd - 1, dayEnd));
      
      if (start > end) {
        setError('La fecha de inicio debe ser anterior a la fecha de fin');
        return;
      }
      loadMetrics('custom', startDate, endDate);
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-ES').format(num);
  };

  // Función helper para formatear fecha sin problemas de zona horaria
  const formatDateForDisplay = (dateString: string) => {
    // Si la fecha viene en formato YYYY-MM-DD, parsearla correctamente
    if (dateString && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [year, month, day] = dateString.split('-').map(Number);
      // Crear fecha en UTC para evitar problemas de zona horaria
      const date = new Date(Date.UTC(year, month - 1, day));
      return date.toLocaleDateString('es-ES', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit',
        timeZone: 'UTC'
      });
    }
    return dateString;
  };

  // Función helper para calcular diferencia de días sin problemas de zona horaria
  const calculateDaysDifference = (startDate: string, endDate: string) => {
    if (!startDate || !endDate) return 0;
    
    // Parsear fechas en formato YYYY-MM-DD como UTC
    if (/^\d{4}-\d{2}-\d{2}$/.test(startDate) && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      const [yearStart, monthStart, dayStart] = startDate.split('-').map(Number);
      const [yearEnd, monthEnd, dayEnd] = endDate.split('-').map(Number);
      
      const start = new Date(Date.UTC(yearStart, monthStart - 1, dayStart));
      const end = new Date(Date.UTC(yearEnd, monthEnd - 1, dayEnd));
      
      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      // Si es el mismo día, debería ser 1 día (no 0)
      return diffDays === 0 ? 1 : diffDays + 1;
    }
    
    // Fallback al método anterior si el formato no es el esperado
    return Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
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

      {/* Filtros de funnel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Filtros de Funnel (Links → Clicks → Asistencia)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Región
              </label>
              <select
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="">Todas las regiones</option>
                {REGION_OPTIONS.map((opt) => (
                  <option key={opt.region} value={opt.region}>
                    {opt.region}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                País (Webinar)
              </label>
              <select
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
                disabled={!regionFilter}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">
                  {regionFilter ? 'Todos los países' : 'Selecciona una región'}
                </option>
                {paisesOptions.map((pais) => (
                  <option key={pais} value={pais}>
                    {pais}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => loadFunnelForRange(timeRange, startDate, endDate)}
                disabled={loadingFunnel}
                className="w-full md:w-auto"
              >
                <Activity className={`h-4 w-4 mr-2 ${loadingFunnel ? 'animate-spin' : ''}`} />
                Aplicar filtros funnel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

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
                {' '}{formatDateForDisplay(startDate)} - {formatDateForDisplay(endDate)}
                {' '}({calculateDaysDifference(startDate, endDate)} días)
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

          {/* Funnel de conversión */}
          {funnel && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Funnel Links → Clicks → Asistencia
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingFunnel ? (
                  <div className="flex items-center space-x-2 py-4">
                    <RefreshCw className="animate-spin h-4 w-4 text-blue-600" />
                    <span className="text-gray-600 text-sm">Calculando funnel...</span>
                  </div>
                ) : (
                  <>
                    {/* Embudo de conversión (formato tunnel): picos en ambos lados, texto y dato dentro */}
                    <div className="flex flex-col items-center gap-0 max-w-xl mx-auto mb-6">
                      {/* Links únicos enviados */}
                      <div className="w-full flex flex-col items-center mt-1 first:mt-0">
                        <div
                          className="w-full flex items-center justify-between px-10 py-4 text-white rounded-lg"
                          style={{
                            background: 'linear-gradient(135deg, #4c1d95 0%, #5b21b6 100%)',
                          }}
                        >
                          <span className="font-medium">Links únicos enviados</span>
                          <span className="font-bold text-lg tabular-nums">
                            {formatNumber(funnel.totals.total_links_unique || 0)}
                          </span>
                        </div>
                      </div>
                      {/* Clicks desde esos links */}
                      <div className="w-[92%] flex flex-col items-center mt-1">
                        <div
                          className="w-full flex items-center justify-between gap-4 px-10 py-4 text-white rounded-lg"
                          style={{
                            background: 'linear-gradient(135deg, #b91c1c 0%, #dc2626 100%)',
                          }}
                        >
                          <div className="flex flex-col gap-1 min-w-0">
                            <span className="font-medium">Clicks desde esos links</span>
                            <span className="text-sm font-normal opacity-90">
                              <span className="opacity-95">{formatNumber(funnel.totals.total_clicks_raw ?? 0)}</span>
                              {' '}en asistencia ·{' '}
                              <span className="opacity-95">{formatNumber(funnel.totals.total_clicks_from_links || 0)}</span>
                              {' '}coinciden con links
                            </span>
                          </div>
                          <span className="font-bold text-lg tabular-nums shrink-0">
                            {formatNumber(funnel.totals.total_clicks_from_links || 0)}
                            <span className="font-normal opacity-90 ml-1.5">
                              ({funnel.totals.pct_clicks_over_links?.toFixed(1) ?? 0}%)
                            </span>
                          </span>
                        </div>
                      </div>
                      {/* Asistencias desde clicks */}
                      <div className="w-[84%] flex flex-col items-center mt-1">
                        <div
                          className="w-full flex items-center justify-between px-10 py-4 text-white rounded-lg"
                          style={{
                            background: 'linear-gradient(135deg, #15803d 0%, #16a34a 100%)',
                          }}
                        >
                          <span className="font-medium">Asistencias desde clicks</span>
                          <span className="font-bold text-lg tabular-nums">
                            {formatNumber(funnel.totals.total_attendance_from_clicks || 0)}
                            <span className="font-normal opacity-90 ml-1.5">
                              ({funnel.totals.pct_attendance_over_clicks?.toFixed(1) ?? 0}%)
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
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
