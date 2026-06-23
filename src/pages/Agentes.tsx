import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import {
  RefreshCw, Save, Bot,
  Loader2, Search, ChevronLeft, Pencil,
} from 'lucide-react';
import { useCallsContext } from '../context/CallsContext';
import { fetchFolders } from '../api';
import { getCachedFolderName, setCachedFolderName } from '../lib/folderNameCache';
import {
  fetchAgentsList,
  fetchAgentLLM,
  updateAgentLLM,
  type RetellAgent,
  type RetellLLM,
} from '../services/api/agents';

interface AgentesProps {
  onNavigate: (page: string) => void;
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

function escHtml(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function processInline(text: string): string {
  // **bold**
  text = text.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  // {{variable}}
  text = text.replace(/\{\{([^}\n]+)\}\}/g,
    '<span style="display:inline-flex;align-items:center;padding:1px 6px;border-radius:4px;font-size:11px;font-family:monospace;background:#ede9fe;color:#7c3aed;border:1px solid #c4b5fd">$1</span>');
  // [BRACKETS] — action labels
  text = text.replace(/\[([^\]\n]+)\]/g,
    '<span style="font-weight:600;color:#1d4ed8">[$1]</span>');
  return text;
}

function renderMarkdown(raw: string): string {
  const lines = raw.split('\n');
  const out: string[] = [];
  let inUl = false;
  let inOl = false;

  const closeList = () => {
    if (inUl) { out.push('</ul>'); inUl = false; }
    if (inOl) { out.push('</ol>'); inOl = false; }
  };

  const hBadge = (level: string) =>
    `<span style="display:inline-flex;align-items:center;margin-left:6px;padding:1px 5px;border-radius:4px;font-size:10px;font-weight:600;font-family:monospace;background:#f1f5f9;color:#94a3b8;border:1px solid #e2e8f0;vertical-align:middle;line-height:1.4">${level}</span>`;

  for (const line of lines) {
    // H4
    if (/^####\s/.test(line)) {
      closeList();
      out.push(`<h4 style="font-size:13px;font-weight:700;color:#374151;margin:12px 0 4px">${processInline(escHtml(line.slice(5)))}${hBadge('H4')}</h4>`);
      continue;
    }
    // H3
    if (/^###\s/.test(line)) {
      closeList();
      out.push(`<h3 style="font-size:14px;font-weight:700;color:#111827;margin:16px 0 4px">${processInline(escHtml(line.slice(4)))}${hBadge('H3')}</h3>`);
      continue;
    }
    // H2
    if (/^##\s/.test(line)) {
      closeList();
      out.push(`<h2 style="font-size:16px;font-weight:800;color:#111827;margin:20px 0 6px">${processInline(escHtml(line.slice(3)))}${hBadge('H2')}</h2>`);
      continue;
    }
    // H1
    if (/^#\s/.test(line)) {
      closeList();
      out.push(`<h1 style="font-size:18px;font-weight:800;color:#111827;margin:20px 0 6px">${processInline(escHtml(line.slice(2)))}${hBadge('H1')}</h1>`);
      continue;
    }
    // Nested bullet (2+ spaces / tab + - or •)
    if (/^[ \t]{2,}[-•*]\s/.test(line)) {
      const content = line.replace(/^[ \t]+[-•*]\s/, '');
      if (!inUl) { out.push('<ul style="list-style:disc;padding-left:20px;margin:4px 0">'); inUl = true; }
      out.push(`<li style="margin-left:16px;font-size:13px;color:#4b5563;line-height:1.6">${processInline(escHtml(content))}</li>`);
      continue;
    }
    // Bullet
    if (/^[-•*]\s/.test(line)) {
      if (inOl) { out.push('</ol>'); inOl = false; }
      if (!inUl) { out.push('<ul style="list-style:disc;padding-left:20px;margin:6px 0">'); inUl = true; }
      out.push(`<li style="font-size:13px;color:#374151;line-height:1.6">${processInline(escHtml(line.slice(2)))}</li>`);
      continue;
    }
    // Numbered list
    const numMatch = line.match(/^(\d+)\.\s(.+)/);
    if (numMatch) {
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (!inOl) { out.push('<ol style="list-style:decimal;padding-left:20px;margin:6px 0">'); inOl = true; }
      out.push(`<li style="font-size:13px;color:#374151;line-height:1.6">${processInline(escHtml(numMatch[2]))}</li>`);
      continue;
    }
    // Empty
    if (line.trim() === '') {
      closeList();
      out.push('<div style="height:8px"></div>');
      continue;
    }
    // Paragraph
    closeList();
    out.push(`<p style="font-size:13px;color:#374151;line-height:1.65;margin:2px 0">${processInline(escHtml(line))}</p>`);
  }
  closeList();
  return out.join('');
}

