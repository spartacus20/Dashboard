import React from 'react';
import { Agenda } from '../types';
import { X, Play, Pause, Volume2, Calendar, Phone, MapPin, User, Clock } from 'lucide-react';

interface AgendaModalProps {
  agenda: Agenda | null;
  isOpen: boolean;
  onClose: () => void;
}

export function AgendaModal({ agenda, isOpen, onClose }: AgendaModalProps) {
  if (!isOpen || !agenda) return null;

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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center space-x-3">
            <User className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-slate-800">{agenda.nombre}</h2>
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
          {/* Información básica */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-slate-600">
                <Phone className="w-4 h-4" />
                <span>{agenda.phone_number}</span>
              </div>
              
              <div className="flex items-center space-x-2 text-slate-600">
                <Calendar className="w-4 h-4" />
                <span>Agendado: {agenda.fecha_agendamiento ? formatDate(agenda.fecha_agendamiento) : 'Sin fecha'}</span>
              </div>
              
              <div className="flex items-center space-x-2 text-slate-600">
                <Clock className="w-4 h-4" />
                <span>Creado: {agenda.created_at ? formatDate(agenda.created_at) : 'Sin fecha'}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-start space-x-2 text-slate-600">
                <MapPin className="w-4 h-4 mt-1" />
                <div className="space-y-1">
                  <div>{agenda.direccion}</div>
                  {agenda.local && (
                    <div className="text-sm text-slate-500">{agenda.local}</div>
                  )}
                  <div className="text-sm">
                    {agenda.ciudad}
                    {agenda.region && `, ${agenda.region}`}
                    {agenda.codigo_postal && ` - ${agenda.codigo_postal}`}
                  </div>
                </div>
              </div>
              
              {agenda.tipo_agenda && (
                <div className="inline-block px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-700 text-white text-sm rounded-full">
                  {agenda.tipo_agenda}
                </div>
              )}
            </div>
          </div>

          {/* Reproductor de audio */}
          {agenda.recordings && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-3 flex items-center">
                <Volume2 className="w-5 h-5 mr-2 text-blue-600" />
                Grabación de la llamada
              </h3>
              <div className="bg-slate-50 rounded-lg p-4">
                <audio 
                  controls 
                  src={agenda.recordings} 
                  className="w-full"
                  preload="metadata"
                >
                  Tu navegador no soporta el elemento de audio.
                </audio>
                <div className="mt-2 text-xs text-slate-500">
                  Call ID: {agenda.call_id}
                </div>
              </div>
            </div>
          )}

          {/* Transcripción */}
          {agenda.transcript && (
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-3 flex items-center">
                <Play className="w-5 h-5 mr-2 text-blue-600" />
                Transcripción de la llamada
              </h3>
              <div className="bg-slate-50 rounded-lg p-4">
                <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
                  {agenda.transcript}
                </pre>
              </div>
            </div>
          )}

          {/* Mensaje si no hay transcripción */}
          {!agenda.transcript && (
            <div className="text-center py-8 text-slate-500">
              <Volume2 className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>No hay transcripción disponible para esta llamada.</p>
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