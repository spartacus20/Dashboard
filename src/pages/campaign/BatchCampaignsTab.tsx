import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, CalendarClock, ChevronDown, Download, Loader2, Pause, Play, Plus, RefreshCw,
  RotateCcw, Search, X, XCircle,
} from 'lucide-react';
import { useCallsContext } from '../../context/CallsContext';
import {
  BatchCampaign, BatchCampaignTask, BatchTasksBreakdown, BatchWorkspace, SYSTEM_ERROR_REASON,
  UnansweredTaskRow, cancelBatchCampaign, fetchBatchCampaigns, fetchBatchCampaignTasks,
  fetchBatchTasksBreakdown, fetchBatchWorkspaces, fetchUnansweredTasks, pauseBatchCampaign,
  resumeBatchCampaign, retryFailedBatchCampaign, syncBatchWorkspace,
} from '../../services/api/batchCampaigns';
import { CreateBatchCampaignModal } from './CreateBatchCampaignModal';

const POLL_MS = 6000;

const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  planned: 'Programada',
  ongoing: 'En curso',
  paused: 'Pausada',
  sent: 'Completada',
  cancelled: 'Cancelada',
};

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  planned: 'bg-amber-100 text-amber-700',
  ongoing: 'bg-blue-100 text-blue-800',
  paused: 'bg-orange-100 text-orange-700',
  sent: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
};

