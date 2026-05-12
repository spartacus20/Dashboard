

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { RetellCall, FilterCriteria, RetellPhoneNumber, RetellBatchCall } from '../types';
import { fetchPhoneNumbers, fetchBatchCalls, listCalls, getClientApiKey, getDashboardData, getDashboardToday, getDashboardWeek, getDashboardMonth, getDisconnectionReasons } from '../api';
import { get_client_id, supabase, getClientId as fetchAndStoreClientId } from '../lib/supabase';

interface CallsContextType {
  allCalls: RetellCall[];
  loadingAllCalls: boolean;
  loadingProgress: number;
  error: string | null;
  totalCalls: number;
  loadAllCalls: (forceRefresh?: boolean, customFilterCriteria?: FilterCriteria) => Promise<void>;
  loadCallsPage: (page: number, filterCriteria?: FilterCriteria) => Promise<RetellCall[]>;
  disconnectionReasons: string[];
  allCallsLoaded: boolean;
  lastUpdated: number | null;
  apiKey: string | null;
  apiKeyTest: string[] | null;
  clientId: string | null;
  setApiKey: (key: string) => void;
  phoneNumbers: RetellPhoneNumber[];
  loadingPhoneNumbers: boolean;
  phoneNumbersLoaded: boolean;
  noPhoneNumbersAvailable: boolean;
  loadPhoneNumbers: (forceRefresh?: boolean) => Promise<void>;
  batchCalls: RetellBatchCall[];
  loadingBatchCalls: boolean;
  batchCallsLoaded: boolean;
  noBatchCallsAvailable: boolean;
  loadBatchCalls: (forceRefresh?: boolean) => Promise<void>;
  refreshBatchCalls: () => Promise<void>;
  currentPage: number;
  totalPages: number;
  hasMorePages: boolean;
  setFilterCriteria: (criteria: FilterCriteria) => void;
  filterCriteria: FilterCriteria;
  dashboardData: any;
  loadingDashboardData: boolean;
  loadDashboardData: (fechaInicio?: string, fechaFin?: string, timePeriod?: string, bdd?: string, cliente?: string) => Promise<void>;
  totalCallsFiltered: number | null;
  agendaEnabled: boolean;
  callsEnabled: boolean;
  salesEnabled: boolean;
  numTelEnabled: boolean;
  recordsEnabled: boolean;
  callbacksEnabled: boolean;
  launchEnabled: boolean;
  dontCallEnabled: boolean;
  campaignEnabled: boolean;
  phoneFilter: string | null;
}

const CallsContext = createContext<CallsContextType | undefined>(undefined);

export function useCallsContext() {
  const context = useContext(CallsContext);
  if (context === undefined) {
    throw new Error('useCallsContext debe ser usado dentro de un CallsProvider');
  }
  return context;
}

interface CallsProviderProps {
  children: React.ReactNode;
}

