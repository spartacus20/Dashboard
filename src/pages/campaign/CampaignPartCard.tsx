import { useEffect, useState } from 'react';
import {
  AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Clock, Gauge, Loader2, XCircle,
} from 'lucide-react';
import {
  BatchWorkspace, WorkspaceConcurrency, fetchWorkspaceConcurrency,
} from '../../services/api/batchCampaigns';
import { CampaignPart, canCreatePart, DAYS, PartStatus } from './campaignParts';

const label = 'block text-sm font-medium text-slate-700 mb-1';
const input = 'w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500';

function StatusBadge({ status }: { status: PartStatus }) {
  if (status === 'creating') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
        <Loader2 className="w-3 h-3 animate-spin" /> Creando…
      </span>
    );
  }
  if (status === 'success') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
        <CheckCircle2 className="w-3 h-3" /> Creada
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
        <XCircle className="w-3 h-3" /> Error
      </span>
    );
  }
  return null;
}

export function CampaignPartCard({
  part, index, total, workspaces, clientId, syncing, onSyncWorkspace,
  onChange, expanded, onToggleExpand, detectedTz, timezones, disabled,
}: {
  part: CampaignPart;
  index: number;
  total: number;
  workspaces: BatchWorkspace[];
  clientId: string;
  syncing?: boolean;
  onSyncWorkspace?: (workspaceId: string) => void;
  onChange: (patch: Partial<CampaignPart>) => void;
  expanded: boolean;
  onToggleExpand: () => void;
  detectedTz: string;
  timezones: string[];
  disabled?: boolean;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [concurrency, setConcurrency] = useState<WorkspaceConcurrency | null>(null);

  const workspace = workspaces.find(w => w.id === part.workspaceId) ?? null;
  const wsNumbers = workspace?.numbers ?? (workspace?.active_number ? [workspace.active_number] : []);
  const wsAgents = workspace?.agents ?? (workspace?.active_agent ? [workspace.active_agent] : []);

  // Concurrencia en vivo del workspace de esta parte (solo informativa en avanzadas).
  useEffect(() => {
    if (!part.workspaceId) { setConcurrency(null); return; }
    let alive = true;
    setConcurrency(null);
    fetchWorkspaceConcurrency(clientId, part.workspaceId)
      .then(c => { if (alive) setConcurrency(c); })
      .catch(() => { /* informativo, no bloquea */ });
    return () => { alive = false; };
  }, [clientId, part.workspaceId]);

  // Cuando llegan números/agentes de la importación (sync) y aún no hay elegido,
  // autocompletar con el default del workspace — sin pisar una elección manual.
  useEffect(() => {
    if (!part.workspaceId) return;
    const ws = workspaces.find(w => w.id === part.workspaceId);
    if (!ws) return;
    const patch: Partial<CampaignPart> = {};
    if (!part.fromNumber) {
      const def = ws.active_number?.number ?? ws.numbers?.[0]?.number ?? '';
      if (def) patch.fromNumber = def;
    }
    if (!part.agentId) {
      const def = ws.active_agent?.retell_agent_id ?? ws.agents?.[0]?.retell_agent_id ?? '';
      if (def) patch.agentId = def;
    }
    if (Object.keys(patch).length) onChange(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaces, part.workspaceId]);

  // Al elegir un workspace: setear número/agente por defecto de ESE workspace y,
  // si aún no tiene números/agentes importados, disparar la importación.
  function handleWorkspaceChange(newId: string) {
    const ws = workspaces.find(w => w.id === newId);
    onChange({
      workspaceId: newId,
      fromNumber: ws?.active_number?.number ?? ws?.numbers?.[0]?.number ?? '',
      agentId: ws?.active_agent?.retell_agent_id ?? ws?.agents?.[0]?.retell_agent_id ?? '',
    });
    if (ws && (!ws.numbers?.length || !ws.agents?.length)) onSyncWorkspace?.(ws.id);
  }

  const toggleDay = (id: string) =>
    onChange({ windowDays: part.windowDays.includes(id) ? part.windowDays.filter(d => d !== id) : [...part.windowDays, id] });

  const summaryWs = workspace?.name ?? 'sin elegir';

  return (
    <div className={`border rounded-xl overflow-hidden ${part.status === 'error' ? 'border-red-300' : part.status === 'success' ? 'border-emerald-300' : 'border-slate-200'}`}>
      {/* Header plegable */}
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 bg-slate-50/70 hover:bg-slate-100 text-left"
      >
        <span className="flex items-center gap-2 min-w-0">
          {expanded ? <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />}
          <span className="font-semibold text-slate-800">Parte {index + 1}</span>
          <span className="text-slate-400">·</span>
          <span className="text-sm text-slate-600">{part.tasks.length.toLocaleString('es')} contactos</span>
          <span className="text-slate-400">·</span>
          <span className={`text-sm truncate ${workspace ? 'text-slate-600' : 'text-amber-600'}`}>{summaryWs}</span>
        </span>
        <span className="flex items-center gap-2 shrink-0">
          {part.status === 'idle' && !canCreatePart(part) && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
              <AlertCircle className="w-3 h-3" /> Faltan datos
            </span>
          )}
          <StatusBadge status={part.status} />
        </span>
      </button>

      {expanded && (
        <fieldset disabled={disabled} className="p-4 space-y-4 disabled:opacity-60">
          {part.status === 'error' && part.errorMsg && (
            <div className="p-2.5 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {part.errorMsg}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>Nombre de la campaña *</label>
              <input
                className={input}
                value={part.name}
                onChange={e => onChange({ name: e.target.value })}
                placeholder={`Ej: Confirmaciones — Parte ${index + 1}/${total}`}
              />
            </div>
            <div>
              <label className={label}>Workspace *</label>
              <select className={input} value={part.workspaceId} onChange={e => handleWorkspaceChange(e.target.value)}>
                <option value="">Elegí un workspace…</option>
                {workspaces.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>Número de origen *</label>
              {!part.workspaceId ? (
                <p className="text-xs text-slate-400 mt-1">Elegí primero un workspace.</p>
              ) : wsNumbers.length > 0 ? (
                <select className={input} value={part.fromNumber} onChange={e => onChange({ fromNumber: e.target.value })}>
                  <option value="">Elegí un número…</option>
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
              <label className={label}>Agente *</label>
              {!part.workspaceId ? (
                <p className="text-xs text-slate-400 mt-1">Elegí primero un workspace.</p>
              ) : wsAgents.length > 0 ? (
                <select className={input} value={part.agentId} onChange={e => onChange({ agentId: e.target.value })}>
                  <option value="">Elegí un agente…</option>
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
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Sin agentes importados en este workspace — reintentá eligiéndolo de nuevo para importarlos (el agente es obligatorio).
                </p>
              )}
            </div>
          </div>

          {/* Programación */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>¿Cuándo se lanza?</label>
              <div className="flex rounded-lg border border-slate-300 overflow-hidden">
                <button
                  type="button"
                  onClick={() => onChange({ mode: 'now' })}
                  className={`flex-1 px-3 py-2 text-sm font-medium ${part.mode === 'now' ? 'bg-[#0a2a5a] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  Ahora
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ mode: 'scheduled' })}
                  className={`flex-1 px-3 py-2 text-sm font-medium ${part.mode === 'scheduled' ? 'bg-[#0a2a5a] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  Programar
                </button>
              </div>
              {part.mode === 'scheduled' && (
                <input
                  type="datetime-local"
                  className={`${input} mt-2`}
                  value={part.scheduledAt}
                  min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                  onChange={e => onChange({ scheduledAt: e.target.value })}
                />
              )}
            </div>

            <div>
              <label className={`${label} flex items-center gap-2`}>
                <input
                  type="checkbox"
                  checked={part.useWindow}
                  onChange={e => onChange({ useWindow: e.target.checked })}
                  className="rounded border-slate-300"
                />
                <Clock className="w-4 h-4 text-slate-500" />
                Solo llamar en una franja horaria
              </label>
              {part.useWindow && (
                <div className="mt-2 space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {DAYS.map(d => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => toggleDay(d.id)}
                        className={`px-2 py-1 rounded-md text-xs font-medium border ${
                          part.windowDays.includes(d.id)
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="time" className={input} value={part.windowStart} onChange={e => onChange({ windowStart: e.target.value })} />
                    <span className="text-slate-400 text-sm">a</span>
                    <input type="time" className={input} value={part.windowEnd} onChange={e => onChange({ windowEnd: e.target.value })} />
                  </div>
                  <select className={input} value={part.timezone} onChange={e => onChange({ timezone: e.target.value })}>
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
                    value={part.maxConcurrency}
                    onChange={e => onChange({ maxConcurrency: e.target.value })}
                    placeholder={concurrency ? `Sin tope propio (la cuenta permite ${concurrency.limit})` : 'Sin tope propio'}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    {!part.workspaceId
                      ? 'Elegí un workspace para ver el límite de su cuenta de Retell.'
                      : concurrency
                        ? <>La cuenta de este workspace permite <b>{concurrency.limit}</b> llamadas simultáneas ({concurrency.current} en uso ahora). El sistema nunca supera ese techo; acá podés bajarlo solo para esta campaña.</>
                        : 'Consultando el límite de la cuenta de Retell...'}
                  </p>
                </div>

                <div>
                  <label className={`${label} flex items-center gap-2`}>
                    <input
                      type="checkbox"
                      checked={part.retriesOn}
                      onChange={e => onChange({ retriesOn: e.target.checked })}
                      className="rounded border-slate-300"
                    />
                    Reintentar llamadas no atendidas
                  </label>
                  {part.retriesOn ? (
                    <>
                      <div className="mt-2 grid sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-slate-600 mb-1">Reintentos por número (además de la inicial)</label>
                          <input type="number" min={1} max={9} className={input} value={part.maxRetries} onChange={e => onChange({ maxRetries: e.target.value })} />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-600 mb-1">Buzón de voz → reintentar en (min)</label>
                          <input type="number" min={1} className={input} value={part.delayVoicemailMin} onChange={e => onChange({ delayVoicemailMin: e.target.value })} />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-600 mb-1">No contesta → reintentar en (min)</label>
                          <input type="number" min={1} className={input} value={part.delayNoAnswerMin} onChange={e => onChange({ delayNoAnswerMin: e.target.value })} />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-600 mb-1">Ocupado → reintentar en (min)</label>
                          <input type="number" min={1} className={input} value={part.delayBusyMin} onChange={e => onChange({ delayBusyMin: e.target.value })} />
                        </div>
                      </div>
                      {(() => {
                        const r = Math.min(9, Math.max(1, parseInt(part.maxRetries, 10) || 3));
                        return (
                          <p className="text-xs text-slate-500 mt-2">
                            Se harán hasta <b>{r + 1}</b> llamadas por número: la inicial + {r} reintento{r !== 1 ? 's' : ''}.
                          </p>
                        );
                      })()}
                    </>
                  ) : (
                    <p className="text-xs text-slate-500 mt-1">Cada número se llama UNA sola vez, sin importar el resultado.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </fieldset>
      )}
    </div>
  );
}