function formatScheduled(campaign: BatchCampaign): string | null {
  if (!campaign.scheduled_at) return null;
  return new Date(campaign.scheduled_at).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

function progressOf(campaign: BatchCampaign): number {
  if (!campaign.total_tasks) return 0;
  const t = campaign.tasks_by_status ?? {};
  const closed = (t.completed ?? 0) + (t.failed ?? 0) + (t.cancelled ?? 0);
  return Math.min(100, Math.round((closed / campaign.total_tasks) * 100));
}

export function BatchCampaignsTab() {
  const { clientId } = useCallsContext();
  const [workspaces, setWorkspaces] = useState<BatchWorkspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');
  const [campaigns, setCampaigns] = useState<BatchCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<BatchCampaign | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [syncing, setSyncing] = useState(false);

  // 1) Cargar los workspaces UNA sola vez (upsert liviano server-side: nombre + key).
  //    Se selecciona el primero por defecto. Los números/agentes de cada workspace
  //    se importan BAJO DEMANDA al seleccionarlo (efecto 1b) — nunca todos de una.
  useEffect(() => {
    if (!clientId) return;
    let alive = true;
    fetchBatchWorkspaces(clientId)
      .then(ws => {
        if (!alive) return;
        setWorkspaces(ws);
        setSelectedWorkspaceId(prev => prev || ws[0]?.id || '');
        if (!ws.length) setLoading(false);
      })
      .catch(err => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : 'Error al cargar los workspaces');
        setLoading(false);
      });
    return () => { alive = false; };
  }, [clientId]);

  // Sync individual de UN workspace (números + agentes desde Retell).
  // Con guard anti-duplicado: si ya hay un sync en vuelo para ese workspace, no repite.
  const syncInFlight = useRef<Set<string>>(new Set());
  const ensureWorkspaceSynced = useCallback(async (workspaceId: string) => {
    if (!clientId || syncInFlight.current.has(workspaceId)) return;
    syncInFlight.current.add(workspaceId);
    setSyncing(true);
    try {
      const updated = await syncBatchWorkspace(clientId, workspaceId);
      setWorkspaces(prev => prev.map(w => (w.id === updated.id ? updated : w)));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al sincronizar el workspace con Retell');
    } finally {
      syncInFlight.current.delete(workspaceId);
      setSyncing(false);
    }
  }, [clientId]);

  // 1b) Sync individual al seleccionar en la lista: si el workspace elegido no tiene
  //     números/agentes importados (o le falta la lista completa), se piden SOLO los suyos.
  useEffect(() => {
    if (!selectedWorkspaceId) return;
    const ws = workspaces.find(w => w.id === selectedWorkspaceId);
    if (!ws) return;
    if (!ws.numbers?.length || !ws.agents?.length) void ensureWorkspaceSynced(ws.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWorkspaceId, ensureWorkspaceSynced]);

  // 2) Cargar campañas SOLO del workspace seleccionado + polling.
  //    Al cambiar de workspace se dispara una petición individual (no acumula todo).
  useEffect(() => {
    if (!clientId || !selectedWorkspaceId) return;
    let alive = true;
    const fetchIt = (spinner: boolean) => {
      if (spinner) setLoading(true);
      fetchBatchCampaigns(clientId, { workspaceId: selectedWorkspaceId })
        .then(list => { if (alive) { setCampaigns(list); setError(null); } })
        .catch(err => { if (alive) setError(err instanceof Error ? err.message : 'Error al cargar campañas programadas'); })
        .finally(() => { if (alive && spinner) setLoading(false); });
    };
    fetchIt(true);
    const timer = setInterval(() => fetchIt(false), POLL_MS);
    return () => { alive = false; clearInterval(timer); };
  }, [clientId, selectedWorkspaceId, refreshNonce]);

  const workspaceNameById = useMemo(
    () => Object.fromEntries(workspaces.map(w => [w.id, w.name])),
    [workspaces]
  );

  // El filtro por workspace ahora es server-side (cambia selectedWorkspaceId y
  // re-fetchea); acá solo se filtra por texto sobre lo ya traído.
  const filtered = useMemo(() => {
    let list = campaigns;
    if (searchTerm.trim()) {
      const t = searchTerm.trim().toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(t) ||
        c.id.toLowerCase().includes(t) ||
        (c.from_number ?? '').includes(t)
      );
    }
    return list;
  }, [campaigns, searchTerm]);

  const refresh = () => setRefreshNonce(n => n + 1);

  const runAction = async (campaign: BatchCampaign, action: 'pause' | 'resume' | 'cancel' | 'retry') => {
    if (!clientId) return;
    if (action === 'cancel' && !window.confirm(`¿Cancelar la campaña "${campaign.name}"? Las llamadas pendientes no se realizarán.`)) return;
    setActionBusy(`${campaign.id}:${action}`);
    setError(null);
    try {
      if (action === 'pause') await pauseBatchCampaign(clientId, campaign.id);
      if (action === 'resume') await resumeBatchCampaign(clientId, campaign.id);
      if (action === 'cancel') await cancelBatchCampaign(clientId, campaign.id);
      if (action === 'retry') await retryFailedBatchCampaign(clientId, campaign.id);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'La acción falló');
    } finally {
      setActionBusy(null);
    }
  };

  const btn = 'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200">
      <div className="p-6 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-slate-50 to-blue-50">
        <div>
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-blue-700" />
            Campañas programadas
          </h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Envíos masivos con horarios, reintentos automáticos y pausa/reanudación
          </p>
        </div>

        <div className="flex flex-wrap gap-2 items-center justify-end">
          <div className="relative flex items-center">
            <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre o número..."
              className="pl-9 pr-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-52 min-w-0"
            />
          </div>

          {workspaces.length > 1 && (
            <select
              value={selectedWorkspaceId}
              onChange={(e) => setSelectedWorkspaceId(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Cambiar de workspace hace una petición individual de sus campañas"
            >
              {workspaces.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          )}

          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-1.5 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 px-3 py-2 rounded-lg text-slate-700 text-sm font-medium"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>

          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 bg-[#0a2a5a] border border-[#1e4a8a] hover:bg-[#1e4a8a] px-4 py-2 rounded-lg text-white text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Nueva campaña
          </button>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {error && (
          <div className="p-4 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {syncing && (
          <div className="p-3 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
            <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
            Importando números y agentes de este workspace desde Retell...
          </div>
        )}

        {loading && campaigns.length === 0 ? (
          <div className="p-10 text-center text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Cargando campañas...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-500">
            No hay campañas programadas todavía. Creá la primera con “Nueva campaña”.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-4 font-medium">Campaña</th>
                  <th className="py-2 pr-4 font-medium">Estado</th>
                  <th className="py-2 pr-4 font-medium">Progreso</th>
                  <th className="py-2 pr-4 font-medium text-right">Total</th>
                  <th className="py-2 pr-4 font-medium text-right">Atendidas</th>
                  <th className="py-2 pr-4 font-medium text-right">Fallidas</th>
                  <th className="py-2 pr-0 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const pct = progressOf(c);
                  const scheduled = formatScheduled(c);
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setDetail(c)}
                      className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                      title="Ver detalle de la campaña"
                    >
                      <td className="py-3 pr-4">
                        <div className="font-medium text-slate-800">{c.name}</div>
                        <div className="text-xs text-slate-500">
                          {workspaceNameById[c.workspace_id] ?? 'Workspace'} · {c.from_number}
                          {scheduled && <> · <CalendarClock className="w-3 h-3 inline -mt-0.5" /> {scheduled}</>}
                          {c.call_window && <> · ventana horaria</>}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[c.status] ?? 'bg-slate-100 text-slate-700'}`}>
                          {STATUS_LABEL[c.status] ?? c.status}
                        </span>
                      </td>
                      <td className="py-3 pr-4 min-w-[130px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-slate-500 w-9 text-right">{pct}%</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-right text-slate-700">{c.total_tasks}</td>
                      <td className="py-3 pr-4 text-right text-emerald-700">{c.picked_up}</td>
                      <td className="py-3 pr-4 text-right text-red-600">{c.failed}</td>
                      {/* stopPropagation: los botones de acción no deben abrir el detalle */}
                      <td className="py-3 pr-0" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5 justify-end">
                          {c.status === 'ongoing' && (
                            <button
                              onClick={() => runAction(c, 'pause')}
                              disabled={actionBusy === `${c.id}:pause`}
                              className={`${btn} border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100`}
                              title="Pausar"
                            >
                              <Pause className="w-3.5 h-3.5" /> Pausar
                            </button>
                          )}
                          {c.status === 'paused' && (
                            <button
                              onClick={() => runAction(c, 'resume')}
                              disabled={actionBusy === `${c.id}:resume`}
                              className={`${btn} border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}
                              title="Reanudar"
                            >
                              <Play className="w-3.5 h-3.5" /> Reanudar
                            </button>
                          )}
                          {c.status === 'sent' && c.failed > 0 && (
                            <button
                              onClick={() => runAction(c, 'retry')}
                              disabled={actionBusy === `${c.id}:retry`}
                              className={`${btn} border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100`}
                              title="Reintentar fallidas"
                            >
                              <RotateCcw className="w-3.5 h-3.5" /> Reintentar
                            </button>
                          )}
                          {['planned', 'ongoing', 'paused'].includes(c.status) && (
                            <button
                              onClick={() => runAction(c, 'cancel')}
                              disabled={actionBusy === `${c.id}:cancel`}
                              className={`${btn} border-red-200 bg-red-50 text-red-700 hover:bg-red-100`}
                              title="Cancelar"
                            >
                              <XCircle className="w-3.5 h-3.5" /> Cancelar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {createOpen && clientId && (
        <CreateBatchCampaignModal
          clientId={clientId}
          workspaces={workspaces}
          syncing={syncing}
          onSyncWorkspace={ensureWorkspaceSynced}
          onClose={() => setCreateOpen(false)}
          onCreated={(createdWorkspaceId?: string) => {
            setCreateOpen(false);
            // Si la campaña se creó en otro workspace, saltar a ese; si no, refrescar
            if (createdWorkspaceId && createdWorkspaceId !== selectedWorkspaceId) {
              setSelectedWorkspaceId(createdWorkspaceId);
            } else {
              refresh();
            }
          }}
        />
      )}

      {detail && clientId && (
        <BatchCampaignDetailModal
          clientId={clientId}
          campaign={detail}
          workspace={workspaces.find(w => w.id === detail.workspace_id) ?? null}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

// ── Modal de detalle ────────────────────────────────────────

const SEVERITY_DOT: Record<string, string> = {
  success: 'bg-emerald-500',
  info: 'bg-blue-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
};

const TASK_STATUS_LABEL: Record<string, string> = {
  pending: 'Pendientes de reintento',
  queued: 'En cola',
  dialing: 'Marcando',
  in_call: 'En llamada',
  completed: 'Completadas',
  failed: 'Fallidas',
  cancelled: 'Canceladas',
};

const TASK_ROW_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Reintento programado', cls: 'bg-amber-100 text-amber-700' },
  queued: { label: 'En cola', cls: 'bg-slate-100 text-slate-600' },
  dialing: { label: 'Marcando', cls: 'bg-blue-100 text-blue-700' },
  in_call: { label: 'En llamada', cls: 'bg-blue-100 text-blue-800' },
  completed: { label: 'Completada', cls: 'bg-emerald-100 text-emerald-700' },
  failed: { label: 'Fallida', cls: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Cancelada', cls: 'bg-slate-100 text-slate-500' },
};

const TASKS_PAGE = 100;

function callDuration(task: BatchCampaignTask): string {
  if (!task.started_at || !task.ended_at) return '—';
  const secs = Math.max(0, Math.round((new Date(task.ended_at).getTime() - new Date(task.started_at).getTime()) / 1000));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function callTime(task: BatchCampaignTask): string {
  const ts = task.started_at ?? task.updated_at;
  return new Date(ts).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const WINDOW_DAY_ES: Record<string, string> = {
  Monday: 'Lun', Tuesday: 'Mar', Wednesday: 'Mié', Thursday: 'Jue',
  Friday: 'Vie', Saturday: 'Sáb', Sunday: 'Dom',
};

function minutesToHHMM(mins: number): string {
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

function formatWindow(cw: NonNullable<BatchCampaign['call_window']>): string {
  const days = cw.day.map(d => WINDOW_DAY_ES[d] ?? d).join(', ');
  const ranges = cw.windows.map(w => `${minutesToHHMM(w.start)}–${minutesToHHMM(w.end)}`).join(' y ');
  return `${days} · ${ranges} (${cw.timezone})`;
}

function retrySummary(c: BatchCampaign): string {
  const min = (s: number | null | undefined) => (s ? `${Math.round(s / 60)}m` : null);
  const parts = [
    min(c.retry_delay_voicemail) && `buzón ${min(c.retry_delay_voicemail)}`,
    min(c.retry_delay_no_answer) && `no contesta ${min(c.retry_delay_no_answer)}`,
    min(c.retry_delay_busy) && `ocupado ${min(c.retry_delay_busy)}`,
  ].filter(Boolean);
  // max_retry_attempts del backend = intentos TOTALES (incluye la llamada inicial).
  // Se muestra como reintentos = total − 1 para alinear con el formulario de creación.
  if (c.max_retry_attempts === 1) return 'Sin reintentos (1 sola llamada)';
  if (!c.max_retry_attempts && !parts.length) return 'Config del workspace';
  const total = c.max_retry_attempts ?? 3;
  const retries = Math.max(0, total - 1);
  return `${retries} reintento${retries !== 1 ? 's' : ''} (hasta ${total} llamadas)${parts.length ? ' · ' + parts.join(' · ') : ''}`;
}

// Arma y descarga un CSV compatible con el importador de "Nueva campaña"
// (columna phone_number + las variables dinámicas originales) — así el archivo
// se puede volver a subir directo para relanzar solo a estos contactos.
function downloadUnansweredCsv(rows: UnansweredTaskRow[], filenameBase: string) {
  const varKeys = [...new Set(rows.flatMap(r => Object.keys(r.dynamic_variables ?? {})))];
  const headers = ['phone_number', ...varKeys];
  const escapeCsv = (val: unknown) => {
    if (val == null) return '';
    const str = String(val);
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const csvLines = [
    headers.map(escapeCsv).join(','),
    ...rows.map(r => [r.to_number, ...varKeys.map(k => r.dynamic_variables?.[k])].map(escapeCsv).join(',')),
  ];
  const csvContent = csvLines.join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${filenameBase}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Botón + menú para descargar las tasks no atendidas: todas, por motivo puntual,
// o los errores de sistema (número inválido, etc. — separados porque reintentarlos
// no suele tener sentido). Cada opción arma un CSV listo para re-subir a una
// campaña nueva.
function DownloadFailedMenu({ clientId, campaign, breakdown }: {
  clientId: string;
  campaign: BatchCampaign;
  breakdown: BatchTasksBreakdown;
}) {
  const [open, setOpen] = useState(false);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onOutsideClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onOutsideClick);
    return () => document.removeEventListener('mousedown', onOutsideClick);
  }, []);

  // Fallback defensivo: si el batch service desplegado todavía no manda
  // picked_up_reasons (campo nuevo), no debe romper el render — mostraría todos
  // los motivos como "descargables" en vez de crashear la pantalla entera.
  const pickedUpReasons = breakdown.picked_up_reasons ?? [];
  const failReasons = breakdown.disconnection_breakdown.filter(
    ({ reason }) => !pickedUpReasons.includes(reason)
  );
  const hasSystemErrors = breakdown.top_errors.length > 0;
  if (!failReasons.length && !hasSystemErrors) return null;

  const download = async (reason: string | undefined, key: string, filenameSuffix: string) => {
    setOpen(false);
    setDownloadingKey(key);
    setDownloadError(null);
    try {
      const rows = await fetchUnansweredTasks(clientId, campaign.id, reason);
      if (rows.length) downloadUnansweredCsv(rows, `${campaign.name}_${filenameSuffix}`);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Error al descargar');
    } finally {
      setDownloadingKey(null);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        disabled={downloadingKey !== null}
        className="px-2.5 py-1 rounded-lg border border-slate-300 text-slate-700 text-xs font-medium hover:bg-slate-50 flex items-center gap-1.5 disabled:opacity-50"
      >
        {downloadingKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
        Descargar fallidas
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
      {downloadError && <p className="text-xs text-red-600 mt-1">{downloadError}</p>}
      {open && (
        <div className="absolute right-0 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-30 overflow-hidden">
          <button
            onClick={() => download(undefined, 'all', 'fallidas')}
            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Todas las fallidas
          </button>
          {failReasons.length > 0 && <div className="border-t border-slate-100" />}
          {failReasons.map(({ reason, count }) => (
            <button
              key={reason}
              onClick={() => download(reason, reason, breakdown.reason_info[reason]?.label ?? reason)}
              className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center justify-between gap-2"
            >
              <span>{breakdown.reason_info[reason]?.label ?? reason}</span>
              <span className="text-xs text-slate-400">{count}</span>
            </button>
          ))}
          {hasSystemErrors && (
            <>
              <div className="border-t border-slate-100" />
              <button
                onClick={() => download(SYSTEM_ERROR_REASON, SYSTEM_ERROR_REASON, 'errores_sistema')}
                className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Errores del sistema (número inválido, etc.)
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function BatchCampaignDetailModal({ clientId, campaign, workspace, onClose }: {
  clientId: string;
  campaign: BatchCampaign;
  workspace: BatchWorkspace | null;
  onClose: () => void;
}) {
  const workspaceName = workspace?.name ?? 'Workspace';
  const agentName = campaign.override_agent_id
    ? (workspace?.agents?.find(a => a.retell_agent_id === campaign.override_agent_id)?.name ?? campaign.override_agent_id)
    : 'Por defecto del workspace';
  const successPct = campaign.sent > 0 ? Math.round((campaign.successful / campaign.sent) * 100) : 0;
  const [breakdown, setBreakdown] = useState<BatchTasksBreakdown | null>(null);
  const [tasks, setTasks] = useState<BatchCampaignTask[]>([]);
  const [pagesLoaded, setPagesLoaded] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resumen + lista de llamadas, refrescados juntos cada 5s (se re-piden las
  // páginas ya cargadas, así las filas visibles se actualizan en vivo).
  useEffect(() => {
    let alive = true;
    const fetchIt = () => {
      fetchBatchTasksBreakdown(clientId, campaign.id)
        .then(d => { if (alive) { setBreakdown(d); setError(null); } })
        .catch(err => { if (alive) setError(err instanceof Error ? err.message : 'Error'); });
      fetchBatchCampaignTasks(clientId, campaign.id, { limit: pagesLoaded * TASKS_PAGE, offset: 0 })
        .then(list => { if (alive) setTasks(list); })
        .catch(() => { /* la lista no bloquea el resumen */ });
    };
    fetchIt();
    const timer = setInterval(fetchIt, 5000);
    return () => { alive = false; clearInterval(timer); };
  }, [clientId, campaign.id, pagesLoaded]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      setPagesLoaded(p => p + 1); // el efecto re-pide con el límite ampliado
    } finally {
      setLoadingMore(false);
    }
  };

  const scheduled = formatScheduled(campaign);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-4 sticky top-0 bg-white rounded-t-xl z-20">
          <div>
            <h4 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              {campaign.name}
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[campaign.status] ?? 'bg-slate-100 text-slate-700'}`}>
                {STATUS_LABEL[campaign.status] ?? campaign.status}
              </span>
            </h4>
            <p className="text-sm text-slate-500">
              {workspaceName} · creada {new Date(campaign.created_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
          )}

          {/* Métricas principales */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-center">
              <div className="text-xl font-semibold text-slate-800">{campaign.total_tasks}</div>
              <div className="text-xs text-slate-500">Contactos</div>
            </div>
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-100 text-center">
              <div className="text-xl font-semibold text-blue-700">{campaign.sent}</div>
              <div className="text-xs text-slate-500">Llamadas hechas</div>
            </div>
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-center">
              <div className="text-xl font-semibold text-emerald-700">{campaign.picked_up}</div>
              <div className="text-xs text-slate-500">Atendidas</div>
            </div>
            <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-center">
              <div className="text-xl font-semibold text-red-600">{campaign.failed}</div>
              <div className="text-xs text-slate-500">Fallidas</div>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-center col-span-2 sm:col-span-1">
              <div className="text-xl font-semibold text-slate-800">{successPct}%</div>
              <div className="text-xs text-slate-500">Efectividad</div>
            </div>
          </div>

          {/* Configuración de la campaña */}
          <div>
            <h5 className="text-sm font-semibold text-slate-700 mb-2">Configuración</h5>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Número de origen</p>
                <p className="text-sm font-medium text-slate-700 break-words">{campaign.from_number}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Agente</p>
                <p className="text-sm font-medium text-slate-700 break-words" title={agentName}>{agentName}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Lanzamiento</p>
                <p className="text-sm font-medium text-slate-700">{scheduled ? `Programada ${scheduled}` : 'Inmediato'}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Franja horaria</p>
                <p className="text-sm font-medium text-slate-700">{campaign.call_window ? formatWindow(campaign.call_window) : 'Sin restricción'}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Reintentos</p>
                <p className="text-sm font-medium text-slate-700">{retrySummary(campaign)}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Simultáneas máx.</p>
                <p className="text-sm font-medium text-slate-700">{campaign.max_concurrency ?? 'Sin tope propio'}</p>
              </div>
            </div>
          </div>

          {!breakdown ? (
            <div className="p-8 text-center text-slate-500 flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> Cargando detalle...
            </div>
          ) : (
            <>
              <div className="flex justify-end">
                <DownloadFailedMenu clientId={clientId} campaign={campaign} breakdown={breakdown} />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.entries(breakdown.tasks)
                  .filter(([, count]) => count > 0)
                  .map(([status, count]) => (
                    <div key={status} className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                      <div className="text-xl font-semibold text-slate-800">{count}</div>
                      <div className="text-xs text-slate-500">{TASK_STATUS_LABEL[status] ?? status}</div>
                    </div>
                  ))}
              </div>

              {breakdown.disconnection_breakdown.length > 0 && (
                <div>
                  <h5 className="text-sm font-semibold text-slate-700 mb-2">Resultado de las llamadas</h5>
                  <div className="space-y-1.5">
                    {breakdown.disconnection_breakdown.map(({ reason, count }) => {
                      const info = breakdown.reason_info[reason];
                      return (
                        <div key={reason} className="flex items-center gap-2 text-sm" title={info?.cause ?? ''}>
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${SEVERITY_DOT[info?.severity ?? 'info']}`} />
                          <span className="text-slate-700 flex-1">{info?.label ?? reason}</span>
                          <span className="text-slate-500 font-medium">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {breakdown.top_errors.length > 0 && (
                <div>
                  <h5 className="text-sm font-semibold text-slate-700 mb-2">Errores más frecuentes</h5>
                  <div className="space-y-1">
                    {breakdown.top_errors.map(({ message, count }) => (
                      <div key={message} className="flex items-start gap-2 text-xs bg-red-50 border border-red-100 rounded-lg p-2">
                        <span className="text-red-700 flex-1 break-all">{message}</span>
                        <span className="text-red-600 font-semibold">×{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lista de llamadas individuales (como el detalle de batch de Retell) */}
              {tasks.length > 0 && (
                <div>
                  <h5 className="text-sm font-semibold text-slate-700 mb-2">
                    Llamadas <span className="text-slate-400 font-normal">({campaign.total_tasks} en total)</span>
                  </h5>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto max-h-80 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-slate-50 z-10">
                          <tr className="text-left text-slate-500 border-b border-slate-200">
                            <th className="px-3 py-2 font-medium">Número</th>
                            <th className="px-3 py-2 font-medium">Estado</th>
                            <th className="px-3 py-2 font-medium">Resultado</th>
                            <th className="px-3 py-2 font-medium text-center">Intentos</th>
                            <th className="px-3 py-2 font-medium text-right">Duración</th>
                            <th className="px-3 py-2 font-medium text-right">Hora</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tasks.map(t => {
                            const st = TASK_ROW_STATUS[t.status] ?? { label: t.status, cls: 'bg-slate-100 text-slate-600' };
                            const info = t.disconnection_reason ? breakdown.reason_info[t.disconnection_reason] : null;
                            return (
                              <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="px-3 py-2 text-slate-700 whitespace-nowrap font-medium">{t.to_number}</td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  <span className={`px-1.5 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                                </td>
                                <td className="px-3 py-2 text-slate-600 whitespace-nowrap" title={info?.cause ?? t.error ?? ''}>
                                  {info ? (
                                    <span className="inline-flex items-center gap-1.5">
                                      <span className={`w-1.5 h-1.5 rounded-full ${SEVERITY_DOT[info.severity] ?? 'bg-slate-400'}`} />
                                      {info.label}
                                    </span>
                                  ) : t.error ? (
                                    <span className="text-red-600 truncate inline-block max-w-[200px] align-bottom">{t.error}</span>
                                  ) : '—'}
                                </td>
                                <td className="px-3 py-2 text-center text-slate-500">{t.attempts}</td>
                                <td className="px-3 py-2 text-right text-slate-600 tabular-nums">{callDuration(t)}</td>
                                <td className="px-3 py-2 text-right text-slate-500 whitespace-nowrap">{callTime(t)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {tasks.length >= pagesLoaded * TASKS_PAGE && tasks.length < campaign.total_tasks && (
                      <button
                        onClick={loadMore}
                        disabled={loadingMore}
                        className="w-full px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border-t border-slate-200 disabled:opacity-50"
                      >
                        Cargar más ({tasks.length} de {campaign.total_tasks})
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
