import { useEffect, useState } from 'react';
import { Agenda, CallsByPhoneResponse } from '../types';
import { X, Play, Volume2, Calendar, Phone, MapPin, User, Clock, RefreshCw, AlertCircle, ExternalLink } from 'lucide-react';
import { getCallsByPhone, updateAgendaStatus, getCallTranscript } from '../api';

interface AgendaModalProps {
  agenda: Agenda | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: () => void;
}

const normalizeBool = (v: unknown): boolean =>
  v === true || v === 'true' || v === 1 || (typeof v === 'string' && v.toLowerCase() === 'true');

export function AgendaModal({ agenda, isOpen, onClose, onStatusChange }: AgendaModalProps) {
  const [callsData, setCallsData] = useState<CallsByPhoneResponse | null>(null);
  const [loadingCalls, setLoadingCalls] = useState(false);
  const [errorCalls, setErrorCalls] = useState<string | null>(null);
  const [localTranscript, setLocalTranscript] = useState<string | null>(null);
  const [localRecordings, setLocalRecordings] = useState<string | null>(null);
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const [localApproved, setLocalApproved] = useState<boolean>(false);
  const [localReviewed, setLocalReviewed] = useState<boolean>(false);
  const [localDetails, setLocalDetails] = useState<string>('');
  const [localMotivoRechazo, setLocalMotivoRechazo] = useState<'Edad' | 'Pago mensual bajo' | 'Otros' | 'Ubicacion fuera alcance' | 'Casco historico' | 'No interesado' | 'Detecta IA' | 'Tiene bateria' | 'Incidencia' | null>(null);
  const [localUrlMaps, setLocalUrlMaps] = useState<string>('');

  // Sincronizar estados locales cuando cambia la agenda (null/undefined = false)
  useEffect(() => {
    if (agenda) {
      setLocalApproved(normalizeBool(agenda.aprobada));
      setLocalReviewed(normalizeBool(agenda.revisada));
      setLocalDetails(agenda.detalles ?? '');
      setLocalMotivoRechazo((agenda.motivo_rechazo as 'Edad' | 'Pago mensual bajo' | 'Otros' | 'Ubicacion fuera alcance' | 'Casco historico' | 'No interesado' | 'Detecta IA' | 'Tiene bateria' | 'Incidencia' | null) ?? null);
      setLocalUrlMaps(agenda.url_maps ?? '');
    } else {
      setLocalApproved(false);
      setLocalReviewed(false);
      setLocalDetails('');
      setLocalMotivoRechazo(null);
      setLocalUrlMaps('');
    }
  }, [agenda]);

  // Cargar transcript y recordings bajo demanda al abrir el modal
  useEffect(() => {
    const fetchTranscript = async () => {
      if (!isOpen || !agenda?.call_id) {
        setLocalTranscript(null);
        setLocalRecordings(null);
        return;
      }
      setLoadingTranscript(true);
      setLocalTranscript(null);
      setLocalRecordings(null);
      try {
        const data = await getCallTranscript(agenda.call_id);
        setLocalTranscript(data.transcript);
        setLocalRecordings(data.recordings);
      } catch {
        setLocalTranscript(null);
        setLocalRecordings(null);
      } finally {
        setLoadingTranscript(false);
      }
    };
    fetchTranscript();
  }, [isOpen, agenda?.call_id]);

  useEffect(() => {
    const fetchCalls = async () => {
      if (!isOpen || !agenda?.phone_number) return;
      // Resetear datos al cambiar de agenda
      setCallsData(null);
      setLoadingCalls(true);
      setErrorCalls(null);
      try {
        const currentPhone = agenda.phone_number;
        const cancelled = false;

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
      setLocalTranscript(null);
      setLocalRecordings(null);
      setLoadingTranscript(false);
    }
  }, [isOpen]);

  if (!isOpen || !agenda) return null;

  const isValidInitialAddress = (addr: string | null | undefined): boolean => {
    if (!addr) return false;
    const alphanumeric = (addr.match(/[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ]/g) || []).length;
    return alphanumeric >= 5;
  };

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

  // Clase de color para texto según estado (verde o rojo)
  const getStatusTextClass = (value: boolean) => {
    return value ? 'text-emerald-700' : 'text-red-700';
  };

  // Solo actualiza el estado local; la API se llama al cerrar el modal
  const handleChangeStatus = (
    field: 'aprobada' | 'revisada',
    value: 'true' | 'false'
  ) => {
    if (field === 'aprobada') {
      setLocalApproved(value === 'true');
    } else {
      setLocalReviewed(value === 'true');
    }
  };

  // Persiste cambios de estados al backend cuando se cierra el modal (null/undefined = false)
  const persistStatusChanges = async () => {
    if (!agenda) return;

    const originalApproved = normalizeBool(agenda.aprobada);
    const originalReviewed = normalizeBool(agenda.revisada);
    const originalDetails = agenda.detalles ?? '';
    const originalMotivoRechazo = (agenda.motivo_rechazo as 'Edad' | 'Pago mensual bajo' | 'Otros' | 'Ubicacion fuera alcance' | 'Casco historico' | 'No interesado' | 'Detecta IA' | 'Tiene bateria' | 'Incidencia' | null) ?? null;
    const originalUrlMaps = agenda.url_maps ?? '';

    const payload: { id: string; aprobada?: boolean; revisada?: boolean; detalles?: string; motivo_rechazo?: string | null; url_maps?: string | null } = {
      id: String(agenda.id),
    };

    if (localApproved !== originalApproved) {
      payload.aprobada = localApproved;
    }

    if (localReviewed !== originalReviewed) {
      payload.revisada = localReviewed;
    }

    if (localDetails !== originalDetails) {
      payload.detalles = localDetails;
    }

    if (localMotivoRechazo !== originalMotivoRechazo) {
      payload.motivo_rechazo = localMotivoRechazo;
    }

    if (localUrlMaps !== originalUrlMaps) {
      payload.url_maps = localUrlMaps.trim() || null;
    }

    // Si no hay cambios, no llamamos a la API
    if (
      typeof payload.aprobada === 'undefined' &&
      typeof payload.revisada === 'undefined' &&
      typeof payload.detalles === 'undefined' &&
      typeof payload.motivo_rechazo === 'undefined' &&
      typeof payload.url_maps === 'undefined'
    ) {
      return;
    }

    try {
      await updateAgendaStatus(payload as any);

      if (onStatusChange) {
        onStatusChange();
      }
    } catch (error) {
      // console.error(
        // 'Error al actualizar estado de agenda desde el modal:',
        // error
      // );
    }
  };

  // Cierre del modal: primero persiste cambios y luego ejecuta onClose
  const handleClose = async () => {
    await persistStatusChanges();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-5xl bg-white shadow-2xl border border-slate-200 rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-8 py-6 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-blue-500/10 text-blue-600 rounded-xl">
              <User className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                {agenda.nombre || 'Sin nombre'}
              </h2>
              <p className="text-sm text-slate-500">
                Teléfono: {agenda.phone_number || 'Sin teléfono'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Contenido principal */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8">
          {/* Info básica y estados */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
                <div className="flex items-start gap-3">
                  <Phone className="w-4 h-4 mt-0.5 text-slate-400" />
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Teléfono
                    </p>
                    <p className="text-slate-800 font-medium">
                      {agenda.phone_number || 'Sin teléfono'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 mt-0.5 text-slate-400" />
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Dirección
                    </p>
                    <p className="text-slate-800 font-medium leading-tight">
                      {agenda.direccion || 'Sin dirección'}
                      <br />
                      <span className="text-slate-500 font-normal text-sm">
                        {agenda.ciudad || 'Sin ciudad'}
                        {agenda.region && `, ${agenda.region}`}
                        {agenda.codigo_postal && ` - ${agenda.codigo_postal}`}
                      </span>
                    </p>
                    {isValidInitialAddress(agenda.initial_address) && (
                      <p className="text-slate-400 text-xs mt-2 pt-2 border-t border-slate-100">
                        <span className="uppercase tracking-wide font-semibold">Dirección inicial:</span>{' '}
                        {agenda.initial_address}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3 md:col-span-2">
                  <ExternalLink className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      URL Google Maps
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        value={localUrlMaps}
                        onChange={(e) => setLocalUrlMaps(e.target.value)}
                        placeholder="https://maps.google.com/..."
                        className="flex-1 min-w-0 px-3 py-1.5 text-sm rounded-lg border border-slate-200 bg-slate-50 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      {localUrlMaps.trim() && (
                        <a
                          href={localUrlMaps.trim()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
                          title="Abrir en Google Maps"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          Abrir
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {agenda.agent_id && (
                  <div className="flex items-start gap-3">
                    <User className="w-4 h-4 mt-0.5 text-slate-400" />
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Agente
                      </p>
                      <p className="text-blue-600 font-bold">
                        {agenda.agent_id}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <Calendar className="w-4 h-4 mt-0.5 text-slate-400" />
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Agendado
                    </p>
                    <p className="text-slate-800 font-medium">
                      {agenda.fecha_agendamiento
                        ? formatDate(agenda.fecha_agendamiento)
                        : 'Sin fecha'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="w-4 h-4 mt-0.5 text-slate-400" />
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Creado
                    </p>
                    <p className="text-slate-800 font-medium">
                      {agenda.created_at ? formatDate(agenda.created_at) : 'Sin fecha'}
                    </p>
                  </div>
                </div>

                {agenda.tipo_agenda && (
                  <div className="flex items-start gap-3">
                    <div className="w-4 h-4 mt-0.5 rounded-full bg-blue-500/10" />
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Tipo de agenda
                      </p>
                      <span
                        className={`inline-flex px-3 py-1 text-xs font-semibold text-white rounded-full mt-0.5 ${getAgendaTypeBadgeClass(
                          agenda.tipo_agenda
                        )}`}
                      >
                        {agenda.tipo_agenda.toUpperCase()}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Campo de detalles / comentarios */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block px-0.5">
                  Detalles / Comentarios
                </label>
                <textarea
                  value={localDetails}
                  onChange={(e) => setLocalDetails(e.target.value)}
                  className="w-full min-h-[80px] max-h-40 px-3 py-2 text-sm rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical"
                  placeholder="Añade aquí cualquier comentario relevante sobre la llamada..."
                />
              </div>
            </div>

            {/* Estados lado derecho */}
            <div className="space-y-4">
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
                  Estado de aprobación
                </label>
                <div className="relative">
                  <select
                    value={localApproved ? 'true' : 'false'}
                    onChange={(e) =>
                      handleChangeStatus(
                        'aprobada',
                        e.target.value as 'true' | 'false'
                      )
                    }
                    className={`w-full appearance-none px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 pr-9 ${getStatusTextClass(
                      localApproved
                    )}`}
                  >
                    <option value="true">Aprobada</option>
                    <option value="false">No aprobada</option>
                  </select>
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400 text-xs">
                    ▼
                  </span>
                </div>

                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
                  Estado de revisión
                </label>
                <div className="relative">
                  <select
                    value={localReviewed ? 'true' : 'false'}
                    onChange={(e) =>
                      handleChangeStatus(
                        'revisada',
                        e.target.value as 'true' | 'false'
                      )
                    }
                    className={`w-full appearance-none px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-9 ${getStatusTextClass(
                      localReviewed
                    )}`}
                  >
                    <option value="true">Revisada</option>
                    <option value="false">No revisada</option>
                  </select>
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400 text-xs">
                    ▼
                  </span>
                </div>

                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
                  Motivo de rechazo
                </label>
                <div className="relative">
                  <select
                    value={localMotivoRechazo ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      const motivo = val === '' ? null : val as 'Edad' | 'Pago mensual bajo' | 'Otros' | 'Ubicacion fuera alcance' | 'Casco historico' | 'No interesado' | 'Detecta IA' | 'Tiene bateria' | 'Incidencia';
                      setLocalMotivoRechazo(motivo);
                      // Al seleccionar un motivo de rechazo, marcar automáticamente como No aprobada
                      if (motivo !== null) {
                        setLocalApproved(false);
                      }
                    }}
                    className="w-full appearance-none px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 pr-9 text-slate-600"
                  >
                    <option value="">— Sin motivo —</option>
                    <option value="Edad">Edad</option>
                    <option value="Pago mensual bajo">Pago mensual bajo</option>
                    <option value="Ubicacion fuera alcance">Ubicacion fuera alcance</option>
                    <option value="Casco historico">Casco historico</option>
                    <option value="No interesado">No interesado</option>
                    <option value="Detecta IA">Detecta IA</option>
                    <option value="Tiene bateria">Tiene bateria</option>
                    <option value="Incidencia">Incidencia</option>
                    <option value="Otros">Otros</option>
                  </select>
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400 text-xs">
                    ▼
                  </span>
                </div>

                {/* Badge notificación webhook — solo si rechazada */}
                {normalizeBool(agenda.revisada) && !normalizeBool(agenda.aprobada) && (
                  <div className={`mt-2 flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold ${
                    agenda.llamada_enviada === true
                      ? 'bg-blue-50 border-blue-200 text-blue-700'
                      : 'bg-amber-50 border-amber-200 text-amber-700'
                  }`}>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${agenda.llamada_enviada === true ? 'bg-blue-500' : 'bg-amber-400'}`} />
                    <span>
                      {agenda.llamada_enviada === true
                        ? 'Notificación enviada al sistema externo'
                        : 'Notificación pendiente de envío'}
                    </span>
                  </div>
                )}
            </div>
          </div>
          </div>

          {/* Grabación de la llamada */}
          {(localRecordings || loadingTranscript) && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-lg text-slate-900">
                    Grabación de la llamada
                  </h3>
                </div>
                {agenda.call_id && (
                  <div className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-1 rounded">
                    ID: {agenda.call_id}
                  </div>
                )}
              </div>
              {loadingTranscript ? (
                <div className="flex items-center gap-2 py-4 text-slate-500 text-sm">
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
                  Cargando grabación...
                </div>
              ) : localRecordings ? (
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                  <audio
                    controls
                    src={localRecordings}
                    className="w-full"
                    preload="metadata"
                  >
                    Tu navegador no soporta el elemento de audio.
                  </audio>
                </div>
              ) : null}
            </section>
          )}

          {/* Transcripción */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Play className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-lg text-slate-900">
                  Transcripción de la llamada
                </h3>
              </div>
            </div>

            {loadingTranscript ? (
              <div className="flex items-center gap-2 py-6 text-slate-500 text-sm bg-slate-50 rounded-2xl border border-slate-100 px-4">
                <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
                Cargando transcripción...
              </div>
            ) : localTranscript ? (
              <div className="bg-slate-50 rounded-2xl p-4 h-64 overflow-y-auto border border-slate-100">
                <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
                  {localTranscript}
                </pre>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <Volume2 className="w-10 h-10 mb-3 text-slate-300" />
                <p className="text-sm">No hay transcripción disponible para esta llamada.</p>
              </div>
            )}
          </section>

          {/* Llamadas asociadas */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-lg text-slate-900">
                Llamadas asociadas al número
              </h3>
            </div>

            {loadingCalls && (
              <div className="flex items-center justify-center py-6 text-slate-600">
                <RefreshCw className="w-5 h-5 animate-spin mr-2 text-blue-600" />
                Cargando llamadas...
              </div>
            )}

            {errorCalls && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-2 text-sm text-red-700 flex items-center">
                <AlertCircle className="w-4 h-4 mr-2" />
                {errorCalls}
              </div>
            )}

            {callsData && (
              <div className="space-y-3">
                <div className="text-sm text-slate-600">
                  Total:{' '}
                  <span className="font-semibold">
                    {callsData.total_llamadas}
                  </span>{' '}
                  · Origen:{' '}
                  <span className="font-semibold">
                    {callsData.resumen?.llamadas_como_origen ?? 0}
                  </span>{' '}
                  · Destino:{' '}
                  <span className="font-semibold">
                    {callsData.resumen?.llamadas_como_destino ?? 0}
                  </span>
                </div>
                {callsData.llamadas?.length ? (
                  <div className="divide-y divide-slate-200 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                    {callsData.llamadas.map((c) => (
                      <div
                        key={c.id}
                        className="p-3 md:p-4 text-sm flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                      >
                        <div className="flex-1">
                          <div className="font-semibold text-slate-800">
                            {c.call_type
                              ? c.call_type.toUpperCase()
                              : c.from_number === agenda.phone_number
                              ? 'ORIGEN'
                              : 'DESTINO'}
                          </div>
                          <div className="text-slate-600">
                            {c.from_number || '—'} → {c.to_number || '—'}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {c.created_at
                              ? new Date(c.created_at).toLocaleString('es-ES')
                              : 'Sin fecha'}{' '}
                            · {c.status || '—'} ·{' '}
                            {typeof c.duration === 'number'
                              ? `${c.duration}s`
                              : c.duration || '—'}
                          </div>
                        </div>
                        {c.recordings && (
                          <audio
                            controls
                            src={c.recordings}
                            className="md:ml-4 w-full md:w-48"
                            preload="metadata"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-slate-500 text-sm">
                    No hay llamadas registradas para este número.
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <footer className="px-8 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <Clock className="w-3 h-3" />
            {agenda.created_at
              ? `Creado el ${new Date(agenda.created_at).toLocaleString('es-ES')}`
              : 'Fecha de creación no disponible'}
          </div>
          <button
            onClick={handleClose}
            className="px-6 py-2 text-sm font-semibold bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-95"
          >
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  );
} 