// ─── Workspace hook ───────────────────────────────────────────────────────────

function useWorkspaces() {
  const { apiKey, apiKeyTest, clientId } = useCallsContext();
  const apiKeysToFetch = useMemo(() => {
    if (apiKeyTest && apiKeyTest.length > 0) return apiKeyTest as string[];
    if (apiKey) return [apiKey];
    return [] as string[];
  }, [apiKey, apiKeyTest]);

  const [foldersByKey, setFoldersByKey] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!apiKeysToFetch.length) return;
    const base = (clientId || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const resolve = (folders: { folderName: string }[]) => {
      if (folders.length === 1) return folders[0].folderName;
      let best = folders[0]; let bestScore = -1;
      for (const f of folders) {
        const norm = f.folderName.toLowerCase().replace(/[^a-z0-9]+/g, '');
        let score = 0;
        if (base && norm.includes(base)) score = base.length;
        else if (base) { const m = Math.min(base.length, norm.length); while (score < m && base[score] === norm[score]) score++; }
        if (score > bestScore) { bestScore = score; best = f; }
      }
      return best.folderName;
    };
    apiKeysToFetch.forEach(async (key, i) => {
      try {
        const cached = await getCachedFolderName(key);
        if (cached) { setFoldersByKey(p => ({ ...p, [key]: cached })); return; }
        const folders = await fetchFolders(clientId ?? '', i);
        if (!folders?.length) return;
        const name = resolve(folders);
        await setCachedFolderName(key, name);
        setFoldersByKey(p => ({ ...p, [key]: name }));
      } catch { /* silencioso */ }
    });
  }, [apiKey, apiKeyTest, clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  const displayNames = useMemo(() => {
    const names = apiKeysToFetch.map((key, i) => foldersByKey[key] || `Workspace ${i + 1}`);
    const count: Record<string, number> = {};
    names.forEach(n => { count[n] = (count[n] || 0) + 1; });
    const seen: Record<string, number> = {};
    return names.map(n => {
      if (count[n] === 1) return n;
      seen[n] = (seen[n] || 0) + 1;
      return `${n} (${seen[n]})`;
    });
  }, [apiKeysToFetch, foldersByKey]);

  return { apiKeysToFetch, displayNames };
}

// ─── Main component ───────────────────────────────────────────────────────────

