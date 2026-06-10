import { useCallback, useEffect, useRef, useState } from 'react';
import {
  INTERESADOS_MIN_DURATION_MS as MIN_DURATION_MS,
  INTERESADOS_PAGE_SIZE as PER_PAGE,
  INTERESADOS_EXPORT_PAGE_SIZE as EXPORT_PAGE_SIZE,
} from '../lib/constants';
import {
  RefreshCw,
  Search,
  X,
  Phone,
  Calendar,
  CalendarDays,
  Clock,
  FileText,
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  MapPin,
  User,
  Filter,
  Download,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { useCallsContext } from '../context/CallsContext';
import { listInteresadosCalls, getInteresadosMotivos, type InteresadosCualificacion } from '../services/api/calls';
import { getAudioUrl } from '../api';
import { listDontCallRecords } from '../services/api/dontCall';
import { getCallTranscript } from '../services/api/misc';
import type { DontCall } from '../types';

type DatePreset = 'today' | 'week' | 'month' | 'custom';

interface Llamada {
  id: number;
  created_at: string;
  duration: string | number;
  to_number: string;
  from_number?: string;
  name?: string;
  summary?: string;
  transcript?: string;
  recordings?: string;
  end_reason?: string;
  call_id?: string;
  cost?: string | number;
  provincia?: string;
  metadata?: string | Record<string, any>;
  status?: string;
  agent_id?: string;
}

interface InteresadosProps {
  onNavigate: (page: string) => void;
}

function parseMeta(raw: string | Record<string, any> | null | undefined): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

function csvEscape(val: unknown): string {
  if (val == null) return '';
  const s = String(val);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function triggerCsvDownload(filename: string, lines: string[]) {
  const bom = '\ufeff';
  const blob = new Blob([bom + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.visibility = 'hidden';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function flattenInteresadoForCsv(row: Llamada): string[] {
  const meta = parseMeta(row.metadata);
  return [
    String(row.id),
    row.created_at ?? '',
    String(row.duration ?? ''),
    row.to_number ?? '',
    row.from_number ?? '',
    row.name ?? '',
    (row.summary ?? '').replace(/\n/g, ' ').slice(0, 4000),
    row.call_id ?? '',
    row.provincia ?? '',
    row.end_reason ?? '',
    String(meta.cualificado ?? ''),
    String(meta.agenda ?? ''),
    String(meta.motivos ?? ''),
    String(meta.name ?? ''),
    String(meta.pueblo_ciudad ?? ''),
  ];
}

const INTERESADO_CSV_HEADER = [
  'id',
  'created_at',
  'duration_ms',
  'to_number',
  'from_number',
  'name',
  'summary',
  'call_id',
  'provincia',
  'end_reason',
  'meta_cualificado',
  'meta_agenda',
  'meta_motivos',
  'meta_name',
  'meta_pueblo_ciudad',
];

function interesadosCallsToCsvLines(rows: Llamada[]): string[] {
  return [
    INTERESADO_CSV_HEADER.map(csvEscape).join(','),
    ...rows.map((r) => flattenInteresadoForCsv(r).map(csvEscape).join(',')),
  ];
}

function dontCallsToCsvLines(records: DontCall[]): string[] {
  const headers = ['ID', 'Teléfono', 'Nombre', 'Campaña', 'Región', 'Fecha creación'];
  return [
    headers.map(csvEscape).join(','),
    ...records.map((record) =>
      [
        String(record.id),
        record.phone_number ?? '',
        record.name ?? '',
        record.campaña ?? '',
        record.region ?? '',
        (() => {
          try {
            return new Date(record.created_at).toLocaleString('es-ES');
          } catch {
            return record.created_at ?? '';
          }
        })(),
      ]
        .map(csvEscape)
        .join(','),
    ),
  ];
}

async function fetchAllInteresadosPages(
  apiKey: string,
  clientId: string,
  cualificacion: 'agendados' | 'cualificado' | 'no_cualificado',
  fi: string,
  ff: string,
  minDurationMs?: number,
): Promise<Llamada[]> {
  const all: Llamada[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const res = await listInteresadosCalls(apiKey, {
      client_id: clientId,
      page,
      per_page: EXPORT_PAGE_SIZE,
      sort_order: 'DESC',
      cualificacion,
      fecha_inicio: fi,
      fecha_fin: ff,
      ...(minDurationMs ? { min_duration_ms: minDurationMs } : {}),
    });
    all.push(...((res.llamadas || []) as Llamada[]));
    totalPages = Math.max(1, res.total_paginas ?? 1);
    page += 1;
  } while (page <= totalPages);
  return all;
}

async function fetchAllDontCallPages(
  apiKey: string,
  clientId: string,
  fi: string,
  ff: string,
): Promise<DontCall[]> {
  const all: DontCall[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const res = await listDontCallRecords(apiKey, {
      client_id: clientId,
      page,
      per_page: EXPORT_PAGE_SIZE,
      sort_order: 'DESC',
      fecha_inicio: fi,
      fecha_fin: ff,
    });
    all.push(...((res.registros || []) as DontCall[]));
    totalPages = Math.max(1, res.total_paginas ?? 1);
    page += 1;
  } while (page <= totalPages);
  return all;
}

function formatDuration(ms: string | number | undefined): string {
  const val = typeof ms === 'string' ? parseInt(ms, 10) : (ms ?? 0);
  if (!val || isNaN(val)) return '-';
  const totalSec = Math.floor(val / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')} min`;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return dateStr; }
}

function formatTime(sec: number): string {
  if (isNaN(sec)) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function Interesados({ onNavigate: _onNavigate }: InteresadosProps) {
  const { apiKey, clientId } = useCallsContext();

  const calcPresetDates = useCallback((preset: 'today' | 'week' | 'month') => {
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    if (preset === 'today') {
      const tomorrow = new Date(todayUTC);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      return { start: todayUTC.toISOString(), end: tomorrow.toISOString() };
    }
    if (preset === 'week') {
      const from = new Date(todayUTC);
      from.setUTCDate(from.getUTCDate() - 6);
      const to = new Date(todayUTC);
      to.setUTCDate(to.getUTCDate() + 1);
      return { start: from.toISOString(), end: to.toISOString() };
    }
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const startOfNext = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    return { start: startOfMonth.toISOString(), end: startOfNext.toISOString() };
  }, []);

  const [llamadas, setLlamadas] = useState<Llamada[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [rangeStartISO, setRangeStartISO] = useState(() => calcPresetDates('today').start);
  const [rangeEndISO, setRangeEndISO] = useState(() => calcPresetDates('today').end);
  const [showDatePresetDropdown, setShowDatePresetDropdown] = useState(false);
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const datePresetDropdownRef = useRef<HTMLDivElement>(null);

  const [searchPhone, setSearchPhone] = useState('');
  const [soloMayorUnMin, setSoloMayorUnMin] = useState(true);

  const [activeTab, setActiveTab] = useState<InteresadosCualificacion>('todos');
  const [motivoDescarte, setMotivoDescarte] = useState('');
  const [motivosOptions, setMotivosOptions] = useState<string[]>([]);
  const [loadingMotivos, setLoadingMotivos] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [totalLlamadas, setTotalLlamadas] = useState(0);
  const [totalCualificados, setTotalCualificados] = useState(0);
  const [totalNoCualificados, setTotalNoCualificados] = useState(0);
  const [totalNoLlamar, setTotalNoLlamar] = useState(0);
  const [totalConAgenda, setTotalConAgenda] = useState(0);
  const [totalTodos, setTotalTodos] = useState(0);

  /** Registros de la pestaña «No llamar» (misma API que NoLlamar.tsx / dont-call list) */
  const [dontCallRecords, setDontCallRecords] = useState<DontCall[]>([]);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedSummaryId, setExpandedSummaryId] = useState<number | null>(null);
  const [transcriptCache, setTranscriptCache] = useState<Record<string, string>>({});
  const [transcriptLoading, setTranscriptLoading] = useState<Record<string, boolean>>({});

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  const [downloadOpen, setDownloadOpen] = useState(false);
  const [downloadPreset, setDownloadPreset] = useState<DatePreset>('today');
  const [showDownloadPresetDropdown, setShowDownloadPresetDropdown] = useState(false);
  const downloadPresetDropdownRef = useRef<HTMLDivElement>(null);
  const [downloadCustomFrom, setDownloadCustomFrom] = useState('');
  const [downloadCustomTo, setDownloadCustomTo] = useState('');
  const [downloadSel, setDownloadSel] = useState({
    agendas: true,
    cualificados: true,
    noCualificados: true,
    noLlamar: true,
  });
  const [downloadModalError, setDownloadModalError] = useState<string | null>(null);
  const [downloadExporting, setDownloadExporting] = useState(false);

  // Audio setup
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.preload = 'metadata';
    const onTime = () => { if (audioRef.current) setAudioCurrentTime(audioRef.current.currentTime); };
    const onDur = () => {
      if (audioRef.current) {
        const d = audioRef.current.duration;
        setAudioDuration(d && isFinite(d) && d > 0 ? d : 0);
      }
    };
    const onEnd = () => { setPlayingId(null); setIsAudioPlaying(false); };
    const onErr = () => { setPlayingId(null); setIsAudioPlaying(false); };
    audioRef.current.addEventListener('timeupdate', onTime);
    audioRef.current.addEventListener('durationchange', onDur);
    audioRef.current.addEventListener('ended', onEnd);
    audioRef.current.addEventListener('error', onErr);
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeEventListener('timeupdate', onTime);
        audioRef.current.removeEventListener('durationchange', onDur);
        audioRef.current.removeEventListener('ended', onEnd);
        audioRef.current.removeEventListener('error', onErr);
        audioRef.current.src = '';
      }
    };
  }, []);

  /** Convierte fin de rango exclusivo (como en Recordings) al último día inclusivo para inputs tipo date */
  const toInclusiveEndDay = (endExclusiveISO: string) => {
    const d = new Date(endExclusiveISO);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  };

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!showDatePresetDropdown) return;
      const el = datePresetDropdownRef.current;
      if (el && !el.contains(e.target as Node)) setShowDatePresetDropdown(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [showDatePresetDropdown]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!showDownloadPresetDropdown) return;
      const el = downloadPresetDropdownRef.current;
      if (el && !el.contains(e.target as Node)) setShowDownloadPresetDropdown(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [showDownloadPresetDropdown]);

  const loadMotivos = useCallback(async () => {
    if (!apiKey || !clientId) return;
    setLoadingMotivos(true);
    try {
      const list = await getInteresadosMotivos(apiKey, clientId);
      setMotivosOptions(list);
    } catch {
      setMotivosOptions([]);
    } finally {
      setLoadingMotivos(false);
    }
  }, [apiKey, clientId]);

  const loadLlamadas = useCallback(async (
    page = 1,
    tabOverride?: InteresadosCualificacion,
    motivoOverride?: string,
    opts?: { fechaInicio?: string; fechaFin?: string },
  ) => {
    if (!apiKey || !clientId) return;
    setLoading(true);
    setError(null);
    try {
      const tab = tabOverride ?? activeTab;
      const mot = motivoOverride !== undefined ? motivoOverride : motivoDescarte;
      const fi = opts?.fechaInicio ?? rangeStartISO;
      const ff = opts?.fechaFin ?? rangeEndISO;

      const buildDontCallParams = (p: number) => ({
        client_id: clientId,
        per_page: PER_PAGE,
        page: p,
        sort_order: 'DESC' as const,
        ...(fi ? { fecha_inicio: fi } : {}),
        ...(ff ? { fecha_fin: ff } : {}),
        ...(searchPhone.trim() ? { search_term: searchPhone.trim() } : {}),
      });

      if (tab === 'no_llamar') {
        const res = await listDontCallRecords(apiKey, buildDontCallParams(page));
        setDontCallRecords((res.registros || []) as DontCall[]);
        setTotalNoLlamar(res.total_registros ?? 0);
        setTotalPaginas(res.total_paginas ?? 0);
        setCurrentPage(res.pagina_actual ?? page);
        setTotalLlamadas(res.total_registros ?? 0);
        setLlamadas([]);
        try {
          const snap = await listInteresadosCalls(apiKey, {
            client_id: clientId,
            page: 1,
            per_page: 1,
            sort_order: 'DESC',
            cualificacion: 'todos',
            ...(fi ? { fecha_inicio: fi } : {}),
            ...(ff ? { fecha_fin: ff } : {}),
            ...(soloMayorUnMin ? { min_duration_ms: MIN_DURATION_MS } : {}),
          });
          setTotalConAgenda(snap.total_con_agenda ?? 0);
          setTotalCualificados(snap.total_cualificados ?? 0);
          setTotalNoCualificados(snap.total_no_cualificados ?? 0);
          setTotalTodos(snap.total_todos ?? 0);
        } catch {
          /* mantener totales anteriores */
        }
        return;
      }

      setDontCallRecords([]);

      const params: Parameters<typeof listInteresadosCalls>[1] = {
        client_id: clientId,
        page,
        per_page: PER_PAGE,
        sort_order: 'DESC',
        cualificacion: tab,
      };
      if (fi) params.fecha_inicio = fi;
      if (ff) params.fecha_fin = ff;
      if (soloMayorUnMin) params.min_duration_ms = MIN_DURATION_MS;
      if (mot && tab === 'no_cualificado') params.motivo = mot;

      const res = await listInteresadosCalls(apiKey, params);
      setLlamadas(res.llamadas || []);
      setTotalLlamadas(res.total_llamadas ?? 0);
      setTotalPaginas(res.total_paginas ?? 0);
      setCurrentPage(res.pagina_actual ?? page);
      setTotalCualificados(res.total_cualificados ?? 0);
      setTotalNoCualificados(res.total_no_cualificados ?? 0);
      setTotalTodos(res.total_todos ?? 0);
      setTotalConAgenda(res.total_con_agenda ?? 0);

      try {
        const dc = await listDontCallRecords(apiKey, buildDontCallParams(1));
        setTotalNoLlamar(dc.total_registros ?? 0);
      } catch {
        setTotalNoLlamar(0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar interesados');
    } finally {
      setLoading(false);
    }
  }, [apiKey, clientId, rangeStartISO, rangeEndISO, soloMayorUnMin, activeTab, motivoDescarte, searchPhone]);

  useEffect(() => {
    if (apiKey && clientId) loadLlamadas(1);
  }, [apiKey, clientId]);

  const handleFilter = () => {
    if (datePreset === 'custom') {
      if (!customDateFrom.trim() || !customDateTo.trim()) {
        setError('Selecciona fecha desde y hasta.');
        return;
      }
      const s = `${customDateFrom}T00:00:00.000Z`;
      const e = `${customDateTo}T23:59:59.999Z`;
      setRangeStartISO(s);
      setRangeEndISO(e);
      setCurrentPage(1);
      setError(null);
      loadLlamadas(1, undefined, undefined, { fechaInicio: s, fechaFin: e });
      return;
    }
    setCurrentPage(1);
    setError(null);
    loadLlamadas(1);
  };

  const handleClearFilters = () => {
    const r = calcPresetDates('today');
    setDatePreset('today');
    setRangeStartISO(r.start);
    setRangeEndISO(r.end);
    setCustomDateFrom('');
    setCustomDateTo('');
    setSearchPhone('');
    setSoloMayorUnMin(true);
    setMotivoDescarte('');
    setCurrentPage(1);
    setError(null);
    setTimeout(() => loadLlamadas(1, activeTab, '', { fechaInicio: r.start, fechaFin: r.end }), 0);
  };

  const handleTabChange = (tab: InteresadosCualificacion) => {
    setActiveTab(tab);
    setMotivoDescarte('');
    setCurrentPage(1);
    if (tab === 'no_cualificado' && motivosOptions.length === 0) loadMotivos();
    loadLlamadas(1, tab, '');
  };

  const hasActiveFilters = !!(
    searchPhone.trim() ||
    !soloMayorUnMin ||
    motivoDescarte ||
    datePreset !== 'today'
  );

  const togglePlay = (row: Llamada) => {
    if (!audioRef.current || !row.recordings) return;
    const proxiedUrl = getAudioUrl(row.recordings);
    if (playingId === row.id && !audioRef.current.paused) {
      audioRef.current.pause();
      setIsAudioPlaying(false);
      return;
    }
    if (audioRef.current.src !== proxiedUrl) {
      audioRef.current.pause();
      audioRef.current.src = proxiedUrl;
      audioRef.current.currentTime = 0;
      setAudioCurrentTime(0);
      setAudioDuration(0);
      setPlaybackRate(1);
      audioRef.current.playbackRate = 1;
    }
    audioRef.current.play().catch(() => { setPlayingId(null); setIsAudioPlaying(false); });
    setPlayingId(row.id);
    setIsAudioPlaying(true);
  };

  const setSpeed = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) audioRef.current.playbackRate = rate;
  };

  const handleProgress = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = parseFloat(e.target.value);
    if (audioRef.current) { audioRef.current.currentTime = t; setAudioCurrentTime(t); }
  };

  const handleToggleTranscript = async (row: Llamada) => {
    if (expandedId === row.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(row.id);
    if (!row.call_id || transcriptCache[row.call_id] !== undefined) return;
    setTranscriptLoading((prev) => ({ ...prev, [row.call_id!]: true }));
    try {
      const data = await getCallTranscript(row.call_id);
      setTranscriptCache((prev) => ({ ...prev, [row.call_id!]: data.transcript ?? '' }));
    } catch {
      setTranscriptCache((prev) => ({ ...prev, [row.call_id!]: '' }));
    } finally {
      setTranscriptLoading((prev) => ({ ...prev, [row.call_id!]: false }));
    }
  };

  // Filtro local por teléfono (página cargada; misma lógica que en otras pestañas)
  const filteredLlamadas = llamadas.filter((r) => {
    if (searchPhone.trim()) {
      const phone = (r.to_number || '').replace(/\D/g, '');
      const search = searchPhone.replace(/\D/g, '');
      if (!phone.includes(search)) return false;
    }
    return true;
  });

  const filteredDontCalls = dontCallRecords.filter((r) => {
    if (searchPhone.trim()) {
      const phone = (r.phone_number || '').replace(/\D/g, '');
      const search = searchPhone.replace(/\D/g, '');
      if (!phone.includes(search)) return false;
    }
    return true;
  });

  const listIsEmpty =
    activeTab === 'no_llamar'
      ? filteredDontCalls.length === 0
      : filteredLlamadas.length === 0;

  const openDownloadModal = () => {
    setDownloadPreset(datePreset);
    if (datePreset === 'custom' && customDateFrom && customDateTo) {
      setDownloadCustomFrom(customDateFrom);
      setDownloadCustomTo(customDateTo);
    } else {
      setDownloadCustomFrom(rangeStartISO.slice(0, 10));
      setDownloadCustomTo(toInclusiveEndDay(rangeEndISO));
    }
    setShowDownloadPresetDropdown(false);
    setDownloadModalError(null);
    setDownloadOpen(true);
  };

  const handleDownloadConfirm = async () => {
    if (!apiKey || !clientId) {
      setDownloadModalError('No hay sesión válida para exportar.');
      return;
    }
    if (
      !downloadSel.agendas &&
      !downloadSel.cualificados &&
      !downloadSel.noCualificados &&
      !downloadSel.noLlamar
    ) {
      setDownloadModalError('Marca al menos un tipo de datos.');
      return;
    }
    let fi: string;
    let ff: string;
    if (downloadPreset === 'custom') {
      if (!downloadCustomFrom.trim() || !downloadCustomTo.trim()) {
        setDownloadModalError('Indica las fechas desde y hasta.');
        return;
      }
      fi = `${downloadCustomFrom.trim()}T00:00:00.000Z`;
      ff = `${downloadCustomTo.trim()}T23:59:59.999Z`;
    } else {
      const r = calcPresetDates(downloadPreset);
      fi = r.start;
      ff = r.end;
    }
    const rangeSlug = `${fi.slice(0, 10)}_a_${ff.slice(0, 10)}`;
    setDownloadExporting(true);
    setDownloadModalError(null);
    const minArg = soloMayorUnMin ? MIN_DURATION_MS : undefined;
    const pause = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));
    try {
      if (downloadSel.agendas) {
        const rows = await fetchAllInteresadosPages(apiKey, clientId, 'agendados', fi, ff, minArg);
        triggerCsvDownload(`interesados_agendas_${rangeSlug}.csv`, interesadosCallsToCsvLines(rows));
        await pause(280);
      }
      if (downloadSel.cualificados) {
        const rows = await fetchAllInteresadosPages(apiKey, clientId, 'cualificado', fi, ff, minArg);
        triggerCsvDownload(`interesados_cualificados_${rangeSlug}.csv`, interesadosCallsToCsvLines(rows));
        await pause(280);
      }
      if (downloadSel.noCualificados) {
        const rows = await fetchAllInteresadosPages(apiKey, clientId, 'no_cualificado', fi, ff, minArg);
        triggerCsvDownload(`interesados_no_cualificados_${rangeSlug}.csv`, interesadosCallsToCsvLines(rows));
        await pause(280);
      }
      if (downloadSel.noLlamar) {
        const recs = await fetchAllDontCallPages(apiKey, clientId, fi, ff);
        triggerCsvDownload(`interesados_no_llamar_${rangeSlug}.csv`, dontCallsToCsvLines(recs));
      }
      setDownloadOpen(false);
    } catch (e) {
      setDownloadModalError(e instanceof Error ? e.message : 'Error al generar la descarga');
    } finally {
      setDownloadExporting(false);
    }
  };

  return (
    <div className="p-8 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800 mb-1">Interesados</h2>
        <p className="text-slate-500 text-sm">Llamadas efectivas con sentimiento positivo captadas por el agente</p>
      </div>

      {/* Cards de resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl border-l-4 border-l-blue-500 border border-slate-200 shadow-sm p-5">
          <p className="text-sm font-semibold text-slate-600 mb-2">Agendas</p>
          <p className="text-2xl font-bold text-blue-600">{loading ? '—' : totalConAgenda.toLocaleString()}</p>
          <p className="text-sm text-slate-400 mt-1">Solicitud expresa del contacto</p>
        </div>
        <div className="bg-white rounded-2xl border-l-4 border-l-emerald-500 border border-slate-200 shadow-sm p-5">
          <p className="text-sm font-semibold text-slate-600 mb-2">Cualificados</p>
          <p className="text-2xl font-bold text-emerald-600">{loading ? '—' : totalCualificados.toLocaleString()}</p>
          <p className="text-sm text-slate-400 mt-1">Listos para agendar</p>
        </div>
        <div className="bg-white rounded-2xl border-l-4 border-l-orange-500 border border-slate-200 shadow-sm p-5">
          <p className="text-sm font-semibold text-slate-600 mb-2">No cualificados</p>
          <p className="text-2xl font-bold text-orange-500">{loading ? '—' : totalNoCualificados.toLocaleString()}</p>
          <p className="text-sm text-slate-400 mt-1">Con motivo de descarte</p>
        </div>
        <div className="bg-white rounded-2xl border-l-4 border-l-slate-400 border border-slate-200 shadow-sm p-5">
          <p className="text-sm font-semibold text-slate-600 mb-2">No llamar</p>
          <p className="text-2xl font-bold text-slate-500">{loading ? '—' : totalNoLlamar.toLocaleString()}</p>
          <p className="text-sm text-slate-400 mt-1">Clientes que no quieren recibir llamadas</p>
        </div>
      </div>

      <Card className="bg-white shadow-lg border-0">
        {/* Card Header con filtros */}
        <CardHeader className="border-b border-slate-200 pb-4 bg-gradient-to-r from-slate-50 to-blue-50">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <CardTitle className="text-slate-800">Interesados</CardTitle>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              onClick={() => loadLlamadas(currentPage)}
              disabled={loading}
              variant={loading ? 'secondary' : 'default'}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Cargando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Actualizar datos
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={openDownloadModal}
              disabled={!apiKey || !clientId}
              className="border-slate-200 bg-white hover:bg-slate-50"
            >
              <Download className="h-4 w-4 mr-2 shrink-0" />
              Descargar datos
            </Button>
          </div>
          </div>

          {/* Tabs de cualificación */}
          <div className="flex flex-wrap gap-2 mb-4">
            {([
              { key: 'todos', label: 'Todos', count: totalTodos },
              { key: 'agendados', label: 'Agendados', count: totalConAgenda },
              { key: 'cualificado', label: 'Cualificados', count: totalCualificados },
              { key: 'no_cualificado', label: 'No cualificados', count: totalNoCualificados },
              { key: 'no_llamar', label: 'No llamar', count: totalNoLlamar },
            ] as { key: InteresadosCualificacion; label: string; count: number }[]).map(({ key, label, count }) => (
              <button
                key={key}
                type="button"
                onClick={() => handleTabChange(key)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                  activeTab === key
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {label}{!loading && count > 0 ? ` · ${count.toLocaleString()}` : ''}
              </button>
            ))}
          </div>

          {/* Filtros */}
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-end">
            {/* Período (misma lógica que Recordings: Hoy / semana / mes / personalizado) */}
            <div className="flex flex-col min-w-[200px]">
              <label className="text-[10px] uppercase font-bold text-slate-400 mb-1">Período</label>
              <div className="relative" ref={datePresetDropdownRef}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDatePresetDropdown((v) => !v)}
                  className="w-full h-10 flex items-center justify-between gap-2 text-sm font-normal border-slate-200"
                >
                  <span className="flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-slate-500 shrink-0" />
                    {{
                      today: 'Hoy',
                      week: 'Última semana',
                      month: 'Último mes',
                      custom: 'Personalizado',
                    }[datePreset]}
                  </span>
                  {showDatePresetDropdown ? (
                    <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                  )}
                </Button>

                {showDatePresetDropdown && (
                  <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl z-50 border border-slate-200 overflow-hidden">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Rango</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {(['today', 'week', 'month', 'custom'] as const).map((preset) => {
                        const labels = {
                          today: 'Hoy',
                          week: 'Última semana',
                          month: 'Último mes',
                          custom: 'Personalizado…',
                        };
                        const isActive = datePreset === preset;
                        return (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => {
                              if (preset === 'custom') {
                                setDatePreset('custom');
                                setCustomDateFrom(rangeStartISO.slice(0, 10));
                                setCustomDateTo(toInclusiveEndDay(rangeEndISO));
                                setShowDatePresetDropdown(false);
                              } else {
                                const range = calcPresetDates(preset);
                                setDatePreset(preset);
                                setRangeStartISO(range.start);
                                setRangeEndISO(range.end);
                                setShowDatePresetDropdown(false);
                                setCurrentPage(1);
                                loadLlamadas(1, undefined, undefined, {
                                  fechaInicio: range.start,
                                  fechaFin: range.end,
                                });
                              }
                            }}
                            className={`w-full flex items-center justify-between px-4 py-3 text-sm text-left transition-colors hover:bg-slate-50 ${
                              isActive ? 'text-blue-600 font-semibold' : 'text-slate-700'
                            }`}
                          >
                            <span>{labels[preset]}</span>
                            {isActive && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                    {datePreset === 'custom' && customDateFrom && customDateTo && (
                      <div className="px-4 py-2 text-xs text-slate-500 border-t border-slate-100">
                        {new Date(`${customDateFrom}T12:00:00`).toLocaleDateString('es-ES')} –{' '}
                        {new Date(`${customDateTo}T12:00:00`).toLocaleDateString('es-ES')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {datePreset === 'custom' && (
              <>
                <div className="flex flex-col min-w-[140px]">
                  <label className="text-[10px] uppercase font-bold text-slate-400 mb-1">Desde</label>
                  <input
                    type="date"
                    value={customDateFrom}
                    onChange={(e) => setCustomDateFrom(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-400/30 focus:border-blue-500 cursor-pointer text-slate-700 bg-white"
                  />
                </div>
                <div className="flex flex-col min-w-[140px]">
                  <label className="text-[10px] uppercase font-bold text-slate-400 mb-1">Hasta</label>
                  <input
                    type="date"
                    value={customDateTo}
                    onChange={(e) => setCustomDateTo(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-400/30 focus:border-blue-500 cursor-pointer text-slate-700 bg-white"
                  />
                </div>
              </>
            )}

            <div className="flex flex-col min-w-[160px]">
              <label className="text-[10px] uppercase font-bold text-slate-400 mb-1">Teléfono</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={searchPhone}
                  onChange={(e) => setSearchPhone(e.target.value)}
                  className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-400/30 focus:border-blue-500 text-slate-700 bg-white w-full"
                />
              </div>
            </div>

            {/* Motivo de descarte — solo en tab no_cualificado */}
            {activeTab === 'no_cualificado' && (
              <div className="flex flex-col min-w-[180px]">
                <label className="text-[10px] uppercase font-bold text-slate-400 mb-1">
                  Motivo de descarte
                  {loadingMotivos && (
                    <RefreshCw className="inline ml-1 w-3 h-3 animate-spin text-slate-400" />
                  )}
                </label>
                <select
                  value={motivoDescarte}
                  onChange={(e) => setMotivoDescarte(e.target.value)}
                  disabled={loadingMotivos}
                  className="px-3 py-2 text-sm border border-red-200 rounded-lg focus:ring-2 focus:ring-red-300/30 focus:border-red-400 text-slate-700 bg-white cursor-pointer disabled:opacity-60"
                >
                  <option value="">Todos los motivos</option>
                  {motivosOptions.map((m) => (
                    <option key={m} value={m}>
                      {m.charAt(0).toUpperCase() + m.slice(1).replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Checkbox mayor 1 min — no aplica a la lista dont-call */}
            {activeTab !== 'no_llamar' && (
            <label className="flex items-center gap-2 cursor-pointer select-none px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50 transition-colors">
              <input
                type="checkbox"
                checked={soloMayorUnMin}
                onChange={(e) => setSoloMayorUnMin(e.target.checked)}
                className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
              />
              <span className="font-medium">Mayores a 1 min</span>
            </label>
            )}

            <div className="flex items-center gap-2">
              <Button
                onClick={handleFilter}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-bold text-sm flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                Filtrar
              </Button>
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearFilters}
                  disabled={loading}
                  className="px-4 py-2 text-sm flex items-center gap-2 border-slate-300 hover:bg-slate-50"
                >
                  <X className="h-4 w-4" />
                  Limpiar
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200">
              {error}
            </div>
          )}

          {/* Loading */}
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <RefreshCw className="animate-spin h-8 w-8 text-blue-500" />
            </div>
          ) : listIsEmpty ? (
            <div className="text-center py-20 text-slate-500">
              <Phone className="w-14 h-14 mx-auto mb-3 text-slate-300" />
              <p className="font-medium text-slate-600">
                {activeTab === 'no_llamar'
                  ? 'No hay registros en no llamar'
                  : 'No hay interesados para mostrar'}
              </p>
              <p className="text-sm mt-1">Ajusta los filtros o el rango de fechas</p>
            </div>
          ) : activeTab === 'no_llamar' ? (
            <div className="space-y-4">
              {filteredDontCalls.map((rec) => (
                <div
                  key={rec.id}
                  className="relative bg-white border border-slate-300 shadow-md shadow-slate-100/60 rounded-2xl overflow-hidden"
                >
                  <div className="p-5">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-xl shrink-0 bg-slate-100 text-slate-600">
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-slate-800 leading-tight capitalize">
                            {rec.name || 'Sin nombre'}
                          </h3>
                          <div className="flex flex-wrap items-center gap-3 mt-1.5 text-slate-500">
                            <div className="flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              <span className="text-sm font-medium">{rec.phone_number || '—'}</span>
                            </div>
                            {rec.region && (
                              <>
                                <span className="h-3 w-px bg-slate-200" />
                                <div className="flex items-center gap-1.5">
                                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                  <span className="text-sm">{rec.region}</span>
                                </div>
                              </>
                            )}
                            {rec.campaña && (
                              <>
                                <span className="h-3 w-px bg-slate-200" />
                                <span className="text-xs font-medium text-slate-500">Campaña: {rec.campaña}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold border bg-slate-100 text-slate-600 border-slate-300 shrink-0">
                        No llamar
                      </span>
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{formatDate(rec.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredLlamadas.map((row) => {
                const meta = parseMeta(row.metadata);
                const nombreMeta = meta?.name || row.name;
                const puebloCiudad = meta?.pueblo_ciudad;
                const metaCualificado: string = meta?.cualificado ?? '';
                const metaMotivos: string = meta?.motivos ?? '';
                const metaAgenda: string = meta?.agenda ?? '';
                const isExpanded = expandedId === row.id;
                const durationMs = typeof row.duration === 'string' ? parseInt(row.duration, 10) : (row.duration ?? 0);

                return (
                  <div
                    key={row.id}
                    className={`relative bg-white border shadow-md shadow-slate-100/60 rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-[1px] ${
                      metaCualificado === 'cualificado'
                        ? 'border-emerald-200'
                        : metaCualificado === 'no_cualificado'
                        ? 'border-orange-200'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="p-5">
                      {/* Top row: nombre + badges */}
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                        <div className="flex items-start gap-4">
                          <div className={`p-3 rounded-xl shrink-0 ${
                            metaCualificado === 'cualificado' ? 'bg-emerald-50 text-emerald-600'
                            : metaCualificado === 'no_cualificado' ? 'bg-orange-50 text-orange-500'
                            : 'bg-blue-50 text-blue-500'
                          }`}>
                            <User className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-slate-800 leading-tight capitalize">
                              {nombreMeta || '-'}
                            </h3>
                            <div className="flex flex-wrap items-center gap-3 mt-1.5 text-slate-500">
                              <div className="flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5 text-slate-400" />
                                <span className="text-sm font-medium">{row.to_number || '-'}</span>
                              </div>
                              {row.provincia && (
                                <>
                                  <span className="h-3 w-px bg-slate-200" />
                                  <div className="flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                    <span className="text-[10px] uppercase font-bold text-slate-400 mr-0.5">Ciudad Llamada:</span>
                                    <span className="text-sm font-medium">{row.provincia}</span>
                                  </div>
                                </>
                              )}
                              {puebloCiudad && (
                                <>
                                  <span className="h-3 w-px bg-slate-200" />
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] uppercase font-bold text-slate-400 mr-0.5">Ciudad BDD:</span>
                                    <span className="text-sm text-slate-600 capitalize">{puebloCiudad}</span>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Badges: cualificación + duración */}
                        <div className="shrink-0 flex flex-wrap items-center gap-2">
                          {metaCualificado === 'cualificado' && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">
                              Cualificado
                            </span>
                          )}
                          {metaCualificado === 'no_cualificado' && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold border bg-orange-50 text-orange-600 border-orange-200">
                              No cualificado
                            </span>
                          )}
                          {metaAgenda === 'si' && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold border bg-violet-50 text-violet-700 border-violet-200">
                              Agendado
                            </span>
                          )}
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                            durationMs >= MIN_DURATION_MS
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-slate-50 text-slate-500 border-slate-200'
                          }`}>
                            {formatDuration(row.duration)}
                          </span>
                        </div>
                      </div>

                      {/* Info row */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Col izq: fecha, fin, costo */}
                        <div className="space-y-2 text-sm text-slate-500">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>{formatDate(row.created_at)}</span>
                          </div>
                          {row.end_reason && (
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              <span className="capitalize">{row.end_reason.replace(/_/g, ' ')}</span>
                            </div>
                          )}
                          {metaMotivos && (
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="text-slate-400">Motivo:</span>
                              <span className="font-medium text-orange-600 capitalize">{metaMotivos.replace(/_/g, ' ')}</span>
                            </div>
                          )}
                          {row.cost != null && row.cost !== '' && (
                            <div className="text-xs text-slate-400">Costo: ${row.cost}</div>
                          )}
                        </div>

                        {/* Col centro+der: resumen + grabación */}
                        <div className="md:col-span-2 space-y-3">
                          {row.summary && (() => {
                            const summaryExpanded = expandedSummaryId === row.id;
                            return (
                              <div className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
                                <button
                                  type="button"
                                  onClick={() => setExpandedSummaryId(summaryExpanded ? null : row.id)}
                                  className="w-full flex items-center justify-between px-3.5 pt-3 pb-2 text-left"
                                >
                                  <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Resumen</p>
                                  {summaryExpanded
                                    ? <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    : <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                                </button>
                                <div className={`px-3.5 pb-3.5 ${summaryExpanded ? '' : 'line-clamp-3'}`}>
                                  <p className="text-sm text-slate-700 whitespace-pre-line">{row.summary}</p>
                                </div>
                              </div>
                            );
                          })()}

                          {row.recordings && (
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => togglePlay(row)}
                                  className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 hover:bg-emerald-100 text-sm font-medium transition-colors"
                                >
                                  {playingId === row.id && isAudioPlaying ? (
                                    <><Pause className="w-4 h-4" /> Pausar</>
                                  ) : (
                                    <><Play className="w-4 h-4" /> {playingId === row.id ? 'Reproducir' : 'Escuchar grabación'}</>
                                  )}
                                </button>

                                {playingId === row.id && (
                                  <>
                                    <div className="flex-1 min-w-[100px] flex items-center gap-2">
                                      <input
                                        type="range"
                                        min={0}
                                        max={audioDuration || 100}
                                        value={audioCurrentTime}
                                        onChange={handleProgress}
                                        className="flex-1 h-2 rounded-lg appearance-none cursor-pointer"
                                        style={{
                                          background: `linear-gradient(to right, #059669 0%, #059669 ${audioDuration ? (audioCurrentTime / audioDuration) * 100 : 0}%, #e2e8f0 ${audioDuration ? (audioCurrentTime / audioDuration) * 100 : 0}%, #e2e8f0 100%)`,
                                        }}
                                      />
                                    </div>
                                    <span className="text-xs text-slate-500 font-mono shrink-0">
                                      {formatTime(audioCurrentTime)} / {formatTime(audioDuration)}
                                    </span>
                                    <div className="flex items-center gap-1 shrink-0">
                                      {[1, 2, 3].map((r) => (
                                        <button
                                          key={r}
                                          type="button"
                                          onClick={() => setSpeed(r)}
                                          className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                                            playbackRate === r
                                              ? 'bg-emerald-600 text-white'
                                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                          }`}
                                        >
                                          {r}x
                                        </button>
                                      ))}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Transcripción expandible — carga bajo demanda */}
                      {row.call_id && (
                        <div className="mt-4 border-t border-slate-100 pt-3">
                          <button
                            type="button"
                            onClick={() => handleToggleTranscript(row)}
                            className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                          >
                            <FileText className="w-4 h-4" />
                            {transcriptLoading[row.call_id] ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                Cargando transcripción...
                              </>
                            ) : isExpanded ? (
                              <>Ocultar transcripción <ChevronUp className="w-4 h-4" /></>
                            ) : (
                              <>Ver transcripción <ChevronDown className="w-4 h-4" /></>
                            )}
                          </button>
                          {isExpanded && !transcriptLoading[row.call_id] && (
                            <div className="mt-3 bg-slate-50 p-4 rounded-xl border border-slate-100 max-h-52 overflow-y-auto">
                              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2">Transcripción</p>
                              {transcriptCache[row.call_id] ? (
                                <pre className="text-xs text-slate-600 whitespace-pre-wrap font-sans">{transcriptCache[row.call_id]}</pre>
                              ) : (
                                <p className="text-xs text-slate-400 italic">No hay transcripción disponible para esta llamada.</p>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Footer */}
                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        {row.call_id && (
                          <span className="font-mono">{row.call_id}</span>
                        )}
                        {row.from_number && (
                          <span>Desde: {row.from_number}</span>
                        )}
                        {row.agent_id && (
                          <span className="truncate max-w-[200px]">{row.agent_id}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Paginación */}
          {!loading && totalPaginas > 1 && !listIsEmpty && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => {
                  const prev = Math.max(1, currentPage - 1);
                  setCurrentPage(prev);
                  loadLlamadas(prev);
                }}
              >
                Anterior
              </Button>
              <span className="text-sm text-slate-500">
                Página {currentPage} de {totalPaginas}
                {totalLlamadas > 0 && (
                  <span className="ml-2 text-slate-400">· {totalLlamadas.toLocaleString()} total</span>
                )}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPaginas}
                onClick={() => {
                  const next = Math.min(totalPaginas, currentPage + 1);
                  setCurrentPage(next);
                  loadLlamadas(next);
                }}
              >
                Siguiente
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={downloadOpen}
        onOpenChange={(open) => {
          if (downloadExporting) return;
          setDownloadOpen(open);
          if (!open) setDownloadModalError(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Descargar datos</DialogTitle>
            <DialogDescription>
              Elige qué conjuntos exportar y el período. Cada categoría se descarga en un CSV. Las llamadas (agendas,
              cualificados y no cualificados) usan el mismo criterio que el listado:{' '}
              {soloMayorUnMin ? 'solo duración mayor a 1 minuto.' : 'sin filtrar por duración.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400 mb-2 tracking-wide">Datos a incluir</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {([
                  { key: 'agendas' as const, label: 'Agendas' },
                  { key: 'cualificados' as const, label: 'Cualificados' },
                  { key: 'noCualificados' as const, label: 'No cualificados' },
                  { key: 'noLlamar' as const, label: 'No llamar' },
                ]).map(({ key, label }) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 cursor-pointer select-none px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50/80 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={downloadSel[key]}
                      onChange={(e) => setDownloadSel((s) => ({ ...s, [key]: e.target.checked }))}
                      className="w-4 h-4 rounded accent-blue-600 cursor-pointer shrink-0"
                    />
                    <span className="font-medium">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400 mb-1 tracking-wide">Período de exportación</p>
              <div className="relative" ref={downloadPresetDropdownRef}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDownloadPresetDropdown((v) => !v)}
                  className="w-full h-10 flex items-center justify-between gap-2 text-sm font-normal border-slate-200"
                >
                  <span className="flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-slate-500 shrink-0" />
                    {{
                      today: 'Hoy',
                      week: 'Última semana',
                      month: 'Último mes',
                      custom: 'Personalizado',
                    }[downloadPreset]}
                  </span>
                  {showDownloadPresetDropdown ? (
                    <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                  )}
                </Button>

                {showDownloadPresetDropdown && (
                  <div className="absolute top-full left-0 mt-2 w-full bg-white rounded-xl shadow-xl z-[60] border border-slate-200 overflow-hidden">
                    <div className="divide-y divide-slate-100">
                      {(['today', 'week', 'month', 'custom'] as const).map((preset) => {
                        const labels = {
                          today: 'Hoy',
                          week: 'Última semana',
                          month: 'Último mes',
                          custom: 'Personalizado…',
                        };
                        const isActive = downloadPreset === preset;
                        return (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => {
                              if (preset === 'custom') {
                                setDownloadPreset('custom');
                                setDownloadCustomFrom(rangeStartISO.slice(0, 10));
                                setDownloadCustomTo(toInclusiveEndDay(rangeEndISO));
                                setShowDownloadPresetDropdown(false);
                              } else {
                                const range = calcPresetDates(preset);
                                setDownloadPreset(preset);
                                setDownloadCustomFrom(range.start.slice(0, 10));
                                setDownloadCustomTo(toInclusiveEndDay(range.end));
                                setShowDownloadPresetDropdown(false);
                              }
                            }}
                            className={`w-full flex items-center justify-between px-4 py-3 text-sm text-left transition-colors hover:bg-slate-50 ${
                              isActive ? 'text-blue-600 font-semibold' : 'text-slate-700'
                            }`}
                          >
                            <span>{labels[preset]}</span>
                            {isActive && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {downloadPreset === 'custom' && (
              <div className="flex flex-wrap gap-3">
                <div className="flex flex-col flex-1 min-w-[120px]">
                  <label className="text-[10px] uppercase font-bold text-slate-400 mb-1">Desde</label>
                  <input
                    type="date"
                    value={downloadCustomFrom}
                    onChange={(e) => setDownloadCustomFrom(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-400/30 focus:border-blue-500 text-slate-700 bg-white w-full"
                  />
                </div>
                <div className="flex flex-col flex-1 min-w-[120px]">
                  <label className="text-[10px] uppercase font-bold text-slate-400 mb-1">Hasta</label>
                  <input
                    type="date"
                    value={downloadCustomTo}
                    onChange={(e) => setDownloadCustomTo(e.target.value)}
                    className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-400/30 focus:border-blue-500 text-slate-700 bg-white w-full"
                  />
                </div>
              </div>
            )}

            {downloadModalError && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200">{downloadModalError}</div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDownloadOpen(false)}
              disabled={downloadExporting}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleDownloadConfirm()} disabled={downloadExporting}>
              {downloadExporting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Generando…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Descargar CSV
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
