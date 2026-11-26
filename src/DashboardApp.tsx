import React, { useEffect, useState, useRef, ChangeEvent, Suspense, lazy } from 'react';
import { calculateStats } from './api';
import type { RetellCall, CallStats, FilterCriteria } from './types';
import { Sidebar } from './components/layout/Sidebar';
// Páginas cargadas de forma diferida (code-splitting): cada una genera su
// propio chunk async y solo se descarga cuando el usuario la abre.
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const Recordings = lazy(() => import('./pages/Recordings').then((m) => ({ default: m.Recordings })));
const PhoneNumbers = lazy(() => import('./pages/PhoneNumbers').then((m) => ({ default: m.PhoneNumbers })));
const Agendas = lazy(() => import('./pages/Agendas').then((m) => ({ default: m.Agendas })));
const Callbacks = lazy(() => import('./pages/Callbacks').then((m) => ({ default: m.Callbacks })));
const Ventas = lazy(() => import('./pages/Ventas').then((m) => ({ default: m.Ventas })));
const Lanzamiento = lazy(() => import('./pages/Lanzamiento'));
const LanzamientoV2 = lazy(() => import('./pages/LanzamientoV2'));
const NoLlamar = lazy(() => import('./pages/NoLlamar'));
const Campaign = lazy(() => import('./pages/Campaign').then((m) => ({ default: m.Campaign })));
const Tickets = lazy(() => import('./pages/Tickets').then((m) => ({ default: m.Tickets })));
const Recoveries = lazy(() => import('./pages/Recoveries').then((m) => ({ default: m.Recoveries })));
const SoporteIA = lazy(() => import('./pages/SoporteIA').then((m) => ({ default: m.SoporteIA })));
const Seguimientos = lazy(() => import('./pages/Seguimientos').then((m) => ({ default: m.Seguimientos })));
const Interesados = lazy(() => import('./pages/Interesados').then((m) => ({ default: m.Interesados })));
const Presupuesto = lazy(() => import('./pages/Presupuesto').then((m) => ({ default: m.Presupuesto })));
const Agentes = lazy(() => import('./pages/Agentes').then((m) => ({ default: m.Agentes })));
const Configuracion = lazy(() => import('./pages/Configuracion').then((m) => ({ default: m.Configuracion })));
const Planes = lazy(() => import('./pages/Planes').then((m) => ({ default: m.Planes })));
import { useCallsContext } from './context/CallsContext';
import { toast } from 'sonner';
import {
  canAccessTickets,
  canAccessRecoveries,
  canAccessAssistantIA,
  canAccessHydro,
  canAccessBudget,
  canAccessSeguimientos,
  canAccessAgentes,
  canAccessLanzamientoV2,
  canAccessDashboard,
  isAdmin,
  isClientActive,
  getSubscriptionExpiry,
} from './lib/supabase';
import { X, Upload, Phone, Info, Check, RefreshCw, Trash2, AlertTriangle } from 'lucide-react';
import { useDashboardRoute, navigateDashboard } from './lib/dashboardRoute';

