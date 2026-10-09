import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Phone, PhoneCall, PhoneOff, Link, MousePointer, Ban, RefreshCw, Calendar, TrendingUp, Globe, CalendarDays, Lock, Activity, ChevronLeft, ChevronRight, Check, ChevronDown, Download, X } from 'lucide-react';
import { fetchLanzamientoMetricsToday, fetchLanzamientoMetricsCustom, fetchAsistenciaFunnelMetrics, fetchLanzamientoMetricsDailyRange, type DailyLanzamientoMetric } from '../api';
import { REGION_OPTIONS, REGION_PAISES, COUNTRY_FLAGS } from '../lib/constants';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useCallsContext } from '../context/CallsContext';
import { BASE_URL, getClientId } from '../services/api/config';
import { authedFetch } from '../services/api/http';

interface MetricByCountry {
  pais: string;
  total_llamadas: number;
  llamadas_contestadas: number;
  llamadas_fallidas: number;
  enlaces_enviados: number;
  clicks_totales: number;
  no_llamar: number;
}

interface LanzamientoMetrics {
  total_llamadas: number;
  llamadas_contestadas: number;
  llamadas_fallidas: number;
  total_enlaces_enviados: number;
  total_clicks_totales: number;
  total_no_llamar: number;
  porPais: MetricByCountry[];
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

function getPaisesByRegion(region: string): string[] {
  const item = REGION_PAISES.find((r) => r.region === region);
  if (!item) return [];
  return item.paises.split(', ').map((p) => p.trim());
}

const isApplePlatform = () => {
  if (typeof navigator === 'undefined') return false;
  const p = navigator.platform || '';
  const ua = navigator.userAgent || '';
  return /Mac|iPhone|iPad|iPod/.test(p) || /Mac OS X/.test(ua);
};

function getFlagForCountry(pais: string): string {
  if (!isApplePlatform()) {
    return '';
  }
  return COUNTRY_FLAGS[pais] ?? '';
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
  const [paisesSeleccionados, setPaisesSeleccionados] = useState<string[]>([]);
  const [dropdownPaisesOpen, setDropdownPaisesOpen] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);
  const dropdownPaisesRef = useRef<HTMLDivElement>(null);
  const [showClicksModal, setShowClicksModal] = useState(false);
  const [loadingExport, setLoadingExport] = useState(false);
  const [showLinksModal, setShowLinksModal] = useState(false);
  const [loadingExportLinks, setLoadingExportLinks] = useState(false);
  const [dailyChartData, setDailyChartData] = useState<DailyLanzamientoMetric[]>([]);
  const [loadingDaily, setLoadingDaily] = useState(false);

  const getExportDateRange = (): { fecha_inicio: string; fecha_fin: string } => {
    if (timeRange === 'today' || !startDate || !endDate) {
      const today = new Date().toISOString().split('T')[0];
      return { fecha_inicio: today, fecha_fin: today };
    }
    return { fecha_inicio: startDate, fecha_fin: endDate };
  };

