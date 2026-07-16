import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, CalendarClock, Loader2, Pause, Play, Plus, RefreshCw,
  RotateCcw, Search, X, XCircle,
} from 'lucide-react';
import { useCallsContext } from '../../context/CallsContext';
import {
  BatchCampaign, BatchTasksBreakdown, BatchWorkspace,
  cancelBatchCampaign, fetchBatchCampaigns, fetchBatchTasksBreakdown,
  fetchBatchWorkspaces, pauseBatchCampaign, resumeBatchCampaign,
  retryFailedBatchCampaign,
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
  const [campaigns, setCampaigns] = useState<BatchCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [workspaceFilter, setWorkspaceFilter] = useState<string>('');
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<BatchCampaign | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const firstLoad = useRef(true);

  const load = useCallback(async (withSpinner = false) => {
    if (!clientId) return;
    if (withSpinner) setLoading(true);
    try {
      // El GET de workspaces dispara el sync automático server-side la primera vez
      const [ws, list] = await Promise.all([
        firstLoad.current ? fetchBatchWorkspaces(clientId) : Promise.resolve(workspaces),
        fetchBatchCampaigns(clientId),
      ]);
      if (firstLoad.current) {
        setWorkspaces(ws);
        firstLoad.current = false;
      }
      setCampaigns(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar campañas programadas');
    } finally {
      if (withSpinner) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  // Carga inicial + polling
  useEffect(() => {
    firstLoad.current = true;
    load(true);
    const timer = setInterval(() => load(false), POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const workspaceNameById = useMemo(
    () => Object.fromEntries(workspaces.map(w => [w.id, w.name])),
    [workspaces]
  );

  const filtered = useMemo(() => {
    let list = campaigns;
    if (workspaceFilter) list = list.filter(c => c.workspace_id === workspaceFilter);
    if (searchTerm.trim()) {
      const t = searchTerm.trim().toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(t) ||
        c.id.toLowerCase().includes(t) ||
        (c.from_number ?? '').includes(t)
      );
    }
    return list;
  }, [campaigns, workspaceFilter, searchTerm]);

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
      await load(false);
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
              value={workspaceFilter}
              onChange={(e) => setWorkspaceFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos los workspaces</option>
              {workspaces.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          )}

          <button
            onClick={() => load(true)}
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
                    <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 pr-4">
                        <button onClick={() => setDetail(c)} className="text-left group">
                          <div className="font-medium text-slate-800 group-hover:text-blue-700">{c.name}</div>
                          <div className="text-xs text-slate-500">
                            {workspaceNameById[c.workspace_id] ?? 'Workspace'} · {c.from_number}
                            {scheduled && <> · <CalendarClock className="w-3 h-3 inline -mt-0.5" /> {scheduled}</>}
                            {c.call_window && <> · ventana horaria</>}
                          </div>
                        </button>
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
                      <td className="py-3 pr-0">
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
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            load(true);
          }}
        />
      )}

      {detail && clientId && (
        <BatchCampaignDetailModal
          clientId={clientId}
          campaign={detail}
          workspaceName={workspaceNameById[detail.workspace_id] ?? 'Workspace'}
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

function BatchCampaignDetailModal({ clientId, campaign, workspaceName, onClose }: {
  clientId: string;
  campaign: BatchCampaign;
  workspaceName: string;
  onClose: () => void;
}) {
  const [breakdown, setBreakdown] = useState<BatchTasksBreakdown | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const fetchIt = () =>
      fetchBatchTasksBreakdown(clientId, campaign.id)
        .then(d => { if (alive) { setBreakdown(d); setError(null); } })
        .catch(err => { if (alive) setError(err instanceof Error ? err.message : 'Error'); });
    fetchIt();
    const timer = setInterval(fetchIt, 5000);
    return () => { alive = false; clearInterval(timer); };
  }, [clientId, campaign.id]);

  const scheduled = formatScheduled(campaign);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-4 sticky top-0 bg-white rounded-t-xl">
          <div>
            <h4 className="text-lg font-semibold text-slate-800">{campaign.name}</h4>
            <p className="text-sm text-slate-500">
              {workspaceName} · {campaign.from_number}
              {scheduled && <> · programada {scheduled}</>}
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

          {!breakdown ? (
            <div className="p-8 text-center text-slate-500 flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> Cargando detalle...
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
