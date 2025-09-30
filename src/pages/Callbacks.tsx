import { useState, useEffect } from 'react';
import { fetchAllCallbacks } from '../api';
import { Callback } from '../types';
import { useCallsContext } from '../context/CallsContext';
import { 
  Phone, 
  Calendar, 
  MapPin, 
  User, 
  Building, 
  Search, 
  RefreshCw, 
  AlertCircle, 
  Clock,
  CheckCircle,
  Download
} from 'lucide-react';

interface CallbacksProps {
  onNavigate: (page: string) => void;
}

export function Callbacks({}: CallbacksProps) {
  const { clientId } = useCallsContext();
  const [callbacks, setCallbacks] = useState<Callback[]>([]);
  const [filteredCallbacks, setFilteredCallbacks] = useState<Callback[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  // Cargar callbacks
  const loadCallbacks = async () => {
    if (!clientId) {
      setError('Client ID no disponible');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Cargando callbacks para client_id:', clientId);
      
      const callbacksData = await fetchAllCallbacks(clientId);
      
      // Asegurar que siempre trabajamos con un array
      const validCallbacks = Array.isArray(callbacksData) ? callbacksData : [];
      console.log('Callbacks válidos recibidos:', validCallbacks);
      
      setCallbacks(validCallbacks);
      setFilteredCallbacks(validCallbacks);
    } catch (err) {
      console.error('Error al cargar callbacks:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar callbacks');
      // En caso de error, asegurar que tenemos arrays vacíos
      setCallbacks([]);
      setFilteredCallbacks([]);
    } finally {
      setLoading(false);
    }
  };

  // Cargar callbacks al montar el componente
  useEffect(() => {
    loadCallbacks();
  }, [clientId]);

  // Filtrar callbacks
  useEffect(() => {
    // Asegurar que callbacks sea un array antes de filtrarlo
    const validCallbacks = Array.isArray(callbacks) ? callbacks : [];
    let filtered = [...validCallbacks];

    // Filtrar por búsqueda
    if (searchTerm) {
      filtered = filtered.filter(callback =>
        callback.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        callback.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        callback.phone_number?.includes(searchTerm) ||
        callback.direccion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        callback.ciudad?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        callback.region?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtrar por estado (Llamado/Pendiente/Programado)
    if (statusFilter !== 'all') {
      if (statusFilter === 'llamado') {
        filtered = filtered.filter(callback => callback.Llamado);
      } else if (statusFilter === 'pendiente') {
        filtered = filtered.filter(callback => isCallbackPending(callback));
      } else if (statusFilter === 'programado') {
        filtered = filtered.filter(callback => {
          // No llamado y no pendiente = programado
          return !callback.Llamado && !isCallbackPending(callback);
        });
      }
    }

    setFilteredCallbacks(filtered);
    setCurrentPage(1); // Reset a primera página cuando cambian los filtros
  }, [callbacks, searchTerm, statusFilter]);

  // Paginación
  const totalPages = Math.ceil(filteredCallbacks.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentCallbacks = filteredCallbacks.slice(startIndex, startIndex + itemsPerPage);

  // Formatear fecha
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  // Función auxiliar para determinar si un callback está pendiente
  const isCallbackPending = (callback: Callback) => {
    // Si ya fue llamado, no es pendiente
    if (callback.Llamado) {
      console.log(`Callback ${callback.id} ya fue llamado, no es pendiente`);
      return false;
    }
    
    // Si no tiene fecha programada, considerarlo pendiente
    if (!callback.date_to_call) {
      console.log(`Callback ${callback.id} no tiene fecha programada, es pendiente`);
      return true;
    }
    
    // Un callback es pendiente cuando la fecha actual es SUPERIOR (posterior) a date_to_call
    // Es decir, cuando ya debería haberse llamado
    const now = new Date();
    const fechaProgramada = new Date(callback.date_to_call);
    
    // Verificar si la fecha se parseó correctamente
    if (isNaN(fechaProgramada.getTime())) {
      console.log(`Callback ${callback.id}: Fecha inválida - ${callback.date_to_call}`);
      return true; // Si la fecha es inválida, considerarlo pendiente
    }
    
    const isPending = now > fechaProgramada;
    
    console.log(`Callback ${callback.id}:`, {
      date_to_call: callback.date_to_call,
      fechaProgramada: fechaProgramada.toISOString(),
      now: now.toISOString(),
      isPending,
      Llamado: callback.Llamado,
      diferenciaDias: Math.floor((now.getTime() - fechaProgramada.getTime()) / (1000 * 60 * 60 * 24))
    });
    
    return isPending;
  };

  // Exportar callbacks a CSV
  const handleExportCSV = () => {
    if (filteredCallbacks.length === 0) {
      setError('No hay callbacks para exportar');
      return;
    }

    // Crear headers
    const headers = [
      'ID',
      'Nombre',
      'Apellido',
      'Teléfono',
      'Dirección',
      'Local',
      'Ciudad',
      'Región',
      'Código Postal',
      'Fecha de Creación',
      'Fecha a Llamar',
      'Call ID',
      'Llamado'
    ];

    // Crear filas de datos
    const rows = filteredCallbacks.map(callback => [
      callback.id,
      callback.nombre || '',
      callback.last_name || '',
      callback.phone_number || '',
      callback.direccion || '',
      callback.local || '',
      callback.ciudad || '',
      callback.region || '',
      callback.codigo_postal || '',
      formatDate(callback.created_at),
      formatDate(callback.date_to_call),
      callback.call_id || '',
      callback.Llamado ? 'Sí' : 'No'
    ]);

    // Convertir a CSV
    let csvContent = headers.join(',') + '\n';
    rows.forEach(row => {
      const values = row.map(value => {
        // Escapar comillas y valores que contengan comas
        const stringValue = String(value).replace(/"/g, '""');
        return stringValue.includes(',') ? `"${stringValue}"` : stringValue;
      });
      csvContent += values.join(',') + '\n';
    });

    // Crear un blob y descargar
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `callbacks_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Mostrar todos los callbacks con sus fechas para análisis
  console.log('=== TODOS LOS CALLBACKS ===');
  callbacks.forEach(callback => {
    console.log(`ID: ${callback.id}, Llamado: ${callback.Llamado}, date_to_call: ${callback.date_to_call}`);
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-indigo-800 mb-2">Callbacks</h1>
            <p className="text-slate-600">
              Gestiona las llamadas de callback programadas
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCSV}
              disabled={loading || filteredCallbacks.length === 0}
              className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-700 hover:from-emerald-600 hover:to-teal-700 disabled:from-slate-400 disabled:to-slate-500 px-4 py-2 rounded-lg transition-all duration-200 text-white shadow-lg hover:shadow-xl"
            >
              <Download className="w-4 h-4" />
              Exportar CSV
            </button>
            <button
              onClick={loadCallbacks}
              disabled={loading}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-indigo-600 hover:to-purple-700 disabled:from-slate-400 disabled:to-slate-500 px-4 py-2 rounded-lg transition-all duration-200 text-white shadow-lg hover:shadow-xl"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>
        </div>


        {/* Información de la lista */}
        <div className="mb-6">
          <p className="text-slate-600">
            {filteredCallbacks.length} de {callbacks.length} callbacks
            {(searchTerm || statusFilter !== 'all') && (
              <span className="text-blue-600 ml-2 font-medium">(filtrados)</span>
            )}
          </p>
          
          {/* Mostrar filtros activos */}
          {(searchTerm || statusFilter !== 'all') && (
            <div className="flex flex-wrap gap-2 mt-2">
              {searchTerm && (
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full border border-blue-200">
                  Búsqueda: "{searchTerm}"
                </span>
              )}
              {statusFilter !== 'all' && (
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full border border-blue-200">
                  Estado: {
                    statusFilter === 'llamado' ? 'Llamados' : 
                    statusFilter === 'pendiente' ? 'Pendientes' : 
                    'Programados'
                  }
                </span>
              )}
            </div>
          )}
        </div>

        {/* Filtros y búsqueda */}
        <div className="bg-white rounded-lg p-6 mb-6 shadow-lg border border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Búsqueda */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar por nombre, teléfono, dirección..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Filtro por estado */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
              >
                <option value="all">Todos los estados</option>
                <option value="llamado">Llamados</option>
                <option value="pendiente">Pendientes</option>
                <option value="programado">Programados</option>
              </select>
            </div>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="animate-spin w-8 h-8 text-blue-600 mr-3" />
            <span className="text-slate-600">Cargando callbacks...</span>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
              <span className="text-red-700">{error}</span>
            </div>
          </div>
        )}

        {/* Callbacks list */}
        {!loading && !error && (
          <div>
            {currentCallbacks.length === 0 ? (
              <div className="text-center py-12">
                <Phone className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-600 mb-2">
                  {callbacks.length === 0 ? 'No hay callbacks' : 'No se encontraron callbacks'}
                </h3>
                <p className="text-slate-500">
                  {callbacks.length === 0 
                    ? 'Aún no tienes callbacks registrados.'
                    : 'Intenta ajustar los filtros de búsqueda.'
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {currentCallbacks.map((callback) => (
                  <div
                    key={callback.id}
                    className="bg-white rounded-lg p-6 hover:bg-slate-50 transition-colors shadow-lg border border-slate-200"
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Información principal */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <User className="w-5 h-5 text-blue-600" />
                            <h3 className="text-lg font-semibold text-slate-800">
                              {callback.nombre} {callback.last_name}
                            </h3>
                          </div>
                          <div className="flex items-center space-x-2">
                            {callback.Llamado ? (
                              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full border border-green-200 flex items-center">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Llamado
                              </span>
                            ) : isCallbackPending(callback) ? (
                              <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full border border-orange-200 flex items-center">
                                <Clock className="w-3 h-3 mr-1" />
                                Pendiente
                              </span>
                            ) : (
                              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full border border-blue-200 flex items-center">
                                <Clock className="w-3 h-3 mr-1" />
                                Programado
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 text-slate-600">
                          <Phone className="w-4 h-4" />
                          <span>{callback.phone_number}</span>
                        </div>

                        <div className="flex items-center space-x-2 text-slate-600">
                          <Calendar className="w-4 h-4" />
                          <span>Fecha a llamar: {formatDate(callback.date_to_call)}</span>
                        </div>

                        <div className="flex items-center space-x-2 text-slate-600">
                          <Clock className="w-4 h-4" />
                          <span>Creado: {formatDate(callback.created_at)}</span>
                        </div>
                      </div>

                      {/* Información de ubicación */}
                      <div className="space-y-3">
                        <div className="flex items-start space-x-2 text-slate-600">
                          <MapPin className="w-4 h-4 mt-1" />
                          <div className="space-y-1">
                            <div>{callback.direccion}</div>
                            {callback.local && (
                              <div className="flex items-center space-x-2">
                                <Building className="w-3 h-3" />
                                <span className="text-sm">{callback.local}</span>
                              </div>
                            )}
                            <div className="text-sm">
                              {callback.ciudad}
                              {callback.region && `, ${callback.region}`}
                              {callback.codigo_postal && ` - ${callback.codigo_postal}`}
                            </div>
                          </div>
                        </div>

                        {callback.call_id && (
                          <div className="text-xs text-slate-500">
                            Call ID: {callback.call_id}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-8">
                <div className="text-sm text-slate-600">
                  Mostrando {startIndex + 1} a {Math.min(startIndex + itemsPerPage, filteredCallbacks.length)} de {filteredCallbacks.length} callbacks
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 bg-slate-200 text-slate-600 rounded disabled:opacity-50 hover:bg-slate-300 transition-colors"
                  >
                    Anterior
                  </button>
                  
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-1 rounded transition-colors ${
                          currentPage === pageNum
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-700 text-white'
                            : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 bg-slate-200 text-slate-600 rounded disabled:opacity-50 hover:bg-slate-300 transition-colors"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
