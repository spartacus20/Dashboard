import React, { useMemo, useState } from "react";
import { IDENTIDAD_COLORS } from "../lib/constants";
import type { CallStats, FilterCriteria } from "../types";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Chart } from "../components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  ResponsiveContainer as RechartsResponsiveContainer,
  ComposedChart as RechartsComposedChart,
  Bar as RechartsBar,
  Line as RechartsLine,
  PieChart as RechartsPieChart,
  Pie as RechartsPie,
  Cell as RechartsCell,
  XAxis as RechartsXAxis,
  YAxis as RechartsYAxis,
  Tooltip as RechartsTooltip,
  Legend as RechartsLegend,
  CartesianGrid as RechartsCartesianGrid,
} from "recharts";
import {
  fetchLanzamientoMetrics,
  fetchLanzamientoMetricsToday,
  fetchLanzamientoMetricsCustom,
  fetchAsistenciaClicksByHour,
  fetchMotivosRechazo,
  getAvailableClientes,
  fetchWhatsappBotStats,
} from "../api";
import type { MotivoRechazoStat } from "../services/api/agendas";
import type { WhatsappBotPeriod } from "../services/api/whatsappBot";
import {
  translateDisconnectionReason,
  translateHousingType,
  translateInterest,
  generateDisconnectionData,
  generateDailyCallsData,
  generateEffectiveCallsData,
  generateHousingTypeData,
  generateAgendaHousingTypeData,
  generateInterestData,
  generateAgentesPorAgendasData,
  generateHourlyAgendasData,
  generateHourlyAgendasByChannelData,
} from "../lib/chartUtils";
import {
  getMadridYmdParts,
  getMadridMidnight,
  addDaysUTC,
  formatMadridDateYYYYMMDD,
  formatDiaLabel,
} from "../lib/dateUtils";
import { DisconnectionReasonsChart } from "../components/dashboard/charts/DisconnectionReasonsChart";
import { EffectiveCallsHourlyChart } from "../components/dashboard/charts/EffectiveCallsHourlyChart";
import { DailyCallsTrendChart } from "../components/dashboard/charts/DailyCallsTrendChart";
import { SimplePieChart } from "../components/dashboard/charts/SimplePieChart";
import { TimePeriodSelector } from "../components/dashboard/TimePeriodSelector";
import { getMetadata } from "../lib/supabase";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Helpers de zona horaria (Europa/Madrid)
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
// Función para traducir tipos de vivienda
// Función para traducir interés
// Función para generar datos del gráfico de desconexión
// Función para generar datos del gráfico de llamadas por día
// Función para generar datos del gráfico de llamadas efectivas por hora
// Función para generar datos del gráfico de tipos de vivienda (por llamadas)
// Función para generar datos del gráfico de agendas por tipo de vivienda (por agendas)
// Función para generar datos del gráfico de interés
// Función para generar datos del gráfico de agentes por agendas
// Función para generar datos del gráfico de agendamientos por hora

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
  loadDashboardData?: (
    fechaInicio?: string,
    fechaFin?: string,
    timePeriod?: string,
    bdd?: string,
    cliente?: string,
  ) => void;
  agendaEnabled?: boolean;
  launchEnabled?: boolean;
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
  agendaEnabled = true,
  launchEnabled = false,
}: DashboardProps) {
  // Error boundary simple
  const [hasError, setHasError] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string>("");

  React.useEffect(() => {
    const handleError = (error: ErrorEvent) => {
      // console.error("Error capturado en Dashboard:", error);
      setHasError(true);
      setErrorMessage(error.message || "Error desconocido");
    };

    window.addEventListener("error", handleError);
    return () => window.removeEventListener("error", handleError);
  }, []);

  if (hasError) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-800 mb-2">
            Error en el Dashboard
          </h2>
          <p className="text-red-700 mb-4">{errorMessage}</p>
          <button
            onClick={() => {
              setHasError(false);
              setErrorMessage("");
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
      return localStorage.getItem("dashboard_time_period") || "today";
    } catch {
      return "today";
    }
  });
  const [selectValue, setSelectValue] = useState<string>(() => {
    try {
      return localStorage.getItem("dashboard_time_period") || "today";
    } catch {
      return "today";
    }
  });
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [customStartTime, setCustomStartTime] = useState<string>("00:00");
  const [customEndTime, setCustomEndTime] = useState<string>("23:59");
  const [isCustomDateDialogOpen, setIsCustomDateDialogOpen] =
    useState<boolean>(false);
  const [tempStartDate, setTempStartDate] = useState<string>("");
  const [tempEndDate, setTempEndDate] = useState<string>("");
  const [tempStartTime, setTempStartTime] = useState<string>("00:00");
  const [tempEndTime, setTempEndTime] = useState<string>("23:59");

  // Estados para filtro de rango de horas (agendamientos)
  const [hourRangeStart, setHourRangeStart] = useState<string>("8");
  const [hourRangeEnd, setHourRangeEnd] = useState<string>("23");

  // Estados para filtro de rango de horas (llamadas efectivas)
  const [effectiveCallsHourStart, setEffectiveCallsHourStart] =
    useState<string>("0");
  const [effectiveCallsHourEnd, setEffectiveCallsHourEnd] =
    useState<string>("23");

  /** 0 = duración media efectivas, 1 = duración total (todas las llamadas con duración válida) */
  const [duracionCardSlide, setDuracionCardSlide] = useState<0 | 1>(0);

  // Estado para filtro de base de datos
  const [databaseFilter, setDatabaseFilter] = useState<string>("");
  const [appliedDatabaseFilter, setAppliedDatabaseFilter] =
    useState<string>("");

  // Estado para filtro de clientes (metadata->>'cliente'), solo visible si recoveries === true
  const [clienteFilter, setClienteFilter] = useState<string>("");
  const [appliedClienteFilter, setAppliedClienteFilter] = useState<string>("");
  const [availableClientes, setAvailableClientes] = useState<string[]>([]);
  const [showClienteFilter, setShowClienteFilter] = useState<boolean>(() => getMetadata()?.recoveries === true);

  // Estado para métricas de lanzamiento por región
  const [launchRegionMetrics, setLaunchRegionMetrics] = useState<{
    europa: {
      total_llamadas: number;
      llamadas_contestadas: number;
      llamadas_fallidas: number;
    };
    latam: {
      total_llamadas: number;
      llamadas_contestadas: number;
      llamadas_fallidas: number;
    };
    espana: {
      total_llamadas: number;
      llamadas_contestadas: number;
      llamadas_fallidas: number;
    };
  } | null>(null);
  const [launchRegionLoading, setLaunchRegionLoading] =
    useState<boolean>(false);
  const [launchRegionError, setLaunchRegionError] = useState<string | null>(
    null,
  );

  // Verificar si el usuario tiene permiso para ver filtro de base de datos
  const [hasFiltroSolar, setHasFiltroSolar] = React.useState(false);
  const [hasFit, setHasFit] = React.useState(false);

  /** 0 = WhatsApp, 1 = Llamada */
  const [agendamientosCardSlide, setAgendamientosCardSlide] = useState<0 | 1>(0);

  /** 0 = Llamadas Contestadas, 1 = Mensajes WhatsApp (solo hasFit) */
  const [contestadasSlide, setContestadasSlide] = useState<0 | 1>(0);
  const [whatsappMsgCount, setWhatsappMsgCount] = useState<number>(0);
  const [whatsappMsgLoading, setWhatsappMsgLoading] = useState<boolean>(false);

  // Motivos de rechazo (solo para clientes con filtro_solar)
  const [motivosRechazo, setMotivosRechazo] = React.useState<MotivoRechazoStat[]>([]);
  const [motivosRechazoLoading, setMotivosRechazoLoading] = React.useState(false);

  // Helpers para métricas de lanzamiento por región
  const normalizeLaunchRegionFromMetrics = React.useCallback((metrics: any) => {
    const porRegion = metrics?.porRegion || {};
    const getRegion = (key: "europa" | "latam" | "espana") => {
      const r = porRegion[key] || {};
      return {
        total_llamadas: r.total_llamadas ?? r.totalLlamadas ?? 0,
        llamadas_contestadas:
          r.llamadas_contestadas ?? r.llamadasContestadas ?? 0,
        llamadas_fallidas: r.llamadas_fallidas ?? r.llamadasFallidas ?? 0,
      };
    };
    return {
      europa: getRegion("europa"),
      latam: getRegion("latam"),
      espana: getRegion("espana"),
    };
  }, []);

  const normalizeLaunchRegionFromMetricsByRegion = React.useCallback(
    (apiData: any) => {
      const regionMap = new Map<string, any>();
      (apiData?.metrics_by_region || []).forEach((region: any) => {
        if (region?.region) {
          regionMap.set(String(region.region).toLowerCase(), region);
        }
      });
      const getRegion = (name: string) => {
        const r = regionMap.get(name.toLowerCase()) || {};
        return {
          total_llamadas: r.total_llamadas ?? r.totalLlamadas ?? 0,
          llamadas_contestadas:
            r.llamadas_contestadas ?? r.llamadasContestadas ?? 0,
          llamadas_fallidas: r.llamadas_fallidas ?? r.llamadasFallidas ?? 0,
        };
      };
      return {
        europa: getRegion("europa"),
        latam: getRegion("latam"),
        espana: getRegion("españa"),
      };
    },
    [],
  );

  const calculateLaunchPercentage = (value: number, total: number) => {
    if (!total || total <= 0) return 0;
    return Math.round((value / total) * 100);
  };

  // Estado para métricas de asistencia por hora (clicks)
  const [asistenciaByHour, setAsistenciaByHour] = useState<
    { label: string; clicks: number; hour: number }[]
  >([]);
  const [asistenciaLoading, setAsistenciaLoading] = useState<boolean>(false);
  const [asistenciaError, setAsistenciaError] = useState<string | null>(null);

  // Función para verificar el metadata
  const checkMetadata = React.useCallback(() => {
    try {
      const metadataStr = sessionStorage.getItem("metadata");
      if (metadataStr) {
        const metadata = JSON.parse(metadataStr);
        const hasFiltro = metadata?.filtro_solar === true;
        setHasFiltroSolar(hasFiltro);
        setHasFit(metadata?.fit === true);
        setShowClienteFilter(metadata?.recoveries === true);
        return hasFiltro;
      }
      setHasFiltroSolar(false);
      setHasFit(false);
      setShowClienteFilter(false);
      return false;
    } catch (error) {
      setHasFiltroSolar(false);
      setHasFit(false);
      setShowClienteFilter(false);
      return false;
    }
  }, []);

  // Verificar metadata inmediatamente y escuchar eventos de actualización
  React.useEffect(() => {
    // Verificar una sola vez al montar
    checkMetadata();

    // Escuchar evento personalizado cuando se actualiza el metadata
    const handleMetadataUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.metadata) {
        const hasFiltro = customEvent.detail.metadata.filtro_solar === true;
        setHasFiltroSolar(hasFiltro);
        setHasFit(customEvent.detail.metadata.fit === true);
        setShowClienteFilter(customEvent.detail.metadata.recoveries === true);
      } else {
        checkMetadata();
        setShowClienteFilter(getMetadata()?.recoveries === true);
      }
    };

    window.addEventListener("metadataUpdated", handleMetadataUpdate);

    return () => {
      window.removeEventListener("metadataUpdated", handleMetadataUpdate);
    };
  }, [checkMetadata]);

  // Cargar estadísticas de WhatsApp Bot (solo para clientes con fit === true)
  // Se sincroniza con el período global del dashboard (timePeriod)
  React.useEffect(() => {
    if (!hasFit) {
      setWhatsappMsgCount(0);
      return;
    }
    const clientId = localStorage.getItem('get_client_id');
    if (!clientId) return;

    const periodMap: Record<string, WhatsappBotPeriod> = {
      today: 'today',
      week: 'week',
      month: 'month',
    };
    const waPeriod: WhatsappBotPeriod = periodMap[timePeriod] ?? 'all';

    let cancelled = false;
    setWhatsappMsgLoading(true);
    fetchWhatsappBotStats(clientId, waPeriod)
      .then(({ total }) => { if (!cancelled) setWhatsappMsgCount(total); })
      .catch(() => { if (!cancelled) setWhatsappMsgCount(0); })
      .finally(() => { if (!cancelled) setWhatsappMsgLoading(false); });

    return () => { cancelled = true; };
  }, [hasFit, timePeriod]);

  // Cargar clientes disponibles cuando showClienteFilter es true; limpiar cuando es false
  React.useEffect(() => {
    if (!showClienteFilter) {
      setAvailableClientes([]);
      setClienteFilter("");
      setAppliedClienteFilter("");
      return;
    }
    const clientId = localStorage.getItem('get_client_id');
    if (!clientId) return;
    getAvailableClientes(clientId).then(setAvailableClientes).catch(() => setAvailableClientes([]));
  }, [showClienteFilter]);

  // Cargar motivos de rechazo cuando el cliente tiene filtro_solar
  React.useEffect(() => {
    const clientId = localStorage.getItem('get_client_id');
    if (!clientId) return;

    // Obtener filtro_solar directamente del sessionStorage para evitar problemas de timing
    let isSolar = hasFiltroSolar;
    if (!isSolar) {
      try {
        const meta = sessionStorage.getItem('metadata');
        isSolar = meta ? JSON.parse(meta)?.filtro_solar === true : false;
      } catch { /* noop */ }
    }

    if (!isSolar) {
      setMotivosRechazo([]);
      return;
    }

    let fechaInicio: string | undefined;
    let fechaFin: string | undefined;

    if (timePeriod === 'today') {
      const today = new Date().toISOString().slice(0, 10);
      fechaInicio = today;
      fechaFin = today;
    } else if (timePeriod === 'week') {
      const now = new Date();
      const day = now.getDay() || 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - (day - 1));
      fechaInicio = monday.toISOString().slice(0, 10);
      fechaFin = now.toISOString().slice(0, 10);
    } else if (timePeriod === 'month') {
      const now = new Date();
      fechaInicio = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      fechaFin = now.toISOString().slice(0, 10);
    } else if (timePeriod === 'custom' && customStartDate && customEndDate) {
      fechaInicio = customStartDate;
      fechaFin = customEndDate;
    }

    setMotivosRechazoLoading(true);
    fetchMotivosRechazo(clientId, fechaInicio, fechaFin)
      .then((data) => setMotivosRechazo(data))
      .catch(() => setMotivosRechazo([]))
      .finally(() => setMotivosRechazoLoading(false));
  }, [hasFiltroSolar, timePeriod, customStartDate, customEndDate]);

  // Función para validar y actualizar el rango de horas (agendamientos)
  const handleHourRangeChange = (type: "start" | "end", value: string) => {
    const startHour = parseInt(type === "start" ? value : hourRangeStart);
    const endHour = parseInt(type === "end" ? value : hourRangeEnd);

    if (type === "start") {
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
  const handleEffectiveCallsHourRangeChange = (
    type: "start" | "end",
    value: string,
  ) => {
    const startHour = parseInt(
      type === "start" ? value : effectiveCallsHourStart,
    );
    const endHour = parseInt(type === "end" ? value : effectiveCallsHourEnd);

    if (type === "start") {
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
    // console.log("Dashboard - dashboardData:", dashboardData);
    if (dashboardData) {
      // console.log("Dashboard - estadisticas:", dashboardData.estadisticas);
      // console.log(
      //   "Dashboard - razones_desconexion:",
      //   dashboardData.razones_desconexion,
      // );
      // console.log(
      //   "Dashboard - tipos_vivienda:",
      //   dashboardData.dashboard_data?.tipos_vivienda,
      // );
      // console.log("Dashboard - timePeriod:", timePeriod);
    }
  }, [dashboardData, timePeriod]);

  // Persistir selección de período para evitar que vuelva al anterior por remounts
  React.useEffect(() => {
    try {
      localStorage.setItem("dashboard_time_period", timePeriod);
      // Sincronizar selectValue con timePeriod cuando no es 'custom' o cuando se confirma
      if (timePeriod !== "custom" || (customStartDate && customEndDate)) {
        setSelectValue(timePeriod);
      }
    } catch {}
  }, [timePeriod, customStartDate, customEndDate]);

  // El fetch inicial lo maneja CallsContext automáticamente.
  // Este efecto fue eliminado para evitar el doble fetch al montar el Dashboard.

  // Función para calcular las fechas según el período seleccionado (zona horaria Madrid)
  const calculateDatesForPeriod = (
    period: string,
    customStart?: string,
    customEnd?: string,
    customStartTime?: string,
    customEndTime?: string,
  ) => {
    const todayMadrid = getMadridMidnight();

    switch (period) {
      case "today":
        const todayStr = formatMadridDateYYYYMMDD(todayMadrid);
        const tomorrow = addDaysUTC(todayMadrid, 1);
        const tomorrowStr = formatMadridDateYYYYMMDD(tomorrow);
        return { fechaInicio: todayStr, fechaFin: tomorrowStr };

      case "week":
        // Últimos 7 días (incluyendo hoy): hoy - 6 hasta hoy (inclusive), fin = hoy + 1 (exclusivo)
        const startOfWeek = addDaysUTC(todayMadrid, -6);
        const endOfWeek = addDaysUTC(todayMadrid, 1);
        return {
          fechaInicio: startOfWeek.toISOString(),
          fechaFin: endOfWeek.toISOString(),
        };

      case "month":
        // Calcular igual que el backend: desde el día 1 del mes actual hasta el día 1 del mes siguiente
        const { year: yearMonth, month: monthMonth } = getMadridYmdParts();
        const startOfMonth = new Date(
          Date.UTC(yearMonth, monthMonth - 1, 1, 0, 0, 0, 0),
        );
        const endOfMonth = new Date(
          Date.UTC(yearMonth, monthMonth, 1, 0, 0, 0, 0),
        );

        return {
          fechaInicio: startOfMonth.toISOString(),
          fechaFin: endOfMonth.toISOString(),
        };

      case "custom":
        if (customStart && customEnd) {
          // Interpretar fechas YYYY-MM-DD en zona Madrid y convertir a rango con horas y minutos
          const [yS, mS, dS] = customStart.split("-").map(Number);
          const [yE, mE, dE] = customEnd.split("-").map(Number);

          // Parsear tiempo (HH:MM)
          const startTimeParts = (customStartTime || "00:00").split(":");
          const endTimeParts = (customEndTime || "23:59").split(":");
          const startHour = parseInt(startTimeParts[0] || "0", 10);
          const startMinute = parseInt(startTimeParts[1] || "0", 10);
          const endHour = parseInt(endTimeParts[0] || "23", 10);
          const endMinute = parseInt(endTimeParts[1] || "59", 10);

          // Crear fecha de inicio con hora y minuto específicos
          const startMadrid = new Date(
            Date.UTC(yS, (mS || 1) - 1, dS || 1, startHour, startMinute, 0, 0),
          );

          // Crear fecha de fin con hora y minuto específicos
          // El backend usa rango semiabierto [inicio, fin), así que necesitamos el momento justo después del final
          let endMadrid = new Date(
            Date.UTC(yE, (mE || 1) - 1, dE || 1, endHour, endMinute, 59, 999),
          );

          // Si es el mismo día y la hora/minuto de fin es menor o igual que la de inicio, sumar un día
          if (customStart === customEnd) {
            const startTimeMinutes = startHour * 60 + startMinute;
            const endTimeMinutes = endHour * 60 + endMinute;
            if (endTimeMinutes <= startTimeMinutes) {
              endMadrid = addDaysUTC(endMadrid, 1);
            }
          }

          // Agregar 1 milisegundo para que el rango semiabierto [inicio, fin) incluya hasta el último milisegundo
          // Esto asegura que created_at < fechaFin incluya todos los registros hasta endHour:endMinute:59.999
          endMadrid = new Date(endMadrid.getTime() + 1);

          // Convertir a formato ISO para enviar al backend
          return {
            fechaInicio: startMadrid.toISOString(),
            fechaFin: endMadrid.toISOString(),
          };
        }
        return null;

      default: // 'all'
        return null;
    }
  };

  // Función para manejar el cambio de período
  const handleTimePeriodChange = (newPeriod: string) => {
    if (newPeriod === "custom") {
      // Si se selecciona personalizado, abrir el dialog
      setTempStartDate(customStartDate);
      setTempEndDate(customEndDate);
      setTempStartTime(customStartTime);
      setTempEndTime(customEndTime);
      setIsCustomDateDialogOpen(true);
      // Actualizar selectValue para que el Select muestre "custom" visualmente
      // pero no cambiar timePeriod hasta confirmar las fechas
      setSelectValue("custom");
    } else {
      // Para otros períodos, cambiar directamente
      setTimePeriod(newPeriod);
      setSelectValue(newPeriod);
    }
  };

  // Función para confirmar las fechas personalizadas
  const handleConfirmCustomDates = () => {
    if (tempStartDate && tempEndDate && tempStartDate <= tempEndDate) {
      setCustomStartDate(tempStartDate);
      setCustomEndDate(tempEndDate);
      setCustomStartTime(tempStartTime);
      setCustomEndTime(tempEndTime);
      setTimePeriod("custom");
      setSelectValue("custom");
      setIsCustomDateDialogOpen(false);
      // Resetear las fechas temporales
      setTempStartDate("");
      setTempEndDate("");
      setTempStartTime("00:00");
      setTempEndTime("23:59");
    }
  };

  // Función para cancelar el dialog
  const handleCancelCustomDates = () => {
    setIsCustomDateDialogOpen(false);
    // Resetear las fechas temporales
    setTempStartDate("");
    setTempEndDate("");
    setTempStartTime("00:00");
    setTempEndTime("23:59");
    // Revertir el selectValue al período anterior si no había fechas confirmadas
    if (!customStartDate || !customEndDate) {
      setSelectValue(timePeriod);
    }
  };

  // Función para aplicar el filtro de base de datos
  const applyDatabaseFilter = () => {
    setAppliedDatabaseFilter(databaseFilter.trim());
  };

  // Función para limpiar el filtro de base de datos
  const clearDatabaseFilter = () => {
    setDatabaseFilter("");
    setAppliedDatabaseFilter("");
  };

  // Funciones para el filtro de clientes
  const applyClienteFilter = () => {
    setAppliedClienteFilter(clienteFilter);
  };

  const clearClienteFilter = () => {
    setClienteFilter("");
    setAppliedClienteFilter("");
  };

  // Función para actualizar los datos del dashboard con el período y filtros actuales
  const handleRefresh = React.useCallback(() => {
    if (!loadDashboardData) return;

    const bddFilter = appliedDatabaseFilter || undefined;
    const clienteFilterVal = appliedClienteFilter || undefined;

    if (timePeriod === "all") {
      loadDashboardData(undefined, undefined, "all", bddFilter, clienteFilterVal);
    } else if (timePeriod === "custom" && customStartDate && customEndDate) {
      const dates = calculateDatesForPeriod(
        timePeriod,
        customStartDate,
        customEndDate,
        customStartTime,
        customEndTime,
      );
      if (dates) {
        loadDashboardData(
          dates.fechaInicio,
          dates.fechaFin,
          "custom",
          bddFilter,
          clienteFilterVal,
        );
      }
    } else if (
      timePeriod === "today" ||
      timePeriod === "week" ||
      timePeriod === "month"
    ) {
      loadDashboardData(undefined, undefined, timePeriod, bddFilter, clienteFilterVal);
    }
  }, [
    timePeriod,
    customStartDate,
    customEndDate,
    customStartTime,
    customEndTime,
    appliedDatabaseFilter,
    appliedClienteFilter,
    loadDashboardData,
  ]);

  // Auto-fetch al cambiar período o filtros, pero NO en el primer render del componente
  // (así al navegar de vuelta no se dispara automáticamente)
  const hasMounted = React.useRef(false);
  React.useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    handleRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timePeriod, customStartDate, customEndDate, customStartTime, customEndTime, appliedDatabaseFilter, appliedClienteFilter]);

  const [showStatusBadge, setShowStatusBadge] = React.useState(false);
  const [statusBadgeFading, setStatusBadgeFading] = React.useState(false);
  const STATUS_BADGE_VISIBLE_MS = 5000;
  const STATUS_BADGE_FADE_MS = 300;

  React.useEffect(() => {
    if (!dashboardData) {
      setShowStatusBadge(false);
      setStatusBadgeFading(false);
      return;
    }

    if (loading) {
      setShowStatusBadge(true);
      setStatusBadgeFading(false);
      return;
    }

    setShowStatusBadge(true);
    setStatusBadgeFading(false);

    const fadeTimer = window.setTimeout(() => {
      setStatusBadgeFading(true);
    }, STATUS_BADGE_VISIBLE_MS);

    const hideTimer = window.setTimeout(() => {
      setShowStatusBadge(false);
      setStatusBadgeFading(false);
    }, STATUS_BADGE_VISIBLE_MS + STATUS_BADGE_FADE_MS);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, [loading, dashboardData]);

  // Cargar métricas de lanzamiento por región cuando el usuario tiene permiso y cambia el período
  React.useEffect(() => {
    const loadLaunchRegionMetrics = async () => {
      if (!launchEnabled) {
        setLaunchRegionMetrics(null);
        return;
      }
      try {
        setLaunchRegionLoading(true);
        setLaunchRegionError(null);

        // Seleccionar endpoint según período
        if (timePeriod === "today") {
          const data = await fetchLanzamientoMetricsToday();
          const normalized = normalizeLaunchRegionFromMetricsByRegion(data);
          setLaunchRegionMetrics(normalized);
        } else if (timePeriod === "week") {
          // Calcular fechas para la semana y usar endpoint genérico
          const dates = calculateDatesForPeriod("week");
          if (dates) {
            const data = await fetchLanzamientoMetricsCustom(
              dates.fechaInicio,
              dates.fechaFin,
            );
            const normalized = normalizeLaunchRegionFromMetricsByRegion(data);
            setLaunchRegionMetrics(normalized);
          } else {
            setLaunchRegionMetrics(null);
          }
        } else if (timePeriod === "month") {
          // Calcular fechas para el mes y usar endpoint genérico
          const dates = calculateDatesForPeriod("month");
          if (dates) {
            const data = await fetchLanzamientoMetricsCustom(
              dates.fechaInicio,
              dates.fechaFin,
            );
            const normalized = normalizeLaunchRegionFromMetricsByRegion(data);
            setLaunchRegionMetrics(normalized);
          } else {
            setLaunchRegionMetrics(null);
          }
        } else if (
          timePeriod === "custom" &&
          customStartDate &&
          customEndDate
        ) {
          const data = await fetchLanzamientoMetricsCustom(
            customStartDate,
            customEndDate,
          );
          const normalized = normalizeLaunchRegionFromMetricsByRegion(data);
          setLaunchRegionMetrics(normalized);
        } else if (timePeriod === "all") {
          const metrics = await fetchLanzamientoMetrics();
          const normalized = normalizeLaunchRegionFromMetrics(metrics);
          setLaunchRegionMetrics(normalized);
        } else {
          setLaunchRegionMetrics(null);
        }
      } catch (error: any) {
        // console.error(
        //   "Error al cargar métricas de lanzamiento por región en Dashboard:",
        //   error,
        // );
        setLaunchRegionError(
          error?.message ||
            "Error al cargar métricas de lanzamiento por región",
        );
        setLaunchRegionMetrics(null);
      } finally {
        setLaunchRegionLoading(false);
      }
    };

    loadLaunchRegionMetrics();
  }, [
    launchEnabled,
    timePeriod,
    customStartDate,
    customEndDate,
    normalizeLaunchRegionFromMetrics,
    normalizeLaunchRegionFromMetricsByRegion,
  ]);

  // Cargar métricas de asistencia por hora (clicks) según el período seleccionado
  React.useEffect(() => {
    const loadAsistenciaByHour = async () => {
      if (!launchEnabled) {
        setAsistenciaByHour([]);
        return;
      }
      try {
        setAsistenciaLoading(true);
        setAsistenciaError(null);

        let fechaInicio: string | undefined;
        let fechaFin: string | undefined;

        if (timePeriod === "all") {
          // Sin filtros de fecha: backend devolverá todos los datos
          fechaInicio = undefined;
          fechaFin = undefined;
        } else if (
          timePeriod === "custom" &&
          customStartDate &&
          customEndDate
        ) {
          const dates = calculateDatesForPeriod(
            "custom",
            customStartDate,
            customEndDate,
            customStartTime,
            customEndTime,
          );
          fechaInicio = dates?.fechaInicio;
          fechaFin = dates?.fechaFin;
        } else {
          const dates = calculateDatesForPeriod(
            timePeriod,
            customStartDate,
            customEndDate,
          );
          fechaInicio = dates?.fechaInicio;
          fechaFin = dates?.fechaFin;
        }

        const raw = await fetchAsistenciaClicksByHour(fechaInicio, fechaFin);

        const processed =
          raw
            ?.filter((item: any) => (item.clicks_totales || 0) > 0)
            .map((item: any) => {
              const hour =
                typeof item.hora === "number"
                  ? item.hora
                  : parseInt(item.hora || "0", 10);
              return {
                label: `${hour.toString().padStart(2, "0")}:00`,
                clicks: item.clicks_totales || 0,
                hour,
              };
            }) || [];

        setAsistenciaByHour(processed);
      } catch (error: any) {
        // console.error(
        //   "Error al cargar métricas de asistencia por hora:",
        //   error,
        // );
        setAsistenciaError(
          error?.message || "Error al cargar métricas de asistencia por hora",
        );
        setAsistenciaByHour([]);
      } finally {
        setAsistenciaLoading(false);
      }
    };

    loadAsistenciaByHour();
  }, [
    launchEnabled,
    timePeriod,
    customStartDate,
    customEndDate,
    customStartTime,
    customEndTime,
  ]);

  // Función para filtrar datos por período (usando medianoche en Madrid)
  const filterDataByPeriod = (data: any[], dateField: string = "fecha") => {
    if (!data || !Array.isArray(data)) return data;

    try {
      const today = getMadridMidnight();

      switch (timePeriod) {
        case "today":
          const tomorrowForFilter = addDaysUTC(today, 1);
          return data.filter((item) => {
            try {
              const itemDate = new Date(item[dateField]);
              return (
                !isNaN(itemDate.getTime()) &&
                itemDate >= today &&
                itemDate < tomorrowForFilter
              );
            } catch (error) {
              // console.warn("Error procesando fecha:", item[dateField], error);
              return false;
            }
          });

        case "week":
          const weekStart = addDaysUTC(today, -6);
          const weekEndExclusive = addDaysUTC(today, 1);
          return data.filter((item) => {
            try {
              const itemDate = new Date(item[dateField]);
              return (
                !isNaN(itemDate.getTime()) &&
                itemDate >= weekStart &&
                itemDate < weekEndExclusive
              );
            } catch (error) {
              // console.warn("Error procesando fecha:", item[dateField], error);
              return false;
            }
          });

        case "month":
          const monthStart = addDaysUTC(today, -30);
          return data.filter((item) => {
            try {
              const itemDate = new Date(item[dateField]);
              return !isNaN(itemDate.getTime()) && itemDate >= monthStart;
            } catch (error) {
              // console.warn("Error procesando fecha:", item[dateField], error);
              return false;
            }
          });

        case "custom":
          if (customStartDate && customEndDate) {
            try {
              // Parsear fechas considerando horas si están disponibles
              let startDate: Date;
              let endDateExclusive: Date;

              if (customStartTime && customEndTime) {
                const [yS, mS, dS] = customStartDate.split("-").map(Number);
                const [hS, minS] = customStartTime.split(":").map(Number);
                const [yE, mE, dE] = customEndDate.split("-").map(Number);
                const [hE, minE] = customEndTime.split(":").map(Number);

                startDate = new Date(
                  Date.UTC(
                    yS,
                    (mS || 1) - 1,
                    dS || 1,
                    hS || 0,
                    minS || 0,
                    0,
                    0,
                  ),
                );
                endDateExclusive = new Date(
                  Date.UTC(
                    yE,
                    (mE || 1) - 1,
                    dE || 1,
                    hE || 23,
                    minE || 59,
                    59,
                    999,
                  ),
                );
                endDateExclusive = addDaysUTC(endDateExclusive, 0);
                endDateExclusive.setUTCMilliseconds(999);
              } else {
                const [yS, mS, dS] = customStartDate.split("-").map(Number);
                const [yE, mE, dE] = customEndDate.split("-").map(Number);
                startDate = new Date(
                  Date.UTC(yS, (mS || 1) - 1, dS || 1, 0, 0, 0, 0),
                );
                endDateExclusive = addDaysUTC(
                  new Date(
                    Date.UTC(yE, (mE || 1) - 1, dE || 1, 23, 59, 59, 999),
                  ),
                  0,
                );
              }

              return data.filter((item) => {
                try {
                  const fechaStr = item[dateField];
                  if (!fechaStr) return false;

                  // Parsear fecha como string YYYY-MM-DD directamente (sin usar new Date que puede cambiar zona horaria)
                  const fechaParts = fechaStr
                    .toString()
                    .split("T")[0]
                    .split("-");
                  if (fechaParts.length !== 3) return false;

                  const [itemYear, itemMonth, itemDay] = fechaParts.map(Number);

                  // Comparar directamente los componentes de fecha
                  const itemDateOnly = new Date(
                    Date.UTC(itemYear, itemMonth - 1, itemDay),
                  );
                  const startDateOnly = new Date(
                    Date.UTC(
                      startDate.getUTCFullYear(),
                      startDate.getUTCMonth(),
                      startDate.getUTCDate(),
                    ),
                  );
                  const endDateOnly = new Date(
                    Date.UTC(
                      endDateExclusive.getUTCFullYear(),
                      endDateExclusive.getUTCMonth(),
                      endDateExclusive.getUTCDate(),
                    ),
                  );

                  return (
                    itemDateOnly >= startDateOnly && itemDateOnly < endDateOnly
                  );
                } catch (error) {
                  // console.warn(
                  //   "Error procesando fecha:",
                  //   item[dateField],
                  //   error,
                  // );
                  return false;
                }
              });
            } catch (error) {
              // console.warn("Error procesando fechas personalizadas:", error);
              return data;
            }
          }
          return data;

        default:
          return data;
      }
    } catch (error) {
      // console.error("Error en filterDataByPeriod:", error);
      return data;
    }
  };

  // Datos para los gráficos con filtrado
  const filteredDailyData = useMemo(() => {
    try {
      if (dashboardData?.dashboard_data?.llamadas_por_dia) {
        // console.log(
        //   "Datos originales de llamadas_por_dia:",
        //   dashboardData.dashboard_data.llamadas_por_dia,
        // );
        // Para períodos específicos (week, month, today), el backend ya devuelve datos filtrados
        // No necesitamos filtrar de nuevo, solo para 'custom' y 'all'
        let filtered = dashboardData.dashboard_data.llamadas_por_dia;
        if (timePeriod === "custom" || timePeriod === "all") {
          filtered = filterDataByPeriod(
            dashboardData.dashboard_data.llamadas_por_dia,
            "fecha",
          );
        }
        // console.log("Datos filtrados:", filtered);
        return filtered;
      }
      // console.log("No hay datos de llamadas_por_dia en dashboardData");
      return [];
    } catch (error) {
      // console.error("Error procesando filteredDailyData:", error);
      return [];
    }
  }, [dashboardData, timePeriod, customStartDate, customEndDate]);

  // Rellenar días faltantes en el rango (semana, mes, personalizado) para que todos aparezcan en el gráfico
  const filledDailyData = useMemo(() => {
    const today = getMadridMidnight();
    const mapByFecha = new Map<string, any>();
    // Solo incluir datos que estén dentro del rango correcto
    (filteredDailyData || []).forEach((item: any) => {
      const f = item.fecha ? String(item.fecha).split("T")[0] : "";
      if (f) {
        // Verificar que la fecha esté en el rango correcto antes de agregarla
        let shouldInclude = true;
        if (timePeriod === "week") {
          const weekStart = addDaysUTC(today, -6);
          const weekEndExclusive = addDaysUTC(today, 1);
          const itemDate = new Date(f + "T00:00:00Z");
          if (itemDate < weekStart || itemDate >= weekEndExclusive) {
            shouldInclude = false;
          }
        } else if (timePeriod === "month") {
          // Para mes: desde el día 1 del mes actual hasta hoy
          const { year, month } = getMadridYmdParts(today);
          const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
          const monthEndExclusive = addDaysUTC(today, 1);
          const itemDate = new Date(f + "T00:00:00Z");
          if (itemDate < monthStart || itemDate >= monthEndExclusive) {
            shouldInclude = false;
          }
        }
        if (shouldInclude) {
          mapByFecha.set(f, item);
        }
      }
    });

    if (timePeriod === "week") {
      const days: any[] = [];
      for (let i = -6; i <= 0; i++) {
        const d = addDaysUTC(today, i);
        const fechaStr = formatMadridDateYYYYMMDD(d);
        const existing = mapByFecha.get(fechaStr);
        days.push(
          existing ?? {
            fecha: fechaStr,
            dia_label: formatDiaLabel(fechaStr),
            total_llamadas: 0,
            llamadas_efectivas: 0,
            llamadas_fallidas: 0,
            costo_dia: 0,
            total_agendamientos: 0,
          },
        );
      }
      return days;
    }
    if (timePeriod === "month") {
      // Para mes: desde el día 1 del mes actual hasta hoy
      const { year, month } = getMadridYmdParts(today);
      const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
      const days: any[] = [];
      const cursor = new Date(monthStart);
      const todayEnd = addDaysUTC(today, 1);
      while (cursor < todayEnd) {
        const fechaStr = formatMadridDateYYYYMMDD(cursor);
        const existing = mapByFecha.get(fechaStr);
        days.push(
          existing ?? {
            fecha: fechaStr,
            dia_label: formatDiaLabel(fechaStr),
            total_llamadas: 0,
            llamadas_efectivas: 0,
            llamadas_fallidas: 0,
            costo_dia: 0,
            total_agendamientos: 0,
          },
        );
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
      return days;
    }
    if (timePeriod === "custom" && customStartDate && customEndDate) {
      try {
        const [yS, mS, dS] = customStartDate.split("-").map(Number);
        const [yE, mE, dE] = customEndDate.split("-").map(Number);
        const start = new Date(
          Date.UTC(yS, (mS || 1) - 1, dS || 1, 0, 0, 0, 0),
        );
        const end = new Date(
          Date.UTC(yE, (mE || 1) - 1, dE || 1, 23, 59, 59, 999),
        );
        const days: any[] = [];
        const cursor = new Date(start);
        while (cursor <= end) {
          const fechaStr = formatMadridDateYYYYMMDD(cursor);
          const existing = mapByFecha.get(fechaStr);
          days.push(
            existing ?? {
              fecha: fechaStr,
              dia_label: formatDiaLabel(fechaStr),
              total_llamadas: 0,
              llamadas_efectivas: 0,
              llamadas_fallidas: 0,
              costo_dia: 0,
              total_agendamientos: 0,
            },
          );
          cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
        return days;
      } catch {
        return filteredDailyData || [];
      }
    }
    return filteredDailyData || [];
  }, [timePeriod, filteredDailyData, customStartDate, customEndDate]);

  const disconnectionData = useMemo(
    () => generateDisconnectionData([], dashboardData),
    [dashboardData],
  );
  const dailyCallsData = useMemo(() => {
    // console.log(
    //   "Procesando dailyCallsData con filledDailyData:",
    //   filledDailyData,
    // );
    try {
      if (filledDailyData && filledDailyData.length > 0) {
        const processedData = filledDailyData.map((item: any) => {
          try {
            return {
              label: item.dia_label || item.fecha || "Fecha desconocida",
              llamadas: Number(item.total_llamadas) || 0,
              llamadas_efectivas: Number(item.llamadas_efectivas) || 0,
              costo: Number(item.costo_dia) || 0,
              fecha: item.fecha || "",
              total_agendamientos: Number(item.total_agendamientos) || 0,
            };
          } catch (error) {
            // console.warn(
            //   "Error procesando item en dailyCallsData:",
            //   item,
            //   error,
            // );
            return {
              label: "Error",
              llamadas: 0,
              llamadas_efectivas: 0,
              costo: 0,
              fecha: "",
              total_agendamientos: 0,
            };
          }
        });
        // console.log("dailyCallsData procesado:", processedData);
        return processedData;
      }
      // console.log("No hay datos para dailyCallsData");
      return [];
    } catch (error) {
      // console.error("Error procesando dailyCallsData:", error);
      return [];
    }
  }, [filledDailyData]);

  const hourlyAgendasData = useMemo(
    () =>
      generateHourlyAgendasData(dashboardData, hourRangeStart, hourRangeEnd),
    [dashboardData, hourRangeStart, hourRangeEnd],
  );
  const hourlyAgendasByChannelData = useMemo(
    () => generateHourlyAgendasByChannelData(dashboardData, hourRangeStart, hourRangeEnd),
    [dashboardData, hourRangeStart, hourRangeEnd],
  );
  const housingTypeData = useMemo(
    () => generateHousingTypeData(dashboardData),
    [dashboardData],
  );
  const agendaHousingTypeData = useMemo(
    () => generateAgendaHousingTypeData(dashboardData),
    [dashboardData],
  );
  const hasAgendasInPeriod = !!(
    dashboardData?.dashboard_data?.metricas_generales?.total_agendamientos &&
    dashboardData.dashboard_data.metricas_generales.total_agendamientos > 0
  );
  const agendaPropertyTypeData = useMemo(() => {
    if (
      !hasAgendasInPeriod ||
      !agendaHousingTypeData ||
      agendaHousingTypeData.length === 0
    )
      return [];
    return agendaHousingTypeData
      .map((item: any) => ({
        label: item.label,
        porcentaje:
          typeof item.porcentaje === "string"
            ? parseFloat(item.porcentaje)
            : item.porcentaje || 0,
      }))
      .filter((item: any) => item.porcentaje && item.porcentaje > 0);
  }, [agendaHousingTypeData, hasAgendasInPeriod]);
  const interestData = useMemo(
    () => generateInterestData(dashboardData),
    [dashboardData],
  );
  const effectiveCallsData = useMemo(
    () =>
      generateEffectiveCallsData(
        dashboardData,
        effectiveCallsHourStart,
        effectiveCallsHourEnd,
      ),
    [dashboardData, effectiveCallsHourStart, effectiveCallsHourEnd],
  );
  const agentesPorAgendasData = useMemo(
    () => generateAgentesPorAgendasData(dashboardData),
    [dashboardData],
  );

  // Datos combinados para gráfico llamadas (barras) vs agendas (línea)
  const combinedCallsAgendasData = useMemo(() => {
    // Modo "hoy": usar series por hora
    if (timePeriod === "today") {
      if (
        (!effectiveCallsData || effectiveCallsData.length === 0) &&
        (!hourlyAgendasData || hourlyAgendasData.length === 0)
      ) {
        return [];
      }

      const map = new Map<
        string,
        { label: string; llamadas: number; agendas: number }
      >();

      if (effectiveCallsData && effectiveCallsData.length > 0) {
        effectiveCallsData.forEach((item: any) => {
          const label = item.label ?? "";
          const llamadas =
            typeof item.llamadas === "number" ? item.llamadas : 0;
          if (!label) return;
          map.set(label, { label, llamadas, agendas: 0 });
        });
      }

      if (hourlyAgendasData && hourlyAgendasData.length > 0) {
        hourlyAgendasData.forEach((item: any) => {
          const label = item.label ?? "";
          const agendas = typeof item.agendas === "number" ? item.agendas : 0;
          if (!label) return;
          const existing = map.get(label);
          if (existing) {
            existing.agendas = agendas;
          } else {
            map.set(label, { label, llamadas: 0, agendas });
          }
        });
      }

      const result = Array.from(map.values());
      result.sort((a, b) => a.label.localeCompare(b.label));
      return result;
    }

    // Otros períodos (semana, mes, personalizado): usar llamadas efectivas reales por día
    if (!dailyCallsData || dailyCallsData.length === 0) {
      return [];
    }

    // Construir array preservando fecha para ordenar cronológicamente (más antiguo primero)
    const result = dailyCallsData.map((item: any) => {
      const label = item.label ?? item.fecha ?? "";
      const fecha = item.fecha ?? "";
      const llamadas =
        typeof item.llamadas_efectivas === "number"
          ? item.llamadas_efectivas
          : 0;
      const agendas =
        typeof item.total_agendamientos === "number"
          ? item.total_agendamientos
          : 0;
      return { label, fecha, llamadas, agendas };
    });

    // Ordenar por fecha ascendente (día más antiguo primero, hoy al final)
    result.sort((a: any, b: any) => {
      const dateA = a.fecha ? String(a.fecha).split("T")[0] : "";
      const dateB = b.fecha ? String(b.fecha).split("T")[0] : "";
      return dateA.localeCompare(dateB);
    });

    // Log para validar suma de llamadas efectivas
    if (timePeriod === "week" && result.length > 0) {
      const sumaGrafico = result.reduce(
        (sum: number, item: any) => sum + item.llamadas,
        0,
      );
      const totalCard =
        dashboardData?.dashboard_data?.metricas_generales?.llamadas_efectivas ||
        0;
      // console.log("🔍 Validación llamadas efectivas (semana):", {
      //   sumaGrafico,
      //   totalCard,
      //   diferencia: sumaGrafico - totalCard,
      //   datosPorDia: result.map((r: any) => ({
      //     fecha: r.fecha,
      //     llamadas: r.llamadas,
      //   })),
      // });
    }

    // Si el rango de fechas es mayor a 30 días, agrupar por semana
    if (result.length > 0) {
      const firstDateStr = result[0].fecha
        ? String(result[0].fecha).split("T")[0]
        : "";
      const lastDateStr = result[result.length - 1].fecha
        ? String(result[result.length - 1].fecha).split("T")[0]
        : "";

      if (firstDateStr && lastDateStr) {
        const firstDate = new Date(firstDateStr);
        const lastDate = new Date(lastDateStr);
        const diffMs = lastDate.getTime() - firstDate.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24) + 1;

        if (!isNaN(diffDays) && diffDays > 30) {
          const msPerDay = 24 * 60 * 60 * 1000;
          const weekMap = new Map<
            number,
            {
              fecha_inicio: string;
              fecha_fin: string;
              llamadas: number;
              agendas: number;
            }
          >();

          result.forEach((item: any) => {
            const fechaStr = item.fecha ? String(item.fecha).split("T")[0] : "";
            if (!fechaStr) return;
            const d = new Date(fechaStr);
            if (isNaN(d.getTime())) return;

            const weekIndex = Math.floor(
              (d.getTime() - firstDate.getTime()) / (7 * msPerDay),
            );
            const llamadas =
              typeof item.llamadas === "number" ? item.llamadas : 0;
            const agendas = typeof item.agendas === "number" ? item.agendas : 0;

            const existing = weekMap.get(weekIndex);
            if (existing) {
              existing.llamadas += llamadas;
              existing.agendas += agendas;
              if (fechaStr < existing.fecha_inicio)
                existing.fecha_inicio = fechaStr;
              if (fechaStr > existing.fecha_fin) existing.fecha_fin = fechaStr;
            } else {
              weekMap.set(weekIndex, {
                fecha_inicio: fechaStr,
                fecha_fin: fechaStr,
                llamadas,
                agendas,
              });
            }
          });

          const weeklyResult = Array.from(weekMap.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([_, value]) => {
              const formatShort = (iso: string) => {
                const d = new Date(iso);
                if (isNaN(d.getTime())) return iso;
                return d.toLocaleDateString("es-ES", {
                  day: "2-digit",
                  month: "2-digit",
                });
              };

              const label = `${formatShort(value.fecha_inicio)} al ${formatShort(value.fecha_fin)}`;

              return {
                label,
                fecha_inicio: value.fecha_inicio,
                fecha_fin: value.fecha_fin,
                llamadas: value.llamadas,
                agendas: value.agendas,
              };
            });

          return weeklyResult;
        }
      }
    }

    return result;
  }, [
    timePeriod,
    effectiveCallsData,
    hourlyAgendasData,
    dailyCallsData,
    dashboardData,
  ]);

  // Determinar si estamos en un rango "largo" (agrupado por semanas o todos los datos)
  const isLongRange = useMemo(() => {
    // Si estamos mostrando todos los datos, siempre considerar rango largo
    if (timePeriod === "all") return true;

    // Si los datos combinados tienen campos de rango semanal, también es rango largo
    if (combinedCallsAgendasData && combinedCallsAgendasData.length > 0) {
      const hasWeeklyRange = combinedCallsAgendasData.some(
        (item: any) => item.fecha_inicio && item.fecha_fin,
      );
      if (hasWeeklyRange) return true;
    }

    return false;
  }, [timePeriod, combinedCallsAgendasData]);

  // Métricas calculadas con datos filtrados
  const filteredMetrics = useMemo(() => {
    if (!filteredDailyData || filteredDailyData.length === 0) {
      return {
        totalLlamadas:
          dashboardData?.dashboard_data?.metricas_generales?.total_llamadas ||
          0,
        costoTotal: dashboardData?.dashboard_data?.llamadas_por_dia
          ? dashboardData.dashboard_data.llamadas_por_dia.reduce(
              (sum: number, item: any) => sum + (item.costo_dia || 0),
              0,
            )
          : 0,
      };
    }

    const totalLlamadas = filteredDailyData.reduce(
      (sum: number, item: any) => sum + (item.total_llamadas || 0),
      0,
    );
    const costoTotal = filteredDailyData.reduce(
      (sum: number, item: any) => sum + (item.costo_dia || 0),
      0,
    );

    return { totalLlamadas, costoTotal };
  }, [filteredDailyData, dashboardData]);

  // Eliminar la Card y el contenido del gráfico de llamadas por día

  // Procesar los datos para el gráfico apilado (efectivas/fallidas) optimizado
  const stackedDailyChartData = React.useMemo(() => {
    // Filtrar días sin llamadas
    const filtered = filteredDailyData.filter((item: any) => {
      const anyItem = item as any;
      const total =
        (typeof anyItem.llamadas_efectivas === "number"
          ? anyItem.llamadas_efectivas
          : 0) +
        (typeof anyItem.llamadas_fallidas === "number"
          ? anyItem.llamadas_fallidas
          : 0);
      return total > 0;
    });
    // Limitar a los últimos 30 días si hay muchos datos
    const limited = filtered.length > 30 ? filtered.slice(-30) : filtered;
    return limited.map((item: any) => {
      const anyItem = item as any;
      return {
        label: item.label,
        efectivas:
          typeof anyItem.llamadas_efectivas === "number"
            ? anyItem.llamadas_efectivas
            : 0,
        fallidas:
          typeof anyItem.llamadas_fallidas === "number"
            ? anyItem.llamadas_fallidas
            : 0,
        fecha: item.fecha,
        costo: typeof anyItem.costo_dia === "number" ? anyItem.costo_dia : 0,
      };
    });
  }, [filteredDailyData]);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-indigo-800 mb-2">
          Dashboard
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-slate-600">Análisis de llamadas con uMindsAI</p>
          {dashboardData && showStatusBadge && (
            <div
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border transition-opacity duration-300 ease-out ${
                statusBadgeFading ? "opacity-0" : "opacity-100"
              } ${
                loading
                  ? "bg-blue-50 text-blue-700 border-blue-200"
                  : "bg-green-100 text-green-800 border-green-200"
              }`}
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin w-3 h-3 mr-2"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Actualizando métricas...
                </>
              ) : (
                <>
                  <svg
                    className="w-3 h-3 mr-1"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Datos actualizados del servidor
                </>
              )}
            </div>
          )}
          {dashboardData && !loading && !showStatusBadge && (
            <span
              className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 border border-green-200 text-green-800"
              title="Datos actualizados del servidor"
            >
              <svg
                className="w-3 h-3"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
          )}
        </div>
      </div>

      {/* Filtros de período */}
      {dashboardData && (
        <div className="mb-6 flex flex-wrap gap-4 items-center p-4 bg-slate-100 rounded-lg border border-slate-200">
          <div className="flex items-center gap-2">
            <label
              htmlFor="timePeriod"
              className="text-sm font-medium text-slate-700"
            >
              Período:
            </label>
            <Select value={selectValue} onValueChange={handleTimePeriodChange}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Seleccionar período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los datos</SelectItem>
                <SelectItem value="today">Hoy</SelectItem>
                <SelectItem value="week">Últimos 7 días</SelectItem>
                <SelectItem value="month">Mes actual</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {hasFiltroSolar && (
            <div className="flex items-center gap-2">
              <label
                htmlFor="databaseFilter"
                className="text-sm font-medium text-slate-700"
              >
                Base de datos:
              </label>
              <input
                type="text"
                id="databaseFilter"
                value={databaseFilter}
                onChange={(e) => setDatabaseFilter(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    applyDatabaseFilter();
                  }
                }}
                placeholder="Nombre de la base de datos"
                className="px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
              />
              <Button
                onClick={applyDatabaseFilter}
                className="text-sm bg-blue-600 hover:bg-blue-700 text-white"
                disabled={!databaseFilter.trim()}
              >
                Filtrar
              </Button>
              {appliedDatabaseFilter && (
                <Button
                  onClick={clearDatabaseFilter}
                  variant="outline"
                  className="text-sm"
                >
                  Limpiar
                </Button>
              )}
            </div>
          )}

          {showClienteFilter && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">
                Cliente:
              </label>
              <Select
                value={clienteFilter || "__todos__"}
                onValueChange={(val) => setClienteFilter(val === "__todos__" ? "" : val)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Todos los clientes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__todos__">Todos los clientes</SelectItem>
                  {availableClientes.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={applyClienteFilter}
                className="text-sm bg-blue-600 hover:bg-blue-700 text-white"
                disabled={clienteFilter === appliedClienteFilter}
              >
                Filtrar
              </Button>
              {appliedClienteFilter && (
                <Button
                  onClick={clearClienteFilter}
                  variant="outline"
                  className="text-sm"
                >
                  Limpiar
                </Button>
              )}
            </div>
          )}

          {timePeriod === "custom" && customStartDate && customEndDate && (
            <Button
              onClick={() => {
                setTempStartDate(customStartDate);
                setTempEndDate(customEndDate);
                setTempStartTime(customStartTime);
                setTempEndTime(customEndTime);
                setIsCustomDateDialogOpen(true);
              }}
              className="text-sm bg-blue-600 hover:bg-blue-700 text-white"
            >
              Seleccionar rango de fechas y horas
            </Button>
          )}

          <Button
            onClick={handleRefresh}
            disabled={loading}
            title="Actualizar datos"
            className="h-9 w-9 p-0 flex items-center justify-center bg-[#0a2a5a] border border-[#1e4a8a] hover:bg-[#1e4a8a] text-white transition-colors disabled:opacity-50"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </Button>

          {(appliedDatabaseFilter || appliedClienteFilter) && (
            <div className="text-xs text-slate-600">
              {appliedDatabaseFilter && `Base de datos: ${appliedDatabaseFilter}`}
              {appliedDatabaseFilter && appliedClienteFilter && " | "}
              {appliedClienteFilter && `Cliente: ${appliedClienteFilter}`}
            </div>
          )}
        </div>
      )}

      {/* Dialog para seleccionar fechas personalizadas */}
      <Dialog
        open={isCustomDateDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            // Si se cierra el dialog sin confirmar, cancelar
            handleCancelCustomDates();
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Seleccionar Rango de Fechas Personalizado</DialogTitle>
            <DialogDescription>
              Elige el rango de fechas para filtrar los datos del dashboard
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="dialogStartDate"
                  className="text-sm font-medium text-slate-700"
                >
                  Fecha de inicio:
                </label>
                <input
                  type="date"
                  id="dialogStartDate"
                  value={tempStartDate}
                  onChange={(e) => setTempStartDate(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="dialogStartTime"
                  className="text-sm font-medium text-slate-700"
                >
                  Hora de inicio:
                </label>
                <input
                  type="time"
                  id="dialogStartTime"
                  value={tempStartTime}
                  onChange={(e) => {
                    setTempStartTime(e.target.value || "00:00");
                  }}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="dialogEndDate"
                  className="text-sm font-medium text-slate-700"
                >
                  Fecha de fin:
                </label>
                <input
                  type="date"
                  id="dialogEndDate"
                  value={tempEndDate}
                  onChange={(e) => setTempEndDate(e.target.value)}
                  min={tempStartDate || undefined}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="dialogEndTime"
                  className="text-sm font-medium text-slate-700"
                >
                  Hora de fin:
                </label>
                <input
                  type="time"
                  id="dialogEndTime"
                  value={tempEndTime}
                  onChange={(e) => {
                    setTempEndTime(e.target.value || "23:59");
                  }}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            {tempStartDate && tempEndDate && tempStartDate > tempEndDate && (
              <div className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200">
                La fecha de inicio no puede ser posterior a la fecha de fin
              </div>
            )}
            {tempStartDate &&
              tempEndDate &&
              tempStartDate === tempEndDate &&
              (() => {
                const startTimeParts = tempStartTime.split(":");
                const endTimeParts = tempEndTime.split(":");
                const startMinutes =
                  parseInt(startTimeParts[0] || "0", 10) * 60 +
                  parseInt(startTimeParts[1] || "0", 10);
                const endMinutes =
                  parseInt(endTimeParts[0] || "23", 10) * 60 +
                  parseInt(endTimeParts[1] || "59", 10);
                return startMinutes >= endMinutes;
              })() && (
                <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                  La hora de inicio es mayor o igual que la de fin. Se
                  considerará hasta el final del día siguiente.
                </div>
              )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelCustomDates}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmCustomDates}
              disabled={
                !tempStartDate || !tempEndDate || tempStartDate > tempEndDate
              }
            >
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Solo mostramos el skeleton si está cargando Y no hay datos previos */}
      {loading && !dashboardData ? (
        <DashboardSkeleton />
      ) : error ? (
        <div className="p-8 bg-red-50 rounded-xl border border-red-200">
          <p className="text-red-700">{error}</p>
        </div>
      ) : !dashboardData ? (
        <div className="p-8 bg-yellow-50 rounded-xl border border-yellow-200">
          <p className="text-yellow-700 text-lg mb-4">
            ⚠️ No se han cargado los datos del dashboard desde el servidor.
          </p>
          {loadDashboardData && (
            <Button
              onClick={() => {
                const bddFilter = appliedDatabaseFilter || undefined;
                loadDashboardData &&
                  loadDashboardData(
                    undefined,
                    undefined,
                    timePeriod,
                    bddFilter,
                  );
              }}
              variant="default"
            >
              Cargar datos del servidor
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Sección de estadísticas del servidor */}
          <div
            className={`grid gap-4 mb-4 ${
              agendaEnabled
                ? "md:grid-cols-2 lg:grid-cols-4"
                : "md:grid-cols-2 lg:grid-cols-4"
            }`}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-center gap-2 pb-2">
                <CardTitle className="text-sm font-medium text-center">
                  Llamadas Lanzadas
                </CardTitle>
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
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center text-center">
                <div className="text-xl font-bold text-center">
                  {dashboardData?.dashboard_data?.metricas_generales?.total_llamadas?.toLocaleString() ||
                    0}
                </div>
                <p className="text-xs text-slate-600 text-center">
                  Total registrado en el servidor
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-center gap-2 pb-2">
                <CardTitle className="text-sm font-medium text-center">
                  Costo Total
                </CardTitle>
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
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center text-center">
                <div className="text-xl font-bold text-center">
                  $
                  {dashboardData?.dashboard_data?.metricas_generales?.costo_total?.toFixed(
                    2,
                  ) || "0.00"}
                </div>
                <p className="text-xs text-slate-600 text-center">
                  Costo total de llamadas
                </p>
              </CardContent>
            </Card>
            <Card>
              {hasFit ? (
                <>
                  <CardHeader className="flex flex-row items-center gap-1 pb-2 px-1 pt-4">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-slate-500 hover:text-slate-900"
                      aria-label="Vista anterior"
                      onClick={() => setContestadasSlide((s) => (s === 0 ? 1 : 0))}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex flex-1 flex-col items-center justify-center gap-1 min-w-0 px-1">
                      <div className="flex flex-row items-center justify-center gap-2">
                        <CardTitle className="text-sm font-medium text-center leading-tight">
                          {contestadasSlide === 0 ? "Llamadas Contestadas" : "Mensajes WhatsApp"}
                        </CardTitle>
                        {contestadasSlide === 0 ? (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden>
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                            <polyline points="22,4 12,14.01 9,11.01" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="h-4 w-4 shrink-0 text-green-500" aria-hidden>
                            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                          </svg>
                        )}
                      </div>
                      <div className="flex flex-row gap-1.5" role="tablist">
                        <span className={`h-1.5 w-1.5 rounded-full transition-colors ${contestadasSlide === 0 ? "bg-emerald-500" : "bg-slate-200"}`} />
                        <span className={`h-1.5 w-1.5 rounded-full transition-colors ${contestadasSlide === 1 ? "bg-green-500" : "bg-slate-200"}`} />
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-slate-500 hover:text-slate-900"
                      aria-label="Vista siguiente"
                      onClick={() => setContestadasSlide((s) => (s === 1 ? 0 : 1))}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center justify-center text-center min-h-[5.25rem] pb-4 pt-0">
                    {contestadasSlide === 0 ? (
                      <>
                        <div className="text-2xl font-bold text-center text-emerald-600">
                          {(() => {
                            const total = dashboardData?.dashboard_data?.metricas_generales?.total_llamadas || 0;
                            const efectivas = dashboardData?.dashboard_data?.metricas_generales?.llamadas_efectivas || 0;
                            if (total > 0) return `${((efectivas / total) * 100).toFixed(2)}%`;
                            return '0%';
                          })()}
                        </div>
                        <div className="text-xs text-slate-500 text-center mt-0.5">
                          {dashboardData?.dashboard_data?.metricas_generales?.llamadas_efectivas?.toLocaleString() || 0} llamadas contestadas
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-2xl font-bold text-center text-green-600">
                          {whatsappMsgLoading ? (
                            <span className="inline-block h-6 w-16 rounded bg-slate-100 animate-pulse" />
                          ) : (
                            whatsappMsgCount.toLocaleString()
                          )}
                        </div>
                        <div className="text-xs text-slate-500 text-center mt-0.5">mensajes enviados</div>
                      </>
                    )}
                  </CardContent>
                </>
              ) : (
                <>
                  <CardHeader className="flex flex-row items-center justify-center gap-2 pb-2">
                    <CardTitle className="text-sm font-medium text-center">
                      Llamadas Contestadas
                    </CardTitle>
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
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22,4 12,14.01 9,11.01" />
                    </svg>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center justify-center text-center">
                    <div className="text-xl font-bold text-center">
                      {(() => {
                        const total =
                          dashboardData?.dashboard_data?.metricas_generales
                            ?.total_llamadas || 0;
                        const efectivas =
                          dashboardData?.dashboard_data?.metricas_generales
                            ?.llamadas_efectivas || 0;
                        if (total > 0) {
                          return (
                            <span className="font-bold">
                              {((efectivas / total) * 100).toFixed(2)}%
                            </span>
                          );
                        }
                        return <span className="font-bold">0%</span>;
                      })()}
                    </div>
                    <div className="text-xs text-slate-600 text-center">
                      {dashboardData?.dashboard_data?.metricas_generales?.llamadas_efectivas?.toLocaleString() ||
                        0}{" "}
                      llamadas contestadas
                    </div>
                  </CardContent>
                </>
              )}
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-center gap-2 pb-2">
                <CardTitle className="text-sm font-medium text-center">
                  Llamadas Fallidas
                </CardTitle>
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
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center text-center">
                <div className="text-xl font-bold text-center">
                  {(() => {
                    const total =
                      dashboardData?.dashboard_data?.metricas_generales
                        ?.total_llamadas || 0;
                    const fallidas =
                      dashboardData?.dashboard_data?.metricas_generales
                        ?.llamadas_fallidas || 0;
                    if (total > 0) {
                      return (
                        <span className="font-bold">
                          {((fallidas / total) * 100).toFixed(2)}%
                        </span>
                      );
                    }
                    return <span className="font-bold">0%</span>;
                  })()}
                </div>
                <div className="text-xs text-slate-600 text-center">
                  {dashboardData?.dashboard_data?.metricas_generales?.llamadas_fallidas?.toLocaleString() ||
                    0}{" "}
                  llamadas fallidas
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="grid gap-4 mb-8 md:grid-cols-2 lg:grid-cols-4">
            {agendaEnabled && (
              <Card>
                {hasFit ? (
                  <>
                    <CardHeader className="flex flex-row items-center gap-1 pb-2 px-1 pt-4">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-slate-500 hover:text-slate-900"
                        aria-label="Canal anterior"
                        onClick={() => setAgendamientosCardSlide((s) => (s === 0 ? 1 : 0))}
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </Button>
                      <div className="flex flex-1 flex-col items-center justify-center gap-1 min-w-0 px-1">
                        <div className="flex flex-row items-center justify-center gap-2">
                          <CardTitle className="text-sm font-medium text-center leading-tight">
                            {agendamientosCardSlide === 0 ? "Agendas WhatsApp" : "Agendas Llamada"}
                          </CardTitle>
                          {agendamientosCardSlide === 0 ? (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="h-4 w-4 shrink-0 text-green-500" aria-hidden>
                              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="h-4 w-4 shrink-0 text-blue-400" aria-hidden>
                              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.63 3.18 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.5a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                            </svg>
                          )}
                        </div>
                        <div className="flex flex-row gap-1.5" role="tablist">
                          <span className={`h-1.5 w-1.5 rounded-full transition-colors ${agendamientosCardSlide === 0 ? "bg-green-500" : "bg-slate-200"}`} />
                          <span className={`h-1.5 w-1.5 rounded-full transition-colors ${agendamientosCardSlide === 1 ? "bg-blue-500" : "bg-slate-200"}`} />
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-slate-500 hover:text-slate-900"
                        aria-label="Siguiente canal"
                        onClick={() => setAgendamientosCardSlide((s) => (s === 1 ? 0 : 1))}
                      >
                        <ChevronRight className="h-5 w-5" />
                      </Button>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center text-center min-h-[5.25rem] pb-4 pt-0">
                      {(() => {
                        const total = dashboardData?.dashboard_data?.metricas_generales?.total_agendamientos || 0;
                        const whatsapp = dashboardData?.dashboard_data?.metricas_generales?.total_agendamientos_whatsapp || 0;
                        const llamada = dashboardData?.dashboard_data?.metricas_generales?.total_agendamientos_llamada || 0;
                        const count = agendamientosCardSlide === 0 ? whatsapp : llamada;
                        const color = agendamientosCardSlide === 0 ? "text-green-600" : "text-blue-600";
                        const label = agendamientosCardSlide === 0 ? "agendas WhatsApp" : "agendas Llamada";
                        return (
                          <>
                            <div className={`text-2xl font-bold text-center ${color}`}>{count.toLocaleString()}</div>
                            <div className="text-xs text-slate-500 text-center mt-0.5">{label}</div>
                            <div className="text-xs text-slate-400 text-center mt-2 border-t border-slate-100 pt-2 w-full">
                              Total: <span className="font-semibold text-slate-600">{total.toLocaleString()}</span> agendas
                            </div>
                          </>
                        );
                      })()}
                    </CardContent>
                  </>
                ) : (
                  <>
                    <CardHeader className="flex flex-row items-center justify-center gap-2 pb-2">
                      <CardTitle className="text-sm font-medium text-center">
                        {hasFiltroSolar ? "Paneles Solares" : "Total Agendamientos"}
                      </CardTitle>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" className="h-4 w-4 text-blue-400">
                        <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                        <line x1="16" x2="16" y1="2" y2="6" />
                        <line x1="8" x2="8" y1="2" y2="6" />
                        <line x1="3" x2="21" y1="10" y2="10" />
                      </svg>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center text-center">
                      <div className="text-xl font-bold text-center">
                        {(() => {
                          const efectivas = dashboardData?.dashboard_data?.metricas_generales?.llamadas_efectivas || 0;
                          const agendas = hasFiltroSolar
                            ? dashboardData?.dashboard_data?.metricas_generales?.total_agendamientos_paneles || 0
                            : dashboardData?.dashboard_data?.metricas_generales?.total_agendamientos || 0;
                          if (efectivas > 0) {
                            return <span className="font-bold">{((agendas / efectivas) * 100).toFixed(2)}%</span>;
                          }
                          return <span className="font-bold">0%</span>;
                        })()}
                      </div>
                      <div className="text-xs text-slate-600 text-center">
                        {hasFiltroSolar
                          ? (dashboardData?.dashboard_data?.metricas_generales?.total_agendamientos_paneles?.toLocaleString() || 0)
                          : (dashboardData?.dashboard_data?.metricas_generales?.total_agendamientos?.toLocaleString() || 0)}{" "}
                        {hasFiltroSolar ? "paneles solares" : "agendamientos"}
                      </div>
                    </CardContent>
                  </>
                )}
              </Card>
            )}
            {agendaEnabled && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-center gap-2 pb-2">
                  <CardTitle className="text-sm font-medium text-center">
                    Costo por Agenda
                  </CardTitle>
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
                    <line x1="12" x2="12" y1="2" y2="22" />
                    <path d="M17 5H7L12 2l5 3z" />
                    <path d="M17 19H7L12 22l5-3z" />
                    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                  </svg>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center text-center">
                  <div className="text-xl font-bold text-center">
                    {(() => {
                      const costo =
                        dashboardData?.dashboard_data?.metricas_generales
                          ?.costo_total || 0;
                      const agendas = hasFiltroSolar
                        ? dashboardData?.dashboard_data?.metricas_generales?.total_agendamientos_paneles || 0
                        : dashboardData?.dashboard_data?.metricas_generales?.total_agendamientos || 0;
                      if (agendas > 0) {
                        return (
                          <span className="font-bold">
                            ${(costo / agendas).toFixed(2)}
                          </span>
                        );
                      }
                      return <span className="font-bold">$0.00</span>;
                    })()}
                  </div>
                  <div className="text-xs text-slate-600 text-center">
                    {hasFiltroSolar
                      ? (dashboardData?.dashboard_data?.metricas_generales?.total_agendamientos_paneles?.toLocaleString() || 0)
                      : (dashboardData?.dashboard_data?.metricas_generales?.total_agendamientos?.toLocaleString() || 0)}{" "}
                    {hasFiltroSolar ? "paneles solares" : "agendamientos"}
                  </div>
                </CardContent>
              </Card>
            )}
            {agendaEnabled && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-center gap-2 pb-2">
                  <CardTitle className="text-sm font-medium text-center">
                    Promedio de Agenda
                  </CardTitle>
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
                    <path d="M9 12l2 2 4-4" />
                    <path d="M21 12c.552 0 1-.448 1-1V5c0-.552-.448-1-1-1H3c-.552 0-1 .448-1 1v6c0 .552.448 1 1 1h18z" />
                    <path d="M3 12h18" />
                  </svg>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center text-center">
                  <div className="text-xl font-bold text-center">
                    {(() => {
                      const efectivas =
                        dashboardData?.dashboard_data?.metricas_generales
                          ?.llamadas_efectivas || 0;
                      const agendas = hasFiltroSolar
                        ? dashboardData?.dashboard_data?.metricas_generales?.total_agendamientos_paneles || 0
                        : dashboardData?.dashboard_data?.metricas_generales?.total_agendamientos || 0;
                      if (agendas > 0) {
                        const promedio = efectivas / agendas;
                        return (
                          <span className="font-bold">
                            {promedio.toFixed(1)}
                          </span>
                        );
                      }
                      return <span className="font-bold">0.0</span>;
                    })()}
                  </div>
                  <div className="text-xs text-slate-600 text-center">
                    llamadas por {hasFiltroSolar ? "panel solar" : "agenda"}
                  </div>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader className="flex flex-row items-center gap-1 pb-2 px-1 pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-slate-500 hover:text-slate-900"
                  aria-label="Métrica anterior"
                  onClick={() =>
                    setDuracionCardSlide((s) => (s === 0 ? 1 : 0))
                  }
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <div className="flex flex-1 flex-col items-center justify-center gap-1 min-w-0 px-1">
                  <div className="flex flex-row items-center justify-center gap-2">
                    <CardTitle className="text-sm font-medium text-center leading-tight">
                      {duracionCardSlide === 0
                        ? "Duración media (efectivas)"
                        : "Duración total de llamadas"}
                    </CardTitle>
                    {duracionCardSlide === 0 ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        className="h-4 w-4 shrink-0 text-teal-400"
                        aria-hidden
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v6l4 2" />
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        className="h-4 w-4 shrink-0 text-slate-400"
                        aria-hidden
                      >
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                    )}
                  </div>
                  <div
                    className="flex flex-row gap-1.5"
                    role="tablist"
                    aria-label="Indicador de métrica de duración"
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full transition-colors ${duracionCardSlide === 0 ? "bg-teal-500" : "bg-slate-200"}`}
                      aria-current={
                        duracionCardSlide === 0 ? "true" : undefined
                      }
                    />
                    <span
                      className={`h-1.5 w-1.5 rounded-full transition-colors ${duracionCardSlide === 1 ? "bg-slate-500" : "bg-slate-200"}`}
                      aria-current={
                        duracionCardSlide === 1 ? "true" : undefined
                      }
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-slate-500 hover:text-slate-900"
                  aria-label="Siguiente métrica"
                  onClick={() =>
                    setDuracionCardSlide((s) => (s === 1 ? 0 : 1))
                  }
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center text-center min-h-[5.25rem] pb-4 pt-0">
                {duracionCardSlide === 0 ? (
                  <>
                    <div className="text-xl font-bold text-center">
                      {(() => {
                        const totalSeg =
                          dashboardData?.dashboard_data?.metricas_generales
                            ?.total_duration_seconds ?? 0;
                        const efectivas =
                          dashboardData?.dashboard_data?.metricas_generales
                            ?.efectivas_con_duracion ?? 0;
                        const seg = efectivas > 0 ? totalSeg / efectivas : 0;
                        return (
                          <span className="font-bold">
                            {Number(seg).toLocaleString("es-ES", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{" "}
                            seg
                          </span>
                        );
                      })()}
                    </div>
                    <div className="text-xs text-slate-600 text-center mt-1">
                      Promedio solo entre llamadas efectivas con duración válida
                      {(() => {
                        const n =
                          dashboardData?.dashboard_data?.metricas_generales
                            ?.efectivas_con_duracion ?? 0;
                        return n > 0
                          ? ` (${n.toLocaleString()} llamadas)`
                          : "";
                      })()}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-xl font-bold text-center">
                      {(() => {
                        const minutes =
                          dashboardData?.dashboard_data?.metricas_generales
                            ?.total_duration_minutes || 0;
                        return (
                          <span className="font-bold">
                            {minutes.toLocaleString()} min
                          </span>
                        );
                      })()}
                    </div>
                    <div className="text-xs text-slate-600 text-center mt-1">
                      Suma de duración de llamadas (en minutos)
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Métricas de lanzamiento por región (si el cliente tiene launch habilitado) */}
          {launchEnabled && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-800">
                  Tasa de Contestación por Región
                </CardTitle>
                <CardDescription className="text-slate-500">
                  Comparación de rendimiento de las campañas de lanzamiento por
                  región
                </CardDescription>
              </CardHeader>
              <CardContent>
                {launchRegionLoading ? (
                  <div className="py-4 text-sm text-slate-500">
                    Cargando métricas de lanzamiento por región...
                  </div>
                ) : launchRegionError ? (
                  <div className="py-4 text-sm text-red-600">
                    {launchRegionError}
                  </div>
                ) : launchRegionMetrics ? (
                  <div className="grid gap-4 md:grid-cols-3">
                    {(["europa", "latam", "espana"] as const).map((key) => {
                      const data = launchRegionMetrics[key];
                      const label =
                        key === "europa"
                          ? "Europa"
                          : key === "latam"
                            ? "Latam"
                            : "España";
                      const tasa = calculateLaunchPercentage(
                        data.llamadas_contestadas,
                        data.total_llamadas,
                      );
                      return (
                        <div
                          key={key}
                          className="bg-slate-50 rounded-lg border border-slate-200 p-4 flex flex-col items-center text-center"
                        >
                          <div className="text-sm font-medium text-slate-700 mb-1">
                            {label}
                          </div>
                          <div className="text-2xl font-bold text-blue-700 mb-1">
                            {tasa}%
                          </div>
                          <div className="text-xs text-slate-500">
                            {data.llamadas_contestadas.toLocaleString()}{" "}
                            contestadas de{" "}
                            {data.total_llamadas.toLocaleString()} llamadas
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-4 text-sm text-slate-500">
                    No hay métricas de lanzamiento por región disponibles para
                    este período.
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Gráfico de llamadas por día */}
          {/* Eliminar la Card y el contenido del gráfico de llamadas por día */}

          {/* Gráficos de distribución */}
          {/* Gráfico de agendas por canal — solo clientes FIT — ancho completo */}
          {hasFit && agendaEnabled && hourlyAgendasByChannelData.length > 0 && (
            <Card className="mb-8 shadow-lg border border-slate-200">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-800">
                  Agendas por Canal
                </CardTitle>
                <CardDescription className="text-slate-500">
                  Distribución de agendamientos por hora y canal de origen
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 md:p-6">
                <div className="h-[300px] bg-white rounded-xl p-4 md:p-6">
                  <RechartsResponsiveContainer width="100%" height={300}>
                    <RechartsComposedChart data={hourlyAgendasByChannelData}>
                      <RechartsCartesianGrid strokeDasharray="3 3" vertical={false} />
                      <RechartsXAxis dataKey="label" stroke="#888888" fontSize={12} />
                      <RechartsYAxis stroke="#888888" fontSize={12} allowDecimals={false} />
                      <RechartsTooltip
                        contentStyle={{ background: "white", border: "1px solid #e5e7eb", color: "#111827", fontSize: 13 }}
                      />
                      <RechartsLegend />
                      <RechartsLine type="monotone" dataKey="WhatsApp" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                      <RechartsLine type="monotone" dataKey="Llamada" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                    </RechartsComposedChart>
                  </RechartsResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          <div
            className={`grid gap-4 mb-8 ${
              agendaEnabled || showClienteFilter ? "md:grid-cols-2" : "md:grid-cols-1"
            }`}
          >
            {/* Gráfico de agendamientos por hora */}
            {agendaEnabled &&
              hourlyAgendasData &&
              hourlyAgendasData.length > 0 && (
                <Card className="mb-8 shadow-lg border border-slate-200">
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <CardTitle className="text-base font-semibold text-slate-800">
                          Agendamientos por Hora
                        </CardTitle>
                        <CardDescription className="text-slate-500">
                          Distribución de agendamientos por hora del día
                        </CardDescription>
                      </div>

                      {/* Filtro de rango de horas */}
                      <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex items-center gap-2">
                          <label
                            htmlFor="hourStart"
                            className="text-xs font-medium text-slate-700"
                          >
                            Desde:
                          </label>
                          <Select
                            value={hourRangeStart}
                            onValueChange={(value) =>
                              handleHourRangeChange("start", value)
                            }
                          >
                            <SelectTrigger className="w-20 h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 24 }, (_, i) => (
                                <SelectItem key={i} value={i.toString()}>
                                  {i.toString().padStart(2, "0")}:00
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center gap-2">
                          <label
                            htmlFor="hourEnd"
                            className="text-xs font-medium text-slate-700"
                          >
                            Hasta:
                          </label>
                          <Select
                            value={hourRangeEnd}
                            onValueChange={(value) =>
                              handleHourRangeChange("end", value)
                            }
                          >
                            <SelectTrigger className="w-20 h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 24 }, (_, i) => (
                                <SelectItem key={i} value={i.toString()}>
                                  {i.toString().padStart(2, "0")}:00
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="text-xs text-slate-600">
                          {hourRangeStart === "8" && hourRangeEnd === "23"
                            ? "Horario laboral (8:00 - 23:00)"
                            : `${hourRangeStart.padStart(2, "0")}:00 - ${hourRangeEnd.padStart(2, "0")}:00`}
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
                  <CardTitle className="text-base font-semibold text-slate-800">
                    Tipos de Vivienda
                  </CardTitle>
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
                      colors={[
                        "#f59e0b",
                        "#10b981",
                        "#3b82f6",
                        "#8b5cf6",
                        "#ef4444",
                      ]}
                      showLegend={true}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Gráfico de interés */}
            {interestData && interestData.length > 0 && (
              <Card className="mb-8 shadow-lg border border-slate-200">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-slate-800">
                    Interés
                  </CardTitle>
                  <CardDescription className="text-slate-500">
                    Distribución de interés de los clientes
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0 md:p-6">
                  <div className="h-[300px] bg-white rounded-xl p-4 md:p-6">
                    <Chart
                      data={interestData}
                      type="pie"
                      xKey="label"
                      yKey="cantidad"
                      height={300}
                      colors={[
                        "#3b82f6",
                        "#10b981",
                        "#f59e0b",
                        "#8b5cf6",
                        "#ef4444",
                      ]}
                      showLegend={true}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Gráfico de pastel: Distribución de Identidad (solo recoveries) */}
            {showClienteFilter && (() => {
              const identidadData: { identidad: string; cantidad: number }[] =
                dashboardData?.dashboard_data?.identidad || [];
              const total = identidadData.reduce((sum, item) => sum + (item.cantidad || 0), 0);
              const pieData = identidadData.map((item, i) => ({
                name: item.identidad,
                value: item.cantidad,
                color: IDENTIDAD_COLORS[i % IDENTIDAD_COLORS.length],
              }));
              return (
                <Card className="mb-8 shadow-lg border border-slate-200">
                  <CardHeader>
                    <CardTitle className="text-base font-semibold text-slate-800">
                      Distribución de Identidad
                    </CardTitle>
                    <CardDescription className="text-slate-500">
                      Distribución de identidad de los clientes
                      {total > 0 && <> · <span className="font-semibold">{total.toLocaleString()} registros</span></>}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 md:p-6">
                    {identidadData.length === 0 ? (
                      <div className="h-[300px] flex items-center justify-center">
                        <p className="text-slate-500 text-sm text-center px-4">
                          No hay datos de identidad para este período.
                        </p>
                      </div>
                    ) : (
                      <div className="h-[300px] bg-white rounded-xl p-4 md:p-6">
                        <SimplePieChart
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })()}

            {/* Gráfico de agentes por agendas */}
            {agendaEnabled &&
              agentesPorAgendasData &&
              agentesPorAgendasData.length > 0 && (
                <Card className="mb-8 shadow-lg border border-slate-200">
                  <CardHeader>
                    <CardTitle className="text-base font-semibold text-slate-800">
                      Agentes por Agendas
                    </CardTitle>
                    <CardDescription className="text-slate-500">
                      Distribución de agendas por agente
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 md:p-6">
                    <div className="h-[300px] bg-white rounded-xl p-4 md:p-6">
                      <Chart
                        data={agentesPorAgendasData}
                        type="bar"
                        xKey="label"
                        yKey="cantidad"
                        height={300}
                        colors={[
                          "#3b82f6",
                          "#10b981",
                          "#f59e0b",
                          "#8b5cf6",
                          "#ef4444",
                          "#ec4899",
                          "#14b8a6",
                          "#f97316",
                        ]}
                        showLegend={false}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}
          </div>

          {/* Gráficos adicionales */}
          <div
            className={`grid gap-4 mb-8 ${
              agendaEnabled ? "md:grid-cols-2" : "md:grid-cols-1"
            }`}
          >
            {/* Gráfico de llamadas efectivas por hora */}
            {effectiveCallsData && effectiveCallsData.length > 0 && (
              <Card className="mb-8 shadow-lg border border-slate-200">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <CardTitle className="text-base font-semibold text-slate-800">
                        Llamadas Efectivas por Hora
                      </CardTitle>
                      <CardDescription className="text-slate-500">
                        Distribución de llamadas efectivas a lo largo del día
                      </CardDescription>
                    </div>

                    {/* Filtro de rango de horas */}
                    <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor="effectiveCallsHourStart"
                          className="text-xs font-medium text-slate-700"
                        >
                          Desde:
                        </label>
                        <Select
                          value={effectiveCallsHourStart}
                          onValueChange={(value) =>
                            handleEffectiveCallsHourRangeChange("start", value)
                          }
                        >
                          <SelectTrigger className="w-20 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 24 }, (_, i) => (
                              <SelectItem key={i} value={i.toString()}>
                                {i.toString().padStart(2, "0")}:00
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center gap-2">
                        <label
                          htmlFor="effectiveCallsHourEnd"
                          className="text-xs font-medium text-slate-700"
                        >
                          Hasta:
                        </label>
                        <Select
                          value={effectiveCallsHourEnd}
                          onValueChange={(value) =>
                            handleEffectiveCallsHourRangeChange("end", value)
                          }
                        >
                          <SelectTrigger className="w-20 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 24 }, (_, i) => (
                              <SelectItem key={i} value={i.toString()}>
                                {i.toString().padStart(2, "0")}:00
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="text-xs text-slate-600">
                        {effectiveCallsHourStart === "0" &&
                        effectiveCallsHourEnd === "23"
                          ? "Todas las horas"
                          : `${effectiveCallsHourStart.padStart(2, "0")}:00 - ${effectiveCallsHourEnd.padStart(2, "0")}:00`}
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

            {/* Gráfico de clicks de asistencia por hora (si el cliente tiene launch habilitado) */}
            {launchEnabled &&
              asistenciaByHour &&
              asistenciaByHour.length > 0 && (
                <Card className="mb-8 shadow-lg border border-slate-200">
                  <CardHeader>
                    <CardTitle className="text-base font-semibold text-slate-800">
                      Clicks de Asistencia por Hora
                    </CardTitle>
                    <CardDescription className="text-slate-500">
                      Hora del día en la que las personas hacen click - Total:{" "}
                      <span className="font-bold">
                        {asistenciaByHour
                          .reduce((sum, item) => sum + (item.clicks || 0), 0)
                          .toLocaleString()}
                      </span>{" "}
                      clicks
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 md:p-6">
                    {asistenciaLoading ? (
                      <div className="py-4 text-sm text-slate-500">
                        Cargando métricas de asistencia por hora...
                      </div>
                    ) : asistenciaError ? (
                      <div className="py-4 text-sm text-red-600">
                        {asistenciaError}
                      </div>
                    ) : (
                      <div className="h-[300px] bg-white rounded-xl p-4 md:p-6">
                        <Chart
                          data={asistenciaByHour}
                          type="line"
                          xKey="label"
                          yKey="clicks"
                          height={300}
                          colors={["#16a34a"]}
                          showLegend={false}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

            {/* Gráfico de razones de desconexión */}
            {disconnectionData && disconnectionData.length > 0 && (
              <Card className="mb-8 shadow-lg border border-slate-200">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-slate-800">
                    Principales Razones de Desconexión
                  </CardTitle>
                  <CardDescription className="text-slate-500">
                    Top {Math.min(5, disconnectionData.length)} razones con
                    porcentajes
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
                      colors={[
                        "#8b5cf6",
                        "#d946ef",
                        "#a855f7",
                        "#6366f1",
                        "#3b82f6",
                      ]}
                      showLegend={true}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Bloque: Llamadas contestadas / Agendas + Agendas por tipo de propiedad */}
          {(combinedCallsAgendasData && combinedCallsAgendasData.length > 0) ||
          (hasAgendasInPeriod &&
            agendaPropertyTypeData &&
            agendaPropertyTypeData.length > 0) ? (
            <div
              className={`grid gap-4 mb-8 ${
                isLongRange
                  ? "md:grid-cols-1"
                  : hasAgendasInPeriod &&
                      agendaPropertyTypeData &&
                      agendaPropertyTypeData.length > 0
                    ? "md:grid-cols-2"
                    : "md:grid-cols-1"
              }`}
            >
              {combinedCallsAgendasData &&
                combinedCallsAgendasData.length > 0 && (
                  <Card className="shadow-lg border border-slate-200">
                    <CardHeader>
                      <CardTitle className="text-base font-semibold text-slate-800">
                        Llamadas contestadas / Agendas
                      </CardTitle>
                      <CardDescription className="text-slate-500">
                        Llamadas contestadas (barras azules) y agendas creadas
                        (línea roja){" "}
                        {timePeriod === "today"
                          ? "por hora"
                          : "en el período seleccionado"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 md:p-6">
                      <div className="h-[320px] bg-white rounded-xl p-4 md:p-6">
                        <RechartsResponsiveContainer width="100%" height="100%">
                          <RechartsComposedChart
                            data={combinedCallsAgendasData}
                          >
                            <RechartsCartesianGrid
                              strokeDasharray="3 3"
                              vertical={false}
                            />
                            <RechartsXAxis
                              dataKey="label"
                              stroke="#888888"
                              fontSize={12}
                            />
                            <RechartsYAxis
                              yAxisId="left"
                              stroke="#1d4ed8"
                              fontSize={12}
                              tickFormatter={(v) => v.toLocaleString("es-ES")}
                            />
                            <RechartsYAxis
                              yAxisId="right"
                              orientation="right"
                              stroke="#dc2626"
                              fontSize={12}
                              tickFormatter={(v) => v.toLocaleString("es-ES")}
                            />
                            <RechartsTooltip
                              contentStyle={{
                                background: "white",
                                border: "1px solid #e5e7eb",
                                color: "#111827",
                                fontSize: 13,
                              }}
                              formatter={(
                                value: any,
                                _name: string,
                                props: any,
                              ) => {
                                const dataKey = props?.dataKey;
                                const label =
                                  dataKey === "llamadas"
                                    ? "Llamadas"
                                    : dataKey === "agendas"
                                      ? "Agendas"
                                      : _name;

                                if (typeof value === "number") {
                                  return [value.toLocaleString("es-ES"), label];
                                }
                                return [value, label];
                              }}
                            />
                            <RechartsLegend />
                            <RechartsBar
                              yAxisId="left"
                              dataKey="llamadas"
                              name="Llamadas"
                              fill="#3b82f6"
                              radius={[4, 4, 0, 0]}
                            />
                            <RechartsLine
                              yAxisId="right"
                              type="monotone"
                              dataKey="agendas"
                              name="Agendas"
                              stroke="#dc2626"
                              strokeWidth={2}
                              dot={{ r: 3 }}
                              activeDot={{ r: 5 }}
                            />
                          </RechartsComposedChart>
                        </RechartsResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}

              {agendaEnabled &&
                hasAgendasInPeriod &&
                agendaPropertyTypeData &&
                agendaPropertyTypeData.length > 0 && (
                  <Card className="shadow-lg border border-slate-200">
                    <CardHeader>
                      <CardTitle className="text-base font-semibold text-slate-800">
                        Agendas por tipo de propiedad
                      </CardTitle>
                      <CardDescription className="text-slate-500">
                        Distribución porcentual de agendas según tipo de
                        vivienda
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 md:p-6">
                      <div className="h-[320px] bg-white rounded-xl p-4 md:p-6">
                        <RechartsResponsiveContainer width="100%" height="100%">
                          <RechartsPieChart>
                            <RechartsTooltip
                              contentStyle={{
                                background: "white",
                                border: "1px solid #e5e7eb",
                                color: "#111827",
                                fontSize: 13,
                              }}
                              formatter={(
                                value: any,
                                _name: string,
                                props: any,
                              ) => {
                                const label = props?.payload?.label ?? _name;
                                if (typeof value === "number") {
                                  const pct = `${value.toFixed(2)}%`;
                                  return [pct, label];
                                }
                                return [value, label];
                              }}
                            />
                            <RechartsLegend
                              verticalAlign="bottom"
                              height={
                                agendaPropertyTypeData.length > 3 ? 80 : 36
                              }
                              wrapperStyle={{ fontSize: "12px" }}
                              formatter={(value, entry: any) => {
                                const pct = entry?.payload?.porcentaje;
                                if (pct != null && pct !== undefined) {
                                  return `${value} (${Number(pct).toFixed(1)}%)`;
                                }
                                return value;
                              }}
                            />
                            <RechartsPie
                              data={agendaPropertyTypeData}
                              dataKey="porcentaje"
                              nameKey="label"
                              cx="50%"
                              cy={
                                agendaPropertyTypeData.length > 3
                                  ? "40%"
                                  : "50%"
                              }
                              outerRadius={
                                agendaPropertyTypeData.length > 3 ? 75 : 90
                              }
                              labelLine={false}
                              label={
                                agendaPropertyTypeData.length > 3
                                  ? false
                                  : (entry: any) =>
                                      `${entry.label}: ${entry.porcentaje.toFixed(2)}%`
                              }
                            >
                              {agendaPropertyTypeData.map(
                                (entry: any, index: number) => {
                                  const label = (entry.label || "")
                                    .toString()
                                    .toLowerCase();
                                  let fill = "#6366f1"; // color por defecto

                                  if (label.includes("casa")) {
                                    fill = "#facc15"; // amarillo
                                  } else if (label.includes("piso")) {
                                    fill = "#22c55e"; // verde
                                  } else if (label.includes("alquiler")) {
                                    fill = "#3b82f6"; // azul
                                  }

                                  return (
                                    <RechartsCell
                                      key={`cell-${index}`}
                                      fill={fill}
                                    />
                                  );
                                },
                              )}
                            </RechartsPie>
                          </RechartsPieChart>
                        </RechartsResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}
            </div>
          ) : null}

          {/* Card de Motivos de Rechazo (solo clientes con filtro_solar) */}
          {hasFiltroSolar && (motivosRechazoLoading || motivosRechazo.length > 0) && (
            <Card className="mb-8 shadow-lg border border-slate-200">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-800">
                  Motivos de Rechazo
                </CardTitle>
                <CardDescription className="text-slate-500">
                  Distribución de agendas rechazadas según el motivo registrado
                  {!motivosRechazoLoading && motivosRechazo.length > 0 && (
                    <> · <span className="font-semibold">
                      {motivosRechazo.reduce((s, m) => s + m.total, 0)} rechazadas
                    </span></>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 md:p-6">
                {motivosRechazoLoading ? (
                  <div className="h-[300px] flex items-center justify-center text-slate-500 text-sm">
                    Cargando motivos de rechazo...
                  </div>
                ) : (
                  <div className="flex flex-col md:flex-row items-center gap-6 p-4 md:p-0">
                    {/* Pie chart */}
                    <div className="w-full md:w-1/2">
                      <SimplePieChart
                        data={motivosRechazo.map((m) => ({
                          name: m.motivo,
                          value: m.total,
                          color:
                            m.motivo === 'Edad'
                              ? '#f97316'
                              : m.motivo === 'Pago mensual bajo'
                              ? '#ef4444'
                              : '#6366f1',
                        }))}
                        dataKey="value"
                        nameKey="name"
                      />
                    </div>
                    {/* Tabla de detalle */}
                    <div className="w-full md:w-1/2 space-y-3">
                      {motivosRechazo.map((m) => {
                        const color =
                          m.motivo === 'Edad'
                            ? { bar: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' }
                            : m.motivo === 'Pago mensual bajo'
                            ? { bar: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50 border-red-200' }
                            : { bar: 'bg-indigo-500', text: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' };
                        return (
                          <div key={m.motivo} className={`rounded-xl border p-4 ${color.bg}`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className={`text-sm font-semibold ${color.text}`}>{m.motivo}</span>
                              <span className={`text-lg font-bold ${color.text}`}>{m.total}</span>
                            </div>
                            <div className="w-full bg-white/60 rounded-full h-2">
                              <div
                                className={`${color.bar} h-2 rounded-full transition-all duration-500`}
                                style={{ width: `${m.porcentaje}%` }}
                              />
                            </div>
                            <p className={`text-xs mt-1 ${color.text} opacity-80`}>{m.porcentaje}% del total</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

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
                    .sort(
                      (a: any, b: any) =>
                        (b.cantidad_llamadas || 0) - (a.cantidad_llamadas || 0),
                    )
                    .slice(0, 8)
                    .map((item: any, index: number) => (
                      <div
                        key={`${item.hora}-${index}`}
                        className="bg-gradient-to-br from-red-50 to-rose-100 p-4 rounded-lg border border-red-200"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-red-700">
                            {item.hora_label ||
                              `${item.hora.toString().padStart(2, "0")}:00`}
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
          {agendaEnabled &&
            (() => {
              const tiposVivienda =
                dashboardData?.dashboard_data?.tipos_vivienda;
              const filteredTiposVivienda =
                tiposVivienda?.filter(
                  (item: any) => item.tipo !== "no_identificado",
                ) || [];
              const hasData =
                filteredTiposVivienda.length > 0 &&
                filteredTiposVivienda.some(
                  (item: any) => (item.cantidad || 0) > 0,
                );

              return (
                <Card className="mb-8">
                  <CardHeader>
                    <CardTitle>
                      Resumen Detallado de Tipos de Vivienda
                    </CardTitle>
                    <CardDescription>
                      Estadísticas completas de distribución de viviendas
                      (excluyendo no identificados)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {hasData ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredTiposVivienda.map(
                          (item: any, index: number) => {
                            // Calcular porcentaje basado en datos filtrados
                            const totalFiltered = filteredTiposVivienda.reduce(
                              (sum: number, filterItem: any) =>
                                sum + (filterItem.cantidad || 0),
                              0,
                            );
                            const porcentaje =
                              totalFiltered > 0
                                ? (
                                    ((item.cantidad || 0) / totalFiltered) *
                                    100
                                  ).toFixed(2)
                                : "0";

                            return (
                              <div
                                key={`${item.tipo}-${index}`}
                                className="bg-gradient-to-br from-orange-50 to-amber-100 p-4 rounded-lg border border-orange-200"
                              >
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
                          },
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-slate-500 text-sm">
                          {tiposVivienda && tiposVivienda.length === 0
                            ? "No hay datos de tipos de vivienda disponibles para este período. Los datos de tipos de vivienda solo están disponibles cuando hay llamadas efectivas con información de vivienda."
                            : "No hay datos de tipos de vivienda disponibles para este período."}
                        </p>
                        <p className="text-slate-400 text-xs mt-2">
                          Intenta seleccionar un período más amplio (mes o
                          personalizado) para ver los datos.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })()}

          {/* Resumen detallado de duración de llamadas efectivas */}
          {dashboardData?.dashboard_data?.duracion_llamadas_efectivas &&
            (() => {
              const duracion =
                dashboardData.dashboard_data.duracion_llamadas_efectivas;
              const total =
                (duracion.rango_0_30 || 0) +
                (duracion.rango_30_50 || 0) +
                (duracion.rango_50_plus || 0);

              const ranges = [
                {
                  label: "0 - 30 segundos",
                  cantidad: duracion.rango_0_30 || 0,
                  color: "blue",
                  gradientFrom: "from-blue-50",
                  gradientTo: "to-cyan-100",
                  borderColor: "border-blue-200",
                  textColor: "text-blue-700",
                  textColorDark: "text-blue-900",
                  bgColor: "bg-blue-200",
                  barGradient: "from-blue-600 to-cyan-600",
                },
                {
                  label: "30 - 50 segundos",
                  cantidad: duracion.rango_30_50 || 0,
                  color: "green",
                  gradientFrom: "from-green-50",
                  gradientTo: "to-emerald-100",
                  borderColor: "border-green-200",
                  textColor: "text-green-700",
                  textColorDark: "text-green-900",
                  bgColor: "bg-green-200",
                  barGradient: "from-green-600 to-emerald-600",
                },
                {
                  label: "50 segundos o más",
                  cantidad: duracion.rango_50_plus || 0,
                  color: "purple",
                  gradientFrom: "from-purple-50",
                  gradientTo: "to-violet-100",
                  borderColor: "border-purple-200",
                  textColor: "text-purple-700",
                  textColorDark: "text-purple-900",
                  bgColor: "bg-purple-200",
                  barGradient: "from-purple-600 to-violet-600",
                },
              ];

              // Preparar datos para el gráfico (formato similar a effectiveCallsData)
              const chartData = ranges.map((range) => ({
                label: range.label,
                cantidad: range.cantidad,
                porcentaje:
                  total > 0 ? ((range.cantidad / total) * 100).toFixed(2) : "0",
              }));

              return (
                <Card className="mb-8 shadow-lg border border-slate-200">
                  <CardHeader>
                    <CardTitle className="text-base font-semibold text-slate-800">
                      Resumen Detallado de Duración de Llamadas Efectivas
                    </CardTitle>
                    <CardDescription className="text-slate-500">
                      Distribución de llamadas efectivas por rangos de duración
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 md:p-6">
                    {/* Gráfico de distribución */}
                    {total > 0 && (
                      <div className="mb-6">
                        <div className="h-[300px] bg-white rounded-xl p-4 md:p-6">
                          <Chart
                            data={chartData}
                            type="line"
                            xKey="label"
                            yKey="cantidad"
                            height={300}
                            colors={["#3b82f6"]}
                            showLegend={false}
                          />
                        </div>
                      </div>
                    )}

                    {/* Cards individuales */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {ranges.map((range, index) => {
                        const porcentaje =
                          total > 0
                            ? ((range.cantidad / total) * 100).toFixed(2)
                            : "0";

                        return (
                          <div
                            key={`duracion-${index}`}
                            className={`bg-gradient-to-br ${range.gradientFrom} ${range.gradientTo} p-4 rounded-lg border ${range.borderColor}`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span
                                className={`text-sm font-medium ${range.textColor}`}
                              >
                                {range.label}
                              </span>
                              <span className={`text-xs ${range.textColor}`}>
                                {porcentaje}%
                              </span>
                            </div>
                            <div
                              className={`text-2xl font-bold ${range.textColorDark} mb-2`}
                            >
                              {range.cantidad.toLocaleString()}
                            </div>
                            <div
                              className={`w-full ${range.bgColor} rounded-full h-2`}
                            >
                              <div
                                className={`bg-gradient-to-r ${range.barGradient} h-2 rounded-full transition-all duration-500`}
                                style={{ width: `${porcentaje}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

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
                  {dashboardData.dashboard_data.razones_desconexion
                    .slice(0, 6)
                    .map((item: any, index: number) => (
                      <div
                        key={`${item.razon}-${index}`}
                        className="bg-gradient-to-br from-purple-50 to-violet-100 p-4 rounded-lg border border-purple-200"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-purple-700">
                            {item.razon}
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
                <CardTitle>
                  Análisis Detallado de Llamadas Efectivas por Hora
                </CardTitle>
                <CardDescription>
                  Distribución completa de llamadas efectivas a lo largo del día
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">
                          Hora
                        </th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">
                          Llamadas Efectivas
                        </th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">
                          Porcentaje
                        </th>
                        <th className="py-3 px-4 text-sm font-medium text-slate-600">
                          Distribución
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardData.dashboard_data.llamadas_efectivas_por_hora
                        .sort(
                          (a: any, b: any) =>
                            parseInt(a.hora) - parseInt(b.hora),
                        )
                        .map((item: any, index: number) => {
                          const total =
                            dashboardData.dashboard_data.llamadas_efectivas_por_hora.reduce(
                              (sum: number, totalItem: any) =>
                                sum + (totalItem.cantidad_llamadas || 0),
                              0,
                            );
                          const porcentaje =
                            total > 0
                              ? (
                                  ((item.cantidad_llamadas || 0) / total) *
                                  100
                                ).toFixed(2)
                              : "0";

                          return (
                            <tr
                              key={`${item.hora}-${index}`}
                              className="border-b border-slate-200 hover:bg-slate-50"
                            >
                              <td className="py-3 px-4 text-sm text-slate-700 font-medium">
                                {item.hora_label ||
                                  `${item.hora.toString().padStart(2, "0")}:00`}
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
                        <td className="py-3 px-4 text-sm font-medium text-slate-600">
                          Total
                        </td>
                        <td className="py-3 px-4 text-sm font-medium text-slate-800 text-right">
                          {dashboardData.dashboard_data.llamadas_efectivas_por_hora
                            .reduce(
                              (sum: number, item: any) =>
                                sum + (item.cantidad_llamadas || 0),
                              0,
                            )
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
          {agendaEnabled &&
            (() => {
              const tiposVivienda =
                dashboardData?.dashboard_data?.tipos_vivienda;
              const filteredTiposVivienda =
                tiposVivienda?.filter(
                  (item: any) => item.tipo !== "no_identificado",
                ) || [];
              const hasData =
                filteredTiposVivienda.length > 0 &&
                filteredTiposVivienda.some(
                  (item: any) => (item.cantidad || 0) > 0,
                );

              return (
                <Card className="mb-8">
                  <CardHeader>
                    <CardTitle>
                      Análisis Detallado de Tipos de Vivienda
                    </CardTitle>
                    <CardDescription>
                      Distribución completa de los tipos de vivienda de los
                      clientes (excluyendo no identificados)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {hasData ? (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-slate-200">
                              <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">
                                Tipo de Vivienda
                              </th>
                              <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">
                                Cantidad
                              </th>
                              <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">
                                Porcentaje
                              </th>
                              <th className="py-3 px-4 text-sm font-medium text-slate-600">
                                Distribución
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredTiposVivienda.map(
                              (item: any, index: number) => {
                                // Calcular porcentaje basado en datos filtrados
                                const totalFiltered =
                                  filteredTiposVivienda.reduce(
                                    (sum: number, filterItem: any) =>
                                      sum + (filterItem.cantidad || 0),
                                    0,
                                  );
                                const porcentaje =
                                  totalFiltered > 0
                                    ? (
                                        ((item.cantidad || 0) / totalFiltered) *
                                        100
                                      ).toFixed(2)
                                    : "0";

                                return (
                                  <tr
                                    key={`${item.tipo}-${index}`}
                                    className="border-b border-slate-200 hover:bg-slate-50"
                                  >
                                    <td className="py-3 px-4 text-sm text-slate-700 font-medium">
                                      {translateHousingType(
                                        item.tipo || "Desconocido",
                                      )}
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
                              },
                            )}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-slate-200 bg-slate-50">
                              <td className="py-3 px-4 text-sm font-medium text-slate-600">
                                Total
                              </td>
                              <td className="py-3 px-4 text-sm font-medium text-slate-800 text-right">
                                {filteredTiposVivienda
                                  .reduce(
                                    (sum: number, item: any) =>
                                      sum + (item.cantidad || 0),
                                    0,
                                  )
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
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-slate-500 text-sm">
                          {tiposVivienda && tiposVivienda.length === 0
                            ? "No hay datos de tipos de vivienda disponibles para este período. Los datos de tipos de vivienda solo están disponibles cuando hay llamadas efectivas con información de vivienda."
                            : "No hay datos de tipos de vivienda disponibles para este período."}
                        </p>
                        <p className="text-slate-400 text-xs mt-2">
                          Intenta seleccionar un período más amplio (mes o
                          personalizado) para ver los datos.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })()}

          {/* Tabla detallada de razones de desconexión */}
          {dashboardData?.dashboard_data?.razones_desconexion && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Análisis Detallado de Desconexiones</CardTitle>
                <CardDescription>
                  Distribución completa de las razones por las que terminan las
                  llamadas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">
                          Razón
                        </th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">
                          Total
                        </th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">
                          Porcentaje
                        </th>
                        <th className="py-3 px-4 text-sm font-medium text-slate-600">
                          Distribución
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardData.dashboard_data.razones_desconexion.map(
                        (item: any, index: number) => (
                          <tr
                            key={`${item.razon}-${index}`}
                            className="border-b border-slate-200 hover:bg-slate-50"
                          >
                            <td className="py-3 px-4 text-sm text-slate-700 font-medium">
                              {item.razon || "Desconocida"}
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
                        ),
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-slate-200 bg-slate-50">
                        <td className="py-3 px-4 text-sm font-medium text-slate-600">
                          Total
                        </td>
                        <td className="py-3 px-4 text-sm font-medium text-slate-800 text-right">
                          {dashboardData.dashboard_data.razones_desconexion
                            .reduce(
                              (sum: number, item: any) =>
                                sum + (item.total || 0),
                              0,
                            )
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
