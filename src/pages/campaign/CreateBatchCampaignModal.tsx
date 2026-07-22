import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CalendarClock, ChevronDown, ChevronRight, Clock, FileSpreadsheet, Gauge, Loader2, Upload, X } from 'lucide-react';
import { parseBatchCsv, BatchTaskInput } from '../../lib/parseBatchCsv';
import {
  BatchWorkspace, CallWindow, WorkspaceConcurrency,
  createBatchCampaign, fetchWorkspaceConcurrency,
} from '../../services/api/batchCampaigns';
import { COMMON_TIMEZONES } from '../../lib/timezones';

const PREVIEW_ROWS = 60;

const DAYS: { id: string; label: string }[] = [
  { id: 'Monday', label: 'Lun' },
  { id: 'Tuesday', label: 'Mar' },
  { id: 'Wednesday', label: 'Mié' },
  { id: 'Thursday', label: 'Jue' },
  { id: 'Friday', label: 'Vie' },
  { id: 'Saturday', label: 'Sáb' },
  { id: 'Sunday', label: 'Dom' },
];

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function CreateBatchCampaignModal({ clientId, workspaces, syncing, onSyncWorkspace, onClose, onCreated }: {
  clientId: string;
  workspaces: BatchWorkspace[];
  syncing?: boolean;
  onSyncWorkspace?: (workspaceId: string) => void;
  onClose: () => void;
  onCreated: (createdWorkspaceId?: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const detectedTz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const timezones = useMemo(
    () => [...new Set([detectedTz, ...COMMON_TIMEZONES])],
    [detectedTz]
  );

  const [name, setName] = useState('');
  const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? '');
  const [fromNumber, setFromNumber] = useState('');
  const [agentId, setAgentId] = useState('');
  const [tasks, setTasks] = useState<BatchTaskInput[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Programación
  const [mode, setMode] = useState<'now' | 'scheduled'>('now');
  const [scheduledAt, setScheduledAt] = useState('');

  // Ventana horaria
  const [useWindow, setUseWindow] = useState(false);
  const [windowDays, setWindowDays] = useState<string[]>(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
  const [windowStart, setWindowStart] = useState('09:00');
  const [windowEnd, setWindowEnd] = useState('20:00');
  const [timezone, setTimezone] = useState(detectedTz);

  // Opciones avanzadas
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [concurrency, setConcurrency] = useState<WorkspaceConcurrency | null>(null);
  const [maxConcurrency, setMaxConcurrency] = useState(''); // vacío = sin tope propio
  const [retriesOn, setRetriesOn] = useState(true);
  const [maxAttempts, setMaxAttempts] = useState('3');
  const [delayVoicemailMin, setDelayVoicemailMin] = useState('240');
  const [delayNoAnswerMin, setDelayNoAnswerMin] = useState('120');
  const [delayBusyMin, setDelayBusyMin] = useState('60');

  // Concurrencia en vivo del workspace elegido (informativa + valida el tope)
  useEffect(() => {
    if (!workspaceId) return;
    let alive = true;
    setConcurrency(null);
    fetchWorkspaceConcurrency(clientId, workspaceId)
      .then(c => { if (alive) setConcurrency(c); })
      .catch(() => { /* informativo, no bloquea */ });
    return () => { alive = false; };
  }, [clientId, workspaceId]);

  const workspace = workspaces.find(w => w.id === workspaceId) ?? null;
  const wsNumbers = workspace?.numbers ?? (workspace?.active_number ? [workspace.active_number] : []);
  const wsAgents = workspace?.agents ?? (workspace?.active_agent ? [workspace.active_agent] : []);

  // Al cambiar de workspace, resetear número/agente a sus defaults
  useEffect(() => {
    const ws = workspaces.find(w => w.id === workspaceId);
    setFromNumber(ws?.active_number?.number ?? ws?.numbers?.[0]?.number ?? '');
    setAgentId(ws?.active_agent?.retell_agent_id ?? ws?.agents?.[0]?.retell_agent_id ?? '');
  }, [workspaceId, workspaces]);

  // Si el workspace elegido EN EL MODAL no tiene sus números/agentes importados,
  // disparar el sync individual (mismo mecanismo que el selector de la lista).
  useEffect(() => {
    const ws = workspaces.find(w => w.id === workspaceId);
    if (ws && (!ws.numbers?.length || !ws.agents?.length) && onSyncWorkspace) {
      onSyncWorkspace(ws.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const handleFile = async (file: File) => {
    setParsing(true);
    setError(null);
    try {
      const text = await file.text();
      const parsed = parseBatchCsv(text);
      if (parsed.error) {
        setError(parsed.error);
        setTasks([]);
        setHeaders([]);
        setFileName(null);
      } else {
        setTasks(parsed.tasks);
        setHeaders(parsed.headers);
        setFileName(file.name);
      }
    } catch {
      setError('No se pudo leer el archivo.');
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const toggleDay = (id: string) =>
    setWindowDays(prev => (prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]));

  const canSubmit =
    !submitting && name.trim().length > 0 && workspaceId && tasks.length > 0 &&
    Boolean(fromNumber) &&
    (mode === 'now' || scheduledAt) &&
    (!useWindow || (windowDays.length > 0 && toMinutes(windowEnd) > toMinutes(windowStart)));

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const call_window: CallWindow | null = useWindow
        ? {
            windows: [{ start: toMinutes(windowStart), end: toMinutes(windowEnd) }],
            timezone,
            day: windowDays,
          }
        : null;

      const minutes = (v: string) => {
        const n = parseInt(v, 10);
        return Number.isFinite(n) && n > 0 ? n * 60 : null; // → segundos
      };
      const maxConc = parseInt(maxConcurrency, 10);

      await createBatchCampaign(clientId, {
        workspace_id: workspaceId,
        name: name.trim(),
        tasks,
        from_number: fromNumber,
        ...(agentId ? { override_agent_id: agentId } : {}),
        scheduled_at: mode === 'scheduled' && scheduledAt ? new Date(scheduledAt).getTime() : null,
        call_window,
        max_concurrency: Number.isFinite(maxConc) && maxConc > 0 ? maxConc : null,
        // Reintentos: apagados = 1 intento total; encendidos = intentos + esperas elegidas
        max_retry_attempts: retriesOn ? (parseInt(maxAttempts, 10) || 3) : 1,
        retry_delay_voicemail: retriesOn ? minutes(delayVoicemailMin) : null,
        retry_delay_no_answer: retriesOn ? minutes(delayNoAnswerMin) : null,
        retry_delay_busy: retriesOn ? minutes(delayBusyMin) : null,
      });
      onCreated(workspaceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la campaña');
      setSubmitting(false);
    }
  };

  // filter(Boolean): descarta encabezados vacíos (comas de más en el CSV) que
  // además producían keys duplicadas en la tabla de preview.
  const previewColumns = (headers.length ? headers : ['phone_number']).filter(Boolean);
  const previewTasks = tasks.slice(0, PREVIEW_ROWS);

  const label = 'block text-sm font-medium text-slate-700 mb-1';
  const input = 'w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white rounded-t-xl z-10">
          <h4 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-blue-700" /> Nueva campaña programada
          </h4>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {error && (
            <div className="p-3 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>Nombre de la campaña *</label>
              <input className={input} value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Confirmaciones julio" />
            </div>
            <div>
              <label className={label}>Workspace *</label>
              <select className={input} value={workspaceId} onChange={e => setWorkspaceId(e.target.value)}>
                {workspaces.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>Número de origen *</label>
              {wsNumbers.length > 0 ? (
                <select className={input} value={fromNumber} onChange={e => setFromNumber(e.target.value)}>
                  {wsNumbers.map(n => (
                    <option key={n.id} value={n.number}>
                      {n.number}{n.label ? ` · ${n.label}` : ''}
                    </option>
                  ))}
                </select>
              ) : syncing ? (
                <p className="text-xs text-blue-600 mt-1 flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Importando los números de este workspace desde Retell...
                </p>
              ) : (
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Este workspace no tiene números en Retell (o falló la importación — reintentá eligiéndolo de nuevo).
                </p>
              )}
            </div>
            <div>
              <label className={label}>Agente</label>
              {wsAgents.length > 0 ? (
                <select className={input} value={agentId} onChange={e => setAgentId(e.target.value)}>
                  {wsAgents.map(a => (
                    <option key={a.id} value={a.retell_agent_id}>{a.name}</option>
                  ))}
                </select>
              ) : syncing ? (
                <p className="text-xs text-blue-600 mt-1 flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Importando agentes...
                </p>
              ) : (
                <p className="text-xs text-slate-500 mt-1">Sin agentes importados — se usará el agente vinculado al número en Retell.</p>
              )}
            </div>
          </div>

          {/* CSV */}
          <div>
            <label className={label}>Contactos (CSV) *</label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={parsing}
              className="w-full border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50/50 rounded-xl p-6 text-center transition-colors disabled:opacity-60"
            >
              {parsing ? (
                <span className="flex items-center justify-center gap-2 text-slate-600">
                  <Loader2 className="w-5 h-5 animate-spin" /> Procesando archivo...
                </span>
              ) : fileName ? (
                <span className="flex items-center justify-center gap-2 text-emerald-700 font-medium">
                  <FileSpreadsheet className="w-5 h-5" /> {fileName} — {tasks.length.toLocaleString('es')} contactos
                </span>
              ) : (
                <span className="flex flex-col items-center gap-1 text-slate-500">
                  <Upload className="w-6 h-6" />
                  <span className="font-medium text-slate-700">Subir CSV</span>
                  <span className="text-xs">
                    La primera columna debe llamarse <code className="bg-slate-100 px-1 rounded">phone_number</code>.
                    El resto de columnas se envían como variables al agente.
                  </span>
                </span>
              )}
            </button>
          </div>

          {/* Preview */}
          {tasks.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto max-h-56 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr>
                      {previewColumns.map((col, ci) => (
                        <th key={ci} className="text-left px-3 py-2 font-medium text-slate-600 border-b border-slate-200 whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewTasks.map((t, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="px-3 py-1.5 text-slate-700 whitespace-nowrap">{t.to_number}</td>
                        {previewColumns.slice(1).map((col, ci) => (
                          <td key={ci} className="px-3 py-1.5 text-slate-500 whitespace-nowrap">
                            {t.dynamic_variables?.[col] ?? ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {tasks.length > PREVIEW_ROWS && (
                <div className="px-3 py-2 text-xs text-slate-500 bg-slate-50 border-t border-slate-200">
                  Mostrando {PREVIEW_ROWS} de {tasks.length.toLocaleString('es')} contactos
                </div>
              )}
            </div>
          )}

          {/* Programación */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>¿Cuándo se lanza?</label>
              <div className="flex rounded-lg border border-slate-300 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setMode('now')}
                  className={`flex-1 px-3 py-2 text-sm font-medium ${mode === 'now' ? 'bg-[#0a2a5a] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  Ahora
                </button>
                <button
                  type="button"
                  onClick={() => setMode('scheduled')}
                  className={`flex-1 px-3 py-2 text-sm font-medium ${mode === 'scheduled' ? 'bg-[#0a2a5a] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  Programar
                </button>
              </div>
              {mode === 'scheduled' && (
                <input
                  type="datetime-local"
                  className={`${input} mt-2`}
                  value={scheduledAt}
                  min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                  onChange={e => setScheduledAt(e.target.value)}
                />
              )}
            </div>

            <div>
              <label className={`${label} flex items-center gap-2`}>
                <input
                  type="checkbox"
                  checked={useWindow}
                  onChange={e => setUseWindow(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <Clock className="w-4 h-4 text-slate-500" />
                Solo llamar en una franja horaria
              </label>
              {useWindow && (
                <div className="mt-2 space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {DAYS.map(d => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => toggleDay(d.id)}
                        className={`px-2 py-1 rounded-md text-xs font-medium border ${
                          windowDays.includes(d.id)
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="time" className={input} value={windowStart} onChange={e => setWindowStart(e.target.value)} />
                    <span className="text-slate-400 text-sm">a</span>
                    <input type="time" className={input} value={windowEnd} onChange={e => setWindowEnd(e.target.value)} />
                  </div>
                  <select className={input} value={timezone} onChange={e => setTimezone(e.target.value)}>
                    {timezones.map(tz => (
                      <option key={tz} value={tz}>{tz}{tz === detectedTz ? ' (tu zona)' : ''}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Opciones avanzadas: concurrencia + reintentos por campaña */}
          <div className="border border-slate-200 rounded-lg">
            <button
              type="button"
              onClick={() => setShowAdvanced(v => !v)}
              className="w-full px-4 py-2.5 flex items-center gap-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
            >
              {showAdvanced ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              Opciones avanzadas
              <span className="text-xs text-slate-400 font-normal ml-1">concurrencia y reintentos</span>
            </button>

            {showAdvanced && (
              <div className="px-4 pb-4 space-y-4 border-t border-slate-100 pt-3">
                <div>
                  <label className={`${label} flex items-center gap-1.5`}>
                    <Gauge className="w-4 h-4 text-slate-500" />
                    Llamadas simultáneas máximas de esta campaña
                  </label>
                  <input
                    type="number"
                    min={1}
                    className={input}
                    value={maxConcurrency}
                    onChange={e => setMaxConcurrency(e.target.value)}
                    placeholder={concurrency ? `Sin tope propio (la cuenta permite ${concurrency.limit})` : 'Sin tope propio'}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    {concurrency
                      ? <>Tu cuenta de Retell permite <b>{concurrency.limit}</b> llamadas simultáneas ({concurrency.current} en uso ahora). El sistema nunca supera ese techo; acá podés bajarlo solo para esta campaña.</>
                      : 'Consultando el límite de tu cuenta de Retell...'}
                  </p>
                </div>

                <div>
                  <label className={`${label} flex items-center gap-2`}>
                    <input
                      type="checkbox"
                      checked={retriesOn}
                      onChange={e => setRetriesOn(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    Reintentar llamadas no atendidas
                  </label>
                  {retriesOn && (
                    <div className="mt-2 grid sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">Intentos máximos por número</label>
                        <input type="number" min={2} max={10} className={input} value={maxAttempts} onChange={e => setMaxAttempts(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">Buzón de voz → reintentar en (min)</label>
                        <input type="number" min={1} className={input} value={delayVoicemailMin} onChange={e => setDelayVoicemailMin(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">No contesta → reintentar en (min)</label>
                        <input type="number" min={1} className={input} value={delayNoAnswerMin} onChange={e => setDelayNoAnswerMin(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">Ocupado → reintentar en (min)</label>
                        <input type="number" min={1} className={input} value={delayBusyMin} onChange={e => setDelayBusyMin(e.target.value)} />
                      </div>
                    </div>
                  )}
                  {!retriesOn && (
                    <p className="text-xs text-slate-500 mt-1">Cada número se llama UNA sola vez, sin importar el resultado.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-5 border-t border-slate-200 flex items-center justify-between gap-3 sticky bottom-0 bg-white rounded-b-xl">
          <p className="text-xs text-slate-500">
            {tasks.length > 0 && <>{tasks.length.toLocaleString('es')} llamadas se {mode === 'now' ? 'lanzarán al confirmar' : 'programarán'}{useWindow ? ' respetando la franja horaria' : ''}.</>}
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50">
              Cancelar
            </button>
            <button
              onClick={submit}
              disabled={!canSubmit}
              className="px-4 py-2 rounded-lg bg-[#0a2a5a] hover:bg-[#1e4a8a] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium flex items-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? 'Creando...' : 'Crear campaña'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
