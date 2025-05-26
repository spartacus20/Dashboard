import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { RetellCall, FilterCriteria, RetellPhoneNumber, RetellBatchCall } from '../types';
import { fetchPhoneNumbers, fetchBatchCalls } from '../api';

interface CallsContextType {
  allCalls: RetellCall[];
  loadingAllCalls: boolean;
  loadingProgress: number;
  error: string | null;
  totalCalls: number;
  loadAllCalls: (forceRefresh?: boolean) => Promise<void>;
  disconnectionReasons: string[];
  allCallsLoaded: boolean;
  lastUpdated: number | null;
  apiKey: string | null;
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
  
  // Extraer la API key de la URL al cargar el componente
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const keyFromUrl = params.get('apikey');
    
    if (keyFromUrl) {
      console.log('API key obtenida de la URL');
      setApiKey(keyFromUrl);
    } else {
      console.warn('No se encontró API key en la URL');
      setError('API key no encontrada en la URL. Añade ?apikey=TU_API_KEY a la URL.');
    }
  }, []);

  // Función para cargar las batch calls
  const loadBatchCalls = useCallback(async (forceRefresh = false) => {
    // Si ya sabemos que no hay batch calls disponibles, no seguir intentando
    if (noBatchCallsAvailable && !forceRefresh) {
      console.log('No hay batch calls disponibles para esta API key (ya verificado)');
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
    
    if (!apiKey) {
      console.warn('No se puede cargar batch calls: API key no configurada');
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
      console.log('No hay números de teléfono disponibles para esta API key (ya verificado)');
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
    
    if (!apiKey) {
      console.warn('No se puede cargar números de teléfono: API key no configurada');
      return;
    }
    
    // Evitar múltiples peticiones simultáneas
    if (loadingPhoneNumbers) {
      console.log('Ya se está cargando los números de teléfono');
      return;
    }
    
    setLoadingPhoneNumbers(true);
    
    try {
      console.log('Cargando números de teléfono desde la API (UNA SOLA VEZ)');
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

  // Función para cargar todas las llamadas disponibles
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
    
    if (!apiKey) {
      setError('API key no configurada. Añade ?apikey=TU_API_KEY a la URL.');
      return;
    }
    
    // Limpiar estados previos
    setLoadingProgress(0);
    
    // Solo limpiamos los datos si es una carga forzada o si la caché ha caducado
    if (forceRefresh || !lastUpdated || now - lastUpdated >= CACHE_EXPIRY_TIME) {
      setAllCalls([]);
      setError(null);
    }
    
    try {
      setLoadingAllCalls(true);
      
      // Array para almacenar todas las llamadas
      let allCallsData: RetellCall[] = [];
      let paginationKey: string | undefined = undefined;
      let hasMoreCalls = true;
      let pagina = 1;
      let maxAttempts = 100; // Limite de seguridad para evitar bucles infinitos
      let attemptCount = 0;
      
      // Hacemos múltiples solicitudes para obtener todas las llamadas disponibles
      while (hasMoreCalls && attemptCount < maxAttempts) {
        attemptCount++;
        try {
          console.log(`Solicitando página ${pagina} de llamadas con paginationKey: ${paginationKey || 'undefined'}`);
          
          const response = await fetch('https://api.retellai.com/v2/list-calls', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              limit: 1000, // Usamos el máximo permitido por la API
              sort_order: 'descending',
              pagination_key: paginationKey,
              filter_criteria: {}
            }),
          });

          if (!response.ok) {
            throw new Error(`Error en la solicitud: ${response.status} ${response.statusText}`);
          }

          const data = await response.json();
          
          // Extraer las llamadas del resultado
          const newCalls = Array.isArray(data) ? data : data.calls || [];
          
          console.log(`Cargada página ${pagina}: ${newCalls.length} llamadas. Total acumulado: ${allCallsData.length + newCalls.length}`);
          
          // Añadir las nuevas llamadas al array total
          allCallsData = [...allCallsData, ...newCalls];
          
          // Actualizar la clave de paginación como el ID de la última llamada recibida
          // Según la documentación: "Pagination key is represented by a call id here, and it's exclusive"
          paginationKey = newCalls.length > 0 ? newCalls[newCalls.length - 1].call_id : undefined;
          
          console.log(`Nueva pagination_key: ${paginationKey || 'undefined'}`);
          
          pagina++;
          
          // Actualizar el progreso de carga
          setLoadingProgress(allCallsData.length);
          
          // No actualizamos el estado con cada carga, solo el progreso
          // Esto evita que se intente renderizar con datos incompletos
          
          // Si no hay paginationKey o se devolvieron menos de 1000, hemos llegado al final
          if (!paginationKey || newCalls.length < 1000) {
            console.log(`Fin de la paginación. Total de llamadas cargadas: ${allCallsData.length}`);
            hasMoreCalls = false;
          }
          
        } catch (err) {
          console.error(`Error cargando página ${pagina}:`, err);
          
          // Mostrar mensaje de error pero seguir intentando
          setError(`Error al cargar página ${pagina}: ${err instanceof Error ? err.message : String(err)}`);
          
          // Si fallamos 3 veces seguidas, nos rendimos
          if (attemptCount > 3) {
            console.error('Demasiados intentos fallidos. Deteniendo la carga.');
            hasMoreCalls = false;
          } else {
            // Esperar un segundo antes de reintentar
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      
      if (attemptCount >= maxAttempts) {
        console.warn(`Se alcanzó el límite máximo de intentos (${maxAttempts}). Es posible que no se hayan cargado todas las llamadas.`);
        setError(`Se alcanzó el límite máximo de intentos (${maxAttempts}). Es posible que no se hayan cargado todas las llamadas.`);
      }
      
      // Actualizar el estado con todas las llamadas cargadas
      setAllCalls(allCallsData);
      setTotalCalls(allCallsData.length);
      
      // Extraer todas las razones de desconexión únicas
      const allReasons = [...new Set(
        allCallsData
          .map(call => call.disconnection_reason)
          .filter((reason): reason is string => !!reason)
      )].sort();
      
      setDisconnectionReasons(allReasons);
      setAllCallsLoaded(true);
      setLastUpdated(Date.now());
      
      // Mensaje informativo en consola del total final
      console.log(`Carga completada. Total final de llamadas: ${allCallsData.length}`);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar todas las llamadas');
      console.error('Error general cargando llamadas:', err);
    } finally {
      setLoadingAllCalls(false);
    }
  }, [apiKey, allCalls.length, lastUpdated]);
  
  // Cargar datos cuando se monta el componente y tenemos la API key
  useEffect(() => {
    if (apiKey && allCalls.length === 0 && !loadingAllCalls) {
      loadAllCalls();
    }
  }, [loadAllCalls, allCalls.length, loadingAllCalls, apiKey]);

  const value = {
    allCalls,
    loadingAllCalls,
    loadingProgress,
    error,
    totalCalls,
    loadAllCalls,
    disconnectionReasons,
    allCallsLoaded,
    lastUpdated,
    apiKey,
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
    refreshBatchCalls
  };

  return (
    <CallsContext.Provider value={value}>
      {children}
    </CallsContext.Provider>
  );
} 