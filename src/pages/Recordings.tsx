import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, Download, Clock, ChevronDown, ChevronUp, Search, X, Info, Phone, ChevronLeft, ChevronRight, ListFilter, Timer, PhoneOff, RefreshCw } from 'lucide-react';
import type { DetailedRetellCall, FilterCriteria } from '../types';
import { useCallsContext } from '../context/CallsContext';
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { listCalls } from '../api';

// Componentes UI simplificados
const Input = ({ className = "", ...props }) => (
  <input 
    className={`flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
    {...props} 
  />
);

const Badge = ({ children, variant = "default", className = "" }) => {
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

// Componente de diálogo simplificado para el modal
const Dialog = ({ children, isOpen, onClose }: { children: React.ReactNode; isOpen: boolean; onClose: () => void }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/80" onClick={onClose}></div>
      <div className="z-50 p-6 bg-white rounded-lg border border-slate-200 shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto">
        {children}
      </div>
    </div>
  );
};

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
    clientId, // Agregar clientId del contexto
    currentPage: contextCurrentPage,
    totalPages: contextTotalPages,
    hasMorePages,
    setFilterCriteria: contextSetFilterCriteria,
    filterCriteria: contextFilterCriteria,
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
  const [loading, setLoading] = React.useState(false);
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
  const [showDisconnectionReasonDropdown, setShowDisconnectionReasonDropdown] = React.useState(false);
  const [showDurationFilterDropdown, setShowDurationFilterDropdown] = React.useState(false);
  
  // Estados para los filtros
  const [disconnectionReasonFilter, setDisconnectionReasonFilter] = React.useState<string | null>(null);
  const [durationFilter, setDurationFilter] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<string | null>(null);
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

  // Flag para evitar cargas automáticas cuando se están aplicando filtros manualmente
  const isApplyingFilters = React.useRef(false);

  // Estados para el modal de filtros
  const [showFiltersModal, setShowFiltersModal] = React.useState(false);
  const [tempStartDate, setTempStartDate] = React.useState('');
  const [tempEndDate, setTempEndDate] = React.useState('');

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
      const hasActiveFilters = searchTerm || statusFilter || durationFilter || startDate || endDate || sortOrderFilter !== 'DESC';
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
  }, [filteredCallsData, allCalls, searchTerm, statusFilter, durationFilter, startDate, endDate, sortOrderFilter, disconnectionReasonFilter]);

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
    if (searchTerm || statusFilter || durationFilter || startDate || endDate || sortOrderFilter !== 'DESC') {
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
  }, [filteredCallsData.length, totalFilteredPages, itemsPerPage, filteredCalls.length, searchTerm, statusFilter, durationFilter, startDate, endDate, sortOrderFilter, contextTotalPages, allCalls.length]);

  // Iniciar la carga de datos la primera vez que se monta el componente
  React.useEffect(() => {
    // Solo cargamos si no hay datos, no está cargando ya, y no estamos aplicando filtros manualmente
    if (allCalls.length === 0 && !loadingAllCalls && !isApplyingFilters.current) {
      loadAllCalls();
    }
    
    // Sincronizamos los estados locales con el contexto
    setDisconnectionReasons(contextDisconnectionReasons);
    setError(contextError);
  }, [allCalls.length, loadingAllCalls, contextDisconnectionReasons, contextError]); // Removido loadAllCalls de las dependencias

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
      headers.push('Número de Teléfono'); // Etiqueta actualizada para CSV
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
    // Marcar que estamos aplicando filtros manualmente
    isApplyingFilters.current = true;
    
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
    setStatusFilter(null);
    setDisconnectionReasonFilter(null);
    setDurationFilter(null);
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
    if (sortOrderFilter !== 'DESC') count++; // Contar solo si no es el valor por defecto
    return count;
  }, [searchTerm, startDate, endDate, statusFilter, disconnectionReasonFilter, durationFilter, sortOrderFilter]);

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
    const hasActiveFilters = searchTerm || statusFilter || durationFilter || startDate || endDate || sortOrderFilter !== 'DESC';
    
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
      
      // Agregar filtros de fecha
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
  }, [apiKey, clientId, searchTerm, statusFilter, durationFilter, startDate, endDate, sortOrderFilter]);

  // Aplicar filtros automáticamente cuando cambien los criterios
  React.useEffect(() => {
    // Solo aplicar filtros si hay algún filtro activo
    const hasActiveFilters = searchTerm || statusFilter || durationFilter || startDate || endDate || sortOrderFilter !== 'DESC';
    
    if (hasActiveFilters) {
      applyFilters();
    } else {
      // Si no hay filtros, limpiar los datos filtrados
      setFilteredCallsData([]);
      setTotalFilteredCalls(0);
      setTotalFilteredPages(0);
    }
  }, [searchTerm, statusFilter, durationFilter, startDate, endDate, sortOrderFilter, applyFilters]);

  // Función para abrir el modal de filtros
  const openFiltersModal = () => {
    setTempStartDate(startDate);
    setTempEndDate(endDate);
    setShowFiltersModal(true);
  };

  // Función para cerrar el modal de filtros
  const closeFiltersModal = () => {
    setShowFiltersModal(false);
  };

  // Función para aplicar filtros desde el modal
  const applyFiltersFromModal = async () => {
    setStartDate(tempStartDate);
    setEndDate(tempEndDate);
    setShowFiltersModal(false);
    
    // Marcar que estamos aplicando filtros manualmente
    isApplyingFilters.current = true;
    
    try {
      // Crear el criterio de filtro
      const criteria: FilterCriteria = {};
      if (tempStartDate || tempEndDate) {
        criteria.date_range = {};
        if (tempStartDate) criteria.date_range.start = tempStartDate;
        if (tempEndDate) criteria.date_range.end = tempEndDate;
      }
      
      // Actualizar los filtros en el contexto para futuras referencias
      contextSetFilterCriteria(criteria);
      
      // Recargar los datos pasando los criterios directamente
      await loadAllCalls(true, criteria);
    } finally {
      // Quitar el flag después de completar la operación
      isApplyingFilters.current = false;
    }
  };

  // Función para limpiar filtros desde el modal
  const clearFiltersFromModal = () => {
    setTempStartDate('');
    setTempEndDate('');
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
                            checked={visibleColumns[key]}
                            onChange={() => {
                              setVisibleColumns({
                                ...visibleColumns,
                                [key]: !visibleColumns[key]
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 mb-6">
            {/* Botón para abrir modal de filtros de fechas */}
            <div className="lg:col-span-3">
              <Button 
                onClick={openFiltersModal}
                variant="outline"
                className="w-full h-10 flex items-center justify-center gap-2"
              >
                <ListFilter className="w-4 h-4" />
                {startDate || endDate ? (
                  <span className="text-sm">
                    {startDate && endDate ? `${startDate} - ${endDate}` : 
                     startDate ? `Desde ${startDate}` : `Hasta ${endDate}`}
                  </span>
                ) : (
                  <span>Filtrar por fechas</span>
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
                <SelectItem value="all">Todos los estados</SelectItem>
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
                <SelectItem value="all">Todas las duraciones</SelectItem>
                <SelectItem value="lt-60">Menos de 1 minuto</SelectItem>
                <SelectItem value="60-180">1-3 minutos</SelectItem>
                <SelectItem value="180-300">3-5 minutos</SelectItem>
                <SelectItem value="gt-300">Más de 5 minutos</SelectItem>
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
                <SelectItem value="DESC">Más recientes primero</SelectItem>
                <SelectItem value="ASC">Más antiguos primero</SelectItem>
              </Select>
            </div>
            
            {/* Filtro de disconnection_reason (solo frontend) */}
            <div className="lg:col-span-2">
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
                {searchTerm || startDate || endDate || statusFilter || disconnectionReasonFilter || durationFilter
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
                                {new Date(call.start_timestamp || 0).toLocaleString()}
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
                    ) : searchTerm || statusFilter || durationFilter || startDate || endDate || sortOrderFilter !== 'DESC' ? (
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
                        <p className="text-slate-800">{new Date(selectedCallModal.start_timestamp || 0).toLocaleString()}</p>
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
                    {formatTranscript(selectedCallModal.transcript)}
                  </CardContent>
                </Card>
              )}
              
              {/* Metadata */}
              {selectedCallModal.metadata && Object.keys(selectedCallModal.metadata).length > 0 && (
                <Card className="mb-6 bg-white shadow-sm border-slate-200">
                  <CardHeader className="pb-2">
                    <h3 className="text-lg font-semibold text-slate-800">Metadata</h3>
                  </CardHeader>
                  <CardContent className="p-4">
                    {renderJson(selectedCallModal.metadata)}
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
                    {renderJson(selectedCallModal.metadata.retell_llm_dynamic_variables)}
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
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
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
                  Fecha final
                </label>
                <Input
                  type="date"
                  value={tempEndDate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTempEndDate(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>
            
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
    </div>
  );
}

export default Recordings;