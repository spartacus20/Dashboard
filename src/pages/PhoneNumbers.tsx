import { useState, useEffect, useMemo, useCallback } from 'react';
import { Phone, Copy, RefreshCw, ExternalLink, X, Send, Plus, ChevronDown, User, Trash2, AlertTriangle, Search, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { RetellPhoneNumber, RetellAgent, BlockedNumber } from '../types';
import { fetchAgents, getCallCountForNumber, listBlockedNumbers, createBlockedNumber, updateBlockedNumber, deleteBlockedNumber } from '../api';
import { fetchPhoneNumbers, updatePhoneNumber, createPhoneCall, importPhoneNumber, deletePhoneNumber } from '../services/api/telephony';
import { getClientId, BASE_URL } from '../services/api/config';
import { useCallsContext } from '../context/CallsContext';
import { getUserData } from '../lib/supabase';
import { PHONES_PAGE_SIZE as PHONES_PER_PAGE, DEFAULT_TERMINATION_URIS } from '../lib/constants';
import { toast } from 'sonner';

interface PhoneNumbersProps {
  onNavigate: (page: 'dashboard' | 'recordings' | 'phones') => void;
}

// Definir la interfaz para el modal de llamada
interface CallModalProps {
  phoneNumber: RetellPhoneNumber;
  onClose: () => void;
  workspaceIndex: number;
}

// Componente para el modal de llamada
function CallModal({ phoneNumber, onClose, workspaceIndex }: CallModalProps) {
  const clientId = getClientId() ?? '';
  const [toNumber, setToNumber] = useState('');
  const [overrideAgentId, setOverrideAgentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentsError, setAgentsError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [agents, setAgents] = useState<RetellAgent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<RetellAgent | null>(null);
  const [showAgentsDropdown, setShowAgentsDropdown] = useState(false);
  const [dynamicVariables, setDynamicVariables] = useState<{key: string, value: string}[]>([
    { key: '', value: '' }
  ]);

  // Cargar los agentes al abrir el modal
  useEffect(() => {
    const loadAgents = async () => {
      if (!clientId) {
        setAgentsError('client_id no disponible');
        return;
      }

      setLoadingAgents(true);
      setAgentsError(null);

      try {
        const agentsData = await fetchAgents(clientId, workspaceIndex);
        setAgents(agentsData);
        
        // Si hay un agente asignado al número, seleccionarlo por defecto
        const inboundAgentId = phoneNumber.inbound_agents?.[0]?.agent_id ?? phoneNumber.inbound_agent_id;
        if (inboundAgentId) {
          const defaultAgent = agentsData.find(agent => agent.agent_id === inboundAgentId);
          if (defaultAgent) {
            setSelectedAgent(defaultAgent);
            setOverrideAgentId(defaultAgent.agent_id);
          }
        }
      } catch (err) {
        // console.error('Error cargando agentes:', err);
        setAgentsError(err instanceof Error ? err.message : 'Error al cargar los agentes');
      } finally {
        setLoadingAgents(false);
      }
    };

    loadAgents();
    }, [clientId, workspaceIndex, phoneNumber.inbound_agents, phoneNumber.inbound_agent_id]);

  // Función para añadir un nuevo par de variable dinámica
  const addDynamicVariable = () => {
    setDynamicVariables([...dynamicVariables, { key: '', value: '' }]);
  };

  // Función para actualizar una variable dinámica existente
  const updateDynamicVariable = (index: number, field: 'key' | 'value', value: string) => {
    const updatedVars = [...dynamicVariables];
    updatedVars[index][field] = value;
    setDynamicVariables(updatedVars);
  };

  // Función para eliminar una variable dinámica
  const removeDynamicVariable = (index: number) => {
    setDynamicVariables(dynamicVariables.filter((_, i) => i !== index));
  };

  // Función para seleccionar un agente
  const handleSelectAgent = (agent: RetellAgent) => {
    setSelectedAgent(agent);
    setOverrideAgentId(agent.agent_id);
    setShowAgentsDropdown(false);
  };

  // Función para cerrar el dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.agent-dropdown')) {
        setShowAgentsDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Función para iniciar la llamada
  const handleCreateCall = async () => {
    if (!clientId) {
      setError('client_id no disponible');
      return;
    }

    if (!toNumber) {
      setError('El número de destino es obligatorio');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    // Crear el objeto de variables dinámicas
    const dynamicVars: Record<string, any> = {};
    dynamicVariables.forEach(({key, value}) => {
      if (key.trim()) {
        dynamicVars[key] = value;
      }
    });

    try {
      const params = {
        from_number: phoneNumber.phone_number,
        to_number: toNumber,
        ...(overrideAgentId.trim() && { override_agent_id: overrideAgentId.trim() }),
        ...(Object.keys(dynamicVars).length > 0 && { retell_llm_dynamic_variables: dynamicVars })
      };

      const result = await createPhoneCall(clientId, params, workspaceIndex);
      setSuccess(`Llamada iniciada con éxito. ID: ${result.call_id || 'N/A'}`);
    } catch (err) {
      // console.error('Error al crear la llamada:', err);
      setError(err instanceof Error ? err.message : 'Error al iniciar la llamada');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center border-b border-slate-200 p-4 bg-gradient-to-r from-slate-50 to-blue-50">
          <h3 className="text-lg font-medium text-slate-800">Realizar llamada</h3>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-slate-200 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-slate-500 hover:text-slate-700" />
          </button>
        </div>
        
        <div className="p-5 space-y-5 bg-white">
          <div>
            <p className="text-slate-600 mb-1">Desde el número:</p>
            <div className="flex items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
              <Phone className="w-5 h-5 text-blue-600 mr-2" />
              <span className="text-slate-800">{phoneNumber.phone_number_pretty}</span>
            </div>
          </div>
          
          <div>
            <label className="block text-slate-600 mb-1">Número de destino *</label>
            <input
              type="text"
              value={toNumber}
              onChange={(e) => setToNumber(e.target.value)}
              placeholder="+1 (555) 123-4567"
              className="w-full p-3 rounded-lg bg-white border border-slate-300 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="relative agent-dropdown">
            <label className="block text-slate-600 mb-1">Agente para la llamada *</label>
            {loadingAgents ? (
              <div className="flex items-center bg-slate-50 p-3 rounded-lg border border-slate-200 text-slate-600">
                <svg className="animate-spin mr-2 h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Cargando agentes...
              </div>
            ) : agentsError ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {agentsError}
              </div>
            ) : agents.length === 0 ? (
              <div className="flex items-center bg-slate-50 p-3 rounded-lg border border-slate-200 text-slate-600">
                No se encontraron agentes disponibles
              </div>
            ) : (
              <>
                <button
                  onClick={() => setShowAgentsDropdown(!showAgentsDropdown)}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-white border border-slate-300 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <div className="flex items-center">
                    <User className="w-5 h-5 text-blue-600 mr-2" />
                    <span>
                      {selectedAgent ? selectedAgent.agent_name : 'Seleccionar agente'}
                    </span>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform ${showAgentsDropdown ? 'transform rotate-180' : ''}`} />
                </button>
                
                {showAgentsDropdown && (
                  <div className="absolute mt-1 w-full bg-white rounded-lg shadow-lg z-10 border border-slate-200 max-h-60 overflow-y-auto">
                    <ul className="py-1">
                      {agents.map((agent) => (
                        <li key={agent.agent_id}>
                          <button
                            onClick={() => handleSelectAgent(agent)}
                            className={`w-full text-left px-4 py-2 flex items-center ${
                              selectedAgent?.agent_id === agent.agent_id
                                ? 'bg-blue-600 text-white'
                                : 'text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <User className="w-4 h-4 mr-2" />
                            <div>
                              <p>{agent.agent_name}</p>
                              <p className="text-xs text-slate-500 truncate">{agent.agent_id}</p>
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

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-slate-600">Variables dinámicas (opcional)</label>
              <button 
                onClick={addDynamicVariable}
                className="text-blue-600 hover:text-blue-700 flex items-center text-sm"
              >
                <Plus className="w-4 h-4 mr-1" /> Añadir variable
              </button>
            </div>
            
            {dynamicVariables.map((variable, index) => (
              <div key={index} className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  value={variable.key}
                  onChange={(e) => updateDynamicVariable(index, 'key', e.target.value)}
                  placeholder="Nombre"
                  className="flex-1 p-2 rounded-lg bg-white border border-slate-300 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={variable.value}
                  onChange={(e) => updateDynamicVariable(index, 'value', e.target.value)}
                  placeholder="Valor"
                  className="flex-1 p-2 rounded-lg bg-white border border-slate-300 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {index > 0 && (
                  <button 
                    onClick={() => removeDynamicVariable(index)}
                    className="p-1 hover:bg-slate-200 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-500 hover:text-slate-700" />
                  </button>
                )}
              </div>
            ))}
          </div>
          
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
          
          {success && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              {success}
            </div>
          )}
          
          <div className="flex justify-end pt-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 mr-2 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreateCall}
              disabled={loading || !toNumber || !selectedAgent}
              className={`px-4 py-2 rounded-lg text-white flex items-center ${
                loading || !toNumber || !selectedAgent
                  ? 'bg-blue-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800'
              }`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
    </div>
  );
}

// Definir la interfaz para el modal de añadir número de teléfono
interface AddPhoneModalProps {
  onClose: () => void;
  onSuccess: () => void;
  workspaceOptions: { label: string; index: number }[];
}

// Componente para el modal de añadir número de teléfono
function AddPhoneModal({ onClose, onSuccess, workspaceOptions }: AddPhoneModalProps) {
  const clientId = getClientId() ?? '';
  const [phoneNumber, setPhoneNumber] = useState('');
  const [nickname, setNickname] = useState('');
  const [terminationUri, setTerminationUri] = useState('');
  const [inboundWebhookUrl, setInboundWebhookUrl] = useState('');
  const [sipUsername, setSipUsername] = useState('');
  const [sipPassword, setSipPassword] = useState('');
  const [transport, setTransport] = useState<'TCP' | 'UDP' | 'TLS'>('TCP');
  const [selectedWorkspaceIndex, setSelectedWorkspaceIndex] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [agents, setAgents] = useState<RetellAgent[]>([]);
  const [selectedInboundAgent, setSelectedInboundAgent] = useState<RetellAgent | null>(null);
  const [selectedOutboundAgent, setSelectedOutboundAgent] = useState<RetellAgent | null>(null);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [agentsError, setAgentsError] = useState<string | null>(null);
  const [isManualUri, setIsManualUri] = useState(false);

  // Cargar lista de URIs de terminación desde sessionStorage (uri_retell)
  const [terminationUriOptions, setTerminationUriOptions] = useState<string[]>([]);

  useEffect(() => {
    // 1) Intentar leer de sessionStorage (uri_retell guardado explícitamente)
    const raw = sessionStorage.getItem('uri_retell');
    let options: string[] | null = null;

    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          options = parsed.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
        }
      } catch (e) {
        // console.error('Error parseando uri_retell desde sessionStorage:', e);
      }
    }

    // 2) Si no hay en sessionStorage, intentar desde userData guardado en sesión (login)
    if (!options) {
      const userData = getUserData();
      if (userData && userData.uri_retell) {
        try {
          if (Array.isArray(userData.uri_retell)) {
            options = userData.uri_retell.filter(
              (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
            );
          } else if (typeof userData.uri_retell === 'string') {
            const parsed = JSON.parse(userData.uri_retell);
            if (Array.isArray(parsed)) {
              options = parsed.filter((v: unknown): v is string => typeof v === 'string' && v.trim().length > 0);
            }
          }
        } catch (e) {
          // console.error('Error parseando uri_retell desde userData:', e);
        }
      }
    }

    const merged = [...DEFAULT_TERMINATION_URIS];
    if (options) {
      for (const uri of options) {
        if (!merged.includes(uri)) {
          merged.push(uri);
        }
      }
    }
    setTerminationUriOptions(merged);
  }, []);

  // Cargar agentes cuando se selecciona un workspace
  useEffect(() => {
    const loadAgents = async () => {
      if (!clientId) return;

      setLoadingAgents(true);
      setAgentsError(null);

      try {
        const agentsData = await fetchAgents(clientId, selectedWorkspaceIndex);
        setAgents(agentsData);
        setSelectedInboundAgent(null);
        setSelectedOutboundAgent(null);
      } catch (err) {
        setAgentsError(err instanceof Error ? err.message : 'Error al cargar los agentes');
      } finally {
        setLoadingAgents(false);
      }
    };

    loadAgents();
  }, [clientId, selectedWorkspaceIndex]);

  // Función para añadir el número de teléfono
  const handleAddPhone = async () => {
    if (!clientId) {
      setError('client_id no disponible');
      return;
    }

    if (!phoneNumber.trim()) {
      setError('El número de teléfono es obligatorio');
      return;
    }

    if (!selectedInboundAgent) {
      setError('Debes seleccionar un agente de entrada (inbound)');
      return;
    }

    if (!selectedOutboundAgent) {
      setError('Debes seleccionar un agente de salida (outbound)');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const phoneData: any = {
        phone_number: phoneNumber.trim(),
        inbound_agents: [{ agent_id: selectedInboundAgent.agent_id, weight: 1 }],
        outbound_agents: [{ agent_id: selectedOutboundAgent.agent_id, weight: 1 }],
      };

      // Añadir campos opcionales solo si tienen valor
      if (nickname.trim()) {
        phoneData.nickname = nickname.trim();
      }
      if (terminationUri.trim()) {
        phoneData.termination_uri = terminationUri.trim();
      }
      if (inboundWebhookUrl.trim()) {
        phoneData.inbound_webhook_url = inboundWebhookUrl.trim();
      }
      if (sipUsername.trim()) {
        phoneData.sip_trunk_auth_username = sipUsername.trim();
      }
      if (sipPassword.trim()) {
        phoneData.sip_trunk_auth_password = sipPassword.trim();
      }
      if (transport) {
        phoneData.transport = transport;
      }

      const result = await importPhoneNumber(clientId, phoneData, selectedWorkspaceIndex);
      setSuccess(`Número de teléfono añadido con éxito. ID: ${result.phone_number_id || 'N/A'}`);
      
      // Limpiar el formulario
      setPhoneNumber('');
      setNickname('');
      setTerminationUri('');
      setIsManualUri(false);
      setInboundWebhookUrl('');
      setSipUsername('');
      setSipPassword('');
      
      // Notificar éxito al componente padre después de un breve delay
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    } catch (err) {
      // console.error('Error al añadir número de teléfono:', err);
      setError(err instanceof Error ? err.message : 'Error al añadir el número de teléfono');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center border-b border-slate-200 p-4 bg-gradient-to-r from-slate-50 to-blue-50 flex-shrink-0">
          <h3 className="text-lg font-medium text-slate-800">Añadir Número de Teléfono</h3>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-slate-200 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-slate-500 hover:text-slate-700" />
          </button>
        </div>
        
        <div className="p-5 space-y-5 bg-white flex-1 overflow-y-auto">
          <div>
            <label className="block text-slate-600 mb-1">Workspace *</label>
            <select
              value={selectedWorkspaceIndex}
              onChange={(e) => setSelectedWorkspaceIndex(Number(e.target.value))}
              className="w-full p-3 rounded-lg bg-white border border-slate-300 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {workspaceOptions.map((ws) => (
                <option key={ws.index} value={ws.index}>
                  {ws.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              El workspace determina en qué cuenta de Retell se creará este número.
            </p>
          </div>

          <div>
            <label className="block text-slate-600 mb-1">Número de teléfono *</label>
            <input
              type="text"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+1234567890"
              className="w-full p-3 rounded-lg bg-white border border-slate-300 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <p className="text-xs text-slate-500 mt-1">Formato: +[código de país][número]</p>
          </div>

          <div>
            <label className="block text-slate-600 mb-1">Nombre (opcional)</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Nombre"
              className="w-full p-3 rounded-lg bg-white border border-slate-300 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-slate-600 mb-1">Agente de entrada (Inbound) *</label>
            {loadingAgents ? (
              <div className="flex items-center bg-slate-50 p-3 rounded-lg border border-slate-200 text-slate-600">
                <svg className="animate-spin mr-2 h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Cargando agentes...
              </div>
            ) : agentsError ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {agentsError}
              </div>
            ) : agents.length === 0 ? (
              <div className="flex items-center bg-slate-50 p-3 rounded-lg border border-slate-200 text-slate-600">
                No se encontraron agentes para este workspace
              </div>
            ) : (
              <select
                value={selectedInboundAgent?.agent_id || ''}
                onChange={(e) => {
                  const agent = agents.find(a => a.agent_id === e.target.value) || null;
                  setSelectedInboundAgent(agent);
                }}
                className="w-full p-3 rounded-lg bg-white border border-slate-300 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecciona un agente</option>
                {agents.map((agent) => (
                  <option key={agent.agent_id} value={agent.agent_id}>
                    {agent.agent_name || agent.agent_id}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-slate-600 mb-1">Agente de salida (Outbound) *</label>
            {loadingAgents ? (
              <div className="flex items-center bg-slate-50 p-3 rounded-lg border border-slate-200 text-slate-600">
                <svg className="animate-spin mr-2 h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Cargando agentes...
              </div>
            ) : agentsError ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {agentsError}
              </div>
            ) : agents.length === 0 ? (
              <div className="flex items-center bg-slate-50 p-3 rounded-lg border border-slate-200 text-slate-600">
                No se encontraron agentes para este workspace
              </div>
            ) : (
              <select
                value={selectedOutboundAgent?.agent_id || ''}
                onChange={(e) => {
                  const agent = agents.find(a => a.agent_id === e.target.value) || null;
                  setSelectedOutboundAgent(agent);
                }}
                className="w-full p-3 rounded-lg bg-white border border-slate-300 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecciona un agente</option>
                {agents.map((agent) => (
                  <option key={agent.agent_id} value={agent.agent_id}>
                    {agent.agent_name || agent.agent_id}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-slate-600">Terminación URI</label>
              {terminationUriOptions.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setIsManualUri(!isManualUri);
                    setTerminationUri('');
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                >
                  {isManualUri ? 'Seleccionar de la lista' : 'Ingresar manualmente'}
                </button>
              )}
            </div>
            {terminationUriOptions.length > 0 && !isManualUri ? (
              <select
                value={terminationUri}
                onChange={(e) => setTerminationUri(e.target.value)}
                className="w-full p-3 rounded-lg bg-white border border-slate-300 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecciona una URI de terminación</option>
                {terminationUriOptions.map((uri) => (
                  <option key={uri} value={uri}>
                    {uri}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={terminationUri}
                onChange={(e) => setTerminationUri(e.target.value)}
                placeholder="sip:termination@example.com"
                className="w-full p-3 rounded-lg bg-white border border-slate-300 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>

          <div>
            <label className="block text-slate-600 mb-1">Webhook URL (opcional)</label>
            <input
              type="text"
              value={inboundWebhookUrl}
              onChange={(e) => setInboundWebhookUrl(e.target.value)}
              placeholder="https://example.com/inbound-webhook"
              className="w-full p-3 rounded-lg bg-white border border-slate-300 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-500 mt-1">
              Si se establece, Retell enviará un webhook para cada llamada entrante a este número.
            </p>
          </div>

          <div>
            <label className="block text-slate-600 mb-1">Transporte (opcional)</label>
            <select
              value={transport}
              onChange={(e) => setTransport(e.target.value as 'TCP' | 'UDP' | 'TLS')}
              className="w-full p-3 rounded-lg bg-white border border-slate-300 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="TCP">TCP</option>
              <option value="UDP">UDP</option>
              <option value="TLS">TLS</option>
            </select>
            <p className="text-xs text-slate-500 mt-1">
              Protocolo de transporte para el número (por defecto TCP).
            </p>
          </div>

          <div>
            <label className="block text-slate-600 mb-1">Usuario SIP (opcional)</label>
            <input
              type="text"
              value={sipUsername}
              onChange={(e) => setSipUsername(e.target.value)}
              placeholder="usuario_sip"
              className="w-full p-3 rounded-lg bg-white border border-slate-300 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-slate-600 mb-1">Contraseña SIP (opcional)</label>
            <input
              type="password"
              value={sipPassword}
              onChange={(e) => setSipPassword(e.target.value)}
              placeholder="contraseña_sip"
              className="w-full p-3 rounded-lg bg-white border border-slate-300 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
          
          {success && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              {success}
            </div>
          )}
          
          <div className="flex justify-end pt-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 mr-2 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleAddPhone}
              disabled={loading || !phoneNumber.trim()}
              className={`px-4 py-2 rounded-lg text-white flex items-center ${
                loading || !phoneNumber.trim()
                  ? 'bg-blue-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800'
              }`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Procesando...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-1" />
                  Añadir número
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Definir la interfaz para el modal de eliminar número de teléfono
interface DeletePhoneModalProps {
  phoneNumber: RetellPhoneNumber;
  onClose: () => void;
  onSuccess: () => void;
}

// Componente para el modal de confirmación de eliminación
function DeletePhoneModal({ phoneNumber, onClose, onSuccess }: DeletePhoneModalProps) {
  const clientId = getClientId() ?? '';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Función para eliminar el número de teléfono
  const handleDeletePhone = async () => {
    if (!clientId) {
      setError('client_id no disponible');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await deletePhoneNumber(clientId, phoneNumber.phone_number, phoneNumber.workspace_index ?? 0);
      
      toast.success('Número de teléfono eliminado correctamente');
      
      // Notificar éxito al componente padre
      onSuccess();
      onClose();
    } catch (err) {
      // console.error('Error al eliminar número de teléfono:', err);
      setError(err instanceof Error ? err.message : 'Error al eliminar el número de teléfono');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md">
        <div className="flex justify-between items-center border-b border-slate-200 p-4 bg-gradient-to-r from-red-50 to-orange-50">
          <div className="flex items-center">
            <AlertTriangle className="w-6 h-6 text-red-600 mr-2" />
            <h3 className="text-lg font-medium text-slate-800">Confirmar eliminación</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-slate-200 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-slate-500 hover:text-slate-700" />
          </button>
        </div>
        
        <div className="p-5 space-y-5 bg-white">
          <div>
            <p className="text-slate-700 mb-3">
              ¿Estás seguro de que quieres eliminar el número de teléfono <span className="font-bold text-slate-800">{phoneNumber.phone_number_pretty}</span>?
            </p>
            <p className="text-slate-600 text-sm">
              Esta acción no se puede deshacer y eliminará permanentemente este número de teléfono y todos sus datos asociados.
            </p>
          </div>

          {phoneNumber.nickname && (
            <div className="bg-slate-50 p-3 rounded-lg">
              <p className="text-slate-600 text-sm">Nombre: <span className="font-medium">{phoneNumber.nickname}</span></p>
            </div>
          )}
          
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
          
          <div className="flex justify-end pt-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 mr-2 transition-colors"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              onClick={handleDeletePhone}
              disabled={loading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Eliminar
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Modal para editar un número de teléfono
interface EditPhoneModalProps {
  phoneNumber: RetellPhoneNumber;
  onClose: () => void;
  onSuccess: () => void;
}

function EditPhoneModal({ phoneNumber, onClose, onSuccess }: EditPhoneModalProps) {
  const clientId = getClientId() ?? '';
  const workspaceIndex = phoneNumber.workspace_index ?? 0;

  // General
  const [nickname, setNickname] = useState(phoneNumber.nickname || '');
  const [fallbackNumber, setFallbackNumber] = useState(phoneNumber.fallback_number || '');

  // Webhooks
  const [inboundWebhookUrl, setInboundWebhookUrl] = useState(phoneNumber.inbound_webhook_url || '');
  const [inboundSmsWebhookUrl, setInboundSmsWebhookUrl] = useState(phoneNumber.inbound_sms_webhook_url || '');

  // Agents
  const [agents, setAgents] = useState<RetellAgent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const currentInboundAgentId = phoneNumber.inbound_agents?.[0]?.agent_id ?? phoneNumber.inbound_agent_id ?? '';
  const currentOutboundAgentId = phoneNumber.outbound_agents?.[0]?.agent_id ?? phoneNumber.outbound_agent_id ?? '';
  const [inboundAgentId, setInboundAgentId] = useState(currentInboundAgentId);
  const [outboundAgentId, setOutboundAgentId] = useState(currentOutboundAgentId);

  // SIP / Trunk
  const [terminationUri, setTerminationUri] = useState(phoneNumber.sip_outbound_trunk_config?.termination_uri || '');
  const [authUsername, setAuthUsername] = useState(phoneNumber.sip_outbound_trunk_config?.auth_username || '');
  const [authPassword, setAuthPassword] = useState(phoneNumber.sip_outbound_trunk_config?.auth_password || '');
  const [transport, setTransport] = useState(phoneNumber.sip_outbound_trunk_config?.transport || '');

  // Countries (comma-separated)
  const [allowedInboundCountries, setAllowedInboundCountries] = useState(
    (phoneNumber.allowed_inbound_country_list ?? []).join(', ')
  );
  const [allowedOutboundCountries, setAllowedOutboundCountries] = useState(
    (phoneNumber.allowed_outbound_country_list ?? []).join(', ')
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId) return;
    setLoadingAgents(true);
    fetchAgents(clientId, workspaceIndex)
      .then(setAgents)
      .catch(() => {})
      .finally(() => setLoadingAgents(false));
  }, [clientId, workspaceIndex]);

  const parseCountries = (raw: string): string[] | null => {
    const list = raw.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    return list.length > 0 ? list : null;
  };

  const handleSave = async () => {
    if (!clientId) {
      setError('client_id no disponible');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload: Parameters<typeof updatePhoneNumber>[2] = {};

      payload.nickname = nickname.trim() || null;
      payload.inbound_webhook_url = inboundWebhookUrl.trim() || null;
      if (inboundSmsWebhookUrl.trim()) payload.inbound_sms_webhook_url = inboundSmsWebhookUrl.trim();
      if (fallbackNumber.trim()) payload.fallback_number = fallbackNumber.trim();
      if (terminationUri.trim()) payload.termination_uri = terminationUri.trim();
      if (authUsername.trim()) payload.auth_username = authUsername.trim();
      if (authPassword.trim()) payload.auth_password = authPassword.trim();
      if (transport) payload.transport = transport;

      payload.inbound_agents = inboundAgentId ? [{ agent_id: inboundAgentId, weight: 1 }] : null;
      payload.outbound_agents = outboundAgentId ? [{ agent_id: outboundAgentId, weight: 1 }] : null;

      const inboundCountries = parseCountries(allowedInboundCountries);
      if (inboundCountries !== null) payload.allowed_inbound_country_list = inboundCountries;
      const outboundCountries = parseCountries(allowedOutboundCountries);
      if (outboundCountries !== null) payload.allowed_outbound_country_list = outboundCountries;

      await updatePhoneNumber(clientId, phoneNumber.phone_number, payload, workspaceIndex);
      toast.success('Número actualizado correctamente');
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar el número');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1';
  const sectionClass = 'text-xs font-bold text-slate-400 uppercase tracking-wider mb-3';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-200 p-4 bg-gradient-to-r from-amber-50 to-orange-50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Pencil className="w-5 h-5 text-amber-600" />
            <div>
              <h3 className="text-lg font-medium text-slate-800">Editar número</h3>
              <p className="text-sm text-slate-500">{phoneNumber.phone_number_pretty || phoneNumber.phone_number}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500 hover:text-slate-700" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-6">

          {/* General */}
          <div>
            <p className={sectionClass}>General</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Nickname</label>
                <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Ej: Número principal" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Número de fallback</label>
                <input type="text" value={fallbackNumber} onChange={(e) => setFallbackNumber(e.target.value)} placeholder="+14155551234" className={inputClass} />
              </div>
            </div>
          </div>

          {/* Webhooks */}
          <div>
            <p className={sectionClass}>Webhooks</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Webhook de entrada (voz)</label>
                <input type="text" value={inboundWebhookUrl} onChange={(e) => setInboundWebhookUrl(e.target.value)} placeholder="https://..." className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Webhook de entrada (SMS)</label>
                <input type="text" value={inboundSmsWebhookUrl} onChange={(e) => setInboundSmsWebhookUrl(e.target.value)} placeholder="https://..." className={inputClass} />
              </div>
            </div>
          </div>

          {/* Agentes */}
          <div>
            <p className={sectionClass}>Agentes</p>
            {loadingAgents ? (
              <p className="text-sm text-slate-400">Cargando agentes...</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Agente de entrada</label>
                  <select value={inboundAgentId} onChange={(e) => setInboundAgentId(e.target.value)} className={inputClass}>
                    <option value="">Sin agente</option>
                    {agents.map(a => (
                      <option key={a.agent_id} value={a.agent_id}>{a.agent_name}</option>
                    ))}
                  </select>
                  {(phoneNumber.inbound_agents?.length ?? 0) > 1 && (
                    <p className="text-xs text-amber-600 mt-1">Actualmente tiene {phoneNumber.inbound_agents!.length} agentes con pesos. Al guardar se reemplazarán por el seleccionado.</p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>Agente de salida</label>
                  <select value={outboundAgentId} onChange={(e) => setOutboundAgentId(e.target.value)} className={inputClass}>
                    <option value="">Sin agente</option>
                    {agents.map(a => (
                      <option key={a.agent_id} value={a.agent_id}>{a.agent_name}</option>
                    ))}
                  </select>
                  {(phoneNumber.outbound_agents?.length ?? 0) > 1 && (
                    <p className="text-xs text-amber-600 mt-1">Actualmente tiene {phoneNumber.outbound_agents!.length} agentes con pesos. Al guardar se reemplazarán por el seleccionado.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* SIP / Troncal */}
          <div>
            <p className={sectionClass}>SIP / Troncal</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={labelClass}>Termination URI</label>
                <input type="text" value={terminationUri} onChange={(e) => setTerminationUri(e.target.value)} placeholder="someuri.pstn.twilio.com" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Usuario autenticación</label>
                <input type="text" value={authUsername} onChange={(e) => setAuthUsername(e.target.value)} placeholder="username" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Contraseña autenticación</label>
                <input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="••••••••" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Protocolo de transporte</label>
                <select value={transport} onChange={(e) => setTransport(e.target.value)} className={inputClass}>
                  <option value="">Sin cambio</option>
                  <option value="TCP">TCP</option>
                  <option value="TLS">TLS</option>
                  <option value="UDP">UDP</option>
                </select>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-slate-200 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 flex items-center gap-2 transition-colors disabled:opacity-60"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Guardando...
              </>
            ) : (
              <>
                <Pencil className="h-4 w-4" />
                Guardar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal para eliminar varios números: filtros por workspace y búsqueda, selección con checkboxes, elimina uno a uno
interface DeleteMultiplePhoneModalProps {
  phoneNumbers: RetellPhoneNumber[];
  availableWorkspaces: string[];
  getWorkspaceLabel: (phone: RetellPhoneNumber) => string;
  onClose: () => void;
  onSuccess: () => void;
}

function DeleteMultiplePhoneModal({
  phoneNumbers,
  availableWorkspaces,
  getWorkspaceLabel,
  onClose,
  onSuccess,
}: DeleteMultiplePhoneModalProps) {
  const clientId = getClientId() ?? '';
  const [selectedSet, setSelectedSet] = useState<Set<string>>(new Set());
  const [modalWorkspaceFilter, setModalWorkspaceFilter] = useState<string | null>(null);
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  const normalizePhone = (s: string) => (s || '').replace(/\D/g, '');

  const modalFilteredList = useMemo(() => {
    let list = phoneNumbers;
    if (modalWorkspaceFilter) {
      list = list.filter((p) => getWorkspaceLabel(p) === modalWorkspaceFilter);
    }
    if (modalSearchTerm.trim()) {
      const term = normalizePhone(modalSearchTerm);
      list = list.filter((p) => normalizePhone(p.phone_number || '').includes(term));
    }
    return list;
  }, [phoneNumbers, modalWorkspaceFilter, modalSearchTerm, getWorkspaceLabel]);

  const toggleOne = (phoneNumber: string) => {
    setSelectedSet((prev) => {
      const next = new Set(prev);
      if (next.has(phoneNumber)) next.delete(phoneNumber);
      else next.add(phoneNumber);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedSet.size === modalFilteredList.length) {
      setSelectedSet(new Set());
    } else {
      setSelectedSet(new Set(modalFilteredList.map((p) => p.phone_number)));
    }
  };

  const selectedPhones = useMemo(
    () => phoneNumbers.filter((p) => selectedSet.has(p.phone_number)),
    [phoneNumbers, selectedSet]
  );

  const handleDeleteMultiple = async () => {
    if (selectedPhones.length === 0) return;
    setError(null);
    setDeleting(true);
    setProgress({ current: 0, total: selectedPhones.length });

    try {
      for (let i = 0; i < selectedPhones.length; i++) {
        const phone = selectedPhones[i];
        setProgress({ current: i + 1, total: selectedPhones.length });
        await deletePhoneNumber(clientId, phone.phone_number, phone.workspace_index ?? 0);
      }

      toast.success(`${selectedPhones.length} número(s) eliminado(s) correctamente`);

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar uno o más números');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center border-b border-slate-200 p-4 bg-gradient-to-r from-red-50 to-orange-50">
          <div className="flex items-center">
            <Trash2 className="w-6 h-6 text-red-600 mr-2" />
            <h3 className="text-lg font-medium text-slate-800">Eliminar varios números</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 hover:bg-slate-200 rounded-full transition-colors" disabled={deleting}>
            <X className="w-5 h-5 text-slate-500 hover:text-slate-700" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-200 flex flex-wrap gap-2 items-center">
          <div className="relative flex items-center">
            <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={modalSearchTerm}
              onChange={(e) => setModalSearchTerm(e.target.value)}
              placeholder="Buscar por número..."
              className="pl-9 pr-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
            />
          </div>
          {availableWorkspaces.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Workspace:</span>
              <select
                value={modalWorkspaceFilter || ''}
                onChange={(e) => setModalWorkspaceFilter(e.target.value || null)}
                className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos</option>
                {availableWorkspaces.map((ws) => (
                  <option key={ws} value={ws}>{ws}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="p-4 overflow-y-auto flex-1 min-h-0">
          <div className="flex items-center gap-2 mb-3">
            <input
              type="checkbox"
              id="select-all-multiple"
              checked={modalFilteredList.length > 0 && selectedSet.size === modalFilteredList.length}
              onChange={toggleAll}
              disabled={deleting}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="select-all-multiple" className="text-sm font-medium text-slate-700 cursor-pointer">
              Seleccionar todos ({modalFilteredList.length})
            </label>
          </div>
          <ul className="space-y-2">
            {modalFilteredList.length === 0 ? (
              <li className="text-slate-500 text-sm py-4 text-center">No hay números que coincidan con los filtros.</li>
            ) : (
              modalFilteredList.map((phone) => (
                <li key={phone.phone_number} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-100">
                  <input
                    type="checkbox"
                    checked={selectedSet.has(phone.phone_number)}
                    onChange={() => toggleOne(phone.phone_number)}
                    disabled={deleting}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-mono text-sm text-slate-800">{phone.phone_number_pretty || phone.phone_number}</span>
                  <span className="text-xs text-slate-400">{getWorkspaceLabel(phone)}</span>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
          {error && (
            <div className="flex-1 mr-4 p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
          <div className="flex gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={deleting}
              className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDeleteMultiple}
              disabled={deleting || selectedPhones.length === 0}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Eliminando {progress.current} de {progress.total}...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-1" />
                  Eliminar {selectedPhones.length} seleccionado(s)
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PhoneNumbers({ onNavigate: _onNavigate }: PhoneNumbersProps) {
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);
  const [selectedPhone, setSelectedPhone] = useState<RetellPhoneNumber | null>(null);
  const [showAddPhoneModal, setShowAddPhoneModal] = useState(false);
  const [showDeletePhoneModal, setShowDeletePhoneModal] = useState(false);
  const [showDeleteMultipleModal, setShowDeleteMultipleModal] = useState(false);
  const [phoneToDelete, setPhoneToDelete] = useState<RetellPhoneNumber | null>(null);
  const [showEditPhoneModal, setShowEditPhoneModal] = useState(false);
  const [phoneToEdit, setPhoneToEdit] = useState<RetellPhoneNumber | null>(null);
  const [phoneSearchTerm, setPhoneSearchTerm] = useState('');
  const [callCountsByPhone, setCallCountsByPhone] = useState<Record<string, { total: number; efectivas: number; fallidas: number } | 'loading' | 'error'>>({});
  const [selectedPhoneDetail, setSelectedPhoneDetail] = useState<RetellPhoneNumber | null>(null);
  const [phoneNumbersTab, setPhoneNumbersTab] = useState<'phones' | 'blocked'>('phones');
  const [blockedNumbers, setBlockedNumbers] = useState<BlockedNumber[]>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);
  const [errorBlocked, setErrorBlocked] = useState<string | null>(null);
  const [blockedForm, setBlockedForm] = useState<{ number: string; name: string }>({ number: '', name: '' });
  const [blockedToEdit, setBlockedToEdit] = useState<BlockedNumber | null>(null);
  const [blockedToDelete, setBlockedToDelete] = useState<BlockedNumber | null>(null);
  const [deletingBlocked, setDeletingBlocked] = useState(false);
  const [editBlockedForm, setEditBlockedForm] = useState<{ number: string; name: string }>({ number: '', name: '' });
  const [editBlockedSaving, setEditBlockedSaving] = useState(false);
  const [editBlockedError, setEditBlockedError] = useState<string | null>(null);

  // Configuración del cliente desde el contexto
  const { 
    clientId,
    callsEnabled, 
    phoneFilter 
  } = useCallsContext();

  // workspace seleccionado por índice (0 = principal, 1+ = adicionales)
  const [selectedWorkspaceIndex, setSelectedWorkspaceIndex] = useState<number>(0);
  const [localPhoneNumbers, setLocalPhoneNumbers] = useState<RetellPhoneNumber[]>([]);
  const [localLoading, setLocalLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Nombres de workspaces indexados por workspace_index
  const [workspaceNameByIndex, setWorkspaceNameByIndex] = useState<Record<number, string>>({});

  const phoneNumbers = localPhoneNumbers;
  const loading = localLoading;

  // Carga todos los números del cliente (todos los workspaces de una vez via backend)
  const loadLocalPhoneNumbers = useCallback(async () => {
    if (!clientId) return;
    setLocalLoading(true);
    try {
      const numbers = await fetchPhoneNumbers(clientId);
      setLocalPhoneNumbers(numbers);
      setCurrentPage(1);
    } catch {
      // silencioso
    } finally {
      setLocalLoading(false);
    }
  }, [clientId]);

  // Cargar números al montar o cuando cambie el clientId
  useEffect(() => {
    loadLocalPhoneNumbers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  // Cargar nombres de workspaces desde el backend una vez que los teléfonos terminaron de cargar
  useEffect(() => {
    if (localLoading || !clientId) return;

    fetch(`${BASE_URL}/api/telephony/${encodeURIComponent(clientId)}/workspaces`)
      .then((r) => r.json())
      .then((result) => {
        const map: Record<number, string> = {};
        (result.data || []).forEach((ws: { index: number; name: string }) => {
          map[ws.index] = ws.name;
        });
        setWorkspaceNameByIndex(map);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localLoading, clientId]);

  // Cargar números bloqueados
  useEffect(() => {
    const loadBlocked = async () => {
      setLoadingBlocked(true);
      setErrorBlocked(null);
      try {
        const rows = await listBlockedNumbers();
        setBlockedNumbers(rows);
      } catch (e: any) {
        // console.error('Error al cargar números bloqueados:', e);
        setErrorBlocked(e?.message || 'Error al cargar números bloqueados');
      } finally {
        setLoadingBlocked(false);
      }
    };
    loadBlocked();
  }, []);

  useEffect(() => {
    if (blockedToEdit) {
      setEditBlockedForm({ number: blockedToEdit.number, name: blockedToEdit.name || '' });
      setEditBlockedError(null);
    }
  }, [blockedToEdit]);

  const loadCallCountForPhone = useCallback(async (phoneNumber: string) => {
    if (!clientId) return;
    setCallCountsByPhone((prev) => {
      if (prev[phoneNumber] !== undefined) return prev;
      return { ...prev, [phoneNumber]: 'loading' };
    });
    try {
      const counts = await getCallCountForNumber(clientId, phoneNumber);
      setCallCountsByPhone((prev) => ({ ...prev, [phoneNumber]: counts }));
    } catch {
      setCallCountsByPhone((prev) => ({ ...prev, [phoneNumber]: 'error' }));
    }
  }, [clientId]);

  const openPhoneDetail = useCallback((phone: RetellPhoneNumber) => {
    setSelectedPhoneDetail(phone);
    loadCallCountForPhone(phone.phone_number);
  }, [loadCallCountForPhone]);

  const loadingAll = loading;

  // Obtener nombre de workspace a partir de la URL del webhook
  const getWorkspaceFromWebhook = (webhookUrl?: string): string | null => {
    if (!webhookUrl) return null;

    try {
      const url = new URL(webhookUrl);
      const segments = url.pathname.split('/').filter(Boolean);
      const lastSegment = segments[segments.length - 1] || '';

      // Intentar cortar por "-workspace" o el typo "-worspace" si existe
      const workspaceSlug = lastSegment
        .split(/-workspace|-worspace/i)[0]
        .trim() || lastSegment.trim();

      if (!workspaceSlug) return null;

      const prettyName = workspaceSlug
        .replace(/[-_]+/g, ' ')
        .trim()
        .split(' ')
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      return prettyName || null;
    } catch {
      return null;
    }
  };

  // Nombre de workspace por índice (viene del backend)
  const getWorkspaceName = (index: number) =>
    workspaceNameByIndex[index] || `Workspace ${index + 1}`;

  // Opciones de workspace para los selectores
  const workspaceOptions = useMemo(() => {
    const indices = Object.keys(workspaceNameByIndex).map(Number);
    if (indices.length === 0) return [{ index: 0, label: 'Workspace 1' }];
    return indices.map((i) => ({ index: i, label: workspaceNameByIndex[i] || `Workspace ${i + 1}` }));
  }, [workspaceNameByIndex]);

  // Para el modal de eliminar múltiples
  const availableWorkspaces = useMemo(
    () => Object.values(workspaceNameByIndex).filter(Boolean),
    [workspaceNameByIndex]
  );

  // Filtrar por workspace seleccionado y por número específico de URL
  const filteredPhoneNumbers = phoneNumbers.filter((phone) => {
    if (workspaceOptions.length > 1 && (phone.workspace_index ?? 0) !== selectedWorkspaceIndex) return false;
    if (phoneFilter && phone.phone_number !== phoneFilter) return false;
    return true;
  });

  // Filtrar por búsqueda de número (incluye dígitos y espacios/guiones)
  const normalizePhone = (s: string) => (s || '').replace(/\D/g, '');
  const filteredBySearch = !phoneSearchTerm.trim()
    ? filteredPhoneNumbers
    : filteredPhoneNumbers.filter(phone => {
        const normalized = normalizePhone(phone.phone_number || '');
        const term = normalizePhone(phoneSearchTerm);
        return normalized.includes(term);
      });

  // Paginación de 25 items
  const totalPages = Math.max(1, Math.ceil(filteredBySearch.length / PHONES_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const displayPhoneNumbers = filteredBySearch.slice(
    (safePage - 1) * PHONES_PER_PAGE,
    safePage * PHONES_PER_PAGE
  );
  
  // Función para copiar un número al portapapeles
  const copyToClipboard = (number: string) => {
    navigator.clipboard.writeText(number)
      .then(() => {
        setCopiedNumber(number);
        setTimeout(() => setCopiedNumber(null), 2000);
      })
      .catch(() => {});
  };
  
  // Formatear la fecha de última modificación
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };
  
  const getAgentUrl = (agentId: string) => {
    return `https://retellai.com/dashboard/agents/${agentId}`;
  };

  const handleBlockedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockedForm.number.trim()) {
      setErrorBlocked('El número es obligatorio');
      return;
    }
    setLoadingBlocked(true);
    setErrorBlocked(null);
    try {
      await createBlockedNumber({
        number: blockedForm.number.trim(),
        name: blockedForm.name.trim() || undefined,
      });
      const rows = await listBlockedNumbers();
      setBlockedNumbers(rows);
      setBlockedForm({ number: '', name: '' });
    } catch (e: any) {
      // console.error('Error al guardar número bloqueado:', e);
      setErrorBlocked(e?.message || 'Error al guardar número bloqueado');
    } finally {
      setLoadingBlocked(false);
    }
  };

  const handleEditBlocked = (item: BlockedNumber) => {
    setBlockedToEdit(item);
  };

  const handleDeleteBlocked = (item: BlockedNumber) => {
    setBlockedToDelete(item);
  };

  const confirmDeleteBlocked = async () => {
    if (!blockedToDelete) return;
    setDeletingBlocked(true);
    setErrorBlocked(null);
    try {
      await deleteBlockedNumber(blockedToDelete.number);
      const rows = await listBlockedNumbers();
      setBlockedNumbers(rows);
      setBlockedToDelete(null);
      if (blockedToEdit?.number === blockedToDelete.number) {
        setBlockedToEdit(null);
      }
    } catch (e: any) {
      // console.error('Error al eliminar número bloqueado:', e);
      setErrorBlocked(e?.message || 'Error al eliminar número bloqueado');
    } finally {
      setDeletingBlocked(false);
    }
  };

  const handleEditBlockedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockedToEdit || !editBlockedForm.number.trim()) return;
    setEditBlockedSaving(true);
    setEditBlockedError(null);
    try {
      await updateBlockedNumber(blockedToEdit.number, {
        number: editBlockedForm.number.trim(),
        name: editBlockedForm.name.trim() || undefined,
      });
      const rows = await listBlockedNumbers();
      setBlockedNumbers(rows);
      setBlockedToEdit(null);
    } catch (e: any) {
      // console.error('Error al actualizar número bloqueado:', e);
      setEditBlockedError(e?.message || 'Error al actualizar número bloqueado');
    } finally {
      setEditBlockedSaving(false);
    }
  };
  
  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-indigo-800 mb-2">Números de Teléfono</h2>
        <p className="text-slate-600">Gestiona los números de teléfono asociados a tus agentes de IA</p>
      </div>

      {/* Pestañas */}
      <div className="flex border-b border-slate-200 mb-6">
        <button
          onClick={() => setPhoneNumbersTab('phones')}
          className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
            phoneNumbersTab === 'phones'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          <Phone className="w-5 h-5" />
          Números de Teléfono
        </button>
        <button
          onClick={() => setPhoneNumbersTab('blocked')}
          className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
            phoneNumbersTab === 'blocked'
              ? 'text-rose-600 border-b-2 border-rose-600'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          <AlertTriangle className="w-5 h-5" />
          Números Bloqueados
        </button>
      </div>

      {phoneNumbersTab === 'phones' && (
      <div className="bg-white rounded-xl shadow-lg border border-slate-200">
        <div className="p-6 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-slate-50 to-blue-50">
          <h3 className="text-lg font-semibold text-slate-800">Números de Teléfono</h3>
          
          <div className="flex flex-wrap gap-2 items-center justify-end">
            {/* Selector de workspace (filtra localmente los números ya cargados) */}
            {workspaceOptions.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Workspace:</span>
                <select
                  value={selectedWorkspaceIndex}
                  onChange={(e) => {
                    setSelectedWorkspaceIndex(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  disabled={localLoading}
                  className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                >
                  {workspaceOptions.map((ws) => (
                    <option key={ws.index} value={ws.index}>
                      {ws.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Buscador por número de teléfono */}
            <div className="relative flex items-center">
              <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={phoneSearchTerm}
                onChange={(e) => { setPhoneSearchTerm(e.target.value); setCurrentPage(1); }}
                placeholder="Buscar por número..."
                className="pl-9 pr-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48 min-w-0"
              />
            </div>

            <button
              onClick={() => setShowAddPhoneModal(true)}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors text-white text-sm font-medium"
            >
              <Plus className="h-4 w-4" />
              Añadir Número
            </button>
            
            <button
              onClick={() => loadLocalPhoneNumbers()}
              disabled={loadingAll}
              className="flex items-center gap-1.5 bg-[#0a2a5a] border border-[#1e4a8a] hover:bg-[#1e4a8a] disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition-colors text-white text-sm font-medium"
            >
              <RefreshCw className={`h-4 w-4 ${loadingAll ? 'animate-spin' : ''}`} />
              {loadingAll ? 'Cargando...' : 'Actualizar'}
            </button>

            <button
              type="button"
              onClick={() => setShowDeleteMultipleModal(true)}
              disabled={loadingAll}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="h-5 w-5 mr-1" />
              Eliminar
            </button>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Estado de carga: no mostrar nada hasta que carguen números y conteos */}
          {loadingAll && (
            <div className="p-6 text-center text-slate-600">
              Cargando datos...
            </div>
          )}
          
          {/* No se encontraron resultados */}
          {!loadingAll && displayPhoneNumbers.length === 0 && (
            <div className="p-6 text-center text-slate-600">
              {phoneFilter ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-center">
                    <Phone className="w-12 h-12 text-red-400 mr-3" />
                    <div>
                      <h3 className="text-lg font-medium text-slate-800">Número no conectado</h3>
                      <p className="text-slate-600">El número {phoneFilter} aún no está conectado a tu cuenta</p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-500">
                    Por favor, añade el número de teléfono a tu cuenta 
                  </p>
                </div>
              ) : (
                "No se encontraron números de teléfono"
              )}
            </div>
          )}
          
          {/* Info de paginación */}
          {!loadingAll && filteredBySearch.length > 0 && (
            <div className="flex items-center justify-between text-sm text-slate-500 pb-1">
              <span>
                {filteredBySearch.length} número{filteredBySearch.length !== 1 ? 's' : ''} en total
              </span>
              <span>
                Página {safePage} de {totalPages}
              </span>
            </div>
          )}

          {/* Lista de números de teléfono — filas compactas */}
          {!loadingAll && displayPhoneNumbers.map((phone) => {
            const workspaceLabel = getWorkspaceName(phone.workspace_index ?? 0) ||
              (phone.inbound_webhook_url ? getWorkspaceFromWebhook(phone.inbound_webhook_url) : null);
            const inboundAgentId = phone.inbound_agents?.[0]?.agent_id ?? phone.inbound_agent_id;

            return (
              <div
                key={phone.phone_number}
                className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer"
                onClick={() => openPhoneDetail(phone)}
              >
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="bg-blue-100 p-2.5 rounded-full shrink-0">
                      <Phone className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold tracking-tight text-slate-800">
                          {phone.phone_number_pretty || phone.phone_number}
                        </h3>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); copyToClipboard(phone.phone_number); }}
                          className="text-slate-400 hover:text-blue-600 transition-colors"
                          title="Copiar número"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        {copiedNumber === phone.phone_number && (
                          <span className="text-green-600 text-xs font-medium">¡Copiado!</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {workspaceLabel && (
                          <span className="text-xs text-slate-400">{workspaceLabel}</span>
                        )}
                        {phone.phone_number_type && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            {phone.phone_number_type}
                          </span>
                        )}
                        {inboundAgentId && (
                          <span className="text-xs text-slate-400 truncate">· {inboundAgentId.substring(0, 14)}...</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {callsEnabled && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setSelectedPhone(phone); }}
                        className="flex items-center gap-1.5 bg-blue-600/10 text-blue-600 hover:bg-blue-600 hover:text-white px-3 py-1.5 rounded-lg font-semibold text-xs transition-all"
                      >
                        <Phone className="w-4 h-4" />
                        Llamar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setPhoneToEdit(phone); setShowEditPhoneModal(true); }}
                      className="flex items-center gap-1.5 bg-amber-100 text-amber-600 hover:bg-amber-600 hover:text-white px-3 py-1.5 rounded-lg font-semibold text-xs transition-all"
                    >
                      <Pencil className="w-4 h-4" />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setPhoneToDelete(phone); setShowDeletePhoneModal(true); }}
                      className="flex items-center gap-1.5 bg-rose-100 text-rose-600 hover:bg-rose-600 hover:text-white px-3 py-1.5 rounded-lg font-semibold text-xs transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                      Eliminar
                    </button>
                    <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                  </div>
                </div>
              </div>
            );
          })}

          {/* Controles de paginación */}
          {!loadingAll && totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
                .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('...');
                  acc.push(p);
                  return acc;
                }, [])
                .map((item, idx) =>
                  item === '...' ? (
                    <span key={`dots-${idx}`} className="px-1 text-slate-400 text-sm">…</span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setCurrentPage(item as number)}
                      className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                        safePage === item
                          ? 'bg-blue-600 text-white'
                          : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {item}
                    </button>
                  )
                )}
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
      )}

      {phoneNumbersTab === 'blocked' && (
      <div className="bg-white rounded-xl shadow-lg border border-slate-200">
        <div className="p-6 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-rose-50 to-orange-50">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            Números Bloqueados
          </h3>
        </div>
        <div className="p-6 space-y-6">
          <form onSubmit={handleBlockedSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                Número (incluye prefijo país)
              </label>
              <input
                type="text"
                value={blockedForm.number}
                onChange={(e) => setBlockedForm((prev) => ({ ...prev, number: e.target.value }))}
                placeholder="+34123456789"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                Nombre (opcional)
              </label>
              <input
                type="text"
                value={blockedForm.name}
                onChange={(e) => setBlockedForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Cliente conflictivo"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <div className="flex gap-2 md:justify-end">
              <button
                type="submit"
                disabled={loadingBlocked || !blockedForm.number.trim()}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-700 hover:to-orange-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loadingBlocked ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Añadir bloqueado
                  </>
                )}
              </button>
            </div>
          </form>

          {errorBlocked && (
            <div className="p-3 rounded-lg border border-rose-200 bg-rose-50 text-sm text-rose-700">
              {errorBlocked}
            </div>
          )}

          <div className="border-t border-slate-100 pt-4">
            {loadingBlocked && blockedNumbers.length === 0 ? (
              <p className="text-slate-600 text-sm">Cargando números bloqueados...</p>
            ) : blockedNumbers.length === 0 ? (
              <p className="text-slate-500 text-sm">
                No hay números bloqueados todavía. Añade un número para bloquearlo.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-100">
                      <th className="py-2 pr-4">Número</th>
                      <th className="py-2 pr-4">Nombre</th>
                      <th className="py-2 pr-4">País</th>
                      <th className="py-2 pr-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blockedNumbers.map((item) => (
                      <tr key={item.number} className="border-b border-slate-50 hover:bg-slate-50/80">
                        <td className="py-2 pr-4 font-mono text-slate-800">{item.number}</td>
                        <td className="py-2 pr-4 text-slate-700">{item.name || '—'}</td>
                        <td className="py-2 pr-4 text-slate-700">{item.pais || 'no_detectado'}</td>
                        <td className="py-2 pr-0 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleEditBlocked(item)}
                              className="px-3 py-1 rounded-lg border border-slate-300 text-xs text-slate-700 hover:bg-slate-100"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteBlocked(item)}
                              className="px-3 py-1 rounded-lg border border-rose-300 text-xs text-rose-700 hover:bg-rose-50"
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Modal Editar número bloqueado */}
      {blockedToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setBlockedToEdit(null)}>
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800">Editar número bloqueado</h3>
              <button type="button" onClick={() => setBlockedToEdit(null)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleEditBlockedSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Número (incluye prefijo país)</label>
                <input
                  type="text"
                  value={editBlockedForm.number}
                  onChange={(e) => setEditBlockedForm(prev => ({ ...prev, number: e.target.value }))}
                  placeholder="+34123456789"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Nombre (opcional)</label>
                <input
                  type="text"
                  value={editBlockedForm.name}
                  onChange={(e) => setEditBlockedForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Cliente conflictivo"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
              {editBlockedError && (
                <div className="p-3 rounded-lg border border-rose-200 bg-rose-50 text-sm text-rose-700">{editBlockedError}</div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBlockedToEdit(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editBlockedSaving || !editBlockedForm.number.trim()}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-700 hover:to-orange-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {editBlockedSaving ? <><RefreshCw className="w-4 h-4 animate-spin" /> Guardando...</> : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Eliminar número bloqueado */}
      {blockedToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => !deletingBlocked && setBlockedToDelete(null)}>
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-full bg-rose-100">
                <AlertTriangle className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Eliminar número bloqueado</h3>
                <p className="text-sm text-slate-600 mt-0.5">
                  ¿Eliminar <span className="font-mono font-medium text-slate-800">{blockedToDelete.number}</span>?
                </p>
              </div>
            </div>
            {errorBlocked && (
              <div className="mb-4 p-3 rounded-lg border border-rose-200 bg-rose-50 text-sm text-rose-700">{errorBlocked}</div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setBlockedToDelete(null)}
                disabled={deletingBlocked}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm hover:bg-slate-50 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteBlocked}
                disabled={deletingBlocked}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {deletingBlocked ? <><RefreshCw className="w-4 h-4 animate-spin" /> Eliminando...</> : <><Trash2 className="w-4 h-4" /> Eliminar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para iniciar llamada */}
      {selectedPhone && (
        <CallModal 
          phoneNumber={selectedPhone}
          onClose={() => setSelectedPhone(null)}
          workspaceIndex={selectedPhone.workspace_index ?? 0}
        />
      )}

      {/* Modal para añadir número de teléfono */}
      {showAddPhoneModal && (
        <AddPhoneModal
          onClose={() => setShowAddPhoneModal(false)}
          onSuccess={() => loadLocalPhoneNumbers()}
          workspaceOptions={workspaceOptions}
        />
      )}

      {/* Modal para editar número de teléfono */}
      {showEditPhoneModal && phoneToEdit && (
        <EditPhoneModal
          phoneNumber={phoneToEdit}
          onClose={() => {
            setPhoneToEdit(null);
            setShowEditPhoneModal(false);
          }}
          onSuccess={() => loadLocalPhoneNumbers()}
        />
      )}

      {/* Modal para eliminar número de teléfono */}
      {showDeletePhoneModal && phoneToDelete && (
        <DeletePhoneModal
          phoneNumber={phoneToDelete}
          onClose={() => {
            setPhoneToDelete(null);
            setShowDeletePhoneModal(false);
          }}
          onSuccess={() => loadLocalPhoneNumbers()}
        />
      )}

      {/* Modal para eliminar varios números */}
      {showDeleteMultipleModal && (
        <DeleteMultiplePhoneModal
          phoneNumbers={phoneNumbers}
          availableWorkspaces={availableWorkspaces}
          getWorkspaceLabel={(phone) => getWorkspaceName(phone.workspace_index ?? 0)}
          onClose={() => setShowDeleteMultipleModal(false)}
          onSuccess={() => loadLocalPhoneNumbers()}
        />
      )}

      {/* Modal de detalle de número de teléfono */}
      {selectedPhoneDetail && (() => {
        const phone = selectedPhoneDetail;
        const phoneEntry = callCountsByPhone[phone.phone_number];
        const countsLoading = phoneEntry === 'loading';
        const countsError = phoneEntry === 'error';
        const counts = (phoneEntry && phoneEntry !== 'loading' && phoneEntry !== 'error') ? phoneEntry : null;
        const workspaceLabel = getWorkspaceName(phone.workspace_index ?? 0) ||
          (phone.inbound_webhook_url ? getWorkspaceFromWebhook(phone.inbound_webhook_url) : null);
        const inboundAgentId = phone.inbound_agents?.[0]?.agent_id ?? phone.inbound_agent_id;
        const outboundAgentId = phone.outbound_agents?.[0]?.agent_id ?? phone.outbound_agent_id;

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={() => setSelectedPhoneDetail(null)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between px-6 pt-6 pb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="bg-blue-100 p-2.5 rounded-xl shrink-0">
                    <Phone className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-slate-800 leading-tight">
                        {phone.phone_number_pretty || phone.phone_number}
                      </h3>
                      {phone.phone_number_type && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {phone.phone_number_type}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-slate-400 font-mono truncate">{phone.phone_number}</p>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(phone.phone_number)}
                        className="text-slate-400 hover:text-blue-600 transition-colors shrink-0"
                        title="Copiar número"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      {copiedNumber === phone.phone_number && (
                        <span className="text-green-600 text-xs">¡Copiado!</span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPhoneDetail(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Estadísticas */}
              <div className="grid grid-cols-3 gap-3 px-6 pb-5">
                {counts ? (
                  <>
                    <div className={`rounded-xl p-3 text-center border ${counts.total >= 35000 ? 'bg-rose-50 border-rose-100' : counts.total >= 15000 ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
                      <p className={`text-xl font-bold ${counts.total >= 35000 ? 'text-rose-700' : counts.total >= 15000 ? 'text-amber-700' : 'text-slate-800'}`}>
                        {counts.total.toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">Total</p>
                    </div>
                    <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
                      <p className="text-xl font-bold text-emerald-700">{counts.efectivas.toLocaleString()}</p>
                      <p className="text-xs text-emerald-500 mt-0.5">Efectivas</p>
                    </div>
                    <div className="bg-rose-50 rounded-xl p-3 text-center border border-rose-100">
                      <p className="text-xl font-bold text-rose-700">{counts.fallidas.toLocaleString()}</p>
                      <p className="text-xs text-rose-500 mt-0.5">Fallidas</p>
                    </div>
                  </>
                ) : countsLoading ? (
                  <div className="col-span-3 text-center py-3 text-sm text-slate-400 animate-pulse">Cargando estadísticas...</div>
                ) : countsError ? (
                  <div className="col-span-3 text-center py-3">
                    <button
                      type="button"
                      onClick={() => loadCallCountForPhone(phone.phone_number)}
                      className="text-xs text-rose-500 hover:underline"
                    >
                      Error al cargar — reintentar
                    </button>
                  </div>
                ) : (
                  <div className="col-span-3 text-center py-3 text-sm text-slate-400 animate-pulse">Cargando estadísticas...</div>
                )}
              </div>

              {/* Detalles */}
              <div className="border-t border-slate-100 px-6 py-5 grid grid-cols-2 gap-x-8 gap-y-4">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Nombre</p>
                  <p className="text-sm font-medium text-slate-700">{phone.nickname || phone.phone_number_pretty || phone.phone_number}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Tipo</p>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {phone.phone_number_type || '—'}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Última modificación</p>
                  <p className="text-sm font-medium text-slate-700">{formatDate(phone.last_modification_timestamp)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Workspace</p>
                  <p className="text-sm font-medium text-slate-700">{workspaceLabel || 'No especificado'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Agente de entrada</p>
                  {inboundAgentId ? (
                    <a
                      href={getAgentUrl(inboundAgentId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1"
                    >
                      {inboundAgentId.substring(0, 12)}...
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  ) : (
                    <p className="text-sm font-medium text-slate-700">No asignado</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Agente de salida</p>
                  {outboundAgentId ? (
                    <a
                      href={getAgentUrl(outboundAgentId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1"
                    >
                      {outboundAgentId.substring(0, 12)}...
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  ) : (
                    <p className="text-sm font-medium text-slate-700">No asignado</p>
                  )}
                </div>
                {phone.inbound_webhook_url && (
                  <div className="col-span-2">
                    <p className="text-xs font-semibold text-slate-400 uppercase mb-1">URL de webhook</p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono bg-slate-100 p-2 rounded block truncate flex-1 text-slate-600">
                        {phone.inbound_webhook_url}
                      </code>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(phone.inbound_webhook_url!)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors shrink-0"
                        title="Copiar URL"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Acciones */}
              <div className="border-t border-slate-100 px-6 py-4 bg-slate-50/60 flex items-center justify-end gap-2">
                {callsEnabled && (
                  <button
                    type="button"
                    onClick={() => { setSelectedPhoneDetail(null); setSelectedPhone(phone); }}
                    className="flex items-center gap-1.5 bg-blue-600/10 text-blue-600 hover:bg-blue-600 hover:text-white px-4 py-2 rounded-lg font-semibold text-sm transition-all"
                  >
                    <Phone className="w-4 h-4" />
                    Llamar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setSelectedPhoneDetail(null); setPhoneToEdit(phone); setShowEditPhoneModal(true); }}
                  className="flex items-center gap-1.5 bg-amber-100 text-amber-600 hover:bg-amber-600 hover:text-white px-4 py-2 rounded-lg font-semibold text-sm transition-all"
                >
                  <Pencil className="w-4 h-4" />
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => { setSelectedPhoneDetail(null); setPhoneToDelete(phone); setShowDeletePhoneModal(true); }}
                  className="flex items-center gap-1.5 bg-rose-100 text-rose-600 hover:bg-rose-600 hover:text-white px-4 py-2 rounded-lg font-semibold text-sm transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default PhoneNumbers; 