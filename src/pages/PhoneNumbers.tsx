import React, { useState, useEffect } from 'react';
import { Phone, Copy, RefreshCw, ExternalLink, X, Send, Plus, ChevronDown, User } from 'lucide-react';
import { RetellPhoneNumber, RetellAgent } from '../types';
import { fetchPhoneNumbers, createPhoneCall, fetchAgents } from '../api';
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
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl shadow-xl border border-gray-800 w-full max-w-md">
        <div className="flex justify-between items-center border-b border-gray-800 p-4">
          <h3 className="text-lg font-medium text-white">Realizar llamada</h3>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-gray-800 rounded-full"
          >
            <X className="w-5 h-5 text-gray-400 hover:text-white" />
          </button>
        </div>
        
        <div className="p-5 space-y-5">
          <div>
            <p className="text-gray-400 mb-1">Desde el número:</p>
            <div className="flex items-center bg-gray-800 p-3 rounded-lg">
              <Phone className="w-5 h-5 text-purple-400 mr-2" />
              <span className="text-white">{phoneNumber.phone_number_pretty}</span>
            </div>
          </div>
          
          <div>
            <label className="block text-gray-400 mb-1">Número de destino *</label>
            <input
              type="text"
              value={toNumber}
              onChange={(e) => setToNumber(e.target.value)}
              placeholder="+1 (555) 123-4567"
              className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white"
              required
            />
          </div>

          <div className="relative agent-dropdown">
            <label className="block text-gray-400 mb-1">Agente para la llamada *</label>
            {loadingAgents ? (
              <div className="flex items-center bg-gray-800 p-3 rounded-lg border border-gray-700 text-gray-400">
                <svg className="animate-spin mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Cargando agentes...
              </div>
            ) : agentsError ? (
              <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-300 text-sm">
                {agentsError}
              </div>
            ) : agents.length === 0 ? (
              <div className="flex items-center bg-gray-800 p-3 rounded-lg border border-gray-700 text-gray-400">
                No se encontraron agentes disponibles
              </div>
            ) : (
              <>
                <button
                  onClick={() => setShowAgentsDropdown(!showAgentsDropdown)}
                  className="w-full flex items-center justify-between p-3 rounded-lg bg-gray-800 border border-gray-700 text-white"
                >
                  <div className="flex items-center">
                    <User className="w-5 h-5 text-purple-400 mr-2" />
                    <span>
                      {selectedAgent ? selectedAgent.agent_name : 'Seleccionar agente'}
                    </span>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showAgentsDropdown ? 'transform rotate-180' : ''}`} />
                </button>
                
                {showAgentsDropdown && (
                  <div className="absolute mt-1 w-full bg-gray-800 rounded-lg shadow-lg z-10 border border-gray-700 max-h-60 overflow-y-auto">
                    <ul className="py-1">
                      {agents.map((agent) => (
                        <li key={agent.agent_id}>
                          <button
                            onClick={() => handleSelectAgent(agent)}
                            className={`w-full text-left px-4 py-2 flex items-center ${
                              selectedAgent?.agent_id === agent.agent_id
                                ? 'bg-purple-600 text-white'
                                : 'text-gray-300 hover:bg-gray-700'
                            }`}
                          >
                            <User className="w-4 h-4 mr-2" />
                            <div>
                              <p>{agent.agent_name}</p>
                              <p className="text-xs text-gray-400 truncate">{agent.agent_id}</p>
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
              <label className="text-gray-400">Variables dinámicas (opcional)</label>
              <button 
                onClick={addDynamicVariable}
                className="text-purple-400 hover:text-purple-300 flex items-center text-sm"
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
                  className="flex-1 p-2 rounded-lg bg-gray-800 border border-gray-700 text-white"
                />
                <input
                  type="text"
                  value={variable.value}
                  onChange={(e) => updateDynamicVariable(index, 'value', e.target.value)}
                  placeholder="Valor"
                  className="flex-1 p-2 rounded-lg bg-gray-800 border border-gray-700 text-white"
                />
                {index > 0 && (
                  <button 
                    onClick={() => removeDynamicVariable(index)}
                    className="p-1 hover:bg-gray-700 rounded-full"
                  >
                    <X className="w-5 h-5 text-gray-400 hover:text-white" />
                  </button>
                )}
              </div>
            ))}
          </div>
          
          {error && (
            <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}
          
          {success && (
            <div className="p-3 bg-green-900/30 border border-green-800 rounded-lg text-green-300 text-sm">
              {success}
            </div>
          )}
          
          <div className="flex justify-end pt-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 mr-2"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreateCall}
              disabled={loading || !toNumber || !selectedAgent}
              className={`px-4 py-2 rounded-lg text-white flex items-center ${
                loading || !toNumber || !selectedAgent
                  ? 'bg-purple-700/50 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-700'
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

export function PhoneNumbers({ onNavigate }: PhoneNumbersProps) {
  const [phoneNumbers, setPhoneNumbers] = useState<RetellPhoneNumber[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);
  const [selectedPhone, setSelectedPhone] = useState<RetellPhoneNumber | null>(null);
  
  // Usar el contexto para obtener la API key
  const { apiKey } = useCallsContext();
  
  // Cargar los números de teléfono
  const loadPhoneNumbers = async () => {
    if (!apiKey) {
      setError('API key no configurada. Añade ?apikey=TU_API_KEY a la URL.');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await fetchPhoneNumbers(apiKey);
      setPhoneNumbers(data);
    } catch (err) {
      console.error('Error cargando números de teléfono:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar los números de teléfono');
    } finally {
      setLoading(false);
    }
  };
  
  // Cargar los números al montar el componente
  useEffect(() => {
    loadPhoneNumbers();
  }, [apiKey]);
  
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
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Números de Teléfono</h2>
        <p className="text-gray-400">Gestiona los números de teléfono asociados a tus agentes de IA</p>
      </div>
      
      <div className="bg-gray-900 rounded-xl shadow-lg border border-gray-800">
        <div className="p-6 border-b border-gray-800 flex flex-wrap items-center justify-between gap-4">
          <h3 className="text-lg font-semibold text-white">Números de Teléfono</h3>
          
          <button
            onClick={loadPhoneNumbers}
            disabled={loading}
            className={`px-4 py-2 rounded-lg text-white flex items-center ${
              loading
                ? 'bg-gray-700 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700'
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
        
        <div className="divide-y divide-gray-800">
          {/* Estado de carga */}
          {loading && (
            <div className="p-6 text-center text-gray-400">
              Cargando números de teléfono...
            </div>
          )}
          
          {/* Mostrar error si lo hay */}
          {error && (
            <div className="p-6 text-center text-red-400">
              {error}
            </div>
          )}
          
          {/* No se encontraron resultados */}
          {!loading && !error && phoneNumbers.length === 0 && (
            <div className="p-6 text-center text-gray-400">
              No se encontraron números de teléfono
            </div>
          )}
          
          {/* Lista de números de teléfono */}
          {!loading && !error && phoneNumbers.map((phone) => (
            <div key={phone.phone_number} className="p-6 hover:bg-gray-800/30 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-grow">
                  <div className="flex items-center gap-2 mb-2">
                    <Phone className="w-5 h-5 text-purple-400" />
                    <h4 className="text-white font-medium text-lg">{phone.phone_number_pretty}</h4>
                    <button 
                      onClick={() => copyToClipboard(phone.phone_number)}
                      className="ml-2 p-1 rounded-md hover:bg-gray-700 transition-colors"
                      title="Copiar número"
                    >
                      <Copy className="w-4 h-4 text-gray-400 hover:text-white" />
                    </button>
                    {copiedNumber === phone.phone_number && (
                      <span className="text-green-400 text-sm">¡Copiado!</span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm text-gray-400">
                    {phone.nickname && (
                      <div>
                        <p className="text-gray-500">Nombre</p>
                        <p className="text-white">{phone.nickname}</p>
                      </div>
                    )}
                    
                    <div>
                      <p className="text-gray-500">Tipo</p>
                      <p className="text-white">{phone.phone_number_type}</p>
                    </div>
                    
                    <div>
                      <p className="text-gray-500">Código de área</p>
                      <p className="text-white">{phone.area_code}</p>
                    </div>
                    
                    <div>
                      <p className="text-gray-500">Última modificación</p>
                      <p className="text-white">{formatDate(phone.last_modification_timestamp)}</p>
                    </div>
                    
                    <div>
                      <p className="text-gray-500">Agente de entrada</p>
                      <div className="flex items-center">
                        <p className="text-white mr-2">
                          {phone.inbound_agent_id ? `${phone.inbound_agent_id.substring(0, 10)}...` : 'No asignado'}
                        </p>
                        {phone.inbound_agent_id && (
                          <a 
                            href={getAgentUrl(phone.inbound_agent_id)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-purple-400 hover:text-purple-300"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-gray-500">Agente de salida</p>
                      <div className="flex items-center">
                        <p className="text-white mr-2">
                          {phone.outbound_agent_id ? `${phone.outbound_agent_id.substring(0, 10)}...` : 'No asignado'}
                        </p>
                        {phone.outbound_agent_id && (
                          <a 
                            href={getAgentUrl(phone.outbound_agent_id)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-purple-400 hover:text-purple-300"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>
                    
                    {phone.inbound_webhook_url && (
                      <div className="col-span-1 md:col-span-2">
                        <p className="text-gray-500">URL de webhook</p>
                        <p className="text-white truncate">{phone.inbound_webhook_url}</p>
                      </div>
                    )}
                  </div>
                </div>
                
                <button
                  onClick={() => setSelectedPhone(phone)}
                  className="px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center"
                >
                  <Phone className="w-4 h-4 mr-1" />
                  Llamar
                </button>
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
    </div>
  );
}

export default PhoneNumbers; 