  const handleExportClicksCSV = async () => {
    setLoadingExport(true);
    try {
      const clientId = getClientId() || '';
      const { fecha_inicio, fecha_fin } = getExportDateRange();

      const response = await authedFetch(`${BASE_URL}/api/lanzamiento/asistencia/export`, {
        method: 'POST',
        body: JSON.stringify({ client_id: clientId, fecha_inicio: `${fecha_inicio}T00:00:00Z`, fecha_fin: `${fecha_fin}T23:59:59Z` }),
      });

      if (!response.ok) throw new Error('Error al obtener los datos de clicks');
      const json = await response.json();
      const rows: any[] = json.data || [];

      const headers = ['ID', 'Nombre', 'Teléfono', 'Email', 'Call ID', 'Agent ID', 'Fecha y Hora', 'Campaña', 'Región', 'Workflow', 'Nombre Completo', 'Client ID'];
      const fields = ['id', 'name', 'phone_number', 'email', 'call_id', 'agent_id', 'created_at', 'campana', 'region', 'workflow', 'full_name', 'client_id'];

      const escapeCsv = (val: any) => {
        if (val == null) return '';
        const str = String(val);
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"` : str;
      };

      const csvLines = [
        headers.map(escapeCsv).join(','),
        ...rows.map(row => fields.map(f => escapeCsv(row[f])).join(',')),
      ];
      const csvContent = csvLines.join('\n');

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `clicks_${fecha_inicio}_${fecha_fin}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setShowClicksModal(false);
    } catch (err) {
      // silencio
    } finally {
      setLoadingExport(false);
    }
  };

  const handleExportLinksCSV = async () => {
    setLoadingExportLinks(true);
    try {
      const clientId = getClientId() || '';
      const { fecha_inicio, fecha_fin } = getExportDateRange();

      const response = await authedFetch(`${BASE_URL}/api/lanzamiento/links/export`, {
        method: 'POST',
        body: JSON.stringify({ client_id: clientId, fecha_inicio: `${fecha_inicio}T00:00:00Z`, fecha_fin: `${fecha_fin}T23:59:59Z` }),
      });

      if (!response.ok) throw new Error('Error al obtener los datos de enlaces');
      const json = await response.json();
      const rows: any[] = json.data || [];

      const headers = ['ID', 'Nombre', 'Teléfono', 'Email', 'Call ID', 'Agent ID', 'Fecha y Hora', 'Campaña', 'Región', 'Client ID'];
      const fields = ['id', 'name', 'phone_number', 'email', 'call_id', 'agent_id', 'created_at', 'campana', 'region', 'client_id'];

      const escapeCsv = (val: any) => {
        if (val == null) return '';
        const str = String(val);
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"` : str;
      };

      const csvLines = [
        headers.map(escapeCsv).join(','),
        ...rows.map(row => fields.map(f => escapeCsv(row[f])).join(',')),
      ];
      const csvContent = csvLines.join('\n');

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `enlaces_unicos_${fecha_inicio}_${fecha_fin}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setShowLinksModal(false);
    } catch (err) {
      // silencio
    } finally {
      setLoadingExportLinks(false);
    }
  };

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownPaisesRef.current && !dropdownPaisesRef.current.contains(e.target as Node)) {
        setDropdownPaisesOpen(false);
      }
    };
    if (dropdownPaisesOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownPaisesOpen]);

  const paisesOptions = regionFilter ? getPaisesByRegion(regionFilter) : [];

  // Países a mostrar: si hay selección manual, esos (en orden); si no, Top 5 por llamadas
  const paisesParaMostrar = (() => {
    if (!metrics?.porPais?.length) return [];
    const byPais = new Map(metrics.porPais.map((p) => [p.pais, p]));
    if (paisesSeleccionados.length > 0) {
      return paisesSeleccionados.map((nombre) => byPais.get(nombre)).filter(Boolean) as MetricByCountry[];
    }
    const sorted = [...metrics.porPais].sort((a, b) => b.total_llamadas - a.total_llamadas);
    return sorted.slice(0, 5);
  })();

  const togglePais = (pais: string) => {
    setPaisesSeleccionados((prev) =>
      prev.includes(pais) ? prev.filter((p) => p !== pais) : [...prev, pais]
    );
  };

  const mostrarTop5 = () => {
    setPaisesSeleccionados([]);
    setDropdownPaisesOpen(false);
  };

  const seleccionarTodosPaises = () => {
    if (!metrics?.porPais?.length) return;
    setPaisesSeleccionados(metrics.porPais.map((p) => p.pais));
    setDropdownPaisesOpen(false);
  };

  const scrollCarousel = (direction: 'left' | 'right') => {
    const el = carouselRef.current;
    if (!el) return;
    const cardWidth = 300;
    const gap = 24;
    const scrollAmount = cardWidth + gap;
    el.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
  };

  // Procesar datos de la API (métricas por país, derivado del teléfono)
  const processApiData = (apiData: any): LanzamientoMetrics => {
    const metricsByCountry = Array.isArray(apiData.metrics_by_country) ? apiData.metrics_by_country : [];
    return {
      total_llamadas: apiData.total_llamadas ?? 0,
      llamadas_contestadas: apiData.llamadas_contestadas ?? 0,
      llamadas_fallidas: apiData.llamadas_fallidas ?? 0,
      total_enlaces_enviados: apiData.total_enlaces_enviados ?? 0,
      total_clicks_totales: apiData.total_clicks_totales ?? 0,
      total_no_llamar: apiData.total_no_llamar ?? 0,
      porPais: metricsByCountry.map((item: any) => ({
        pais: item.pais ?? 'no_detectado',
        total_llamadas: parseInt(item.total_llamadas, 10) || 0,
        llamadas_contestadas: parseInt(item.llamadas_contestadas, 10) || 0,
        llamadas_fallidas: parseInt(item.llamadas_fallidas, 10) || 0,
        enlaces_enviados: parseInt(item.enlaces_enviados, 10) || 0,
        clicks_totales: parseInt(item.clicks_totales, 10) || 0,
        no_llamar: parseInt(item.no_llamar, 10) || 0,
      })),
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
      // console.error('Error al cargar funnel de asistencia:', funnelError);
    } finally {
      setLoadingFunnel(false);
    }
  };

  const loadMetrics = async (range: 'today' | 'custom', fechaInicio?: string, fechaFin?: string) => {
    requestCounterRef.current += 1;
    const currentRequest = requestCounterRef.current;
    
    setLoading(true);
    setLoadingFunnel(true);
    setError(null);
    
    try {
      let apiData: any;
      
      if (range === 'today') {
        apiData = await fetchLanzamientoMetricsToday();
        setDailyChartData([]);
      } else if (range === 'custom') {
        if (!fechaInicio || !fechaFin) {
          throw new Error('Fechas de inicio y fin son requeridas para el rango personalizado');
        }
        apiData = await fetchLanzamientoMetricsCustom(fechaInicio, fechaFin);

        // Cargar datos diarios para el gráfico de área (máx 31 días)
        const daysDiff = calculateDaysDifference(fechaInicio, fechaFin);
        if (daysDiff <= 31) {
          setLoadingDaily(true);
          fetchLanzamientoMetricsDailyRange(fechaInicio, fechaFin).then((daily) => {
            if (currentRequest === requestCounterRef.current) {
              setDailyChartData(daily);
            }
          }).finally(() => {
            if (currentRequest === requestCounterRef.current) setLoadingDaily(false);
          });
        } else {
          setDailyChartData([]);
        }
      } else {
        throw new Error('Rango de tiempo no válido');
      }
      
      if (currentRequest !== requestCounterRef.current) return;
      
      const data = processApiData(apiData);
      setMetrics(data);

      if (currentRequest === requestCounterRef.current) {
        await loadFunnelForRange(range, fechaInicio, fechaFin);
      }
    } catch (err) {
      if (currentRequest !== requestCounterRef.current) return;
      setError(err instanceof Error ? err.message : 'Error al cargar las métricas');
    } finally {
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
    if (total === 0) return '0.0';
    return ((value / total) * 100).toFixed(1);
  };

  const MetricCard = ({ title, value, icon: Icon, color = "text-blue-600", bgColor = "bg-blue-100", onClick }: {
    title: string;
    value: number;
    icon: React.ComponentType<any>;
    color?: string;
    bgColor?: string;
    onClick?: () => void;
  }) => (
    <Card
      className={onClick ? 'cursor-pointer hover:shadow-md hover:border-purple-300 transition-all duration-150' : ''}
      onClick={onClick}
    >
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
        {onClick && (
          <p className="text-xs text-purple-500 mt-1 flex items-center gap-1">
            <Download className="h-3 w-3" /> Click para descargar
          </p>
        )}
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
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-indigo-800">Lanzamiento</h1>
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
              {timeRange === 'custom' && (loadingDaily || dailyChartData.length > 0) ? (
                loadingDaily ? (
                  <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
                    <RefreshCw className="animate-spin h-4 w-4" />
                    <span className="text-sm">Cargando tendencia diaria...</span>
                  </div>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={dailyChartData.map((d) => ({
                          ...d,
                          label: (() => {
                            const [, m, day] = d.fecha.split('-').map(Number);
                            const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
                            return `${day} ${meses[m - 1]}`;
                          })(),
                        }))}
                        margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="colorContest" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0.05} />
                          </linearGradient>
                          <linearGradient id="colorEnlaces" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.05} />
                          </linearGradient>
                          <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 12, fill: '#94a3b8' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tickFormatter={(v) => `${v}%`}
                          domain={[0, 'auto']}
                          tick={{ fontSize: 12, fill: '#94a3b8' }}
                          axisLine={false}
                          tickLine={false}
                          width={42}
                        />
                        <Tooltip
                          formatter={(value: number, name: string) => [`${value}%`, name]}
                          contentStyle={{
                            background: '#1e293b',
                            border: '1px solid #334155',
                            borderRadius: 8,
                            color: '#f1f5f9',
                            fontSize: 13,
                          }}
                          itemStyle={{ color: '#f1f5f9' }}
                          labelStyle={{ color: '#94a3b8', marginBottom: 4 }}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: 13, paddingTop: 8 }}
                          iconType="circle"
                          iconSize={10}
                        />
                        <Area
                          type="monotone"
                          dataKey="tasa_contestacion"
                          name="Tasa contestación"
                          stroke="#22c55e"
                          strokeWidth={2}
                          fill="url(#colorContest)"
                          dot={{ r: 3, fill: '#22c55e', strokeWidth: 0 }}
                          activeDot={{ r: 5 }}
                        />
                        <Area
                          type="monotone"
                          dataKey="pct_enlaces"
                          name="Enlaces enviados"
                          stroke="#38bdf8"
                          strokeWidth={2}
                          fill="url(#colorEnlaces)"
                          dot={{ r: 3, fill: '#38bdf8', strokeWidth: 0 }}
                          activeDot={{ r: 5 }}
                        />
                        <Area
                          type="monotone"
                          dataKey="tasa_clicks"
                          name="Tasa de clicks"
                          stroke="#a78bfa"
                          strokeWidth={2}
                          fill="url(#colorClicks)"
                          dot={{ r: 3, fill: '#a78bfa', strokeWidth: 0 }}
                          activeDot={{ r: 5 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )
              ) : (
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {calculatePercentage(metrics.llamadas_contestadas, metrics.total_llamadas)}%
                    </div>
                    <div className="text-sm text-gray-600">Tasa de Contestación</div>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {calculatePercentage(funnel?.totals?.total_links_unique ?? metrics.total_enlaces_enviados, metrics.llamadas_contestadas)}%
                    </div>
                    <div className="text-sm text-gray-600">Enlaces Enviados (únicos)</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {calculatePercentage(metrics.total_clicks_totales, funnel?.totals?.total_links_unique ?? metrics.total_enlaces_enviados)}%
                    </div>
                    <div className="text-sm text-gray-600">Tasa de Clicks</div>
                  </div>
                </div>
              )}
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
              title="Enlaces Enviados (únicos)"
              value={funnel?.totals?.total_links_unique ?? metrics.total_enlaces_enviados}
              icon={Link}
              color="text-blue-600"
              bgColor="bg-blue-100"
              onClick={() => setShowLinksModal(true)}
            />
            <MetricCard
              title="Clicks Totales"
              value={metrics.total_clicks_totales}
              icon={MousePointer}
              color="text-purple-600"
              bgColor="bg-purple-100"
              onClick={() => setShowClicksModal(true)}
            />
            <MetricCard
              title="No Llamar"
              value={metrics.total_no_llamar}
              icon={Ban}
              color="text-orange-600"
              bgColor="bg-orange-100"
            />
          </div>

          {/* Métricas por país: Top 5 por defecto o países agregados (se pueden quitar) */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Globe className="h-6 w-6" />
                Métricas por País
              </h2>
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative inline-block" ref={dropdownPaisesRef}>
                  <button
                    type="button"
                    onClick={() => setDropdownPaisesOpen((v) => !v)}
                    className="flex items-center gap-2 min-w-[200px] px-3 py-2 border border-gray-300 rounded-md bg-white text-sm text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <span className="flex-1">
                      {paisesSeleccionados.length > 0
                        ? `Países (${paisesSeleccionados.length})`
                        : 'Seleccionar países...'}
                    </span>
                    <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${dropdownPaisesOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {dropdownPaisesOpen && (
                    <div className="absolute top-full left-0 mt-1 w-full min-w-[240px] max-h-[260px] overflow-y-auto overflow-x-hidden border border-gray-200 rounded-md bg-white shadow-lg z-50 py-1">
                      {[...metrics.porPais]
                        .sort((a, b) => b.total_llamadas - a.total_llamadas)
                        .map((p) => {
                          const selected = paisesSeleccionados.includes(p.pais);
                          return (
                            <button
                              key={p.pais}
                              type="button"
                              onClick={() => togglePais(p.pais)}
                              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-100 ${selected ? 'bg-blue-50 text-blue-800' : 'text-gray-800'}`}
                            >
                              <span className="w-5 flex justify-center">
                                {selected ? <Check className="w-4 h-4 text-blue-600" /> : null}
                              </span>
                              <span>{getFlagForCountry(p.pais)}</span>
                              <span className="flex-1 truncate">{p.pais}</span>
                              <span className="text-gray-500 text-xs">({p.total_llamadas})</span>
                            </button>
                          );
                        })}
                    </div>
                  )}
                </div>
                <Button
                  variant={paisesSeleccionados.length === 0 ? 'default' : 'outline'}
                  size="sm"
                  onClick={mostrarTop5}
                >
                  Top 5 por llamadas
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={paisesSeleccionados.length > 0 && paisesSeleccionados.length === metrics.porPais.length ? 'default' : 'outline'}
                  onClick={seleccionarTodosPaises}
                  disabled={!metrics.porPais.length}
                >
                  Todos los países
                </Button>
                {paisesSeleccionados.length > 0 && (
                  <span className="text-sm text-gray-500">
                    {paisesSeleccionados.length} seleccionado{paisesSeleccionados.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>

            {paisesParaMostrar.length === 0 ? (
              <p className="text-gray-500 py-6">No hay datos por país en el período seleccionado.</p>
            ) : (
              <div className="relative flex items-center gap-2">
                {paisesParaMostrar.length > 3 && (
                  <button
                    type="button"
                    onClick={() => scrollCarousel('left')}
                    className="flex-shrink-0 p-2 rounded-full border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-sm"
                    aria-label="Anterior"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                <div className="w-full max-w-[calc(340px*3+24*2)] overflow-hidden">
                  <div
                    ref={carouselRef}
                    className="flex overflow-x-auto gap-6 pb-2 scroll-smooth snap-x snap-mandatory [&::-webkit-scrollbar]:hidden"
                    style={{
                      scrollSnapType: 'x mandatory',
                      scrollbarWidth: 'none',
                      msOverflowStyle: 'none',
                    }}
                  >
                    {paisesParaMostrar.map((item) => (
                      <div
                        key={item.pais}
                        data-carousel-card
                        className="flex-shrink-0 w-[300px] snap-start"
                      >
                        <RegionCard
                          region={item.pais}
                          data={item}
                          flag={getFlagForCountry(item.pais)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                {paisesParaMostrar.length > 3 && (
                  <button
                    type="button"
                    onClick={() => scrollCarousel('right')}
                    className="flex-shrink-0 p-2 rounded-full border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-sm"
                    aria-label="Siguiente"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Filtros de Funnel (debajo de Métricas por Región, encima del Funnel) */}
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

          {/* Funnel de conversión (debajo de Filtros de Funnel) */}
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

          
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500">No hay datos disponibles</p>
        </div>
      )}
      {/* Modal de descarga de Enlaces Enviados (únicos) */}
      {showLinksModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => { if (e.target === e.currentTarget) setShowLinksModal(false); }}
        >
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-full bg-blue-100">
                  <Link className="h-5 w-5 text-blue-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Exportar Enlaces Enviados (únicos)</h2>
              </div>
              <button
                onClick={() => setShowLinksModal(false)}
                className="p-1 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-2">
              Se exportarán <span className="font-semibold text-blue-700">{formatNumber(funnel?.totals?.total_links_unique ?? metrics?.total_enlaces_enviados ?? 0)}</span> registros de enlaces únicos (un registro por teléfono) en formato CSV.
            </p>

            <div className="bg-gray-50 rounded-lg p-3 mb-5 text-xs text-gray-500 space-y-1">
              <p className="font-medium text-gray-700 mb-2">Campos incluidos:</p>
              <div className="grid grid-cols-2 gap-1">
                {['ID', 'Nombre', 'Teléfono', 'Email', 'Call ID', 'Agent ID', 'Fecha y Hora', 'Campaña', 'Región', 'Client ID'].map(f => (
                  <span key={f} className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
                    {f}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowLinksModal(false)}
                disabled={loadingExportLinks}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleExportLinksCSV}
                disabled={loadingExportLinks}
              >
                {loadingExportLinks ? (
                  <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Descargando...</>
                ) : (
                  <><Download className="h-4 w-4 mr-2" /> Descargar CSV</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Modal de descarga de Clicks Totales */}
      {showClicksModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => { if (e.target === e.currentTarget) setShowClicksModal(false); }}
        >
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-full bg-purple-100">
                  <MousePointer className="h-5 w-5 text-purple-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Exportar Clicks Totales</h2>
              </div>
              <button
                onClick={() => setShowClicksModal(false)}
                className="p-1 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-2">
              Se exportarán <span className="font-semibold text-purple-700">{formatNumber(metrics?.total_clicks_totales ?? 0)}</span> registros de clicks en formato CSV con todos los campos disponibles.
            </p>

            <div className="bg-gray-50 rounded-lg p-3 mb-5 text-xs text-gray-500 space-y-1">
              <p className="font-medium text-gray-700 mb-2">Campos incluidos:</p>
              <div className="grid grid-cols-2 gap-1">
                {['ID', 'Nombre', 'Teléfono', 'Email', 'Call ID', 'Agent ID', 'Fecha y Hora', 'Campaña', 'Región', 'Workflow', 'Nombre Completo', 'Client ID'].map(f => (
                  <span key={f} className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 inline-block" />
                    {f}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowClicksModal(false)}
                disabled={loadingExport}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                onClick={handleExportClicksCSV}
                disabled={loadingExport}
              >
                {loadingExport ? (
                  <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Descargando...</>
                ) : (
                  <><Download className="h-4 w-4 mr-2" /> Descargar CSV</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Lanzamiento;
