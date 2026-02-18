import React, { useEffect, useState } from 'react';
import { Agenda, CallsByPhoneResponse } from '../types';
import { X, Play, Volume2, Calendar, Phone, MapPin, User, Clock, RefreshCw, AlertCircle } from 'lucide-react';
import { getCallsByPhone, updateAgendaStatus } from '../api';

interface AgendaModalProps {
  agenda: Agenda | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: () => void;
}

export function AgendaModal({ agenda, isOpen, onClose, onStatusChange }: AgendaModalProps) {
  const [callsData, setCallsData] = useState<CallsByPhoneResponse | null>(null);
  const [loadingCalls, setLoadingCalls] = useState(false);
  const [errorCalls, setErrorCalls] = useState<string | null>(null);
  const [localApproved, setLocalApproved] = useState<boolean | null>(null);
  const [localReviewed, setLocalReviewed] = useState<boolean | null>(null);

  // Sincronizar estados locales cuando cambia la agenda
  useEffect(() => {
    if (agenda) {
      setLocalApproved(typeof agenda.aprobada === 'boolean' ? agenda.aprobada : null);
      setLocalReviewed(typeof agenda.revisada === 'boolean' ? agenda.revisada : null);
    } else {
      setLocalApproved(null);
      setLocalReviewed(null);
    }
  }, [agenda]);

  useEffect(() => {
    const fetchCalls = async () => {
      if (!isOpen || !agenda?.phone_number) return;
      // Resetear datos al cambiar de agenda
      setCallsData(null);
      setLoadingCalls(true);
      setErrorCalls(null);
      try {
        const currentPhone = agenda.phone_number;
        let cancelled = false;

        const promise = getCallsByPhone({
          phone_number: agenda.phone_number,
          per_page: 50,
          page: 1,
          sort_order: 'DESC'
        });

        const data = await promise;
        if (cancelled) return;
        // Evitar pintar datos de una agenda previa si cambió rápido
        if (currentPhone !== agenda.phone_number) return;
        setCallsData(data);
      } catch (err: any) {
        setErrorCalls(err?.message || 'Error al cargar llamadas');
      } finally {
        setLoadingCalls(false);
      }
    };
    fetchCalls();
    // Cleanup para evitar condiciones de carrera
    return () => {
      setLoadingCalls(false);
    };
  }, [isOpen, agenda?.phone_number]);

  // Limpiar estado al cerrar el modal
  useEffect(() => {
    if (!isOpen) {
      setCallsData(null);
      setErrorCalls(null);
      setLoadingCalls(false);
    }
  }, [isOpen]);

  if (!isOpen || !agenda) return null;

  // Misma lógica de color que en la lista: amarillo para placas/paneles solares, azul para el resto
  const getAgendaTypeBadgeClass = (tipo?: string | null) => {
    const t = (tipo || '').toLowerCase();
    if (t.includes('paneles solares') || t.includes('placas solares')) {
      return 'bg-gradient-to-r from-yellow-500 to-orange-600';
    }
    return 'bg-gradient-to-r from-blue-600 to-indigo-700';
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

  const handleToggleStatus = async (field: 'aprobada' | 'revisada') => {
    if (!agenda) return;

    try {
      if (field === 'aprobada') {
        const newValue = localApproved === true ? false : true;
        setLocalApproved(newValue);
        await updateAgendaStatus({ id: agenda.id, aprobada: newValue });
      } else {
        const newValue = localReviewed === true ? false : true;
        setLocalReviewed(newValue);
        await updateAgendaStatus({ id: agenda.id, revisada: newValue });
      }

      if (onStatusChange) {
        onStatusChange();
      }
    } catch (error) {
      console.error('Error al actualizar estado de agenda desde el modal:', error);
      // En caso de error, deshacer al valor original de la agenda
      if (agenda) {
        setLocalApproved(typeof agenda.aprobada === 'boolean' ? agenda.aprobada : null);
        setLocalReviewed(typeof agenda.revisada === 'boolean' ? agenda.revisada : null);
      }
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
              
              {agenda.agent_id && (
                <div className="flex items-center space-x-2 text-slate-600">
                  <User className="w-4 h-4" />
                  <span>Agente: <span className="font-medium text-blue-600">{agenda.agent_id}</span></span>
                </div>
              )}
              
              <div className="flex items-center space-x-2 text-slate-600">
                <Calendar className="w-4 h-4" />
                <span>Agendado: {agenda.fecha_agendamiento ? formatDate(agenda.fecha_agendamiento) : 'Sin fecha'}</span>
              </div>
              
              <div className="flex items-center space-x-2 text-slate-600">
                <Clock className="w-4 h-4" />
                <span>Creado: {agenda.created_at ? formatDate(agenda.created_at) : 'Sin fecha'}</span>
              </div>

              {/* Estados: Aprobada / Revisada (editable solo aquí) */}
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleToggleStatus('aprobada')}
                  className={`px-2 py-1 rounded-full text-xs font-medium border flex items-center gap-1 ${
                    localApproved === true
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : localApproved === false
                        ? 'bg-red-100 text-red-800 border-red-300'
                        : 'bg-slate-100 text-slate-500 border-slate-300'
                  }`}
                  title="Marcar como aprobada / no aprobada"
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      localApproved === true
                        ? 'bg-emerald-500'
                        : localApproved === false
                          ? 'bg-red-500'
                          : 'bg-slate-400'
                    }`}
                  />
                  <span>Aprobada</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleStatus('revisada')}
                  className={`px-2 py-1 rounded-full text-xs font-medium border flex items-center gap-1 ${
                    localReviewed === true
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : localReviewed === false
                        ? 'bg-red-100 text-red-800 border-red-300'
                        : 'bg-slate-100 text-slate-500 border-slate-300'
                  }`}
                  title="Marcar como revisada / no revisada"
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      localReviewed === true
                        ? 'bg-emerald-500'
                        : localReviewed === false
                          ? 'bg-red-500'
                          : 'bg-slate-400'
                    }`}
                  />
                  <span>Revisada</span>
                </button>
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
                <div className={`inline-block px-3 py-1 text-white text-sm rounded-full ${getAgendaTypeBadgeClass(agenda.tipo_agenda)}`}>
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

          {/* Llamadas asociadas al teléfono */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-slate-800 mb-3 flex items-center">
              <Phone className="w-5 h-5 mr-2 text-blue-600" />
              Llamadas asociadas al número
            </h3>

            {loadingCalls && (
              <div className="flex items-center justify-center py-6 text-slate-600">
                <RefreshCw className="w-5 h-5 animate-spin mr-2 text-blue-600" />
                Cargando llamadas...
              </div>
            )}

            {errorCalls && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3 text-sm text-red-700 flex items-center">
                <AlertCircle className="w-4 h-4 mr-2" />
                {errorCalls}
              </div>
            )}

            {callsData && (
              <div className="space-y-3">
                <div className="text-sm text-slate-600">
                  Total: {callsData.total_llamadas} · Origen: {callsData.resumen?.llamadas_como_origen ?? 0} · Destino: {callsData.resumen?.llamadas_como_destino ?? 0}
                </div>
                {callsData.llamadas?.length ? (
                  <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
                    {callsData.llamadas.map((c) => (
                      <div key={c.id} className="p-3 text-sm flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-slate-800">
                            {c.call_type ? c.call_type.toUpperCase() : (c.from_number === agenda.phone_number ? 'ORIGEN' : 'DESTINO')}
                          </div>
                          <div className="text-slate-600">
                            {c.from_number || '—'} → {c.to_number || '—'}
                          </div>
                          <div className="text-xs text-slate-500">
                            {c.created_at ? new Date(c.created_at).toLocaleString('es-ES') : 'Sin fecha'} · {c.status || '—'} · {typeof c.duration === 'number' ? `${c.duration}s` : (c.duration || '—')}
                          </div>
                        </div>
                        {c.recordings && (
                          <audio controls src={c.recordings} className="ml-4 w-52" preload="metadata" />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-slate-500 text-sm">No hay llamadas registradas para este número.</div>
                )}
              </div>
            )}
          </div>
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