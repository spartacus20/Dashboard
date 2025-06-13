import React, { useEffect, useState, useRef, ChangeEvent } from 'react';
import { fetchCalls, fetchAllCalls, calculateStats, fetchBatchCalls, fetchBatchCallTasks, createBatchCall, fetchPhoneNumbers, deleteBatchCall } from './api';
import type { RetellCall, CallStats, FilterCriteria, RetellBatchCall, BatchCallTask, RetellPhoneNumber } from './types';
import { Sidebar } from './components/layout/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Recordings } from './pages/Recordings';
import { PhoneNumbers } from './pages/PhoneNumbers';
import { Agendas } from './pages/Agendas';
import { useCallsContext } from './context/CallsContext';
import { X, Upload, Phone, Info, Check, RefreshCw, Trash2, AlertTriangle } from 'lucide-react';

function DashboardApp() {
  const [currentPage, setCurrentPage] = React.useState<string>('dashboard');
  const [calls, setCalls] = React.useState<RetellCall[]>([]);
  const [filteredCalls, setFilteredCalls] = React.useState<RetellCall[]>([]);
  const [stats, setStats] = React.useState<CallStats | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [filterCriteria, setFilterCriteria] = React.useState<FilterCriteria>({});
  const [disconnectionReasons, setDisconnectionReasons] = React.useState<string[]>([]);
  
  // Obtenemos los datos del contexto compartido
  const { 
    allCalls, 
    loadingAllCalls, 
    loadAllCalls, 
    lastUpdated,
    disconnectionReasons: contextDisconnectionReasons,
    error: contextError,
    apiKey,
    phoneNumbers,
    loadingPhoneNumbers,
    phoneNumbersLoaded,
    noPhoneNumbersAvailable,
    loadPhoneNumbers,
    batchCalls,
    loadingBatchCalls,
    loadBatchCalls,
    refreshBatchCalls,
    noBatchCallsAvailable,
    batchCallsLoaded,
    dashboardData,
    loadingDashboardData,
    loadDashboardData
  } = useCallsContext();
  
  // Cargar números de teléfono y batch calls una sola vez al iniciar la aplicación
  React.useEffect(() => {
    // Solo cargamos si tenemos la API key
    if (apiKey) {
      console.log('API key disponible, cargando números de teléfono y batch calls');
      loadPhoneNumbers();
      loadBatchCalls();
      loadDashboardData();
    }
  }, [apiKey, loadPhoneNumbers, loadBatchCalls, loadDashboardData]);
  
  // Calculamos si la caché está activa
  const cacheStatus = lastUpdated 
    ? `Caché activa (${new Date(lastUpdated).toLocaleTimeString()})` 
    : 'Sin datos en caché';

  const loadCalls = React.useCallback(async () => {
    // Preferimos usar los datos de contexto en lugar de hacer nuevas peticiones
    if (allCalls.length > 0) {
      console.log('Usando datos del contexto compartido');
      setCalls(allCalls);
      setFilteredCalls(allCalls);
      setStats(calculateStats(allCalls));
      setDisconnectionReasons(contextDisconnectionReasons);
      return;
    }
    
    // Si no hay datos en el contexto, cargamos datos a través del contexto
    if (!loadingAllCalls) {
      console.log('Iniciando carga de datos desde el contexto');
      loadAllCalls();
    }
    
    // El código original para cargar llamadas queda como respaldo
    if (!apiKey) {
      setError('API key no configurada. Añade ?apikey=TU_API_KEY a la URL.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetchCalls(apiKey);
      const callsData = response.calls; // Extraemos el array de llamadas
      setCalls(callsData);
      setFilteredCalls(callsData);
      setStats(calculateStats(callsData));

      // Extract unique disconnection reasons
      const allReasons = [...new Set(
        callsData
          .map(call => call.disconnection_reason)
          .filter((reason): reason is string => Boolean(reason))
      )].sort();
      
      setDisconnectionReasons(allReasons);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error loading calls:', err);
    } finally {
      setLoading(false);
    }
  }, [apiKey, allCalls, contextDisconnectionReasons, loadAllCalls, loadingAllCalls]);

  const loadAllCallsFromApi = React.useCallback(async () => {
    // Usamos la función de cargar todas las llamadas del contexto en lugar de hacer peticiones duplicadas
    loadAllCalls(true);
  }, [loadAllCalls]);

  React.useEffect(() => {
    loadCalls();
  }, [loadCalls]);

  // Cuando los datos del contexto cambien, actualizamos nuestro estado local
  React.useEffect(() => {
    if (allCalls && allCalls.length > 0) {
      // Asegurarnos de que estamos trabajando con un array
      const callsArray = Array.isArray(allCalls) ? allCalls : [];
      setCalls(callsArray);
      setFilteredCalls(callsArray);
      setStats(calculateStats(callsArray));
      
      // Si contextDisconnectionReasons es un array, usarlo directamente
      if (Array.isArray(contextDisconnectionReasons)) {
        setDisconnectionReasons(contextDisconnectionReasons);
      }
    }
  }, [allCalls, contextDisconnectionReasons]);

  const handleFilterChange = React.useCallback((newCriteria: FilterCriteria) => {
    setFilterCriteria(newCriteria);
    
    let result = [...calls];
    
    // Filter by disconnection reason
    if (newCriteria.disconnection_reason) {
      result = result.filter(call => 
        call.disconnection_reason === newCriteria.disconnection_reason
      );
    }
    
    // Filter by duration range
    if (newCriteria.duration_range) {
      if (newCriteria.duration_range.min !== undefined) {
        result = result.filter(call => 
          (call.duration || 0) >= (newCriteria.duration_range?.min || 0)
        );
      }
      if (newCriteria.duration_range.max !== undefined) {
        result = result.filter(call => 
          (call.duration || 0) <= (newCriteria.duration_range?.max || Infinity)
        );
      }
    }
    
    // Filter by date range
    if (newCriteria.date_range) {
      if (newCriteria.date_range.start) {
        const startDate = new Date(newCriteria.date_range.start);
        result = result.filter(call => 
          call.start_time ? new Date(call.start_time) >= startDate : false
        );
      }
      if (newCriteria.date_range.end) {
        const endDate = new Date(newCriteria.date_range.end);
        result = result.filter(call => 
          call.start_time ? new Date(call.start_time) <= endDate : false
        );
      }
    }
    
    setFilteredCalls(result);
  }, [calls]);

  // Función adaptadora para Dashboard que espera (key, value)
  const handleFilterChangeForDashboard = React.useCallback((key: keyof FilterCriteria, value: any) => {
    const newCriteria = { ...filterCriteria, [key]: value };
    handleFilterChange(newCriteria);
  }, [filterCriteria, handleFilterChange]);

  // Componente para crear nuevas campañas de llamadas en lote
  interface CreateBatchCallFormProps {
    apiKey: string | null;
    onSuccess?: () => void;
    phoneNumbers: RetellPhoneNumber[];
    loadingPhones: boolean;
    noPhoneNumbersAvailable: boolean;
  }

  function CreateBatchCallForm({ apiKey, onSuccess, phoneNumbers, loadingPhones, noPhoneNumbersAvailable }: CreateBatchCallFormProps) {
    const [fromNumber, setFromNumber] = useState('');
    const [campaignName, setCampaignName] = useState('');
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [variables, setVariables] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [previewData, setPreviewData] = useState<string[][]>([]);
    const [phoneColumnIndex, setPhoneColumnIndex] = useState<number>(-1);
    const [columnMappings, setColumnMappings] = useState<{[key: string]: number}>({});
    const [useManualNumber, setUseManualNumber] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Seleccionar el primer número por defecto cuando los números de teléfono se cargan
    React.useEffect(() => {
      if (phoneNumbers.length > 0 && !fromNumber && !useManualNumber) {
        setFromNumber(phoneNumbers[0].phone_number);
      }
    }, [phoneNumbers, fromNumber, useManualNumber]);
    
    // Si no hay números disponibles, activar modo manual directamente
    React.useEffect(() => {
      if ((noPhoneNumbersAvailable || (phoneNumbersLoaded && phoneNumbers.length === 0)) && !useManualNumber) {
        console.log('No hay números de teléfono disponibles, activando modo manual');
        setUseManualNumber(true);
      }
    }, [phoneNumbers, phoneNumbersLoaded, noPhoneNumbersAvailable, useManualNumber]);
    
    // Función para manejar la selección de archivo CSV
    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      setCsvFile(file);
      setError(null);
      
      // Leer el archivo para previsualización
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const lines = content.split('\n').filter(line => line.trim() !== '');
          
          if (lines.length === 0) {
            setError('El archivo CSV está vacío');
            return;
          }
          
          // Analizar CSV (suponiendo que está separado por comas)
          const parsedData = lines.map(line => {
            return line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''));
          });
          
          setPreviewData(parsedData);
          
          // Detectar automáticamente la columna del número de teléfono
          const headers = parsedData[0];
          const phoneColIndex = headers.findIndex(header => 
            header.toLowerCase().includes('phone') || 
            header.toLowerCase().includes('teléfono') || 
            header.toLowerCase().includes('telefono') ||
            header.toLowerCase().includes('móvil') ||
            header.toLowerCase().includes('movil') ||
            header.toLowerCase().includes('celular') ||
            header.toLowerCase().includes('número') ||
            header.toLowerCase().includes('numero')
          );
          
          if (phoneColIndex !== -1) {
            setPhoneColumnIndex(phoneColIndex);
          }
          
          // Detectar posibles variables dinámicas (usando encabezados)
          if (parsedData.length > 0) {
            const detectedVars = parsedData[0].filter(header => 
              header.toLowerCase() !== 'phone' && 
              header.toLowerCase() !== 'teléfono' &&
              header.toLowerCase() !== 'telefono' &&
              header.toLowerCase() !== 'número' && 
              header.toLowerCase() !== 'numero' &&
              header.toLowerCase() !== 'móvil' && 
              header.toLowerCase() !== 'movil' &&
              header.toLowerCase() !== 'celular' &&
              header.trim() !== ''
            );
            
            setVariables(detectedVars);
            
            // Crear mapeo inicial de columnas
            const initialMappings: {[key: string]: number} = {};
            detectedVars.forEach(varName => {
              const colIndex = parsedData[0].findIndex(h => h === varName);
              if (colIndex !== -1) {
                initialMappings[varName] = colIndex;
              }
            });
            
            setColumnMappings(initialMappings);
          }
        } catch (err) {
          console.error('Error al procesar el CSV:', err);
          setError('Error al procesar el archivo CSV');
        }
      };
      
      reader.onerror = () => {
        setError('Error al leer el archivo CSV');
      };
      
      reader.readAsText(file);
    };
    
    // Función para manejar el cambio de la columna de teléfono
    const handlePhoneColumnChange = (index: number) => {
      setPhoneColumnIndex(index);
    };
    
    // Función para manejar la creación de la campaña
    const handleCreateBatchCall = async () => {
      if (!apiKey) {
        setError('API key no configurada');
        return;
      }
      
      if (!fromNumber) {
        setError('El número de origen es obligatorio');
        return;
      }
      
      if (!csvFile) {
        setError('Debes cargar un archivo CSV');
        return;
      }
      
      if (phoneColumnIndex === -1) {
        setError('Debes seleccionar la columna que contiene los números de teléfono');
        return;
      }
      
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      try {
        // Preparar las tareas para la API
        // Omitir la primera fila (encabezados)
        const tasks = previewData.slice(1).map(row => {
          let phoneNumber = row[phoneColumnIndex];
          if (!phoneNumber) return null;
          
          // Verificar si el número de teléfono comienza con "+" y añadirlo si no lo tiene
          phoneNumber = phoneNumber.trim();
          if (!phoneNumber.startsWith('+')) {
            phoneNumber = '+' + phoneNumber;
          }
          
          const task: {
            to_number: string;
            retell_llm_dynamic_variables?: Record<string, string>;
          } = {
            to_number: phoneNumber
          };
          
          // Añadir variables dinámicas si hay mapeos definidos
          if (Object.keys(columnMappings).length > 0) {
            const vars: Record<string, string> = {};
            
            Object.entries(columnMappings).forEach(([varName, colIndex]) => {
              if (colIndex >= 0 && colIndex < row.length) {
                vars[varName] = row[colIndex];
              }
            });
            
            if (Object.keys(vars).length > 0) {
              task.retell_llm_dynamic_variables = vars;
            }
          }
          
          return task;
        }).filter(Boolean) as { to_number: string; retell_llm_dynamic_variables?: Record<string, string> }[];
        
        if (tasks.length === 0) {
          throw new Error('No se encontraron números de teléfono válidos en el CSV');
        }
        
        // Enviar la solicitud a la API con el nombre de la campaña
        const result = await createBatchCall(apiKey, fromNumber, tasks, campaignName);
        
        setSuccess(`Campaña creada con éxito. ID: ${result.batch_call_id || 'N/A'}`);
        
        // Limpiar el formulario
        setFromNumber('');
        setCampaignName('');
        setCsvFile(null);
        setPreviewData([]);
        setPhoneColumnIndex(-1);
        setColumnMappings({});
        setVariables([]);
        
        // Resetear el input de archivo
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        
        // Notificar éxito al componente padre
        if (onSuccess) {
          onSuccess();
        }
      } catch (err) {
        console.error('Error al crear la campaña:', err);
        setError(err instanceof Error ? err.message : 'Error al crear la campaña');
      } finally {
        setLoading(false);
      }
    };
    
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-gray-400 mb-1">Nombre de la campaña *</label>
            <div className="flex">
              <div className="relative flex-grow">
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="Mi Campaña"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                  required
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">Nombre identificativo para la campaña de llamadas</p>
          </div>
          <div>
            <label className="block text-gray-400 mb-1">Número de origen *</label>
            <div className="flex">
              <div className="relative flex-grow">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
                {loadingPhones ? (
                  <div className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 flex items-center">
                    <RefreshCw className="animate-spin w-4 h-4 mr-2" />
                    Cargando números...
                  </div>
                ) : phoneNumbers.length > 0 && !useManualNumber ? (
                  <div className="relative w-full">
                    <select
                      value={fromNumber}
                      onChange={(e) => setFromNumber(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white appearance-none"
                      required
                    >
                      <option value="" disabled>Selecciona un número</option>
                      {phoneNumbers.map((phone) => (
                        <option key={phone.phone_number} value={phone.phone_number}>
                          {phone.phone_number} - {phone.nickname || 'Sin nombre'}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-2 top-2">
                      <button
                        type="button"
                        onClick={() => setUseManualNumber(true)}
                        className="text-xs text-purple-400 hover:text-purple-300"
                        title="Introducir número manualmente"
                      >
                        Manual
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="relative w-full">
                    <input
                      type="text"
                      value={fromNumber}
                      onChange={(e) => setFromNumber(e.target.value)}
                      placeholder="+34960461158"
                      className={`w-full pl-10 pr-4 py-2 bg-gray-800 border ${noPhoneNumbersAvailable ? 'border-yellow-700' : 'border-gray-700'} rounded-lg text-white`}
                      required
                    />
                    {phoneNumbers.length > 0 && (
                      <div className="absolute right-2 top-2">
                        <button
                          type="button"
                          onClick={() => setUseManualNumber(false)}
                          className="text-xs text-purple-400 hover:text-purple-300"
                          title="Usar números disponibles"
                        >
                          Usar lista
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {noPhoneNumbersAvailable || (phoneNumbersLoaded && phoneNumbers.length === 0) ? (
                <span className="text-yellow-500">
                  Esta API key no tiene números de teléfono asociados. Debes introducir un número manualmente.
                </span>
              ) : (
                "Número desde el que se realizarán las llamadas"
              )}
            </p>
          </div>
          
          <div>
            <label className="block text-gray-400 mb-1">Archivo CSV con números *</label>
            <div className="flex items-center">
              <label className="flex-grow cursor-pointer">
                <div className="relative">
                  <div className={`w-full px-4 py-2 border ${csvFile ? 'border-purple-600 bg-gray-800' : 'border-gray-700 bg-gray-800'} rounded-lg flex items-center`}>
                    <Upload className="w-5 h-5 text-gray-400 mr-2" />
                    <span className="text-gray-300 truncate">
                      {csvFile ? csvFile.name : 'Seleccionar archivo CSV...'}
                    </span>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-1">El archivo debe tener una columna con números de teléfono</p>
          </div>
        </div>
        
        {/* Previsualización del CSV y mapeo de columnas */}
        {previewData.length > 0 && (
          <div className="mt-5 space-y-4">
            <div>
              <h4 className="text-white font-medium mb-1">Previsualización de datos</h4>
              <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-700">
                  <thead>
                    <tr>
                      {previewData[0].map((header, index) => (
                        <th 
                          key={index}
                          className={`px-3 py-2 text-left text-xs font-medium ${
                            index === phoneColumnIndex 
                              ? 'text-purple-400 border-b-2 border-purple-400' 
                              : 'text-gray-400'
                          }`}
                        >
                          <div className="flex items-center space-x-1">
                            <span>{header}</span>
                            <button
                              onClick={() => handlePhoneColumnChange(index)}
                              title={index === phoneColumnIndex 
                                ? "Columna seleccionada para números de teléfono" 
                                : "Usar como columna de números de teléfono"}
                              className={`p-1 rounded-full ${
                                index === phoneColumnIndex 
                                  ? 'bg-purple-700/30 text-purple-300' 
                                  : 'hover:bg-gray-700 text-gray-500'
                              }`}
                            >
                              <Phone className="w-3 h-3" />
                            </button>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700 bg-gray-800">
                    {previewData.slice(1, 5).map((row, rowIndex) => (
                      <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-gray-800' : 'bg-gray-850'}>
                        {row.map((cell, cellIndex) => (
                          <td 
                            key={cellIndex} 
                            className={`px-3 py-2 text-xs ${
                              cellIndex === phoneColumnIndex 
                                ? 'text-purple-300' 
                                : 'text-gray-300'
                            }`}
                          >
                            {cell || <span className="text-gray-500">-</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previewData.length > 5 && (
                  <div className="text-center py-2 text-xs text-gray-500">
                    Mostrando 4 de {previewData.length - 1} filas
                  </div>
                )}
              </div>
            </div>
            
            {/* Variables dinámicas */}
            {variables.length > 0 && (
              <div>
                <h4 className="text-white font-medium mb-1">Variables dinámicas detectadas</h4>
                <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
                  <div className="text-xs text-gray-400 mb-2 flex items-center">
                    <Info className="w-4 h-4 mr-1" />
                    Estas variables se enviarán junto con cada número de teléfono
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {variables.map((variable, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <Check className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-white">{variable}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Mensajes de error y éxito */}
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
        
        {/* Botones de acción */}
        <div className="flex justify-end pt-3">
          <button
            onClick={() => {
              setCsvFile(null);
              setPreviewData([]);
              setPhoneColumnIndex(-1);
              setColumnMappings({});
              setVariables([]);
              if (fileInputRef.current) {
                fileInputRef.current.value = '';
              }
            }}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 mr-2"
            disabled={loading}
          >
            Limpiar
          </button>
          <button
            onClick={handleCreateBatchCall}
            disabled={loading || !fromNumber || !csvFile || phoneColumnIndex === -1 || !campaignName.trim()}
            className={`px-4 py-2 rounded-lg text-white flex items-center ${
              loading || !fromNumber || !csvFile || phoneColumnIndex === -1 || !campaignName.trim()
                ? 'bg-purple-700/50 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-700'
            }`}
          >
            {loading ? (
              <>
                <RefreshCw className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" />
                Procesando...
              </>
            ) : (
              <>
                <Phone className="h-4 w-4 mr-1" />
                Crear campaña
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Componente de página en blanco para Batch Call
  function BatchCall({ onNavigate }: { onNavigate: (page: string) => void }) {
    const [loading, setLoading] = React.useState<boolean>(false);
    const [error, setError] = React.useState<string | null>(null);
    const { 
      apiKey, 
      phoneNumbers, 
      loadingPhoneNumbers, 
      loadPhoneNumbers,
      batchCalls,
      loadingBatchCalls,
      loadBatchCalls,
      refreshBatchCalls,
      noBatchCallsAvailable,
      batchCallsLoaded
    } = useCallsContext();
    
    // Estado para el modal de tareas
    const [selectedBatch, setSelectedBatch] = React.useState<RetellBatchCall | null>(null);
    const [tasks, setTasks] = React.useState<BatchCallTask[]>([]);
    const [taskKeys, setTaskKeys] = React.useState<string[]>([]);
    const [loadingTasks, setLoadingTasks] = React.useState<boolean>(false);
    const [tasksError, setTasksError] = React.useState<string | null>(null);
    const [showTasksModal, setShowTasksModal] = React.useState<boolean>(false);
    
    // Estado para el modal de confirmación de eliminación
    const [deleteConfirmModalOpen, setDeleteConfirmModalOpen] = React.useState<boolean>(false);
    const [batchToDelete, setBatchToDelete] = React.useState<RetellBatchCall | null>(null);
    const [deletingBatch, setDeletingBatch] = React.useState<boolean>(false);
    const [deleteError, setDeleteError] = React.useState<string | null>(null);

    // Función para cargar las tareas de una batch call
    const loadBatchTasks = React.useCallback(async (batch: RetellBatchCall) => {
      setSelectedBatch(batch);
      setShowTasksModal(true);
      setLoadingTasks(true);
      setTasksError(null);
      
      try {
        const tasksData = await fetchBatchCallTasks(batch.tasks_url);
        setTasks(tasksData);
        
        // Calcular las claves una sola vez
        if (tasksData.length > 0) {
          const allKeys = Object.keys(
            tasksData.reduce((acc, task) => ({...acc, ...task}), {})
          );
          setTaskKeys(allKeys);
        } else {
          setTaskKeys([]);
        }
      } catch (err) {
        console.error('Error al cargar tareas:', err);
        setTasksError(err instanceof Error ? err.message : 'Error al cargar las tareas');
      } finally {
        setLoadingTasks(false);
      }
    }, []);
    
    // Función para iniciar la eliminación de un batch call
    const handleDeleteBatchClick = React.useCallback((batch: RetellBatchCall, event: React.MouseEvent) => {
      event.stopPropagation(); // Evitar que se abra el modal de tareas
      setBatchToDelete(batch);
      setDeleteConfirmModalOpen(true);
      setDeleteError(null);
    }, []);
    
    // Función para confirmar y ejecutar la eliminación
    const confirmDeleteBatch = React.useCallback(async () => {
      if (!apiKey || !batchToDelete) return;
      
      setDeletingBatch(true);
      setDeleteError(null);
      
      try {
        const response = await deleteBatchCall(apiKey, batchToDelete.batch_call_id);
        console.log('Respuesta de eliminación:', response);
        
        // Si llegamos aquí, la eliminación fue exitosa (incluso con 204)
        
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
        notification.textContent = 'Batch call eliminado correctamente';
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
        
        // Actualizar la lista después de eliminar usando el contexto
        refreshBatchCalls();
        
        // Cerrar el modal
        setDeleteConfirmModalOpen(false);
        setBatchToDelete(null);
      } catch (err) {
        console.error('Error al eliminar batch call:', err);
        setDeleteError(err instanceof Error ? err.message : 'Error al eliminar la campaña');
      } finally {
        setDeletingBatch(false);
      }
    }, [apiKey, batchToDelete, refreshBatchCalls]);
    
    // Función para cerrar el modal de confirmación
    const closeDeleteConfirmModal = React.useCallback(() => {
      setDeleteConfirmModalOpen(false);
      setBatchToDelete(null);
      setDeleteError(null);
    }, []);
    
    // Función para cerrar el modal de tareas
    const closeTasksModal = React.useCallback(() => {
      setShowTasksModal(false);
    }, []);

    // Función para formatear timestamp a fecha legible
    const formatDate = React.useCallback((timestamp: number) => {
      return new Date(timestamp).toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }, []);

    // Función para calcular el porcentaje
    const calculatePercentage = React.useCallback((value: number, total: number) => {
      if (total === 0) return 0;
      return Math.round((value / total) * 100);
    }, []);

    // Función auxiliar para renderizar diferentes tipos de valores de la tarea
    const renderTaskValue = React.useCallback((value: any): React.ReactNode => {
      if (value === undefined || value === null) {
        return <span className="text-gray-500">-</span>;
      }
      
      if (typeof value === 'boolean') {
        return value ? 'Sí' : 'No';
      }
      
      if (typeof value === 'number') {
        // Si parece un timestamp, formatear como fecha
        if (value > 1000000000000) { // Asumimos que es un timestamp en milisegundos
          return new Date(value).toLocaleString('es-ES');
        }
        return value.toString();
      }
      
      if (typeof value === 'string') {
        // Si es un string JSON, mostrarlo con formato
        if ((value.startsWith('{') && value.endsWith('}')) || 
            (value.startsWith('[') && value.endsWith(']'))) {
          try {
            const parsed = JSON.parse(value);
            return (
              <div className="max-w-xs overflow-hidden text-ellipsis">
                <pre className="text-xs text-gray-400 whitespace-pre-wrap">
                  {JSON.stringify(parsed, null, 2).substring(0, 50)}
                  {JSON.stringify(parsed).length > 50 ? '...' : ''}
                </pre>
              </div>
            );
          } catch (e) {
            // Si no se puede parsear, mostrar como string normal
            return value;
          }
        }
        return value;
      }
      
      if (typeof value === 'object') {
        if (Array.isArray(value)) {
          if (value.length === 0) return <span className="text-gray-500">[]</span>;
          return (
            <div className="max-w-xs overflow-hidden text-ellipsis">
              <pre className="text-xs text-gray-400 whitespace-pre-wrap">
                {JSON.stringify(value, null, 2).substring(0, 50)}
                {JSON.stringify(value).length > 50 ? '...' : ''}
              </pre>
            </div>
          );
        }
        
        return (
          <div className="max-w-xs overflow-hidden text-ellipsis">
            <pre className="text-xs text-gray-400 whitespace-pre-wrap">
              {JSON.stringify(value, null, 2).substring(0, 50)}
              {JSON.stringify(value).length > 50 ? '...' : ''}
            </pre>
          </div>
        );
      }
      
      return String(value);
    }, []);

    return (
      <div className="p-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">Llamadas en Lote</h2>
          <div className="flex flex-wrap items-center gap-2 text-gray-400">
            <p>Gestiona y visualiza campañas de llamadas programadas</p>
          </div>
        </div>

        {/* Formulario para crear nuevas campañas */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 shadow-lg mb-8">
          <div className="p-6 border-b border-gray-800">
            <h3 className="text-xl font-bold text-white">Crear Nueva Campaña</h3>
            <p className="text-sm text-gray-400 mt-1">Carga un archivo CSV con números de teléfono para crear una nueva campaña</p>
          </div>
          <div className="p-6">
            <CreateBatchCallForm 
              apiKey={apiKey} 
              onSuccess={refreshBatchCalls}
              phoneNumbers={phoneNumbers}
              loadingPhones={loadingPhoneNumbers}
              noPhoneNumbersAvailable={noPhoneNumbersAvailable}
            />
          </div>
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 shadow-lg">
          <div className="p-6 border-b border-gray-800">
            <h3 className="text-xl font-bold text-white">Campañas de Llamadas</h3>
            <p className="text-sm text-gray-400 mt-1">Listado de campañas de llamadas programadas y su estado actual</p>
          </div>
          <div className="p-6">
            {loadingBatchCalls ? (
              <div className="flex justify-center items-center py-12">
                <div className="flex items-center space-x-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-white">Cargando datos...</span>
                </div>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-red-500 mb-4">{error}</p>
                <button 
                  onClick={() => refreshBatchCalls()}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
                >
                  Reintentar
                </button>
              </div>
            ) : noBatchCallsAvailable && batchCallsLoaded ? (
              <div className="text-center py-12">
                <div className="flex flex-col items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600 mb-4">
                    <rect width="18" height="18" x="3" y="3" rx="2" />
                    <path d="M7 7h10" />
                    <path d="M7 12h10" />
                    <path d="M7 17h10" />
                  </svg>
                  <h3 className="text-xl font-medium text-gray-200 mb-2">No hay campañas disponibles</h3>
                  <p className="text-gray-400 mb-6 max-w-md text-center">
                    No se han encontrado campañas de batch calling para esta API key. Puedes crear una nueva campaña desde el formulario superior.
                  </p>
                </div>
              </div>
            ) : batchCalls.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400 mb-4">No hay campañas de llamadas programadas.</p>
                <button 
                  onClick={() => onNavigate('phones')}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
                >
                  Ir a Números de Teléfono
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b border-gray-800">
                      <th className="p-3 text-sm font-medium text-gray-400">Nombre</th>
                      <th className="p-3 text-sm font-medium text-gray-400">Estado</th>
                      <th className="p-3 text-sm font-medium text-gray-400">Número</th>
                      <th className="p-3 text-sm font-medium text-gray-400">Programación</th>
                      <th className="p-3 text-sm font-medium text-gray-400">Total</th>
                      <th className="p-3 text-sm font-medium text-gray-400">Enviadas</th>
                      <th className="p-3 text-sm font-medium text-gray-400">Contestadas</th>
                      <th className="p-3 text-sm font-medium text-gray-400">Completadas</th>
                      <th className="p-3 text-sm font-medium text-gray-400">Último envío</th>
                      <th className="p-3 text-sm font-medium text-gray-400">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchCalls.map((batch) => (
                      <tr 
                        key={batch.batch_call_id} 
                        className="border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer"
                        onClick={() => loadBatchTasks(batch)}
                      >
                        <td className="p-3 text-white font-medium">{batch.name}</td>
                        <td className="p-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            batch.status === 'sent' ? 'bg-green-100 text-green-800' : 
                            batch.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {batch.status === 'sent' ? 'Enviada' : 
                             batch.status === 'pending' ? 'Pendiente' : batch.status}
                          </span>
                        </td>
                        <td className="p-3 text-gray-300">{batch.from_number}</td>
                        <td className="p-3 text-gray-300">{formatDate(batch.scheduled_timestamp)}</td>
                        <td className="p-3 text-gray-300">{batch.total.toLocaleString()}</td>
                        <td className="p-3">
                          <div className="flex items-center">
                            <span className="text-gray-300 mr-2">{batch.sent.toLocaleString()}</span>
                            <div className="w-16 bg-gray-700 rounded-full h-2">
                              <div 
                                className="bg-blue-500 h-2 rounded-full" 
                                style={{ width: `${calculatePercentage(batch.sent, batch.total)}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center">
                            <span className="text-gray-300 mr-2">{batch.picked_up.toLocaleString()}</span>
                            <div className="w-16 bg-gray-700 rounded-full h-2">
                              <div 
                                className="bg-green-500 h-2 rounded-full" 
                                style={{ width: `${calculatePercentage(batch.picked_up, batch.total)}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center">
                            <span className="text-gray-300 mr-2">{batch.completed.toLocaleString()}</span>
                            <div className="w-16 bg-gray-700 rounded-full h-2">
                              <div 
                                className="bg-purple-500 h-2 rounded-full" 
                                style={{ width: `${calculatePercentage(batch.completed, batch.total)}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-gray-300">{formatDate(batch.last_sent_timestamp)}</td>
                        <td className="p-3">
                          <button 
                            onClick={(e) => handleDeleteBatchClick(batch, e)}
                            className="p-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg transition-colors"
                            title="Eliminar campaña"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        
        {/* Modal para mostrar las tareas */}
        {showTasksModal && selectedBatch && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="p-4 border-b border-gray-800 flex justify-between items-center sticky top-0 bg-gray-900">
                <div>
                  <h2 className="text-xl font-bold text-white">{selectedBatch.name}</h2>
                  <p className="text-sm text-gray-400">Campaña: {selectedBatch.batch_call_id}</p>
                </div>
                <button 
                  onClick={closeTasksModal}
                  className="p-1 hover:bg-gray-800 rounded-full"
                >
                  <X className="w-6 h-6 text-gray-400 hover:text-white" />
                </button>
              </div>
              
              <div className="overflow-y-auto p-4 flex-grow">
                {loadingTasks ? (
                  <div className="flex justify-center items-center py-12">
                    <div className="flex items-center space-x-2">
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="text-white">Cargando tareas...</span>
                    </div>
                  </div>
                ) : tasksError ? (
                  <div className="text-center py-12">
                    <p className="text-red-500 mb-4">{tasksError}</p>
                    <button 
                      onClick={() => loadBatchTasks(selectedBatch!)}
                      className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
                    >
                      Reintentar
                    </button>
                  </div>
                ) : tasks.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-400">No hay tareas disponibles para esta campaña.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h3 className="text-lg font-medium text-white">Lista de Tareas</h3>
                        <p className="text-sm text-gray-400">{tasks.length} tareas en total</p>
                      </div>
                    </div>
                    
                    <table className="w-full">
                      <thead>
                        <tr className="text-left border-b border-gray-800">
                          {/* Usar las claves pre-calculadas para los encabezados */}
                          {taskKeys.map(key => (
                            <th key={key} className="p-3 text-sm font-medium text-gray-400">
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tasks.map((task, index) => (
                          <tr key={task.id || index} className="border-b border-gray-800 hover:bg-gray-800/50">
                            {/* Usar las claves pre-calculadas para las celdas */}
                            {taskKeys.map(key => (
                              <td key={`${index}-${key}`} className="p-3 text-gray-300">
                                {renderTaskValue(task[key])}
                              </td>
                            ))}
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
        
        {/* Modal de confirmación para eliminar campaña */}
        {deleteConfirmModalOpen && batchToDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-md overflow-hidden">
              <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                <div className="flex items-center">
                  <AlertTriangle className="text-yellow-500 mr-2" size={20} />
                  <h3 className="text-lg font-bold text-white">Confirmar eliminación</h3>
                </div>
                <button 
                  onClick={closeDeleteConfirmModal}
                  className="p-1 hover:bg-gray-800 rounded-full"
                  disabled={deletingBatch}
                >
                  <X className="w-5 h-5 text-gray-400 hover:text-white" />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                <p className="text-gray-300">
                  ¿Estás seguro de que quieres eliminar la campaña <span className="font-bold text-white">{batchToDelete.name}</span>?
                </p>
                <p className="text-gray-400 text-sm">
                  Esta acción no se puede deshacer y eliminará permanentemente esta campaña y todos sus datos asociados.
                </p>
                
                {deleteError && (
                  <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-300 text-sm">
                    {deleteError}
                  </div>
                )}
                
                <div className="flex justify-end space-x-3 pt-2">
                  <button
                    onClick={closeDeleteConfirmModal}
                    className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700"
                    disabled={deletingBatch}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmDeleteBatch}
                    disabled={deletingBatch}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center"
                  >
                    {deletingBatch ? (
                      <>
                        <RefreshCw className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" />
                        Eliminando...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4 mr-1" />
                        Eliminar
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <Sidebar 
        currentPage={currentPage} 
        onPageChange={setCurrentPage} 
        cacheStatus={cacheStatus}
        isLoading={loading || loadingAllCalls}
      />

      <div className="md:ml-64 p-4 md:p-8 transition-all">
        {currentPage === 'dashboard' && stats && (
          <Dashboard
            stats={stats}
            loading={loading || loadingAllCalls || loadingDashboardData}
            error={error}
            onReload={loadCalls}
            filterCriteria={filterCriteria}
            onFilterChange={handleFilterChangeForDashboard}
            disconnectionReasons={disconnectionReasons}
            totalCalls={calls.length}
            filteredCallsCount={filteredCalls.length}
            dashboardData={dashboardData}
            loadDashboardData={loadDashboardData}
          />
        )}
        {currentPage === 'recordings' && (
          <Recordings 
            onNavigate={setCurrentPage as (page: 'dashboard' | 'recordings') => void}
          />
        )}
        {currentPage === 'phones' && (
          <PhoneNumbers
            onNavigate={setCurrentPage as (page: 'dashboard' | 'recordings' | 'phones') => void}
          />
        )}
        {currentPage === 'agendas' && (
          <Agendas
            onNavigate={setCurrentPage as (page: string) => void}
          />
        )}
        {currentPage === 'batch-call' && (
          <BatchCall onNavigate={setCurrentPage as (page: string) => void} />
        )}
      </div>
    </div>
  );
}

export default DashboardApp;