import React, { useMemo, useState, useEffect, useCallback } from "react";
import type { CallStats, FilterCriteria } from "../types";
import { DashboardHeader } from "../components/dashboard/DashboardHeader";
import { DashboardMetricsCard } from "../components/dashboard/DashboardMetricsCard";
import { DashboardCharts } from "../components/dashboard/DashboardCharts";
import { Button } from "../components/ui/button";
import { 
  fetchSalesMetrics, 
  fetchSalesMetricsToday, 
  fetchSalesMetricsWeek, 
  fetchSalesMetricsMonth,
  fetchAsistenciaFunnelMetrics,
  fetchFacturacionByDay,
  fetchROIByDay 
} from "../api";
import { useCallsContext } from "../context/CallsContext";
import { Activity, TrendingUp, ShoppingCart, BarChart3, Clock, Phone, RefreshCw } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";

import {
  generateDisconnectionData,
  generateEffectiveCallsData,
  generateHousingTypeData,
  generateAgendaHousingTypeData,
  generateInterestData,
  generateAgentesPorAgendasData,
  generateHourlyAgendasData,
} from "../lib/chartUtils";
import {
  getMadridYmdParts,
  getMadridMidnight,
  addDaysUTC,
  formatMadridDateYYYYMMDD,
} from "../lib/dateUtils";

// --- Skeleton Component ---
const DashboardSkeleton = () => {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-800 rounded-lg"></div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-[350px] bg-gray-800 rounded-lg"></div>
        ))}
      </div>
    </div>
  );
};

interface DashboardProps {
  loading: boolean;
  error: string | null;
  dashboardData?: any;
  loadDashboardData?: (
    fechaInicio?: string,
    fechaFin?: string,
    timePeriod?: string,
    bdd?: string,
  ) => void;
  agendaEnabled?: boolean;
  launchEnabled?: boolean;
  salesEnabled?: boolean;
}

