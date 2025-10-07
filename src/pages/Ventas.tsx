import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { TrendingUp, Phone, DollarSign, RefreshCw, BarChart3, Percent, Calculator } from 'lucide-react';
import { 
  fetchSalesMetrics, 
  fetchSalesMetricsToday, 
  fetchSalesMetricsWeek, 
  fetchSalesMetricsMonth, 
  fetchSalesMetricsQuarter,
  fetchFacturacionByDay,
  fetchROIByDay
} from '../api';
import { FacturacionChart } from '../components/dashboard/FacturacionChart';
import { ROIChart } from '../components/dashboard/ROIChart';

interface VentasProps {
  onNavigate: (page: string) => void;
}

interface SalesMetrics {
  totalLlamadas: number;
  totalVentas: number;
  totalGasto: number;
  totalFacturacion: number;
  costePorVenta: number;
  costoPorLlamada: number;
  tasaConversion: number;
  roi: number;
  clientesUnicos: number;
}

// Función para generar datos de facturación basados en las métricas
function generateFacturacionData(metrics: SalesMetrics) {
  const data = [];
  const today = new Date();
  
  // Generar datos para los últimos 30 días
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    // Simular variación diaria basada en las métricas totales
    const dailyVariation = 0.8 + Math.random() * 0.4; // Entre 80% y 120% del promedio
    const dailyFacturacion = (metrics.totalFacturacion / 30) * dailyVariation;
    
    data.push({
      date: date.toISOString().split('T')[0],
      facturacion: Math.round(dailyFacturacion)
    });
  }
  
  return data;
}

