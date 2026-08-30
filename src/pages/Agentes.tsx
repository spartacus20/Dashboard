import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import {
  RefreshCw, Save, Bot,
  Loader2, Search, ChevronLeft, Pencil, AlignJustify,
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
    `<span data-h-badge="true" contenteditable="false" style="display:inline-flex;align-items:center;margin-left:6px;padding:1px 5px;border-radius:4px;font-size:10px;font-weight:600;font-family:monospace;background:#f1f5f9;color:#94a3b8;border:1px solid #e2e8f0;vertical-align:middle;line-height:1.4;user-select:none;cursor:default">${level}</span>`;

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
    // Empty — contenteditable="false" prevents the cursor from landing in the spacer
    if (line.trim() === '') {
      closeList();
      out.push('<div contenteditable="false" style="height:8px;pointer-events:none"></div>');
      continue;
    }
    // Paragraph
    closeList();
    out.push(`<p style="font-size:13px;color:#374151;line-height:1.65;margin:2px 0">${processInline(escHtml(line))}</p>`);
  }
  closeList();
  return out.join('');
}

// ─── HTML → Markdown converter (for contenteditable preview sync) ─────────────

function htmlToMarkdown(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;

  function nodeToMd(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    const style = el.getAttribute('style') || '';

    if (tag === 'span') {
      // Skip heading level badges — use data attribute because the browser normalizes
      // hex colors to rgb() in style, making color-based checks unreliable.
      if (el.getAttribute('data-h-badge') === 'true') return '';
      // Variable span → {{var}}  (check both hex and browser-normalized rgb)
      if (style.includes('#7c3aed') || style.includes('rgb(124, 58, 237)')) return `{{${el.textContent}}}`;
      // Action bracket span
      if (style.includes('#1d4ed8') || style.includes('rgb(29, 78, 216)')) {
        const t = el.textContent || '';
        return /^\[.*\]$/.test(t) ? t : `[${t}]`;
      }
      return Array.from(el.childNodes).map(nodeToMd).join('');
    }

    const children = Array.from(el.childNodes).map(nodeToMd).join('');

    switch (tag) {
      case 'h1': return `# ${children.trim()}\n`;
      case 'h2': return `## ${children.trim()}\n`;
      case 'h3': return `### ${children.trim()}\n`;
      case 'h4': return `#### ${children.trim()}\n`;
      case 'strong': case 'b': return `**${children}**`;
      case 'em': case 'i': return `_${children}_`;
      case 'code': return `\`${children}\``;
      case 'pre': return `\`\`\`\n${children.trim()}\n\`\`\`\n`;
      case 'blockquote': return `> ${children.trim()}\n`;
      case 'ul': return children;
      case 'ol': return children;
      case 'li': {
        const parentTag = (el.parentElement?.tagName || '').toLowerCase();
        if (parentTag === 'ol') {
          const idx = Array.from(el.parentElement!.children).indexOf(el) + 1;
          return `${idx}. ${children.trim()}\n`;
        }
        return `- ${children.trim()}\n`;
      }
      case 'p': return `${children.trim()}\n`;
      case 'br': return '\n';
      // Empty divs are blank-line spacers inserted by renderMarkdown — preserve as '\n'
      case 'div': return children.trim() ? `${children.trim()}\n` : '\n';
      default: return children;
    }
  }

  return Array.from(div.childNodes)
    .map(nodeToMd)
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ─── Language → flag emoji ────────────────────────────────────────────────────

function langFlag(lang: string): string {
  const l = lang.toLowerCase();
  if (l.startsWith('en-gb')) return '🇬🇧';
  if (l.startsWith('en'))    return '🇺🇸';
  if (l.startsWith('es-419') || l.startsWith('es-mx') || l.startsWith('es-us')) return '🇲🇽';
  if (l.startsWith('es'))    return '🇪🇸';
  if (l.startsWith('pt-br')) return '🇧🇷';
  if (l.startsWith('pt'))    return '🇵🇹';
  if (l.startsWith('fr'))    return '🇫🇷';
  if (l.startsWith('de'))    return '🇩🇪';
  if (l.startsWith('it'))    return '🇮🇹';
  if (l.startsWith('nl'))    return '🇳🇱';
  if (l.startsWith('pl'))    return '🇵🇱';
  if (l.startsWith('ru'))    return '🇷🇺';
  if (l.startsWith('tr'))    return '🇹🇷';
  if (l.startsWith('ar'))    return '🇸🇦';
  if (l.startsWith('hi'))    return '🇮🇳';
  if (l.startsWith('ja'))    return '🇯🇵';
  if (l.startsWith('zh'))    return '🇨🇳';
  if (l.startsWith('ko'))    return '🇰🇷';
  if (l.startsWith('multi')) return '🌐';
  return '🌐';
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
  // Incremented only on external loads (new agent / save). Never incremented by user edits.
  const [previewKey, setPreviewKey]       = useState(0);

  const [isDirty, setIsDirty]             = useState(false);
  const [saving, setSaving]               = useState(false);
  const [showOutline, setShowOutline]     = useState(false);

  const textareaRef             = useRef<HTMLTextAreaElement>(null);
  const previewRef              = useRef<HTMLDivElement>(null);
  const outlineButtonRef        = useRef<HTMLButtonElement>(null);
  // statePromptRef always holds the latest value so the effect closure is never stale
  const statePromptRef          = useRef(statePrompt);
  const isProgrammaticChange    = useRef(false);

  useEffect(() => { statePromptRef.current = statePrompt; });

  // Close outline panel when clicking outside
  useEffect(() => {
    if (!showOutline) return;
    const handler = (e: MouseEvent) => {
      if (outlineButtonRef.current && !outlineButtonRef.current.closest('[data-outline-panel]')?.contains(e.target as Node)
        && !outlineButtonRef.current.contains(e.target as Node)) {
        setShowOutline(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showOutline]);

  // Sync statePrompt → contenteditable preview ONLY when:
  //   • the user switches TO preview mode, OR
  //   • external content is loaded (previewKey bumped)
  // This intentionally never fires while the user is typing in the preview,
  // which would reset innerHTML and jump the cursor to the top.
  useEffect(() => {
    if (previewMode === 'preview' && previewRef.current) {
      previewRef.current.innerHTML =
        renderMarkdown(statePromptRef.current) ||
        '<p style="color:#9ca3af;font-size:13px">Sin contenido</p>';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewMode, previewKey]);

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
      setPreviewKey(k => k + 1);
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
    // If editing in preview mode, get the latest content directly from the DOM
    // (statePrompt might be stale since we avoid re-renders during preview editing)
    const promptToSave = (previewMode === 'preview' && previewRef.current)
      ? htmlToMarkdown(previewRef.current.innerHTML)
      : statePrompt;
    try {
      const updatedStates = llm.states
        ? [{ ...llm.states[0], state_prompt: promptToSave }, ...llm.states.slice(1)]
        : undefined;
      const payload: Record<string, unknown> = {};
      if (updatedStates) payload.states = updatedStates;

      const updated = await updateAgentLLM(clientId, llm.llm_id, payload, workspaceIdx);
      setLlm(updated);
      setStatePrompt(updated.states?.[0]?.state_prompt || '');
      setPreviewKey(k => k + 1);
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

  // ── Extract headings for the outline panel ───────────────────────────────────
  const getOutlineHeadings = useCallback(() => {
    type Heading = { level: number; text: string; el: Element | null };
    const results: Heading[] = [];

    if (previewMode === 'preview' && previewRef.current) {
      // Read directly from the live DOM
      previewRef.current.querySelectorAll('h1,h2,h3,h4').forEach(el => {
        const level = parseInt(el.tagName[1]);
        // Remove badge text
        const clone = el.cloneNode(true) as Element;
        clone.querySelectorAll('[data-h-badge="true"]').forEach(s => s.remove());
        const text = clone.textContent?.trim() || '';
        if (text) results.push({ level, text, el });
      });
    } else {
      // Parse from markdown text
      statePromptRef.current.split('\n').forEach(line => {
        const m = line.match(/^(#{1,4})\s+(.+)/);
        if (m) results.push({ level: m[1].length, text: m[2].trim(), el: null });
      });
    }
    return results;
  }, [previewMode]);

  // ── Sync contenteditable → statePrompt (called only on mode switch / save / toolbar) ──
  // Never called from onInput — that would trigger re-renders and jump the cursor.
  const syncPreviewToMarkdown = useCallback(() => {
    if (!previewRef.current) return;
    const md = htmlToMarkdown(previewRef.current.innerHTML);
    statePromptRef.current = md;
    setStatePrompt(md);
  }, []);

  // ── Apply formatting ──────────────────────────────────────────────────────────
  const applyFormat = useCallback((type: string) => {
    if (previewMode === 'markdown') {
      const ta = textareaRef.current;
      if (!ta) return;
      const val = statePrompt;
      const ss = ta.selectionStart;
      const se = ta.selectionEnd;
      const lineStart = val.lastIndexOf('\n', ss - 1) + 1;
      const lineEndRaw = val.indexOf('\n', se);
      const lineEnd = lineEndRaw === -1 ? val.length : lineEndRaw;
      const line = val.slice(lineStart, lineEnd);

      const setLine = (newLine: string) => {
        const diff = newLine.length - line.length;
        const newVal = val.slice(0, lineStart) + newLine + val.slice(lineEnd);
        setStatePrompt(newVal);
        setIsDirty(true);
        setTimeout(() => {
          ta.focus();
          ta.selectionStart = Math.max(lineStart, ss + diff);
          ta.selectionEnd = Math.max(lineStart, se + diff);
        }, 0);
      };

      switch (type) {
        case 'h1': case 'h2': case 'h3': case 'h4': {
          const newLevel  = parseInt(type[1]);
          const currLevel = (line.match(/^(#+)\s/) ?? ['', ''])[1].length;
          const stripped  = line.replace(/^#+\s*/, '').trimStart();
          // Toggle: misma nivel → quitar heading; distinto nivel → aplicar nuevo
          setLine(currLevel === newLevel ? stripped : '#'.repeat(newLevel) + ' ' + stripped);
          break;
        }
        case 'bold': {
          const sel = val.slice(ss, se);
          if (!sel) break;
          const isBold = sel.startsWith('**') && sel.endsWith('**');
          const newSel = isBold ? sel.slice(2, -2) : `**${sel}**`;
          const newVal = val.slice(0, ss) + newSel + val.slice(se);
          setStatePrompt(newVal); setIsDirty(true);
          setTimeout(() => { ta.focus(); ta.selectionStart = ss; ta.selectionEnd = ss + newSel.length; }, 0);
          return;
        }
        case 'bullet': {
          const stripped = line.replace(/^[-•*]\s|^\d+\.\s/, '');
          setLine(/^[-•*]\s/.test(line) ? stripped : '- ' + stripped);
          break;
        }
        case 'numbered': {
          const stripped = line.replace(/^\d+\.\s|^[-•*]\s/, '');
          setLine(/^\d+\.\s/.test(line) ? stripped : '1. ' + stripped);
          break;
        }
        case 'indent':  setLine('  ' + line); break;
        case 'outdent': setLine(line.replace(/^  /, '')); break;
        case 'code': {
          const sel = val.slice(ss, se);
          if (!sel) break;
          const newSel = sel.startsWith('`') && sel.endsWith('`') ? sel.slice(1, -1) : `\`${sel}\``;
          const newVal = val.slice(0, ss) + newSel + val.slice(se);
          setStatePrompt(newVal); setIsDirty(true);
          setTimeout(() => { ta.focus(); ta.selectionStart = ss; ta.selectionEnd = ss + newSel.length; }, 0);
          return;
        }
        case 'quote': {
          const stripped = line.replace(/^>\s/, '');
          setLine(/^>\s/.test(line) ? stripped : '> ' + stripped);
          break;
        }
        case 'braces': {
          const sel = val.slice(ss, se);
          const ins = sel ? `{{${sel}}}` : '{{variable}}';
          const newVal = val.slice(0, ss) + ins + val.slice(se);
          setStatePrompt(newVal); setIsDirty(true);
          setTimeout(() => { ta.focus(); ta.selectionStart = ss; ta.selectionEnd = ss + ins.length; }, 0);
          return;
        }
      }
    } else {
      // ── Preview (contenteditable) mode ────────────────────────────────────
      const div = previewRef.current;
      if (!div) return;
      div.focus();

      const hBadgeHtml = (label: string) =>
        `<span data-h-badge="true" contenteditable="false" style="display:inline-flex;align-items:center;margin-left:6px;padding:1px 5px;border-radius:4px;font-size:10px;font-weight:600;font-family:monospace;background:#f1f5f9;color:#94a3b8;border:1px solid #e2e8f0;vertical-align:middle;line-height:1.4;user-select:none;cursor:default">${label}</span>`;

      const headingStyles: Record<string, { size: string; weight: string; margin: string }> = {
        h1: { size: '18px', weight: '800', margin: '20px 0 6px' },
        h2: { size: '16px', weight: '800', margin: '20px 0 6px' },
        h3: { size: '14px', weight: '700', margin: '16px 0 4px' },
        h4: { size: '13px', weight: '700', margin: '12px 0 4px' },
      };

      isProgrammaticChange.current = true;

      // ── Shared helpers ───────────────────────────────────────────────────────
      const restoreCursor = (el: Element) => {
        try {
          const range = document.createRange();
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
            acceptNode: n => (n.parentElement?.closest('[contenteditable="false"]'))
              ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
          });
          const first = walker.nextNode();
          if (first) range.setStart(first, 0);
          else range.setStartBefore(el);
          range.collapse(true);
          const s = window.getSelection();
          s?.removeAllRanges();
          s?.addRange(range);
        } catch { /* ignore */ }
      };

      // Returns the nearest block ancestor (H1-4, P, DIV, LI) of the current cursor
      const getBlockAtCursor = (root: Element): Element | null => {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return null;
        let node: Node | null = sel.getRangeAt(0).commonAncestorContainer;
        while (node && node !== root) {
          if (node instanceof Element && /^(H[1-4]|P|DIV|LI)$/.test(node.tagName)) return node;
          node = node.parentNode;
        }
        return null;
      };

      if (['h1', 'h2', 'h3', 'h4'].includes(type)) {
        const blockEl = getBlockAtCursor(div);

        const buildHeading = (sourceEl: Element) => {
          const clone = sourceEl.cloneNode(true) as Element;
          clone.querySelectorAll('[data-h-badge="true"]').forEach(s => s.remove());
          const { size, weight, margin } = headingStyles[type];
          const h = document.createElement(type.toUpperCase());
          h.style.cssText = `font-size:${size};font-weight:${weight};color:#111827;margin:${margin}`;
          h.innerHTML = clone.innerHTML.trim() + hBadgeHtml(type.toUpperCase());
          return h;
        };

        if (blockEl && blockEl !== div) {
          if (blockEl.tagName === 'LI') {
            // ── Convert list item → heading ──────────────────────────────────
            const list = blockEl.parentElement!;
            const lis  = Array.from(list.children);
            const idx  = lis.indexOf(blockEl);
            const before = lis.slice(0, idx);
            const after  = lis.slice(idx + 1);

            const newHeading = buildHeading(blockEl);
            const frag = document.createDocumentFragment();
            if (before.length > 0) {
              const prevList = document.createElement(list.tagName);
              prevList.setAttribute('style', list.getAttribute('style') || '');
              before.forEach(li => prevList.appendChild(li.cloneNode(true)));
              frag.appendChild(prevList);
            }
            frag.appendChild(newHeading);
            if (after.length > 0) {
              const nextList = document.createElement(list.tagName);
              nextList.setAttribute('style', list.getAttribute('style') || '');
              after.forEach(li => nextList.appendChild(li.cloneNode(true)));
              frag.appendChild(nextList);
            }
            list.replaceWith(frag);
            restoreCursor(newHeading);
          } else {
            // ── Change heading / paragraph level ────────────────────────────
            const newEl = buildHeading(blockEl);
            blockEl.replaceWith(newEl);
            restoreCursor(newEl);
          }
        } else {
          document.execCommand('formatBlock', false, type.toUpperCase());
        }
      } else {
        switch (type) {
          case 'bold':     document.execCommand('bold', false); break;
          case 'bullet':
          case 'numbered': {
            // ── Convert heading → list item if cursor is on a heading ────────
            const blockEl = getBlockAtCursor(div);
            if (blockEl && /^H[1-4]$/.test(blockEl.tagName)) {
              const clone = blockEl.cloneNode(true) as Element;
              clone.querySelectorAll('[data-h-badge="true"]').forEach(s => s.remove());
              const listTag  = type === 'bullet' ? 'UL' : 'OL';
              const listStyle = type === 'bullet'
                ? 'list-style:disc;padding-left:20px;margin:6px 0'
                : 'list-style:decimal;padding-left:20px;margin:6px 0';
              const newList = document.createElement(listTag);
              newList.setAttribute('style', listStyle);
              const newLi = document.createElement('LI');
              newLi.setAttribute('style', 'font-size:13px;color:#374151;line-height:1.6');
              newLi.innerHTML = clone.innerHTML.trim();
              newList.appendChild(newLi);
              blockEl.replaceWith(newList);
              restoreCursor(newLi);
            } else {
              document.execCommand(type === 'bullet' ? 'insertUnorderedList' : 'insertOrderedList', false);
            }
            break;
          }
          case 'indent':   document.execCommand('indent',              false); break;
          case 'outdent':  document.execCommand('outdent',             false); break;
          case 'quote':    document.execCommand('formatBlock',         false, 'BLOCKQUOTE'); break;
          case 'code': {
            const sel = window.getSelection();
            if (sel && !sel.isCollapsed) {
              const range = sel.getRangeAt(0);
              const text = range.toString();
              const code = document.createElement('code');
              code.style.cssText = 'background:#f1f5f9;border-radius:3px;padding:1px 4px;font-family:monospace;font-size:12px';
              code.textContent = text;
              range.deleteContents();
              range.insertNode(code);
            }
            break;
          }
          case 'braces': {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
              const range = sel.getRangeAt(0);
              const text = range.toString();
              const span = document.createElement('span');
              span.style.cssText = 'display:inline-flex;align-items:center;padding:1px 6px;border-radius:4px;font-size:11px;font-family:monospace;background:#ede9fe;color:#7c3aed;border:1px solid #c4b5fd';
              span.textContent = text || 'variable';
              range.deleteContents();
              range.insertNode(span);
            }
            break;
          }
        }
      }

      // Sync DOM → markdown after programmatic toolbar change
      setTimeout(() => {
        isProgrammaticChange.current = false;
        if (!isDirty) setIsDirty(true);
        // Update statePrompt so switching to markdown mode shows the toolbar change
        if (previewRef.current) {
          const md = htmlToMarkdown(previewRef.current.innerHTML);
          statePromptRef.current = md;
          setStatePrompt(md);
        }
      }, 10);
    }
  }, [previewMode, statePrompt, syncPreviewToMarkdown]);

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
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-indigo-800">Agentes</h1>
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
      <div className="p-8 space-y-5">
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
                  <th className="px-5 py-3 text-center font-semibold w-24"></th>
                </tr>
              </thead>
              <tbody>
                {loadingList ? (
                  <tr><td colSpan={4} className="py-16 text-center text-gray-400">
                    <div className="flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Cargando agentes…</span></div>
                  </td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={4} className="py-16 text-center text-gray-400">
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
                    <td className="px-5 py-3.5">
                      {agent.language
                        ? (() => {
                            const flag = langFlag(String(agent.language));
                            return flag !== '🌐'
                              ? <span className="text-xl leading-none">{flag}</span>
                              : <span className="text-gray-600 text-sm">{String(agent.language)}</span>;
                          })()
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 font-mono text-xs max-w-[180px] truncate">{agent.voice_id ? String(agent.voice_id) : <span className="text-gray-300">—</span>}</td>
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
    <div className="p-8 space-y-5">
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

            {/* Header — title + char count */}
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
            </div>

            {/* Toolbar */}
            <div className="bg-[#0c3166] border-t border-white/10 px-3 py-1.5 flex items-center gap-0.5">

              {/* Vista previa / Markdown toggle */}
              <div className="flex items-center bg-white/10 border border-white/20 rounded-lg p-0.5 mr-2 shrink-0">
                <button
                  onClick={() => setPreviewMode('preview')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    previewMode === 'preview' ? 'bg-white text-[#0a2a5a] shadow-sm' : 'text-white/70 hover:text-white'
                  }`}>
                  Vista previa
                </button>
                <button
                  onClick={() => {
                    // Only sync if the user actually edited in preview mode.
                    // If nothing was edited, keep statePrompt as-is to avoid
                    // a round-trip that would collapse blank lines.
                    if (previewMode === 'preview' && isDirty && previewRef.current) {
                      syncPreviewToMarkdown();
                    }
                    setPreviewMode('markdown');
                  }}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    previewMode === 'markdown' ? 'bg-white text-[#0a2a5a] shadow-sm' : 'text-white/70 hover:text-white'
                  }`}>
                  Markdown
                </button>
              </div>

              <div className="w-px h-5 bg-white/20 mx-1 shrink-0" />

              {/* Heading buttons */}
              {(['h1', 'h2', 'h3', 'h4'] as const).map(h => (
                <button
                  key={h}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => applyFormat(h)}
                  className="px-2 py-1 text-[11px] font-bold text-white/65 hover:text-white hover:bg-white/10 rounded transition-colors">
                  {h.toUpperCase()}
                </button>
              ))}

              <div className="w-px h-5 bg-white/20 mx-1 shrink-0" />

              {/* Bold */}
              <button
                onMouseDown={e => e.preventDefault()}
                onClick={() => applyFormat('bold')}
                className="px-2 py-1 text-[12px] font-black text-white/65 hover:text-white hover:bg-white/10 rounded transition-colors"
                title="Negrita">
                B
              </button>

              {/* Bullet list */}
              <button
                onMouseDown={e => e.preventDefault()}
                onClick={() => applyFormat('bullet')}
                className="px-2 py-1 text-[13px] text-white/65 hover:text-white hover:bg-white/10 rounded transition-colors leading-none"
                title="Lista con viñetas">
                •
              </button>

              {/* Numbered list */}
              <button
                onMouseDown={e => e.preventDefault()}
                onClick={() => applyFormat('numbered')}
                className="px-2 py-1 text-[11px] text-white/65 hover:text-white hover:bg-white/10 rounded transition-colors"
                title="Lista numerada">
                1.
              </button>

              <div className="w-px h-5 bg-white/20 mx-1 shrink-0" />

              {/* Outdent */}
              <button
                onMouseDown={e => e.preventDefault()}
                onClick={() => applyFormat('outdent')}
                className="px-2 py-1 text-[13px] text-white/65 hover:text-white hover:bg-white/10 rounded transition-colors"
                title="Reducir sangría">
                ⊣
              </button>

              {/* Indent */}
              <button
                onMouseDown={e => e.preventDefault()}
                onClick={() => applyFormat('indent')}
                className="px-2 py-1 text-[13px] text-white/65 hover:text-white hover:bg-white/10 rounded transition-colors"
                title="Aumentar sangría">
                ⊢
              </button>

              <div className="w-px h-5 bg-white/20 mx-1 shrink-0" />

              {/* Code */}
              <button
                onMouseDown={e => e.preventDefault()}
                onClick={() => applyFormat('code')}
                className="px-2 py-1 text-[11px] font-mono text-white/65 hover:text-white hover:bg-white/10 rounded transition-colors"
                title="Código inline">
                {'<>'}
              </button>

              {/* Blockquote */}
              <button
                onMouseDown={e => e.preventDefault()}
                onClick={() => applyFormat('quote')}
                className="px-2 py-1 text-[12px] text-white/65 hover:text-white hover:bg-white/10 rounded transition-colors"
                title="Cita">
                {"\"  \""}
              </button>

              {/* Variable braces */}
              <button
                onMouseDown={e => e.preventDefault()}
                onClick={() => applyFormat('braces')}
                className="px-2 py-1 text-[11px] font-mono text-white/65 hover:text-white hover:bg-white/10 rounded transition-colors"
                title="Insertar variable {{}}">
                {'{ }'}
              </button>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Outline / index button */}
              <div className="relative">
                <button
                  ref={outlineButtonRef}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => setShowOutline(v => !v)}
                  className={`p-1.5 rounded transition-colors ${showOutline ? 'text-white bg-white/15' : 'text-white/40 hover:text-white hover:bg-white/10'}`}
                  title="Índice del documento">
                  <AlignJustify className="w-3.5 h-3.5" />
                </button>

                {showOutline && (() => {
                  const headings = getOutlineHeadings();
                  return (
                    <div
                      data-outline-panel="true"
                      className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden"
                    >
                      <div className="bg-[#0a2a5a] px-4 py-2.5 flex items-center justify-between">
                        <span className="text-white text-xs font-semibold tracking-wide">Índice</span>
                        <button onClick={() => setShowOutline(false)} className="text-white/50 hover:text-white text-xs">✕</button>
                      </div>
                      {headings.length === 0 ? (
                        <p className="text-gray-400 text-xs text-center py-6">Sin encabezados</p>
                      ) : (
                        <ul className="max-h-80 overflow-y-auto py-2">
                          {headings.map((h, i) => (
                            <li key={i}>
                              <button
                                className="w-full text-left px-4 py-1.5 text-sm hover:bg-blue-50 transition-colors flex items-center gap-2 group"
                                style={{ paddingLeft: `${(h.level - 1) * 12 + 16}px` }}
                                onClick={() => {
                                  const target = h.el;
                                  setShowOutline(false);
                                  if (!target || !previewRef.current) return;
                                  const container = previewRef.current;
                                  // Wait for panel to close before calculating positions
                                  requestAnimationFrame(() => {
                                    // Walk offsetParent chain to get top offset relative to container
                                    let top = 0;
                                    let node: HTMLElement | null = target as HTMLElement;
                                    while (node && node !== container) {
                                      top += node.offsetTop;
                                      node = node.offsetParent as HTMLElement | null;
                                    }
                                    container.scrollTo({ top: Math.max(0, top - 16), behavior: 'smooth' });
                                  });
                                }}
                              >
                                <span className={`shrink-0 text-[10px] font-mono font-bold px-1 py-0.5 rounded ${
                                  h.level === 1 ? 'bg-blue-100 text-blue-700' :
                                  h.level === 2 ? 'bg-purple-100 text-purple-700' :
                                  h.level === 3 ? 'bg-green-100 text-green-700' :
                                  'bg-gray-100 text-gray-500'
                                }`}>H{h.level}</span>
                                <span className={`truncate text-gray-700 group-hover:text-blue-700 ${h.level === 1 ? 'font-semibold' : h.level === 2 ? 'font-medium' : 'font-normal'}`}>
                                  {h.text}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Content */}
            <div className="bg-white">
              {previewMode === 'markdown' ? (
                <div key="markdown-editor" className="p-4">
                  <textarea
                    ref={textareaRef}
                    value={statePrompt}
                    onChange={e => { setStatePrompt(e.target.value); setIsDirty(true); }}
                    rows={28}
                    spellCheck={false}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-800 text-sm font-mono leading-relaxed resize-y focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 placeholder-gray-400"
                    placeholder="# State prompt…"
                  />
                </div>
              ) : (
                <div
                  key="preview-editor"
                  ref={previewRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={() => { if (!isDirty) setIsDirty(true); }}
                  onClick={e => {
                    // If the click landed on the container itself (padding area, not on text/content),
                    // redirect the cursor to the start of the first actual content element.
                    if (e.target !== e.currentTarget) return;
                    const div = previewRef.current;
                    if (!div) return;
                    const first = div.firstElementChild as HTMLElement | null;
                    if (!first) return;
                    const range = document.createRange();
                    const textNode = first.firstChild;
                    if (textNode) {
                      range.setStart(textNode, 0);
                    } else {
                      range.setStartBefore(first);
                    }
                    range.collapse(true);
                    const sel = window.getSelection();
                    sel?.removeAllRanges();
                    sel?.addRange(range);
                  }}
                  className="px-8 py-6 min-h-[400px] max-h-[700px] overflow-y-auto focus:outline-none caret-gray-700 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-0.5"
                />
              )}
            </div>
          </div>

        </>
      )}
    </div>
  );
}
