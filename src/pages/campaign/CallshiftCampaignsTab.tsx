import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, Pause, Play, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import {
  CallshiftAgent,
  CallshiftCampaign,
  CallshiftCampaignStatus,
  CallshiftPhone,
  deleteCallshiftCampaign,
  fetchCallshiftAgents,
  fetchCallshiftCampaigns,
  fetchCallshiftPhones,
  setCallshiftCampaignActive,
} from '../../services/api/callshift';
import { CallshiftNewCampaignModal } from './CallshiftNewCampaignModal';

// Campañas de CallShift del cliente: listado con métricas, pausar/reanudar, borrar y
// crear nuevas. Solo aparecen las campañas de los agentes asignados al cliente.

const REFRESH_MS = 30_000;

const STATUS: Record<CallshiftCampaignStatus, { label: string; cls: string }> = {
  in_progress: { label: 'En curso', cls: 'bg-blue-100 text-blue-800' },
  scheduled: { label: 'Programada', cls: 'bg-amber-100 text-amber-700' },
  schedule_failed: { label: 'No se pudo lanzar', cls: 'bg-red-100 text-red-700' },
  paused: { label: 'Pausada', cls: 'bg-slate-200 text-slate-700' },
  draft: { label: 'Sin lanzar', cls: 'bg-slate-100 text-slate-600' },
  completed: { label: 'Finalizada', cls: 'bg-emerald-100 text-emerald-700' },
};

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : '—';

export function CallshiftCampaignsTab({ clientId }: { clientId: string }) {
  const [campaigns, setCampaigns] = useState<CallshiftCampaign[]>([]);
  const [agents, setAgents] = useState<CallshiftAgent[]>([]);
  const [phones, setPhones] = useState<CallshiftPhone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<CallshiftCampaign | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadCampaigns = useCallback(async () => {
    try {
      setCampaigns(await fetchCallshiftCampaigns(clientId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar las campañas');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    setLoading(true);
    loadCampaigns();
    Promise.all([fetchCallshiftAgents(clientId), fetchCallshiftPhones(clientId)])
      .then(([a, p]) => {
        setAgents(a);
        setPhones(p);
      })
      .catch(() => {});
    const id = window.setInterval(loadCampaigns, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [clientId, loadCampaigns]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return campaigns.filter(
      (c) => !term || (c.name || '').toLowerCase().includes(term) || (c.agent_name || '').toLowerCase().includes(term),
    );
  }, [campaigns, search]);

  const toggle = async (c: CallshiftCampaign) => {
    setBusy(c.campaign_id);
    setError(null);
    try {
      const res = await setCallshiftCampaignActive(clientId, c.campaign_id, !c.active);
      if (res.webhook?.warning) setNotice(res.webhook.warning);
      await loadCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la campaña');
    } finally {
      setBusy(null);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setBusy(toDelete.campaign_id);
    setError(null);
    try {
      const res = await deleteCallshiftCampaign(clientId, toDelete.campaign_id);
      setNotice(res.warnings.length ? `Campaña borrada. ${res.warnings.join(' ')}` : 'Campaña borrada.');
      setToDelete(null);
      await loadCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo borrar la campaña');
    } finally {
      setBusy(null);
    }
  };

  const canCreate = agents.length > 0 && phones.length > 0;

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200">
      <div className="p-6 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-slate-50 to-blue-50">
        <h3 className="text-lg font-semibold text-slate-800">Campañas</h3>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar campaña o agente"
              className="pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <Button type="button" variant="outline" onClick={() => { setLoading(true); loadCampaigns(); }} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            type="button"
            onClick={() => setShowNew(true)}
            disabled={!canCreate}
            title={canCreate ? '' : 'Tu cuenta todavía no tiene un agente con número asignado'}
          >
            <Plus className="w-4 h-4 mr-1" />
            Nueva campaña
          </Button>
        </div>
      </div>

      {error && (
        <div className="m-6 mb-0 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}
      {notice && (
        <div className="m-6 mb-0 flex items-center justify-between rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
          {notice}
          <button type="button" onClick={() => setNotice(null)}>✕</button>
        </div>
      )}

      <div className="p-6">
        {loading && campaigns.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-slate-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Cargando campañas...
          </div>
        ) : visible.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            {campaigns.length === 0 ? 'Todavía no hay campañas.' : 'Ninguna campaña coincide con la búsqueda.'}
          </div>
        ) : (
          <div className="grid gap-4">
            {visible.map((c) => {
              const st = STATUS[c.status] ?? STATUS.completed;
              const m = c.metrics;
              const progress = m && m.totalCalls > 0 ? Math.round((m.callsCompleted / m.totalCalls) * 100) : null;
              const canToggle = c.status !== 'completed' || c.active;
              return (
                <div key={c.campaign_id} className="rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900 truncate">{c.name || c.campaign_id}</p>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {c.agent_name || c.agent_id} · {c.phone_number || '—'}
                        {c.created_at && <> · creada {formatDate(c.created_at)}</>}
                        {c.status === 'scheduled' && c.scheduled_at && <> · se lanza {formatDate(c.scheduled_at)}</>}
                      </p>
                      {c.status === 'schedule_failed' && c.schedule_error && (
                        <p className="text-xs text-red-600 mt-1">{c.schedule_error}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {canToggle && (
                        <Button type="button" size="sm" variant="outline" onClick={() => toggle(c)} disabled={busy === c.campaign_id}>
                          {busy === c.campaign_id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : c.active ? (
                            <><Pause className="w-4 h-4 mr-1" />Pausar</>
                          ) : (
                            <><Play className="w-4 h-4 mr-1" />{c.status === 'paused' ? 'Reanudar' : 'Lanzar ahora'}</>
                          )}
                        </Button>
                      )}
                      <Button type="button" size="sm" variant="outline" onClick={() => setToDelete(c)} disabled={busy === c.campaign_id}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Contactos</p>
                      <p className="text-lg font-bold text-slate-800">{m?.totalCalls ?? c.contacts_total ?? '—'}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Llamadas hechas</p>
                      <p className="text-lg font-bold text-slate-800">{m?.callsCompleted ?? '—'}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Contestadas</p>
                      <p className="text-lg font-bold text-emerald-700">{m?.reached ?? '—'}</p>
                    </div>
                  </div>
                  {progress !== null && (
                    <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-blue-500" style={{ width: `${progress}%` }} />
                    </div>
                  )}
                  {!!c.skipped_total && (
                    <p className="text-xs text-slate-400 mt-2">{c.skipped_total} contactos descartados al cargar.</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showNew && (
        <CallshiftNewCampaignModal
          clientId={clientId}
          agents={agents}
          phones={phones}
          onClose={() => setShowNew(false)}
          onLaunched={loadCampaigns}
        />
      )}

      {toDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setToDelete(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-800 mb-2">¿Borrar campaña?</h3>
            <p className="text-slate-600 text-sm mb-4">
              Se pausa &quot;{toDelete.name || toDelete.campaign_id}&quot;, se cancelan las llamadas que quedan pendientes y se
              borra. Las llamadas ya hechas siguen en el historial.
            </p>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setToDelete(null)}>Cancelar</Button>
              <Button type="button" variant="destructive" onClick={confirmDelete} disabled={busy === toDelete.campaign_id}>
                {busy === toDelete.campaign_id ? 'Borrando...' : 'Borrar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
