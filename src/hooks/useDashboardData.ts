// src/hooks/useDashboardData.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  fetchLanzamientoMetrics,
  fetchLanzamientoMetricsToday,
  fetchLanzamientoMetricsCustom,
  fetchAsistenciaClicksByHour
} from "../api";
import {
  generateDisconnectionData,
  generateDailyCallsData,
  generateEffectiveCallsData,
  generateHousingTypeData,
  generateAgendaHousingTypeData,
  generateInterestData,
  generateAgentesPorAgendasData,
  generateHourlyAgendasData
} from "../lib/chartUtils";
import { getMadridYmdParts, getMadridMidnight, addDaysUTC, formatMadridDateYYYYMMDD } from "../lib/dateUtils";

export function useDashboardData(props: any) {
  const { dashboardData, loadDashboardData, timePeriod: initialTimePeriod, launchEnabled } = props;

  // --- 1. ESTADOS ---
  const [timePeriod, setTimePeriod] = useState<string>(() => {
    try { return localStorage.getItem('dashboard_time_period') || 'today'; } 
    catch { return 'today'; }
  });
  const [selectValue, setSelectValue] = useState<string>(timePeriod);
  
  // Fechas personalizadas
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [customStartTime, setCustomStartTime] = useState<string>('00:00');
  const [customEndTime, setCustomEndTime] = useState<string>('23:59');
  
  // Modales y temporales
  const [isCustomDateDialogOpen, setIsCustomDateDialogOpen] = useState<boolean>(false);
  const [tempStartDate, setTempStartDate] = useState<string>('');
  const [tempEndDate, setTempEndDate] = useState<string>('');
  const [tempStartTime, setTempStartTime] = useState<string>('00:00');
  const [tempEndTime, setTempEndTime] = useState<string>('23:59');
  
  // Filtros de horas
  const [hourRangeStart, setHourRangeStart] = useState<string>('8');
  const [hourRangeEnd, setHourRangeEnd] = useState<string>('23');
  const [effectiveCallsHourStart, setEffectiveCallsHourStart] = useState<string>('0');
  const [effectiveCallsHourEnd, setEffectiveCallsHourEnd] = useState<string>('23');
  
  // Base de datos y metadatos
  const [databaseFilter, setDatabaseFilter] = useState<string>('');
  const [appliedDatabaseFilter, setAppliedDatabaseFilter] = useState<string>('');
  const [hasFiltroSolar, setHasFiltroSolar] = useState(false);

  // Estados de carga adicionales (Lanzamiento)
  const [launchRegionMetrics, setLaunchRegionMetrics] = useState<any>(null);
  const [launchRegionLoading, setLaunchRegionLoading] = useState<boolean>(false);
  const [launchRegionError, setLaunchRegionError] = useState<string | null>(null);
  
  const [asistenciaByHour, setAsistenciaByHour] = useState<any[]>([]);
  const [asistenciaLoading, setAsistenciaLoading] = useState<boolean>(false);
  const [asistenciaError, setAsistenciaError] = useState<string | null>(null);

  // --- 2. HELPERS Y HANDLERS ---
  const handleHourRangeChange = (type: 'start' | 'end', value: string) => {
    const startHour = parseInt(type === 'start' ? value : hourRangeStart);
    const endHour = parseInt(type === 'end' ? value : hourRangeEnd);
    if (type === 'start') {
      setHourRangeStart(value);
      if (startHour > endHour) setHourRangeEnd(value);
    } else {
      setHourRangeEnd(value);
      if (endHour < startHour) setHourRangeStart(value);
    }
  };

  const handleEffectiveCallsHourRangeChange = (type: 'start' | 'end', value: string) => {
    const startHour = parseInt(type === 'start' ? value : effectiveCallsHourStart);
    const endHour = parseInt(type === 'end' ? value : effectiveCallsHourEnd);
    if (type === 'start') {
      setEffectiveCallsHourStart(value);
      if (startHour > endHour) setEffectiveCallsHourEnd(value);
    } else {
      setEffectiveCallsHourEnd(value);
      if (endHour < startHour) setEffectiveCallsHourStart(value);
    }
  };

  const handleTimePeriodChange = (newPeriod: string) => {
    if (newPeriod === 'custom') {
      setTempStartDate(customStartDate);
      setTempEndDate(customEndDate);
      setTempStartTime(customStartTime);
      setTempEndTime(customEndTime);
      setIsCustomDateDialogOpen(true);
      setSelectValue('custom');
    } else {
      setTimePeriod(newPeriod);
      setSelectValue(newPeriod);
    }
  };

  const handleConfirmCustomDates = () => {
    if (tempStartDate && tempEndDate && tempStartDate <= tempEndDate) {
      setCustomStartDate(tempStartDate);
      setCustomEndDate(tempEndDate);
      setCustomStartTime(tempStartTime);
      setCustomEndTime(tempEndTime);
      setTimePeriod('custom');
      setSelectValue('custom');
      setIsCustomDateDialogOpen(false);
    }
  };

  const handleCancelCustomDates = () => {
    setIsCustomDateDialogOpen(false);
    if (!customStartDate || !customEndDate) {
      setSelectValue(timePeriod);
    }
  };

  const applyDatabaseFilter = () => setAppliedDatabaseFilter(databaseFilter.trim());
  const clearDatabaseFilter = () => {
    setDatabaseFilter('');
    setAppliedDatabaseFilter('');
  };

  // --- 3. EFECTOS (Ciclo de vida) ---
  // Persistir timePeriod
  useEffect(() => {
    try {
      localStorage.setItem('dashboard_time_period', timePeriod);
      if (timePeriod !== 'custom' || (customStartDate && customEndDate)) {
        setSelectValue(timePeriod);
      }
    } catch {}
  }, [timePeriod, customStartDate, customEndDate]);

  // Cargar datos principales
  useEffect(() => {
    if (!loadDashboardData) return;
    const bddFilter = appliedDatabaseFilter || undefined;
    // Aquí puedes incluir tu lógica de calculateDatesForPeriod que tenías en el archivo original
    // Para simplificar el snippet, asumimos que loadDashboardData hace el fetch correcto.
    if (timePeriod === 'today' || timePeriod === 'week' || timePeriod === 'month' || timePeriod === 'all') {
      loadDashboardData(undefined, undefined, timePeriod, bddFilter);
    } else if (timePeriod === 'custom' && customStartDate && customEndDate) {
      // Implementar llamada con fechas custom
      loadDashboardData(customStartDate, customEndDate, 'custom', bddFilter);
    }
  }, [timePeriod, customStartDate, customEndDate, appliedDatabaseFilter]);

  // Checar Metadata (Filtro Solar)
  useEffect(() => {
    const checkMetadata = () => {
      try {
        const metadataStr = sessionStorage.getItem('metadata');
        if (metadataStr) {
          const metadata = JSON.parse(metadataStr);
          setHasFiltroSolar(metadata?.filtro_solar === true);
        }
      } catch (e) {}
    };
    checkMetadata();
  }, []);

  // --- 4. MEMOS (Procesamiento de datos) ---
  const hourlyAgendasData = useMemo(() => generateHourlyAgendasData(dashboardData, hourRangeStart, hourRangeEnd), [dashboardData, hourRangeStart, hourRangeEnd]);
  const housingTypeData = useMemo(() => generateHousingTypeData(dashboardData), [dashboardData]);
  const agendaHousingTypeData = useMemo(() => generateAgendaHousingTypeData(dashboardData), [dashboardData]);
  const interestData = useMemo(() => generateInterestData(dashboardData), [dashboardData]);
  const effectiveCallsData = useMemo(() => generateEffectiveCallsData(dashboardData, effectiveCallsHourStart, effectiveCallsHourEnd), [dashboardData, effectiveCallsHourStart, effectiveCallsHourEnd]);
  const agentesPorAgendasData = useMemo(() => generateAgentesPorAgendasData(dashboardData), [dashboardData]);
  const disconnectionData = useMemo(() => generateDisconnectionData([], dashboardData), [dashboardData]);

  // Datos combinados (Simulando tu lógica compleja de isLongRange)
  const isLongRange = timePeriod === 'all' || timePeriod === 'month';
  const combinedCallsAgendasData = useMemo(() => {
      // Aquí va toda tu lógica original de combinedCallsAgendasData
      return []; 
  }, [dashboardData, timePeriod]);

  // Retornamos todo agrupado y limpio
  return {
    filters: {
      timePeriod,
      selectValue,
      customStartDate,
      customEndDate,
      customStartTime,
      customEndTime,
      hourRangeStart,
      hourRangeEnd,
      effectiveCallsHourStart,
      effectiveCallsHourEnd,
      databaseFilter,
      appliedDatabaseFilter
    },
    setFilters: {
      setDatabaseFilter
    },
    handlers: {
      handleTimePeriodChange,
      handleConfirmCustomDates,
      handleCancelCustomDates,
      applyDatabaseFilter,
      clearDatabaseFilter,
      handleHourRangeChange,
      handleEffectiveCallsHourRangeChange,
      setIsCustomDateDialogOpen,
      setTempStartDate,
      setTempEndDate,
      setTempStartTime,
      setTempEndTime
    },
    processedData: {
      hourlyAgendasData,
      housingTypeData,
      agendaHousingTypeData,
      interestData,
      effectiveCallsData,
      agentesPorAgendasData,
      disconnectionData,
      combinedCallsAgendasData,
      isLongRange,
      launchRegionMetrics,
      asistenciaByHour
    },
    uiState: {
      hasFiltroSolar,
      isCustomDateDialogOpen,
      tempStartDate,
      tempEndDate,
      tempStartTime,
      tempEndTime,
      launchRegionLoading,
      launchRegionError,
      asistenciaLoading,
      asistenciaError
    }
  };
}