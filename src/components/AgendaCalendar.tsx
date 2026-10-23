import React, { useState, useMemo, useEffect } from 'react';
import { Agenda } from '../types';
import { Calendar, ChevronLeft, ChevronRight, Filter, X, RefreshCw, BarChart3 } from 'lucide-react';
import { DayAgendasModal } from './DayAgendasModal';

interface AgendaCalendarProps {
  agendas: Agenda[];
  onAgendaClick: (agenda: Agenda) => void;
  onLoadMonthAgendas?: (year: number, month: number) => Promise<Agenda[]>;
  cacheAcrossMonths?: boolean;
  mode?: 'created' | 'scheduled';
  hasFit?: boolean;
}

export function AgendaCalendar({ agendas, onAgendaClick, onLoadMonthAgendas, cacheAcrossMonths = false, mode = 'created', hasFit = false }: AgendaCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedType, setSelectedType] = useState<string>('all');
  const [showTypeFilter, setShowTypeFilter] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [allAgendas, setAllAgendas] = useState<Agenda[]>(agendas);
  const [loadingAllAgendas, setLoadingAllAgendas] = useState(false);
  const [viewMode, setViewMode] = useState<'calendar' | 'bars'>('calendar');

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

  // Obtener tipos únicos de agenda (para FIT se usan canales, no tipo_agenda)
  const uniqueTypes = useMemo(() => {
    if (hasFit) return ['llamada', 'whatsapp'];
    const types = [...new Set(allAgendas.map(agenda => agenda.tipo_agenda))].filter(Boolean);
    return types;
  }, [allAgendas, hasFit]);

  // Filtrar agendas por tipo/canal seleccionado
  const filteredAgendas = useMemo(() => {
    const source = allAgendas;
    if (selectedType === 'all') return source;
    if (hasFit) {
      if (selectedType === 'llamada') return source.filter(a => !!a.call_id);
      if (selectedType === 'whatsapp') return source.filter(a => !a.call_id);
      return source;
    }
    return source.filter(agenda => agenda.tipo_agenda === selectedType);
  }, [allAgendas, selectedType, hasFit]);

  // Obtener la fecha relevante según el modo (debe declararse antes de barData)
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

  // Datos para la vista de barras: un registro por día del mes actual
  const barData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const date = new Date(year, month, day);
      const dayAgendas = filteredAgendas.filter(agenda => {
        const d = getAgendaDateForMode(agenda);
        return d ? d.toDateString() === date.toDateString() : false;
      });
      let solar = 0, batteries = 0, others = 0;
      for (const a of dayAgendas) {
        if (hasFit) {
          if (!!a.call_id) batteries++; // Llamada → slot "batteries" (azul)
          else solar++;                 // WhatsApp → slot "solar" (verde)
        } else {
          const t = (a.tipo_agenda || '').toLowerCase();
          if (t.includes('paneles solares') || t.includes('placas solares')) solar++;
          else if (t.includes('bater')) batteries++;
          else others++;
        }
      }
      return { day, date, solar, batteries, others, total: dayAgendas.length, agendas: dayAgendas };
    });
  }, [filteredAgendas, currentDate, mode]);

  const maxBarCount = useMemo(() => Math.max(1, ...barData.map(d => d.total)), [barData]);

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

  // Obtener agendas para una fecha específica,
  // respetando el filtro de tipo seleccionado y el modo de fecha
  const getAgendasForDate = (date: Date) => {
    return filteredAgendas.filter(agenda => {
      const agendaDate = getAgendaDateForMode(agenda);
      if (!agendaDate) return false;
      return agendaDate.toDateString() === date.toDateString();
    });
  };

  // Obtener color según el tipo de agenda (o canal para FIT)
  const getAgendaColor = (tipoAgenda: string, agenda?: Agenda) => {
    if (hasFit && agenda) {
      return agenda.call_id
        ? 'bg-gradient-to-r from-blue-500 to-blue-600'
        : 'bg-gradient-to-r from-emerald-500 to-green-600';
    }

    const tipo = tipoAgenda?.toLowerCase() || '';
    if (tipo.includes('paneles solares') || tipo.includes('placas solares')) {
      return 'bg-gradient-to-r from-yellow-500 to-orange-600';
    }
    if (tipo.includes('baterías') || tipo.includes('baterias') ||
        tipo.includes('bateria') || tipo.includes('batería')) {
      return 'bg-gradient-to-r from-blue-500 to-indigo-600';
    }
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
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
            {/* Calendario vs barras por día */}
            <div
              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1"
              role="group"
              aria-label="Cambiar entre calendario y barras por día"
            >
                <button
                  type="button"
                  onClick={() => setViewMode('calendar')}
                  aria-pressed={viewMode === 'calendar'}
                  className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    viewMode === 'calendar'
                      ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                  }`}
                >
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span>Calendario</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('bars')}
                  aria-pressed={viewMode === 'bars'}
                  className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    viewMode === 'bars'
                      ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                  }`}
                >
                  <BarChart3 className="h-4 w-4 shrink-0" />
                  <span>Barras por día</span>
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
                {selectedType === 'all'
                ? (hasFit ? 'Todos los canales' : 'Todos los tipos')
                : hasFit
                  ? (selectedType === 'llamada' ? 'Llamada' : 'WhatsApp')
                  : selectedType}
              </span>
            </button>
            
            {showTypeFilter && (
              <div className="absolute right-0 top-full mt-2 bg-white border border-slate-200 rounded-lg shadow-lg z-10 min-w-48">
                <div className="p-2">
                  <button
                    onClick={() => { setSelectedType('all'); setShowTypeFilter(false); }}
                    className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-slate-100 ${
                      selectedType === 'all' ? 'bg-blue-100 text-blue-700' : 'text-slate-700'
                    }`}
                  >
                    {hasFit ? 'Todos los canales' : 'Todos los tipos'}
                  </button>
                  {uniqueTypes.map(type => (
                    <button
                      key={type}
                      onClick={() => { setSelectedType(type); setShowTypeFilter(false); }}
                      className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-slate-100 ${
                        selectedType === type ? 'bg-blue-100 text-blue-700' : 'text-slate-700'
                      }`}
                    >
                      {hasFit
                        ? (type === 'llamada' ? 'Llamada' : 'WhatsApp')
                        : type}
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

      {/* Vista calendario */}
      {viewMode === 'calendar' && (
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
                  <div className={`text-xs font-medium mb-1 ${isToday ? 'text-blue-700' : 'text-slate-700'}`}>
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
                          className={`text-xs p-1 rounded text-white truncate cursor-pointer hover:opacity-80 transition-opacity ${getAgendaColor(agenda.tipo_agenda, agenda)}`}
                          title={`${agenda.nombre} - ${agenda.tipo_agenda}${titleDate ? ' - ' + titleDate : ''}`}
                          onClick={e => { e.stopPropagation(); onAgendaClick(agenda); }}
                        >
                          {agenda.nombre}
                        </div>
                      );
                    })}
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
      )}

      {/* Vista de barras */}
      {viewMode === 'bars' && (
        <div className="p-6">
          <div className="flex items-end gap-1 overflow-x-auto pb-2" style={{ minHeight: '220px' }}>
            {barData.map(({ day, date, solar, batteries, others, total }) => {
              const BAR_MAX_H = 160;
              const barH = total > 0 ? Math.max(Math.round((total / maxBarCount) * BAR_MAX_H), 6) : 0;
              const solarH = total > 0 ? Math.round((solar / total) * barH) : 0;
              const battH = total > 0 ? Math.round((batteries / total) * barH) : 0;
              const othersH = barH - solarH - battH;
              const isToday = date.toDateString() === today.toDateString();

              return (
                <div
                  key={day}
                  className="flex flex-col items-center flex-shrink-0 cursor-pointer group"
                  style={{ width: 'calc((100% - 30px) / 31)', minWidth: '22px' }}
                  onClick={() => openDayModal(date)}
                  title={`${date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}: ${total} agendas`}
                >
                  {/* Contador encima */}
                  <div className="text-[10px] font-bold text-slate-700 mb-1 h-4 leading-4">
                    {total > 0 ? total : ''}
                  </div>

                  {/* Barra apilada */}
                  <div
                    className="w-full flex flex-col justify-end rounded-t overflow-hidden group-hover:opacity-75 transition-opacity"
                    style={{ height: `${BAR_MAX_H}px` }}
                  >
                    <div className="w-full flex flex-col" style={{ height: barH > 0 ? `${barH}px` : '0px' }}>
                      {solar > 0 && (
                        <div
                          className={`w-full ${hasFit ? 'bg-gradient-to-b from-emerald-500 to-green-600' : 'bg-gradient-to-b from-yellow-500 to-orange-500'}`}
                          style={{ height: `${solarH}px` }}
                        />
                      )}
                      {batteries > 0 && (
                        <div
                          className={`w-full ${hasFit ? 'bg-gradient-to-b from-blue-500 to-blue-600' : 'bg-gradient-to-b from-blue-500 to-indigo-600'}`}
                          style={{ height: `${battH}px` }}
                        />
                      )}
                      {others > 0 && (
                        <div className="w-full bg-gradient-to-b from-slate-400 to-gray-500" style={{ height: `${othersH}px` }} />
                      )}
                    </div>
                  </div>

                  {/* Número de día */}
                  <div className={`text-[10px] mt-1 font-medium ${isToday ? 'text-blue-700 font-bold' : 'text-slate-400'}`}>
                    {day}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Leyenda */}
      <div className="p-4 border-t border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between text-sm text-slate-600">
          <div className="flex items-center space-x-4">
            {hasFit ? (
              <>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-gradient-to-r from-emerald-500 to-green-600 rounded"></div>
                  <span>WhatsApp</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-blue-600 rounded"></div>
                  <span>Llamada</span>
                </div>
              </>
            ) : (
              <>
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
              </>
            )}
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