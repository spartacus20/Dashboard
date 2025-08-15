import React, { useState, useMemo, useEffect } from 'react';
import { Agenda } from '../types';
import { Calendar, ChevronLeft, ChevronRight, Filter, X, RefreshCw } from 'lucide-react';
import { DayAgendasModal } from './DayAgendasModal';

interface AgendaCalendarProps {
  agendas: Agenda[];
  onAgendaClick: (agenda: Agenda) => void;
  onLoadAllAgendas?: () => Promise<Agenda[]>;
}

export function AgendaCalendar({ agendas, onAgendaClick, onLoadAllAgendas }: AgendaCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedType, setSelectedType] = useState<string>('all');
  const [showTypeFilter, setShowTypeFilter] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [allAgendas, setAllAgendas] = useState<Agenda[]>(agendas);
  const [loadingAllAgendas, setLoadingAllAgendas] = useState(false);

  // Cargar todas las agendas al montar el componente
  useEffect(() => {
    const loadAllAgendas = async () => {
      if (onLoadAllAgendas) {
        setLoadingAllAgendas(true);
        try {
          const allAgendasData = await onLoadAllAgendas();
          setAllAgendas(allAgendasData);
        } catch (error) {
          console.error('Error al cargar todas las agendas:', error);
        } finally {
          setLoadingAllAgendas(false);
        }
      } else {
        setAllAgendas(agendas);
      }
    };

    loadAllAgendas();
  }, [agendas, onLoadAllAgendas]);

  // Obtener tipos únicos de agenda
  const uniqueTypes = useMemo(() => {
    const types = [...new Set(allAgendas.map(agenda => agenda.tipo_agenda))].filter(Boolean);
    return types;
  }, [allAgendas]);

  // Filtrar agendas por tipo seleccionado
  const filteredAgendas = useMemo(() => {
    if (selectedType === 'all') return agendas;
    return agendas.filter(agenda => agenda.tipo_agenda === selectedType);
  }, [agendas, selectedType]);

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

  // Obtener agendas para una fecha específica (usar fecha de creación)
  const getAgendasForDate = (date: Date) => {
    return allAgendas.filter(agenda => {
      if (!agenda.created_at) return false;
      const agendaDate = new Date(agenda.created_at);
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
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  // Navegar al mes siguiente
  const goToNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  // Ir al mes actual
  const goToCurrentMonth = () => {
    setCurrentDate(new Date());
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
              {allAgendas.length} agendas totales
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
                   {dayAgendas.slice(0, 2).map((agenda, agendaIndex) => (
                     <div
                       key={agendaIndex}
                       className={`text-xs p-1 rounded text-white truncate cursor-pointer hover:opacity-80 transition-opacity ${getAgendaColor(agenda.tipo_agenda)}`}
                       title={`${agenda.nombre} - ${agenda.tipo_agenda} - Creado: ${formatDate(agenda.created_at)}`}
                       onClick={() => onAgendaClick(agenda)}
                     >
                       {agenda.nombre}
                     </div>
                   ))}
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