export function CallsProvider({ children }: CallsProviderProps) {
  const [allCalls, setAllCalls] = useState<RetellCall[]>([]);
  const [loadingAllCalls, setLoadingAllCalls] = useState(false);
  const [loadingProgress] = useState(0); // setLoadingProgress reservado para uso futuro
  const [error, setError] = useState<string | null>(null);
  const [totalCalls, setTotalCalls] = useState(0);
  const [disconnectionReasons, setDisconnectionReasons] = useState<string[]>([]);
  const [allCallsLoaded, setAllCallsLoaded] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [apiKeyTest, setApiKeyTest] = useState<string[] | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  
  // Estado para el total de llamadas filtrado
  const [totalCallsFiltered, setTotalCallsFiltered] = useState<number | null>(null);
  
  // Estados de paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [hasMorePages, setHasMorePages] = useState(true);
  const loadedPages = useRef<Set<number>>(new Set());
  const loadingPages = useRef<Set<number>>(new Set()); // Nueva protección contra cargas concurrentes
  
  // Estado para los filtros
  const [filterCriteria, setFilterCriteria] = useState<FilterCriteria>({});
  
  // Ref para controlar que el fetch inicial del dashboard solo ocurra una vez por cliente
  const dashboardInitialFetchDone = useRef(false);

  // Estado para los datos del dashboard — se inicializa con la caché stale del localStorage
  // para mostrar datos instantáneamente mientras se carga la versión fresca en background
  const [dashboardData, setDashboardData] = useState<any>(() => {
    try {
      const storedClientId = localStorage.getItem(get_client_id);
      if (storedClientId) {
        const raw = localStorage.getItem(`dash_stale_${storedClientId}`);
        return raw ? JSON.parse(raw) : null;
      }
    } catch {}
    return null;
  });
  const [loadingDashboardData, setLoadingDashboardData] = useState(false);
  
  // Estado para controlar la visibilidad de agenda
  const [agendaEnabled, setAgendaEnabled] = useState(true);
  
  // Estado para controlar la visibilidad de llamadas
  const [callsEnabled, setCallsEnabled] = useState(true);
  
  // Estado para controlar la visibilidad de ventas
  const [salesEnabled, setSalesEnabled] = useState(false);
  
  // Estados para controlar la visibilidad de otras secciones
  const [numTelEnabled, setNumTelEnabled] = useState(false);
  const [recordsEnabled, setRecordsEnabled] = useState(false);
  const [callbacksEnabled, setCallbacksEnabled] = useState(false);
  const [launchEnabled, setLaunchEnabled] = useState(false);
  const [dontCallEnabled, setDontCallEnabled] = useState(false);
  const [campaignEnabled, setCampaignEnabled] = useState(false);
  
  // Estado para filtrar por número de teléfono específico
  const [phoneFilter, setPhoneFilter] = useState<string | null>(null);
  
  // Estado para los números de teléfono
  const [phoneNumbers, setPhoneNumbers] = useState<RetellPhoneNumber[]>([]);
  const [loadingPhoneNumbers, setLoadingPhoneNumbers] = useState(false);
  const [phoneNumbersLoaded, setPhoneNumbersLoaded] = useState(false);
  const [phoneNumbersUpdated, setPhoneNumbersUpdated] = useState<number | null>(null);
  const [noPhoneNumbersAvailable, setNoPhoneNumbersAvailable] = useState(false);
  
  // Estado para batch calls
  const [batchCalls, setBatchCalls] = useState<RetellBatchCall[]>([]);
  const [loadingBatchCalls, setLoadingBatchCalls] = useState(false);
  const [batchCallsLoaded, setBatchCallsLoaded] = useState(false);
  const [batchCallsUpdated, setBatchCallsUpdated] = useState<number | null>(null);
  const [noBatchCallsAvailable, setNoBatchCallsAvailable] = useState(false);
  const batchCallsAttemptCount = useRef(0);
  
  // Tiempo de caducidad de la caché en milisegundos (15 minutos)
  const CACHE_EXPIRY_TIME = 15 * 60 * 1000;
  
  // Función para obtener parámetros necesarios (client_id del localStorage y phone de URL)
  const getParamsFromUrl = useCallback(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const clientId = localStorage.getItem(get_client_id); // Usar localStorage en lugar de URL
    const phone = urlParams.get('phone');
    return { clientId, phone };
  }, []);
  
  // Obtener la API key y configuración cuando se monta el componente
  useEffect(() => {
    const fetchApiKey = async () => {
      const { clientId: storedClientId } = getParamsFromUrl();

      if (storedClientId) {
        // console.log('Client ID obtenido del localStorage:', storedClientId);
        setClientId(storedClientId);

        try {
          const result = await getClientApiKey(storedClientId);
          if (result.apiKey || result.apiKeyTest) {
            // console.log('API key obtenida exitosamente para client_id:', storedClientId);
            // Usar apiKeyTest si está disponible, sino usar apiKey
            if (result.apiKeyTest && result.apiKeyTest.length > 0) {
              // console.log(`📞 Usando ${result.apiKeyTest.length} API keys de api_key_test`);
              setApiKeyTest(result.apiKeyTest);
              // Establecer la primera API key en apiKey para compatibilidad con funciones que necesitan API key individual
              const firstApiKey = result.apiKeyTest[0];
              setApiKey(firstApiKey);
              sessionStorage.setItem('apiKeyTest', JSON.stringify(result.apiKeyTest));
              sessionStorage.setItem('apiKey', firstApiKey); // Guardar primera para compatibilidad
            } else if (result.apiKey) {
              setApiKey(result.apiKey);
              sessionStorage.setItem('apiKey', result.apiKey);
              sessionStorage.removeItem('apiKeyTest'); // Limpiar apiKeyTest si usamos apiKey individual
              setApiKeyTest(null); // Limpiar apiKeyTest si usamos apiKey individual
            }
            
            // Procesar configuración del cliente
            if (result.config) {
              // console.log('🔍 Configuración del cliente:', result.config);
              // console.log('🔍 Sales desde config:', result.config.sales);
              setAgendaEnabled(result.config.agenda ?? true);
              setCallsEnabled(result.config.calls_enabled ?? true);
              setSalesEnabled(result.config.sales ?? false);
              setNumTelEnabled(result.config.num_tel ?? false);
              setRecordsEnabled(result.config.records ?? false);
              setCallbacksEnabled(result.config.callbacks ?? false);
              setLaunchEnabled(result.config.launch ?? false);
              setDontCallEnabled(result.config.dont_call ?? false);
              setCampaignEnabled(result.config.campaign ?? false);
            }
          } else {
            // console.error('No se pudo obtener la API key para el client_id:', storedClientId);
            setError('No se pudo obtener la configuración para el client_id proporcionado');
          }
        } catch (err) {
          // console.error('Error al obtener API key/configuración:', err);
          setError('Error al obtener la configuración del cliente');
        }
      } else {
        // Si no hay client_id en localStorage, intentar obtenerlo con el email del usuario
        try {
          const { data: { user } } = await supabase.auth.getUser();
          const email = user?.email;
          if (email) {
            // console.log('Intentando obtener client_id con email porque no está en localStorage:', email);
            const newClientId = await fetchAndStoreClientId(email);
            if (newClientId) {
              // console.log('Client ID obtenido y guardado en localStorage:', newClientId);
              setClientId(newClientId);
              try {
                const result = await getClientApiKey(newClientId);
                if (result.apiKey || result.apiKeyTest) {
                  // console.log('API key obtenida exitosamente para client_id:', newClientId);
                  // Usar apiKeyTest si está disponible, sino usar apiKey
                  if (result.apiKeyTest && result.apiKeyTest.length > 0) {
                    // console.log(`📞 Usando ${result.apiKeyTest.length} API keys de api_key_test`);
                    setApiKeyTest(result.apiKeyTest);
                    // Establecer la primera API key en apiKey para compatibilidad con funciones que necesitan API key individual
                    const firstApiKey = result.apiKeyTest[0];
                    setApiKey(firstApiKey);
                    sessionStorage.setItem('apiKeyTest', JSON.stringify(result.apiKeyTest));
                    sessionStorage.setItem('apiKey', firstApiKey); // Guardar primera para compatibilidad
                  } else if (result.apiKey) {
                    setApiKey(result.apiKey);
                    sessionStorage.setItem('apiKey', result.apiKey);
                    sessionStorage.removeItem('apiKeyTest'); // Limpiar apiKeyTest si usamos apiKey individual
                    setApiKeyTest(null); // Limpiar apiKeyTest si usamos apiKey individual
                  }
                  
                  // Procesar configuración del cliente
                  if (result.config) {
                    setAgendaEnabled(result.config.agenda ?? true);
                    setCallsEnabled(result.config.calls_enabled ?? true);
                    setSalesEnabled(result.config.sales ?? false);
                    setNumTelEnabled(result.config.num_tel ?? false);
                    setRecordsEnabled(result.config.records ?? false);
                    setCallbacksEnabled(result.config.callbacks ?? false);
                    setLaunchEnabled(result.config.launch ?? false);
                    setDontCallEnabled(result.config.dont_call ?? false);
                    setCampaignEnabled(result.config.campaign ?? false);
                  }
                } else {
                  // console.error('No se pudo obtener la API key para el client_id:', newClientId);
                  setError('No se pudo obtener la configuración para el client_id proporcionado');
                }
              } catch (err) {
                // console.error('Error al obtener API key/configuración con el nuevo client_id:', err);
                setError('Error al obtener la configuración del cliente');
              }
            } else {
              // console.error('No se pudo resolver el client_id a partir del email');
              setError('No se encontró client_id. Por favor, inicia sesión nuevamente.');
            }
          } else {
            // No hay sesión aún; no marcar error para no confundir al usuario antes de iniciar sesión
            // console.log('Sin email aún: esperando evento de autenticación para resolver client_id');
            return;
          }
        } catch (e) {
          // console.error('Error intentando resolver client_id usando el email:', e);
          setError('Error obteniendo client_id. Por favor, inicia sesión nuevamente.');
        }
      }
    };

    fetchApiKey();
  }, [getParamsFromUrl]);

  // Suscribirse a cambios de autenticación para resolver client_id y apiKey inmediatamente al iniciar sesión
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN') {
        const email = session?.user?.email || undefined;
        if (!email) {
          // console.log('Evento SIGNED_IN sin email, omitiendo resolución de client_id');
          return;
        }

        try {
          // console.log('SIGNED_IN: resolviendo client_id para', email);
          const newClientId = await fetchAndStoreClientId(email);
          if (newClientId) {
            setClientId(newClientId);
            try {
              const result = await getClientApiKey(newClientId);
              if (result.apiKey || result.apiKeyTest) {
                // Usar apiKeyTest si está disponible, sino usar apiKey
                if (result.apiKeyTest && result.apiKeyTest.length > 0) {
                  // console.log(`📞 Usando ${result.apiKeyTest.length} API keys de api_key_test tras inicio de sesión`);
                  setApiKeyTest(result.apiKeyTest);
                  // Establecer la primera API key en apiKey para compatibilidad con funciones que necesitan API key individual
                  const firstApiKey = result.apiKeyTest[0];
                  setApiKey(firstApiKey);
                  sessionStorage.setItem('apiKeyTest', JSON.stringify(result.apiKeyTest));
                  sessionStorage.setItem('apiKey', firstApiKey); // Guardar primera para compatibilidad
                } else if (result.apiKey) {
                  setApiKey(result.apiKey);
                  sessionStorage.setItem('apiKey', result.apiKey);
                  sessionStorage.removeItem('apiKeyTest'); // Limpiar apiKeyTest si usamos apiKey individual
                  setApiKeyTest(null); // Limpiar apiKeyTest si usamos apiKey individual
                }
                // console.log('API key establecida tras inicio de sesión');
                
                // Procesar configuración del cliente
                if (result.config) {
                  setAgendaEnabled(result.config.agenda ?? true);
                  setCallsEnabled(result.config.calls_enabled ?? true);
                  setSalesEnabled(result.config.sales ?? false);
                  setNumTelEnabled(result.config.num_tel ?? false);
                  setRecordsEnabled(result.config.records ?? false);
                  setCallbacksEnabled(result.config.callbacks ?? false);
                  setLaunchEnabled(result.config.launch ?? false);
                  setDontCallEnabled(result.config.dont_call ?? false);
                  setCampaignEnabled(result.config.campaign ?? false);
                }
              } else {
                // console.error('No se pudo obtener API key tras inicio de sesión');
                setError('No se pudo obtener la configuración del cliente tras iniciar sesión');
              }
            } catch (e) {
              // console.error('Error obteniendo API key tras inicio de sesión:', e);
              setError('Error al obtener configuración tras iniciar sesión');
            }
          } else {
            // console.error('No se pudo obtener client_id tras inicio de sesión');
            setError('No se pudo resolver client_id tras iniciar sesión');
          }
        } catch (e) {
          // console.error('Error resolviendo client_id tras SIGNED_IN:', e);
          setError('Error resolviendo client_id tras iniciar sesión');
        }
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  // Escuchar cambios de client_id desde el selector
  useEffect(() => {
    const handleClientIdChanged = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const { clientId: newClientId, apiKey: newApiKey, apiKeyTest: newApiKeyTest, config } = customEvent.detail;
      
      // console.log('🔄 CallsContext: client_id cambiado a', newClientId);
      
      // Actualizar estados
      setClientId(newClientId);
      // Usar apiKeyTest si está disponible, sino usar apiKey
      if (newApiKeyTest && newApiKeyTest.length > 0) {
        // console.log(`📞 CallsContext: Usando ${newApiKeyTest.length} API keys de api_key_test`);
        setApiKeyTest(newApiKeyTest);
        // Establecer la primera API key en apiKey para compatibilidad con funciones que necesitan API key individual
        const firstApiKey = newApiKeyTest[0];
        setApiKey(firstApiKey);
        sessionStorage.setItem('apiKeyTest', JSON.stringify(newApiKeyTest));
        sessionStorage.setItem('apiKey', firstApiKey); // Guardar primera para compatibilidad
      } else if (newApiKey) {
        setApiKey(newApiKey);
        sessionStorage.setItem('apiKey', newApiKey);
        sessionStorage.removeItem('apiKeyTest'); // Limpiar apiKeyTest si usamos apiKey individual
        setApiKeyTest(null); // Limpiar apiKeyTest si usamos apiKey individual
      }
      
      // Actualizar configuración si está disponible
      if (config) {
        setAgendaEnabled(config.agenda ?? true);
        setCallsEnabled(config.calls_enabled ?? true);
        setSalesEnabled(config.sales ?? false);
        setNumTelEnabled(config.num_tel ?? false);
        setRecordsEnabled(config.records ?? false);
        setCallbacksEnabled(config.callbacks ?? false);
        setLaunchEnabled(config.launch ?? false);
        setDontCallEnabled(config.dont_call ?? false);
        setCampaignEnabled(config.campaign ?? false);
      }
      
      // Limpiar datos anteriores y restaurar stale cache del nuevo cliente
      setAllCalls([]);
      // Restaurar stale data del nuevo cliente para mostrar instantáneamente mientras carga
      try {
        const raw = localStorage.getItem(`dash_stale_${newClientId}`);
        setDashboardData(raw ? JSON.parse(raw) : null);
      } catch {
        setDashboardData(null);
      }
      dashboardInitialFetchDone.current = false;
      setPhoneNumbers([]);
      setBatchCalls([]);
      setAllCallsLoaded(false);
      setPhoneNumbersLoaded(false);
      setBatchCallsLoaded(false);
      loadedPages.current.clear();
      loadingPages.current.clear();
      setCurrentPage(1);
      setTotalPages(0);
      setHasMorePages(true);
      setError(null);
      
      // console.log('✅ CallsContext: Estados limpiados, recargando datos...');
      
      // Recargar todos los datos con el nuevo client_id
      // Usar un pequeño delay para asegurar que los estados se hayan actualizado
      setTimeout(async () => {
        if (!newApiKey || !newClientId) {
          // console.warn('⚠️ CallsContext: No se pueden recargar datos sin apiKey o clientId');
          return;
        }
        
        try {
          // console.log('🔄 CallsContext: Iniciando recarga de datos con nuevo client_id:', newClientId);
          
          // Recargar todos los datos en paralelo usando los valores del evento
          // Las funciones usarán los estados actualizados (clientId y apiKey) que acabamos de setear
          await Promise.all([
            loadAllCalls(true), // Forzar refresh
            loadDashboardData(undefined, undefined, 'today'), // Recargar dashboard
            loadPhoneNumbers(true), // Forzar refresh
            loadBatchCalls(true) // Forzar refresh
          ]);
          
          // console.log('✅ CallsContext: Todos los datos recargados exitosamente');
        } catch (refreshError) {
          // console.error('⚠️ CallsContext: Error al recargar algunos datos:', refreshError);
        }
      }, 150); // Aumentar ligeramente el delay para asegurar que los estados se actualicen
    };
    
    window.addEventListener('clientIdChanged', handleClientIdChanged);
    
    return () => {
      window.removeEventListener('clientIdChanged', handleClientIdChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // No incluir las funciones en las dependencias para evitar recrear el listener

  // Función para cargar una página específica de llamadas
  const loadCallsPage = useCallback(async (page: number, filterCriteria?: FilterCriteria): Promise<RetellCall[]> => {
    if (!apiKey) {
      // console.log('Esperando API key para cargar llamadas...');
      return [];
    }
    if (!clientId) {
      // console.log('Esperando client_id para cargar llamadas...');
      return [];
    }
    
    // Si ya cargamos esta página, no volver a cargarla
    if (loadedPages.current.has(page)) {
      // console.log(`Página ${page} ya está cargada`);
      return [];
    }
    
    // Si ya estamos cargando esta página, no cargar de nuevo
    if (loadingPages.current.has(page)) {
      // console.log(`Página ${page} ya se está cargando`);
      return [];
    }
    
    try {
      // Marcar que estamos cargando esta página
      loadingPages.current.add(page);
      setLoadingAllCalls(true);
      // console.log(`Cargando página ${page} de llamadas`);
      
      // Usar list-calls con client_id obligatorio contra api.iacreatorhub.com
      const params: any = {
        client_id: clientId,
        page,
        per_page: 100,
        sort_order: 'DESC'
      };
      if (filterCriteria?.date_range) {
        if (filterCriteria.date_range.start) params.fecha_inicio = filterCriteria.date_range.start;
        if (filterCriteria.date_range.end) params.fecha_fin = filterCriteria.date_range.end;
      }
      const response = await listCalls(apiKey, params);
      const newCalls = response.calls;
      
      // Si es la primera página, obtener información de paginación
      if (page === 1 && response.total_pages) {
        setTotalPages(response.total_pages);
        setHasMorePages(response.total_pages > 1);
        // console.log(`Total de páginas disponibles: ${response.total_pages}`);
      }
      
      // Extraer el total de llamadas filtrado si está disponible
      if (response.total_calls !== undefined && response.total_calls !== null) {
        setTotalCallsFiltered(response.total_calls);
        // console.log(`Total de llamadas filtrado: ${response.total_calls}`);
      }
      
      // console.log(`Página ${page}: ${newCalls.length} llamadas cargadas`);
      
      // Marcar la página como cargada
      loadedPages.current.add(page);
      
      // Verificar si las llamadas ya existen para evitar duplicados
      setAllCalls(prevCalls => {
        // Filtrar llamadas que ya existen
        const existingCallIds = new Set(prevCalls.map(call => call.call_id));
        const uniqueNewCalls = newCalls.filter(call => !existingCallIds.has(call.call_id));
        
        if (uniqueNewCalls.length < newCalls.length) {
          // console.log(`Filtradas ${newCalls.length - uniqueNewCalls.length} llamadas duplicadas`);
        }
        
        const updatedCalls = [...prevCalls, ...uniqueNewCalls];
        
        // Actualizar estadísticas
        setTotalCalls(updatedCalls.length);
        
        // No actualizar disconnectionReasons aquí, se cargarán desde el endpoint
        // para obtener TODOS los motivos disponibles, no solo los de las llamadas cargadas
        
        return updatedCalls;
      });
      
      setCurrentPage(page);
      setLastUpdated(Date.now());
      
      // Limpiar error si la carga fue exitosa (especialmente en la primera página)
      // Incluso si no hay llamadas, si la petición fue exitosa, no hay error
      if (page === 1) {
        setError(null);
      }
      
      return newCalls;
    } catch (err) {
      // console.error(`Error cargando página ${page}:`, err);
      setError(`Error al cargar página ${page}: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    } finally {
      // Remover de las páginas en proceso de carga
      loadingPages.current.delete(page);
      setLoadingAllCalls(false);
    }
  }, [apiKey, clientId, filterCriteria]);

  // Función para cargar la primera página de llamadas
  const loadAllCalls = useCallback(async (forceRefresh = false, customFilterCriteria?: FilterCriteria) => {
    // Si ya tenemos datos y no ha caducado la caché, no hacemos nada (a menos que sea forzado)
    const now = Date.now();
    if (
      !forceRefresh && 
      allCalls.length > 0 && 
      lastUpdated && 
      now - lastUpdated < CACHE_EXPIRY_TIME
    ) {
      // console.log('Usando datos en caché');
      return;
    }
    
    // Esperar a que tengamos la API key
    if (!apiKey) {
      // console.log('Esperando API key para cargar llamadas...');
      return;
    }
    
    // Limpiar estados previos si es una carga forzada
    if (forceRefresh) {
      setAllCalls([]);
      setError(null);
      setTotalCallsFiltered(null); // Resetear el total filtrado
      loadedPages.current.clear();
      loadingPages.current.clear(); // Limpiar también las páginas en proceso
      setCurrentPage(1);
      setTotalPages(0);
      setHasMorePages(true);
    }
    
    // Cargar solo la primera página con los filtros actuales
    await loadCallsPage(1, customFilterCriteria || filterCriteria);
  }, [apiKey, allCalls.length, lastUpdated, loadCallsPage]);

  // Función para cargar las batch calls
  const loadBatchCalls = useCallback(async (forceRefresh = false) => {
    // Si ya sabemos que no hay batch calls disponibles, no seguir intentando
    if (noBatchCallsAvailable && !forceRefresh) {
      // console.log('No hay batch calls disponibles (ya verificado)');
      return;
    }
    
    // Esperar a que tengamos la API key
    if (!apiKey) {
      // console.log('Esperando API key para cargar batch calls...');
      return;
    }
    
    // Limitar número de intentos si falla repetidamente (máximo 3 intentos)
    if (batchCallsAttemptCount.current >= 3 && !forceRefresh) {
      // console.log(`Se alcanzó el límite de intentos de carga de batch calls (${batchCallsAttemptCount.current})`);
      return;
    }
    
    // Verificar si ya tenemos datos en caché y no ha expirado
    const now = Date.now();
    if (
      !forceRefresh && 
      batchCallsLoaded &&
      batchCallsUpdated && 
      now - batchCallsUpdated < CACHE_EXPIRY_TIME
    ) {
      // console.log('Usando batch calls en caché');
      return;
    }
    
    // Evitar múltiples peticiones simultáneas
    if (loadingBatchCalls) {
      // console.log('Ya se está cargando los batch calls');
      return;
    }
    
    setLoadingBatchCalls(true);
    batchCallsAttemptCount.current++;
    
    try {
      // console.log(`Cargando batch calls desde la API (intento ${batchCallsAttemptCount.current})`);
      const data = await fetchBatchCalls(apiKey);
      
      setBatchCalls(data);
      setBatchCallsLoaded(true);
      setBatchCallsUpdated(Date.now());
      
      // Marcar si no hay batch calls disponibles para evitar cargas futuras
      if (data.length === 0) {
        // console.log('API consultada correctamente: no hay batch calls disponibles');
        setNoBatchCallsAvailable(true);
      } else {
        setNoBatchCallsAvailable(false);
      }
      
      // console.log(`Batch calls cargados: ${data.length}`);
    } catch (err) {
      // console.error('Error al cargar batch calls:', err);
      // No establecemos error global para no confundir con otros errores
      
      // Si ha habido 3 intentos fallidos, marcar como "no disponible" para evitar más intentos
      if (batchCallsAttemptCount.current >= 3) {
        // console.log('Demasiados intentos fallidos, asumiendo que no hay batch calls disponibles');
        setNoBatchCallsAvailable(true);
      }
    } finally {
      setLoadingBatchCalls(false);
    }
  }, [apiKey, batchCallsLoaded, batchCallsUpdated, loadingBatchCalls, noBatchCallsAvailable]);
  
  // Función para forzar la actualización de batch calls
  const refreshBatchCalls = useCallback(async () => {
    return loadBatchCalls(true);
  }, [loadBatchCalls]);

  // Función para cargar los números de teléfono
  const loadPhoneNumbers = useCallback(async (forceRefresh = false) => {
    // Si ya sabemos que no hay números disponibles, no seguir intentando
    if (noPhoneNumbersAvailable && !forceRefresh) {
      // console.log('No hay números de teléfono disponibles (ya verificado)');
      return;
    }
    
    // Determinar qué API keys usar: apiKeyTest si está disponible, sino apiKey
    const apiKeysToUse = apiKeyTest && apiKeyTest.length > 0 ? apiKeyTest : (apiKey ? [apiKey] : null);
    
    // Esperar a que tengamos al menos una API key
    if (!apiKeysToUse || apiKeysToUse.length === 0) {
      // console.log('Esperando API key para cargar números de teléfono...');
      return;
    }
    
    // Verificar si ya tenemos datos en caché y no ha expirado
    const now = Date.now();
    if (
      !forceRefresh && 
      phoneNumbersLoaded &&
      phoneNumbersUpdated && 
      now - phoneNumbersUpdated < CACHE_EXPIRY_TIME
    ) {
      // console.log('Usando números de teléfono en caché');
      return;
    }
    
    // Evitar múltiples peticiones simultáneas
    if (loadingPhoneNumbers) {
      // console.log('Ya se está cargando los números de teléfono');
      return;
    }
    
    setLoadingPhoneNumbers(true);
    
    try {
      // console.log(`Cargando números de teléfono desde ${apiKeysToUse.length} API key(s)`);
      // fetchPhoneNumbers ahora acepta un array de API keys
      const numbers = await fetchPhoneNumbers(apiKeysToUse.length > 1 ? apiKeysToUse : apiKeysToUse[0]);
      
      setPhoneNumbers(numbers);
      setPhoneNumbersLoaded(true);
      setPhoneNumbersUpdated(Date.now());
      
      // Marcar si no hay números disponibles para evitar cargas futuras
      if (numbers.length === 0) {
        // console.log('API consultada correctamente: no hay números de teléfono disponibles');
        setNoPhoneNumbersAvailable(true);
      } else {
        setNoPhoneNumbersAvailable(false);
      }
      
      // console.log(`Números de teléfono cargados: ${numbers.length}`);
    } catch (err) {
      // console.error('Error al cargar números de teléfono:', err);
      // No establecemos error global para no confundir con otros errores
    } finally {
      setLoadingPhoneNumbers(false);
    }
  }, [apiKey, apiKeyTest, phoneNumbersLoaded, phoneNumbersUpdated, loadingPhoneNumbers, noPhoneNumbersAvailable]);

  // Función para cargar los datos del dashboard
  const loadDashboardData = useCallback(async (fechaInicio?: string, fechaFin?: string, timePeriod?: string, bdd?: string, cliente?: string) => {
    // No intentar cargar si no tenemos clientId o alguna API key (individual o array)
    const hasApiKey = apiKey || (apiKeyTest && apiKeyTest.length > 0);
    if (!clientId || !hasApiKey) {
      // console.log('⏳ No se puede cargar dashboard: faltan clientId o API key', { 
        // clientId: !!clientId, 
        // apiKey: !!apiKey, 
        // apiKeyTest: apiKeyTest?.length || 0 
      // });
      return;
    }
    
    setLoadingDashboardData(true);
    
    try {
      // console.log('Cargando datos del dashboard con período:', { timePeriod, fechaInicio, fechaFin, bdd });
      
      // Salvaguarda: en personalizado, no llamar si no hay ambas fechas
      if (timePeriod === 'custom' && (!fechaInicio || !fechaFin)) {
        // console.log('Custom sin rango completo: abortando carga hasta tener ambas fechas');
        return;
      }

      let data;
      
      // Determinar qué endpoint usar según el período
      // Pasar clientId explícitamente para evitar depender del localStorage
      if (timePeriod === 'today') {
        data = await getDashboardToday(clientId, bdd, cliente);
      } else if (timePeriod === 'week') {
        data = await getDashboardWeek(clientId, bdd, cliente);
      } else if (timePeriod === 'month') {
        data = await getDashboardMonth(clientId, bdd, cliente);
      } else {
        // Usar el endpoint genérico con fechas
        data = await getDashboardData(clientId, fechaInicio, fechaFin, bdd, cliente);
      }
      
      setDashboardData(data);
      // Guardar en localStorage para stale-while-revalidate (próxima carga será instantánea)
      try {
        localStorage.setItem(`dash_stale_${clientId}`, JSON.stringify(data));
      } catch {}
      // Limpiar error si la carga fue exitosa
      setError(null);
    } catch (err) {
      // console.error('Error al cargar datos del dashboard:', err);
      // Solo establecer error si realmente falló y tenemos los datos necesarios
      // No establecer error si es un problema de inicialización (clientId o API key faltantes)
      const hasApiKey = apiKey || (apiKeyTest && apiKeyTest.length > 0);
      if (clientId && hasApiKey) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        // Solo establecer error si no es un error de "no se encontró client_id"
        if (!errorMessage.includes('No se encontró client_id') && !errorMessage.includes('client_id')) {
          setError('Error al cargar datos del dashboard');
        } else {
          // console.log('⚠️ Error del dashboard ignorado (problema de inicialización):', errorMessage);
        }
      } else {
        // console.log('⚠️ Error del dashboard ignorado (faltan clientId o apiKey)');
      }
    } finally {
      setLoadingDashboardData(false);
    }
  }, [clientId, apiKey]);

  // Cargar datos cuando se monta el componente y tenemos la API key
  useEffect(() => {
    if (apiKey && allCalls.length === 0 && !loadingAllCalls) {
      loadAllCalls();
    }
  }, [loadAllCalls, allCalls.length, loadingAllCalls, apiKey]);

  // Función para cargar los motivos de desconexión desde el endpoint
  const loadDisconnectionReasons = useCallback(async () => {
    if (!apiKey || !clientId) {
      // console.log('⏳ Esperando apiKey y clientId para cargar motivos de desconexión...');
      return;
    }

    try {
      // console.log('🔄 Cargando motivos de desconexión desde el endpoint para client_id:', clientId);
      const reasons = await getDisconnectionReasons(apiKey, clientId);
      
      // Filtrar valores nulos o vacíos
      const validReasons = reasons.filter(reason => reason && reason.trim() !== '' && reason !== 'null');
      
      setDisconnectionReasons(validReasons);
      // console.log(`✅ Motivos de desconexión cargados para client_id "${clientId}": ${validReasons.length} motivos`, validReasons);
    } catch (err) {
      // console.error('❌ Error al cargar motivos de desconexión:', err);
      // No establecer error global, solo loguear
    }
  }, [apiKey, clientId]);

  // Cargar motivos de desconexión cuando tenemos clientId y apiKey disponibles
  useEffect(() => {
    if (clientId && apiKey && disconnectionReasons.length === 0) {
      loadDisconnectionReasons();
    }
  }, [clientId, apiKey, disconnectionReasons.length, loadDisconnectionReasons]);

  // Cargar datos del dashboard cuando tenemos clientId y apiKey disponibles
  // Usa ref en vez de !dashboardData para que el fetch corra aunque haya datos stale pre-cargados
  useEffect(() => {
    const hasApiKey = apiKey || (apiKeyTest && apiKeyTest.length > 0);
    if (clientId && hasApiKey && !dashboardInitialFetchDone.current && !loadingDashboardData) {
      dashboardInitialFetchDone.current = true;
      loadDashboardData(undefined, undefined, 'today');
    }
  }, [clientId, apiKey, apiKeyTest, loadingDashboardData, loadDashboardData]);

  // agendaEnabled y callsEnabled ahora vienen desde la configuración del cliente

  // Actualizar el estado de phoneFilter basado en el parámetro de la URL
  useEffect(() => {
    const { phone } = getParamsFromUrl();
    if (phone) {
      // Normalizar el número de teléfono (añadir + si no lo tiene)
      let normalizedPhone = phone.trim();
      if (!normalizedPhone.startsWith('+')) {
        normalizedPhone = '+' + normalizedPhone;
      }
      setPhoneFilter(normalizedPhone);
      // console.log('Filtro de teléfono activado:', normalizedPhone);
    } else {
      setPhoneFilter(null);
      // console.log('Sin filtro de teléfono');
    }
  }, [getParamsFromUrl]);

  const value = {
    allCalls,
    loadingAllCalls,
    loadingProgress,
    error,
    totalCalls,
    loadAllCalls,
    loadCallsPage,
    disconnectionReasons,
    allCallsLoaded,
    lastUpdated,
    apiKey,
    apiKeyTest,
    clientId,
    setApiKey,
    phoneNumbers,
    loadingPhoneNumbers,
    phoneNumbersLoaded,
    noPhoneNumbersAvailable,
    loadPhoneNumbers,
    batchCalls,
    loadingBatchCalls,
    batchCallsLoaded,
    noBatchCallsAvailable,
    loadBatchCalls,
    refreshBatchCalls,
    currentPage,
    totalPages,
    hasMorePages,
    setFilterCriteria,
    filterCriteria,
    dashboardData,
    loadingDashboardData,
    loadDashboardData,
    totalCallsFiltered,
    agendaEnabled,
    callsEnabled,
    salesEnabled,
    numTelEnabled,
    recordsEnabled,
    callbacksEnabled,
    launchEnabled,
    dontCallEnabled,
    campaignEnabled,
    phoneFilter
  };

  return (
    <CallsContext.Provider value={value}>
      {children}
    </CallsContext.Provider>
  );
} 