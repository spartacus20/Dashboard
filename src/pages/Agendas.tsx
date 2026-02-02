import React, { useState, useEffect } from 'react';
import { fetchAgendas, fetchAllAgendas, deleteAgenda } from '../api';
import { Agenda } from '../types';
import { useCallsContext } from '../context/CallsContext';
import { Calendar, Clock, MapPin, Phone, User, Building, Search, Filter, RefreshCw, AlertCircle, X, List, CalendarDays, Download, Trash2 } from 'lucide-react';
import { AgendaModal } from '../components/AgendaModal';
import { AgendaCalendar } from '../components/AgendaCalendar';
import { exportAgendasToCSV, generateCSVFilename } from '../lib/csvExport';

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
  const [filterAgentId, setFilterAgentId] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'list' | 'calendar'>('list');
  const [selectedAgenda, setSelectedAgenda] = useState<Agenda | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [agendaToDelete, setAgendaToDelete] = useState<Agenda | null>(null);
  const [deleting, setDeleting] = useState(false);
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
      console.log('Filtros de fecha aplicados:', { dateFrom, dateTo });
      
      // Usar fetchAllAgendas para obtener todas las agendas con filtros de fecha
      const agendasData = await fetchAllAgendas(
        clientId,
        undefined, // searchTerm
        undefined, // filterType
        dateFrom || undefined,
        dateTo || undefined,
        sortOrder, // sort_order
        filterAgentId !== 'all' ? filterAgentId : undefined // agentId
      );
      
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

  // Cargar agendas al montar el componente o cuando cambien los filtros de fecha, ordenamiento o agente
  useEffect(() => {
    loadAgendas();
  }, [clientId, dateFrom, dateTo, sortOrder, filterAgentId]);

  // Filtrar agendas (solo búsqueda y tipo, las fechas se filtran en la API)
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

    // NOTA: Los filtros de fecha (dateFrom, dateTo) se aplican en la API
    // No se filtran aquí para evitar duplicación

    setFilteredAgendas(filtered);
    setCurrentPage(1); // Reset a primera página cuando cambian los filtros
  }, [agendas, searchTerm, filterType]);

  // Obtener tipos únicos para el filtro
  const uniqueTypes = [...new Set((Array.isArray(agendas) ? agendas : []).map(agenda => agenda.tipo_agenda))].filter(Boolean);
  
  // Obtener agentes únicos para el filtro
  const uniqueAgents = [...new Set((Array.isArray(agendas) ? agendas : []).map(agenda => agenda.agent_id).filter(Boolean))].sort();

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

  // Abrir modal con agenda seleccionada
  const openAgendaModal = (agenda: Agenda) => {
    setSelectedAgenda(agenda);
    setModalOpen(true);
  };

  // Cerrar modal
  const closeAgendaModal = () => {
    setModalOpen(false);
    setSelectedAgenda(null);
  };

  // Abrir modal de confirmación de eliminación
  const openDeleteModal = (agenda: Agenda, e?: React.MouseEvent) => {
    e?.stopPropagation(); // Prevenir que se abra el modal de detalles
    setAgendaToDelete(agenda);
    setDeleteModalOpen(true);
  };

  // Cerrar modal de eliminación
  const closeDeleteModal = () => {
    setDeleteModalOpen(false);
    setAgendaToDelete(null);
  };

  // Eliminar agenda
  const handleDeleteAgenda = async () => {
    if (!agendaToDelete || !clientId) {
      setError('No se puede eliminar la agenda: datos incompletos');
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      await deleteAgenda(agendaToDelete.id, clientId);
      
      // Eliminar de la lista local
      setAgendas(prevAgendas => prevAgendas.filter(a => a.id !== agendaToDelete.id));
      setFilteredAgendas(prevFiltered => prevFiltered.filter(a => a.id !== agendaToDelete.id));
      
      // Cerrar modal
      closeDeleteModal();
      
      // Mostrar notificación de éxito
      const notification = document.createElement('div');
      notification.style.position = 'fixed';
      notification.style.top = '16px';
      notification.style.right = '16px';
      notification.style.backgroundColor = 'rgba(6, 78, 59, 0.9)';
      notification.style.color = 'white';
      notification.style.padding = '12px 20px';
      notification.style.borderRadius = '8px';
      notification.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
      notification.style.zIndex = '9999';
      notification.style.opacity = '0';
      notification.style.transition = 'opacity 0.3s ease-in-out';
      notification.textContent = '✅ Agenda eliminada exitosamente';
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.style.opacity = '1';
      }, 10);
      
      setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
          if (document.body.contains(notification)) {
            document.body.removeChild(notification);
          }
        }, 300);
      }, 3000);
      
    } catch (err) {
      console.error('Error al eliminar agenda:', err);
      setError(err instanceof Error ? err.message : 'Error al eliminar la agenda');
    } finally {
      setDeleting(false);
    }
  };

  // Exportar agendas a CSV
  const handleExportCSV = async () => {
    if (!clientId) {
      setError('Client ID no disponible');
      return;
    }

    setExporting(true);
    setError(null);

    try {
      console.log('Iniciando exportación CSV...');
      
      // Mostrar mensaje informativo
      const message = 'Obteniendo todas las agendas (esto puede tomar unos momentos)...';
      console.log(message);
      
      // Obtener todas las agendas con los filtros actuales
      const allAgendas = await fetchAllAgendas(
        clientId,
        searchTerm || undefined,
        filterType !== 'all' ? filterType : undefined,
        dateFrom || undefined,
        dateTo || undefined,
        sortOrder,
        filterAgentId !== 'all' ? filterAgentId : undefined
      );

      if (allAgendas.length === 0) {
        setError('No hay agendas para exportar');
        return;
      }

      // Generar nombre de archivo descriptivo
      const filename = generateCSVFilename(
        allAgendas.length,
        searchTerm,
        filterType,
        dateFrom,
        dateTo
      );

      // Exportar a CSV
      exportAgendasToCSV(allAgendas, filename);
      
      console.log(`Exportación completada: ${allAgendas.length} agendas exportadas`);
      
      // Mostrar mensaje de éxito
      alert(`✅ Exportación completada exitosamente!\n\nSe exportaron ${allAgendas.length} agendas al archivo:\n${filename}`);
      
    } catch (err) {
      console.error('Error al exportar agendas:', err);
      setError(err instanceof Error ? err.message : 'Error al exportar agendas');
    } finally {
      setExporting(false);
    }
  };

  // Calcular estadísticas de agendas (usando todas las agendas, no las filtradas)
  // Las agendas sin tipo_agenda se consideran paneles solares por defecto
  const panelesSolaresCount = agendas.filter(agenda => 
    !agenda.tipo_agenda || // Sin categoría = paneles solares por defecto
    agenda.tipo_agenda?.toLowerCase().includes('paneles solares') || 
    agenda.tipo_agenda?.toLowerCase().includes('placas solares')
  ).length;

  const bateriasCount = agendas.filter(agenda => 
    // Solo contar baterías si tiene tipo_agenda específico de baterías
    agenda.tipo_agenda && (
      agenda.tipo_agenda.toLowerCase().includes('baterías') || 
      agenda.tipo_agenda.toLowerCase().includes('baterias') ||
      agenda.tipo_agenda.toLowerCase().includes('bateria') ||
      agenda.tipo_agenda.toLowerCase().includes('batería')
    )
  ).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-indigo-800 mb-2">Agendas</h1>
            <p className="text-slate-600">
              Gestiona tus agendas y visualiza el calendario
            </p>
          </div>
          {activeTab === 'list' && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleExportCSV}
                disabled={exporting || loading}
                className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-700 hover:from-emerald-600 hover:to-teal-700 disabled:from-slate-400 disabled:to-slate-500 px-4 py-2 rounded-lg transition-all duration-200 text-white shadow-lg hover:shadow-xl"
              >
                <Download className={`w-4 h-4 ${exporting ? 'animate-pulse' : ''}`} />
                {exporting ? 'Exportando...' : 'Exportar CSV'}
              </button>
              <button
                onClick={loadAgendas}
                disabled={loading}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-indigo-600 hover:to-purple-700 disabled:from-slate-400 disabled:to-slate-500 px-4 py-2 rounded-lg transition-all duration-200 text-white shadow-lg hover:shadow-xl"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Actualizar
              </button>
            </div>
          )}
        </div>

        {/* Cards de estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Card de Paneles Solares */}
          <div className="bg-white rounded-lg p-6 shadow-lg border border-slate-200 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">Paneles Solares</h3>
                  <p className="text-sm text-slate-600">Agendas de instalación</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-orange-600">
                  {panelesSolaresCount}
                </div>
                <div className="text-xs text-slate-500">
                  {panelesSolaresCount === 1 ? 'agenda' : 'agendas'}
                </div>
              </div>
            </div>
          </div>

          {/* Card de Baterías */}
          <div className="bg-white rounded-lg p-6 shadow-lg border border-slate-200 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-gradient-to-br from-green-400 to-emerald-500 rounded-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">Baterías</h3>
                  <p className="text-sm text-slate-600">Agendas de instalación</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-500 to-emerald-600">
                  {bateriasCount}
                </div>
                <div className="text-xs text-slate-500">
                  {bateriasCount === 1 ? 'agenda' : 'agendas'}
                </div>
              </div>
            </div>
          </div>

          {/* Card de Total */}
          <div className="bg-white rounded-lg p-6 shadow-lg border border-slate-200 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">Total</h3>
                  <p className="text-sm text-slate-600">Todas las agendas</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-indigo-600">
                  {agendas.length}
                </div>
                <div className="text-xs text-slate-500">
                  {agendas.length === 1 ? 'agenda' : 'agendas'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Pestañas */}
        <div className="flex border-b border-slate-200 mb-6">
          <button
            onClick={() => setActiveTab('list')}
            className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
              activeTab === 'list'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <List className="w-5 h-5" />
            Lista de Agendas
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
              activeTab === 'calendar'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-600 hover:text-slate-800'
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
              <p className="text-slate-600">
                {filteredAgendas.length} de {agendas.length} agendas
                {(searchTerm || filterType !== 'all' || filterAgentId !== 'all' || dateFrom || dateTo) && (
                  <span className="text-blue-600 ml-2 font-medium">(filtradas)</span>
                )}
                {(dateFrom || dateTo) && (
                  <span className="text-green-600 ml-2 text-sm">(fechas filtradas en servidor)</span>
                )}
              </p>
              
              {/* Mostrar filtros activos */}
              {(searchTerm || filterType !== 'all' || filterAgentId !== 'all' || dateFrom || dateTo) && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {searchTerm && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full border border-blue-200">
                      Búsqueda: "{searchTerm}"
                    </span>
                  )}
                  {filterType !== 'all' && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full border border-blue-200">
                      Tipo: {filterType}
                    </span>
                  )}
                  {filterAgentId !== 'all' && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full border border-blue-200">
                      Agente: {filterAgentId}
                    </span>
                  )}
                  {dateFrom && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full border border-blue-200">
                      Desde: {new Date(dateFrom).toLocaleDateString('es-ES')}
                    </span>
                  )}
                  {dateTo && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full border border-blue-200">
                      Hasta: {new Date(dateTo).toLocaleDateString('es-ES')}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Filtros y búsqueda */}
            <div className="bg-white rounded-lg p-6 mb-6 shadow-lg border border-slate-200">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
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

                {/* Filtro por tipo */}
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-5 h-5" />
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                  >
                    <option value="all">Todos los tipos</option>
                    {uniqueTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                {/* Filtro por agente */}
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-5 h-5" />
                  <select
                    value={filterAgentId}
                    onChange={(e) => setFilterAgentId(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                  >
                    <option value="all">Todos los agentes</option>
                    {uniqueAgents.map(agentId => (
                      <option key={agentId} value={agentId}>{agentId}</option>
                    ))}
                  </select>
                </div>

                {/* Fecha desde */}
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-5 h-5" />
                  <input
                    type="date"
                    placeholder="Fecha desde"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Fecha hasta */}
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-5 h-5" />
                  <input
                    type="date"
                    placeholder="Fecha hasta"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Ordenamiento */}
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-5 h-5" />
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as 'ASC' | 'DESC')}
                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                  >
                    <option value="DESC">Más recientes primero</option>
                    <option value="ASC">Más antiguos primero</option>
                  </select>
                </div>
              </div>

              {/* Botón para limpiar filtros de fecha */}
              {(dateFrom || dateTo) && (
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={clearDateFilters}
                    className="flex items-center gap-2 px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm rounded-lg transition-colors"
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
                <RefreshCw className="animate-spin w-8 h-8 text-blue-600 mr-3" />
                <span className="text-slate-600">Cargando agendas...</span>
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

            {/* Agendas list */}
            {!loading && !error && (
              <div>
                {currentAgendas.length === 0 ? (
                  <div className="text-center py-12">
                    <Calendar className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-slate-600 mb-2">
                      {agendas.length === 0 ? 'No hay agendas' : 'No se encontraron agendas'}
                    </h3>
                    <p className="text-slate-500">
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
                        onClick={() => openAgendaModal(agenda)}
                        className="bg-white rounded-lg p-6 hover:bg-slate-50 transition-colors shadow-lg border border-slate-200 relative cursor-pointer"
                      >
                        {/* Botón de eliminar en la esquina superior derecha */}
                        <button
                          onClick={(e) => openDeleteModal(agenda, e)}
                          className="absolute top-4 right-4 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors z-10"
                          title="Eliminar agenda"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {/* Información principal */}
                          <div className="space-y-3">
                            <div className="flex items-center justify-between pr-12">
                              <div className="flex items-center space-x-2 flex-1">
                                <User className="w-5 h-5 text-blue-600" />
                                <h3 className="text-lg font-semibold text-slate-800">
                                  {agenda?.nombre || 'Sin nombre'}
                                </h3>
                              </div>
                              {agenda?.tipo_agenda && (
                                <span className="px-2 py-1 bg-gradient-to-r from-blue-600 to-indigo-700 text-white text-xs rounded-full">
                                  {agenda.tipo_agenda}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center space-x-2 text-slate-600">
                              <Phone className="w-4 h-4" />
                              <span>{agenda?.phone_number || 'Sin teléfono'}</span>
                            </div>

                            <div className="flex items-center space-x-2 text-slate-600">
                              <Calendar className="w-4 h-4" />
                              <span>Agendado: {agenda?.fecha_agendamiento ? formatDate(agenda.fecha_agendamiento) : 'Sin fecha'}</span>
                            </div>

                            <div className="flex items-center space-x-2 text-slate-600">
                              <Clock className="w-4 h-4" />
                              <span>Creado: {agenda?.created_at ? formatDate(agenda.created_at) : 'Sin fecha'}</span>
                            </div>
                            {agenda?.agent_id && (
                              <div className="flex items-center space-x-2 text-slate-600">
                                <User className="w-4 h-4" />
                                <span>Agente: <span className="font-medium text-blue-600">{agenda.agent_id}</span></span>
                              </div>
                            )}
                          </div>

                          {/* Información de ubicación */}
                          <div className="space-y-3">
                            <div className="flex items-start space-x-2 text-slate-600">
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
                              <div className="text-xs text-slate-500">
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
                    <div className="text-sm text-slate-600">
                      Mostrando {startIndex + 1} a {Math.min(startIndex + itemsPerPage, filteredAgendas.length)} de {filteredAgendas.length} agendas
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
        )}

        {/* Pestaña del Calendario */}
        {activeTab === 'calendar' && (
          <div>
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-indigo-800 mb-2">Calendario de Agendas</h3>
              <p className="text-slate-600 text-sm">Visualiza tus agendas en formato calendario y filtra por tipo</p>
            </div>
            
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="animate-spin w-8 h-8 text-blue-600 mr-3" />
                <span className="text-slate-600">Cargando calendario...</span>
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                  <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                  <span className="text-red-700">{error}</span>
                </div>
              </div>
            ) : (
              <AgendaCalendar 
                agendas={agendas} 
                onAgendaClick={openAgendaModal}
                onLoadAllAgendas={clientId ? () => fetchAllAgendas(clientId) : undefined}
              />
            )}
          </div>
        )}

        {/* Modal de agenda */}
        <AgendaModal
          agenda={selectedAgenda}
          isOpen={modalOpen}
          onClose={closeAgendaModal}
        />

        {/* Modal de confirmación de eliminación */}
        {deleteModalOpen && agendaToDelete && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md">
              <div className="flex justify-between items-center border-b border-slate-200 p-4 bg-gradient-to-r from-red-50 to-orange-50">
                <div className="flex items-center">
                  <AlertCircle className="w-6 h-6 text-red-600 mr-2" />
                  <h3 className="text-lg font-medium text-slate-800">Confirmar eliminación</h3>
                </div>
                <button 
                  onClick={closeDeleteModal}
                  className="p-1 hover:bg-slate-200 rounded-full transition-colors"
                  disabled={deleting}
                >
                  <X className="w-5 h-5 text-slate-500 hover:text-slate-700" />
                </button>
              </div>
              
              <div className="p-5 space-y-5 bg-white">
                <div>
                  <p className="text-slate-700 mb-3">
                    ¿Estás seguro de que quieres eliminar la agenda de <span className="font-bold text-slate-800">{agendaToDelete.nombre || 'Sin nombre'}</span>?
                  </p>
                  <p className="text-slate-600 text-sm">
                    Esta acción no se puede deshacer y eliminará permanentemente esta agenda y todos sus datos asociados.
                  </p>
                </div>

                {agendaToDelete.phone_number && (
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <p className="text-slate-600 text-sm">
                      <span className="font-medium">Teléfono:</span> {agendaToDelete.phone_number}
                    </p>
                    {agendaToDelete.fecha_agendamiento && (
                      <p className="text-slate-600 text-sm mt-1">
                        <span className="font-medium">Fecha:</span> {formatDate(agendaToDelete.fecha_agendamiento)}
                      </p>
                    )}
                  </div>
                )}
                
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                  </div>
                )}
                
                <div className="flex justify-end pt-3 gap-2">
                  <button
                    onClick={closeDeleteModal}
                    className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 mr-2 transition-colors"
                    disabled={deleting}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDeleteAgenda}
                    disabled={deleting}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleting ? (
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
        )}
      </div>
    </div>
  );
} 