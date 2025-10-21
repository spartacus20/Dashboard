import React from 'react';
import { Play, Pause, Download, Clock, ChevronDown, ChevronUp, Search, X, Phone, ChevronLeft, ChevronRight, ListFilter, PhoneOff, RefreshCw } from 'lucide-react';
import type { DetailedRetellCall, FilterCriteria } from '../types';
import { useCallsContext } from '../context/CallsContext';
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { listCalls, exportCallsWithColumns } from '../api';

// Componentes UI simplificados
const Input = ({ className = "", ...props }: { className?: string; [key: string]: any }) => (
  <input 
    className={`flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
    {...props} 
  />
);

const Badge = ({ children, variant = "default", className = "" }: { children: React.ReactNode; variant?: "default" | "secondary" | "outline"; className?: string }) => {
  const variantClasses = {
    default: "bg-gradient-to-r from-blue-600 to-indigo-700 text-white",
    secondary: "bg-slate-200 text-slate-700",
    outline: "border border-slate-300 text-slate-600",
  };
  
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
};

const Skeleton = ({ className = "", ...props }) => (
  <div className={`animate-pulse rounded-md bg-slate-200 ${className}`} {...props} />
);


// Componente Select simplificado
const Select = ({ children, value, onValueChange, className = "" }: { children: React.ReactNode; value: string; onValueChange?: (value: string) => void; className?: string }) => {
  return (
    <div className={`relative ${className}`}>
      <select 
        value={value} 
        onChange={(e) => onValueChange?.(e.target.value)}
        className="flex h-10 w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {children}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 opacity-50 pointer-events-none text-slate-500" />
    </div>
  );
};

const SelectItem = ({ value, children }: { value: string; children: React.ReactNode }) => {
  return <option value={value}>{children}</option>;
};

// Componentes de paginación simplificados
const PaginationButton = ({ onClick, children, isActive, className = "" }: { onClick: () => void; children: React.ReactNode; isActive: boolean; className?: string }) => (
  <button
    onClick={onClick}
    className={`inline-flex items-center justify-center text-sm font-medium h-9 min-w-9 px-2 rounded-md ${
      isActive 
        ? "bg-gradient-to-r from-blue-600 to-indigo-700 text-white" 
        : "text-slate-600 hover:text-slate-800 hover:bg-slate-100"
    } ${className}`}
  >
    {children}
  </button>
);

const PaginationPrevious = ({ onClick, disabled }: { onClick: () => void; disabled: boolean }) => (
  <PaginationButton 
    onClick={onClick}
    isActive={false}
    className={disabled ? "opacity-50 cursor-not-allowed" : ""}
  >
    <ChevronLeft className="h-4 w-4 mr-1" />
    <span>Anterior</span>
  </PaginationButton>
);

const PaginationNext = ({ onClick, disabled }: { onClick: () => void; disabled: boolean }) => (
  <PaginationButton 
    onClick={onClick}
    isActive={false}
    className={disabled ? "opacity-50 cursor-not-allowed" : ""}
  >
    <span>Siguiente</span>
    <ChevronRight className="h-4 w-4 ml-1" />
  </PaginationButton>
);

interface RecordingsProps {
  onNavigate: (page: 'dashboard' | 'recordings') => void;
}


// Función para normalizar números de teléfono
function normalizePhoneNumber(phoneNumber: string): string {
  let normalized = phoneNumber.toString().trim();
  
  // Remover el + si existe
  if (normalized.startsWith('+')) {
    normalized = normalized.substring(1);
  }
  
  // Remover espacios, guiones y paréntesis
  normalized = normalized.replace(/[\s\-\(\)]/g, '');
  
  return normalized;
}

// Nueva función para obtener la duración de una llamada de forma robusta
function getDuration(call: DetailedRetellCall): string {
  // Opción 1: Usar el campo duration directamente del webhook (en milisegundos)
  if (call.duration && call.duration > 0) {
    const durationSeconds = Math.floor(call.duration / 1000);
    const minutes = Math.floor(durationSeconds / 60);
    const seconds = durationSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  
  // Opción 2: Calcular usando timestamps como respaldo
  if (call.end_timestamp && call.start_timestamp) {
    const durationMs = call.end_timestamp - call.start_timestamp;
    const durationSeconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(durationSeconds / 60);
    const seconds = durationSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  
  // Opción 3: Buscar en metadata como último recurso (asumiendo segundos en metadata)
  if (call.metadata?.duration) {
    const duration = parseInt(call.metadata.duration);
    if (duration > 0) {
      const minutes = Math.floor(duration / 60);
      const seconds = duration % 60;
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  }
  
  return 'En curso';
}


function formatCost(cost: number): string {
  return `$${(cost / 100).toFixed(2)}`;
}

// Componente de skeleton para las grabaciones
const RecordingsSkeleton = () => {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      
      {[...Array(5)].map((_, index) => (
        <Card key={index} className="overflow-hidden">
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-1/3 mb-1" />
            <Skeleton className="h-4 w-1/4" />
          </CardHeader>
          <CardContent>
            <div className="flex justify-between">
              <div className="space-y-2 w-2/3">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-1/4" />
              </div>
              <Skeleton className="h-8 w-24" />
            </div>
          </CardContent>
        </Card>
      ))}
      
      <div className="flex flex-col items-center space-y-2 py-8">
        <div className="h-10 w-10 rounded-full border-4 border-gray-800 border-t-purple-500 animate-spin" />
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
    </div>
  );
};

export function Recordings({ onNavigate }: RecordingsProps) {

  const [selectedCallModal, setSelectedCallModal] = React.useState<DetailedRetellCall | null>(null);
  const [selectedCall, setSelectedCall] = React.useState<string | null>(null);
  const [playingId, setPlayingId] = React.useState<string | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [audioCurrentTime, setAudioCurrentTime] = React.useState(0);
  const [audioDuration, setAudioDuration] = React.useState(0);
  
  // Usar el contexto compartido en lugar de tener estados duplicados
  const { 
    allCalls,
    loadingAllCalls,
    loadingProgress,
    error: contextError,
    totalCalls,
    loadAllCalls: contextLoadAllCalls,
    loadCallsPage,
    disconnectionReasons: contextDisconnectionReasons,
    allCallsLoaded,
    apiKey,
    clientId, // Agregar clientId del contexto
    currentPage: contextCurrentPage,
    totalPages: contextTotalPages,
    hasMorePages,
    setFilterCriteria: contextSetFilterCriteria,
    dashboardData,
    totalCallsFiltered // Agregar totalCallsFiltered del contexto
  } = useCallsContext();
  
  let totalCallsDisplay: number | undefined = undefined;
  let totalCallsLabel: string = '';

  // Priorizar totalCallsFiltered cuando está disponible (indica filtros aplicados)
  if (totalCallsFiltered !== null && totalCallsFiltered !== undefined) {
    totalCallsDisplay = totalCallsFiltered;
    totalCallsLabel = totalCallsFiltered === 1 ? 'llamada filtrada' : 'llamadas filtradas';
  } else if (dashboardData?.dashboard_data?.metricas_generales?.total_llamadas !== undefined) {
    totalCallsDisplay = dashboardData.dashboard_data.metricas_generales.total_llamadas;
    totalCallsLabel = totalCallsDisplay === 1 ? 'llamada en servidor' : 'llamadas en servidor';
  } else if (totalCalls !== undefined) {
    totalCallsDisplay = totalCalls;
    totalCallsLabel = totalCallsDisplay === 1 ? 'llamada cargada' : 'llamadas cargadas';
  } else {
    totalCallsDisplay = 0;
    totalCallsLabel = 'llamadas';
  }

  // Estados locales para paginación y filtrado
  const [calls, setCalls] = React.useState<DetailedRetellCall[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  
  // Estados para llamadas filtradas
  const [filteredCallsData, setFilteredCallsData] = React.useState<DetailedRetellCall[]>([]);
  const [loadingFilters, setLoadingFilters] = React.useState(false);
  const [totalFilteredCalls, setTotalFilteredCalls] = React.useState<number>(0);
  const [totalFilteredPages, setTotalFilteredPages] = React.useState<number>(0);
  
  // Estados para la paginación - usar estado local para la página actual
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(25);
  const [itemsPerPageOptions] = React.useState([25, 50, 100]);
  
  // Estados para los dropdowns
  const [showItemsPerPageDropdown, setShowItemsPerPageDropdown] = React.useState(false);
  
  // Estados para los filtros
  const [disconnectionReasonFilter, setDisconnectionReasonFilter] = React.useState<string | null>(null);
  const [durationFilter, setDurationFilter] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<string | null>(null);
  const [phoneNumberFilter, setPhoneNumberFilter] = React.useState<string>('');
  const [sortOrderFilter, setSortOrderFilter] = React.useState<'ASC' | 'DESC'>('DESC');
  
  // Estado para la personalización de columnas
  const [showColumnCustomizer, setShowColumnCustomizer] = React.useState(false);
  const [visibleColumns, setVisibleColumns] = React.useState({
    callId: true,
    status: false, 
    timestamp: true,
    duration: true,
    disconnectionReason: true,
    callType: true,
    agent: false,
    fromNumber: false,
    toNumber: true // Cambiado a true para que sea visible por defecto
  });
  
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');

  // Flag para evitar cargas automáticas cuando se están aplicando filtros manualmente
  const isApplyingFilters = React.useRef(false);

  // Estados para el modal de filtros
  const [showFiltersModal, setShowFiltersModal] = React.useState(false);
  const [tempStartDate, setTempStartDate] = React.useState('');
  const [tempEndDate, setTempEndDate] = React.useState('');
  const [tempStartTime, setTempStartTime] = React.useState('');
  const [tempEndTime, setTempEndTime] = React.useState('');

  // Estados para exportación completa
  const [showExportModal, setShowExportModal] = React.useState(false);
  const [exportStartDate, setExportStartDate] = React.useState('');
  const [exportEndDate, setExportEndDate] = React.useState('');
  const [exportStartTime, setExportStartTime] = React.useState('');
  const [exportEndTime, setExportEndTime] = React.useState('');
  const [exportLoading, setExportLoading] = React.useState(false);
  const [exportError, setExportError] = React.useState<string | null>(null);
  
  // Estados para selección de columnas en exportación
  const [exportColumns, setExportColumns] = React.useState({
    created_at: true,
    duration: true,
    to_number: true,
    summary: false,
    transcript: false,
    end_reason: true,
    recordings: false,
    call_id: true,
    interest: false,
    tipo_vivienda: false,
    status: true,
    client_id: false,
    cost: false,
    from_number: false,
    from_number_norm: false,
    to_number_norm: false
  });

  // Estados para campos de metadata dinámicos
  const [metadataFields, setMetadataFields] = React.useState<Record<string, boolean>>({});
  const [availableMetadataFields, setAvailableMetadataFields] = React.useState<string[]>([]);

  // Cargar campos de metadata del session storage
  React.useEffect(() => {
    try {
      const storedMetadata = sessionStorage.getItem('metadata_llamadas');
      console.log('🔍 Metadata del session storage:', storedMetadata);
      
      if (storedMetadata) {
        const metadataArray = JSON.parse(storedMetadata);
        console.log('🔍 Metadata parseada:', metadataArray);
        
        if (Array.isArray(metadataArray) && metadataArray.length > 0) {
          // Si es un array, obtener las claves del primer objeto
          const fields = Object.keys(metadataArray[0]);
          console.log('🔍 Campos de metadata encontrados (array):', fields);
          
          setAvailableMetadataFields(fields);
          
          // Inicializar todos los campos como no seleccionados
          const initialFields: Record<string, boolean> = {};
          fields.forEach(field => {
            initialFields[field] = false;
          });
          setMetadataFields(initialFields);
        } else if (typeof metadataArray === 'object' && metadataArray !== null) {
          // Si es un objeto directo, obtener sus claves
          const fields = Object.keys(metadataArray);
          console.log('🔍 Campos de metadata encontrados (objeto):', fields);
          
          setAvailableMetadataFields(fields);
          
          // Inicializar todos los campos como no seleccionados
          const initialFields: Record<string, boolean> = {};
          fields.forEach(field => {
            initialFields[field] = false;
          });
          setMetadataFields(initialFields);
        } else {
          console.log('🔍 No se encontraron campos de metadata válidos');
        }
      } else {
        console.log('🔍 No hay metadata en session storage');
      }
    } catch (error) {
      console.error('Error al cargar metadata del session storage:', error);
    }
  }, []);

  // Cargar página cuando cambia currentPage
  React.useEffect(() => {
    const loadPageData = async () => {
      if (apiKey && currentPage > contextCurrentPage) {
        // Crear el filterCriteria con las fechas si están establecidas
        const criteria: FilterCriteria = {};
        if (startDate || endDate) {
          criteria.date_range = {};
          if (startDate) criteria.date_range.start = startDate;
          if (endDate) criteria.date_range.end = endDate;
        }
        
        // Necesitamos cargar más páginas con los filtros
        for (let page = contextCurrentPage + 1; page <= currentPage; page++) {
          await loadCallsPage(page, criteria);
        }
      }
    };
    
    loadPageData();
  }, [currentPage, contextCurrentPage, apiKey, loadCallsPage, startDate, endDate]);

  // Usar la función loadAllCalls del contexto compartido
  const loadAllCalls = React.useCallback((forceRefresh = false) => {
    // Solo llamamos al método del contexto
    return contextLoadAllCalls(forceRefresh);
  }, [contextLoadAllCalls]);

  // Filtrar las llamadas según todos los criterios aplicados
  const filteredCalls = React.useMemo(() => {
    // Si hay datos filtrados de la API, aplicarlos primero
    let baseCalls: DetailedRetellCall[] = [];
    if (filteredCallsData.length > 0) {
      baseCalls = filteredCallsData;
    } else {
      // Si no hay filtros activos, usar las llamadas originales
      const hasActiveFilters = searchTerm || statusFilter || durationFilter || startDate || endDate || phoneNumberFilter || sortOrderFilter !== 'DESC';
      if (!hasActiveFilters) {
        baseCalls = allCalls;
      } else {
        // Si hay filtros pero aún no se han aplicado, mostrar array vacío
        baseCalls = [];
      }
    }
    
    // Aplicar filtro de razones de desconexión solo a nivel de frontend
    if (disconnectionReasonFilter && baseCalls.length > 0) {
      baseCalls = baseCalls.filter(call => 
        call.disconnection_reason === disconnectionReasonFilter
      );
    }
    
    return baseCalls;
  }, [filteredCallsData, allCalls, searchTerm, statusFilter, durationFilter, startDate, endDate, phoneNumberFilter, sortOrderFilter, disconnectionReasonFilter]);

  // Calcular llamadas para la página actual basándose en filteredCalls
  const currentPageCalls = React.useMemo(() => {
    const indexOfLastCall = currentPage * itemsPerPage;
    const indexOfFirstCall = indexOfLastCall - itemsPerPage;
    return filteredCalls.slice(indexOfFirstCall, indexOfLastCall);
  }, [filteredCalls, currentPage, itemsPerPage]);

  // Calcular número total de páginas basado en las llamadas filtradas
  const totalPages = React.useMemo(() => {
    // Si tenemos datos filtrados de la API, usar esos
    if (filteredCallsData.length > 0) {
      return totalFilteredPages || Math.ceil(filteredCallsData.length / itemsPerPage);
    }
    
    // Si tenemos filtros aplicados pero aún no hay datos filtrados, calcular basado en las llamadas filtradas
    if (searchTerm || statusFilter || durationFilter || startDate || endDate || phoneNumberFilter || sortOrderFilter !== 'DESC') {
      return Math.ceil(filteredCalls.length / itemsPerPage);
    }
    
    // Si no hay filtros, usar el total de páginas del contexto si está disponible
    if (contextTotalPages > 0) {
      // Ajustar según itemsPerPage si es diferente de 100 (el tamaño de página del API)
      const apiPageSize = 100;
      const totalItems = contextTotalPages * apiPageSize;
      return Math.ceil(totalItems / itemsPerPage);
    }
    
    // Fallback: calcular basado en las llamadas cargadas
    return Math.ceil(allCalls.length / itemsPerPage);
  }, [filteredCallsData.length, totalFilteredPages, itemsPerPage, filteredCalls.length, searchTerm, statusFilter, durationFilter, startDate, endDate, phoneNumberFilter, sortOrderFilter, contextTotalPages, allCalls.length]);

  // Iniciar la carga de datos la primera vez que se monta el componente
  React.useEffect(() => {
    // Solo cargamos si no hay datos, no está cargando ya, y no estamos aplicando filtros manualmente
    if (allCalls.length === 0 && !loadingAllCalls && !isApplyingFilters.current) {
      loadAllCalls();
    }
    
    // Sincronizamos los estados locales con el contexto
    setError(contextError);
  }, [allCalls.length, loadingAllCalls, contextError]); // Removido loadAllCalls de las dependencias

  // Actualizar las llamadas mostradas cuando cambia la página
  React.useEffect(() => {
    setCalls(currentPageCalls);
  }, [currentPageCalls]);

  // Manejar cambio de página
  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  // Manejar cambio de elementos por página
  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    if (newItemsPerPage === itemsPerPage) {
      setShowItemsPerPageDropdown(false);
      return;
    }
    
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
    setShowItemsPerPageDropdown(false);
  };

  // Cerrar los dropdowns cuando se hace clic fuera de ellos
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.items-per-page-dropdown')) {
        setShowItemsPerPageDropdown(false);
      }
      if (!target.closest('.column-customizer-dropdown') && !target.closest('.column-customizer-button')) {
        setShowColumnCustomizer(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Create audio element on mount
  React.useEffect(() => {
    audioRef.current = new Audio();
    
    const handleTimeUpdate = () => {
      if (audioRef.current) {
        setAudioCurrentTime(audioRef.current.currentTime);
      }
    };
    
    const handleDurationChange = () => {
      if (audioRef.current) {
        const newDuration = audioRef.current.duration;
        // Establecer en 0 si la duración es NaN, no es finita, o es negativa.
        setAudioDuration(newDuration && isFinite(newDuration) && newDuration > 0 ? newDuration : 0);
      }
    };
    
    const handleEnded = () => {
      setPlayingId(null);
    };
    
    const handleError = () => {
      setPlayingId(null);
    };
    
    if (audioRef.current) {
      audioRef.current.addEventListener('timeupdate', handleTimeUpdate);
      audioRef.current.addEventListener('durationchange', handleDurationChange);
      audioRef.current.addEventListener('ended', handleEnded);
      audioRef.current.addEventListener('error', handleError);
    }
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeEventListener('timeupdate', handleTimeUpdate);
        audioRef.current.removeEventListener('durationchange', handleDurationChange);
        audioRef.current.removeEventListener('ended', handleEnded);
        audioRef.current.removeEventListener('error', handleError);
        // Limpiar la fuente y pedir al navegador que aborte la carga si la hay
        audioRef.current.src = '';
        audioRef.current.removeAttribute('src'); // Para algunos navegadores
        audioRef.current.load(); // Esto aborta la descarga y resetea el elemento
      }
    };
  }, []); // El array de dependencias vacío es correcto aquí

  // Función para formatear segundos a formato MM:SS
  const formatTime = (time: number) => {
    if (isNaN(time)) return "00:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Función para manejar el cambio manual en la barra de progreso
  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setAudioCurrentTime(newTime);
    }
  };

  const togglePlayPause = async (callId: string) => {
    if (!audioRef.current) return;

    const callToPlay = allCalls.find(c => c.call_id === callId);
    if (!callToPlay?.recording_url) {
      console.error('Recording URL not found for callId:', callId);
      setPlayingId(null);
      return;
    }

    // Si es la pista actual y se está reproduciendo, la pausamos.
    if (playingId === callId && !audioRef.current.paused) {
      audioRef.current.pause();
      setPlayingId(null);
    } else {
      // Si es una nueva pista, o la pista actual está pausada, o era otra pista la que se reproducía.

      // Si la URL de la grabación es diferente a la actual en el reproductor.
      if (audioRef.current.src !== callToPlay.recording_url) {
        // Pausar si algo más se estaba reproduciendo.
        if (playingId && !audioRef.current.paused) {
          audioRef.current.pause();
        }
        audioRef.current.src = callToPlay.recording_url;
        audioRef.current.currentTime = 0; // Reiniciar tiempo del reproductor.
        setAudioCurrentTime(0);          // Reiniciar estado de tiempo actual para UI.
        setAudioDuration(0);             // Reiniciar estado de duración para UI (se actualizará con 'durationchange').
      }
      // Si es la misma URL y estaba pausada, currentTime ya está donde debe. La duración es conocida.

      try {
        await audioRef.current.play();
        setPlayingId(callId); // Marcar esta llamada como la que se está reproduciendo.
      } catch (error) {
        console.error('Error playing audio:', error);
        setPlayingId(null); // Limpiar estado de reproducción en caso de error.
      }
    }
  };

  // Modal functionality
  const openCallModal = (call: DetailedRetellCall) => {
    setSelectedCallModal(call);
    setSelectedCall(call.call_id);

    if (audioRef.current) { // Ensure audioRef is initialized
      if (call.recording_url) {
        // Recording URL is present
        if (audioRef.current.src !== call.recording_url) {
          // New source: pause if playing, set src, reset UI states, load.
          if (!audioRef.current.paused) {
            audioRef.current.pause();
          }
          // Clear playingId if the source is changing and something was marked as playing
          if (playingId) { 
            setPlayingId(null);
          }
          audioRef.current.src = call.recording_url;
          setAudioCurrentTime(0);
          setAudioDuration(0); // Explicitly reset duration state for UI
          audioRef.current.load(); // Load new source, should trigger 'durationchange'
        } else {
          // Same source: modal reopened for the same call.
          // Sync UI states with the audio element's current reality.
          setAudioCurrentTime(audioRef.current.currentTime);
          const currentAudioDuration = audioRef.current.duration;
          setAudioDuration(currentAudioDuration && isFinite(currentAudioDuration) && currentAudioDuration > 0 ? currentAudioDuration : 0);
        }
      } else {
        // No recording_url for this call. Clear the player.
        if (!audioRef.current.paused) {
          audioRef.current.pause();
        }
        if (audioRef.current.hasAttribute('src')) {
             audioRef.current.removeAttribute('src');
        }
        setAudioCurrentTime(0);
        setAudioDuration(0);
        audioRef.current.load(); // Reset the audio element to initial state.
        
        if (playingId === call.call_id) {
            setPlayingId(null);
        }
      }
    }
  };

  const closeCallModal = () => {
    setSelectedCallModal(null);
    setSelectedCall(null);
  };

  const togglePlayPauseModal = () => {
    if (selectedCallModal) {
      togglePlayPause(selectedCallModal.call_id);
    }
  };

  // Filter handlers
  const handleDisconnectionReasonFilter = (reason: string | null) => {
    setDisconnectionReasonFilter(reason);
    setCurrentPage(1); // Reset to first page when filter changes
  };

  const handleDurationFilter = (durationValue: string | null) => {
    setDurationFilter(durationValue);
    setCurrentPage(1); // Reset to first page when filter changes
  };


  // Función para exportar datos con columnas seleccionadas
  const buildCsvAndDownloadWithColumns = (dataToExport: any[], selectedColumns: string[], selectedMetadataFields: string[] = []) => {
    // Mapeo de nombres de columnas a etiquetas en español
    const columnLabels: Record<string, string> = {
      created_at: 'Fecha y Hora',
      duration: 'Duración',
      to_number: 'Número de Teléfono',
      summary: 'Resumen',
      transcript: 'Transcripción',
      end_reason: 'Razón de Desconexión',
      recordings: 'Grabaciones',
      call_id: 'ID de Llamada',
      interest: 'Interés',
      tipo_vivienda: 'Tipo de Vivienda',
      status: 'Estado',
      client_id: 'ID de Cliente',
      cost: 'Costo',
      from_number: 'Número de Origen',
      from_number_norm: 'Número de Origen Normalizado',
      to_number_norm: 'Número de Teléfono Normalizado'
    };

    // Agregar etiquetas para campos de metadata dinámicos
    selectedMetadataFields.forEach(field => {
      columnLabels[`metadata_${field}`] = `Metadata - ${field}`;
    });

    // Crear encabezados basados en las columnas seleccionadas y campos de metadata
    const allColumns = [...selectedColumns];
    selectedMetadataFields.forEach(field => {
      allColumns.push(`metadata_${field}`);
    });
    const headers = allColumns.map(col => columnLabels[col] || col);
    
    // Helper para formatear timestamp
    const formatTimestampUTC = (ts: number | string | undefined): string => {
      if (!ts) return '';
      if (typeof ts === 'string') {
        const d = new Date(ts);
        if (isNaN(d.getTime())) return ts;
        return d.toLocaleString('es-ES', { timeZone: 'UTC' });
      }
      const d = new Date(ts);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleString('es-ES', { timeZone: 'UTC' });
    };

    // Crear las filas de datos
    const rows = dataToExport.map(call => {
      const row: any = {};
      
      // Procesar columnas normales
      selectedColumns.forEach(column => {
        if (column === 'created_at') {
          row[column] = formatTimestampUTC(call[column]);
        } else if (column === 'duration') {
          // Formatear duración en MM:SS
          const duration = parseInt(call[column]) || 0;
          const minutes = Math.floor(duration / 60);
          const seconds = duration % 60;
          row[column] = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        } else {
          row[column] = call[column] || '';
        }
      });

      // Procesar campos de metadata dinámicos
      selectedMetadataFields.forEach(field => {
        const metadataKey = `metadata_${field}`;
        let fieldValue = '';
        
        // Debug: Log para verificar la estructura de metadata
        if (selectedMetadataFields.length > 0 && call.call_id) {
          console.log(`🔍 Procesando metadata para call ${call.call_id}:`, {
            metadata: call.metadata,
            field: field,
            isArray: Array.isArray(call.metadata),
            length: call.metadata?.length,
            fullCall: call // Ver toda la estructura de la llamada
          });
        }
        
        // Buscar el campo en la metadata de la llamada
        let metadataSource = null;
        
        // Intentar diferentes ubicaciones posibles para la metadata
        if (call.metadata) {
          metadataSource = call.metadata;
        } else if (call.metadata_llamadas) {
          metadataSource = call.metadata_llamadas;
        } else if (call.data && call.data.metadata) {
          metadataSource = call.data.metadata;
        } else if (call.data && call.data.metadata_llamadas) {
          metadataSource = call.data.metadata_llamadas;
        }
        
        if (metadataSource && Array.isArray(metadataSource) && metadataSource.length > 0) {
          // Si metadata es un array, buscar en el primer elemento
          const metadataObj = metadataSource[0];
          if (metadataObj && metadataObj[field] !== undefined) {
            fieldValue = String(metadataObj[field]);
            console.log(`🔍 Valor encontrado para ${field}:`, fieldValue);
          }
        } else if (metadataSource && typeof metadataSource === 'object' && !Array.isArray(metadataSource)) {
          // Si metadata es un objeto directo (no array)
          if (metadataSource[field] !== undefined) {
            fieldValue = String(metadataSource[field]);
            console.log(`🔍 Valor encontrado para ${field}:`, fieldValue);
          }
        }
        
        row[metadataKey] = fieldValue;
      });
      
      return row;
    });
    
    // Convertir a CSV
    let csvContent = headers.join(',') + '\n';
    
    rows.forEach(row => {
      const values = allColumns.map(column => {
        // Escapar comillas y valores que contengan comas
        const value = String(row[column] || '').replace(/"/g, '""');
        return value.includes(',') ? `"${value}"` : value;
      });
      csvContent += values.join(',') + '\n';
    });
    
    // Crear un blob y descargar
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `grabaciones_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Abrir modal de exportación
  const openExportModal = () => {
    // Prefill con rango actual si existe
    if (startDate) {
      const d = new Date(startDate);
      setExportStartDate(startDate.split('T')[0] || '');
      setExportStartTime(`${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`);
    } else {
      setExportStartDate('');
      setExportStartTime('');
    }
    if (endDate) {
      const d = new Date(endDate);
      setExportEndDate(endDate.split('T')[0] || '');
      setExportEndTime(`${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`);
    } else {
      setExportEndDate('');
      setExportEndTime('');
    }
    setExportError(null);
    
    // Validar y cargar metadata del session storage al abrir el modal
    try {
      const storedMetadata = sessionStorage.getItem('metadata_llamadas');
      console.log('🔍 [openExportModal] Metadata del session storage:', storedMetadata);
      
      if (storedMetadata) {
        const metadataArray = JSON.parse(storedMetadata);
        console.log('🔍 [openExportModal] Metadata parseada:', metadataArray);
        
        if (Array.isArray(metadataArray) && metadataArray.length > 0) {
          // Si es un array, obtener las claves del primer objeto
          const fields = Object.keys(metadataArray[0]);
          console.log('🔍 [openExportModal] Campos de metadata encontrados (array):', fields);
          
          setAvailableMetadataFields(fields);
          
          const initialFields: Record<string, boolean> = {};
          fields.forEach(field => {
            initialFields[field] = false;
          });
          setMetadataFields(initialFields);
        } else if (typeof metadataArray === 'object' && metadataArray !== null) {
          // Si es un objeto directo, obtener sus claves
          const fields = Object.keys(metadataArray);
          console.log('🔍 [openExportModal] Campos de metadata encontrados (objeto):', fields);
          
          setAvailableMetadataFields(fields);
          
          const initialFields: Record<string, boolean> = {};
          fields.forEach(field => {
            initialFields[field] = false;
          });
          setMetadataFields(initialFields);
        }
      }
    } catch (error) {
      console.error('Error al cargar metadata del session storage en openExportModal:', error);
    }
    
    setShowExportModal(true);
  };

  // Confirmar exportación: traer todas las llamadas sin paginación y exportar CSV
  const confirmExport = async () => {
    if (!apiKey || !clientId) {
      setExportError('Falta autenticación o cliente.');
      return;
    }
    // Validación de fechas
    if (!exportStartDate && !exportEndDate) {
      setExportError('Selecciona al menos una fecha (inicio o fin).');
      return;
    }
    
    // Validar que se hayan seleccionado columnas
    const selectedColumns = Object.entries(exportColumns)
      .filter(([_, selected]) => selected)
      .map(([column, _]) => column);
    
    if (selectedColumns.length === 0) {
      setExportError('Selecciona al menos una columna para exportar.');
      return;
    }
    
    setExportLoading(true);
    setExportError(null);
    try {
      // Construir fechas UTC sin convertir husos: agregar 'Z' explícito
      let startISO: string | undefined;
      let endISO: string | undefined;
      if (exportStartDate) {
        const hhmm = exportStartTime ? exportStartTime : '00:00';
        startISO = `${exportStartDate}T${hhmm}:00Z`;
      }
      if (exportEndDate) {
        const hhmm = exportEndTime ? exportEndTime : '23:59';
        endISO = `${exportEndDate}T${hhmm}:59Z`;
      }

      // Obtener campos de metadata seleccionados
      const selectedMetadataFields = Object.entries(metadataFields)
        .filter(([_, selected]) => selected)
        .map(([field, _]) => field);

      // Si hay campos de metadata seleccionados, agregar 'metadata' a las columnas
      const finalSelectedColumns = [...selectedColumns];
      if (selectedMetadataFields.length > 0 && !finalSelectedColumns.includes('metadata')) {
        finalSelectedColumns.push('metadata');
        console.log('🔍 Agregando metadata a las columnas solicitadas:', finalSelectedColumns);
        console.log('🔍 Campos de metadata seleccionados:', selectedMetadataFields);
      }

      // Construir filtros para exportación con columnas seleccionadas
      const params: any = {
        client_id: clientId,
        columns: finalSelectedColumns,
        sort_order: sortOrderFilter
      };
      if (statusFilter) params.status = statusFilter;
      
      // Agregar filtro de número de teléfono (normalizar el número)
      if (phoneNumberFilter) {
        const normalizedPhone = normalizePhoneNumber(phoneNumberFilter);
        console.log('Exportación - Número original:', phoneNumberFilter);
        console.log('Exportación - Número normalizado:', normalizedPhone);
        params.to_number_norm = normalizedPhone;
      }
      
      if (startISO) params.fecha_inicio = startISO;
      if (endISO) params.fecha_fin = endISO;

      // Usar el nuevo endpoint con columnas seleccionadas
      const allResp = await exportCallsWithColumns(apiKey, params);
      const allForExport = allResp.calls;

      // Aplicar filtro de disconnection_reason solo a nivel frontend si está seleccionado
      const finalData = disconnectionReasonFilter
        ? allForExport.filter(c => c.disconnection_reason === disconnectionReasonFilter)
        : allForExport;

      if (!finalData.length) {
        setExportError('No hay grabaciones en el rango seleccionado.');
        setExportLoading(false);
        return;
      }

      buildCsvAndDownloadWithColumns(finalData as any, selectedColumns, selectedMetadataFields);
      setShowExportModal(false);
    } catch (err: any) {
      setExportError(err?.message || 'Error al exportar.');
    } finally {
      setExportLoading(false);
    }
  };


  // Reset all filters
  const resetAllFilters = () => {
    // Marcar que estamos aplicando filtros manualmente
    isApplyingFilters.current = true;
    
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
    setStatusFilter(null);
    setDisconnectionReasonFilter(null);
    setDurationFilter(null);
    setPhoneNumberFilter('');
    setSortOrderFilter('DESC'); // Resetear a descendente por defecto
    setCurrentPage(1);
    
    // Limpiar datos filtrados
    setFilteredCallsData([]);
    setTotalFilteredCalls(0);
    setTotalFilteredPages(0);
    
    // Limpiar filtros en el contexto
    contextSetFilterCriteria({});
    
    // Recargar datos sin filtros
    loadAllCalls(true).finally(() => {
      isApplyingFilters.current = false;
    });
  };

  // Calcular el recuento total de filtros aplicados
  const activeFiltersCount = React.useMemo(() => {
    let count = 0;
    if (searchTerm) count++;
    if (startDate || endDate) count++;
    if (statusFilter) count++;
    if (disconnectionReasonFilter) count++;
    if (durationFilter) count++;
    if (phoneNumberFilter) count++;
    if (sortOrderFilter !== 'DESC') count++; // Contar solo si no es el valor por defecto
    return count;
  }, [searchTerm, startDate, endDate, statusFilter, disconnectionReasonFilter, durationFilter, phoneNumberFilter, sortOrderFilter]);

  // Custom audio player para el modal
  const AudioPlayer = () => {
    if (!selectedCallModal?.recording_url) return null;
    
    return (
      <Card className="bg-white shadow-sm border-slate-200">
        <CardContent className="p-4">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Reproductor</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <button
                onClick={togglePlayPauseModal}
                className="p-3 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-full hover:from-blue-700 hover:to-indigo-800 transition-colors"
              >
                {playingId === selectedCallModal.call_id ? (
                  <Pause className="w-6 h-6 text-white" />
                ) : (
                  <Play className="w-6 h-6 text-white" />
                )}
              </button>
              
              <a
                href={selectedCallModal.recording_url}
                download
                className="p-3 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"
              >
                <Download className="w-6 h-6 text-slate-700" />
              </a>
            </div>
            
            {/* Barra de progreso */}
            <div className="space-y-2">
              <div className="flex items-center">
                <input
                  type="range"
                  min="0"
                  max={audioDuration || 100}
                  value={audioCurrentTime}
                  onChange={handleProgressChange}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  style={{
                    background: `linear-gradient(to right, #2563eb 0%, #2563eb ${(audioCurrentTime / (audioDuration || 1)) * 100}%, #e2e8f0 ${(audioCurrentTime / (audioDuration || 1)) * 100}%, #e2e8f0 100%)`
                  }}
                />
              </div>
              
              <div className="flex justify-between text-xs text-slate-600">
                <span>{formatTime(audioCurrentTime)}</span>
                <span>{formatTime(audioDuration)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Función para aplicar filtros usando la API list-calls
  const applyFilters = React.useCallback(async () => {
    if (!apiKey) return;
    
    // Verificar si hay algún filtro activo (excluyendo disconnection_reason que se aplica solo en frontend)
    // Ahora también incluimos sortOrderFilter como filtro activo
    const hasActiveFilters = searchTerm || statusFilter || durationFilter || startDate || endDate || phoneNumberFilter || sortOrderFilter !== 'DESC';
    
    if (!hasActiveFilters) {
      // Si no hay filtros, usar las llamadas originales
      setFilteredCallsData([]);
      setTotalFilteredCalls(0);
      setTotalFilteredPages(0);
      return;
    }
    
    setLoadingFilters(true);
    setError(null);
    
    try {
      // Construir parámetros para la API (excluyendo disconnection_reason)
      const params: any = {
        page: 1,
        per_page: 100,
        sort_order: sortOrderFilter // Usar el filtro de ordenamiento
      };
      
      // Usar el client_id del contexto
      if (clientId) {
        params.client_id = clientId;
        console.log('Usando client_id para filtros:', clientId);
      } else {
        console.warn('No se encontró client_id en el contexto');
        setError('Error: No se pudo identificar el cliente');
        return;
      }
      
      // Agregar filtros de estado
      if (statusFilter) {
        params.status = statusFilter;
      }
      
      // Agregar filtro de número de teléfono (normalizar el número)
      if (phoneNumberFilter) {
        const normalizedPhone = normalizePhoneNumber(phoneNumberFilter);
        console.log('Número original:', phoneNumberFilter);
        console.log('Número normalizado:', normalizedPhone);
        params.to_number_norm = normalizedPhone;
      }
      
      // Agregar filtros de fecha (ya en formato ISO)
      if (startDate) {
        params.fecha_inicio = startDate;
      }
      if (endDate) {
        params.fecha_fin = endDate;
      }
      
      // Agregar filtros de número (si se implementan en el futuro)
      // if (fromNumber) params.from_number = fromNumber;
      // if (toNumber) params.to_number = toNumber;
      
      console.log('Aplicando filtros con parámetros:', params);
      
      // Hacer la petición a la API
      const response = await listCalls(apiKey, params);
      
      console.log('Respuesta de list-calls:', response);
      
      // Actualizar estados con los resultados
      setFilteredCallsData(response.calls);
      setTotalFilteredCalls(response.total_calls || response.calls.length);
      setTotalFilteredPages(response.total_pages || 1);
      
      // Resetear a la primera página
      setCurrentPage(1);
      
    } catch (error) {
      console.error('Error al aplicar filtros:', error);
      setError(error instanceof Error ? error.message : 'Error al aplicar filtros');
      setFilteredCallsData([]);
      setTotalFilteredCalls(0);
      setTotalFilteredPages(0);
    } finally {
      setLoadingFilters(false);
    }
  }, [apiKey, clientId, searchTerm, statusFilter, durationFilter, startDate, endDate, phoneNumberFilter, sortOrderFilter]);

  // Aplicar filtros automáticamente cuando cambien los criterios
  React.useEffect(() => {
    // Solo aplicar filtros si hay algún filtro activo
    const hasActiveFilters = searchTerm || statusFilter || durationFilter || startDate || endDate || phoneNumberFilter || sortOrderFilter !== 'DESC';
    
    if (hasActiveFilters) {
      applyFilters();
    } else {
      // Si no hay filtros, limpiar los datos filtrados
      setFilteredCallsData([]);
      setTotalFilteredCalls(0);
      setTotalFilteredPages(0);
    }
  }, [searchTerm, statusFilter, durationFilter, startDate, endDate, phoneNumberFilter, sortOrderFilter, applyFilters]);

  // Función para abrir el modal de filtros
  const openFiltersModal = () => {
    // Extraer solo la parte de la fecha (sin la hora) de las fechas existentes
    if (startDate && startDate.includes('T')) {
      setTempStartDate(startDate.split('T')[0]);
    } else {
      setTempStartDate(startDate);
    }
    
    if (endDate && endDate.includes('T')) {
      setTempEndDate(endDate.split('T')[0]);
    } else {
      setTempEndDate(endDate);
    }
    
    // Extraer la hora de las fechas existentes si están en formato ISO
    if (startDate && startDate.includes('T')) {
      const startDateTime = new Date(startDate);
      setTempStartTime(startDateTime.toTimeString().slice(0, 5));
    } else {
      setTempStartTime('');
    }
    if (endDate && endDate.includes('T')) {
      const endDateTime = new Date(endDate);
      setTempEndTime(endDateTime.toTimeString().slice(0, 5));
    } else {
      setTempEndTime('');
    }
    setShowFiltersModal(true);
  };

  // Función para cerrar el modal de filtros
  const closeFiltersModal = () => {
    setShowFiltersModal(false);
  };

  // Función para aplicar filtros desde el modal
  const applyFiltersFromModal = async () => {
    // Combinar fecha y hora en formato ISO
    let startDateTime = tempStartDate;
    let endDateTime = tempEndDate;
    
    if (tempStartDate && tempStartTime) {
      startDateTime = `${tempStartDate}T${tempStartTime}:00`;
    } else if (tempStartDate) {
      startDateTime = `${tempStartDate}T00:00:00`;
    }
    
    if (tempEndDate && tempEndTime) {
      endDateTime = `${tempEndDate}T${tempEndTime}:00`;
    } else if (tempEndDate) {
      endDateTime = `${tempEndDate}T23:59:59`;
    }
    
    setStartDate(startDateTime);
    setEndDate(endDateTime);
    setShowFiltersModal(false);
    
    // Marcar que estamos aplicando filtros manualmente
    isApplyingFilters.current = true;
    
    try {
      // Crear el criterio de filtro
      const criteria: FilterCriteria = {};
      if (startDateTime || endDateTime) {
        criteria.date_range = {};
        if (startDateTime) criteria.date_range.start = startDateTime;
        if (endDateTime) criteria.date_range.end = endDateTime;
      }
      
      // Actualizar los filtros en el contexto para futuras referencias
      contextSetFilterCriteria(criteria);
      
      // Recargar los datos pasando los criterios directamente
      await loadAllCalls(true);
    } finally {
      // Quitar el flag después de completar la operación
      isApplyingFilters.current = false;
    }
  };

  // Función para limpiar filtros desde el modal
  const clearFiltersFromModal = () => {
    setTempStartDate('');
    setTempEndDate('');
    setTempStartTime('');
    setTempEndTime('');
  };

  return (
    <div className="p-8 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Grabaciones</h2>
        <div className="flex flex-wrap items-center gap-2 text-slate-600">
          <p>Escucha y analiza las conversaciones de IA</p>
          
          {/* Estado de carga de todas las llamadas */}
          {loadingAllCalls ? (
            <div className="flex items-center">
              <Badge variant="secondary" className="animate-pulse">
                <svg className="animate-spin mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="font-bold">Cargando TODAS las llamadas: </span>
                <span className="font-bold ml-1">{loadingProgress.toLocaleString()}</span> hasta ahora
              </Badge>
            </div>
          ) : (
            <>
              {/* Número total de llamadas */}
              <Badge variant="default">
                <span className="mr-1">{totalCallsDisplay?.toLocaleString()}</span> 
                {totalCallsLabel}
                {allCallsLoaded && (
                  <svg className="ml-2 w-4 h-4 text-green-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </Badge>
              
              {/* Indicador de filtros activos y totales */}
              {activeFiltersCount > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {activeFiltersCount} {activeFiltersCount === 1 ? 'filtro' : 'filtros'} activo{activeFiltersCount !== 1 ? 's' : ''}
                  </Badge>
                  <Badge variant="secondary">
                    {filteredCalls.length.toLocaleString()} {filteredCalls.length === 1 ? 'coincidencia' : 'coincidencias'}
                  </Badge>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Card className="bg-white shadow-lg border-0">
        <CardHeader className="border-b border-slate-200 pb-4 bg-gradient-to-r from-slate-50 to-blue-50">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle className="text-slate-800">Grabaciones</CardTitle>
            
            <div className="flex items-center gap-2">
              <Button
                onClick={() => loadAllCalls(true)}
                disabled={loadingAllCalls}
                variant={loadingAllCalls ? "secondary" : "default"}
              >
                {loadingAllCalls ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Cargando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Actualizar datos
                  </>
                )}
              </Button>
              
              {/* Botón para exportar a Excel */}
              <Button 
                onClick={openExportModal} 
                variant="outline" 
                size="sm"
                className="text-gray-400"
                disabled={loadingAllCalls}
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar CSV
              </Button>
              
              {/* Botón para personalizar columnas */}
              <div className="relative">
                <Button 
                  onClick={() => setShowColumnCustomizer(!showColumnCustomizer)} 
                  variant="outline" 
                  size="sm"
                  className="text-gray-400 column-customizer-button"
                >
                  <ListFilter className="h-4 w-4 mr-2" />
                  Columnas
                </Button>
                
                {showColumnCustomizer && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-xl z-50 border border-slate-200 column-customizer-dropdown">
                    <div className="p-3 border-b border-slate-200">
                      <h3 className="text-sm font-medium text-slate-800">Personalizar columnas</h3>
                      <p className="text-xs text-slate-600 mt-1">Selecciona las columnas que deseas ver</p>
                    </div>
                    <div className="p-3 space-y-2">
                      {Object.entries({
                        callId: 'ID de llamada',
                        status: 'Estado',
                        timestamp: 'Fecha y hora',
                        duration: 'Duración',
                        disconnectionReason: 'Razón de desconexión',
                        callType: 'Tipo de llamada',
                        agent: 'Agente',
                        fromNumber: 'Número de Origen',
                        toNumber: 'Número de Teléfono' // Etiqueta actualizada
                      }).map(([key, label]) => (
                        <div key={key} className="flex items-center">
                          <input
                            type="checkbox"
                            id={`column-${key}`}
                            checked={visibleColumns[key as keyof typeof visibleColumns]}
                            onChange={() => {
                              setVisibleColumns({
                                ...visibleColumns,
                                [key]: !visibleColumns[key as keyof typeof visibleColumns]
                              });
                            }}
                            className="rounded bg-white border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <label htmlFor={`column-${key}`} className="ml-2 text-sm text-slate-700">
                            {label}
                          </label>
                        </div>
                      ))}
                    </div>
                    <div className="p-3 border-t border-slate-200 flex justify-between">
                      <Button 
                        onClick={() => {
                          setVisibleColumns({
                            callId: true,
                            status: false,
                            timestamp: true,
                            duration: true,
                            disconnectionReason: true,
                            callType: true,
                            agent: false,
                            fromNumber: false,
                            toNumber: true // Asegurar que el reset también lo ponga visible
                          });
                        }}
                        variant="outline" 
                        size="sm"
                      >
                        Restablecer
                      </Button>
                      <Button 
                        onClick={() => setShowColumnCustomizer(false)} 
                        size="sm"
                      >
                        Aplicar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              
              <Button 
                onClick={resetAllFilters} 
                variant="outline" 
                size="sm"
                className="text-gray-400"
              >
                Limpiar filtros
              </Button>
            </div>
          </div>
          
          {/* Mostrar progreso de carga si está cargando */}
          {loadingAllCalls && (
            <div className="mt-4">
              <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
                <span className="font-medium">Cargando grabaciones...</span>
                <span>Página {contextCurrentPage} de {contextTotalPages || '?'}</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-3 mb-1 overflow-hidden border border-slate-300">
                <div 
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 h-3 rounded-full transition-all duration-500 ease-in-out"
                  style={{ 
                    width: '100%',
                    animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                  }}
                ></div>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-600">
                <p className="flex items-center">
                  <svg className="animate-spin mr-1 h-3 w-3 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Obteniendo datos...
                </p>
                <p className="text-blue-600 font-medium">
                  {allCalls.length} llamadas cargadas
                </p>
              </div>
            </div>
          )}
          
          {/* Mostrar progreso de filtros si está cargando filtros */}
          {loadingFilters && (
            <div className="mt-4">
              <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
                <span className="font-medium">Aplicando filtros...</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-3 mb-1 overflow-hidden border border-slate-300">
                <div 
                  className="bg-gradient-to-r from-green-600 to-emerald-600 h-3 rounded-full transition-all duration-500 ease-in-out"
                  style={{ 
                    width: '100%',
                    animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                  }}
                ></div>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-600">
                <p className="flex items-center">
                  <svg className="animate-spin mr-1 h-3 w-3 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Consultando API...
                </p>
                <p className="text-green-600 font-medium">
                  Filtros en progreso
                </p>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="pt-6 bg-white">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3 mb-6">
            {/* Botón para abrir modal de filtros de fechas */}
            <div className="lg:col-span-2">
              <Button 
                onClick={openFiltersModal}
                variant="outline"
                className="w-full h-10 flex items-center justify-center gap-2 text-xs"
              >
                <ListFilter className="w-4 h-4" />
                {startDate || endDate ? (
                  <span className="text-xs truncate">
                    {startDate && endDate ? 
                      `${new Date(startDate).toLocaleDateString('es-ES')} - ${new Date(endDate).toLocaleDateString('es-ES')}` : 
                     startDate ? `Desde ${new Date(startDate).toLocaleDateString('es-ES')}` : 
                     `Hasta ${new Date(endDate).toLocaleDateString('es-ES')}`}
                  </span>
                ) : (
                  <span className="text-xs">Fechas</span>
                )}
              </Button>
            </div>

            {/* Filtro de estado */}
            <div className="lg:col-span-2">
              <Select
                value={statusFilter || "all"}
                onValueChange={(value) => {
                  setStatusFilter(value === "all" ? null : value);
                  setCurrentPage(1);
                }}
                className="w-full"
              >
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="efectiva">Efectiva</SelectItem>
                <SelectItem value="fallida">Fallida</SelectItem>
              </Select>
            </div>

            {/* Filtro de duración */}
            <div className="lg:col-span-2">
              <Select
                value={durationFilter || "all"}
                onValueChange={(value) => handleDurationFilter(value === "all" ? null : value)}
                className="w-full"
              >
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="lt-60">{'<'} 1 min</SelectItem>
                <SelectItem value="60-180">1-3 min</SelectItem>
                <SelectItem value="180-300">3-5 min</SelectItem>
                <SelectItem value="gt-300">{'>'} 5 min</SelectItem>
              </Select>
            </div>
            
            {/* Filtro de ordenamiento */}
            <div className="lg:col-span-2">
              <Select
                value={sortOrderFilter}
                onValueChange={(value) => {
                  setSortOrderFilter(value as 'ASC' | 'DESC');
                  setCurrentPage(1);
                }}
                className="w-full"
              >
                <SelectItem value="DESC">Más recientes</SelectItem>
                <SelectItem value="ASC">Más antiguos</SelectItem>
              </Select>
            </div>
            
            {/* Filtro por número de teléfono */}
            <div className="lg:col-span-2">
              <div className="relative">
                <Phone className="w-5 h-5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  type="text"
                  placeholder="Número..."
                  value={phoneNumberFilter}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setPhoneNumberFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10"
                />
                {phoneNumberFilter && (
                  <button
                    onClick={() => {
                      setPhoneNumberFilter('');
                      setCurrentPage(1);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            
            {/* Filtro de disconnection_reason (solo frontend) */}
            <div className="lg:col-span-2">
              <Select
                value={disconnectionReasonFilter || "all"}
                onValueChange={(value) => handleDisconnectionReasonFilter(value === "all" ? null : value)}
                className="w-full"
              >
                <SelectItem value="all">Todas</SelectItem>
                {contextDisconnectionReasons.map(reason => (
                  <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                ))}
              </Select>
            </div>
            
            {/* Búsqueda */}
            <div className="lg:col-span-12 md:col-span-2 relative">
              <div className="relative">
                <Search className="w-5 h-5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  type="text"
                  placeholder="Buscar grabación..."
                  value={searchTerm}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1); // Reset to first page when search changes
                  }}
                  className="pl-10"
                />
                {searchTerm && (
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setCurrentPage(1);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Contenido principal */}
          {loadingAllCalls || loadingFilters ? (
            <RecordingsSkeleton />
          ) : error ? (
            <div className="py-10 text-center">
              <p className="text-red-500">Error: {error}</p>
              <Button onClick={() => loadAllCalls(true)} className="mt-4">
                Intentar nuevamente
              </Button>
            </div>
          ) : filteredCalls.length === 0 ? (
            <div className="py-16 text-center">
              <PhoneOff className="mx-auto h-12 w-12 text-slate-400 mb-4" />
              <h3 className="text-xl font-medium text-slate-800 mb-2">No se encontraron grabaciones</h3>
              <p className="text-slate-600 max-w-md mx-auto mb-6">
                {searchTerm || startDate || endDate || statusFilter || disconnectionReasonFilter || durationFilter || phoneNumberFilter
                  ? "No hay grabaciones que coincidan con tus filtros. Intenta ajustar los criterios de búsqueda."
                  : "Aún no hay grabaciones disponibles en tu cuenta."}
              </p>
              <Button onClick={resetAllFilters} className="mr-2">
                Limpiar filtros
              </Button>
              <Button variant="outline" onClick={() => loadAllCalls(true)}>
                Actualizar datos
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-4 mb-6">
                {calls.map((call) => (
                  <Card 
                    key={call.call_id} 
                    className={`overflow-hidden transition-all duration-200 hover:border-blue-400 cursor-pointer bg-white shadow-sm ${selectedCall === call.call_id ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-200'}`}
                    onClick={() => openCallModal(call)}
                  >
                    <CardContent className="p-4">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            {visibleColumns.status && (
                              <Badge variant={call.call_status === 'completed' ? 'default' : 'secondary'}>
                                {call.call_status === 'completed' ? 'Completada' : 'En progreso'}
                              </Badge>
                            )}
                            {visibleColumns.timestamp && (
                              <span className="text-sm text-slate-600">
                                {(() => {
                                  const raw = (call as any).start_time || (call as any).created_at || (call as any).metadata?.created_at || call.start_timestamp;
                                  const d = new Date(raw);
                                  return isNaN(d.getTime()) ? '' : d.toLocaleString('es-ES', { timeZone: 'UTC' });
                                })()}
                              </span>
                            )}
                          </div>
                          
                          {visibleColumns.callId && (
                            <h3 className="text-lg font-medium text-slate-800">
                              ID: {call.call_id.substring(0, 14)}...
                            </h3>
                          )}
                          
                          {visibleColumns.agent && call.agent_id && (
                            <div className="text-sm text-slate-600">
                              <span className="font-medium">Agente:</span> {call.agent_id}
                            </div>
                          )}
                          
                          {visibleColumns.fromNumber && call.from_number && (
                            <div className="text-sm text-slate-600">
                              <span className="font-medium">Origen:</span> {call.from_number}
                            </div>
                          )}
                          
                          {visibleColumns.toNumber && call.to_number && (
                            <div className="text-sm text-slate-600">
                              <span className="font-medium">Teléfono:</span> {call.to_number} {/* Etiqueta actualizada en la tabla */}
                            </div>
                          )}
                          
                          <div className="flex flex-wrap gap-2">
                            {visibleColumns.duration && (
                              <div className="flex items-center text-sm text-slate-600">
                                <Clock className="w-4 h-4 mr-1" />
                                {getDuration(call)}
                              </div>
                            )}
                            
                            {visibleColumns.disconnectionReason && call.disconnection_reason && (
                              <div className="flex items-center text-sm text-slate-600">
                                <PhoneOff className="w-4 h-4 mr-1" />
                                {call.disconnection_reason}
                              </div>
                            )}
                            
                            {visibleColumns.callType && call.call_type && (
                              <div className="text-sm text-slate-600">
                                Tipo: {call.call_type}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {call.recording_url && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePlayPause(call.call_id);
                              }}
                              className="p-2 rounded-full bg-slate-100 hover:bg-blue-100 transition-colors"
                            >
                              {playingId === call.call_id ? (
                                <Pause className="w-5 h-5 text-blue-600" />
                              ) : (
                                <Play className="w-5 h-5 text-blue-600" />
                              )}
                            </button>
                          )}
                          
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              openCallModal(call);
                            }}
                            variant="default"
                            size="sm"
                          >
                            Ver detalles
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              {/* Paginación */}
              {totalPages > 1 && (
                <div className="flex justify-between items-center py-4 border-t border-slate-200">
                  <div className="flex items-center text-sm text-slate-600">
                    {/* Mostrar información correcta según si hay filtros o no */}
                    {filteredCallsData.length > 0 ? (
                      <>
                        Mostrando {(currentPage - 1) * itemsPerPage + 1}-
                        {Math.min(currentPage * itemsPerPage, filteredCalls.length)} de {totalFilteredCalls} grabaciones filtradas
                      </>
                    ) : searchTerm || statusFilter || durationFilter || startDate || endDate || phoneNumberFilter || sortOrderFilter !== 'DESC' ? (
                      <>
                        Mostrando {(currentPage - 1) * itemsPerPage + 1}-
                        {Math.min(currentPage * itemsPerPage, filteredCalls.length)} de {filteredCalls.length} grabaciones filtradas
                      </>
                    ) : (
                      <>
                        Mostrando {(currentPage - 1) * itemsPerPage + 1}-
                        {Math.min(currentPage * itemsPerPage, totalCallsDisplay || 0)} 
                        {contextTotalPages > 0 && hasMorePages && ' de muchas más'} grabaciones
                      </>
                    )}
                  </div>
                  
                  <div className="flex items-center">
                    <div className="mr-4 relative items-per-page-dropdown">
                      <div 
                        className="flex items-center text-sm cursor-pointer"
                        onClick={() => setShowItemsPerPageDropdown(!showItemsPerPageDropdown)}
                      >
                        <span className="text-slate-600 mr-2">Mostrar:</span>
                        <span className="text-slate-800">{itemsPerPage}</span>
                        {showItemsPerPageDropdown ? (
                          <ChevronUp className="w-4 h-4 ml-1 text-slate-500" />
                        ) : (
                          <ChevronDown className="w-4 h-4 ml-1 text-slate-500" />
                        )}
                      </div>
                      
                      {showItemsPerPageDropdown && (
                        <div className="absolute mt-2 py-1 bg-white border border-slate-200 rounded-md shadow-lg z-10 w-24 right-0">
                          {itemsPerPageOptions.map(option => (
                            <div
                              key={option}
                              className={`px-4 py-2 text-sm cursor-pointer hover:bg-slate-100 ${option === itemsPerPage ? 'text-blue-600' : 'text-slate-700'}`}
                              onClick={() => handleItemsPerPageChange(option)}
                            >
                              {option}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex justify-center items-center">
                      <PaginationPrevious
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                      />
                      
                      <div className="flex space-x-1 mx-2">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNumber;
                          if (totalPages <= 5) {
                            pageNumber = i + 1;
                          } else if (currentPage <= 3) {
                            pageNumber = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNumber = totalPages - 4 + i;
                          } else {
                            pageNumber = currentPage - 2 + i;
                          }
                          
                          return (
                            <PaginationButton
                              key={pageNumber}
                              onClick={() => handlePageChange(pageNumber)}
                              isActive={pageNumber === currentPage}
                            >
                              {pageNumber}
                            </PaginationButton>
                          );
                        })}
                      </div>
                      
                      <PaginationNext
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal para mostrar toda la información detallada */}
      {selectedCallModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col bg-white shadow-2xl">
            <CardHeader className="border-b border-slate-200 flex justify-between items-center sticky top-0 bg-gradient-to-r from-slate-50 to-blue-50 p-4">
              <div className="flex items-center">
                <Phone className="w-5 h-5 text-blue-600 mr-2" />
                <h2 className="text-xl font-bold text-slate-800">{selectedCallModal.call_id}</h2>
              </div>
              <button 
                onClick={closeCallModal}
                className="p-1 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-slate-500 hover:text-slate-700" />
              </button>
            </CardHeader>
            
            <div className="overflow-y-auto p-6 flex-grow bg-white">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <Card className="bg-white shadow-sm border-slate-200">
                  <CardContent className="p-4">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4">Información Básica</h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-slate-600">ID del Agente</p>
                        <p className="text-slate-800">{selectedCallModal.agent_id}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Estado de la Llamada</p>
                        <p className="text-slate-800">{selectedCallModal.call_status}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Tipo de Llamada</p>
                        <p className="text-slate-800">{selectedCallModal.call_type}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Fecha y Hora</p>
                        <p className="text-slate-800">{(() => {
                          const raw = (selectedCallModal as any).start_time || (selectedCallModal as any).created_at || (selectedCallModal as any).metadata?.created_at || selectedCallModal.start_timestamp;
                          const d = new Date(raw);
                          return isNaN(d.getTime()) ? '' : d.toLocaleString('es-ES', { timeZone: 'UTC' });
                        })()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Duración</p>
                        <p className="text-slate-800 flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          {getDuration(selectedCallModal)}
                        </p>
                      </div>
                      {/* Metadatos adicionales si están disponibles */}
                      {selectedCallModal.from_number && (
                        <div>
                          <p className="text-sm text-slate-600">Número de Origen</p>
                          <p className="text-slate-800">{selectedCallModal.from_number}</p>
                        </div>
                      )}
                      {selectedCallModal.to_number && (
                        <div>
                          <p className="text-sm text-slate-600">Número de Destino</p>
                          <p className="text-slate-800">{selectedCallModal.to_number}</p>
                        </div>
                      )}
                      {selectedCallModal.metadata?.direction && (
                        <div>
                          <p className="text-sm text-slate-600">Dirección</p>
                          <p className="text-slate-800 capitalize">{selectedCallModal.metadata.direction}</p>
                        </div>
                      )}
                      {selectedCallModal.call_cost && (
                        <div>
                          <p className="text-sm text-slate-600">Costo Total</p>
                          <p className="text-slate-800">{formatCost(selectedCallModal.call_cost.total_cost || 0)}</p>
                        </div>
                      )}
                      {selectedCallModal.disconnection_reason && (
                        <div>
                          <p className="text-sm text-slate-600">Razón de Desconexión</p>
                          <p className="text-slate-800">{selectedCallModal.disconnection_reason}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
                
                <div className="space-y-6">
                  {/* Reproductor de audio con barra de progreso */}
                  {selectedCallModal.recording_url && <AudioPlayer />}
                  
                  {selectedCallModal.call_analysis && (
                    <Card className="bg-white shadow-sm border-slate-200">
                      <CardContent className="p-4">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4">Análisis de la Llamada</h3>
                        <div className="space-y-3">
                          {selectedCallModal.call_analysis.sentiment && (
                            <div>
                              <p className="text-sm text-slate-600">Sentimiento</p>
                              <p className="text-slate-800">{selectedCallModal.call_analysis.sentiment}</p>
                            </div>
                          )}
                          {selectedCallModal.call_analysis.topics && selectedCallModal.call_analysis.topics.length > 0 && (
                            <div>
                              <p className="text-sm text-slate-600">Temas</p>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {selectedCallModal.call_analysis.topics.map((topic, index) => (
                                  <Badge key={index} variant="secondary">{topic}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* Datos de análisis personalizados (si existen) */}
                          {selectedCallModal.call_analysis?.custom_analysis_data && Object.keys(selectedCallModal.call_analysis.custom_analysis_data).length > 0 && (
                            <div>
                              <p className="text-sm text-slate-600">Datos de Análisis Personalizados</p>
                              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                {Object.entries(selectedCallModal.call_analysis.custom_analysis_data).map(([key, value]) => (
                                  <div key={key} className="flex justify-between border-b border-slate-200 py-2 last:border-0">
                                    <span className="text-slate-700 font-medium capitalize">{key}:</span>
                                    <span className="text-slate-800">{String(value)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
              
              {/* Sección de la transcripción con formato mejorado */}
              {selectedCallModal.transcript && (
                <Card className="mb-6 bg-white shadow-sm border-slate-200">
                  <CardHeader className="pb-2">
                    <h3 className="text-lg font-semibold text-slate-800">Transcripción</h3>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      {selectedCallModal.transcript.split('\n').map((line, index) => {
                        const isAssistant = line.toLowerCase().startsWith('asistente:') || 
                                           line.toLowerCase().startsWith('agente:') || 
                                           line.toLowerCase().startsWith('ai:') ||
                                           line.toLowerCase().startsWith('agent:');
                        const isUser = line.toLowerCase().startsWith('usuario:') || 
                                      line.toLowerCase().startsWith('cliente:') ||
                                      line.toLowerCase().startsWith('user:');
                        
                        let speakerClass = '';
                        if (isAssistant) speakerClass = 'bg-slate-100';
                        else if (isUser) speakerClass = 'bg-slate-200 border border-slate-300';
                        
                        return (
                          <div 
                            key={index} 
                            className={`p-3 rounded-lg ${speakerClass || 'bg-slate-50'}`}
                          >
                            <p className="text-slate-800">{line}</p>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {/* Metadata de la llamada */}
              {selectedCallModal.metadata && Object.keys(selectedCallModal.metadata).length > 0 && (
                <Card className="mb-6 bg-white shadow-sm border-slate-200">
                  <CardHeader className="pb-2">
                    <h3 className="text-lg font-semibold text-slate-800">Metadata de la Llamada</h3>
                  </CardHeader>
                  <CardContent className="p-4">
                    <pre className="bg-slate-50 p-4 rounded-lg text-slate-800 text-xs overflow-auto max-h-96">
                      {JSON.stringify(selectedCallModal.metadata, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}


              {/* Variables dinámicas */}
              {selectedCallModal.metadata?.retell_llm_dynamic_variables && Object.keys(selectedCallModal.metadata.retell_llm_dynamic_variables).length > 0 && (
                <Card className="mb-6 bg-white shadow-sm border-slate-200">
                  <CardHeader className="pb-2">
                    <h3 className="text-lg font-semibold text-slate-800">Variables Dinámicas</h3>
                  </CardHeader>
                  <CardContent className="p-4">
                    <pre className="bg-slate-50 p-4 rounded-lg text-slate-800 text-xs overflow-auto max-h-96">
                      {JSON.stringify(selectedCallModal.metadata.retell_llm_dynamic_variables, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Modal de filtros de fechas */}
      {showFiltersModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="relative bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Filtrar por fechas</h3>
              <button
                onClick={closeFiltersModal}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha inicial
                </label>
                <Input
                  type="date"
                  value={tempStartDate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTempStartDate(e.target.value)}
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hora inicial
                </label>
                <Input
                  type="time"
                  value={tempStartTime}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTempStartTime(e.target.value)}
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fecha final
                </label>
                <Input
                  type="date"
                  value={tempEndDate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTempEndDate(e.target.value)}
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hora final
                </label>
                <Input
                  type="time"
                  value={tempEndTime}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTempEndTime(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>
            
            {exportLoading && (
              <div className="mt-4 flex items-center gap-2 text-slate-600">
                <svg className="animate-spin -ml-1 mr-1 h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-sm">Exportando CSV...</span>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <Button
                onClick={clearFiltersFromModal}
                variant="outline"
                className="flex-1"
              >
                Limpiar
              </Button>
              <Button
                onClick={applyFiltersFromModal}
                className="flex-1"
                disabled={loadingFilters}
              >
                {loadingFilters ? 'Aplicando...' : 'Aplicar filtros'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de exportación CSV (selección de rango y columnas) */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Exportar CSV - Seleccionar columnas y rango</h3>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-gray-500 hover:text-gray-700"
                disabled={exportLoading}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Selección de fechas */}
              <div>
                <h4 className="text-md font-medium text-gray-800 mb-3">Rango de fechas</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Fecha inicial</label>
                    <Input
                      type="date"
                      value={exportStartDate}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExportStartDate(e.target.value)}
                      className="w-full"
                      disabled={exportLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Hora inicial</label>
                    <Input
                      type="time"
                      value={exportStartTime}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExportStartTime(e.target.value)}
                      className="w-full"
                      disabled={exportLoading}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Fecha final</label>
                    <Input
                      type="date"
                      value={exportEndDate}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExportEndDate(e.target.value)}
                      className="w-full"
                      disabled={exportLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Hora final</label>
                    <Input
                      type="time"
                      value={exportEndTime}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExportEndTime(e.target.value)}
                      className="w-full"
                      disabled={exportLoading}
                    />
                  </div>
                </div>
              </div>

              {/* Selección de columnas */}
              <div>
                <h4 className="text-md font-medium text-gray-800 mb-3">Columnas a exportar</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-4">
                  {Object.entries({
                    created_at: 'Fecha y Hora',
                    duration: 'Duración',
                    to_number: 'Número de Teléfono',
                    summary: 'Resumen',
                    transcript: 'Transcripción',
                    end_reason: 'Razón de Desconexión',
                    recordings: 'Grabaciones',
                    call_id: 'ID de Llamada',
                    interest: 'Interés',
                    tipo_vivienda: 'Tipo de Vivienda',
                    status: 'Estado',
                    client_id: 'ID de Cliente',
                    cost: 'Costo',
                    from_number: 'Número de Origen',
                    from_number_norm: 'Número de Origen Normalizado',
                    to_number_norm: 'Número de Teléfono Normalizado'
                  }).map(([key, label]) => (
                    <div key={key} className="flex items-center">
                      <input
                        type="checkbox"
                        id={`export-column-${key}`}
                        checked={exportColumns[key as keyof typeof exportColumns]}
                        onChange={() => {
                          setExportColumns({
                            ...exportColumns,
                            [key]: !exportColumns[key as keyof typeof exportColumns]
                          });
                        }}
                        className="rounded bg-white border-slate-300 text-blue-600 focus:ring-blue-500"
                        disabled={exportLoading}
                      />
                      <label htmlFor={`export-column-${key}`} className="ml-2 text-sm text-slate-700">
                        {label}
                      </label>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  Seleccionadas: {Object.values(exportColumns).filter(Boolean).length} de {Object.keys(exportColumns).length} columnas
                </div>
              </div>

              {/* Selección de campos de metadata dinámicos */}
              {availableMetadataFields.length > 0 ? (
                <div>
                  <h4 className="text-md font-medium text-gray-800 mb-3">Campos de Metadata a exportar</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-4">
                    {availableMetadataFields.map((field) => (
                      <div key={field} className="flex items-center">
                        <input
                          type="checkbox"
                          id={`export-metadata-${field}`}
                          checked={metadataFields[field] || false}
                          onChange={() => {
                            setMetadataFields({
                              ...metadataFields,
                              [field]: !metadataFields[field]
                            });
                          }}
                          className="rounded bg-white border-slate-300 text-blue-600 focus:ring-blue-500"
                          disabled={exportLoading}
                        />
                        <label htmlFor={`export-metadata-${field}`} className="ml-2 text-sm text-slate-700">
                          {field}
                        </label>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    Seleccionados: {Object.values(metadataFields).filter(Boolean).length} de {availableMetadataFields.length} campos de metadata
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="text-md font-medium text-yellow-800 mb-2">Debug: Campos de Metadata</h4>
                  <p className="text-sm text-yellow-700 mb-3">
                    No se encontraron campos de metadata en sessionStorage con key 'metadata_llamadas'.
                    <br />
                    Campos disponibles: {availableMetadataFields.length}
                    <br />
                    SessionStorage metadata: {sessionStorage.getItem('metadata_llamadas') ? 'Existe' : 'No existe'}
                    <br />
                    <strong>Contenido del session storage:</strong>
                    <br />
                    <code className="text-xs bg-gray-100 p-1 rounded block mt-1">
                      {sessionStorage.getItem('metadata_llamadas') || 'No hay datos'}
                    </code>
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => {
                        // Mostrar contenido exacto del session storage
                        const storedMetadata = sessionStorage.getItem('metadata_llamadas');
                        alert(`Contenido del session storage:\n\n${storedMetadata}\n\nTipo: ${typeof storedMetadata}\nLongitud: ${storedMetadata?.length}`);
                      }}
                      className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                    >
                      Ver contenido exacto del session storage
                    </button>
                    
                    <button
                      onClick={() => {
                        // Recargar metadata del session storage
                        try {
                          const storedMetadata = sessionStorage.getItem('metadata_llamadas');
                          console.log('🔍 [Recargar] Metadata del session storage:', storedMetadata);
                          console.log('🔍 [Recargar] Tipo de datos:', typeof storedMetadata);
                          console.log('🔍 [Recargar] Longitud:', storedMetadata?.length);
                          
                          if (storedMetadata) {
                            const metadataArray = JSON.parse(storedMetadata);
                            console.log('🔍 [Recargar] Metadata parseada:', metadataArray);
                            console.log('🔍 [Recargar] Es array?', Array.isArray(metadataArray));
                            console.log('🔍 [Recargar] Longitud del array:', metadataArray?.length);
                            
                            if (Array.isArray(metadataArray) && metadataArray.length > 0) {
                              // Si es un array, obtener las claves del primer objeto
                              const fields = Object.keys(metadataArray[0]);
                              console.log('🔍 [Recargar] Campos de metadata encontrados (array):', fields);
                              console.log('🔍 [Recargar] Primer objeto:', metadataArray[0]);
                              
                              setAvailableMetadataFields(fields);
                              console.log('🔍 [Recargar] Estado actualizado - availableMetadataFields:', fields);
                              
                              const initialFields: Record<string, boolean> = {};
                              fields.forEach(field => {
                                initialFields[field] = false;
                              });
                              setMetadataFields(initialFields);
                              console.log('🔍 [Recargar] Estado actualizado - metadataFields:', initialFields);
                            } else if (typeof metadataArray === 'object' && metadataArray !== null) {
                              // Si es un objeto directo, obtener sus claves
                              const fields = Object.keys(metadataArray);
                              console.log('🔍 [Recargar] Campos de metadata encontrados (objeto):', fields);
                              console.log('🔍 [Recargar] Objeto completo:', metadataArray);
                              
                              setAvailableMetadataFields(fields);
                              console.log('🔍 [Recargar] Estado actualizado - availableMetadataFields:', fields);
                              
                              const initialFields: Record<string, boolean> = {};
                              fields.forEach(field => {
                                initialFields[field] = false;
                              });
                              setMetadataFields(initialFields);
                              console.log('🔍 [Recargar] Estado actualizado - metadataFields:', initialFields);
                            } else {
                              console.log('🔍 [Recargar] No es un array válido o está vacío');
                            }
                          } else {
                            console.log('🔍 [Recargar] No hay metadata en session storage');
                          }
                        } catch (error) {
                          console.error('Error al recargar metadata:', error);
                        }
                      }}
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                    >
                      Recargar metadata del session storage
                    </button>
                    
                    <button
                      onClick={() => {
                        // Simular datos de metadata para prueba
                        const testMetadata = [
                          {
                            "total_llamadas": "12",
                            "ultima_llamada": "hoy",
                            "duracion_promedio": "",
                            "llamadas_exitosas": ""
                          }
                        ];
                        sessionStorage.setItem('metadata_llamadas', JSON.stringify(testMetadata));
                        
                        // Recargar los campos
                        const fields = Object.keys(testMetadata[0]);
                        setAvailableMetadataFields(fields);
                        const initialFields: Record<string, boolean> = {};
                        fields.forEach(field => {
                          initialFields[field] = false;
                        });
                        setMetadataFields(initialFields);
                      }}
                      className="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700"
                    >
                      Simular datos de metadata para prueba
                    </button>
                  </div>
                </div>
              )}

              {exportError && (
                <div className="text-red-600 text-sm">{exportError}</div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                onClick={() => {
                  setExportStartDate('');
                  setExportEndDate('');
                  setExportStartTime('');
                  setExportEndTime('');
                  setExportError(null);
                  // Resetear columnas a valores por defecto
                  setExportColumns({
                    created_at: true,
                    duration: true,
                    to_number: true,
                    summary: false,
                    transcript: false,
                    end_reason: true,
                    recordings: false,
                    call_id: true,
                    interest: false,
                    tipo_vivienda: false,
                    status: true,
                    client_id: false,
                    cost: false,
                    from_number: false,
                    from_number_norm: false,
                    to_number_norm: false
                  });
                  // Resetear campos de metadata
                  const resetMetadataFields: Record<string, boolean> = {};
                  availableMetadataFields.forEach(field => {
                    resetMetadataFields[field] = false;
                  });
                  setMetadataFields(resetMetadataFields);
                }}
                variant="outline"
                className="flex-1"
                disabled={exportLoading}
              >
                Limpiar
              </Button>
              <Button
                onClick={confirmExport}
                className="flex-1"
                disabled={exportLoading}
              >
                {exportLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <svg className="animate-spin -ml-1 mr-1 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Exportando...
                  </span>
                ) : (
                  'Exportar'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Recordings;