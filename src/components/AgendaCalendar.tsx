import React, { useState, useMemo, useEffect } from 'react';
import { Agenda } from '../types';
import { Calendar, ChevronLeft, ChevronRight, Filter, X, RefreshCw } from 'lucide-react';
import { DayAgendasModal } from './DayAgendasModal';

interface AgendaCalendarProps {
  agendas: Agenda[];
  onAgendaClick: (agenda: Agenda) => void;
  onLoadMonthAgendas?: (year: number, month: number) => Promise<Agenda[]>;
  // Si true, carga los datos una sola vez al montar y navega localmente sin refetch
  cacheAcrossMonths?: boolean;
  // mode controla qué fecha se usa para ubicar la agenda en el calendario:
  // 'created' = fecha de creación, 'scheduled' = fecha agendada
  mode?: 'created' | 'scheduled';
}

export function AgendaCalendar({ agendas, onAgendaClick, onLoadMonthAgendas, cacheAcrossMonths = false, mode = 'created' }: AgendaCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedType, setSelectedType] = useState<string>('all');
  const [showTypeFilter, setShowTypeFilter] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [allAgendas, setAllAgendas] = useState<Agenda[]>(agendas);
  const [loadingAllAgendas, setLoadingAllAgendas] = useState(false);

  // Carga agendas: si cacheAcrossMonths ignora year/month (carga todo de una vez)
  const loadMonthAgendas = async (year: number, month: number) => {
    if (onLoadMonthAgendas) {
      setLoadingAllAgendas(true);
      try {
        const data = await onLoadMonthAgendas(year, month);
        setAllAgendas(data);
      } catch (error) {
        // console.error('Error al cargar agendas:', error);
        setAllAgendas([]);
      } finally {
        setLoadingAllAgendas(false);
      }
    } else {
      setAllAgendas(agendas);
    }
  };

  // Carga inicial al montar (o cuando cambia el callback)
  useEffect(() => {
    loadMonthAgendas(currentDate.getFullYear(), currentDate.getMonth());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onLoadMonthAgendas]);

  // Obtener tipos únicos de agenda
  const uniqueTypes = useMemo(() => {
    const types = [...new Set(allAgendas.map(agenda => agenda.tipo_agenda))].filter(Boolean);
    return types;
  }, [allAgendas]);

  // Filtrar agendas por tipo seleccionado (sobre todas las agendas cargadas)
  const filteredAgendas = useMemo(() => {
    const source = allAgendas;
    if (selectedType === 'all') return source;
    return source.filter(agenda => agenda.tipo_agenda === selectedType);
  }, [allAgendas, selectedType]);

  // Generar días del mes actual
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Agregar días vacíos del mes anterior
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Agregar días del mes actual
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  // Obtener la fecha relevante según el modo
  const getAgendaDateForMode = (agenda: Agenda): Date | null => {
    const dateString =
      mode === 'scheduled'
        ? (agenda.fecha_agendamiento || agenda.created_at)
        : (agenda.created_at || agenda.fecha_agendamiento);

    if (!dateString) return null;
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return null;
    return d;
  };

  // Obtener agendas para una fecha específica,
  // respetando el filtro de tipo seleccionado y el modo de fecha
  const getAgendasForDate = (date: Date) => {
    return filteredAgendas.filter(agenda => {
      const agendaDate = getAgendaDateForMode(agenda);
      if (!agendaDate) return false;
      return agendaDate.toDateString() === date.toDateString();
    });
  };

  // Obtener color según el tipo de agenda
  const getAgendaColor = (tipoAgenda: string) => {
    const tipo = tipoAgenda?.toLowerCase() || '';
    
    // Paneles solares
    if (tipo.includes('paneles solares') || tipo.includes('placas solares')) {
      return 'bg-gradient-to-r from-yellow-500 to-orange-600';
    }
    
    // Baterías
    if (tipo.includes('baterías') || tipo.includes('baterias') || 
        tipo.includes('bateria') || tipo.includes('batería')) {
      return 'bg-gradient-to-r from-blue-500 to-indigo-600';
    }
    
    // Color por defecto para otros tipos
    return 'bg-gradient-to-r from-slate-500 to-gray-600';
  };

  // Navegar al mes anterior
  const goToPreviousMonth = () => {
    setCurrentDate(prev => {
      const next = new Date(prev.getFullYear(), prev.getMonth() - 1, 1);
      if (!cacheAcrossMonths) {
        loadMonthAgendas(next.getFullYear(), next.getMonth());
      }
      return next;
    });
  };

  // Navegar al mes siguiente
  const goToNextMonth = () => {
    setCurrentDate(prev => {
      const next = new Date(prev.getFullYear(), prev.getMonth() + 1, 1);
      if (!cacheAcrossMonths) {
        loadMonthAgendas(next.getFullYear(), next.getMonth());
      }
      return next;
    });
  };

  // Ir al mes actual
  const goToCurrentMonth = () => {
    const now = new Date();
    setCurrentDate(now);
    if (!cacheAcrossMonths) {
      loadMonthAgendas(now.getFullYear(), now.getMonth());
    }
  };

  // Abrir modal del día
  const openDayModal = (day: Date) => {
    setSelectedDay(day);
    setDayModalOpen(true);
  };

  // Cerrar modal del día
  const closeDayModal = () => {
    setDayModalOpen(false);
    setSelectedDay(null);
  };

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

  const days = getDaysInMonth(currentDate);
  const monthName = currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  const today = new Date();

  return (
    <div className="bg-white rounded-lg shadow-lg border border-slate-200">
      {/* Header del calendario */}
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h3 className="text-xl font-semibold text-slate-800 capitalize">{monthName}</h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={goToPreviousMonth}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-slate-600" />
              </button>
              <button
                onClick={goToCurrentMonth}
                className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
              >
                Hoy
              </button>
              <button
                onClick={goToNextMonth}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-slate-600" />
              </button>
            </div>
          </div>
          
          {/* Filtro por tipo */}
          <div className="relative">
            <button
              onClick={() => setShowTypeFilter(!showTypeFilter)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <Filter className="w-4 h-4" />
              <span className="text-sm">
                {selectedType === 'all' ? 'Todos los tipos' : selectedType}
              </span>
            </button>
            
            {showTypeFilter && (
              <div className="absolute right-0 top-full mt-2 bg-white border border-slate-200 rounded-lg shadow-lg z-10 min-w-48">
                <div className="p-2">
                  <button
                    onClick={() => {
                      setSelectedType('all');
                      setShowTypeFilter(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-slate-100 ${
                      selectedType === 'all' ? 'bg-blue-100 text-blue-700' : 'text-slate-700'
                    }`}
                  >
                    Todos los tipos
                  </button>
                  {uniqueTypes.map(type => (
                    <button
                      key={type}
                      onClick={() => {
                        setSelectedType(type);
                        setShowTypeFilter(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-slate-100 ${
                        selectedType === type ? 'bg-blue-100 text-blue-700' : 'text-slate-700'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Información del filtro */}
        <div className="mt-3 text-sm text-slate-600">
          {loadingAllAgendas ? (
            <span className="flex items-center">
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              Cargando todas las agendas...
            </span>
          ) : (
            <>
              {filteredAgendas.length} agenda{filteredAgendas.length !== 1 ? 's' : ''} {selectedType === 'all' ? 'totales' : 'filtradas'}
              {selectedType !== 'all' && (
                <span className="text-blue-600 ml-2">
                  (filtro visual por "{selectedType}")
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Calendario */}
      <div className="p-6">
        {/* Días de la semana */}
        <div className="grid grid-cols-7 gap-1 mb-4">
          {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
            <div key={day} className="text-center text-sm font-medium text-slate-500 py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Días del mes */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, index) => {
            if (!day) {
              return <div key={index} className="h-24 bg-slate-50 rounded-lg" />;
            }

            const isToday = day.toDateString() === today.toDateString();
            const isCurrentMonth = day.getMonth() === currentDate.getMonth();
            const dayAgendas = getAgendasForDate(day);

                         return (
               <div
                 key={index}
                 onClick={() => openDayModal(day)}
                 className={`h-24 border border-slate-200 rounded-lg p-1 cursor-pointer hover:bg-slate-50 transition-colors ${
                   isToday ? 'bg-blue-50 border-blue-300' : 'bg-white'
                 } ${!isCurrentMonth ? 'opacity-50' : ''}`}
               >
                {/* Número del día */}
                <div className={`text-xs font-medium mb-1 ${
                  isToday ? 'text-blue-700' : 'text-slate-700'
                }`}>
                  {day.getDate()}
                </div>
                
                                 {/* Agendas del día */}
                 <div className="space-y-1">
                   {dayAgendas.slice(0, 2).map((agenda, agendaIndex) => {
                     const titleDate =
                       mode === 'scheduled'
                         ? (agenda.fecha_agendamiento
                            ? `Agendado: ${formatDate(agenda.fecha_agendamiento)}`
                            : (agenda.created_at ? `Creado: ${formatDate(agenda.created_at)}` : ''))
                         : (agenda.created_at
                            ? `Creado: ${formatDate(agenda.created_at)}`
                            : (agenda.fecha_agendamiento ? `Agendado: ${formatDate(agenda.fecha_agendamiento)}` : ''));

                     return (
                     <div
                       key={agendaIndex}
                       className={`text-xs p-1 rounded text-white truncate cursor-pointer hover:opacity-80 transition-opacity ${getAgendaColor(agenda.tipo_agenda)}`}
                       title={`${agenda.nombre} - ${agenda.tipo_agenda}${titleDate ? ' - ' + titleDate : ''}`}
                       onClick={() => onAgendaClick(agenda)}
                     >
                       {agenda.nombre}
                     </div>
                   ); })}
                   {dayAgendas.length > 2 && (
                     <div className="text-xs text-slate-500 text-center">
                       +{dayAgendas.length - 2} más
                     </div>
                   )}
                 </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Leyenda */}
      <div className="p-4 border-t border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between text-sm text-slate-600">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-gradient-to-r from-yellow-500 to-orange-600 rounded"></div>
              <span>Paneles Solares</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-indigo-600 rounded"></div>
              <span>Baterías</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-gradient-to-r from-slate-500 to-gray-600 rounded"></div>
              <span>Otros</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-50 border border-blue-300 rounded"></div>
              <span>Hoy</span>
            </div>
          </div>
          <div className="text-xs">
            Haz clic en un día para ver todas las agendas del día
          </div>
        </div>
      </div>

      {/* Modal del día */}
      <DayAgendasModal
        isOpen={dayModalOpen}
        onClose={closeDayModal}
        date={selectedDay}
        agendas={selectedDay ? getAgendasForDate(selectedDay) : []}
        onAgendaClick={onAgendaClick}
      />
    </div>
  );
} 