function DashboardApp() {
  // La URL es la fuente de verdad de la navegación (/dashboard/<page>[/<detailId>]).
  const { page: currentPage, detailId } = useDashboardRoute();
  // Navegar a una página equivale a cambiar la URL; el render se deriva de currentPage.
  const goToPage = React.useCallback((p: string) => navigateDashboard(p), []);
  const [calls, setCalls] = React.useState<RetellCall[]>([]);
  const [filteredCalls, setFilteredCalls] = React.useState<RetellCall[]>([]);
  const [stats, setStats] = React.useState<CallStats | null>(null);
  // El loading/error de las llamadas los maneja CallsContext (loadingAllCalls / contextError).
  // Antes había estados locales que solo los seteaba el cargador legacy ya eliminado.
  const [filterCriteria, setFilterCriteria] = React.useState<FilterCriteria>({});
  const [disconnectionReasons, setDisconnectionReasons] = React.useState<string[]>([]);
  
  // Obtenemos los datos del contexto compartido
  const { 
    allCalls, 
    loadingAllCalls, 
    loadAllCalls, 
    lastUpdated,
    disconnectionReasons: contextDisconnectionReasons,
    error: contextError,
    apiKey,
    phoneNumbers,
    loadingPhoneNumbers,
    phoneNumbersLoaded,
    noPhoneNumbersAvailable,
    loadPhoneNumbers,
    dashboardData,
    loadingDashboardData,
    loadDashboardData,
    agendaEnabled,
    salesEnabled,
    numTelEnabled,
    recordsEnabled,
    callbacksEnabled,
    launchEnabled,
    dontCallEnabled,
    campaignEnabled
  } = useCallsContext();
  
  // Cargar números de teléfono una sola vez al iniciar la aplicación
  React.useEffect(() => {
    // Solo cargamos si tenemos la API key
    if (apiKey) {
      loadPhoneNumbers();
    }
  }, [apiKey, loadPhoneNumbers]);
  
  // Redirigir si se intenta acceder a agendas cuando está deshabilitada
  React.useEffect(() => {
    if (currentPage === 'agendas' && !agendaEnabled) {
      // console.log('Agenda deshabilitada, redirigiendo al dashboard');
      navigateDashboard('dashboard', undefined, { replace: true });
    }
  }, [currentPage, agendaEnabled]);
  
  // Redirigir si se intenta acceder a lanzamiento sin permisos
  React.useEffect(() => {
    if (currentPage === 'lanzamiento' && !launchEnabled) {
      // console.log('Sin permisos de lanzamiento, redirigiendo al dashboard');
      navigateDashboard('dashboard', undefined, { replace: true });
    }
  }, [currentPage, launchEnabled]);
  
  // Redirigir si se intenta acceder a no-llamar sin permisos
  React.useEffect(() => {
    if (currentPage === 'no-llamar' && !dontCallEnabled) {
      // console.log('Sin permisos de no-llamar, redirigiendo al dashboard');
      navigateDashboard('dashboard', undefined, { replace: true });
    }
  }, [currentPage, dontCallEnabled]);

  // Redirigir si se intenta acceder a campaña sin permisos
  React.useEffect(() => {
    if (currentPage === 'campaign' && !campaignEnabled) {
      navigateDashboard('dashboard', undefined, { replace: true });
    }
  }, [currentPage, campaignEnabled]);
  React.useEffect(() => {
    if (currentPage === 'recordings' && !recordsEnabled) {
      navigateDashboard('dashboard', undefined, { replace: true });
    }
  }, [currentPage, recordsEnabled]);
  React.useEffect(() => {
    if (currentPage === 'phones' && !numTelEnabled) {
      navigateDashboard('dashboard', undefined, { replace: true });
    }
  }, [currentPage, numTelEnabled]);
  React.useEffect(() => {
    if (currentPage === 'callbacks' && !callbacksEnabled) {
      navigateDashboard('dashboard', undefined, { replace: true });
    }
  }, [currentPage, callbacksEnabled]);
  React.useEffect(() => {
    if (currentPage === 'ventas' && !salesEnabled) {
      navigateDashboard('dashboard', undefined, { replace: true });
    }
  }, [currentPage, salesEnabled]);

  // Tickets: visible solo si metadata.tickets === true (sessionStorage)
  // Banner para admin cuando el cliente seleccionado está suspendido
  const [showSuspendedBanner, setShowSuspendedBanner] = React.useState(
    () => isAdmin() && !isClientActive()
  )
  React.useEffect(() => {
    const handleClientChange = () => setShowSuspendedBanner(isAdmin() && !isClientActive())
    window.addEventListener('clientIdChanged', handleClientChange)
    return () => window.removeEventListener('clientIdChanged', handleClientChange)
  }, [])

  const [dashboardEnabled, setDashboardEnabled] = React.useState(() => canAccessDashboard());

  // Actualiza dashboardEnabled cuando las permissions se cargan desde el servidor
  React.useEffect(() => {
    const update = () => setDashboardEnabled(canAccessDashboard());
    window.addEventListener('permissionsUpdated', update);
    return () => window.removeEventListener('permissionsUpdated', update);
  }, []);

  const [ticketsEnabled, setTicketsEnabled] = React.useState(() => canAccessTickets());
  const [recoveriesEnabled, setRecoveriesEnabled] = React.useState(() => canAccessRecoveries());
  const [assistantIAEnabled, setAssistantIAEnabled] = React.useState(() =>
    canAccessAssistantIA(),
  );
  const [hydroEnabled, setHydroEnabled] = React.useState(() => canAccessHydro());
  const [budgetEnabled, setBudgetEnabled] = React.useState(() => canAccessBudget());
  const [seguimientosEnabled, setSeguimientosEnabled] = React.useState(() => canAccessSeguimientos());
  const [agentesEnabled, setAgentesEnabled] = React.useState(() => canAccessAgentes());
  const [lanzamientoV2Enabled, setLanzamientoV2Enabled] = React.useState(() => canAccessLanzamientoV2());
  React.useEffect(() => {
    const update = () => {
      setTicketsEnabled(canAccessTickets());
      setRecoveriesEnabled(canAccessRecoveries());
      setAssistantIAEnabled(canAccessAssistantIA());
      setHydroEnabled(canAccessHydro());
      setBudgetEnabled(canAccessBudget());
      setSeguimientosEnabled(canAccessSeguimientos());
      setAgentesEnabled(canAccessAgentes());
      setLanzamientoV2Enabled(canAccessLanzamientoV2());
    };
    update();
    window.addEventListener('metadataUpdated', update);
    return () => window.removeEventListener('metadataUpdated', update);
  }, []);
  React.useEffect(() => {
    if (currentPage === 'tickets' && !ticketsEnabled) {
      navigateDashboard('dashboard', undefined, { replace: true });
    }
  }, [currentPage, ticketsEnabled]);
  React.useEffect(() => {
    if (currentPage === 'recoveries' && !recoveriesEnabled) {
      navigateDashboard('dashboard', undefined, { replace: true });
    }
  }, [currentPage, recoveriesEnabled]);
  React.useEffect(() => {
    if (currentPage === 'lanzamiento-v2' && !lanzamientoV2Enabled) {
      navigateDashboard('dashboard', undefined, { replace: true });
    }
  }, [currentPage, lanzamientoV2Enabled]);
  React.useEffect(() => {
    if (currentPage === 'interesados' && !hydroEnabled) {
      navigateDashboard('dashboard', undefined, { replace: true });
    }
  }, [currentPage, hydroEnabled]);
  React.useEffect(() => {
    if (currentPage === 'soporte-ia' && !assistantIAEnabled) {
      navigateDashboard('dashboard', undefined, { replace: true });
    }
  }, [currentPage, assistantIAEnabled]);
  React.useEffect(() => {
    if (currentPage === 'presupuesto' && !budgetEnabled) {
      navigateDashboard('dashboard', undefined, { replace: true });
    }
  }, [currentPage, budgetEnabled]);
  React.useEffect(() => {
    if (currentPage === 'seguimientos' && !seguimientosEnabled) {
      navigateDashboard('dashboard', undefined, { replace: true });
    }
  }, [currentPage, seguimientosEnabled]);
  React.useEffect(() => {
    if (currentPage === 'agentes' && !agentesEnabled) {
      navigateDashboard('dashboard', undefined, { replace: true });
    }
  }, [currentPage, agentesEnabled]);
  
  // Calculamos si la caché está activa
  const cacheStatus = lastUpdated 
    ? `Caché activa (${new Date(lastUpdated).toLocaleTimeString()})` 
    : 'Sin datos en caché';

  const loadCalls = React.useCallback(async () => {
    // Preferimos usar los datos de contexto en lugar de hacer nuevas peticiones
    if (allCalls.length > 0) {
      // console.log('Usando datos del contexto compartido');
      setCalls(allCalls);
      setFilteredCalls(allCalls);
      setStats(calculateStats(allCalls));
      setDisconnectionReasons(contextDisconnectionReasons);
      return;
    }
    
    // Si no hay datos en el contexto, los cargamos a través del contexto.
    // Cuando lleguen, este mismo callback vuelve a correr (allCalls está en las deps)
    // y toma la rama de arriba.
    if (!loadingAllCalls) {
      loadAllCalls();
    }
  }, [allCalls, contextDisconnectionReasons, loadAllCalls, loadingAllCalls]);

  const loadAllCallsFromApi = React.useCallback(async () => {
    // Usamos la función de cargar todas las llamadas del contexto en lugar de hacer peticiones duplicadas
    loadAllCalls(true);
  }, [loadAllCalls]);

  React.useEffect(() => {
    loadCalls();
  }, [loadCalls]);

  // Cuando los datos del contexto cambien, actualizamos nuestro estado local
  React.useEffect(() => {
    if (allCalls && allCalls.length > 0) {
      // Asegurarnos de que estamos trabajando con un array
      const callsArray = Array.isArray(allCalls) ? allCalls : [];
      setCalls(callsArray);
      setFilteredCalls(callsArray);
      setStats(calculateStats(callsArray));
      
      // Si contextDisconnectionReasons es un array, usarlo directamente
      if (Array.isArray(contextDisconnectionReasons)) {
        setDisconnectionReasons(contextDisconnectionReasons);
      }
    }
  }, [allCalls, contextDisconnectionReasons]);

  const handleFilterChange = React.useCallback((newCriteria: FilterCriteria) => {
    setFilterCriteria(newCriteria);
    
    let result = [...calls];
    
    // Filter by disconnection reason
    if (newCriteria.disconnection_reason) {
      result = result.filter(call => 
        call.disconnection_reason === newCriteria.disconnection_reason
      );
    }
    
    // Filter by duration range
    if (newCriteria.duration_range) {
      if (newCriteria.duration_range.min !== undefined) {
        result = result.filter(call => 
          (call.duration || 0) >= (newCriteria.duration_range?.min || 0)
        );
      }
      if (newCriteria.duration_range.max !== undefined) {
        result = result.filter(call => 
          (call.duration || 0) <= (newCriteria.duration_range?.max || Infinity)
        );
      }
    }
    
    // Filter by date range
    if (newCriteria.date_range) {
      if (newCriteria.date_range.start) {
        const startDate = new Date(newCriteria.date_range.start);
        result = result.filter(call => 
          call.start_time ? new Date(call.start_time) >= startDate : false
        );
      }
      if (newCriteria.date_range.end) {
        const endDate = new Date(newCriteria.date_range.end);
        result = result.filter(call => 
          call.start_time ? new Date(call.start_time) <= endDate : false
        );
      }
    }
    
    setFilteredCalls(result);
  }, [calls]);

  // Función adaptadora para Dashboard que espera (key, value)
  const handleFilterChangeForDashboard = React.useCallback((key: keyof FilterCriteria, value: any) => {
    const newCriteria = { ...filterCriteria, [key]: value };
    handleFilterChange(newCriteria);
  }, [filterCriteria, handleFilterChange]);


  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar 
        currentPage={currentPage} 
        onPageChange={goToPage}
        cacheStatus={cacheStatus}
        isLoading={loadingAllCalls}
      />

      <div className="md:ml-64 p-4 md:p-8 transition-all">
        {showSuspendedBanner && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
            <span>
              Este cliente está <strong>suspendido</strong>
              {getSubscriptionExpiry()
                ? ` — venció el ${new Date(getSubscriptionExpiry()!).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}`
                : ''}
              . Los usuarios sin rol admin no pueden acceder.
            </span>
          </div>
        )}
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-24">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#05163b]" />
            </div>
          }
        >
        {currentPage === 'dashboard' && !dashboardEnabled && (
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground text-lg">
              No tienes acceso al Dashboard.
            </p>
          </div>
        )}
        {currentPage === 'dashboard' && dashboardEnabled && (
          <Dashboard
            stats={stats || { total: 0, completed: 0, failed: 0, averageDuration: '0:00', averageDurationSeconds: 0 }}
            loading={loadingAllCalls || loadingDashboardData}
            error={contextError}
            onReload={() => loadAllCalls(true)}
            filterCriteria={filterCriteria}
            onFilterChange={handleFilterChangeForDashboard}
            disconnectionReasons={disconnectionReasons}
            totalCalls={calls.length}
            filteredCallsCount={filteredCalls.length}
            dashboardData={dashboardData}
            loadDashboardData={loadDashboardData}
            agendaEnabled={agendaEnabled}
            launchEnabled={launchEnabled}
          />
        )}
        {currentPage === 'recordings' && recordsEnabled && (
          <Recordings
            onNavigate={goToPage}
          />
        )}
        {currentPage === 'phones' && numTelEnabled && (
          <PhoneNumbers
            onNavigate={goToPage}
          />
        )}
        {currentPage === 'agendas' && agendaEnabled && (
          <Agendas
            onNavigate={goToPage}
          />
        )}
        {currentPage === 'callbacks' && callbacksEnabled && (
          <Callbacks
            onNavigate={goToPage}
          />
        )}
        {currentPage === 'ventas' && salesEnabled && (
          <Ventas onNavigate={goToPage} />
        )}
        {currentPage === 'lanzamiento' && launchEnabled && (
          <Lanzamiento />
        )}
        {currentPage === 'lanzamiento-v2' && lanzamientoV2Enabled && (
          <LanzamientoV2 />
        )}
        {currentPage === 'no-llamar' && dontCallEnabled && (
          <NoLlamar />
        )}
        {currentPage === 'tickets' && ticketsEnabled && (
          <Tickets onNavigate={goToPage} />
        )}
        {currentPage === 'recoveries' && recoveriesEnabled && (
          <Recoveries onNavigate={goToPage} />
        )}
        {currentPage === 'interesados' && hydroEnabled && (
          <Interesados onNavigate={goToPage} />
        )}
        {currentPage === 'campaign' && campaignEnabled && (
          <Campaign onNavigate={goToPage} />
        )}
        {currentPage === 'soporte-ia' && !assistantIAEnabled && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-6 text-center text-amber-900 text-sm max-w-md">
            Comprobando acceso a Soporte IA… Si no tienes permiso, volverás al
            dashboard en un momento.
          </div>
        )}
        {currentPage === 'soporte-ia' && assistantIAEnabled && (
          <SoporteIA onNavigate={goToPage} />
        )}
        {currentPage === 'presupuesto' && budgetEnabled && (
          <Presupuesto onNavigate={goToPage} />
        )}
        {currentPage === 'seguimientos' && seguimientosEnabled && (
          <Seguimientos onNavigate={goToPage} />
        )}
        {currentPage === 'agentes' && agentesEnabled && (
          <Agentes onNavigate={goToPage} />
        )}
        {currentPage === 'configuracion' && (
          <Configuracion />
        )}
        {currentPage === 'planes' && (
          <Planes />
        )}
        </Suspense>
      </div>
    </div>
  );
}

export default DashboardApp;