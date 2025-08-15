import React from 'react';
import { Agenda } from '../types';
import { X, Calendar, Clock, Phone, MapPin, User } from 'lucide-react';

interface DayAgendasModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date | null;
  agendas: Agenda[];
  onAgendaClick: (agenda: Agenda) => void;
}

export function DayAgendasModal({ isOpen, onClose, date, agendas, onAgendaClick }: DayAgendasModalProps) {
  if (!isOpen || !date) return null;

  // Formatear fecha
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  // Formatear hora
  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '';
    }
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center space-x-3">
            <Calendar className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-bold text-slate-800 capitalize">
                {formatDate(date)}
              </h2>
                             <p className="text-sm text-slate-600">
                 {agendas.length} agenda{agendas.length !== 1 ? 's' : ''} creada{agendas.length !== 1 ? 's' : ''} en este día
               </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {agendas.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-600 mb-2">
                No hay agendas programadas
              </h3>
              <p className="text-slate-500">
                Este día no tiene agendas programadas.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {agendas.map((agenda) => (
                <div
                  key={agenda.id}
                  onClick={() => onAgendaClick(agenda)}
                  className="bg-slate-50 rounded-lg p-4 hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <User className="w-5 h-5 text-blue-600" />
                        <h3 className="text-lg font-semibold text-slate-800">
                          {agenda.nombre}
                        </h3>
                        <span className={`px-2 py-1 text-xs rounded-full text-white ${getAgendaColor(agenda.tipo_agenda)}`}>
                          {agenda.tipo_agenda}
                        </span>
                      </div>

                                             <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-slate-600">
                         <div className="flex items-center space-x-2">
                           <Clock className="w-4 h-4" />
                           <span>Creado: {formatTime(agenda.created_at)}</span>
                         </div>

                                                 <div className="flex items-center space-x-2">
                           <Phone className="w-4 h-4" />
                           <span>{agenda.phone_number}</span>
                         </div>

                         <div className="flex items-center space-x-2">
                           <Calendar className="w-4 h-4" />
                           <span>Agendado: {agenda.fecha_agendamiento ? formatTime(agenda.fecha_agendamiento) : 'Sin fecha'}</span>
                         </div>

                        <div className="flex items-start space-x-2 md:col-span-2">
                          <MapPin className="w-4 h-4 mt-0.5" />
                          <div>
                            <div>{agenda.direccion}</div>
                            <div className="text-xs text-slate-500">
                              {agenda.ciudad}
                              {agenda.region && `, ${agenda.region}`}
                              {agenda.codigo_postal && ` - ${agenda.codigo_postal}`}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
} 