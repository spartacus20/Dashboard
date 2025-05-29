import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, Download, Clock, ChevronDown, ChevronUp, Search, X, Info, Phone, ChevronLeft, ChevronRight, ListFilter, Timer, PhoneOff, RefreshCw } from 'lucide-react';
import type { DetailedRetellCall, FilterCriteria } from '../types';
import { useCallsContext } from '../context/CallsContext';
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";

// Componentes UI simplificados
const Input = ({ className = "", ...props }) => (
  <input 
    className={`flex h-10 w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white ${className}`}
    {...props} 
  />
);

const Badge = ({ children, variant = "default", className = "" }) => {
  const variantClasses = {
    default: "bg-purple-600 text-white",
    secondary: "bg-gray-800 text-white",
    outline: "border border-gray-700 text-gray-300",
  };
  
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
};

const Skeleton = ({ className = "", ...props }) => (
  <div className={`animate-pulse rounded-md bg-gray-800 ${className}`} {...props} />
);

// Componente de diálogo simplificado para el modal
const Dialog = ({ children, isOpen, onClose }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/80" onClick={onClose}></div>
      <div className="z-50 p-6 bg-gray-900 rounded-lg border border-gray-800 max-w-4xl w-full max-h-[90vh] overflow-auto">
        {children}
      </div>
    </div>
  );
};

// Componente Select simplificado
const Select = ({ children, value, onValueChange, className = "" }) => {
  return (
    <div className={`relative ${className}`}>
      <select 
        value={value} 
        onChange={(e) => onValueChange?.(e.target.value)}
        className="flex h-10 w-full items-center justify-between rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white appearance-none cursor-pointer"
      >
        {children}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 opacity-50 pointer-events-none" />
    </div>
  );
};

const SelectItem = ({ value, children }) => {
  return <option value={value}>{children}</option>;
};

// Componentes de paginación simplificados
const PaginationButton = ({ onClick, children, isActive, className = "" }) => (
  <button
    onClick={onClick}
    className={`inline-flex items-center justify-center text-sm font-medium h-9 min-w-9 px-2 rounded-md ${
      isActive 
        ? "bg-purple-600 text-white" 
        : "text-gray-400 hover:text-white hover:bg-gray-800"
    } ${className}`}
  >
    {children}
  </button>
);

const PaginationPrevious = ({ onClick, disabled }) => (
  <PaginationButton 
    onClick={onClick}
    className={disabled ? "opacity-50 cursor-not-allowed" : ""}
  >
    <ChevronLeft className="h-4 w-4 mr-1" />
    <span>Anterior</span>
  </PaginationButton>
);

const PaginationNext = ({ onClick, disabled }) => (
  <PaginationButton 
    onClick={onClick}
    className={disabled ? "opacity-50 cursor-not-allowed" : ""}
  >
    <span>Siguiente</span>
    <ChevronRight className="h-4 w-4 ml-1" />
  </PaginationButton>
);

