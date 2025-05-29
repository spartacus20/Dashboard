import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { RetellCall, FilterCriteria, RetellPhoneNumber, RetellBatchCall } from '../types';
import { fetchPhoneNumbers, fetchBatchCalls, fetchCalls, getClientApiKey, getDashboardData } from '../api';
import { useAuth } from './AuthContext';

interface CallsContextType {
  allCalls: RetellCall[];
  loadingAllCalls: boolean;
  loadingProgress: number;
  error: string | null;
  totalCalls: number;
  loadAllCalls: (forceRefresh?: boolean) => Promise<void>;
  loadCallsPage: (page: number, filterCriteria?: FilterCriteria) => Promise<RetellCall[]>;
  disconnectionReasons: string[];
  allCallsLoaded: boolean;
  lastUpdated: number | null;
  apiKey: string | null;
  clientId: string | null;
  setApiKey: (key: string) => void;
  phoneNumbers: RetellPhoneNumber[];
  loadingPhoneNumbers: boolean;
  phoneNumbersLoaded: boolean;
  noPhoneNumbersAvailable: boolean;
  loadPhoneNumbers: () => Promise<void>;
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
  loadDashboardData: () => Promise<void>;
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
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [totalCalls, setTotalCalls] = useState(0);
  const [disconnectionReasons, setDisconnectionReasons] = useState<string[]>([]);
  const [allCallsLoaded, setAllCallsLoaded] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  
  // Estados de paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [hasMorePages, setHasMorePages] = useState(true);
  const loadedPages = useRef<Set<number>>(new Set());
  const loadingPages = useRef<Set<number>>(new Set()); // Nueva protección contra cargas concurrentes
  
  // Estado para los filtros
  const [filterCriteria, setFilterCriteria] = useState<FilterCriteria>({});
  