export function Agentes({ onNavigate: _onNavigate }: AgentesProps) {
  const { clientId } = useCallsContext();
  const { apiKeysToFetch, displayNames } = useWorkspaces();
  const [workspaceIdx, setWorkspaceIdx] = useState(0);

  // list
  const [agents, setAgents]           = useState<RetellAgent[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError]     = useState<string | null>(null);
  const [search, setSearch]           = useState('');

  // detail
  const [selectedAgent, setSelectedAgent] = useState<RetellAgent | null>(null);
  const [llm, setLlm]                     = useState<RetellLLM | null>(null);
  const [loadingLLM, setLoadingLLM]       = useState(false);
  const [llmError, setLlmError]           = useState<string | null>(null);

  // editor fields — states[0].state_prompt only
  const [statePrompt, setStatePrompt]     = useState('');
  const [previewMode, setPreviewMode]     = useState<'preview' | 'markdown'>('preview');

  const [isDirty, setIsDirty]             = useState(false);
  const [saving, setSaving]               = useState(false);

  // ── list ────────────────────────────────────────────────────────────────────
  const loadList = useCallback(async (idx: number) => {
    if (!clientId) { setListError('No hay cliente disponible.'); return; }
    setLoadingList(true); setListError(null); setAgents([]); setSelectedAgent(null); setLlm(null);
    try { setAgents(await fetchAgentsList(clientId, idx)); }
    catch (e) { setListError(e instanceof Error ? e.message : 'Error al cargar agentes'); }
    finally { setLoadingList(false); }
  }, [clientId]);

  useEffect(() => { loadList(workspaceIdx); }, [workspaceIdx, clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── open agent ──────────────────────────────────────────────────────────────
  const openAgent = useCallback(async (agent: RetellAgent) => {
    setSelectedAgent(agent);
    setLlm(null); setLlmError(null); setIsDirty(false); setPreviewMode('preview');
    const llmId = agent.response_engine?.llm_id;
    if (!llmId) return;
    setLoadingLLM(true);
    try {
      const data = await fetchAgentLLM(clientId!, llmId, workspaceIdx);
      setLlm(data);
      setStatePrompt(data.states?.[0]?.state_prompt || '');
    } catch (e) {
      setLlmError(e instanceof Error ? e.message : 'Error al cargar LLM');
    } finally {
      setLoadingLLM(false);
    }
  }, [clientId, workspaceIdx]);

  const backToList = () => { setSelectedAgent(null); setLlm(null); setIsDirty(false); };

  // ── save ────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!llm?.llm_id || !clientId) return;
    setSaving(true);
    try {
      const updatedStates = llm.states
        ? [{ ...llm.states[0], state_prompt: statePrompt }, ...llm.states.slice(1)]
        : undefined;
      const payload: Record<string, unknown> = {};
      if (updatedStates) payload.states = updatedStates;

      const updated = await updateAgentLLM(clientId, llm.llm_id, payload, workspaceIdx);
      setLlm(updated);
      setStatePrompt(updated.states?.[0]?.state_prompt || '');
      setIsDirty(false);
      toast.success('Configuración guardada correctamente');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const filtered = agents.filter(a =>
    search === '' ||
    (a.agent_name || '').toLowerCase().includes(search.toLowerCase()) ||
    a.agent_id.toLowerCase().includes(search.toLowerCase())
  );

  const firstStateName = llm?.states?.[0]?.name ?? 'State';
  const hasLLM = !!llm?.llm_id;

  // ── shared header ────────────────────────────────────────────────────────────
  const PageHeader = () => (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        {selectedAgent && (
          <button onClick={backToList} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          </button>
        )}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agentes</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {selectedAgent ? selectedAgent.agent_name || 'Sin nombre' : 'Selecciona un agente para editar'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {apiKeysToFetch.length > 1 && !selectedAgent && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Workspace:</span>
            <select value={workspaceIdx} onChange={e => { setWorkspaceIdx(Number(e.target.value)); setSearch(''); setSelectedAgent(null); }}
              className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
              {apiKeysToFetch.map((_, i) => <option key={i} value={i}>{displayNames[i]}</option>)}
            </select>
          </div>
        )}
        {!selectedAgent && (
          <button onClick={() => loadList(workspaceIdx)} disabled={loadingList}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors disabled:opacity-50">
            {loadingList ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Recargar
          </button>
        )}
        {selectedAgent && (
          <button onClick={handleSave} disabled={saving || !isDirty}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg font-medium text-sm transition-colors ${
              saving || !isDirty ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200' : 'bg-[#0a2a5a] hover:bg-[#081f47] text-white shadow-sm'
            }`}>
            {saving ? <><Loader2 className="animate-spin w-4 h-4" />Guardando…</> : <><Save className="w-4 h-4" />Guardar cambios</>}
          </button>
        )}
      </div>
    </div>
  );

  // ── LIST VIEW ───────────────────────────────────────────────────────────────
  if (!selectedAgent) {
    return (
      <div className="space-y-5">
        <PageHeader />
        {listError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <strong>Error:</strong> {listError}
          </div>
        )}
        {!listError && (
          <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-[#0a2a5a] px-5 py-3 flex items-center justify-between">
              <span className="text-white text-sm font-semibold">
                {loadingList ? 'Cargando…' : `${agents.length} agente${agents.length !== 1 ? 's' : ''}`}
              </span>
              <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5">
                <Search className="w-3.5 h-3.5 text-white/60 shrink-0" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar agente…"
                  className="bg-transparent text-white placeholder-white/40 text-xs focus:outline-none w-44" />
              </div>
            </div>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#0d3060] text-white text-xs uppercase tracking-wider">
                  <th className="px-5 py-3 text-left font-semibold">Nombre</th>
                  <th className="px-5 py-3 text-left font-semibold">Idioma</th>
                  <th className="px-5 py-3 text-left font-semibold">Voz</th>
                  <th className="px-5 py-3 text-left font-semibold">LLM</th>
                  <th className="px-5 py-3 text-center font-semibold w-24"></th>
                </tr>
              </thead>
              <tbody>
                {loadingList ? (
                  <tr><td colSpan={5} className="py-16 text-center text-gray-400">
                    <div className="flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Cargando agentes…</span></div>
                  </td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={5} className="py-16 text-center text-gray-400">
                    <Bot className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">{agents.length === 0 ? 'No se encontraron agentes' : 'Sin resultados'}</p>
                  </td></tr>
                ) : filtered.map((agent, idx) => (
                  <tr key={agent.agent_id} onClick={() => openAgent(agent)}
                    className={`border-b border-gray-100 cursor-pointer transition-colors hover:bg-blue-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-blue-100 rounded-md shrink-0"><Bot className="w-3.5 h-3.5 text-blue-600" /></div>
                        <div>
                          <div className="font-medium text-gray-900">{agent.agent_name || 'Sin nombre'}</div>
                          <div className="text-[10px] font-mono text-gray-400 mt-0.5">{agent.agent_id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">{agent.language ? String(agent.language) : <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5 text-gray-500 font-mono text-xs max-w-[180px] truncate">{agent.voice_id ? String(agent.voice_id) : <span className="text-gray-300">—</span>}</td>
                    <td className="px-5 py-3.5">
                      {agent.response_engine?.llm_id
                        ? <span className="text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full truncate max-w-[140px] inline-block">{agent.response_engine.llm_id}</span>
                        : <span className="text-[10px] bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">{agent.response_engine?.type || '—'}</span>}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <button onClick={e => { e.stopPropagation(); openAgent(agent); }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-blue-50 hover:border-blue-300 text-gray-600 hover:text-blue-700 text-xs font-medium transition-colors">
                        <Pencil className="w-3 h-3" />Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // ── DETAIL VIEW ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <PageHeader />

      {isDirty && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700 flex items-center justify-between">
          <span>Hay cambios sin guardar</span>
          <button onClick={backToList} className="text-xs underline hover:no-underline">Descartar y volver</button>
        </div>
      )}


      {loadingLLM && (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /><span className="text-sm">Cargando configuración…</span>
        </div>
      )}
      {llmError && !loadingLLM && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <strong>Error:</strong> {llmError}
        </div>
      )}
      {!loadingLLM && !llmError && !hasLLM && selectedAgent.response_engine && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Este agente no usa Retell LLM (type: <code>{selectedAgent.response_engine.type}</code>). No hay prompt editable.
        </div>
      )}

      {!loadingLLM && !llmError && hasLLM && (
        <>
          {/* State editor */}
          <div className="rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Header with toggle */}
            <div className="bg-[#0a2a5a] text-white px-5 py-3.5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm">State: {firstStateName}</h3>
                  <span className="text-[10px] bg-white/15 border border-white/20 text-blue-200 px-2 py-0.5 rounded-full font-mono">
                    {statePrompt.length} chars
                  </span>
                </div>
                <p className="text-[11px] text-blue-200 mt-0.5">Script del primer estado del agente</p>
              </div>
              {/* Preview / Markdown toggle */}
              <div className="flex items-center bg-white/10 border border-white/20 rounded-lg p-0.5">
                <button onClick={() => setPreviewMode('preview')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    previewMode === 'preview' ? 'bg-white text-[#0a2a5a] shadow-sm' : 'text-white/70 hover:text-white'
                  }`}>
                  Preview
                </button>
                <button onClick={() => setPreviewMode('markdown')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    previewMode === 'markdown' ? 'bg-white text-[#0a2a5a] shadow-sm' : 'text-white/70 hover:text-white'
                  }`}>
                  Markdown
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="bg-white">
              {previewMode === 'markdown' ? (
                <div className="p-4">
                  <textarea value={statePrompt} onChange={e => { setStatePrompt(e.target.value); setIsDirty(true); }}
                    rows={28} spellCheck={false}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-800 text-sm font-mono leading-relaxed resize-y focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 placeholder-gray-400"
                    placeholder="# State prompt…" />
                </div>
              ) : (
                <div
                  className="px-8 py-6 min-h-[400px] max-h-[700px] overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(statePrompt) || '<p style="color:#9ca3af;font-size:13px">Sin contenido</p>' }}
                />
              )}
            </div>
          </div>

        </>
      )}
    </div>
  );
}
