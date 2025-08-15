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
    <div className="p-8 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Números de Teléfono</h2>
        <p className="text-slate-600">Gestiona los números de teléfono asociados a tus agentes de IA</p>
      </div>
      
      <div className="bg-white rounded-xl shadow-lg border border-slate-200">
        <div className="p-6 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-slate-50 to-blue-50">
          <h3 className="text-lg font-semibold text-slate-800">Números de Teléfono</h3>
          
          <button
            onClick={loadPhoneNumbers}
            disabled={loading}
            className={`px-4 py-2 rounded-lg text-white flex items-center ${
              loading
                ? 'bg-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800'
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
          {!loading && !error && phoneNumbers.length === 0 && (
            <div className="p-6 text-center text-slate-600">
              No se encontraron números de teléfono
            </div>
          )}
          
          {/* Lista de números de teléfono */}
          {!loading && !error && phoneNumbers.map((phone) => (
            <div key={phone.phone_number} className="p-6 hover:bg-slate-50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-grow">
                  <div className="flex items-center gap-2 mb-2">
                    <Phone className="w-5 h-5 text-blue-600" />
                    <h4 className="text-slate-800 font-medium text-lg">{phone.phone_number_pretty}</h4>
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
                    
                    {phone.inbound_webhook_url && (
                      <div className="col-span-1 md:col-span-2">
                        <p className="text-slate-500">URL de webhook</p>
                        <p className="text-slate-800 truncate">{phone.inbound_webhook_url}</p>
                      </div>
                    )}
                  </div>
                </div>
                
                <button
                  onClick={() => setSelectedPhone(phone)}
                  className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-lg hover:from-blue-700 hover:to-indigo-800 transition-colors flex items-center"
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