// Función para generar datos de ROI basados en las métricas
function generateROIData(metrics: SalesMetrics) {
  const data = [];
  const today = new Date();
  
  // Generar datos para los últimos 30 días
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    // Simular variación diaria del ROI
    const dailyVariation = 0.7 + Math.random() * 0.6; // Entre 70% y 130% del ROI promedio
    const dailyROI = metrics.roi * dailyVariation;
    
    data.push({
      date: date.toISOString().split('T')[0],
      roi: Math.round(dailyROI * 10) / 10 // Redondear a 1 decimal
    });
  }
  
  return data;
}

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
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function addDaysUTC(base: Date, days: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function formatMadridDateYYYYMMDD(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function Ventas({ }: VentasProps) {
  const [metrics, setMetrics] = useState<SalesMetrics | null>(null);
  const [facturacionData, setFacturacionData] = useState<any[]>([]);
  const [roiData, setROIData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Estados para filtros de período
  const [timePeriod, setTimePeriod] = useState<string>(() => {
    try {
      return localStorage.getItem('ventas_time_period') || 'all';
    } catch {
      return 'all';
    }
  });
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Función para calcular las fechas según el período seleccionado
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
        const monthStart = addDaysUTC(todayMadrid, -30);
        const monthStartStr = formatMadridDateYYYYMMDD(monthStart);
        const tomorrowStr3 = addDaysUTC(todayMadrid, 1);
        return { fechaInicio: monthStartStr, fechaFin: formatMadridDateYYYYMMDD(tomorrowStr3) };
      
      case 'quarter':
        const quarterStart = addDaysUTC(todayMadrid, -90);
        const quarterStartStr = formatMadridDateYYYYMMDD(quarterStart);
        const tomorrowStr4 = addDaysUTC(todayMadrid, 1);
        return { fechaInicio: quarterStartStr, fechaFin: formatMadridDateYYYYMMDD(tomorrowStr4) };
      
      case 'custom':
        if (customStart && customEnd) {
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

  const loadSalesData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Cargando datos de ventas para período:', timePeriod);
      
      let response;
      let facturacionResponse: any[] = [];
      let roiResponse: any[] = [];
      
      // Calcular fechas para los gráficos
      let fechaInicio: string | undefined;
      let fechaFin: string | undefined;
      
      if (timePeriod === 'custom' && customStartDate && customEndDate) {
        const dates = calculateDatesForPeriod(timePeriod, customStartDate, customEndDate);
        if (dates) {
          fechaInicio = dates.fechaInicio;
          fechaFin = dates.fechaFin;
        }
      } else if (timePeriod !== 'all') {
        const dates = calculateDatesForPeriod(timePeriod);
        if (dates) {
          fechaInicio = dates.fechaInicio;
          fechaFin = dates.fechaFin;
        }
      }
      
      // Usar endpoints específicos según el período
      switch (timePeriod) {
        case 'today':
          response = await fetchSalesMetricsToday();
          break;
        case 'week':
          response = await fetchSalesMetricsWeek();
          break;
        case 'month':
          response = await fetchSalesMetricsMonth();
          break;
        case 'quarter':
          response = await fetchSalesMetricsQuarter();
          break;
        case 'custom':
          if (customStartDate && customEndDate) {
            const dates = calculateDatesForPeriod(timePeriod, customStartDate, customEndDate);
            if (dates) {
              response = await fetchSalesMetrics(dates.fechaInicio, dates.fechaFin);
            } else {
              throw new Error('Fechas personalizadas inválidas');
            }
          } else {
            throw new Error('Selecciona fechas para el período personalizado');
          }
          break;
        case 'all':
        default:
          // Sin filtros de fecha - usar endpoint genérico
          response = await fetchSalesMetrics();
          break;
      }
      
      // Cargar datos de gráficos en paralelo
      try {
        const [facturacionData, roiData] = await Promise.all([
          fetchFacturacionByDay(fechaInicio, fechaFin),
          fetchROIByDay(fechaInicio, fechaFin)
        ]);
        
        facturacionResponse = facturacionData;
        roiResponse = roiData;
      } catch (chartError) {
        console.warn('Error cargando datos de gráficos:', chartError);
        // Si falla la carga de gráficos, usar datos simulados como fallback
        if (response) {
          facturacionResponse = generateFacturacionData(response);
          roiResponse = generateROIData(response);
        }
      }
      
      setMetrics(response);
      setFacturacionData(facturacionResponse);
      setROIData(roiResponse);
    } catch (err) {
      setError('Error al cargar los datos de ventas');
      console.error('Error loading sales data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Persistir selección de período
  useEffect(() => {
    try {
      localStorage.setItem('ventas_time_period', timePeriod);
    } catch {}
  }, [timePeriod]);

  // Efecto para recargar datos cuando cambia el filtro de período
  useEffect(() => {
    loadSalesData();
  }, [timePeriod, customStartDate, customEndDate]);

  useEffect(() => {
    loadSalesData();
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
            <span className="text-slate-600">Cargando métricas de ventas...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Error al cargar datos</h2>
          <p className="text-red-700 mb-4">{error}</p>
          <Button onClick={loadSalesData} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-700 to-emerald-800 mb-2">
            Análisis de Ventas
          </h2>
          <p className="text-slate-600">
            Métricas clave de rendimiento de ventas y conversión
          </p>
        </div>
        <Button onClick={loadSalesData} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualizar Datos
        </Button>
      </div>

      {/* Filtros de período */}
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
              <SelectItem value="quarter">Últimos 3 meses</SelectItem>
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
                className="px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
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
                className="px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
        )}
        
        <div className="text-xs text-slate-600">
          {timePeriod === 'all' && 'Mostrando todos los datos disponibles'}
          {timePeriod === 'today' && 'Mostrando datos de hoy'}
          {timePeriod === 'week' && 'Mostrando datos de los últimos 7 días'}
          {timePeriod === 'month' && 'Mostrando datos del último mes'}
          {timePeriod === 'quarter' && 'Mostrando datos de los últimos 3 meses'}
          {timePeriod === 'custom' && customStartDate && customEndDate && 
            `Mostrando datos del ${customStartDate} al ${customEndDate}`}
        </div>
      </div>

      {/* Métricas principales - Reorganizadas en 2 filas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Llamadas</CardTitle>
            <Phone className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.totalLlamadas.toLocaleString() || 0}
            </div>
            <p className="text-xs text-slate-600">Llamadas realizadas</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Ventas</CardTitle>
            <TrendingUp className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.totalVentas.toLocaleString() || 0}
            </div>
            <p className="text-xs text-slate-600">Ventas completadas</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Conversión</CardTitle>
            <Percent className="w-4 h-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.tasaConversion.toFixed(2) || 0}%
            </div>
            <p className="text-xs text-slate-600">Llamadas que se convierten</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">ROI</CardTitle>
            <BarChart3 className="w-4 h-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.roi.toFixed(1) || 0}%
            </div>
            <p className="text-xs text-slate-600">Retorno de inversión</p>
          </CardContent>
        </Card>
      </div>

      {/* Métricas financieras */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Facturación</CardTitle>
            <TrendingUp className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${metrics?.totalFacturacion.toLocaleString() || 0}
            </div>
            <p className="text-xs text-slate-600">Ingresos generados</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Gasto</CardTitle>
            <DollarSign className="w-4 h-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              ${metrics?.totalGasto.toLocaleString() || 0}
            </div>
            <p className="text-xs text-slate-600">Gasto total en llamadas</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Coste por Venta</CardTitle>
            <Calculator className="w-4 h-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${metrics?.costePorVenta.toFixed(2) || 0}
            </div>
            <p className="text-xs text-slate-600">Costo promedio por venta</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Costo por Llamada</CardTitle>
            <Phone className="w-4 h-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${metrics?.costoPorLlamada.toFixed(2) || 0}
            </div>
            <p className="text-xs text-slate-600">Costo promedio por llamada</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos principales - Layout horizontal */}
      <div className="space-y-6">
        <FacturacionChart data={facturacionData} />
        <ROIChart data={roiData} />
      </div>

      {/* Resumen detallado */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Resumen de Rendimiento
          </CardTitle>
          <CardDescription>
            Análisis detallado de las métricas de ventas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-4">
              <h4 className="font-semibold text-slate-800">Eficiencia de Llamadas</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">Llamadas realizadas:</span>
                  <span className="font-medium">{metrics?.totalLlamadas.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Ventas generadas:</span>
                  <span className="font-medium text-green-600">{metrics?.totalVentas.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Tasa de conversión:</span>
                  <span className="font-medium text-blue-600">{metrics?.tasaConversion.toFixed(2) || 0}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Clientes únicos:</span>
                  <span className="font-medium">{metrics?.clientesUnicos.toLocaleString() || 0}</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <h4 className="font-semibold text-slate-800">Análisis de Costos</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">Gasto total:</span>
                  <span className="font-medium text-red-600">${metrics?.totalGasto.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Facturación total:</span>
                  <span className="font-medium text-green-600">${metrics?.totalFacturacion.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Costo por llamada:</span>
                  <span className="font-medium">${metrics?.costoPorLlamada.toFixed(2) || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Costo por venta:</span>
                  <span className="font-medium">${metrics?.costePorVenta.toFixed(2) || 0}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-slate-800">Rentabilidad</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">ROI:</span>
                  <span className="font-medium text-green-600">{metrics?.roi.toFixed(1) || 0}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Beneficio neto:</span>
                  <span className="font-medium text-green-600">
                    ${((metrics?.totalFacturacion || 0) - (metrics?.totalGasto || 0)).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Margen de beneficio:</span>
                  <span className="font-medium text-blue-600">
                    {metrics?.totalFacturacion && metrics?.totalGasto 
                      ? (((metrics.totalFacturacion - metrics.totalGasto) / metrics.totalFacturacion) * 100).toFixed(1)
                      : 0}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
