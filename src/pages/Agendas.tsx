import React, { useState, useEffect } from 'react';
import { fetchAgendas } from '../api';
import { Agenda } from '../types';
import { useCallsContext } from '../context/CallsContext';
import { Calendar, Clock, MapPin, Phone, User, Building, Search, Filter, RefreshCw, AlertCircle, X, List, CalendarDays } from 'lucide-react';

interface AgendasProps {
  onNavigate: (page: string) => void;
}

export function Agendas({ onNavigate }: AgendasProps) {
  const { clientId } = useCallsContext();
  const [agendas, setAgendas] = useState<Agenda[]>([]);
  const [filteredAgendas, setFilteredAgendas] = useState<Agenda[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'list' | 'calendar'>('list');
  const itemsPerPage = 10;

  // Cargar agendas
  const loadAgendas = async () => {
    if (!clientId) {
      setError('Client ID no disponible');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Cargando agendas para client_id:', clientId);
      const agendasData = await fetchAgendas(clientId);
      
      // Asegurar que siempre trabajamos con un array
      const validAgendas = Array.isArray(agendasData) ? agendasData : [];
      console.log('Agendas válidas recibidas:', validAgendas);
      
      setAgendas(validAgendas);
      setFilteredAgendas(validAgendas);
    } catch (err) {
      console.error('Error al cargar agendas:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar agendas');
      // En caso de error, asegurar que tenemos arrays vacíos
      setAgendas([]);
      setFilteredAgendas([]);
    } finally {
      setLoading(false);
    }
  };

  // Cargar agendas al montar el componente
  useEffect(() => {
    loadAgendas();
  }, [clientId]);

  // Filtrar agendas
  useEffect(() => {
    // Asegurar que agendas sea un array antes de filtrarlo
    const validAgendas = Array.isArray(agendas) ? agendas : [];
    let filtered = [...validAgendas];

    // Filtrar por búsqueda
    if (searchTerm) {
      filtered = filtered.filter(agenda =>
        agenda.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        agenda.phone_number?.includes(searchTerm) ||
        agenda.direccion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        agenda.ciudad?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        agenda.region?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtrar por tipo
    if (filterType !== 'all') {
      filtered = filtered.filter(agenda => agenda.tipo_agenda === filterType);
    }

    // Filtrar por rango de fechas
    if (dateFrom || dateTo) {
      filtered = filtered.filter(agenda => {
        if (!agenda.fecha_agendamiento) return false;
        
        const agendaDate = new Date(agenda.fecha_agendamiento);
        
        // Si solo hay fecha de inicio
        if (dateFrom && !dateTo) {
          const fromDate = new Date(dateFrom);
          return agendaDate >= fromDate;
        }
        
        // Si solo hay fecha de fin
        if (!dateFrom && dateTo) {
          const toDate = new Date(dateTo);
          toDate.setHours(23, 59, 59, 999); // Incluir todo el día
          return agendaDate <= toDate;
        }
        
        // Si hay ambas fechas
        if (dateFrom && dateTo) {
          const fromDate = new Date(dateFrom);
          const toDate = new Date(dateTo);
          toDate.setHours(23, 59, 59, 999); // Incluir todo el día
          return agendaDate >= fromDate && agendaDate <= toDate;
        }
        
        return true;
      });
    }

    setFilteredAgendas(filtered);
    setCurrentPage(1); // Reset a primera página cuando cambian los filtros
  }, [agendas, searchTerm, filterType, dateFrom, dateTo]);

  // Obtener tipos únicos para el filtro
  const uniqueTypes = [...new Set((Array.isArray(agendas) ? agendas : []).map(agenda => agenda.tipo_agenda))].filter(Boolean);

  // Paginación
  const totalPages = Math.ceil(filteredAgendas.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentAgendas = filteredAgendas.slice(startIndex, startIndex + itemsPerPage);

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

  // Limpiar filtros de fecha
  const clearDateFilters = () => {
    setDateFrom('');
    setDateTo('');
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Agendas</h1>
            <p className="text-gray-400">
              Gestiona tus agendas y visualiza el calendario
            </p>
          </div>
          {activeTab === 'list' && (
            <button
              onClick={loadAgendas}
              disabled={loading}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 px-4 py-2 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          )}
        </div>

        {/* Pestañas */}
        <div className="flex border-b border-gray-800 mb-6">
          <button
            onClick={() => setActiveTab('list')}
            className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
              activeTab === 'list'
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <List className="w-5 h-5" />
            Lista de Agendas
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
              activeTab === 'calendar'
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <CalendarDays className="w-5 h-5" />
            Calendario
          </button>
        </div>

        {/* Contenido de las pestañas */}
        {activeTab === 'list' && (
          <div>
            {/* Información de la lista */}
            <div className="mb-6">
              <p className="text-gray-400">
                {filteredAgendas.length} de {agendas.length} agendas
                {(searchTerm || filterType !== 'all' || dateFrom || dateTo) && (
                  <span className="text-purple-400 ml-2">(filtradas)</span>
                )}
              </p>
              
              {/* Mostrar filtros activos */}
              {(searchTerm || filterType !== 'all' || dateFrom || dateTo) && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {searchTerm && (
                    <span className="px-2 py-1 bg-purple-600/20 text-purple-300 text-xs rounded-full">
                      Búsqueda: "{searchTerm}"
                    </span>
                  )}
                  {filterType !== 'all' && (
                    <span className="px-2 py-1 bg-purple-600/20 text-purple-300 text-xs rounded-full">
                      Tipo: {filterType}
                    </span>
                  )}
                  {dateFrom && (
                    <span className="px-2 py-1 bg-purple-600/20 text-purple-300 text-xs rounded-full">
                      Desde: {new Date(dateFrom).toLocaleDateString('es-ES')}
                    </span>
                  )}
                  {dateTo && (
                    <span className="px-2 py-1 bg-purple-600/20 text-purple-300 text-xs rounded-full">
                      Hasta: {new Date(dateTo).toLocaleDateString('es-ES')}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Filtros y búsqueda */}
            <div className="bg-gray-900 rounded-lg p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Búsqueda */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre, teléfono, dirección..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Filtro por tipo */}
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 appearance-none"
                  >
                    <option value="all">Todos los tipos</option>
                    {uniqueTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                {/* Fecha desde */}
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="date"
                    placeholder="Fecha desde"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Fecha hasta */}
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="date"
                    placeholder="Fecha hasta"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              {/* Botón para limpiar filtros de fecha */}
              {(dateFrom || dateTo) && (
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={clearDateFilters}
                    className="flex items-center gap-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Limpiar fechas
                  </button>
                </div>
              )}
            </div>

            {/* Loading state */}
            {loading && (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="animate-spin w-8 h-8 text-purple-500 mr-3" />
                <span className="text-gray-400">Cargando agendas...</span>
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6">
                <div className="flex items-center">
                  <AlertCircle className="w-5 h-5 text-red-400 mr-2" />
                  <span className="text-red-400">{error}</span>
                </div>
              </div>
            )}

            {/* Agendas list */}
            {!loading && !error && (
              <div>
                {currentAgendas.length === 0 ? (
                  <div className="text-center py-12">
                    <Calendar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-400 mb-2">
                      {agendas.length === 0 ? 'No hay agendas' : 'No se encontraron agendas'}
                    </h3>
                    <p className="text-gray-500">
                      {agendas.length === 0 
                        ? 'Aún no tienes agendas registradas.'
                        : 'Intenta ajustar los filtros de búsqueda.'
                      }
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {currentAgendas.map((agenda) => (
                      <div
                        key={agenda.id}
                        className="bg-gray-900 rounded-lg p-6 hover:bg-gray-800 transition-colors"
                      >
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {/* Información principal */}
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <User className="w-5 h-5 text-purple-400" />
                                <h3 className="text-lg font-semibold text-white">
                                  {agenda?.nombre || 'Sin nombre'}
                                </h3>
                              </div>
                              {agenda?.tipo_agenda && (
                                <span className="px-2 py-1 bg-purple-600 text-white text-xs rounded-full">
                                  {agenda.tipo_agenda}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center space-x-2 text-gray-400">
                              <Phone className="w-4 h-4" />
                              <span>{agenda?.phone_number || 'Sin teléfono'}</span>
                            </div>

                            <div className="flex items-center space-x-2 text-gray-400">
                              <Calendar className="w-4 h-4" />
                              <span>Agendado: {agenda?.fecha_agendamiento ? formatDate(agenda.fecha_agendamiento) : 'Sin fecha'}</span>
                            </div>

                            <div className="flex items-center space-x-2 text-gray-400">
                              <Clock className="w-4 h-4" />
                              <span>Creado: {agenda?.created_at ? formatDate(agenda.created_at) : 'Sin fecha'}</span>
                            </div>
                          </div>

                          {/* Información de ubicación */}
                          <div className="space-y-3">
                            <div className="flex items-start space-x-2 text-gray-400">
                              <MapPin className="w-4 h-4 mt-1" />
                              <div className="space-y-1">
                                <div>{agenda?.direccion || 'Sin dirección'}</div>
                                {agenda?.local && (
                                  <div className="flex items-center space-x-2">
                                    <Building className="w-3 h-3" />
                                    <span className="text-sm">{agenda.local}</span>
                                  </div>
                                )}
                                <div className="text-sm">
                                  {agenda?.ciudad || 'Sin ciudad'}
                                  {agenda?.region && `, ${agenda.region}`}
                                  {agenda?.codigo_postal && ` - ${agenda.codigo_postal}`}
                                </div>
                              </div>
                            </div>

                            {agenda?.call_id && (
                              <div className="text-xs text-gray-500">
                                Call ID: {agenda.call_id}
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
                    <div className="text-sm text-gray-400">
                      Mostrando {startIndex + 1} a {Math.min(startIndex + itemsPerPage, filteredAgendas.length)} de {filteredAgendas.length} agendas
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 bg-gray-800 text-gray-400 rounded disabled:opacity-50 hover:bg-gray-700"
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
                            className={`px-3 py-1 rounded ${
                              currentPage === pageNum
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                      
                      <button
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 bg-gray-800 text-gray-400 rounded disabled:opacity-50 hover:bg-gray-700"
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Pestaña del Calendario */}
        {activeTab === 'calendar' && (
          <div className="bg-gray-900 rounded-lg p-6">
            <div className="mb-4">
              <h3 className="text-xl font-semibold text-white mb-2">Calendario de Google</h3>
              <p className="text-gray-400 text-sm">Visualiza y gestiona tus eventos en el calendario integrado</p>
            </div>
            
            <div className="w-full overflow-hidden rounded-lg border border-gray-700">
              <iframe 
                src="https://calendar.google.com/calendar/embed?src=f6016b18299ddeaa2c4fc3fa0b4dd662f249d2e37ff4a92a0751ddca100360b9%40group.calendar.google.com&ctz=Europe%2FLisbon" 
                style={{ border: 0 }} 
                width="100%" 
                height="600" 
                frameBorder="0" 
                scrolling="no"
                className="w-full"
                title="Calendario de Google"
              />
            </div>
            
            <div className="mt-4 text-xs text-gray-500">
              <p>📅 Este calendario se sincroniza automáticamente con Google Calendar</p>
              <p>🔄 Los cambios pueden tardar unos minutos en reflejarse</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 