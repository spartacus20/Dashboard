import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus, X } from 'lucide-react';
import { createAgent, fetchVoices, type RetellAgent, type RetellVoice } from '../../services/api/agents';

const LANGUAGES = [
  { value: 'es-419', label: 'Español (Latinoamérica)' },
  { value: 'es-ES', label: 'Español (España)' },
  { value: 'en-US', label: 'Inglés (EE.UU.)' },
  { value: 'pt-BR', label: 'Portugués (Brasil)' },
  { value: 'multi', label: 'Multilingüe' },
];

interface CreateAgentModalProps {
  clientId: string;
  workspaceIdx: number;
  /** Agentes del workspace, para elegir de cuál copiar el webhook. */
  agents: RetellAgent[];
  onClose: () => void;
  onCreated: (agent: RetellAgent) => void;
}

export function CreateAgentModal({ clientId, workspaceIdx, agents, onClose, onCreated }: CreateAgentModalProps) {
  const [name, setName]               = useState('');
  const [withStages, setWithStages]   = useState(false);
  const [startSpeaker, setStartSpeaker] = useState<'agent' | 'user'>('agent');
  const [language, setLanguage]       = useState('es-419');
  const [voices, setVoices]           = useState<RetellVoice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(true);
  const [voiceSearch, setVoiceSearch] = useState('');
  const [voiceId, setVoiceId]         = useState('');
  const [webhookFrom, setWebhookFrom] = useState(agents[0]?.agent_id ?? '');
  const [creating, setCreating]       = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchVoices(clientId, workspaceIdx)
      .then(v => { if (!cancelled) setVoices(v); })
      .catch(e => toast.error(e instanceof Error ? e.message : 'Error al cargar las voces'))
      .finally(() => { if (!cancelled) setLoadingVoices(false); });
    return () => { cancelled = true; };
  }, [clientId, workspaceIdx]);

  const filteredVoices = useMemo(() => {
    const q = voiceSearch.trim().toLowerCase();
    if (!q) return voices;
    return voices.filter(v =>
      [v.voice_name, v.voice_id, v.provider, v.accent, v.gender].some(f => f?.toLowerCase().includes(q)));
  }, [voices, voiceSearch]);

  const canSubmit = !!name.trim() && !!voiceId && !creating;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setCreating(true);
    try {
      const agent = await createAgent(clientId, {
        agent_name: name.trim(),
        voice_id: voiceId,
        language,
        start_speaker: startSpeaker,
        with_stages: withStages,
        webhook_from_agent_id: webhookFrom || undefined,
      }, workspaceIdx);
      toast.success(`Agente "${agent.agent_name || name}" creado`);
      onCreated(agent);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al crear el agente');
    } finally {
      setCreating(false);
    }
  };

  const fieldCls = 'mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={e => { if (e.target === e.currentTarget && !creating) onClose(); }}>
      <form
        onSubmit={e => { e.preventDefault(); handleSubmit(); }}
        className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-xl bg-white shadow-xl overflow-hidden">
        <div className="bg-[#0a2a5a] px-5 py-3.5 flex items-center justify-between shrink-0">
          <h3 className="text-white text-sm font-semibold">Nuevo agente</h3>
          <button type="button" onClick={onClose} disabled={creating} className="text-white/60 hover:text-white disabled:opacity-40">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <label className="block">
            <span className="text-xs font-medium text-gray-700">Nombre</span>
            <input autoFocus type="text" value={name} onChange={e => setName(e.target.value)} className={fieldCls} />
          </label>

          <div>
            <span className="text-xs font-medium text-gray-700">Tipo</span>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {[
                { value: false, title: 'Un solo prompt', desc: 'Todo el script en un texto' },
                { value: true, title: 'Con stages', desc: 'El script se divide en etapas con transiciones' },
              ].map(opt => (
                <button key={String(opt.value)} type="button" onClick={() => setWithStages(opt.value)}
                  className={`text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                    withStages === opt.value ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                  <span className="block font-medium text-gray-800">{opt.title}</span>
                  <span className="block text-[11px] text-gray-500 mt-0.5">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-gray-700">¿Quién habla primero?</span>
            <select value={startSpeaker} onChange={e => setStartSpeaker(e.target.value as 'agent' | 'user')} className={fieldCls}>
              <option value="agent">El agente (típico en llamadas salientes)</option>
              <option value="user">El usuario (típico en llamadas entrantes)</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-gray-700">Idioma</span>
            <select value={language} onChange={e => setLanguage(e.target.value)} className={fieldCls}>
              {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </label>

          <div>
            <span className="text-xs font-medium text-gray-700">Voz</span>
            <input type="text" value={voiceSearch} onChange={e => setVoiceSearch(e.target.value)}
              placeholder={loadingVoices ? 'Cargando voces…' : `Buscar entre ${voices.length} voces…`}
              disabled={loadingVoices} className={fieldCls} />
            <select size={6} value={voiceId} onChange={e => setVoiceId(e.target.value)}
              className="mt-2 w-full px-1 py-1 rounded-lg border border-gray-200 bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500">
              {filteredVoices.map(v => (
                <option key={v.voice_id} value={v.voice_id} className="px-2 py-1">
                  {v.voice_name} · {[v.provider, v.gender, v.accent].filter(Boolean).join(' · ')}
                </option>
              ))}
            </select>
            {!loadingVoices && filteredVoices.length === 0 && (
              <p className="text-[11px] text-gray-400 mt-1">Sin resultados</p>
            )}
          </div>

          <label className="block">
            <span className="text-xs font-medium text-gray-700">Webhook</span>
            <select value={webhookFrom} onChange={e => setWebhookFrom(e.target.value)} className={fieldCls}>
              {agents.map(a => <option key={a.agent_id} value={a.agent_id}>Copiar de: {a.agent_name || a.agent_id}</option>)}
              <option value="">No configurar</option>
            </select>
            <span className="block text-[11px] text-gray-500 mt-1">
              Elegí un agente que ya funcione: sin webhook las llamadas del agente nuevo no llegan al dashboard.
            </span>
          </label>

          <p className="text-[11px] text-gray-500">
            El agente se crea con el prompt vacío; después lo escribís en el editor. No queda asignado a ningún número.
          </p>
        </div>

        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-end gap-2 shrink-0">
          <button type="button" onClick={onClose} disabled={creating}
            className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            Cancelar
          </button>
          <button type="submit" disabled={!canSubmit}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0a2a5a] hover:bg-[#081f47] text-white text-sm font-medium disabled:opacity-50">
            {creating ? <><Loader2 className="w-4 h-4 animate-spin" />Creando…</> : <><Plus className="w-4 h-4" />Crear agente</>}
          </button>
        </div>
      </form>
    </div>
  );
}
