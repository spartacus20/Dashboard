import { useState, useEffect, useMemo } from 'react';
import { Phone, Copy, RefreshCw, ExternalLink, X, Send, Plus, ChevronDown, User, Trash2, AlertTriangle } from 'lucide-react';
import { RetellPhoneNumber, RetellAgent } from '../types';
import { createPhoneCall, fetchAgents, importPhoneNumber, deletePhoneNumber } from '../api';
import { useCallsContext } from '../context/CallsContext';

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
        console.error('Error cargando agentes:', err);
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
      console.error('Error al crear la llamada:', err);
      setError(err instanceof Error ? err.message : 'Error al iniciar la llamada');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md">
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
}

// Componente para el modal de añadir número de teléfono
function AddPhoneModal({ onClose, onSuccess }: AddPhoneModalProps) {
  const { apiKey, apiKeyTest, clientId, phoneNumbers: contextPhoneNumbers } = useCallsContext();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [nickname, setNickname] = useState('');
  const [terminationUri, setTerminationUri] = useState('');
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

  // Prefijar URI de terminación para cliente específico
  useEffect(() => {
    if (clientId === 'mas_sol001' && !terminationUri) {
      setTerminationUri('http://livekit2.netelip.com - http://livekit.netelip.com');
    }
  }, [clientId, terminationUri]);

  // Construir opciones de workspace a partir de apiKeyTest (todas las API keys de los workspaces)
  const workspaceOptions = (() => {
    const options: { label: string; apiKey: string }[] = [];

    if (apiKeyTest && apiKeyTest.length > 0) {
      apiKeyTest.forEach((key, index) => {
        const phoneForKey = contextPhoneNumbers.find(
          (p) => p.workspace_api_key === key
        );
        const workspaceName = phoneForKey?.workspace_name || null;

        options.push({
          label: workspaceName || `Workspace ${index + 1}`,
          apiKey: key,
        });
      });
    } else if (apiKey) {
      const phoneForKey = contextPhoneNumbers[0];
      const workspaceName = phoneForKey?.workspace_name || null;

      options.push({
        label: workspaceName || `Workspace principal`,
        apiKey,
      });
    }

    return options;
  })();

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
        console.error('Error cargando agentes para workspace:', err);
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
      setSipUsername('');
      setSipPassword('');
      
      // Notificar éxito al componente padre después de un breve delay
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Error al añadir número de teléfono:', err);
      setError(err instanceof Error ? err.message : 'Error al añadir el número de teléfono');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md">
        <div className="flex justify-between items-center border-b border-slate-200 p-4 bg-gradient-to-r from-slate-50 to-blue-50">
          <h3 className="text-lg font-medium text-slate-800">Añadir Número de Teléfono</h3>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-slate-200 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-slate-500 hover:text-slate-700" />
          </button>
        </div>
        
        <div className="p-5 space-y-5 bg-white">
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
            <label className="block text-slate-600 mb-1">URI de terminación (opcional)</label>
            <input
              type="text"
              value={terminationUri}
              onChange={(e) => setTerminationUri(e.target.value)}
              placeholder="sip:termination@example.com"
              className="w-full p-3 rounded-lg bg-white border border-slate-300 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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
      console.error('Error al eliminar número de teléfono:', err);
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

export function PhoneNumbers({ onNavigate: _onNavigate }: PhoneNumbersProps) {
  const [error, setError] = useState<string | null>(null);
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);
  const [selectedPhone, setSelectedPhone] = useState<RetellPhoneNumber | null>(null);
  const [showAddPhoneModal, setShowAddPhoneModal] = useState(false);
  const [showDeletePhoneModal, setShowDeletePhoneModal] = useState(false);
  const [phoneToDelete, setPhoneToDelete] = useState<RetellPhoneNumber | null>(null);
  const [workspaceFilter, setWorkspaceFilter] = useState<string | null>(null);
  
  // Usar el contexto para obtener la API key, números de teléfono y el estado de llamadas
  const { 
    apiKey, 
    phoneNumbers: contextPhoneNumbers, 
    loadingPhoneNumbers: contextLoadingPhoneNumbers,
    loadPhoneNumbers: contextLoadPhoneNumbers,
    callsEnabled, 
    phoneFilter 
  } = useCallsContext();
  
  // Usar los números de teléfono del contexto en lugar de estado local
  const phoneNumbers = contextPhoneNumbers;
  const loading = contextLoadingPhoneNumbers;
  
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

      const fromMetadata = phoneForKey?.workspace_name;
      const fromWebhook = phoneForKey?.inbound_webhook_url
        ? getWorkspaceFromWebhook(phoneForKey.inbound_webhook_url)
        : null;

      mapping[key] = fromMetadata || fromWebhook || `Workspace ${index + 1}`;
    });

    return mapping;
  }, [phoneNumbers]);

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
        console.error('Error al copiar:', err);
      });
  };
  
  // Formatear la fecha de última modificación
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };
  
  const getAgentUrl = (agentId: string) => {
    return `https://retellai.com/dashboard/agents/${agentId}`;
  };
  
  return (
    <div className="p-8 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Números de Teléfono</h2>
        <p className="text-slate-600">Gestiona los números de teléfono asociados a tus agentes de IA</p>
      </div>
      
      <div className="bg-white rounded-xl shadow-lg border border-slate-200">
        <div className="p-6 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-slate-50 to-blue-50">
          <h3 className="text-lg font-semibold text-slate-800">Números de Teléfono</h3>
          
          <div className="flex flex-wrap gap-2 items-center justify-end">
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
              disabled={loading}
              className={`px-4 py-2 rounded-lg text-white flex items-center ${
                loading
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800'
              }`}
            >
              {loading ? (
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
          </div>
        </div>
        
        <div className="divide-y divide-slate-200">
          {/* Estado de carga */}
          {loading && (
            <div className="p-6 text-center text-slate-600">
              Cargando números de teléfono...
            </div>
          )}
          
          {/* Mostrar error si lo hay */}
          {error && (
            <div className="p-6 text-center text-red-600">
              {error}
            </div>
          )}
          
          {/* No se encontraron resultados */}
          {!loading && !error && filteredPhoneNumbers.length === 0 && (
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
          {!loading && !error && filteredPhoneNumbers.map((phone) => (
            <div key={phone.phone_number} className="p-6 hover:bg-slate-50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-grow">
                  <div className="flex items-center gap-2 mb-2">
                    <Phone className="w-5 h-5 text-blue-600" />
                    <div className="flex flex-col">
                      <h4 className="text-slate-800 font-medium text-lg">
                        {phone.nickname || phone.phone_number_pretty}
                      </h4>
                      {phone.nickname && (
                        <span className="text-slate-500 text-sm">
                          {phone.phone_number_pretty}
                        </span>
                      )}
                    </div>
                    <button 
                      onClick={() => copyToClipboard(phone.phone_number)}
                      className="ml-2 p-1 rounded-md hover:bg-slate-200 transition-colors"
                      title="Copiar número"
                    >
                      <Copy className="w-4 h-4 text-slate-500 hover:text-slate-700" />
                    </button>
                    {copiedNumber === phone.phone_number && (
                      <span className="text-green-600 text-sm">¡Copiado!</span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm text-slate-600">
                    {phone.nickname && (
                      <div>
                        <p className="text-slate-500">Nombre</p>
                        <p className="text-slate-800">{phone.nickname}</p>
                      </div>
                    )}
                    
                    <div>
                      <p className="text-slate-500">Tipo</p>
                      <p className="text-slate-800">{phone.phone_number_type}</p>
                    </div>
                    
                    <div>
                      <p className="text-slate-500">Código de área</p>
                      <p className="text-slate-800">{phone.area_code}</p>
                    </div>
                    
                    <div>
                      <p className="text-slate-500">Última modificación</p>
                      <p className="text-slate-800">{formatDate(phone.last_modification_timestamp)}</p>
                    </div>
                    
                    <div>
                      <p className="text-slate-500">Agente de entrada</p>
                      <div className="flex items-center">
                        <p className="text-slate-800 mr-2">
                          {phone.inbound_agent_id ? `${phone.inbound_agent_id.substring(0, 10)}...` : 'No asignado'}
                        </p>
                        {phone.inbound_agent_id && (
                          <a 
                            href={getAgentUrl(phone.inbound_agent_id)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-slate-500">Agente de salida</p>
                      <div className="flex items-center">
                        <p className="text-slate-800 mr-2">
                          {phone.outbound_agent_id ? `${phone.outbound_agent_id.substring(0, 10)}...` : 'No asignado'}
                        </p>
                        {phone.outbound_agent_id && (
                          <a 
                            href={getAgentUrl(phone.outbound_agent_id)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-slate-500">Workspace</p>
                      <p className="text-slate-800">
              {phone.workspace_api_key
                ? workspaceNameByApiKey[phone.workspace_api_key] ||
                  (phone.inbound_webhook_url
                    ? getWorkspaceFromWebhook(phone.inbound_webhook_url)
                    : 'No especificado')
                : phone.inbound_webhook_url
                ? getWorkspaceFromWebhook(phone.inbound_webhook_url) || 'No especificado'
                : 'No especificado'}
                      </p>
                    </div>
                    
                    {phone.inbound_webhook_url && (
                      <div className="col-span-1 md:col-span-2">
                        <p className="text-slate-500">URL de webhook</p>
                        <p className="text-slate-800 truncate">{phone.inbound_webhook_url}</p>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  {callsEnabled && (
                    <button
                      onClick={() => setSelectedPhone(phone)}
                      className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-lg hover:from-blue-700 hover:to-indigo-800 transition-colors flex items-center"
                    >
                      <Phone className="w-4 h-4 mr-1" />
                      Llamar
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setPhoneToDelete(phone);
                      setShowDeletePhoneModal(true);
                    }}
                    className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Modal para iniciar llamada */}
      {selectedPhone && (
        <CallModal 
          phoneNumber={selectedPhone}
          onClose={() => setSelectedPhone(null)}
          apiKey={apiKey}
        />
      )}

      {/* Modal para añadir número de teléfono */}
      {showAddPhoneModal && (
        <AddPhoneModal
          onClose={() => setShowAddPhoneModal(false)}
          onSuccess={() => contextLoadPhoneNumbers(true)}
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
    </div>
  );
}

export default PhoneNumbers; 