import React from 'react';
import { Play, Pause, Download, Clock, ChevronDown, ChevronUp, Search, X, Phone, ChevronLeft, ChevronRight, ListFilter, PhoneOff, RefreshCw, PhoneCall, Plus, User, Send, CalendarDays } from 'lucide-react';
import type { DetailedRetellCall, FilterCriteria, RetellAgent, RetellPhoneNumber } from '../types';
import { useCallsContext } from '../context/CallsContext';
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { listCalls, exportCallsWithColumns, fetchAgents, createPhoneCall, getCallTranscript } from '../api';

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

// Modal para rellamar usando los datos de una llamada existente
interface RecallModalProps {
  call: DetailedRetellCall;
  onClose: () => void;
  apiKey: string | null;
  apiKeyTest: string[] | null;
  phoneNumbers: RetellPhoneNumber[];
}

function normalizeE164(num: string): string {
  const trimmed = num.trim();
  if (!trimmed) return trimmed;
  return trimmed.startsWith('+') ? trimmed : `+${trimmed}`;
}

function RecallModal({ call, onClose, apiKey, apiKeyTest, phoneNumbers }: RecallModalProps) {
  const [fromNumber, setFromNumber] = React.useState(normalizeE164(call.from_number || ''));
  const [toNumber, setToNumber] = React.useState(normalizeE164(call.to_number || ''));
  const [overrideAgentId, setOverrideAgentId] = React.useState(call.agent_id || '');
  const [loading, setLoading] = React.useState(false);
  const [loadingAgents, setLoadingAgents] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [agentsError, setAgentsError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [agents, setAgents] = React.useState<RetellAgent[]>([]);
  const [selectedAgent, setSelectedAgent] = React.useState<RetellAgent | null>(null);
  const [showAgentsDropdown, setShowAgentsDropdown] = React.useState(false);

  // Construir variables dinámicas a partir de la metadata de la llamada
  const buildInitialVars = (): { key: string; value: string }[] => {
    const meta = call.metadata;
    if (!meta || typeof meta !== 'object') return [{ key: '', value: '' }];
    const entries = Object.entries(meta)
      .filter(([, v]) => v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
      .map(([k, v]) => ({ key: k, value: v === null ? '' : String(v) }));
    return entries.length > 0 ? entries : [{ key: '', value: '' }];
  };

  const [dynamicVariables, setDynamicVariables] = React.useState<{ key: string; value: string }[]>(buildInitialVars);

  // Cargar agentes al montar — usando el apiKey del workspace correcto
  React.useEffect(() => {
    const loadAgents = async () => {
      // Determinar el apiKey correcto según el from_number
      const normalized = normalizeE164(call.from_number || '');
      const phoneMatch = phoneNumbers.find(p => normalizeE164(p.phone_number || '') === normalized);
      const keysToTry: string[] = [];
      if (phoneMatch?.workspace_api_key) keysToTry.push(phoneMatch.workspace_api_key);
      if (apiKeyTest && apiKeyTest.length > 0) keysToTry.push(...apiKeyTest);
      if (apiKey) keysToTry.push(apiKey);
      const uniqueKeys = Array.from(new Set(keysToTry));

      if (uniqueKeys.length === 0) {
        setAgentsError('API key no configurada');
        return;
      }

      setLoadingAgents(true);
      setAgentsError(null);

      // Intentar con cada key hasta encontrar agentes
      let allAgents: RetellAgent[] = [];
      for (const key of uniqueKeys) {
        try {
          const data = await fetchAgents(key);
          allAgents = [...allAgents, ...data.filter(a => !allAgents.find(x => x.agent_id === a.agent_id))];
        } catch {
          // continuar con la siguiente key
        }
      }

      try {
        setAgents(allAgents);
        if (call.agent_id) {
          // call.agent_id puede contener el nombre del agente (guardado así en el backend)
          // o el ID real de Retell, por eso comparamos contra ambos campos
          const match = allAgents.find(
            a => a.agent_id === call.agent_id || a.agent_name === call.agent_id
          );
          if (match) {
            setSelectedAgent(match);
            setOverrideAgentId(match.agent_id);
          }
        }
        if (allAgents.length === 0) {
          setAgentsError('No se encontraron agentes');
        }
      } catch (err) {
        setAgentsError(err instanceof Error ? err.message : 'Error al cargar los agentes');
      } finally {
        setLoadingAgents(false);
      }
    };
    loadAgents();
  }, [apiKey, apiKeyTest, call.agent_id, call.from_number, phoneNumbers]);

  // Cerrar dropdown al hacer clic fuera
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.recall-agent-dropdown')) {
        setShowAgentsDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addDynamicVariable = () => {
    setDynamicVariables([...dynamicVariables, { key: '', value: '' }]);
  };

  const updateDynamicVariable = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...dynamicVariables];
    updated[index][field] = value;
    setDynamicVariables(updated);
  };

  const removeDynamicVariable = (index: number) => {
    setDynamicVariables(dynamicVariables.filter((_, i) => i !== index));
  };

  const handleSelectAgent = (agent: RetellAgent) => {
    setSelectedAgent(agent);
    setOverrideAgentId(agent.agent_id);
    setShowAgentsDropdown(false);
  };

  // Resolver el apiKey correcto: buscar el workspace_api_key del número de origen
  const resolveApiKey = (num: string): string | null => {
    const normalized = normalizeE164(num);
    const match = phoneNumbers.find(p =>
      normalizeE164(p.phone_number || '') === normalized
    );
    if (match?.workspace_api_key) return match.workspace_api_key;
    // Si hay múltiples API keys, probar la que sea
    if (apiKeyTest && apiKeyTest.length > 0) return apiKeyTest[0];
    return apiKey;
  };

  const handleCreateCall = async () => {
    if (!fromNumber) { setError('El número de origen es obligatorio'); return; }
    if (!toNumber) { setError('El número de destino es obligatorio'); return; }
    if (!selectedAgent) { setError('Selecciona un agente'); return; }

    const effectiveApiKey = resolveApiKey(fromNumber);
    if (!effectiveApiKey) { setError('API key no configurada'); return; }

    setLoading(true);
    setError(null);
    setSuccess(null);

    const dynamicVars: Record<string, any> = {};
    dynamicVariables.forEach(({ key, value }) => {
      if (key.trim()) dynamicVars[key] = value;
    });

    try {
      const params: any = {
        from_number: normalizeE164(fromNumber),
        to_number: normalizeE164(toNumber),
        override_agent_id: overrideAgentId,
        ...(Object.keys(dynamicVars).length > 0 && { retell_llm_dynamic_variables: dynamicVars }),
      };
      const result = await createPhoneCall(effectiveApiKey, params);
      setSuccess(`Llamada iniciada con éxito. ID: ${result.call_id || 'N/A'}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar la llamada');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-200 p-4 bg-gradient-to-r from-slate-50 to-blue-50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <PhoneCall className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-medium text-slate-800">Rellamar</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500 hover:text-slate-700" />
          </button>
        </div>

        <div className="p-5 space-y-4 bg-white overflow-y-auto flex-1">
          {/* Número de origen (editable) */}
          <div>
            <label className="block text-slate-600 mb-1 text-sm">Número de Origen *</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-600 pointer-events-none" />
              <input
                type="text"
                value={fromNumber}
                onChange={e => setFromNumber(e.target.value)}
                placeholder="+34600000000"
                className="w-full pl-9 pr-3 py-3 rounded-lg bg-white border border-slate-300 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
            </div>
            <p className="text-xs text-slate-400 mt-1">Debe ser el número registrado en Retell (formato E.164, ej: +34600000000)</p>
          </div>

          {/* Número de destino (editable, pre-rellenado) */}
          <div>
            <label className="block text-slate-600 mb-1 text-sm">Número de Destino *</label>
            <input
              type="text"
              value={toNumber}
              onChange={e => setToNumber(e.target.value)}
              placeholder="+34600000000"
              className="w-full p-3 rounded-lg bg-white border border-slate-300 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              required
            />
          </div>

          {/* Selector de agente (pre-seleccionado) */}
          <div className="relative recall-agent-dropdown">
            <label className="block text-slate-600 mb-1 text-sm">Agente *</label>
            {loadingAgents ? (
              <div className="flex items-center bg-slate-50 p-3 rounded-lg border border-slate-200 text-slate-600 text-sm">
                <svg className="animate-spin mr-2 h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Cargando agentes...
              </div>
            ) : agentsError ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{agentsError}</div>
            ) : agents.length === 0 ? (
              <div className="flex items-center bg-slate-50 p-3 rounded-lg border border-slate-200 text-slate-600 text-sm">
                No se encontraron agentes disponibles
              </div>
            ) : (
              <>
                <button
                  onClick={() => setShowAgentsDropdown(!showAgentsDropdown)}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-white border border-slate-300 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <div className="flex items-center">
                    <User className="w-4 h-4 text-blue-600 mr-2" />
                    <span>{selectedAgent ? selectedAgent.agent_name : 'Seleccionar agente'}</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${showAgentsDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showAgentsDropdown && (
                  <div className="absolute mt-1 w-full bg-white rounded-lg shadow-lg z-10 border border-slate-200 max-h-52 overflow-y-auto">
                    <ul className="py-1">
                      {agents.map(agent => (
                        <li key={agent.agent_id}>
                          <button
                            onClick={() => handleSelectAgent(agent)}
                            className={`w-full text-left px-4 py-2 flex items-center text-sm ${
                              selectedAgent?.agent_id === agent.agent_id
                                ? 'bg-blue-600 text-white'
                                : 'text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <User className="w-3.5 h-3.5 mr-2 shrink-0" />
                            <div>
                              <p>{agent.agent_name}</p>
                              <p className={`text-xs truncate ${selectedAgent?.agent_id === agent.agent_id ? 'text-blue-200' : 'text-slate-400'}`}>{agent.agent_id}</p>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Variables dinámicas (pre-rellenadas desde metadata) */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-slate-600 text-sm">Variables de la llamada</label>
              <button
                onClick={addDynamicVariable}
                className="text-blue-600 hover:text-blue-700 flex items-center text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Añadir variable
              </button>
            </div>
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {dynamicVariables.map((variable, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={variable.key}
                    onChange={e => updateDynamicVariable(index, 'key', e.target.value)}
                    placeholder="Nombre"
                    className="flex-1 p-2 rounded-lg bg-white border border-slate-300 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  <input
                    type="text"
                    value={variable.value}
                    onChange={e => updateDynamicVariable(index, 'value', e.target.value)}
                    placeholder="Valor"
                    className="flex-1 p-2 rounded-lg bg-white border border-slate-300 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  <button
                    onClick={() => removeDynamicVariable(index)}
                    className="p-1 hover:bg-slate-200 rounded-full transition-colors shrink-0"
                  >
                    <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
          )}
          {success && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{success}</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-slate-200 bg-slate-50 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={handleCreateCall}
            disabled={loading || !fromNumber || !toNumber || !selectedAgent}
            className={`px-4 py-2 rounded-lg text-white flex items-center text-sm ${
              loading || !fromNumber || !toNumber || !selectedAgent
                ? 'bg-blue-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800'
            }`}
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Procesando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-1" />
                Iniciar llamada
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Recordings({ onNavigate }: RecordingsProps) {

  const [selectedCallModal, setSelectedCallModal] = React.useState<DetailedRetellCall | null>(null);
  const [recallCall, setRecallCall] = React.useState<DetailedRetellCall | null>(null);
  const [selectedCall, setSelectedCall] = React.useState<string | null>(null);
  const [playingId, setPlayingId] = React.useState<string | null>(null);
  const [isModalVisible, setIsModalVisible] = React.useState(false);
  const [shouldRenderModal, setShouldRenderModal] = React.useState(false);
  const [modalCallForTransition, setModalCallForTransition] = React.useState<DetailedRetellCall | null>(null);
  const [localModalTranscript, setLocalModalTranscript] = React.useState<string | null>(null);
  const [loadingModalTranscript, setLoadingModalTranscript] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [audioCurrentTime, setAudioCurrentTime] = React.useState(0);
  const [audioDuration, setAudioDuration] = React.useState(0);
  const [audioError, setAudioError] = React.useState<string | null>(null);
  
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
    apiKeyTest,
    clientId,
    phoneNumbers: contextPhoneNumbers,
    currentPage: contextCurrentPage,
    totalPages: contextTotalPages,
    hasMorePages,
    setFilterCriteria: contextSetFilterCriteria,
    dashboardData,
    totalCallsFiltered
  } = useCallsContext();
  
  // El backend aota el conteo a 10,001 para evitar scans completos sobre millones de filas.
  // Si el total devuelto es exactamente 10,001, significa "hay más de 10,000".
  const COUNT_CAP = 10001;
  const formatFilteredTotal = (n: number) => n >= COUNT_CAP ? '10.000+' : n.toLocaleString('es-ES');

  // totalCallsDisplay y hasAnyActiveFilter se calculan más abajo (después de los useState)

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
  const [showUnifiedFiltersDropdown, setShowUnifiedFiltersDropdown] = React.useState(false);
  const [showDatePresetDropdown, setShowDatePresetDropdown] = React.useState(false);
  const [expandedFilterSections, setExpandedFilterSections] = React.useState<Set<string>>(new Set());
  const toggleFilterSection = (key: string) => {
    setExpandedFilterSections(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };
  
  // Estados para los filtros
  const [disconnectionReasonFilter, setDisconnectionReasonFilter] = React.useState<string | null>(null);
  const [durationOperator, setDurationOperator] = React.useState<'gt' | 'lt' | 'eq' | null>(null);
  const [durationMinutes, setDurationMinutes] = React.useState<string>('');
  // Valor derivado para mantener compatibilidad con todos los checks de "filtro activo"
  const durationFilter = (durationOperator && durationMinutes.trim()) ? `${durationOperator}:${durationMinutes}` : null;
  const [statusFilter, setStatusFilter] = React.useState<string | null>(null);
  const [phoneNumberFilter, setPhoneNumberFilter] = React.useState<string>('');
  const [sortOrderFilter, setSortOrderFilter] = React.useState<'ASC' | 'DESC'>('DESC');
  const [interestFilter, setInterestFilter] = React.useState<string | null>(null);
  const [tipoViviendaFilter, setTipoViviendaFilter] = React.useState<string | null>(null);
  const [agentIdFilter, setAgentIdFilter] = React.useState<string | null>(null);
  
  // Estados para filtro de base de datos
  const [databaseFilter, setDatabaseFilter] = React.useState<string>('');
  const [appliedDatabaseFilter, setAppliedDatabaseFilter] = React.useState<string>('');
  
  // Verificar si el usuario tiene permiso para ver filtros solares
  const [hasFiltroSolar, setHasFiltroSolar] = React.useState(false);
  
  // Verificar permisos al montar el componente
  React.useEffect(() => {
    try {
      const metadataStr = sessionStorage.getItem('metadata');
      if (metadataStr) {
        const metadata = JSON.parse(metadataStr);
        setHasFiltroSolar(metadata?.filtro_solar === true);
      }
    } catch (error) {
      // console.error('Error al leer metadata del sessionStorage:', error);
      setHasFiltroSolar(false);
    }
  }, []);
  
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
  
  // Preset de fecha activo: 'today' | 'week' | 'month' | 'custom'
  const [datePreset, setDatePreset] = React.useState<'today' | 'week' | 'month' | 'custom'>('today');

  // Calcula el rango ISO para un preset dado (hora UTC, misma lógica que Dashboard)
  const calcPresetDates = React.useCallback((preset: 'today' | 'week' | 'month') => {
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    if (preset === 'today') {
      const tomorrow = new Date(todayUTC); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      return { start: todayUTC.toISOString(), end: tomorrow.toISOString() };
    }
    if (preset === 'week') {
      const from = new Date(todayUTC); from.setUTCDate(from.getUTCDate() - 6);
      const to = new Date(todayUTC); to.setUTCDate(to.getUTCDate() + 1);
      return { start: from.toISOString(), end: to.toISOString() };
    }
    // month
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const startOfNext  = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    return { start: startOfMonth.toISOString(), end: startOfNext.toISOString() };
  }, []);

  const [startDate, setStartDate] = React.useState(() => calcPresetDates('today').start);
  const [endDate,   setEndDate]   = React.useState(() => calcPresetDates('today').end);

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

  // Cargar campos de metadata del session storage. Re-ejecutar cuando cambia clientId para traer siempre el del cliente actual
  React.useEffect(() => {
    try {
      const storedMetadata = sessionStorage.getItem('metadata_llamadas');
      
      if (storedMetadata) {
        const metadataArray = JSON.parse(storedMetadata);
        
        if (Array.isArray(metadataArray) && metadataArray.length > 0) {
          const fields = Object.keys(metadataArray[0]);
          setAvailableMetadataFields(fields);
          const initialFields: Record<string, boolean> = {};
          fields.forEach(field => {
            initialFields[field] = false;
          });
          setMetadataFields(initialFields);
        } else if (typeof metadataArray === 'object' && metadataArray !== null) {
          const fields = Object.keys(metadataArray);
          setAvailableMetadataFields(fields);
          const initialFields: Record<string, boolean> = {};
          fields.forEach(field => {
            initialFields[field] = false;
          });
          setMetadataFields(initialFields);
        } else {
          setAvailableMetadataFields([]);
          setMetadataFields({});
        }
      } else {
        setAvailableMetadataFields([]);
        setMetadataFields({});
      }
    } catch (error) {
      setAvailableMetadataFields([]);
      setMetadataFields({});
    }
  }, [clientId]);

  // Cálculo del total y etiqueta a mostrar en el header.
  // Se calcula aquí, después de todos los useState, para tener acceso a todas las variables.
  // Para el display del total: siempre hay filtro activo porque siempre se filtra por fecha
  const hasAnyActiveFilter = !!(searchTerm || startDate || endDate || statusFilter ||
    disconnectionReasonFilter || durationFilter || phoneNumberFilter ||
    sortOrderFilter !== 'DESC' || interestFilter || tipoViviendaFilter ||
    agentIdFilter || appliedDatabaseFilter);

  let totalCallsDisplay: number | undefined = undefined;
  let totalCallsLabel: string = '';

  if (hasAnyActiveFilter && totalFilteredCalls > 0) {
    totalCallsDisplay = totalFilteredCalls;
    totalCallsLabel = totalFilteredCalls === 1 ? 'llamada encontrada' : 'llamadas encontradas';
  } else if (!hasAnyActiveFilter && totalCallsFiltered !== null && totalCallsFiltered !== undefined) {
    totalCallsDisplay = totalCallsFiltered;
    totalCallsLabel = totalCallsFiltered === 1 ? 'llamada en servidor' : 'llamadas en servidor';
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
    // Ya no necesitamos filtrar por disconnection_reason en frontend porque el backend lo hace
    let baseCalls: DetailedRetellCall[] = [];
    if (filteredCallsData.length > 0) {
      baseCalls = filteredCallsData;
    } else {
      // Si no hay filtros activos, usar las llamadas originales
      const hasActiveFilters = searchTerm || statusFilter || durationFilter || startDate || endDate || phoneNumberFilter || sortOrderFilter !== 'DESC' || interestFilter || tipoViviendaFilter || agentIdFilter || disconnectionReasonFilter;
      if (!hasActiveFilters) {
        baseCalls = allCalls;
      } else {
        // Si hay filtros pero aún no se han aplicado, mostrar array vacío
        baseCalls = [];
      }
    }
    
    return baseCalls;
  }, [filteredCallsData, allCalls, searchTerm, statusFilter, durationFilter, startDate, endDate, phoneNumberFilter, sortOrderFilter, interestFilter, tipoViviendaFilter, agentIdFilter, disconnectionReasonFilter]);

  // Calcular llamadas para la página actual basándose en filteredCalls
  const currentPageCalls = React.useMemo(() => {
    const indexOfLastCall = currentPage * itemsPerPage;
    const indexOfFirstCall = indexOfLastCall - itemsPerPage;
    return filteredCalls.slice(indexOfFirstCall, indexOfLastCall);
  }, [filteredCalls, currentPage, itemsPerPage]);

  // Calcular número total de páginas basado en las llamadas filtradas
  const totalPages = React.useMemo(() => {
    // Verificar si hay filtros activos
    const hasActiveFilters = searchTerm || statusFilter || durationFilter || startDate || endDate || phoneNumberFilter || sortOrderFilter !== 'DESC' || interestFilter || tipoViviendaFilter || agentIdFilter || disconnectionReasonFilter || appliedDatabaseFilter;
    
    // Si tenemos datos filtrados de la API, usar totalFilteredCalls si está disponible
    if (hasActiveFilters && totalFilteredCalls > 0) {
      return Math.ceil(totalFilteredCalls / itemsPerPage);
    }
    
    // Si tenemos datos filtrados pero no totalFilteredCalls, usar totalFilteredPages
    if (hasActiveFilters && filteredCallsData.length > 0 && totalFilteredPages > 0) {
      // Calcular basado en totalFilteredPages del API (cada página del API tiene 100 registros)
      const apiPageSize = 100;
      const totalItems = totalFilteredPages * apiPageSize;
      return Math.ceil(totalItems / itemsPerPage);
    }
    
    // Si tenemos filtros aplicados pero aún no hay datos filtrados, calcular basado en las llamadas filtradas
    if (hasActiveFilters) {
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
  }, [filteredCallsData.length, totalFilteredPages, totalFilteredCalls, itemsPerPage, filteredCalls.length, searchTerm, statusFilter, durationFilter, startDate, endDate, phoneNumberFilter, sortOrderFilter, interestFilter, tipoViviendaFilter, agentIdFilter, disconnectionReasonFilter, appliedDatabaseFilter, contextTotalPages, allCalls.length]);

  // Iniciar la carga de datos la primera vez que se monta el componente
  React.useEffect(() => {
    // Solo cargamos si:
    // 1. Tenemos apiKey y clientId disponibles (necesarios para hacer la petición)
    // 2. No hay datos cargados
    // 3. No está cargando ya
    // 4. No estamos aplicando filtros manualmente
    // 5. No hay filtros de fecha activos (si los hay, el useEffect de paginación los carga directamente)
    const hasDateFilter = !!(startDate || endDate);
    if (
      apiKey && 
      clientId && 
      allCalls.length === 0 && 
      !loadingAllCalls && 
      !isApplyingFilters.current &&
      !hasDateFilter
    ) {
      // console.log('🔄 Iniciando carga de grabaciones con apiKey y clientId disponibles');
      loadAllCalls();
    } else if (!apiKey || !clientId) {
      // console.log('⏳ Esperando apiKey y clientId antes de cargar grabaciones...', { apiKey: !!apiKey, clientId: !!clientId });
    }
    
    // Sincronizamos los estados locales con el contexto
    setError(contextError);
  }, [allCalls.length, loadingAllCalls, contextError, apiKey, clientId, loadAllCalls]); // Agregado apiKey, clientId y loadAllCalls a las dependencias

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
      if (!target.closest('.unified-filters-dropdown') && !target.closest('.unified-filters-button')) {
        setShowUnifiedFiltersDropdown(false);
      }
      if (!target.closest('.date-preset-dropdown') && !target.closest('.date-preset-button')) {
        setShowDatePresetDropdown(false);
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
    if (audioRef.current) {
      audioRef.current.preload = 'metadata';
      try {
        audioRef.current.crossOrigin = 'anonymous';
      } catch {}
    }
    
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
      setAudioError('No se pudo reproducir el audio. Verifica conexión, permisos CORS o que la URL siga activa.');
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
      // console.error('Recording URL not found for callId:', callId);
      setPlayingId(null);
      return;
    }

    setAudioError(null);

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
        // console.error('Error playing audio:', error);
        setPlayingId(null); // Limpiar estado de reproducción en caso de error.
        setAudioError('El navegador bloqueó la reproducción automática o hubo un error de audio. Intenta presionar Play nuevamente.');
      }
    }
  };

  // Cargar transcript bajo demanda cuando se abre el modal
  React.useEffect(() => {
    if (!selectedCallModal?.call_id) {
      setLocalModalTranscript(null);
      return;
    }
    let cancelled = false;
    setLoadingModalTranscript(true);
    setLocalModalTranscript(null);
    getCallTranscript(selectedCallModal.call_id)
      .then((data) => {
        if (!cancelled) setLocalModalTranscript(data.transcript);
      })
      .catch(() => {
        if (!cancelled) setLocalModalTranscript(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingModalTranscript(false);
      });
    return () => { cancelled = true; };
  }, [selectedCallModal?.call_id]);

  // Manejar la transición del modal cuando se abre o cierra
  React.useEffect(() => {
    if (selectedCallModal) {
      // Cuando hay un modal seleccionado, guardar la referencia y montarlo
      setModalCallForTransition(selectedCallModal);
      setShouldRenderModal(true);
      setIsModalVisible(false);
      // Activar la transición después de que el DOM esté listo
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsModalVisible(true);
        });
      });
    } else if (modalCallForTransition) {
      // Cuando se cierra, mantener la referencia del call para la transición
      // Iniciar la transición de salida
      setIsModalVisible(false);
      // Desmontar después de que termine la transición
      const timer = setTimeout(() => {
        setShouldRenderModal(false);
        setModalCallForTransition(null);
      }, 300); // Duración de la transición
      return () => clearTimeout(timer);
    }
  }, [selectedCallModal, modalCallForTransition]);

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

  // Navegación con teclado (flechas arriba/abajo)
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Solo activar cuando el sidebar está abierto
      if (!selectedCallModal) return;
      
      // Evitar navegación si el usuario está escribiendo en un input
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      
      // Navegar a la siguiente grabación (flecha abajo)
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        const currentIndex = filteredCalls.findIndex(call => call.call_id === selectedCallModal.call_id);
        
        if (currentIndex !== -1 && currentIndex < filteredCalls.length - 1) {
          const nextCall = filteredCalls[currentIndex + 1];
          openCallModal(nextCall);
          
          // Si la siguiente grabación está en otra página, cambiar de página
          const nextCallPage = Math.ceil((currentIndex + 2) / itemsPerPage);
          if (nextCallPage !== currentPage && nextCallPage <= totalPages) {
            setCurrentPage(nextCallPage);
          }
        }
      }
      
      // Navegar a la grabación anterior (flecha arriba)
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        const currentIndex = filteredCalls.findIndex(call => call.call_id === selectedCallModal.call_id);
        
        if (currentIndex > 0) {
          const prevCall = filteredCalls[currentIndex - 1];
          openCallModal(prevCall);
          
          // Si la grabación anterior está en otra página, cambiar de página
          const prevCallPage = Math.ceil(currentIndex / itemsPerPage);
          if (prevCallPage !== currentPage && prevCallPage >= 1) {
            setCurrentPage(prevCallPage);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedCallModal, filteredCalls, itemsPerPage, currentPage, totalPages]);

  // Filter handlers
  const handleDisconnectionReasonFilter = (reason: string | null) => {
    setDisconnectionReasonFilter(reason);
    setCurrentPage(1); // Reset to first page when filter changes
  };

  const clearDurationFilter = () => {
    setDurationOperator(null);
    setDurationMinutes('');
    setCurrentPage(1);
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
          // console.log(`🔍 Procesando metadata para call ${call.call_id}:`, {
            // metadata: call.metadata,
            // field: field,
            // isArray: Array.isArray(call.metadata),
            // length: call.metadata?.length,
            // fullCall: call // Ver toda la estructura de la llamada
          // });
        }
        
        // Buscar el campo en la metadata de la llamada
        let metadataSource: any = null;
        
        // Intentar diferentes ubicaciones posibles para la metadata
        let rawSource = call.metadata ?? call.metadata_llamadas ?? call.data?.metadata ?? call.data?.metadata_llamadas;
        if (rawSource) {
          // Si viene como string JSON (ej: '{"datos":{...},"analisis":{...}}'), parsear
          if (typeof rawSource === 'string') {
            try {
              metadataSource = JSON.parse(rawSource);
            } catch {
              metadataSource = rawSource;
            }
          } else {
            metadataSource = rawSource;
          }
        }
        
        // Helper: serializar valor para exportación (objetos como JSON legible)
        const serializeValue = (val: any): string => {
          if (val === null || val === undefined) return '';
          if (typeof val === 'string') return val;
          if (typeof val === 'object') return JSON.stringify(val);
          return String(val);
        };
        
        if (metadataSource && Array.isArray(metadataSource) && metadataSource.length > 0) {
          // Si metadata es un array, buscar en el primer elemento
          const metadataObj = metadataSource[0];
          if (metadataObj && metadataObj[field] !== undefined) {
            fieldValue = serializeValue(metadataObj[field]);
          }
        } else if (metadataSource && typeof metadataSource === 'object' && !Array.isArray(metadataSource)) {
          // Si metadata es un objeto directo (no array)
          if (metadataSource[field] !== undefined) {
            fieldValue = serializeValue(metadataSource[field]);
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
        // Escapar comillas y envolver en comillas si hay comas, saltos de línea o comillas (para JSON legible)
        const value = String(row[column] || '').replace(/"/g, '""');
        const needsQuotes = value.includes(',') || value.includes('\n') || value.includes('\r') || value.includes('"');
        return needsQuotes ? `"${value}"` : value;
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
      // console.log('🔍 [openExportModal] Metadata del session storage:', storedMetadata);
      
      if (storedMetadata) {
        const metadataArray = JSON.parse(storedMetadata);
        // console.log('🔍 [openExportModal] Metadata parseada:', metadataArray);
        
        if (Array.isArray(metadataArray) && metadataArray.length > 0) {
          // Si es un array, obtener las claves del primer objeto
          const fields = Object.keys(metadataArray[0]);
          // console.log('🔍 [openExportModal] Campos de metadata encontrados (array):', fields);
          
          setAvailableMetadataFields(fields);
          
          const initialFields: Record<string, boolean> = {};
          fields.forEach(field => {
            initialFields[field] = false;
          });
          setMetadataFields(initialFields);
        } else if (typeof metadataArray === 'object' && metadataArray !== null) {
          // Si es un objeto directo, obtener sus claves
          const fields = Object.keys(metadataArray);
          // console.log('🔍 [openExportModal] Campos de metadata encontrados (objeto):', fields);
          
          setAvailableMetadataFields(fields);
          
          const initialFields: Record<string, boolean> = {};
          fields.forEach(field => {
            initialFields[field] = false;
          });
          setMetadataFields(initialFields);
        }
      }
    } catch (error) {
      // console.error('Error al cargar metadata del session storage en openExportModal:', error);
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
        // console.log('🔍 Agregando metadata a las columnas solicitadas:', finalSelectedColumns);
        // console.log('🔍 Campos de metadata seleccionados:', selectedMetadataFields);
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
        // console.log('Exportación - Número original:', phoneNumberFilter);
        // console.log('Exportación - Número normalizado:', normalizedPhone);
        params.to_number_norm = normalizedPhone;
      }
      
      // Agregar filtro de interés
      if (interestFilter) {
        params.interest = interestFilter;
      }
      
      // Agregar filtro de tipo de vivienda
      if (tipoViviendaFilter) {
        params.tipo_vivienda = tipoViviendaFilter;
      }
      
      // Agregar filtro de motivo de desconexión (end_reason en la base de datos)
      if (disconnectionReasonFilter) {
        params.end_reason = disconnectionReasonFilter;
      }
      
      // Agregar filtro de base de datos (bdd)
      if (appliedDatabaseFilter && appliedDatabaseFilter.trim()) {
        params.bdd = appliedDatabaseFilter.trim();
      }
      
      if (startISO) params.fecha_inicio = startISO;
      if (endISO) params.fecha_fin = endISO;

      // Usar el nuevo endpoint con columnas seleccionadas
      const allResp = await exportCallsWithColumns(apiKey, params);
      const allForExport = allResp.calls;

      // Ya no necesitamos filtrar en frontend porque el backend lo hace
      const finalData = allForExport;

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
    const todayRange = calcPresetDates('today');
    setDatePreset('today');
    setStartDate(todayRange.start);
    setEndDate(todayRange.end);
    setStatusFilter(null);
    setDisconnectionReasonFilter(null);
    setDurationOperator(null);
    setDurationMinutes('');
    setPhoneNumberFilter('');
    setSortOrderFilter('DESC'); // Resetear a descendente por defecto
    setInterestFilter(null);
    setTipoViviendaFilter(null);
    setAgentIdFilter(null);
    setDatabaseFilter('');
    setAppliedDatabaseFilter('');
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

  // Obtener agentes únicos de las llamadas (incluir tanto allCalls como filteredCallsData)
  const uniqueAgents = React.useMemo(() => {
    const agents = new Set<string>();
    // Agregar agentes de allCalls
    allCalls.forEach(call => {
      if (call.agent_id) {
        agents.add(call.agent_id);
      }
    });
    // Agregar agentes de filteredCallsData (cuando hay filtros aplicados)
    if (filteredCallsData.length > 0) {
      filteredCallsData.forEach(call => {
        if (call.agent_id) {
          agents.add(call.agent_id);
        }
      });
    }
    return Array.from(agents).sort();
  }, [allCalls, filteredCallsData]);

  // Calcular el recuento de filtros unificados activos
  const activeUnifiedFiltersCount = React.useMemo(() => {
    let count = 0;
    if (statusFilter) count++;
    if (disconnectionReasonFilter) count++;
    if (durationFilter) count++;
    if (sortOrderFilter !== 'DESC') count++;
    if (interestFilter) count++;
    if (tipoViviendaFilter) count++;
    if (agentIdFilter) count++;
    if (phoneNumberFilter) count++;
    if (searchTerm) count++;
    return count;
  }, [statusFilter, disconnectionReasonFilter, durationFilter, sortOrderFilter, interestFilter, tipoViviendaFilter, agentIdFilter, phoneNumberFilter, searchTerm]);

  // Calcular el recuento total de filtros aplicados
  const activeFiltersCount = React.useMemo(() => {
    let count = 0;
    if (searchTerm) count++;
    if (datePreset !== 'today') count++;
    if (statusFilter) count++;
    if (disconnectionReasonFilter) count++;
    if (durationFilter) count++;
    if (phoneNumberFilter) count++;
    if (sortOrderFilter !== 'DESC') count++;
    if (interestFilter) count++;
    if (tipoViviendaFilter) count++;
    if (agentIdFilter) count++;
    if (appliedDatabaseFilter) count++;
    return count;
  }, [searchTerm, datePreset, statusFilter, disconnectionReasonFilter, durationFilter, phoneNumberFilter, sortOrderFilter, interestFilter, tipoViviendaFilter, agentIdFilter, appliedDatabaseFilter]);


  // Función para aplicar filtros usando la API list-calls
  const applyFilters = React.useCallback(async (pageToLoad: number = 1, appendData: boolean = false) => {
    if (!apiKey) return;
    
    // Verificar si hay algún filtro activo (ahora incluyendo disconnection_reason que se envía al backend)
    // Ahora también incluimos sortOrderFilter como filtro activo
    const hasActiveFilters = searchTerm || statusFilter || durationFilter || startDate || endDate || phoneNumberFilter || sortOrderFilter !== 'DESC' || interestFilter || tipoViviendaFilter || agentIdFilter || disconnectionReasonFilter || appliedDatabaseFilter;
    
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
        page: pageToLoad,
        per_page: 100,
        sort_order: sortOrderFilter // Usar el filtro de ordenamiento
      };
      
      // Usar el client_id del contexto
      if (clientId) {
        params.client_id = clientId;
        // console.log('Usando client_id para filtros:', clientId);
      } else {
        // console.warn('No se encontró client_id en el contexto');
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
        // console.log('Número original:', phoneNumberFilter);
        // console.log('Número normalizado:', normalizedPhone);
        params.to_number_norm = normalizedPhone;
      }
      
      // Agregar filtros de fecha (ya en formato ISO)
      if (startDate) {
        params.fecha_inicio = startDate;
      }
      if (endDate) {
        params.fecha_fin = endDate;
      }
      
      // Agregar filtro de interés
      if (interestFilter) {
        params.interest = interestFilter;
      }
      
      // Agregar filtro de tipo de vivienda
      if (tipoViviendaFilter) {
        params.tipo_vivienda = tipoViviendaFilter;
      }
      
      // Agregar filtro de agent_id
      if (agentIdFilter) {
        params.agent_id = agentIdFilter;
        // console.log('🔍 Filtro de agente aplicado:', agentIdFilter);
      }
      
      // Agregar filtro de motivo de desconexión (end_reason en la base de datos)
      if (disconnectionReasonFilter) {
        params.end_reason = disconnectionReasonFilter;
        // console.log('🔍 Filtro de motivo de desconexión aplicado:', disconnectionReasonFilter);
      }
      
      // Agregar filtro de base de datos (bdd)
      if (appliedDatabaseFilter && appliedDatabaseFilter.trim()) {
        params.bdd = appliedDatabaseFilter.trim();
        // console.log('🔍 Filtro de base de datos aplicado:', appliedDatabaseFilter.trim());
      }
      
      // Filtro de duración: operator (gt/lt/eq) + minutos → ms para el backend
      if (durationOperator && durationMinutes.trim()) {
        const ms = Math.round(parseFloat(durationMinutes) * 60_000);
        if (!isNaN(ms) && ms >= 0) {
          if (durationOperator === 'gt') {
            params.min_duration_ms = ms;
          } else if (durationOperator === 'lt') {
            params.max_duration_ms = ms;
          } else if (durationOperator === 'eq') {
            // Tolerancia ±10 s para igualdad exacta
            params.min_duration_ms = Math.max(0, ms - 10_000);
            params.max_duration_ms = ms + 10_000;
          }
        }
      }

      // Buscar por call_id (parcial, server-side)
      if (searchTerm && searchTerm.trim()) {
        params.call_id = searchTerm.trim();
      }
      
      // console.log('Aplicando filtros con parámetros:', params);
      
      // Hacer la petición a la API
      const response = await listCalls(apiKey, params);
      
      // console.log('Respuesta de list-calls:', response);
      // console.log('🔍 Llamadas recibidas con filtro de agente:', response.calls.length);
      if (agentIdFilter && response.calls.length > 0) {
        // console.log('🔍 Primeras llamadas filtradas por agente:', response.calls.slice(0, 3).map(c => ({ call_id: c.call_id, agent_id: c.agent_id })));
      }
      
      // Actualizar estados con los resultados
      if (appendData && pageToLoad > 1) {
        // Si estamos cargando una página adicional, agregar a los datos existentes
        setFilteredCallsData(prev => [...prev, ...response.calls]);
      } else {
        // Si es la primera página o estamos recargando, reemplazar los datos
        setFilteredCallsData(response.calls);
      }
      
      // Actualizar totales solo si es la primera página o si recibimos información actualizada
      if (pageToLoad === 1 || response.total_calls) {
        setTotalFilteredCalls(response.total_calls || response.calls.length);
        setTotalFilteredPages(response.total_pages || 1);
      }
      
      // Solo resetear a la primera página si no estamos cargando una página específica
      if (!appendData && pageToLoad === 1) {
        setCurrentPage(1);
      }
      
    } catch (error) {
      // console.error('Error al aplicar filtros:', error);
      setError(error instanceof Error ? error.message : 'Error al aplicar filtros');
      setFilteredCallsData([]);
      setTotalFilteredCalls(0);
      setTotalFilteredPages(0);
    } finally {
      setLoadingFilters(false);
    }
  }, [apiKey, clientId, searchTerm, statusFilter, durationFilter, startDate, endDate, phoneNumberFilter, sortOrderFilter, interestFilter, tipoViviendaFilter, agentIdFilter, disconnectionReasonFilter, appliedDatabaseFilter]);

  // Efecto para cargar la página correcta cuando hay filtros aplicados y cambia currentPage
  React.useEffect(() => {
    const hasActiveFilters = searchTerm || statusFilter || durationFilter || startDate || endDate || phoneNumberFilter || sortOrderFilter !== 'DESC' || interestFilter || tipoViviendaFilter || agentIdFilter || disconnectionReasonFilter || appliedDatabaseFilter;
    
    if (!hasActiveFilters || !apiKey || !clientId) return;
    
    // Calcular qué página del API necesitamos cargar basado en currentPage e itemsPerPage
    // El API devuelve 100 registros por página, pero mostramos itemsPerPage (25, 50, 100) por página en el UI
    const apiPageSize = 100;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = currentPage * itemsPerPage;
    
    // Calcular qué páginas del API necesitamos cargar
    const firstApiPage = Math.floor(startIndex / apiPageSize) + 1;
    const lastApiPage = Math.floor((endIndex - 1) / apiPageSize) + 1;
    
    // Verificar si ya tenemos los datos necesarios en filteredCallsData
    const currentDataLength = filteredCallsData.length;
    const neededDataLength = endIndex;
    
    // Si necesitamos cargar más datos o si los datos están vacíos (primera carga con filtros)
    if (currentDataLength < neededDataLength || filteredCallsData.length === 0) {
      // Necesitamos cargar más datos
      // Cargar todas las páginas necesarias desde la primera hasta la última
      const loadPages = async () => {
        setLoadingFilters(true);
        try {
          const allCalls: any[] = [];
          let totalCallsFromApi = 0;
          let totalPagesFromApi = 0;
          
          // Si ya tenemos algunos datos, empezar desde donde terminamos
          const startApiPage = filteredCallsData.length === 0 ? 1 : Math.floor(filteredCallsData.length / apiPageSize) + 1;
          
          for (let apiPage = startApiPage; apiPage <= lastApiPage; apiPage++) {
            // Construir parámetros para la API
            const params: any = {
              page: apiPage,
              per_page: apiPageSize,
              sort_order: sortOrderFilter,
              client_id: clientId
            };
            
            if (statusFilter) params.status = statusFilter;
            if (phoneNumberFilter) {
              const normalizedPhone = normalizePhoneNumber(phoneNumberFilter);
              params.to_number_norm = normalizedPhone;
            }
            if (searchTerm && searchTerm.trim()) params.call_id = searchTerm.trim();
            if (startDate) params.fecha_inicio = startDate;
            if (endDate) params.fecha_fin = endDate;
            if (interestFilter) params.interest = interestFilter;
            if (tipoViviendaFilter) params.tipo_vivienda = tipoViviendaFilter;
            if (agentIdFilter) params.agent_id = agentIdFilter;
            if (disconnectionReasonFilter) params.end_reason = disconnectionReasonFilter;
            if (appliedDatabaseFilter && appliedDatabaseFilter.trim()) {
              params.bdd = appliedDatabaseFilter.trim();
            }
            if (durationFilter) {
              if (durationOperator && durationMinutes.trim()) {
                const ms = Math.round(parseFloat(durationMinutes) * 60_000);
                if (!isNaN(ms) && ms >= 0) {
                  if (durationOperator === 'gt') {
                    params.min_duration_ms = ms;
                  } else if (durationOperator === 'lt') {
                    params.max_duration_ms = ms;
                  } else if (durationOperator === 'eq') {
                    params.min_duration_ms = Math.max(0, ms - 10_000);
                    params.max_duration_ms = ms + 10_000;
                  }
                }
              }
            }
            
            const response = await listCalls(apiKey, params);
            allCalls.push(...response.calls);
            
            // Actualizar totales solo en la primera página
            if (apiPage === 1) {
              totalCallsFromApi = response.total_calls || 0;
              totalPagesFromApi = response.total_pages || 1;
              setTotalFilteredCalls(totalCallsFromApi);
              setTotalFilteredPages(totalPagesFromApi);
            }
            
            // Si esta página tiene menos de 100 resultados, no hay más páginas
            if (response.calls.length < apiPageSize) {
              break;
            }
          }
          
          // Si ya teníamos datos, agregar los nuevos; si no, reemplazar
          if (filteredCallsData.length > 0 && startApiPage > 1) {
            setFilteredCallsData(prev => [...prev, ...allCalls]);
          } else {
            setFilteredCallsData(allCalls);
          }
        } catch (error) {
          // console.error('Error al cargar páginas filtradas:', error);
          setError(error instanceof Error ? error.message : 'Error al cargar datos filtrados');
        } finally {
          setLoadingFilters(false);
        }
      };
      
      loadPages();
    }
  }, [currentPage, itemsPerPage, searchTerm, statusFilter, durationFilter, startDate, endDate, phoneNumberFilter, sortOrderFilter, interestFilter, tipoViviendaFilter, agentIdFilter, disconnectionReasonFilter, appliedDatabaseFilter, apiKey, clientId, filteredCallsData.length]);

  // Aplicar filtros automáticamente cuando cambien los criterios
  // Nota: Este efecto ahora solo limpia los datos cuando no hay filtros
  // La carga de datos paginados se maneja en el efecto separado que detecta cambios en currentPage
  React.useEffect(() => {
    // Solo aplicar filtros si hay algún filtro activo (ahora incluyendo disconnection_reason)
    const hasActiveFilters = searchTerm || statusFilter || durationFilter || startDate || endDate || phoneNumberFilter || sortOrderFilter !== 'DESC' || interestFilter || tipoViviendaFilter || agentIdFilter || disconnectionReasonFilter || appliedDatabaseFilter;
    
    if (!hasActiveFilters) {
      // Si no hay filtros, limpiar los datos filtrados
      setFilteredCallsData([]);
      setTotalFilteredCalls(0);
      setTotalFilteredPages(0);
      setCurrentPage(1);
    } else {
      // Si hay filtros, resetear a la primera página y limpiar datos para que el efecto de paginación los recargue
      setCurrentPage(1);
      setFilteredCallsData([]);
      setTotalFilteredCalls(0);
      setTotalFilteredPages(0);
    }
  }, [searchTerm, statusFilter, durationFilter, startDate, endDate, phoneNumberFilter, sortOrderFilter, interestFilter, tipoViviendaFilter, agentIdFilter, disconnectionReasonFilter, appliedDatabaseFilter]);

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
    
    setDatePreset('custom');
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
                className="h-8 px-3 text-xs font-medium bg-blue-600 text-white border-blue-600 hover:bg-blue-700 hover:border-blue-700 transition-colors gap-1.5"
                disabled={loadingAllCalls}
              >
                <Download className="h-3.5 w-3.5" />
                Exportar CSV
              </Button>
              
              {/* Botón para personalizar columnas */}
              <div className="relative">
                <Button 
                  onClick={() => setShowColumnCustomizer(!showColumnCustomizer)} 
                  variant="outline" 
                  size="sm"
                  className="h-8 px-3 text-xs font-medium bg-slate-700 text-white border-slate-700 hover:bg-slate-800 hover:border-slate-800 transition-colors gap-1.5 column-customizer-button"
                >
                  <ListFilter className="h-3.5 w-3.5" />
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
              
              {activeFiltersCount > 0 && (
                <Button 
                  onClick={resetAllFilters} 
                  variant="outline" 
                  size="sm"
                  className="h-8 px-3 text-xs font-medium bg-red-500 text-white border-red-500 hover:bg-red-600 hover:border-red-600 transition-colors gap-1.5"
                >
                  <X className="h-3.5 w-3.5" />
                  Limpiar filtros
                </Button>
              )}
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

            {/* Dropdown de Fechas */}
            <div className="lg:col-span-2 relative date-preset-dropdown">
              <Button
                onClick={() => setShowDatePresetDropdown(!showDatePresetDropdown)}
                variant="outline"
                className="w-full h-10 flex items-center justify-center gap-2 text-xs date-preset-button"
              >
                <CalendarDays className="w-4 h-4" />
                <span className="text-xs">
                  {{ today: 'Hoy', week: 'Última semana', month: 'Último mes', custom: 'Personalizado' }[datePreset]}
                </span>
                {showDatePresetDropdown ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>

              {showDatePresetDropdown && (
                <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl shadow-xl z-50 border border-slate-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Período</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {(['today', 'week', 'month', 'custom'] as const).map((preset) => {
                      const labels = { today: 'Hoy', week: 'Última semana', month: 'Último mes', custom: 'Personalizado…' };
                      const isActive = datePreset === preset;
                      return (
                        <button
                          key={preset}
                          onClick={() => {
                            setShowDatePresetDropdown(false);
                            if (preset === 'custom') {
                              setDatePreset('custom');
                              openFiltersModal();
                            } else {
                              const range = calcPresetDates(preset);
                              setDatePreset(preset);
                              setStartDate(range.start);
                              setEndDate(range.end);
                              setCurrentPage(1);
                            }
                          }}
                          className={`w-full flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-slate-50 ${
                            isActive ? 'text-blue-600 font-semibold' : 'text-slate-700'
                          }`}
                        >
                          <span>{labels[preset]}</span>
                          {isActive && <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />}
                        </button>
                      );
                    })}
                    {datePreset === 'custom' && startDate && endDate && (
                      <div className="px-4 py-2 text-xs text-slate-400">
                        {new Date(startDate).toLocaleDateString('es-ES')} – {new Date(endDate).toLocaleDateString('es-ES')}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Filtros unificados */}
            <div className={`${hasFiltroSolar ? 'lg:col-span-6' : 'lg:col-span-10'} relative unified-filters-dropdown`}>
              <Button
                onClick={() => setShowUnifiedFiltersDropdown(!showUnifiedFiltersDropdown)}
                variant="outline"
                className="w-full h-10 flex items-center justify-center gap-2 text-xs unified-filters-button"
              >
                <ListFilter className="w-4 h-4" />
                <span className="text-xs">Filtros</span>
                {activeUnifiedFiltersCount > 0 && (
                  <Badge variant="default" className="ml-1 px-1.5 py-0.5 text-xs">
                    {activeUnifiedFiltersCount}
                  </Badge>
                )}
                {showUnifiedFiltersDropdown ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>
              
              {showUnifiedFiltersDropdown && (
                <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-xl shadow-xl z-50 border border-slate-200 overflow-hidden">
                  {/* Header del panel */}
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Filtros</span>
                    {activeUnifiedFiltersCount > 0 && (
                      <span className="text-xs text-blue-600 font-medium">{activeUnifiedFiltersCount} activos</span>
                    )}
                  </div>

                  <div className="divide-y divide-slate-100 max-h-[70vh] overflow-y-auto">

                    {/* Estado de la llamada */}
                    {(() => {
                      const key = 'estado';
                      const open = expandedFilterSections.has(key);
                      return (
                        <div>
                          <button
                            onClick={() => toggleFilterSection(key)}
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-700">Estado de la llamada</span>
                              {statusFilter && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />}
                            </div>
                            <span className="text-slate-400 text-base leading-none">{open ? '−' : '+'}</span>
                          </button>
                          {open && (
                            <div className="px-4 pb-3">
                              <Select
                                value={statusFilter || "all"}
                                onValueChange={(value) => { setStatusFilter(value === "all" ? null : value); setCurrentPage(1); }}
                                className="w-full"
                              >
                                <SelectItem value="all">Todos</SelectItem>
                                <SelectItem value="efectiva">Efectiva</SelectItem>
                                <SelectItem value="fallida">Fallida</SelectItem>
                              </Select>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Duración */}
                    {(() => {
                      const key = 'duracion';
                      const open = expandedFilterSections.has(key);
                      return (
                        <div>
                          <button
                            onClick={() => toggleFilterSection(key)}
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-700">Duración</span>
                              {durationFilter && (
                                <span className="text-xs text-blue-600 font-semibold">
                                  {durationOperator === 'gt' ? '>' : durationOperator === 'lt' ? '<' : '='} {durationMinutes} min
                                </span>
                              )}
                            </div>
                            <span className="text-slate-400 text-base leading-none">{open ? '−' : '+'}</span>
                          </button>
                          {open && (
                            <div className="px-4 pb-3 space-y-2">
                              {/* Selector de operador */}
                              <div className="flex gap-1.5">
                                {(['gt', 'lt', 'eq'] as const).map((op) => (
                                  <button
                                    key={op}
                                    onClick={() => { setDurationOperator(op === durationOperator ? null : op); setCurrentPage(1); }}
                                    className={`flex-1 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                                      durationOperator === op
                                        ? 'bg-blue-600 border-blue-600 text-white'
                                        : 'bg-white border-slate-300 text-slate-600 hover:border-blue-400'
                                    }`}
                                  >
                                    {op === 'gt' ? '>' : op === 'lt' ? '<' : '='}
                                  </button>
                                ))}
                              </div>
                              {/* Input de minutos */}
                              <div className="relative">
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  placeholder="Minutos (ej: 1.5)"
                                  value={durationMinutes}
                                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    setDurationMinutes(e.target.value);
                                    setCurrentPage(1);
                                  }}
                                  className="text-sm pr-12"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">min</span>
                              </div>
                              {/* Limpiar filtro */}
                              {durationFilter && (
                                <button
                                  onClick={clearDurationFilter}
                                  className="w-full text-xs text-slate-400 hover:text-red-500 text-center py-1 transition-colors"
                                >
                                  Limpiar filtro de duración
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Ordenar por */}
                    {(() => {
                      const key = 'orden';
                      const open = expandedFilterSections.has(key);
                      return (
                        <div>
                          <button
                            onClick={() => toggleFilterSection(key)}
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-700">Ordenar por</span>
                              {sortOrderFilter !== 'DESC' && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />}
                            </div>
                            <span className="text-slate-400 text-base leading-none">{open ? '−' : '+'}</span>
                          </button>
                          {open && (
                            <div className="px-4 pb-3">
                              <Select
                                value={sortOrderFilter}
                                onValueChange={(value) => { setSortOrderFilter(value as 'ASC' | 'DESC'); setCurrentPage(1); }}
                                className="w-full"
                              >
                                <SelectItem value="DESC">Más recientes</SelectItem>
                                <SelectItem value="ASC">Más antiguos</SelectItem>
                              </Select>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Motivo de desconexión */}
                    {(() => {
                      const key = 'desconexion';
                      const open = expandedFilterSections.has(key);
                      return (
                        <div>
                          <button
                            onClick={() => toggleFilterSection(key)}
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-700">Motivo de desconexión</span>
                              {disconnectionReasonFilter && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />}
                            </div>
                            <span className="text-slate-400 text-base leading-none">{open ? '−' : '+'}</span>
                          </button>
                          {open && (
                            <div className="px-4 pb-3">
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
                          )}
                        </div>
                      );
                    })()}

                    {/* Agente */}
                    {(() => {
                      const key = 'agente';
                      const open = expandedFilterSections.has(key);
                      return (
                        <div>
                          <button
                            onClick={() => toggleFilterSection(key)}
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-700">Agente</span>
                              {agentIdFilter && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />}
                            </div>
                            <span className="text-slate-400 text-base leading-none">{open ? '−' : '+'}</span>
                          </button>
                          {open && (
                            <div className="px-4 pb-3">
                              <Select
                                value={agentIdFilter || "all"}
                                onValueChange={(value) => { setAgentIdFilter(value === "all" ? null : value); setCurrentPage(1); }}
                                className="w-full"
                              >
                                <SelectItem value="all">Todos los agentes</SelectItem>
                                {uniqueAgents.map(agentId => (
                                  <SelectItem key={agentId} value={agentId}>{agentId}</SelectItem>
                                ))}
                              </Select>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Interés — solo filtro_solar */}
                    {hasFiltroSolar && (() => {
                      const key = 'interes';
                      const open = expandedFilterSections.has(key);
                      return (
                        <div>
                          <button
                            onClick={() => toggleFilterSection(key)}
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-700">Interés</span>
                              {interestFilter && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />}
                            </div>
                            <span className="text-slate-400 text-base leading-none">{open ? '−' : '+'}</span>
                          </button>
                          {open && (
                            <div className="px-4 pb-3">
                              <Select
                                value={interestFilter || "all"}
                                onValueChange={(value) => { setInterestFilter(value === "all" ? null : value); setCurrentPage(1); }}
                                className="w-full"
                              >
                                <SelectItem value="all">Todos</SelectItem>
                                <SelectItem value="call_after">Call After</SelectItem>
                                <SelectItem value="not_interested">No Interesado</SelectItem>
                                <SelectItem value="yes_call">Sí Llamar</SelectItem>
                              </Select>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Tipo de Vivienda — solo filtro_solar */}
                    {hasFiltroSolar && (() => {
                      const key = 'vivienda';
                      const open = expandedFilterSections.has(key);
                      return (
                        <div>
                          <button
                            onClick={() => toggleFilterSection(key)}
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-700">Tipo de Vivienda</span>
                              {tipoViviendaFilter && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />}
                            </div>
                            <span className="text-slate-400 text-base leading-none">{open ? '−' : '+'}</span>
                          </button>
                          {open && (
                            <div className="px-4 pb-3">
                              <Select
                                value={tipoViviendaFilter || "all"}
                                onValueChange={(value) => { setTipoViviendaFilter(value === "all" ? null : value); setCurrentPage(1); }}
                                className="w-full"
                              >
                                <SelectItem value="all">Todos</SelectItem>
                                <SelectItem value="piso">Piso</SelectItem>
                                <SelectItem value="no_identificado">No Identificado</SelectItem>
                                <SelectItem value="alquiler">Alquiler</SelectItem>
                                <SelectItem value="casa">Casa</SelectItem>
                              </Select>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Número de teléfono */}
                    {(() => {
                      const key = 'telefono';
                      const open = expandedFilterSections.has(key);
                      return (
                        <div>
                          <button
                            onClick={() => toggleFilterSection(key)}
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-700">Número de teléfono</span>
                              {phoneNumberFilter && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />}
                            </div>
                            <span className="text-slate-400 text-base leading-none">{open ? '−' : '+'}</span>
                          </button>
                          {open && (
                            <div className="px-4 pb-3">
                              <div className="relative">
                                <Phone className="w-4 h-4 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                                <Input
                                  type="text"
                                  placeholder="Ej: +34600123456"
                                  value={phoneNumberFilter}
                                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setPhoneNumberFilter(e.target.value); setCurrentPage(1); }}
                                  className="pl-8 text-sm"
                                />
                                {phoneNumberFilter && (
                                  <button
                                    onClick={() => { setPhoneNumberFilter(''); setCurrentPage(1); }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Buscar grabación (Call ID) */}
                    {(() => {
                      const key = 'callid';
                      const open = expandedFilterSections.has(key);
                      return (
                        <div>
                          <button
                            onClick={() => toggleFilterSection(key)}
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-700">Buscar grabación</span>
                              {searchTerm && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />}
                            </div>
                            <span className="text-slate-400 text-base leading-none">{open ? '−' : '+'}</span>
                          </button>
                          {open && (
                            <div className="px-4 pb-3">
                              <div className="relative">
                                <Search className="w-4 h-4 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                                <Input
                                  type="text"
                                  placeholder="Ej: call_abc123..."
                                  value={searchTerm}
                                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                  className="pl-8 text-sm"
                                />
                                {searchTerm && (
                                  <button
                                    onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                  </div>
                </div>
              )}
            </div>
            
            
            {/* Filtro de base de datos - Solo si tiene permiso */}
            {hasFiltroSolar && (
              <div className="lg:col-span-4">
                <div className="flex items-center gap-1.5">
                  <Input
                    type="text"
                    placeholder="Base de datos..."
                    value={databaseFilter}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      setDatabaseFilter(e.target.value);
                    }}
                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                      if (e.key === 'Enter' && databaseFilter.trim()) {
                        setAppliedDatabaseFilter(databaseFilter.trim());
                        setCurrentPage(1);
                      }
                    }}
                    className="flex-1 text-sm"
                  />
                  <Button
                    onClick={() => {
                      if (databaseFilter.trim()) {
                        setAppliedDatabaseFilter(databaseFilter.trim());
                        setCurrentPage(1);
                      }
                    }}
                    disabled={!databaseFilter.trim()}
                    variant="outline"
                    size="sm"
                    className="text-xs px-2 whitespace-nowrap h-10"
                  >
                    Filtrar
                  </Button>
                  {appliedDatabaseFilter && (
                    <Button
                      onClick={() => {
                        setDatabaseFilter('');
                        setAppliedDatabaseFilter('');
                        setCurrentPage(1);
                      }}
                      variant="outline"
                      size="sm"
                      className="text-xs px-2 whitespace-nowrap h-10"
                    >
                      Limpiar
                    </Button>
                  )}
                </div>
              </div>
            )}
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
                {searchTerm || startDate || endDate || statusFilter || disconnectionReasonFilter || durationFilter || phoneNumberFilter || interestFilter || tipoViviendaFilter || agentIdFilter || appliedDatabaseFilter
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
                              <span className="font-medium">Agente:</span> <span className="text-blue-600">{call.agent_id}</span>
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
                            
                            {visibleColumns.callType && call.tipo_vivienda && (
                              <div className="text-sm text-slate-600">
                                Tipo: {call.tipo_vivienda}
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

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRecallCall(call);
                            }}
                            title="Rellamar"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-200 hover:border-emerald-600 text-xs font-medium transition-all"
                          >
                            <PhoneCall className="w-3.5 h-3.5" />
                            Rellamar
                          </button>
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
                        {Math.min(currentPage * itemsPerPage, filteredCalls.length)} de {formatFilteredTotal(totalFilteredCalls)} grabaciones filtradas
                      </>
                    ) : searchTerm || statusFilter || durationFilter || startDate || endDate || phoneNumberFilter || sortOrderFilter !== 'DESC' || agentIdFilter || appliedDatabaseFilter ? (
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
      {shouldRenderModal && modalCallForTransition && (
        <>
          {/* Overlay con transición de opacidad */}
          <div 
            className={`fixed inset-0 bg-black z-40 transition-opacity duration-300 ease-in-out ${
              isModalVisible ? 'opacity-50' : 'opacity-0 pointer-events-none'
            }`}
            onClick={closeCallModal}
          />
          {/* Modal con transición de deslizamiento de derecha a izquierda */}
          <div 
            className={`fixed top-0 right-0 h-full w-full sm:w-[420px] md:w-[520px] lg:w-[640px] bg-white z-50 shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out ${
              isModalVisible ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            <div className="border-b border-slate-200 flex justify-between items-center sticky top-0 bg-gradient-to-r from-slate-50 to-blue-50 p-4">
              <div className="flex items-center">
                <Phone className="w-5 h-5 text-blue-600 mr-2" />
                <h2 className="text-xl font-bold text-slate-800 break-all">{modalCallForTransition.call_id}</h2>
              </div>
              <button 
                onClick={closeCallModal}
                className="p-1 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-slate-500 hover:text-slate-700" />
              </button>
            </div>
            
            <div className="overflow-y-auto p-6 flex-grow bg-white" onClick={(e) => e.stopPropagation()}>
              {/* Indicador de navegación con teclado */}
              <p className="text-sm text-slate-700 mb-2">
                Usa 
                <kbd className="mx-1 px-1.5 py-0.5 border border-slate-300 rounded bg-white shadow-sm text-xs font-mono">↑</kbd>
                y
                <kbd className="mx-1 px-1.5 py-0.5 border border-slate-300 rounded bg-white shadow-sm text-xs font-mono">↓</kbd>
                para navegar
              </p>
              <div className="border-b border-slate-200 mb-4" />
              
              {/* Información Básica - Horizontal */}
              <Card className="bg-white shadow-sm border-slate-200 mb-6">
                <CardContent className="p-4">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4">Información Básica</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {modalCallForTransition.agent_id && (
                      <div>
                        <p className="text-sm text-slate-600">ID del Agente</p>
                        <p className="text-slate-800 font-medium text-blue-600">{modalCallForTransition.agent_id}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-slate-600">Estado de la Llamada</p>
                      <p className="text-slate-800">{modalCallForTransition.call_status}</p>
                    </div>
                    {(modalCallForTransition.tipo_vivienda || modalCallForTransition.call_type) && (
                      <div>
                        <p className="text-sm text-slate-600">Tipo de Llamada</p>
                        <p className="text-slate-800">{modalCallForTransition.tipo_vivienda || modalCallForTransition.call_type}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-slate-600">Fecha y Hora</p>
                      <p className="text-slate-800 text-xs">{(() => {
                        const raw = (modalCallForTransition as any).start_time || (modalCallForTransition as any).created_at || (modalCallForTransition as any).metadata?.created_at || modalCallForTransition.start_timestamp;
                        const d = new Date(raw);
                        return isNaN(d.getTime()) ? '' : d.toLocaleString('es-ES', { timeZone: 'UTC' });
                      })()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Duración</p>
                      <p className="text-slate-800 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {getDuration(modalCallForTransition)}
                      </p>
                    </div>
                    {/* Metadatos adicionales si están disponibles */}
                    {modalCallForTransition.from_number && (
                      <div>
                        <p className="text-sm text-slate-600">Número de Origen</p>
                        <p className="text-slate-800">{modalCallForTransition.from_number}</p>
                      </div>
                    )}
                    {modalCallForTransition.to_number && (
                      <div>
                        <p className="text-sm text-slate-600">Número de Destino</p>
                        <p className="text-slate-800">{modalCallForTransition.to_number}</p>
                      </div>
                    )}
                    {modalCallForTransition.metadata?.direction && (
                      <div>
                        <p className="text-sm text-slate-600">Dirección</p>
                        <p className="text-slate-800 capitalize">{modalCallForTransition.metadata.direction}</p>
                      </div>
                    )}
                    {modalCallForTransition.call_cost && (
                      <div>
                        <p className="text-sm text-slate-600">Costo Total</p>
                        <p className="text-slate-800">{formatCost(modalCallForTransition.call_cost.total_cost || 0)}</p>
                      </div>
                    )}
                    {modalCallForTransition.disconnection_reason && (
                      <div>
                        <p className="text-sm text-slate-600">Razón de Desconexión</p>
                        <p className="text-slate-800">{modalCallForTransition.disconnection_reason}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Reproductor de audio - Horizontal */}
              {modalCallForTransition.recording_url && (
                <Card className="bg-white shadow-sm border-slate-200 mb-6">
                  <CardContent className="p-4">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4">Reproductor</h3>
                    <div className="flex items-center gap-4 flex-wrap">
                      <button
                        onClick={togglePlayPauseModal}
                        className="p-3 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-full hover:from-blue-700 hover:to-indigo-800 transition-colors"
                      >
                        {playingId === modalCallForTransition.call_id ? (
                          <Pause className="w-6 h-6 text-white" />
                        ) : (
                          <Play className="w-6 h-6 text-white" />
                        )}
                      </button>
                      
                      <a
                        href={modalCallForTransition.recording_url}
                        download
                        className="p-3 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"
                      >
                        <Download className="w-6 h-6 text-slate-700" />
                      </a>
                      
                      {audioError && (
                        <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded px-3 py-2">
                          {audioError}
                        </div>
                      )}
                      
                      <div className="flex-1 min-w-[200px]">
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
                        <div className="flex justify-between text-xs text-slate-600 mt-1">
                          <span>{formatTime(audioCurrentTime)}</span>
                          <span>{formatTime(audioDuration)}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {/* Análisis de la Llamada */}
              {modalCallForTransition.call_analysis && (
                    <Card className="bg-white shadow-sm border-slate-200">
                      <CardContent className="p-4">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4">Análisis de la Llamada</h3>
                        <div className="space-y-3">
                          {modalCallForTransition.call_analysis.sentiment && (
                            <div>
                              <p className="text-sm text-slate-600">Sentimiento</p>
                              <p className="text-slate-800">{modalCallForTransition.call_analysis.sentiment}</p>
                            </div>
                          )}
                          {modalCallForTransition.call_analysis.topics && modalCallForTransition.call_analysis.topics.length > 0 && (
                            <div>
                              <p className="text-sm text-slate-600">Temas</p>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {modalCallForTransition.call_analysis.topics.map((topic, index) => (
                                  <Badge key={index} variant="secondary">{topic}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* Datos de análisis personalizados (si existen) */}
                          {modalCallForTransition.call_analysis?.custom_analysis_data && Object.keys(modalCallForTransition.call_analysis.custom_analysis_data).length > 0 && (
                            <div>
                              <p className="text-sm text-slate-600">Datos de Análisis Personalizados</p>
                              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                {Object.entries(modalCallForTransition.call_analysis.custom_analysis_data).map(([key, value]) => (
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
              
              {/* Sección de la transcripción con formato mejorado */}
              {(loadingModalTranscript || localModalTranscript) && (
                <Card className="mb-6 bg-white shadow-sm border-slate-200">
                  <CardHeader className="pb-2">
                    <h3 className="text-lg font-semibold text-slate-800">Transcripción</h3>
                  </CardHeader>
                  <CardContent className="p-4">
                    {loadingModalTranscript ? (
                      <div className="flex items-center gap-2 py-6 text-slate-500 text-sm">
                        <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
                        Cargando transcripción...
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {localModalTranscript!.split('\n').map((line, index) => {
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
                    )}
                  </CardContent>
                </Card>
              )}
              
              {/* Metadata de la llamada */}
              {modalCallForTransition.metadata && Object.keys(modalCallForTransition.metadata).length > 0 && (
                <Card className="mb-6 bg-white shadow-sm border-slate-200">
                  <CardHeader className="pb-2">
                    <h3 className="text-lg font-semibold text-slate-800">Metadata de la Llamada</h3>
                  </CardHeader>
                  <CardContent className="p-4">
                    <pre className="bg-slate-50 p-4 rounded-lg text-slate-800 text-xs overflow-auto max-h-96">
                      {JSON.stringify(modalCallForTransition.metadata, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}


              {/* Variables dinámicas */}
              {modalCallForTransition.metadata?.retell_llm_dynamic_variables && Object.keys(modalCallForTransition.metadata.retell_llm_dynamic_variables).length > 0 && (
                <Card className="mb-6 bg-white shadow-sm border-slate-200">
                  <CardHeader className="pb-2">
                    <h3 className="text-lg font-semibold text-slate-800">Variables Dinámicas</h3>
                  </CardHeader>
                  <CardContent className="p-4">
                    <pre className="bg-slate-50 p-4 rounded-lg text-slate-800 text-xs overflow-auto max-h-96">
                      {JSON.stringify(modalCallForTransition.metadata.retell_llm_dynamic_variables, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </>
      )}

      {/* Modal de rellamar */}
      {recallCall && (
        <RecallModal
          call={recallCall}
          onClose={() => setRecallCall(null)}
          apiKey={apiKey}
          apiKeyTest={apiKeyTest}
          phoneNumbers={contextPhoneNumbers}
        />
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
                          // console.log('🔍 [Recargar] Metadata del session storage:', storedMetadata);
                          // console.log('🔍 [Recargar] Tipo de datos:', typeof storedMetadata);
                          // console.log('🔍 [Recargar] Longitud:', storedMetadata?.length);
                          
                          if (storedMetadata) {
                            const metadataArray = JSON.parse(storedMetadata);
                            // console.log('🔍 [Recargar] Metadata parseada:', metadataArray);
                            // console.log('🔍 [Recargar] Es array?', Array.isArray(metadataArray));
                            // console.log('🔍 [Recargar] Longitud del array:', metadataArray?.length);
                            
                            if (Array.isArray(metadataArray) && metadataArray.length > 0) {
                              // Si es un array, obtener las claves del primer objeto
                              const fields = Object.keys(metadataArray[0]);
                              // console.log('🔍 [Recargar] Campos de metadata encontrados (array):', fields);
                              // console.log('🔍 [Recargar] Primer objeto:', metadataArray[0]);
                              
                              setAvailableMetadataFields(fields);
                              // console.log('🔍 [Recargar] Estado actualizado - availableMetadataFields:', fields);
                              
                              const initialFields: Record<string, boolean> = {};
                              fields.forEach(field => {
                                initialFields[field] = false;
                              });
                              setMetadataFields(initialFields);
                              // console.log('🔍 [Recargar] Estado actualizado - metadataFields:', initialFields);
                            } else if (typeof metadataArray === 'object' && metadataArray !== null) {
                              // Si es un objeto directo, obtener sus claves
                              const fields = Object.keys(metadataArray);
                              // console.log('🔍 [Recargar] Campos de metadata encontrados (objeto):', fields);
                              // console.log('🔍 [Recargar] Objeto completo:', metadataArray);
                              
                              setAvailableMetadataFields(fields);
                              // console.log('🔍 [Recargar] Estado actualizado - availableMetadataFields:', fields);
                              
                              const initialFields: Record<string, boolean> = {};
                              fields.forEach(field => {
                                initialFields[field] = false;
                              });
                              setMetadataFields(initialFields);
                              // console.log('🔍 [Recargar] Estado actualizado - metadataFields:', initialFields);
                            } else {
                              // console.log('🔍 [Recargar] No es un array válido o está vacío');
                            }
                          } else {
                            // console.log('🔍 [Recargar] No hay metadata en session storage');
                          }
                        } catch (error) {
                          // console.error('Error al recargar metadata:', error);
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