  // Estado para los datos del dashboard
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loadingDashboardData, setLoadingDashboardData] = useState(false);
  
  // Obtener el usuario del contexto de autenticación
  const { user } = useAuth();
  
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
  
  // Obtener la API key cuando el usuario se autentique
  useEffect(() => {
    const fetchApiKey = async () => {
      if (user?.email) {
        console.log('Obteniendo API key para el usuario:', user.email);
        const result = await getClientApiKey(user.email);
        if (result.apiKey) {
          console.log('API key obtenida exitosamente');
          setApiKey(result.apiKey);
          setClientId(result.clientId);
        } else {
          console.error('No se pudo obtener la API key del usuario');
          setError('No se pudo obtener la configuración del usuario');
        }
      }
    };

    fetchApiKey();
  }, [user]);

  // Función para cargar una página específica de llamadas
  const loadCallsPage = useCallback(async (page: number, filterCriteria?: FilterCriteria): Promise<RetellCall[]> => {
    if (!apiKey) {
      console.log('Esperando API key para cargar llamadas...');
      return [];
    }
    
    // Si ya cargamos esta página, no volver a cargarla
    if (loadedPages.current.has(page)) {
      console.log(`Página ${page} ya está cargada`);
      return [];
    }
    
    // Si ya estamos cargando esta página, no cargar de nuevo
    if (loadingPages.current.has(page)) {
      console.log(`Página ${page} ya se está cargando`);
      return [];
    }
    
    try {
      // Marcar que estamos cargando esta página
      loadingPages.current.add(page);
      setLoadingAllCalls(true);
      console.log(`Cargando página ${page} de llamadas`);
      
      const response = await fetchCalls(apiKey, undefined, filterCriteria, page, clientId || undefined);
      const newCalls = response.calls;
      
      // Si es la primera página, obtener información de paginación
      if (page === 1 && response.totalPages) {
        setTotalPages(response.totalPages);
        setHasMorePages(response.totalPages > 1);
        console.log(`Total de páginas disponibles: ${response.totalPages}`);
      }
      
      console.log(`Página ${page}: ${newCalls.length} llamadas cargadas`);
      
      // Marcar la página como cargada
      loadedPages.current.add(page);
      
      // Verificar si las llamadas ya existen para evitar duplicados
      setAllCalls(prevCalls => {
        // Filtrar llamadas que ya existen
        const existingCallIds = new Set(prevCalls.map(call => call.call_id));
        const uniqueNewCalls = newCalls.filter(call => !existingCallIds.has(call.call_id));
        
        if (uniqueNewCalls.length < newCalls.length) {
          console.log(`Filtradas ${newCalls.length - uniqueNewCalls.length} llamadas duplicadas`);
        }
        
        const updatedCalls = [...prevCalls, ...uniqueNewCalls];
        
        // Actualizar estadísticas
        setTotalCalls(updatedCalls.length);
        
        // Extraer razones de desconexión únicas
        const reasons = [...new Set(
          updatedCalls
            .map(call => call.disconnection_reason)
            .filter((reason): reason is string => !!reason)
        )].sort();
        setDisconnectionReasons(reasons);
        
        return updatedCalls;
      });
      
      setCurrentPage(page);
      setLastUpdated(Date.now());
      
      return newCalls;
    } catch (err) {
      console.error(`Error cargando página ${page}:`, err);
      setError(`Error al cargar página ${page}: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    } finally {
      // Remover de las páginas en proceso de carga
      loadingPages.current.delete(page);
      setLoadingAllCalls(false);
    }
  }, [apiKey, clientId, filterCriteria]);

  // Función para cargar la primera página de llamadas
  const loadAllCalls = useCallback(async (forceRefresh = false) => {
    // Si ya tenemos datos y no ha caducado la caché, no hacemos nada (a menos que sea forzado)
    const now = Date.now();
    if (
      !forceRefresh && 
      allCalls.length > 0 && 
      lastUpdated && 
      now - lastUpdated < CACHE_EXPIRY_TIME
    ) {
      console.log('Usando datos en caché');
      return;
    }
    
    // Esperar a que tengamos la API key
    if (!apiKey) {
      console.log('Esperando API key para cargar llamadas...');
      return;
    }
    
    // Limpiar estados previos si es una carga forzada
    if (forceRefresh) {
      setAllCalls([]);
      setError(null);
      loadedPages.current.clear();
      loadingPages.current.clear(); // Limpiar también las páginas en proceso
      setCurrentPage(1);
      setTotalPages(0);
      setHasMorePages(true);
    }
    
    // Cargar solo la primera página con los filtros actuales
    await loadCallsPage(1, filterCriteria);
  }, [apiKey, allCalls.length, lastUpdated, loadCallsPage, filterCriteria]);

  // Función para cargar las batch calls
  const loadBatchCalls = useCallback(async (forceRefresh = false) => {
    // Si ya sabemos que no hay batch calls disponibles, no seguir intentando
    if (noBatchCallsAvailable && !forceRefresh) {
      console.log('No hay batch calls disponibles (ya verificado)');
      return;
    }
    
    // Esperar a que tengamos la API key
    if (!apiKey) {
      console.log('Esperando API key para cargar batch calls...');
      return;
    }
    
    // Limitar número de intentos si falla repetidamente (máximo 3 intentos)
    if (batchCallsAttemptCount.current >= 3 && !forceRefresh) {
      console.log(`Se alcanzó el límite de intentos de carga de batch calls (${batchCallsAttemptCount.current})`);
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
      console.log('Usando batch calls en caché');
      return;
    }
    
    // Evitar múltiples peticiones simultáneas
    if (loadingBatchCalls) {
      console.log('Ya se está cargando los batch calls');
      return;
    }
    
    setLoadingBatchCalls(true);
    batchCallsAttemptCount.current++;
    
    try {
      console.log(`Cargando batch calls desde la API (intento ${batchCallsAttemptCount.current})`);
      const data = await fetchBatchCalls(apiKey);
      
      setBatchCalls(data);
      setBatchCallsLoaded(true);
      setBatchCallsUpdated(Date.now());
      
      // Marcar si no hay batch calls disponibles para evitar cargas futuras
      if (data.length === 0) {
        console.log('API consultada correctamente: no hay batch calls disponibles');
        setNoBatchCallsAvailable(true);
      } else {
        setNoBatchCallsAvailable(false);
      }
      
      console.log(`Batch calls cargados: ${data.length}`);
    } catch (err) {
      console.error('Error al cargar batch calls:', err);
      // No establecemos error global para no confundir con otros errores
      
      // Si ha habido 3 intentos fallidos, marcar como "no disponible" para evitar más intentos
      if (batchCallsAttemptCount.current >= 3) {
        console.log('Demasiados intentos fallidos, asumiendo que no hay batch calls disponibles');
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
      console.log('No hay números de teléfono disponibles (ya verificado)');
      return;
    }
    
    // Esperar a que tengamos la API key
    if (!apiKey) {
      console.log('Esperando API key para cargar números de teléfono...');
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
      console.log('Usando números de teléfono en caché');
      return;
    }
    
    // Evitar múltiples peticiones simultáneas
    if (loadingPhoneNumbers) {
      console.log('Ya se está cargando los números de teléfono');
      return;
    }
    
    setLoadingPhoneNumbers(true);
    
    try {
      console.log('Cargando números de teléfono desde la API');
      const numbers = await fetchPhoneNumbers(apiKey);
      
      setPhoneNumbers(numbers);
      setPhoneNumbersLoaded(true);
      setPhoneNumbersUpdated(Date.now());
      
      // Marcar si no hay números disponibles para evitar cargas futuras
      if (numbers.length === 0) {
        console.log('API consultada correctamente: no hay números de teléfono disponibles');
        setNoPhoneNumbersAvailable(true);
      } else {
        setNoPhoneNumbersAvailable(false);
      }
      
      console.log(`Números de teléfono cargados: ${numbers.length}`);
    } catch (err) {
      console.error('Error al cargar números de teléfono:', err);
      // No establecemos error global para no confundir con otros errores
    } finally {
      setLoadingPhoneNumbers(false);
    }
  }, [apiKey, phoneNumbersLoaded, phoneNumbersUpdated, loadingPhoneNumbers, noPhoneNumbersAvailable]);

  // Función para cargar los datos del dashboard
  const loadDashboardData = useCallback(async () => {
    if (!clientId) {
      console.log('Esperando client_id para cargar datos del dashboard...');
      return;
    }
    
    setLoadingDashboardData(true);
    
    try {
      console.log('Cargando datos del dashboard');
      const data = await getDashboardData(clientId);
      setDashboardData(data);
      console.log('Datos del dashboard cargados:', data);
    } catch (err) {
      console.error('Error al cargar datos del dashboard:', err);
      setError('Error al cargar datos del dashboard');
    } finally {
      setLoadingDashboardData(false);
    }
  }, [clientId]);

  // Cargar datos cuando se monta el componente y tenemos la API key
  useEffect(() => {
    if (apiKey && allCalls.length === 0 && !loadingAllCalls) {
      loadAllCalls();
    }
  }, [loadAllCalls, allCalls.length, loadingAllCalls, apiKey]);

  // Cargar datos del dashboard cuando tenemos clientId
  useEffect(() => {
    if (clientId && !dashboardData && !loadingDashboardData) {
      loadDashboardData();
    }
  }, [clientId, dashboardData, loadingDashboardData, loadDashboardData]);

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
    loadDashboardData
  };

  return (
    <CallsContext.Provider value={value}>
      {children}
    </CallsContext.Provider>
  );
} 