export function Dashboard({
  loading,
  error,
  dashboardData,
  loadDashboardData,
  agendaEnabled = true,
  launchEnabled = false,
  salesEnabled = false,
}: DashboardProps) {
  const { allCalls } = useCallsContext();
  // --- Error Boundary Básico ---
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const handleError = (error: ErrorEvent) => {
      // console.error("Error capturado en Dashboard:", error);
      setHasError(true);
      setErrorMessage(error.message || "Error desconocido");
    };
    window.addEventListener("error", handleError);
    return () => window.removeEventListener("error", handleError);
  }, []);

  // --- Estados de Filtros y Fechas ---
  const [timePeriod, setTimePeriod] = useState<string>(() => {
    try {
      return localStorage.getItem("dashboard_time_period") || "today";
    } catch {
      return "today";
    }
  });
  const [selectValue, setSelectValue] = useState<string>(timePeriod);
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

  const [hourRangeStart, setHourRangeStart] = useState<string>("8");
  const [hourRangeEnd, setHourRangeEnd] = useState<string>("23");

  const [effectiveCallsHourStart, setEffectiveCallsHourStart] =
    useState<string>("0");
  const [effectiveCallsHourEnd, setEffectiveCallsHourEnd] =
    useState<string>("23");

  const [databaseFilter, setDatabaseFilter] = useState<string>("");
  const [appliedDatabaseFilter, setAppliedDatabaseFilter] =
    useState<string>("");
  const [hasFiltroSolar, setHasFiltroSolar] = useState(false);

  // --- Estados de Launch ---
  const [launchRegionMetrics] = useState<any>(null);
  const [launchRegionLoading] = useState<boolean>(false);
  const [launchRegionError] = useState<string | null>(null);

  const [asistenciaByHour] = useState<any[]>([]);
  const [asistenciaLoading] = useState<boolean>(false);
  const [asistenciaError] = useState<string | null>(null);

  // --- Estados de Ventas ---
  const [salesMetrics, setSalesMetrics] = useState<any>(null);
  const [salesLoading, setSalesLoading] = useState<boolean>(false);
  const [facturacionData, setFacturacionData] = useState<any[]>([]);
  const [roiData, setROIData] = useState<any[]>([]);

  // --- Estados de Funnel ---
  const [funnelData, setFunnelData] = useState<any>(null);
  const [funnelLoading, setFunnelLoading] = useState<boolean>(false);

  // --- Helpers de Metadata ---
  const checkMetadata = useCallback(() => {
    try {
      const metadataStr = sessionStorage.getItem("metadata");
      if (metadataStr) {
        const metadata = JSON.parse(metadataStr);
        setHasFiltroSolar(metadata?.filtro_solar === true);
        return metadata?.filtro_solar === true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    checkMetadata();
  }, [checkMetadata]);

  // --- Helpers y Handlers ---
  const handleHourRangeChange = (type: "start" | "end", value: string) => {
    if (type === "start") {
      setHourRangeStart(value);
      if (parseInt(value) > parseInt(hourRangeEnd)) setHourRangeEnd(value);
    } else {
      setHourRangeEnd(value);
      if (parseInt(value) < parseInt(hourRangeStart)) setHourRangeStart(value);
    }
  };

  const handleEffectiveCallsHourRangeChange = (
    type: "start" | "end",
    value: string,
  ) => {
    if (type === "start") {
      setEffectiveCallsHourStart(value);
      if (parseInt(value) > parseInt(effectiveCallsHourEnd))
        setEffectiveCallsHourEnd(value);
    } else {
      setEffectiveCallsHourEnd(value);
      if (parseInt(value) < parseInt(effectiveCallsHourStart))
        setEffectiveCallsHourStart(value);
    }
  };

  const calculateDatesForPeriod = (
    period: string,
    customStart?: string,
    customEnd?: string,
    customStTime?: string,
    customEnTime?: string,
  ) => {
    // (Toda tu lógica original de cálculo de fechas va aquí, la omito por brevedad pero mantén la que tienes)
    const todayMadrid = getMadridMidnight();
    switch (period) {
      case "today":
        return {
          fechaInicio: formatMadridDateYYYYMMDD(todayMadrid),
          fechaFin: formatMadridDateYYYYMMDD(addDaysUTC(todayMadrid, 1)),
        };
      case "week":
        return {
          fechaInicio: addDaysUTC(todayMadrid, -6).toISOString(),
          fechaFin: addDaysUTC(todayMadrid, 1).toISOString(),
        };
      case "month":
        const { year, month } = getMadridYmdParts();
        return {
          fechaInicio: new Date(Date.UTC(year, month - 1, 1)).toISOString(),
          fechaFin: new Date(Date.UTC(year, month, 1)).toISOString(),
        };
      case "custom":
        // Lógica custom igual a la original
        if (customStart && customEnd) {
          const [yS, mS, dS] = customStart.split("-").map(Number);
          const [yE, mE, dE] = customEnd.split("-").map(Number);
          return {
            fechaInicio: new Date(Date.UTC(yS, mS - 1, dS)).toISOString(),
            fechaFin: new Date(Date.UTC(yE, mE - 1, dE)).toISOString(),
          };
        }
        return null;
      default:
        return null;
    }
  };

  useEffect(() => {
    if (!loadDashboardData) return;
    const bddFilter = appliedDatabaseFilter || undefined;

    if (
      timePeriod === "all" ||
      timePeriod === "today" ||
      timePeriod === "week" ||
      timePeriod === "month"
    ) {
      loadDashboardData(undefined, undefined, timePeriod, bddFilter);
    } else if (timePeriod === "custom" && customStartDate && customEndDate) {
      const dates = calculateDatesForPeriod(
        "custom",
        customStartDate,
        customEndDate,
        customStartTime,
        customEndTime,
      );
      if (dates)
        loadDashboardData(
          dates.fechaInicio,
          dates.fechaFin,
          "custom",
          bddFilter,
        );
    }
  }, [
    timePeriod,
    customStartDate,
    customEndDate,
    appliedDatabaseFilter,
    loadDashboardData,
  ]);

  // --- Cargar Métricas de Ventas y Funnel ---
  const loadExtraMetrics = useCallback(async () => {
    const dates = calculateDatesForPeriod(timePeriod, customStartDate, customEndDate);
    const start = dates?.fechaInicio?.split('T')[0];
    const end = dates?.fechaFin?.split('T')[0];

    if (salesEnabled) {
      setSalesLoading(true);
      try {
        let metrics;
        if (timePeriod === "today") metrics = await fetchSalesMetricsToday();
        else if (timePeriod === "week") metrics = await fetchSalesMetricsWeek();
        else if (timePeriod === "month") metrics = await fetchSalesMetricsMonth();
        else metrics = await fetchSalesMetrics(start, end);
        setSalesMetrics(metrics);

        // Cargar datos de tendencia
        const [fData, rData] = await Promise.all([
          fetchFacturacionByDay(start, end),
          fetchROIByDay(start, end)
        ]);
        setFacturacionData(fData);
        setROIData(rData);
      } catch (err) {
        // console.error("Error loading sales metrics:", err);
      } finally {
        setSalesLoading(false);
      }
    }

    if (launchEnabled) {
      setFunnelLoading(true);
      try {
        const funnel = await fetchAsistenciaFunnelMetrics({
          fecha_inicio: start,
          fecha_fin: end
        });
        setFunnelData(funnel);
      } catch (err) {
        // console.error("Error loading funnel metrics:", err);
      } finally {
        setFunnelLoading(false);
      }
    }
  }, [salesEnabled, launchEnabled, timePeriod, customStartDate, customEndDate]);

  useEffect(() => {
    loadExtraMetrics();
  }, [loadExtraMetrics]);

  // --- Helpers Chart Data ---
  // Usa exactamente los mismos useMemo que tenías (hourlyAgendasData, housingTypeData, etc...)
  const hourlyAgendasData = useMemo(
    () =>
      generateHourlyAgendasData(dashboardData, hourRangeStart, hourRangeEnd),
    [dashboardData, hourRangeStart, hourRangeEnd],
  );
  const housingTypeData = useMemo(
    () => generateHousingTypeData(dashboardData),
    [dashboardData],
  );
  const interestData = useMemo(
    () => generateInterestData(dashboardData),
    [dashboardData],
  );
  const agentesPorAgendasData = useMemo(
    () => generateAgentesPorAgendasData(dashboardData),
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
  const disconnectionData = useMemo(
    () => generateDisconnectionData([], dashboardData),
    [dashboardData],
  );

  // (Mismo bloque de logic que tenías para combinedCallsAgendasData)
  const combinedCallsAgendasData = useMemo(() => {
    if (!effectiveCallsData || effectiveCallsData.length === 0) {
      if (!hourlyAgendasData || hourlyAgendasData.length === 0) {
        return [];
      }
    }

    const map = new Map<string, { label: string; llamadas: number; agendas: number }>();

    if (effectiveCallsData && effectiveCallsData.length > 0) {
      effectiveCallsData.forEach((item: any) => {
        const label = item.label ?? "";
        const llamadas = typeof item.llamadas === "number" ? item.llamadas : 0;
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

    return Array.from(map.values()).sort((a, b) => {
      const hA = parseInt(a.label.split(":")[0]);
      const hB = parseInt(b.label.split(":")[0]);
      return hA - hB;
    });
  }, [effectiveCallsData, hourlyAgendasData]);

  const agendaHousingTypeData = useMemo(
    () => generateAgendaHousingTypeData(dashboardData),
    [dashboardData],
  );
  const hasAgendasInPeriod = !!(
    dashboardData?.dashboard_data?.metricas_generales?.total_agendamientos > 0
  );
  const agendaPropertyTypeData = useMemo(() => {
    if (!hasAgendasInPeriod || !agendaHousingTypeData) return [];
    return agendaHousingTypeData
      .map((item: any) => ({
        label: item.label,
        porcentaje: parseFloat(item.porcentaje) || 0,
      }))
      .filter((i: any) => i.porcentaje > 0);
  }, [agendaHousingTypeData, hasAgendasInPeriod]);

  const isLongRange = timePeriod === "all" || timePeriod === "month";

  const calculateLaunchPercentage = (val: number, tot: number) =>
    tot > 0 ? Math.round((val / tot) * 100) : 0;

  // --- Render ---
  if (hasError) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-800 mb-2">
            Error en el Dashboard
          </h2>
          <p className="text-red-700 mb-4">{errorMessage}</p>
          <Button
            onClick={() => window.location.reload()}
            className="bg-red-600 text-white"
          >
            Recargar página
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <DashboardHeader
        loading={loading}
        dashboardData={dashboardData}
        timePeriod={timePeriod}
        selectValue={selectValue}
        hasFiltroSolar={hasFiltroSolar}
        databaseFilter={databaseFilter}
        appliedDatabaseFilter={appliedDatabaseFilter}
        setDatabaseFilter={setDatabaseFilter}
        applyDatabaseFilter={() => setAppliedDatabaseFilter(databaseFilter)}
        clearDatabaseFilter={() => {
          setDatabaseFilter("");
          setAppliedDatabaseFilter("");
        }}
        handleTimePeriodChange={(val) => {
          if (val === "custom") {
            setIsCustomDateDialogOpen(true);
            setSelectValue("custom");
          } else {
            setTimePeriod(val);
            setSelectValue(val);
          }
        }}
        isCustomDateDialogOpen={isCustomDateDialogOpen}
        setIsCustomDateDialogOpen={setIsCustomDateDialogOpen}
        tempStartDate={tempStartDate}
        setTempStartDate={setTempStartDate}
        tempStartTime={tempStartTime}
        setTempStartTime={setTempStartTime}
        tempEndDate={tempEndDate}
        setTempEndDate={setTempEndDate}
        tempEndTime={tempEndTime}
        setTempEndTime={setTempEndTime}
        handleCancelCustomDates={() => setIsCustomDateDialogOpen(false)}
        handleConfirmCustomDates={() => {
          setCustomStartDate(tempStartDate);
          setCustomEndDate(tempEndDate);
          setCustomStartTime(tempStartTime);
          setCustomEndTime(tempEndTime);
          setTimePeriod("custom");
          setIsCustomDateDialogOpen(false);
        }}
        customStartDate={customStartDate}
        customEndDate={customEndDate}
        customStartTime={customStartTime}
        customEndTime={customEndTime}
      />

      {loading && !dashboardData ? (
        <DashboardSkeleton />
      ) : error ? (
        <div className="p-8 bg-red-50 rounded-xl border border-red-200 text-red-700">
          {error}
        </div>
      ) : !dashboardData ? (
        <div className="p-8 bg-yellow-50 rounded-xl border border-yellow-200 text-yellow-700">
          No hay datos cargados.
        </div>
      ) : (
        <>
          {/* Top Cards (Métricas Generales) */}
          <div
            className={`grid gap-4 mb-4 ${agendaEnabled ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-2 lg:grid-cols-4"}`}
          >
            <DashboardMetricsCard
              title="Llamadas Lanzadas"
              value={
                dashboardData?.dashboard_data?.metricas_generales?.total_llamadas?.toLocaleString() ||
                0
              }
              description="Total registrado"
            />
            <DashboardMetricsCard
              title="Costo Total"
              value={`$${dashboardData?.dashboard_data?.metricas_generales?.costo_total?.toFixed(2) || "0.00"}`}
              description="Costo de llamadas"
            />
            <DashboardMetricsCard
              title="Llamadas Contestadas"
              value={
                dashboardData?.dashboard_data?.metricas_generales?.llamadas_efectivas?.toLocaleString() ||
                0
              }
            />
            <DashboardMetricsCard
              title="Llamadas Fallidas"
              value={
                dashboardData?.dashboard_data?.metricas_generales?.llamadas_fallidas?.toLocaleString() ||
                0
              }
            />
          </div>

          {agendaEnabled && (
            <div className="grid gap-4 mb-8 md:grid-cols-2 lg:grid-cols-3">
              <DashboardMetricsCard
                title="Total Agendamientos"
                value={
                  dashboardData?.dashboard_data?.metricas_generales
                    ?.total_agendamientos || 0
                }
              />
              <DashboardMetricsCard
                title="Costo por Agenda"
                value={`$${((dashboardData?.dashboard_data?.metricas_generales?.costo_total || 0) / (dashboardData?.dashboard_data?.metricas_generales?.total_agendamientos || 1)).toFixed(2)}`}
              />
              <DashboardMetricsCard
                title="Promedio de Agenda"
                value={(
                  (dashboardData?.dashboard_data?.metricas_generales
                    ?.llamadas_efectivas || 0) /
                  (dashboardData?.dashboard_data?.metricas_generales
                    ?.total_agendamientos || 1)
                ).toFixed(1)}
                description="llamadas por agenda"
              />
            </div>
          )}



          <DashboardCharts
            dashboardData={dashboardData}
            agendaEnabled={agendaEnabled}
            launchEnabled={launchEnabled}
            timePeriod={timePeriod}
            isLongRange={isLongRange}
            hourlyAgendasData={hourlyAgendasData}
            housingTypeData={housingTypeData}
            interestData={interestData}
            agentesPorAgendasData={agentesPorAgendasData}
            effectiveCallsData={effectiveCallsData}
            asistenciaByHour={asistenciaByHour}
            disconnectionData={disconnectionData}
            combinedCallsAgendasData={combinedCallsAgendasData}
            agendaPropertyTypeData={agendaPropertyTypeData}
            hasAgendasInPeriod={hasAgendasInPeriod}
            asistenciaLoading={asistenciaLoading}
            asistenciaError={asistenciaError}
            launchRegionLoading={launchRegionLoading}
            launchRegionError={launchRegionError}
            launchRegionMetrics={launchRegionMetrics}
            calculateLaunchPercentage={calculateLaunchPercentage}
            hourRangeStart={hourRangeStart}
            hourRangeEnd={hourRangeEnd}
            handleHourRangeChange={handleHourRangeChange}
            effectiveCallsHourStart={effectiveCallsHourStart}
            effectiveCallsHourEnd={effectiveCallsHourEnd}
            handleEffectiveCallsHourRangeChange={
              handleEffectiveCallsHourRangeChange
            }
            salesMetrics={salesMetrics}
            facturacionData={facturacionData}
            roiData={roiData}
            salesEnabled={salesEnabled}
          />

          {/* Tablas detalladas originales */}
          <div className="space-y-8 mt-8">
            {interestData && interestData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Análisis de Interés</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Interés</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">Cantidad</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">Porcentaje</th>
                        </tr>
                      </thead>
                      <tbody>
                        {interestData.map((item: any, idx: number) => (
                          <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                            <td className="py-3 px-4 text-sm text-slate-700">{item.label}</td>
                            <td className="py-3 px-4 text-sm text-slate-600 text-right">{item.cantidad}</td>
                            <td className="py-3 px-4 text-sm text-slate-600 text-right">{item.porcentaje}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {agendaEnabled && dashboardData?.dashboard_data?.tipos_vivienda && (
              <Card>
                <CardHeader>
                  <CardTitle>Análisis Detallado de Tipos de Vivienda</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Tipo de Vivienda</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">Cantidad</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">Porcentaje</th>
                        </tr>
                      </thead>
                      <tbody>
                        {housingTypeData.map((item: any, idx: number) => (
                          <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                            <td className="py-3 px-4 text-sm text-slate-700">{item.label}</td>
                            <td className="py-3 px-4 text-sm text-slate-600 text-right">{item.cantidad}</td>
                            <td className="py-3 px-4 text-sm text-slate-600 text-right">{item.porcentaje}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {disconnectionData && disconnectionData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Análisis Detallado de Desconexiones</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Razón</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">Total</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">Porcentaje</th>
                        </tr>
                      </thead>
                      <tbody>
                        {disconnectionData.map((item: any, idx: number) => (
                          <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                            <td className="py-3 px-4 text-sm text-slate-700">{item.reason}</td>
                            <td className="py-3 px-4 text-sm text-slate-600 text-right">{item.count}</td>
                            <td className="py-3 px-4 text-sm text-slate-600 text-right">{item.percentage}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <hr className="my-8 border-gray-200" />

          {/* Actividad Reciente - Módulo Nuevo al final */}
          <Card className="bg-gray-900 border-gray-800 shadow-xl mb-8 overflow-hidden">
            <CardHeader className="border-b border-gray-800 flex flex-row items-center justify-between py-4">
              <CardTitle className="flex items-center gap-2 text-white text-lg">
                <Clock className="w-5 h-5 text-purple-400" />
                Actividad Reciente
              </CardTitle>
              <div className="text-xs text-gray-500 bg-gray-800 px-3 py-1 rounded-full border border-gray-700">
                Últimas {allCalls.slice(0, 10).length} llamadas
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left bg-gray-850">
                      <th className="px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Número</th>
                      <th className="px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Duración</th>
                      <th className="px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Estado</th>
                      <th className="px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Fecha/Hora</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {allCalls.slice(0, 10).map((call: any) => (
                      <tr key={call.call_id} className="hover:bg-gray-800/40 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-gray-800 rounded-lg"><Phone className="w-3 h-3 text-gray-400" /></div>
                            <span className="text-sm font-medium text-gray-200">{call.to_number}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                          {Math.floor(call.duration_ms / 1000)}s
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                            call.call_status === 'completed' ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-800/50' :
                            call.call_status === 'failed' ? 'bg-rose-900/40 text-rose-400 border border-rose-800/50' : 
                            'bg-blue-900/40 text-blue-400 border border-blue-800/50'
                          }`}>
                            {call.call_status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(call.start_time).toLocaleString('es-ES', { 
                            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
                          })}
                        </td>
                      </tr>
                    ))}
                    {allCalls.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-10 text-center text-gray-500 italic">No hay actividad reciente para mostrar</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>


          {/* Secciones de Ventas y Lanzamiento - MOVIDAS AL FINAL */}
          {(salesEnabled || launchEnabled) && (
            <div className="grid gap-6 mt-8 mb-8 lg:grid-cols-2">
              {salesEnabled && (
                <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 shadow-xl overflow-hidden">
                  <CardHeader className="border-b border-gray-800 pb-3">
                    <CardTitle className="flex items-center gap-2 text-white text-lg">
                      <ShoppingCart className="w-5 h-5 text-emerald-400" />
                      Resumen de Ventas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    {salesLoading ? (
                      <div className="flex justify-center py-6"><RefreshCw className="animate-spin text-gray-500" /></div>
                    ) : salesMetrics ? (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                          <p className="text-xs text-gray-400 uppercase font-bold mb-1">ROI</p>
                          <p className="text-2xl font-bold text-emerald-400">x{salesMetrics.roi?.toFixed(2) || '0.00'}</p>
                        </div>
                        <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                          <p className="text-xs text-gray-400 uppercase font-bold mb-1">Conversión</p>
                          <p className="text-2xl font-bold text-blue-400">{salesMetrics.tasaConversion?.toFixed(2) || '0.00'}%</p>
                        </div>
                        <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                          <p className="text-xs text-gray-400 uppercase font-bold mb-1">Facturación</p>
                          <p className="text-2xl font-bold text-white">${salesMetrics.totalFacturacion?.toLocaleString() || '0'}</p>
                        </div>
                        <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                          <p className="text-xs text-gray-400 uppercase font-bold mb-1">Costo/Venta</p>
                          <p className="text-2xl font-bold text-rose-400">${salesMetrics.costePorVenta?.toFixed(2) || '0'}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-center text-gray-500 py-6">No hay datos de ventas disponibles</p>
                    )}
                  </CardContent>
                </Card>
              )}

              {launchEnabled && (
                <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 shadow-xl overflow-hidden">
                  <CardHeader className="border-b border-gray-800 pb-3">
                    <CardTitle className="flex items-center gap-2 text-white text-lg">
                      <TrendingUp className="w-5 h-5 text-blue-400" />
                      Funnel de Lanzamiento
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    {funnelLoading ? (
                      <div className="flex justify-center py-6"><RefreshCw className="animate-spin text-gray-500" /></div>
                    ) : funnelData ? (
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-gray-400 font-bold uppercase">
                            <span>Interés (Llamadas)</span>
                            <span>{funnelData.totals?.total_links || 0}</span>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-3">
                            <div className="bg-blue-500 h-3 rounded-full" style={{ width: '100%' }}></div>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-gray-400 font-bold uppercase">
                            <span>Engagement (Clicks)</span>
                            <span>{funnelData.totals?.total_clicks || 0} ({funnelData.totals?.pct_clicks_over_links?.toFixed(1) || 0}%)</span>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-3">
                            <div className="bg-indigo-500 h-3 rounded-full" style={{ width: `${funnelData.totals?.pct_clicks_over_links || 0}%` }}></div>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-gray-400 font-bold uppercase">
                            <span>Asistencia (Citas)</span>
                            <span>{funnelData.totals?.total_attendance || 0} ({funnelData.totals?.pct_attendance_over_links?.toFixed(1) || 0}%)</span>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-3">
                            <div className="bg-emerald-500 h-3 rounded-full" style={{ width: `${funnelData.totals?.pct_attendance_over_links || 0}%` }}></div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-center text-gray-500 py-6">No hay datos de funnel disponibles</p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