interface RecordingsProps {
  onNavigate: (page: 'dashboard' | 'recordings') => void;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
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

// Función auxiliar para obtener la duración en segundos (para filtros)
function getDurationInSeconds(call: DetailedRetellCall): number {
  // Opción 1: Usar el campo duration directamente del webhook (en milisegundos)
  if (call.duration && call.duration > 0) {
    return Math.floor(call.duration / 1000);
  }
  
  // Opción 2: Calcular usando timestamps como respaldo
  if (call.end_timestamp && call.start_timestamp) {
    return (call.end_timestamp - call.start_timestamp) / 1000;
  }
  
  // Opción 3: Buscar en metadata como último recurso (asumiendo segundos en metadata)
  if (call.metadata?.duration) {
    const duration = parseInt(call.metadata.duration);
    if (duration > 0) {
      return duration;
    }
  }
  
  return 0;
}

function formatCost(cost: number): string {
  return `$${(cost / 100).toFixed(2)}`;
}

// Componente del Modal
interface CallModalProps {
  call: DetailedRetellCall | null;
  onClose: () => void;
  isPlaying: boolean;
  onPlayPause: () => void;
}

function CallModal({ call, onClose, isPlaying, onPlayPause }: CallModalProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Actualizar la referencia al audio
    if (call?.recording_url) {
      if (!audioRef.current) {
        audioRef.current = document.querySelector('audio') as HTMLAudioElement;
      }
      
      const updateProgress = () => {
        if (audioRef.current) {
          setCurrentTime(audioRef.current.currentTime);
          setDuration(audioRef.current.duration);
        }
      };
      
      const handleTimeUpdate = () => {
        updateProgress();
      };
      
      const handleLoadedMetadata = () => {
        updateProgress();
      };
      
      if (audioRef.current) {
        audioRef.current.addEventListener('timeupdate', handleTimeUpdate);
        audioRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
        
        return () => {
          if (audioRef.current) {
            audioRef.current.removeEventListener('timeupdate', handleTimeUpdate);
            audioRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata);
          }
        };
      }
    }
  }, [call?.recording_url]);
  
  // Función para formatear segundos a formato MM:SS
  const formatTime = (time: number) => {
    if (isNaN(time)) return "00:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Función para controlar el cambio en la barra de progreso
  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  if (!call) return null;

  const callDuration = getDuration(call);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <CardHeader className="border-b border-gray-800 flex justify-between items-center sticky top-0 bg-gray-900 p-4">
          <div className="flex items-center">
            <Phone className="w-5 h-5 text-purple-500 mr-2" />
            <h2 className="text-xl font-bold text-white">{call.call_id}</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-gray-800 rounded-full"
          >
            <X className="w-6 h-6 text-gray-400 hover:text-white" />
          </button>
        </CardHeader>
        
        <div className="overflow-y-auto p-6 flex-grow">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardContent className="p-4">
                <h3 className="text-lg font-semibold text-white mb-4">Información Básica</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-400">ID del Agente</p>
                    <p className="text-white">{call.agent_id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Estado de la Llamada</p>
                    <p className="text-white">{call.call_status}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Tipo de Llamada</p>
                    <p className="text-white">{call.call_type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Fecha y Hora</p>
                    <p className="text-white">{new Date(call.start_timestamp || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Duración</p>
                    <p className="text-white flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {callDuration}
                    </p>
                  </div>
                  {/* Metadatos adicionales si están disponibles */}
                  {call.from_number && (
                    <div>
                      <p className="text-sm text-gray-400">Número de Origen</p>
                      <p className="text-white">{call.from_number}</p>
                    </div>
                  )}
                  {call.to_number && (
                    <div>
                      <p className="text-sm text-gray-400">Número de Destino</p>
                      <p className="text-white">{call.to_number}</p>
                    </div>
                  )}
                  {call.metadata?.direction && (
                    <div>
                      <p className="text-sm text-gray-400">Dirección</p>
                      <p className="text-white capitalize">{call.metadata.direction}</p>
                    </div>
                  )}
                  {call.call_cost && (
                    <div>
                      <p className="text-sm text-gray-400">Costo Total</p>
                      <p className="text-white">{formatCost(call.call_cost.total_cost || 0)}</p>
                    </div>
                  )}
                  {call.disconnection_reason && (
                    <div>
                      <p className="text-sm text-gray-400">Razón de Desconexión</p>
                      <p className="text-white">{call.disconnection_reason}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            
            <div className="space-y-6">
              {call.recording_url && (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="text-lg font-semibold text-white mb-4">Grabación</h3>
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={onPlayPause}
                          className="p-3 bg-purple-600 rounded-full hover:bg-purple-700 transition-colors"
                        >
                          {isPlaying ? (
                            <Pause className="w-6 h-6 text-white" />
                          ) : (
                            <Play className="w-6 h-6 text-white" />
                          )}
                        </button>
                        
                        <a
                          href={call.recording_url}
                          download
                          className="p-3 bg-gray-800 rounded-full hover:bg-gray-700 transition-colors"
                        >
                          <Download className="w-6 h-6 text-white" />
                        </a>
                      </div>
                      
                      {/* Reproductor con barra de progreso */}
                      <div className="space-y-2">
                        <div className="flex items-center">
                          <input
                            type="range"
                            min="0"
                            max={duration || 100}
                            value={currentTime}
                            onChange={handleProgressChange}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                            style={{
                              background: `linear-gradient(to right, #9333ea 0%, #9333ea ${(currentTime / (duration || 1)) * 100}%, #374151 ${(currentTime / (duration || 1)) * 100}%, #374151 100%)`
                            }}
                          />
                        </div>
                        
                        <div className="flex justify-between text-xs text-gray-400">
                          <span>{formatTime(currentTime)}</span>
                          <span>{formatTime(duration)}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {call.call_analysis && (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="text-lg font-semibold text-white mb-4">Análisis de la Llamada</h3>
                    <div className="space-y-3">
                      {call.call_analysis.sentiment && (
                        <div>
                          <p className="text-sm text-gray-400">Sentimiento</p>
                          <p className="text-white">{call.call_analysis.sentiment}</p>
                        </div>
                      )}
                      {call.call_analysis.topics && call.call_analysis.topics.length > 0 && (
                        <div>
                          <p className="text-sm text-gray-400">Temas</p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {call.call_analysis.topics.map((topic, index) => (
                              <Badge key={index} variant="secondary">{topic}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Datos de análisis personalizados (si existen) */}
                      {call.call_analysis?.custom_analysis_data && Object.keys(call.call_analysis.custom_analysis_data).length > 0 && (
                        <div>
                          <p className="text-sm text-gray-400">Datos de Análisis Personalizados</p>
                          <div className="bg-gray-800 p-3 rounded-lg">
                            {Object.entries(call.call_analysis.custom_analysis_data).map(([key, value]) => (
                              <div key={key} className="flex justify-between border-b border-gray-700 py-2 last:border-0">
                                <span className="text-gray-300 font-medium capitalize">{key}:</span>
                                <span className="text-white">{String(value)}</span>
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
          {call.transcript && (
            <Card className="mb-6">
              <CardHeader className="pb-2">
                <h3 className="text-lg font-semibold text-white">Transcripción</h3>
              </CardHeader>
              <CardContent className="p-4">
                {formatTranscript(call.transcript)}
              </CardContent>
            </Card>
          )}
          
          {/* Metadata */}
          {call.metadata && Object.keys(call.metadata).length > 0 && (
            <Card className="mb-6">
              <CardHeader className="pb-2">
                <h3 className="text-lg font-semibold text-white">Metadata</h3>
              </CardHeader>
              <CardContent className="p-4">
                {renderJson(call.metadata)}
              </CardContent>
            </Card>
          )}

          {/* Variables dinámicas */}
          {call.metadata?.retell_llm_dynamic_variables && Object.keys(call.metadata.retell_llm_dynamic_variables).length > 0 && (
            <Card className="mb-6">
              <CardHeader className="pb-2">
                <h3 className="text-lg font-semibold text-white">Variables Dinámicas</h3>
              </CardHeader>
              <CardContent className="p-4">
                {renderJson(call.metadata.retell_llm_dynamic_variables)}
              </CardContent>
            </Card>
          )}
        </div>
      </Card>
    </div>
  );
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
  // Funciones utilidad para renderizar JSON y formatear transcripciones
  const renderJson = (data: any) => {
    return (
      <pre className="bg-gray-950 p-4 rounded-lg text-gray-300 text-xs overflow-auto max-h-96">
        {JSON.stringify(data, null, 2)}
      </pre>
    );
  };

  // Formatear la transcripción para mejor legibilidad
  const formatTranscript = (transcript: string) => {
    if (!transcript) return null;
    
    // Dividir por líneas y añadir formato
    const lines = transcript.split('\n');
    return (
      <div className="space-y-3">
        {lines.map((line, index) => {
          // Intentar detectar si es usuario o asistente
          const isAssistant = line.toLowerCase().startsWith('asistente:') || 
                             line.toLowerCase().startsWith('agente:') || 
                             line.toLowerCase().startsWith('ai:') ||
                             line.toLowerCase().startsWith('agent:');
          const isUser = line.toLowerCase().startsWith('usuario:') || 
                        line.toLowerCase().startsWith('cliente:') ||
                        line.toLowerCase().startsWith('user:');
          
          let speakerClass = '';
          if (isAssistant) speakerClass = 'bg-gray-800';
          else if (isUser) speakerClass = 'bg-gray-900 border border-gray-800';
          
          return (
            <div 
              key={index} 
              className={`p-3 rounded-lg ${speakerClass || 'bg-gray-900'}`}
            >
              <p className="text-gray-200">{line}</p>
            </div>
          );
        })}
      </div>
    );
  };

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
    currentPage: contextCurrentPage,
    totalPages: contextTotalPages,
    hasMorePages,
    setFilterCriteria: contextSetFilterCriteria,
    filterCriteria: contextFilterCriteria
  } = useCallsContext();
  
  // Estados locales para paginación y filtrado
  const [calls, setCalls] = React.useState<DetailedRetellCall[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  
  // Estados para la paginación - usar estado local para la página actual
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(25);
  const [itemsPerPageOptions] = React.useState([25, 50, 100]);
  
  // Estados para los dropdowns
  const [showItemsPerPageDropdown, setShowItemsPerPageDropdown] = React.useState(false);
  const [showDisconnectionReasonDropdown, setShowDisconnectionReasonDropdown] = React.useState(false);
  const [showDurationFilterDropdown, setShowDurationFilterDropdown] = React.useState(false);
  
  // Estados para los filtros
  const [disconnectionReasonFilter, setDisconnectionReasonFilter] = React.useState<string | null>(null);
  const [durationFilter, setDurationFilter] = React.useState<string | null>(null);
  
  // Estado para la personalización de columnas
  const [showColumnCustomizer, setShowColumnCustomizer] = React.useState(false);
  const [visibleColumns, setVisibleColumns] = React.useState({
    callId: true,
    status: true,
    timestamp: true,
    duration: true,
    disconnectionReason: true,
    callType: true,
    agent: false,
    fromNumber: false,
    toNumber: false
  });
  
  // Opciones de filtrado de duración
  const durationFilterOptions = [
    { label: 'Todas las duraciones', value: null },
    { label: 'Menos de 1 minuto', value: 'lt-60' },
    { label: '1-3 minutos', value: '60-180' },
    { label: '3-5 minutos', value: '180-300' },
    { label: 'Más de 5 minutos', value: 'gt-300' }
  ];
  
  const [disconnectionReasons, setDisconnectionReasons] = React.useState<string[]>([]);
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');

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
    return allCalls.filter(call => {
      // Filtrar por término de búsqueda
      const matchesSearch = !searchTerm || 
        (call?.call_id?.toLowerCase()?.includes(searchTerm.toLowerCase()) || false) ||
        (call?.transcript?.toLowerCase()?.includes(searchTerm.toLowerCase()) || false);
      
      // Filtrar por disconnection_reason
      const matchesDisconnectionReason = !disconnectionReasonFilter || 
        call.disconnection_reason === disconnectionReasonFilter;
      
      // Filtrar por duración
      let matchesDuration = true;
      if (durationFilter) {
        const durationSeconds = getDurationInSeconds(call);
        
        switch(durationFilter) {
          case 'lt-60': // Menos de 1 minuto
            matchesDuration = durationSeconds < 60;
            break;
          case '60-180': // 1-3 minutos
            matchesDuration = durationSeconds >= 60 && durationSeconds <= 180;
            break;
          case '180-300': // 3-5 minutos
            matchesDuration = durationSeconds > 180 && durationSeconds <= 300;
            break;
          case 'gt-300': // Más de 5 minutos
            matchesDuration = durationSeconds > 300;
            break;
        }
      }
      
      // Filtrar por fechas (si están establecidas)
      let matchesDates = true;
      if (startDate || endDate) {
        const callTimestamp = (call as any).start_timestamp;
        
        if (callTimestamp) {
          const callDate = new Date(callTimestamp);
          
          if (startDate) {
            const startFilterDate = new Date(startDate);
            startFilterDate.setHours(0, 0, 0, 0);
            if (callDate < startFilterDate) {
              matchesDates = false;
            }
          }
          
          if (endDate && matchesDates) {
            const endFilterDate = new Date(endDate);
            endFilterDate.setHours(23, 59, 59, 999);
            if (callDate > endFilterDate) {
              matchesDates = false;
            }
          }
        } else {
          // Si no hay timestamp, no coincide con filtros de fecha
          matchesDates = false;
        }
      }
      
      return matchesSearch && matchesDisconnectionReason && matchesDuration && matchesDates;
    });
  }, [allCalls, searchTerm, disconnectionReasonFilter, durationFilter, startDate, endDate]);

  // Calcular llamadas para la página actual basándose en filteredCalls
  const currentPageCalls = React.useMemo(() => {
    const indexOfLastCall = currentPage * itemsPerPage;
    const indexOfFirstCall = indexOfLastCall - itemsPerPage;
    return filteredCalls.slice(indexOfFirstCall, indexOfLastCall);
  }, [filteredCalls, currentPage, itemsPerPage]);

  // Calcular número total de páginas basado en las llamadas filtradas
  const totalPages = React.useMemo(() => {
    // Si tenemos filtros aplicados, calcular basado en las llamadas filtradas
    if (searchTerm || disconnectionReasonFilter || durationFilter || startDate || endDate) {
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
  }, [filteredCalls.length, itemsPerPage, searchTerm, disconnectionReasonFilter, durationFilter, startDate, endDate, contextTotalPages, allCalls.length]);

  // Iniciar la carga de datos la primera vez que se monta el componente
  React.useEffect(() => {
    // Solo cargamos si no hay datos y no está cargando ya
    if (allCalls.length === 0 && !loadingAllCalls) {
      loadAllCalls();
    }
    
    // Sincronizamos los estados locales con el contexto
    setDisconnectionReasons(contextDisconnectionReasons);
    setError(contextError);
  }, [allCalls.length, loadingAllCalls, loadAllCalls, contextDisconnectionReasons, contextError]);

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
      if (!target.closest('.disconnection-reason-dropdown')) {
        setShowDisconnectionReasonDropdown(false);
      }
      if (!target.closest('.duration-filter-dropdown')) {
        setShowDurationFilterDropdown(false);
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
        setAudioDuration(audioRef.current.duration);
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
        audioRef.current.remove();
      }
    };
  }, []);

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
    if (audioRef.current) {
      if (playingId === callId) {
        audioRef.current.pause();
        setPlayingId(null);
      } else {
        try {
          // If another audio is playing, stop it first
          if (playingId) {
            audioRef.current.pause();
            setAudioCurrentTime(0);
          }
          // Set the new audio source
          const call = allCalls.find(c => c.call_id === callId);
          if (call?.recording_url) {
            audioRef.current.src = call.recording_url;
            audioRef.current.currentTime = 0;
            await audioRef.current.play();
            setPlayingId(callId);
          }
        } catch (error) {
          console.error('Error playing audio:', error);
          setPlayingId(null);
        }
      }
    }
  };

  // Modal functionality
  const openCallModal = (call: DetailedRetellCall) => {
    setSelectedCallModal(call);
    setSelectedCall(call.call_id);
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
    setShowDisconnectionReasonDropdown(false);
  };

  const handleDurationFilter = (durationValue: string | null) => {
    setDurationFilter(durationValue);
    setCurrentPage(1); // Reset to first page when filter changes
    setShowDurationFilterDropdown(false);
  };

  // Función para exportar datos a Excel (CSV)
  const exportToExcel = () => {
    // Solo exportamos las llamadas filtradas actualmente
    const dataToExport = filteredCalls;
    
    // Definimos los encabezados basados en las columnas visibles
    const headers: string[] = [];
    const columns: string[] = [];
    
    if (visibleColumns.callId) {
      headers.push('ID de Llamada');
      columns.push('call_id');
    }
    
    if (visibleColumns.status) {
      headers.push('Estado');
      columns.push('call_status');
    }
    
    if (visibleColumns.timestamp) {
      headers.push('Fecha y Hora');
      columns.push('start_timestamp');
    }
    
    if (visibleColumns.duration) {
      headers.push('Duración');
      columns.push('duration');
    }
    
    if (visibleColumns.disconnectionReason) {
      headers.push('Razón de Desconexión');
      columns.push('disconnection_reason');
    }
    
    if (visibleColumns.callType) {
      headers.push('Tipo de Llamada');
      columns.push('call_type');
    }
    
    if (visibleColumns.agent) {
      headers.push('Agente');
      columns.push('agent_id');
    }
    
    if (visibleColumns.fromNumber) {
      headers.push('Número de Origen');
      columns.push('from_number');
    }
    
    if (visibleColumns.toNumber) {
      headers.push('Número de Destino');
      columns.push('to_number');
    }
    
    // Crear las filas de datos
    const rows = dataToExport.map(call => {
      const row: any = {};
      
      columns.forEach(column => {
        if (column === 'duration') {
          row[column] = getDuration(call);
        } else if (column === 'start_timestamp') {
          row[column] = call[column] ? new Date(call[column]).toLocaleString() : '';
        } else {
          // @ts-ignore - Ignoramos los errores de tipo aquí ya que from_number y to_number no están en el tipo
          row[column] = call[column] || '';
        }
      });
      
      return row;
    });
    
    // Convertir a CSV
    let csvContent = headers.join(',') + '\n';
    
    rows.forEach(row => {
      const values = columns.map(column => {
        // Escapar comillas y valores que contengan comas
        const value = String(row[column]).replace(/"/g, '""');
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

  // Reset all filters
  const resetAllFilters = () => {
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
    setDisconnectionReasonFilter(null);
    setDurationFilter(null);
    setCurrentPage(1);
  };

  // Calcular el recuento total de filtros aplicados
  const activeFiltersCount = React.useMemo(() => {
    let count = 0;
    if (searchTerm) count++;
    if (startDate || endDate) count++;
    if (disconnectionReasonFilter) count++;
    if (durationFilter) count++;
    return count;
  }, [searchTerm, startDate, endDate, disconnectionReasonFilter, durationFilter]);

  // Custom audio player para el modal
  const AudioPlayer = () => {
    if (!selectedCallModal?.recording_url) return null;
    
    return (
      <Card>
        <CardContent className="p-4">
          <h3 className="text-lg font-semibold text-white mb-4">Reproductor</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <button
                onClick={togglePlayPauseModal}
                className="p-3 bg-purple-600 rounded-full hover:bg-purple-700 transition-colors"
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
                className="p-3 bg-gray-800 rounded-full hover:bg-gray-700 transition-colors"
              >
                <Download className="w-6 h-6 text-white" />
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
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                  style={{
                    background: `linear-gradient(to right, #9333ea 0%, #9333ea ${(audioCurrentTime / (audioDuration || 1)) * 100}%, #374151 ${(audioCurrentTime / (audioDuration || 1)) * 100}%, #374151 100%)`
                  }}
                />
              </div>
              
              <div className="flex justify-between text-xs text-gray-400">
                <span>{formatTime(audioCurrentTime)}</span>
                <span>{formatTime(audioDuration)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Grabaciones</h2>
        <div className="flex flex-wrap items-center gap-2 text-gray-400">
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
                <span className="mr-1">{allCalls.length.toLocaleString()}</span> 
                {allCalls.length === 1 ? 'llamada total' : 'llamadas totales'}
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

      <Card>
        <CardHeader className="border-b border-gray-800 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle>Grabaciones</CardTitle>
            
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
                onClick={exportToExcel} 
                variant="outline" 
                size="sm"
                className="text-gray-400"
                disabled={loadingAllCalls || filteredCalls.length === 0}
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
                  <div className="absolute right-0 mt-2 w-64 bg-gray-800 rounded-md shadow-lg z-50 border border-gray-700 column-customizer-dropdown">
                    <div className="p-3 border-b border-gray-700">
                      <h3 className="text-sm font-medium text-white">Personalizar columnas</h3>
                      <p className="text-xs text-gray-400 mt-1">Selecciona las columnas que deseas ver</p>
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
                        toNumber: 'Número de Destino'
                      }).map(([key, label]) => (
                        <div key={key} className="flex items-center">
                          <input
                            type="checkbox"
                            id={`column-${key}`}
                            checked={visibleColumns[key]}
                            onChange={() => {
                              setVisibleColumns({
                                ...visibleColumns,
                                [key]: !visibleColumns[key]
                              });
                            }}
                            className="rounded bg-gray-700 border-gray-600 text-purple-600 focus:ring-purple-500"
                          />
                          <label htmlFor={`column-${key}`} className="ml-2 text-sm text-gray-300">
                            {label}
                          </label>
                        </div>
                      ))}
                    </div>
                    <div className="p-3 border-t border-gray-700 flex justify-between">
                      <Button 
                        onClick={() => {
                          setVisibleColumns({
                            callId: true,
                            status: true,
                            timestamp: true,
                            duration: true,
                            disconnectionReason: true,
                            callType: true,
                            agent: false,
                            fromNumber: false,
                            toNumber: false
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
              <div className="flex justify-between items-center text-xs text-white mb-1">
                <span className="font-medium">Cargando grabaciones...</span>
                <span>Página {contextCurrentPage} de {contextTotalPages || '?'}</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-3 mb-1 overflow-hidden border border-gray-700">
                <div 
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 h-3 rounded-full transition-all duration-500 ease-in-out"
                  style={{ 
                    width: '100%',
                    animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
                  }}
                ></div>
              </div>
              <div className="flex justify-between items-center text-xs text-gray-400">
                <p className="flex items-center">
                  <svg className="animate-spin mr-1 h-3 w-3 text-purple-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Obteniendo datos...
                </p>
                <p className="text-purple-400 font-medium">
                  {allCalls.length} llamadas cargadas
                </p>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 mb-6">
            {/* Filtro de fechas */}
            <div className="lg:col-span-5 flex gap-2 items-center">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full"
                placeholder="Fecha inicial"
              />
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full"
                placeholder="Fecha final"
              />
              <Button 
                onClick={() => {
                  // Actualizar los filtros en el contexto
                  const criteria: FilterCriteria = {};
                  if (startDate || endDate) {
                    criteria.date_range = {};
                    if (startDate) criteria.date_range.start = startDate;
                    if (endDate) criteria.date_range.end = endDate;
                  }
                  contextSetFilterCriteria(criteria);
                  
                  // Recargar los datos con los nuevos filtros
                  loadAllCalls(true);
                }}
                variant="default"
                size="sm"
              >
                Aplicar
              </Button>
            </div>

            {/* Filtro de duración */}
            <div className="lg:col-span-3">
              <Select
                value={durationFilter || "all"}
                onValueChange={(value) => handleDurationFilter(value === "all" ? null : value)}
                className="w-full"
              >
                <SelectItem value="all">Todas las duraciones</SelectItem>
                <SelectItem value="lt-60">Menos de 1 minuto</SelectItem>
                <SelectItem value="60-180">1-3 minutos</SelectItem>
                <SelectItem value="180-300">3-5 minutos</SelectItem>
                <SelectItem value="gt-300">Más de 5 minutos</SelectItem>
              </Select>
            </div>
            
            {/* Filtro de disconnection_reason */}
            <div className="lg:col-span-3">
              <Select
                value={disconnectionReasonFilter || "all"}
                onValueChange={(value) => handleDisconnectionReasonFilter(value === "all" ? null : value)}
                className="w-full"
              >
                <SelectItem value="all">Todas las razones</SelectItem>
                {contextDisconnectionReasons.map(reason => (
                  <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                ))}
              </Select>
            </div>
            
            {/* Búsqueda */}
            <div className="lg:col-span-12 md:col-span-2 relative">
              <div className="relative">
                <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  type="text"
                  placeholder="Buscar grabación..."
                  value={searchTerm}
                  onChange={(e) => {
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Contenido principal */}
          {loadingAllCalls ? (
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
              <PhoneOff className="mx-auto h-12 w-12 text-gray-500 mb-4" />
              <h3 className="text-xl font-medium text-white mb-2">No se encontraron grabaciones</h3>
              <p className="text-gray-400 max-w-md mx-auto mb-6">
                {searchTerm || startDate || endDate || disconnectionReasonFilter || durationFilter
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
                    className={`overflow-hidden transition-all duration-200 hover:border-purple-700 cursor-pointer ${selectedCall === call.call_id ? 'border-purple-600 ring-1 ring-purple-600' : 'border-gray-800'}`}
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
                              <span className="text-sm text-gray-400">
                                {new Date(call.start_timestamp || 0).toLocaleString()}
                              </span>
                            )}
                          </div>
                          
                          {visibleColumns.callId && (
                            <h3 className="text-lg font-medium text-white">
                              ID: {call.call_id.substring(0, 14)}...
                            </h3>
                          )}
                          
                          {visibleColumns.agent && call.agent_id && (
                            <div className="text-sm text-gray-400">
                              <span className="font-medium">Agente:</span> {call.agent_id}
                            </div>
                          )}
                          
                          {visibleColumns.fromNumber && call.from_number && (
                            <div className="text-sm text-gray-400">
                              <span className="font-medium">Origen:</span> {call.from_number}
                            </div>
                          )}
                          
                          {visibleColumns.toNumber && call.to_number && (
                            <div className="text-sm text-gray-400">
                              <span className="font-medium">Destino:</span> {call.to_number}
                            </div>
                          )}
                          
                          <div className="flex flex-wrap gap-2">
                            {visibleColumns.duration && (
                              <div className="flex items-center text-sm text-gray-400">
                                <Clock className="w-4 h-4 mr-1" />
                                {getDuration(call)}
                              </div>
                            )}
                            
                            {visibleColumns.disconnectionReason && call.disconnection_reason && (
                              <div className="flex items-center text-sm text-gray-400">
                                <PhoneOff className="w-4 h-4 mr-1" />
                                {call.disconnection_reason}
                              </div>
                            )}
                            
                            {visibleColumns.callType && call.call_type && (
                              <div className="text-sm text-gray-400">
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
                              className="p-2 rounded-full bg-gray-800 hover:bg-purple-700 transition-colors"
                            >
                              {playingId === call.call_id ? (
                                <Pause className="w-5 h-5 text-white" />
                              ) : (
                                <Play className="w-5 h-5 text-white" />
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
                <div className="flex justify-between items-center py-4 border-t border-gray-800">
                  <div className="flex items-center text-sm text-gray-400">
                    {/* Mostrar información correcta según si hay filtros o no */}
                    {searchTerm || disconnectionReasonFilter || durationFilter || startDate || endDate ? (
                      <>
                        Mostrando {(currentPage - 1) * itemsPerPage + 1}-
                        {Math.min(currentPage * itemsPerPage, filteredCalls.length)} de {filteredCalls.length} grabaciones filtradas
                      </>
                    ) : (
                      <>
                        Mostrando {(currentPage - 1) * itemsPerPage + 1}-
                        {Math.min(currentPage * itemsPerPage, allCalls.length)} 
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
                        <span className="text-gray-400 mr-2">Mostrar:</span>
                        <span className="text-white">{itemsPerPage}</span>
                        {showItemsPerPageDropdown ? (
                          <ChevronUp className="w-4 h-4 ml-1 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 ml-1 text-gray-400" />
                        )}
                      </div>
                      
                      {showItemsPerPageDropdown && (
                        <div className="absolute mt-2 py-1 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-10 w-24 right-0">
                          {itemsPerPageOptions.map(option => (
                            <div
                              key={option}
                              className={`px-4 py-2 text-sm cursor-pointer hover:bg-gray-700 ${option === itemsPerPage ? 'text-purple-500' : 'text-white'}`}
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
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <CardHeader className="border-b border-gray-800 flex justify-between items-center sticky top-0 bg-gray-900 p-4">
              <div className="flex items-center">
                <Phone className="w-5 h-5 text-purple-500 mr-2" />
                <h2 className="text-xl font-bold text-white">{selectedCallModal.call_id}</h2>
              </div>
              <button 
                onClick={closeCallModal}
                className="p-1 hover:bg-gray-800 rounded-full"
              >
                <X className="w-6 h-6 text-gray-400 hover:text-white" />
              </button>
            </CardHeader>
            
            <div className="overflow-y-auto p-6 flex-grow">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <Card>
                  <CardContent className="p-4">
                    <h3 className="text-lg font-semibold text-white mb-4">Información Básica</h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-gray-400">ID del Agente</p>
                        <p className="text-white">{selectedCallModal.agent_id}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Estado de la Llamada</p>
                        <p className="text-white">{selectedCallModal.call_status}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Tipo de Llamada</p>
                        <p className="text-white">{selectedCallModal.call_type}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Fecha y Hora</p>
                        <p className="text-white">{new Date(selectedCallModal.start_timestamp || 0).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Duración</p>
                        <p className="text-white flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          {getDuration(selectedCallModal)}
                        </p>
                      </div>
                      {/* Metadatos adicionales si están disponibles */}
                      {selectedCallModal.from_number && (
                        <div>
                          <p className="text-sm text-gray-400">Número de Origen</p>
                          <p className="text-white">{selectedCallModal.from_number}</p>
                        </div>
                      )}
                      {selectedCallModal.to_number && (
                        <div>
                          <p className="text-sm text-gray-400">Número de Destino</p>
                          <p className="text-white">{selectedCallModal.to_number}</p>
                        </div>
                      )}
                      {selectedCallModal.metadata?.direction && (
                        <div>
                          <p className="text-sm text-gray-400">Dirección</p>
                          <p className="text-white capitalize">{selectedCallModal.metadata.direction}</p>
                        </div>
                      )}
                      {selectedCallModal.call_cost && (
                        <div>
                          <p className="text-sm text-gray-400">Costo Total</p>
                          <p className="text-white">{formatCost(selectedCallModal.call_cost.total_cost || 0)}</p>
                        </div>
                      )}
                      {selectedCallModal.disconnection_reason && (
                        <div>
                          <p className="text-sm text-gray-400">Razón de Desconexión</p>
                          <p className="text-white">{selectedCallModal.disconnection_reason}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
                
                <div className="space-y-6">
                  {/* Reproductor de audio con barra de progreso */}
                  {selectedCallModal.recording_url && <AudioPlayer />}
                  
                  {selectedCallModal.call_analysis && (
                    <Card>
                      <CardContent className="p-4">
                        <h3 className="text-lg font-semibold text-white mb-4">Análisis de la Llamada</h3>
                        <div className="space-y-3">
                          {selectedCallModal.call_analysis.sentiment && (
                            <div>
                              <p className="text-sm text-gray-400">Sentimiento</p>
                              <p className="text-white">{selectedCallModal.call_analysis.sentiment}</p>
                            </div>
                          )}
                          {selectedCallModal.call_analysis.topics && selectedCallModal.call_analysis.topics.length > 0 && (
                            <div>
                              <p className="text-sm text-gray-400">Temas</p>
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
                              <p className="text-sm text-gray-400">Datos de Análisis Personalizados</p>
                              <div className="bg-gray-800 p-3 rounded-lg">
                                {Object.entries(selectedCallModal.call_analysis.custom_analysis_data).map(([key, value]) => (
                                  <div key={key} className="flex justify-between border-b border-gray-700 py-2 last:border-0">
                                    <span className="text-gray-300 font-medium capitalize">{key}:</span>
                                    <span className="text-white">{String(value)}</span>
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
                <Card className="mb-6">
                  <CardHeader className="pb-2">
                    <h3 className="text-lg font-semibold text-white">Transcripción</h3>
                  </CardHeader>
                  <CardContent className="p-4">
                    {formatTranscript(selectedCallModal.transcript)}
                  </CardContent>
                </Card>
              )}
              
              {/* Metadata */}
              {selectedCallModal.metadata && Object.keys(selectedCallModal.metadata).length > 0 && (
                <Card className="mb-6">
                  <CardHeader className="pb-2">
                    <h3 className="text-lg font-semibold text-white">Metadata</h3>
                  </CardHeader>
                  <CardContent className="p-4">
                    {renderJson(selectedCallModal.metadata)}
                  </CardContent>
                </Card>
              )}

              {/* Variables dinámicas */}
              {selectedCallModal.metadata?.retell_llm_dynamic_variables && Object.keys(selectedCallModal.metadata.retell_llm_dynamic_variables).length > 0 && (
                <Card className="mb-6">
                  <CardHeader className="pb-2">
                    <h3 className="text-lg font-semibold text-white">Variables Dinámicas</h3>
                  </CardHeader>
                  <CardContent className="p-4">
                    {renderJson(selectedCallModal.metadata.retell_llm_dynamic_variables)}
                  </CardContent>
                </Card>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export default Recordings;