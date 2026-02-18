import React, { useState, useEffect } from 'react';
import { fetchAgendas, fetchAllAgendas, deleteAgenda, getAverageCallsPerAgenda, updateAgendaStatus } from '../api';
import { Agenda } from '../types';
import { useCallsContext } from '../context/CallsContext';
import { Calendar, Clock, MapPin, Phone, User, Building, Search, Filter, RefreshCw, AlertCircle, X, List, CalendarDays, Download, Trash2, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Chart } from '../components/ui/chart';
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
  const [filterApproved, setFilterApproved] = useState<'all' | 'true' | 'false' | 'null'>('all');
  const [filterReviewed, setFilterReviewed] = useState<'all' | 'true' | 'false' | 'null'>('all');
  const todayStr = () => new Date().toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState(todayStr);
  const [datePreset, setDatePreset] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('today');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'list' | 'calendar' | 'calendarScheduled'>('list');
  const [selectedAgenda, setSelectedAgenda] = useState<Agenda | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [agendaToDelete, setAgendaToDelete] = useState<Agenda | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [averageStats, setAverageStats] = useState<{ average_calls: number; total_agendas: number; total_agendas_in_range: number; total_calls: number } | null>(null);
  const [loadingAverage, setLoadingAverage] = useState(false);
  // Permiso para ver estadísticas de Paneles Solares / Baterías según metadata.filtro_solar
  const [hasFiltroSolar, setHasFiltroSolar] = useState(false);
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
      
      // Usar fetchAllAgendas para obtener todas las agendas con filtros de fecha y tipo
      const agendasData = await fetchAllAgendas(
        clientId,
        undefined, // searchTerm (la búsqueda se aplica en el cliente)
        filterType !== 'all' ? filterType : undefined, // filtro por tipo de agenda
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

  // Verificar permiso filtro_solar desde sessionStorage y escuchar cambios de metadata
  useEffect(() => {
    const updateFromSession = () => {
      try {
        const metadataStr = sessionStorage.getItem('metadata');
        if (metadataStr) {
          const metadata = JSON.parse(metadataStr);
          setHasFiltroSolar(metadata?.filtro_solar === true);
        } else {
          setHasFiltroSolar(false);
        }
      } catch (error) {
        console.error('Error al leer metadata del sessionStorage en Agendas:', error);
        setHasFiltroSolar(false);
      }
    };

    const handleMetadataUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.metadata) {
        setHasFiltroSolar(customEvent.detail.metadata.filtro_solar === true);
      } else {
        updateFromSession();
      }
    };

    // Leer al montar
    updateFromSession();

    // Escuchar actualizaciones globales de metadata (por ejemplo, al cambiar de client_id)
    window.addEventListener('metadataUpdated', handleMetadataUpdate);

    return () => {
      window.removeEventListener('metadataUpdated', handleMetadataUpdate);
    };
  }, []);

  // Cargar agendas al montar el componente o cuando cambien los filtros de fecha, tipo, ordenamiento o agente
  useEffect(() => {
    loadAgendas();
  }, [clientId, dateFrom, dateTo, sortOrder, filterAgentId, filterType]);

  // Cargar promedio de llamadas por agenda
  useEffect(() => {
    const loadAverageCalls = async () => {
      if (!clientId) return;
      
      setLoadingAverage(true);
      try {
        const stats = await getAverageCallsPerAgenda(
          clientId,
          dateFrom || undefined,
          dateTo || undefined
        );
        setAverageStats({ average_calls: stats.average_calls, total_agendas: stats.total_agendas, total_agendas_in_range: stats.total_agendas_in_range ?? stats.total_agendas, total_calls: stats.total_calls });
      } catch (err) {
        console.error('Error al cargar promedio de llamadas:', err);
        setAverageStats(null);
      } finally {
        setLoadingAverage(false);
      }
    };
    
    loadAverageCalls();
  }, [clientId, dateFrom, dateTo]);

  // Filtrar agendas (búsqueda, tipo y estados; fechas y agente se filtran en la API)
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

    // Filtrar por tipo de agenda (además del filtro en la API, reforzamos en el cliente)
    if (filterType !== 'all') {
      filtered = filtered.filter(agenda => agenda.tipo_agenda === filterType);
    }

    // Filtrar por estado \"aprobada\"
    if (filterApproved !== 'all') {
      filtered = filtered.filter(agenda => {
        const val = agenda.aprobada;
        if (filterApproved === 'true') return val === true;
        if (filterApproved === 'false') return val === false;
        if (filterApproved === 'null') return val === null || typeof val === 'undefined';
        return true;
      });
    }

    // Filtrar por estado \"revisada\"
    if (filterReviewed !== 'all') {
      filtered = filtered.filter(agenda => {
        const val = agenda.revisada;
        if (filterReviewed === 'true') return val === true;
        if (filterReviewed === 'false') return val === false;
        if (filterReviewed === 'null') return val === null || typeof val === 'undefined';
        return true;
      });
    }

    // NOTA: Los filtros de fecha (dateFrom, dateTo) y agente se aplican en la API
    // No se filtran aquí para evitar duplicación

    setFilteredAgendas(filtered);
    setCurrentPage(1); // Reset a primera página cuando cambian los filtros
  }, [agendas, searchTerm, filterType, filterApproved, filterReviewed]);

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

  // Aplicar presets de fecha (hoy, semana, mes, todas, personalizado)
  const applyDatePreset = (preset: 'all' | 'today' | 'week' | 'month' | 'custom') => {
    setDatePreset(preset);

    const today = new Date();

    const format = (d: Date) =>
      d.toISOString().slice(0, 10); // YYYY-MM-DD

    if (preset === 'all') {
      setDateFrom('');
      setDateTo('');
      return;
    }

    if (preset === 'today') {
      const start = new Date(today);
      const end = new Date(today);
      setDateFrom(format(start));
      setDateTo(format(end));
      return;
    }

    if (preset === 'week') {
      const start = new Date(today);
      const day = start.getDay() || 7; // 1-7, donde 1 = lunes si queremos ajustar
      // Llevar al lunes de esta semana
      start.setDate(start.getDate() - (day - 1));
      setDateFrom(format(start));
      setDateTo(format(today));
      return;
    }

    if (preset === 'month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      setDateFrom(format(start));
      setDateTo(format(today));
      return;
    }

    // 'custom' no toca las fechas, solo marca el estado
  };

  // Limpiar filtros de fecha
  const clearDateFilters = () => {
    setDateFrom('');
    setDateTo('');
    setDatePreset('all');
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

  // Actualizar estado (aprobada / revisada) desde el modal y refrescar lista
  const handleStatusUpdated = () => {
    // Recargar agendas para reflejar cambios hechos en el modal
    loadAgendas();
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

  // Obtener clases de color para la etiqueta de tipo de agenda en la lista
  const getAgendaTypeBadgeClass = (tipo?: string | null) => {
    const t = (tipo || '').toLowerCase();

    // Solo placas/paneles solares en amarillo-naranja; el resto como estaba (azul)
    if (t.includes('paneles solares') || t.includes('placas solares')) {
      return 'bg-gradient-to-r from-yellow-500 to-orange-600';
    }

    return 'bg-gradient-to-r from-blue-600 to-indigo-700';
  };

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
          {/* Card de Paneles Solares (solo si filtro_solar = true en metadata) */}
          {hasFiltroSolar && (
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
          )}

          {/* Card de Baterías (solo si filtro_solar = true en metadata) */}
          {hasFiltroSolar && (
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
          )}

          {/* Card de Total: mismo número que Promedio de llamadas por agenda (total_agendas_in_range) */}
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
                  {averageStats != null ? (averageStats.total_agendas_in_range ?? averageStats.total_agendas) : agendas.length}
                </div>
                <div className="text-xs text-slate-500">
                  {(averageStats != null ? (averageStats.total_agendas_in_range ?? averageStats.total_agendas) : agendas.length) === 1 ? 'agenda' : 'agendas'}
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
          <button
            onClick={() => setActiveTab('calendarScheduled')}
            className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
              activeTab === 'calendarScheduled'
                ? 'text-emerald-700 border-b-2 border-emerald-700'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <CalendarDays className="w-5 h-5" />
            Calendario de Agendas
          </button>
        </div>

        {/* Contenido de las pestañas */}
        {activeTab === 'list' && (
          <div>
            {/* Card: Promedio de llamadas por agenda con gráfico y rango rápido */}
            <Card className="mb-6 shadow-lg border-slate-200">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-violet-600" />
                  <CardTitle className="text-lg">Promedio de llamadas por agenda</CardTitle>
                </div>
                <CardDescription>
                  {averageStats
                    ? `${(averageStats.total_agendas_in_range ?? averageStats.total_agendas).toLocaleString('es-ES')} agendas · ${averageStats.total_calls.toLocaleString('es-ES')} llamadas totales`
                    : 'Selecciona un rango para ver el promedio'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Rango rápido: dentro de la card */}
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-slate-500 text-sm font-medium">Rango:</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => applyDatePreset('today')}
                      className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                        datePreset === 'today'
                          ? 'bg-violet-600 text-white border-violet-600'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      Hoy
                    </button>
                    <button
                      onClick={() => applyDatePreset('week')}
                      className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                        datePreset === 'week'
                          ? 'bg-violet-600 text-white border-violet-600'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      Esta semana
                    </button>
                    <button
                      onClick={() => applyDatePreset('month')}
                      className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                        datePreset === 'month'
                          ? 'bg-violet-600 text-white border-violet-600'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      Este mes
                    </button>
                    <button
                      onClick={() => applyDatePreset('all')}
                      className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                        datePreset === 'all'
                          ? 'bg-violet-600 text-white border-violet-600'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      Todas las agendas
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => {
                        setDateFrom(e.target.value);
                        setDatePreset('custom');
                      }}
                      className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500"
                      title="Fecha desde"
                    />
                    <span className="text-slate-400 text-sm">–</span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => {
                        setDateTo(e.target.value);
                        setDatePreset('custom');
                      }}
                      className="px-2 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500"
                      title="Fecha hasta"
                    />
                    {(dateFrom || dateTo) && (
                      <button
                        onClick={clearDateFilters}
                        className="flex items-center gap-1 px-2 py-1.5 text-slate-600 hover:text-slate-800 text-sm rounded-lg hover:bg-slate-100 transition-colors"
                      >
                        <X className="w-4 h-4" />
                        Limpiar
                      </button>
                    )}
                  </div>
                </div>

                {loadingAverage && (
                  <div className="py-6 text-center text-slate-500 text-sm">
                    Calculando promedio de llamadas...
                  </div>
                )}
                {!loadingAverage && averageStats !== null && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                    <div className="text-center md:text-left">
                      <p className="text-3xl font-bold text-violet-600">
                        {averageStats.average_calls.toFixed(2)}
                      </p>
                      <p className="text-sm text-slate-600">llamadas por agenda (promedio)</p>
                    </div>
                    <div className="md:col-span-2 h-[180px]">
                      <Chart
                        data={[{ label: 'Llamadas por agenda (promedio)', llamadas: averageStats.average_calls }]}
                        type="bar"
                        xKey="label"
                        yKey="llamadas"
                        height={180}
                        colors={['#7c3aed']}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Filtros y búsqueda (el rango de fechas se cambia en la card Promedio de llamadas por agenda) */}
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

                {/* Filtro por aprobada */}
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-5 h-5" />
                  <select
                    value={filterApproved}
                    onChange={(e) => setFilterApproved(e.target.value as 'all' | 'true' | 'false' | 'null')}
                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                  >
                    <option value="all">Todas (aprobadas)</option>
                    <option value="true">Solo aprobadas</option>
                    <option value="false">Solo no aprobadas</option>
                    <option value="null">Sin estado</option>
                  </select>
                </div>

                {/* Filtro por revisada */}
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-5 h-5" />
                  <select
                    value={filterReviewed}
                    onChange={(e) => setFilterReviewed(e.target.value as 'all' | 'true' | 'false' | 'null')}
                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                  >
                    <option value="all">Todas (revisadas)</option>
                    <option value="true">Solo revisadas</option>
                    <option value="false">Solo no revisadas</option>
                    <option value="null">Sin estado</option>
                  </select>
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
                                <span
                                  className={`px-2 py-1 text-white text-xs rounded-full ${getAgendaTypeBadgeClass(agenda.tipo_agenda)}`}
                                >
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

                            {/* Estados: Aprobada / Revisada (solo visual, se editan en el detalle) */}
                            <div className="flex flex-wrap gap-2 mt-2">
                              {/* Aprobada (solo display) */}
                              <div
                                className={`px-2 py-1 rounded-full text-xs font-medium border flex items-center gap-1 cursor-default ${
                                  agenda.aprobada === true
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                    : agenda.aprobada === false
                                      ? 'bg-red-100 text-red-800 border-red-300'
                                      : 'bg-slate-100 text-slate-500 border-slate-300'
                                }`}
                                title="Estado de aprobación"
                              >
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    agenda.aprobada === true
                                      ? 'bg-emerald-500'
                                      : agenda.aprobada === false
                                        ? 'bg-red-500'
                                        : 'bg-slate-400'
                                  }`}
                                />
                                <span>Aprobada</span>
                              </div>

                              {/* Revisada (solo display) */}
                              <div
                                className={`px-2 py-1 rounded-full text-xs font-medium border flex items-center gap-1 cursor-default ${
                                  agenda.revisada === true
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                    : agenda.revisada === false
                                      ? 'bg-red-100 text-red-800 border-red-300'
                                      : 'bg-slate-100 text-slate-500 border-slate-300'
                                }`}
                                title="Estado de revisión"
                              >
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    agenda.revisada === true
                                      ? 'bg-emerald-500'
                                      : agenda.revisada === false
                                        ? 'bg-red-500'
                                        : 'bg-slate-400'
                                  }`}
                                />
                                <span>Revisada</span>
                              </div>
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

        {/* Pestaña del Calendario (creación) */}
        {activeTab === 'calendar' && (
          <div>
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-indigo-800 mb-2">
                Calendario
              </h3>
              <p className="text-slate-600 text-sm">
                Agendas ubicadas según la fecha en que fueron creadas.
              </p>
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
                agendas={filteredAgendas} 
                onAgendaClick={openAgendaModal}
                onLoadAllAgendas={clientId ? () => fetchAllAgendas(clientId) : undefined}
                mode="created"
              />
            )}
          </div>
        )}

        {activeTab === 'calendarScheduled' && (
          <div>
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-emerald-700 to-teal-800 mb-2">
                Calendario de Agendas
              </h3>
              <p className="text-slate-600 text-sm">
                Visualiza tus agendas posicionadas en la fecha en que fueron agendadas (fecha de visita).
              </p>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="animate-spin w-8 h-8 text-emerald-600 mr-3" />
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
                agendas={filteredAgendas} 
                onAgendaClick={openAgendaModal}
                onLoadAllAgendas={clientId ? () => fetchAllAgendas(clientId) : undefined}
                mode="scheduled"
              />
            )}
          </div>
        )}

        {/* Modal de agenda */}
        <AgendaModal
          agenda={selectedAgenda}
          isOpen={modalOpen}
          onClose={closeAgendaModal}
          onStatusChange={handleStatusUpdated}
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