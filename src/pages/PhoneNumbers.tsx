import { useState, useEffect, useMemo } from 'react';
import { Phone, Copy, RefreshCw, ExternalLink, X, Send, Plus, ChevronDown, User, Trash2, AlertTriangle, Search, BarChart3 } from 'lucide-react';
import { RetellPhoneNumber, RetellAgent, BlockedNumber } from '../types';
import { createPhoneCall, fetchAgents, importPhoneNumber, deletePhoneNumber, fetchFolders, getCallCountsByFromNumber, listBlockedNumbers, createBlockedNumber, updateBlockedNumber, deleteBlockedNumber } from '../api';
import { useCallsContext } from '../context/CallsContext';
import { getUserData } from '../lib/supabase';

interface PhoneNumbersProps {
  onNavigate: (page: 'dashboard' | 'recordings' | 'phones') => void;
}

// Definir la interfaz para el modal de llamada
interface CallModalProps {
  phoneNumber: RetellPhoneNumber;
  onClose: () => void;
  apiKey: string | null;
}

// Componente para el modal de llamada
function CallModal({ phoneNumber, onClose, apiKey }: CallModalProps) {
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
      if (!apiKey) {
        setAgentsError('API key no configurada');
        return;
      }

      setLoadingAgents(true);
      setAgentsError(null);

      try {
        const agentsData = await fetchAgents(apiKey);
        setAgents(agentsData);
        
        // Si hay un agente asignado al número, seleccionarlo por defecto
        if (phoneNumber.inbound_agent_id) {
          const defaultAgent = agentsData.find(agent => agent.agent_id === phoneNumber.inbound_agent_id);
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
  }, [apiKey, phoneNumber.inbound_agent_id]);

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
    if (!apiKey) {
      setError('API key no configurada');
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

      const result = await createPhoneCall(apiKey, params);
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
  workspaceNameByApiKey: Record<string, string>;
}

// Componente para el modal de añadir número de teléfono
function AddPhoneModal({ onClose, onSuccess, workspaceNameByApiKey }: AddPhoneModalProps) {
  const { apiKey, apiKeyTest, clientId, phoneNumbers: contextPhoneNumbers } = useCallsContext();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [nickname, setNickname] = useState('');
  const [terminationUri, setTerminationUri] = useState('');
  const [inboundWebhookUrl, setInboundWebhookUrl] = useState('');
  const [sipUsername, setSipUsername] = useState('');
  const [sipPassword, setSipPassword] = useState('');
  const [transport, setTransport] = useState<'TCP' | 'UDP' | 'TLS'>('TCP');
  const [selectedWorkspaceApiKey, setSelectedWorkspaceApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [agents, setAgents] = useState<RetellAgent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<RetellAgent | null>(null);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [agentsError, setAgentsError] = useState<string | null>(null);

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

    if (options && options.length > 0) {
      setTerminationUriOptions(options);
    }
  }, []);

  // Construir opciones de workspace a partir de apiKeyTest (todas las API keys de los workspaces)
  const workspaceOptions = useMemo(() => {
    const options: { label: string; apiKey: string }[] = [];

    if (apiKeyTest && apiKeyTest.length > 0) {
      apiKeyTest.forEach((key, index) => {
        const workspaceName = workspaceNameByApiKey[key] || null;

        options.push({
          label: workspaceName || `Workspace ${index + 1}`,
          apiKey: key,
        });
      });
    } else if (apiKey) {
      const workspaceName = workspaceNameByApiKey[apiKey] || null;

      options.push({
        label: workspaceName || `Workspace principal`,
        apiKey,
      });
    }

    return options;
  }, [apiKey, apiKeyTest, workspaceNameByApiKey]);

  // Seleccionar por defecto el primer workspace disponible
  useEffect(() => {
    if (!selectedWorkspaceApiKey && workspaceOptions.length > 0) {
      setSelectedWorkspaceApiKey(workspaceOptions[0].apiKey);
    }
  }, [selectedWorkspaceApiKey, workspaceOptions]);

  // Cargar agentes cuando se selecciona un workspace
  useEffect(() => {
    const loadAgents = async () => {
      if (!selectedWorkspaceApiKey) return;

      setLoadingAgents(true);
      setAgentsError(null);

      try {
        const agentsData = await fetchAgents(selectedWorkspaceApiKey);
        setAgents(agentsData);
        setSelectedAgent(null);
      } catch (err) {
        // console.error('Error cargando agentes para workspace:', err);
        setAgentsError(err instanceof Error ? err.message : 'Error al cargar los agentes');
      } finally {
        setLoadingAgents(false);
      }
    };

    loadAgents();
  }, [selectedWorkspaceApiKey]);

  // Función para añadir el número de teléfono
  const handleAddPhone = async () => {
    const effectiveApiKey = selectedWorkspaceApiKey || apiKey;

    if (!effectiveApiKey) {
      setError('API key no configurada. Selecciona un workspace válido.');
      return;
    }

    if (!phoneNumber.trim()) {
      setError('El número de teléfono es obligatorio');
      return;
    }

    if (!selectedWorkspaceApiKey) {
      setError('Debes seleccionar un workspace');
      return;
    }

    if (!selectedAgent) {
      setError('Debes seleccionar un agente para el número');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const phoneData: any = {
        phone_number: phoneNumber.trim(),
        inbound_agent_id: selectedAgent.agent_id,
        outbound_agent_id: selectedAgent.agent_id,
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

      const result = await importPhoneNumber(effectiveApiKey, phoneData);
      setSuccess(`Número de teléfono añadido con éxito. ID: ${result.phone_number_id || 'N/A'}`);
      
      // Limpiar el formulario
      setPhoneNumber('');
      setNickname('');
      setTerminationUri('');
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
              value={selectedWorkspaceApiKey || ''}
              onChange={(e) => setSelectedWorkspaceApiKey(e.target.value || null)}
              className="w-full p-3 rounded-lg bg-white border border-slate-300 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Selecciona un workspace</option>
              {workspaceOptions.map((ws) => (
                <option key={ws.apiKey} value={ws.apiKey}>
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
            <label className="block text-slate-600 mb-1">Agente (workspace seleccionado) *</label>
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
                value={selectedAgent?.agent_id || ''}
                onChange={(e) => {
                  const agent = agents.find(a => a.agent_id === e.target.value) || null;
                  setSelectedAgent(agent);
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
            <label className="block text-slate-600 mb-1">Terminación URI</label>
            {terminationUriOptions.length > 0 ? (
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
  apiKey: string | null;
}

// Componente para el modal de confirmación de eliminación
function DeletePhoneModal({ phoneNumber, onClose, onSuccess, apiKey }: DeletePhoneModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Función para eliminar el número de teléfono
  const handleDeletePhone = async () => {
    const effectiveApiKey = phoneNumber.workspace_api_key || apiKey;

    if (!effectiveApiKey) {
      setError('API key no configurada para este workspace');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await deletePhoneNumber(effectiveApiKey, phoneNumber.phone_number);
      
      // Crear notificación de éxito
      const notification = document.createElement('div');
      notification.style.position = 'fixed';
      notification.style.top = '16px';
      notification.style.right = '16px';
      notification.style.backgroundColor = 'rgba(6, 78, 59, 0.9)'; // bg-green-900 con transparencia
      notification.style.color = 'white';
      notification.style.padding = '8px 16px';
      notification.style.borderRadius = '8px';
      notification.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
      notification.style.zIndex = '9999';
      notification.style.opacity = '0';
      notification.style.transition = 'opacity 0.3s ease-in-out';
      notification.textContent = 'Número de teléfono eliminado correctamente';
      document.body.appendChild(notification);
      
      // Mostrar la notificación
      setTimeout(() => {
        notification.style.opacity = '1';
      }, 10);
      
      // Eliminar la notificación después de 3 segundos
      setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
          if (document.body.contains(notification)) {
            document.body.removeChild(notification);
          }
        }, 300);
      }, 3000);
      
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

// Modal para eliminar varios números: filtros por workspace y búsqueda, selección con checkboxes, elimina uno a uno
interface DeleteMultiplePhoneModalProps {
  phoneNumbers: RetellPhoneNumber[];
  availableWorkspaces: string[];
  getWorkspaceLabel: (phone: RetellPhoneNumber) => string;
  apiKey: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

function DeleteMultiplePhoneModal({
  phoneNumbers,
  availableWorkspaces,
  getWorkspaceLabel,
  apiKey,
  onClose,
  onSuccess,
}: DeleteMultiplePhoneModalProps) {
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
        const effectiveApiKey = phone.workspace_api_key || apiKey;
        if (!effectiveApiKey) {
          setError(`Sin API key para el número ${phone.phone_number_pretty || phone.phone_number}`);
          setDeleting(false);
          return;
        }
        setProgress({ current: i + 1, total: selectedPhones.length });
        await deletePhoneNumber(effectiveApiKey, phone.phone_number);
      }

      const notification = document.createElement('div');
      notification.style.cssText = 'position:fixed;top:16px;right:16px;background:rgba(6,78,59,0.9);color:white;padding:8px 16px;border-radius:8px;box-shadow:0 4px 6px rgba(0,0,0,0.1);z-index:9999;opacity:0;transition:opacity 0.3s;';
      notification.textContent = `${selectedPhones.length} número(s) eliminado(s) correctamente`;
      document.body.appendChild(notification);
      setTimeout(() => (notification.style.opacity = '1'), 10);
      setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
      }, 3000);

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
  const [error, setError] = useState<string | null>(null);
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);
  const [selectedPhone, setSelectedPhone] = useState<RetellPhoneNumber | null>(null);
  const [showAddPhoneModal, setShowAddPhoneModal] = useState(false);
  const [showDeletePhoneModal, setShowDeletePhoneModal] = useState(false);
  const [showDeleteMultipleModal, setShowDeleteMultipleModal] = useState(false);
  const [phoneToDelete, setPhoneToDelete] = useState<RetellPhoneNumber | null>(null);
  const [workspaceFilter, setWorkspaceFilter] = useState<string | null>(null);
  const [phoneSearchTerm, setPhoneSearchTerm] = useState('');
  const [workspaceFoldersByApiKey, setWorkspaceFoldersByApiKey] = useState<Record<string, string>>({});
  const [callCountsByPhone, setCallCountsByPhone] = useState<Record<string, { total: number; efectivas: number; fallidas: number }>>({});
  const [loadingCallCounts, setLoadingCallCounts] = useState(true);
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

  // Usar el contexto para obtener la API key, números de teléfono y el estado de llamadas
  const { 
    apiKey, 
    apiKeyTest,
    clientId,
    phoneNumbers: contextPhoneNumbers, 
    loadingPhoneNumbers: contextLoadingPhoneNumbers,
    loadPhoneNumbers: contextLoadPhoneNumbers,
    callsEnabled, 
    phoneFilter 
  } = useCallsContext();
  
  // Usar los números de teléfono del contexto en lugar de estado local
  const phoneNumbers = contextPhoneNumbers;
  const loading = contextLoadingPhoneNumbers;

  // Cargar folders (workspaces) desde Retell para cada API key y mapearlos por similitud con clientId
  useEffect(() => {
    const loadFoldersForWorkspaces = async () => {
      const apiKeysToUse = apiKeyTest && apiKeyTest.length > 0
        ? apiKeyTest
        : apiKey
          ? [apiKey]
          : [];

      if (apiKeysToUse.length === 0) return;

      const newMapping: Record<string, string> = {};

      for (const key of apiKeysToUse) {
        try {
          const folders = await fetchFolders(key);
          if (!folders || folders.length === 0) continue;

          // Si solo hay una carpeta, usar esa directamente
          if (folders.length === 1) {
            newMapping[key] = folders[0].folderName;
            continue;
          }

          // Normalizar clientId para comparación
          const baseClientId = (clientId || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

          let bestFolder = folders[0];
          let bestScore = -1;

          for (const folder of folders) {
            const normalizedName = folder.folderName.toLowerCase().replace(/[^a-z0-9]+/g, '');
            let score = 0;

            if (baseClientId && normalizedName.includes(baseClientId)) {
              score = baseClientId.length;
            } else if (baseClientId) {
              // Longitud de prefijo común como heurística simple
              const maxLen = Math.min(baseClientId.length, normalizedName.length);
              while (score < maxLen && baseClientId[score] === normalizedName[score]) {
                score++;
              }
            }

            if (score > bestScore) {
              bestScore = score;
              bestFolder = folder;
            }
          }

          newMapping[key] = bestFolder.folderName;
        } catch (e) {
          // console.error('Error al cargar folders para workspace:', key, e);
        }
      }

      if (Object.keys(newMapping).length > 0) {
        setWorkspaceFoldersByApiKey(newMapping);
      }
    };

    loadFoldersForWorkspaces();
  }, [apiKey, apiKeyTest, clientId]);

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

  // Cargar conteos de llamadas por número desde call_logs (por from_number)
  useEffect(() => {
    const loadCallCounts = async () => {
      if (!clientId) {
        setLoadingCallCounts(false);
        return;
      }
      setLoadingCallCounts(true);
      try {
        const rows = await getCallCountsByFromNumber(clientId);
        const map: Record<string, { total: number; efectivas: number; fallidas: number }> = {};
        rows.forEach((r) => {
          const key = r.from_number || '';
          const keyNorm = (r.from_number_norm != null && r.from_number_norm !== '') ? r.from_number_norm : key.replace(/^\+/, '');
          const value = { total: r.total, efectivas: r.efectivas, fallidas: r.fallidas };
          if (key) map[key] = value;
          if (keyNorm && keyNorm !== key) map[keyNorm] = value;
        });
        setCallCountsByPhone(map);
      } catch (e) {
        // console.error('Error al cargar conteos de llamadas por número:', e);
      } finally {
        setLoadingCallCounts(false);
      }
    };
    loadCallCounts();
  }, [clientId]);

  const getCallCountsForPhone = (phoneNumber: string): { total: number; efectivas: number; fallidas: number } | null => {
    const withPlus = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
    const withoutPlus = phoneNumber.replace(/^\+/, '');
    return callCountsByPhone[withPlus] ?? callCountsByPhone[withoutPlus] ?? callCountsByPhone[phoneNumber] ?? null;
  };

  // No mostrar contenido hasta que estén cargados números y conteos de llamadas
  const loadingAll = loading || loadingCallCounts;

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

  // Mapear cada workspace_api_key a un nombre de workspace (bonito o genérico)
  const workspaceNameByApiKey = useMemo(() => {
    const mapping: Record<string, string> = {};

    const apiKeys = Array.from(
      new Set(
        phoneNumbers
          .map((p) => p.workspace_api_key)
          .filter((k): k is string => !!k)
      )
    );

    apiKeys.forEach((key, index) => {
      const phoneForKey = phoneNumbers.find((p) => p.workspace_api_key === key);

      const fromFolders = workspaceFoldersByApiKey[key];
      const fromMetadata = phoneForKey?.workspace_name;
      const fromWebhook = phoneForKey?.inbound_webhook_url
        ? getWorkspaceFromWebhook(phoneForKey.inbound_webhook_url)
        : null;

      mapping[key] = fromFolders || fromMetadata || fromWebhook || `Workspace ${index + 1}`;
    });

    return mapping;
  }, [phoneNumbers, workspaceFoldersByApiKey]);

  // Obtener lista de workspaces únicos disponibles (labels)
  const availableWorkspaces = Array.from(
    new Set(
      Object.values(workspaceNameByApiKey).filter((ws) => !!ws)
    )
  );
  
  // Filtrar números de teléfono por número específico (URL) y por workspace si hay filtros activos
  const filteredByPhone = phoneFilter 
    ? phoneNumbers.filter(phone => phone.phone_number === phoneFilter)
    : phoneNumbers;

  const filteredPhoneNumbers = workspaceFilter
    ? filteredByPhone.filter(phone => {
        const labelFromApiKey = phone.workspace_api_key
          ? workspaceNameByApiKey[phone.workspace_api_key]
          : undefined;
        const labelFromWebhook = phone.inbound_webhook_url
          ? getWorkspaceFromWebhook(phone.inbound_webhook_url)
          : null;
        const finalLabel = labelFromApiKey || labelFromWebhook;
        return finalLabel === workspaceFilter;
      })
    : filteredByPhone;

  // Filtrar por búsqueda de número (incluye dígitos y espacios/guiones)
  const normalizePhone = (s: string) => (s || '').replace(/\D/g, '');
  const displayPhoneNumbers = !phoneSearchTerm.trim()
    ? filteredPhoneNumbers
    : filteredPhoneNumbers.filter(phone => {
        const normalized = normalizePhone(phone.phone_number || '');
        const term = normalizePhone(phoneSearchTerm);
        return normalized.includes(term);
      });
  
  // Cargar los números al montar el componente usando la función del contexto
  useEffect(() => {
    contextLoadPhoneNumbers();
  }, [contextLoadPhoneNumbers]);
  
  // Función para copiar un número al portapapeles
  const copyToClipboard = (number: string) => {
    navigator.clipboard.writeText(number)
      .then(() => {
        setCopiedNumber(number);
        setTimeout(() => setCopiedNumber(null), 2000);
      })
      .catch(err => {
        // console.error('Error al copiar:', err);
      });
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
    <div className="p-8 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Números de Teléfono</h2>
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
            {/* Buscador por número de teléfono */}
            <div className="relative flex items-center">
              <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={phoneSearchTerm}
                onChange={(e) => setPhoneSearchTerm(e.target.value)}
                placeholder="Buscar por número..."
                className="pl-9 pr-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-48 min-w-0"
              />
            </div>

            {availableWorkspaces.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Workspace:</span>
                <select
                  value={workspaceFilter || ''}
                  onChange={(e) => setWorkspaceFilter(e.target.value || null)}
                  className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todos</option>
                  {availableWorkspaces.map((ws) => (
                    <option key={ws} value={ws}>
                      {ws}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={() => setShowAddPhoneModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-700 text-white rounded-lg hover:from-green-700 hover:to-emerald-800 transition-colors flex items-center"
            >
              <Plus className="h-5 w-5 mr-1" />
              Añadir Número
            </button>
            
            <button
              onClick={() => contextLoadPhoneNumbers(true)}
              disabled={loadingAll}
              className={`px-4 py-2 rounded-lg text-white flex items-center ${
                loadingAll
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800'
              }`}
            >
              {loadingAll ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Cargando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-5 w-5 mr-1" />
                  Actualizar
                </>
              )}
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
          
          {/* Mostrar error si lo hay */}
          {!loadingAll && error && (
            <div className="p-6 text-center text-red-600">
              {error}
            </div>
          )}
          
          {/* No se encontraron resultados */}
          {!loadingAll && !error && displayPhoneNumbers.length === 0 && (
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
          
          {/* Lista de números de teléfono */}
          {!loadingAll && !error && displayPhoneNumbers.map((phone) => {
            const counts = getCallCountsForPhone(phone.phone_number);
            const total = counts?.total ?? 0;
            const efectivas = counts?.efectivas ?? 0;
            const fallidas = counts?.fallidas ?? 0;
            const workspaceLabel = phone.workspace_api_key
              ? workspaceNameByApiKey[phone.workspace_api_key] ||
                (phone.inbound_webhook_url ? getWorkspaceFromWebhook(phone.inbound_webhook_url) : null)
              : phone.inbound_webhook_url ? getWorkspaceFromWebhook(phone.inbound_webhook_url) : null;

            return (
              <div key={phone.phone_number} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:shadow-md">
                {/* Cabecera: número + acciones */}
                <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="bg-blue-100 p-3 rounded-full">
                      <Phone className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-bold tracking-tight text-slate-800">
                          {phone.phone_number_pretty || phone.phone_number}
                        </h3>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); copyToClipboard(phone.phone_number); }}
                          className="text-slate-400 hover:text-blue-600 transition-colors"
                          title="Copiar número"
                        >
                          <Copy className="w-5 h-5" />
                        </button>
                        {copiedNumber === phone.phone_number && (
                          <span className="text-green-600 text-sm">¡Copiado!</span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 mt-0.5">ID: {phone.phone_number_pretty || phone.phone_number}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {callsEnabled && (
                      <button
                        type="button"
                        onClick={() => setSelectedPhone(phone)}
                        className="flex items-center gap-2 bg-blue-600/10 text-blue-600 hover:bg-blue-600 hover:text-white px-4 py-2 rounded-lg font-semibold text-sm transition-all"
                      >
                        <Phone className="w-5 h-5" />
                        Llamar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setPhoneToDelete(phone);
                        setShowDeletePhoneModal(true);
                      }}
                      className="flex items-center gap-2 bg-rose-100 text-rose-600 hover:bg-rose-600 hover:text-white px-4 py-2 rounded-lg font-semibold text-sm transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                      Eliminar
                    </button>
                  </div>
                </div>

                {/* Llamadas realizadas */}
                <div className="px-6 py-4 bg-slate-50/50 border-y border-slate-100">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" />
                      Llamadas realizadas
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`flex items-center px-3 py-1 rounded-full text-xs font-semibold shadow-sm ${
                        total >= 35000
                          ? 'bg-rose-100 text-rose-700'
                          : total >= 15000
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        <span className="mr-1 opacity-70">Total:</span> {total.toLocaleString()}
                      </span>
                      <span className="flex items-center text-slate-700 text-xs font-semibold">
                        <span className="mr-1">Efectivas:</span> <span className="text-emerald-700">{efectivas.toLocaleString()}</span>
                      </span>
                      <span className="flex items-center text-slate-700 text-xs font-semibold">
                        <span className="mr-1">Fallidas:</span> <span className="text-rose-700">{fallidas.toLocaleString()}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Detalles en grid */}
                <div className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-y-6 gap-x-8">
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Nombre</p>
                      <p className="text-sm font-medium">{phone.nickname || phone.phone_number_pretty || phone.phone_number}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Tipo</p>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {phone.phone_number_type || '—'}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Última modificación</p>
                      <p className="text-sm font-medium">{formatDate(phone.last_modification_timestamp)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Workspace</p>
                      <p className="text-sm font-medium">{workspaceLabel || 'No especificado'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Agente de entrada</p>
                      {phone.inbound_agent_id ? (
                        <a
                          href={getAgentUrl(phone.inbound_agent_id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1"
                        >
                          {phone.inbound_agent_id.substring(0, 12)}...
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <p className="text-sm font-medium">No asignado</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Agente de salida</p>
                      {phone.outbound_agent_id ? (
                        <a
                          href={getAgentUrl(phone.outbound_agent_id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1"
                        >
                          {phone.outbound_agent_id.substring(0, 12)}...
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <p className="text-sm font-medium">No asignado</p>
                      )}
                    </div>
                    {phone.inbound_webhook_url && (
                      <div className="sm:col-span-2">
                        <p className="text-xs font-semibold text-slate-400 uppercase mb-1">URL de webhook</p>
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono bg-slate-100 p-2 rounded block truncate flex-1 text-slate-600">
                            {phone.inbound_webhook_url}
                          </code>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); copyToClipboard(phone.inbound_webhook_url!); }}
                            className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors shrink-0"
                            title="Copiar URL"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
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
          apiKey={selectedPhone.workspace_api_key || apiKey}
        />
      )}

      {/* Modal para añadir número de teléfono */}
      {showAddPhoneModal && (
        <AddPhoneModal
          onClose={() => setShowAddPhoneModal(false)}
          onSuccess={() => contextLoadPhoneNumbers(true)}
          workspaceNameByApiKey={workspaceNameByApiKey}
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
          onSuccess={() => contextLoadPhoneNumbers(true)}
          apiKey={apiKey}
        />
      )}

      {/* Modal para eliminar varios números */}
      {showDeleteMultipleModal && (
        <DeleteMultiplePhoneModal
          phoneNumbers={phoneNumbers}
          availableWorkspaces={availableWorkspaces}
          getWorkspaceLabel={(phone) => {
            const fromApiKey = phone.workspace_api_key ? workspaceNameByApiKey[phone.workspace_api_key] : undefined;
            const fromWebhook = phone.inbound_webhook_url ? getWorkspaceFromWebhook(phone.inbound_webhook_url) : null;
            return fromApiKey || fromWebhook || 'Sin workspace';
          }}
          apiKey={apiKey}
          onClose={() => setShowDeleteMultipleModal(false)}
          onSuccess={() => contextLoadPhoneNumbers(true)}
        />
      )}
    </div>
  );
}

export default PhoneNumbers; 