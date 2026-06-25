import { useEffect, useState, useCallback, useRef } from 'react';
import { Button } from '../components/ui/button';
import { RefreshCw, Filter, Search, X, Phone, User, Calendar, Clock, FileText, ChevronDown, ChevronUp, Play, Pause } from 'lucide-react';
import { useCallsContext } from '../context/CallsContext';
import {
  getRecoveryCountsByAnalisisCodigo,
  listRecoveryCalls,
  RECOVERY_CODIGOS,
} from '../services/api/calls';
import { getAudioUrl } from '../api';
import { getMadridMidnight, addDaysUTC, formatMadridDateYYYYMMDD, getMadridYmdParts } from '../lib/dateUtils';

const MAX_CODE_LENGTH = 'Familiar/lo_conoce'.length;

const CODE_COLORS: Record<string, string> = {
  TON: '#10b981',
  CSP1: '#3b82f6',
  CSP2: '#6366f1',
  MCT: '#f59e0b',
  TDP: '#ef4444',
  PRO: '#8b5cf6',
  ADP: '#ec4899',
  CEC: '#06b6d4',
  CFA: '#94a3b8',
};

const CODE_DEFINICIONES: Record<string, { descripcion: string; significado: string }> = {
  TON: { descripcion: 'Teléfono ocupado o no contestó', significado: 'Cuando el cliente no responde, teléfono inhabilitado, contesta y cuelga' },
  CSP1: { descripcion: 'Cliente responde', significado: 'Pero no hay una negociación efectiva' },
  CSP2: { descripcion: 'Cliente renuente de pago', significado: 'Cliente niega la deuda o indica que no tiene ninguna intención real de pago' },
  MCT: { descripcion: 'Mensaje con tercero', significado: 'Tercero (referencia o quien atiende la línea) indica que dará el mensaje al deudor' },
  TDP: { descripcion: 'Trámite de préstamo', significado: 'Cliente indica que solicita apoyo para emisión de constancia, o indica que está realizando un trámite en una institución financiera' },
  PRO: { descripcion: 'Promesa', significado: 'Cliente confirma acción de pago según las propuestas brindadas, por lo general para normalización y cancelación total' },
  ADP: { descripcion: 'Acuerdo de pago', significado: 'Cliente pide apoyo para realizar acuerdo con pagos parciales' },
  CEC: { descripcion: 'Convenio', significado: 'Cliente solicita convenios de pago o ya tiene uno activo' },
  CFA: { descripcion: 'Cliente fallecido', significado: 'Se confirma con tercero posterior a la recepción de acta de defunción por parte de tercero' },
};

const COLORS_ARRAY = Object.values(CODE_COLORS);

function getColorForCode(code: string, index: number): string {
  return CODE_COLORS[code] || COLORS_ARRAY[index % COLORS_ARRAY.length];
}

interface RecoveriesProps {
  onNavigate: (page: string) => void;
}

export function Recoveries({ onNavigate: _onNavigate }: RecoveriesProps) {
  const { apiKey, clientId } = useCallsContext();
  const [counts, setCounts] = useState<{ analisis_codigo: string; total: number }[]>([]);
  const [countsFromList, setCountsFromList] = useState<{ analisis_codigo: string; total: number }[]>([]);
  const [llamadas, setLlamadas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingTable, setLoadingTable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timePeriod, setTimePeriod] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('today');
  const [dateFrom, setDateFrom] = useState<string>(() => formatMadridDateYYYYMMDD(getMadridMidnight()));
  const [dateTo, setDateTo] = useState<string>(() => formatMadridDateYYYYMMDD(getMadridMidnight()));
  const [currentPage, setCurrentPage] = useState(1);
  const [totalLlamadas, setTotalLlamadas] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [analisisCodigoFilter, setAnalisisCodigoFilter] = useState<string>('');
  const [searchCodigo, setSearchCodigo] = useState('');
  const [searchStatus, setSearchStatus] = useState('');
  const [searchPhone, setSearchPhone] = useState('');
  const [searchDuration, setSearchDuration] = useState('');
  const [selectedCodeInfo, setSelectedCodeInfo] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [playingId, setPlayingId] = useState<string | number | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordsPerPage = 50;

  const applyPeriod = useCallback((period: 'all' | 'today' | 'week' | 'month' | 'custom') => {
    const today = getMadridMidnight();
    if (period === 'all') {
      setDateFrom('');
      setDateTo('');
    } else if (period === 'today') {
      const todayStr = formatMadridDateYYYYMMDD(today);
      setDateFrom(todayStr);
      setDateTo(todayStr);
    } else if (period === 'week') {
      const weekStart = addDaysUTC(today, -6);
      setDateFrom(formatMadridDateYYYYMMDD(weekStart));
      setDateTo(formatMadridDateYYYYMMDD(today));
    } else if (period === 'month') {
      const { year, month } = getMadridYmdParts();
      const firstDay = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
      setDateFrom(formatMadridDateYYYYMMDD(firstDay));
      setDateTo(formatMadridDateYYYYMMDD(today));
    }
    if (period !== 'custom') {
      setCurrentPage(1);
    }
  }, []);

  const buildParams = useCallback(() => {
    const params: any = {
      client_id: clientId || '',
      page: currentPage,
      per_page: recordsPerPage,
      sort_order: 'DESC',
    };
    if (dateFrom) params.fecha_inicio = `${dateFrom}T00:00:00.000Z`;
    if (dateTo) params.fecha_fin = `${dateTo}T23:59:59.999Z`;
    if (analisisCodigoFilter) params.analisis_codigo = analisisCodigoFilter;
    return params;
  }, [clientId, currentPage, dateFrom, dateTo, analisisCodigoFilter]);

  const loadCounts = useCallback(async () => {
    if (!apiKey || !clientId) return;
    setLoading(true);
    setError(null);
    try {
      const params: any = { client_id: clientId };
      if (dateFrom) params.fecha_inicio = `${dateFrom}T00:00:00.000Z`;
      if (dateTo) params.fecha_fin = `${dateTo}T23:59:59.999Z`;
      if (analisisCodigoFilter) params.analisis_codigo = analisisCodigoFilter;
      const data = await getRecoveryCountsByAnalisisCodigo(apiKey, params);
      setCounts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar conteos');
    } finally {
      setLoading(false);
    }
  }, [apiKey, clientId, dateFrom, dateTo, analisisCodigoFilter]);

  const loadLlamadas = useCallback(async (page: number = 1) => {
    if (!apiKey || !clientId) return;
    setLoadingTable(true);
    setError(null);
    try {
      const params = { ...buildParams(), page };
      const res = await listRecoveryCalls(apiKey, params);
      setLlamadas(res.llamadas || []);
      setTotalLlamadas(res.total_llamadas ?? 0);
      setTotalPaginas(res.total_paginas ?? 0);
      setCurrentPage(res.pagina_actual ?? page);
      setCountsFromList(Array.isArray(res.conteos_por_codigo) ? res.conteos_por_codigo : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar llamadas');
    } finally {
      setLoadingTable(false);
    }
  }, [apiKey, clientId, buildParams]);

  useEffect(() => {
    if (apiKey && clientId) loadCounts();
  }, [apiKey, clientId, loadCounts]);

  useEffect(() => {
    if (apiKey && clientId) {
      const t = setTimeout(() => loadLlamadas(currentPage), 300);
      return () => clearTimeout(t);
    }
  }, [apiKey, clientId, dateFrom, dateTo, analisisCodigoFilter, currentPage]);

  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.preload = 'metadata';
    const handleTimeUpdate = () => {
      if (audioRef.current) setAudioCurrentTime(audioRef.current.currentTime);
    };
    const handleDurationChange = () => {
      if (audioRef.current) {
        const d = audioRef.current.duration;
        setAudioDuration(d && isFinite(d) && d > 0 ? d : 0);
      }
    };
    const handleEnded = () => {
      setPlayingId(null);
      setIsAudioPlaying(false);
    };
    const handleError = () => {
      setPlayingId(null);
      setIsAudioPlaying(false);
    };
    if (audioRef.current) {
      audioRef.current.addEventListener('timeupdate', handleTimeUpdate);
      audioRef.current.addEventListener('durationchange', handleDurationChange);
      audioRef.current.addEventListener('ended', handleEnded);
      audioRef.current.addEventListener('error', handleError);
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeEventListener('timeupdate', handleTimeUpdate);
        audioRef.current.removeEventListener('durationchange', handleDurationChange);
        audioRef.current.removeEventListener('ended', handleEnded);
        audioRef.current.removeEventListener('error', handleError);
        audioRef.current.src = '';
        audioRef.current.load();
      }
    };
  }, []);

  const formatTime = (sec: number) => {
    if (isNaN(sec)) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = t;
      setAudioCurrentTime(t);
    }
  };

  const setSpeed = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) audioRef.current.playbackRate = rate;
  };

  const togglePlayPause = (rowId: string | number, recordingUrl: string) => {
    if (!audioRef.current) return;
    if (playingId === rowId && !audioRef.current.paused) {
      audioRef.current.pause();
      setIsAudioPlaying(false);
      return;
    }
    const proxiedUrl = getAudioUrl(recordingUrl);
    if (audioRef.current.src !== proxiedUrl) {
      audioRef.current.pause();
      audioRef.current.src = proxiedUrl;
      audioRef.current.currentTime = 0;
      setAudioCurrentTime(0);
      setAudioDuration(0);
      setPlaybackRate(1);
      audioRef.current.playbackRate = 1;
      audioRef.current.play().catch(() => {
        setPlayingId(null);
        setIsAudioPlaying(false);
      });
      setPlayingId(rowId);
      setIsAudioPlaying(true);
      return;
    }
    if (playingId === rowId) {
      audioRef.current.play().catch(() => {
        setPlayingId(null);
        setIsAudioPlaying(false);
      });
      setIsAudioPlaying(true);
    } else {
      audioRef.current.pause();
      audioRef.current.src = proxiedUrl;
      audioRef.current.currentTime = 0;
      setAudioCurrentTime(0);
      setAudioDuration(0);
      setPlaybackRate(1);
      audioRef.current.playbackRate = 1;
      audioRef.current.play().catch(() => {
        setPlayingId(null);
        setIsAudioPlaying(false);
      });
      setPlayingId(rowId);
      setIsAudioPlaying(true);
    }
  };

  const hasActiveFilters = !!(dateFrom || dateTo || analisisCodigoFilter);
  const clearFilters = () => {
    setTimePeriod('today');
    applyPeriod('today');
    setAnalisisCodigoFilter('');
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  // duration en BD viene en milisegundos
  const formatDuration = (ms?: number | string) => {
    const val = typeof ms === 'string' ? parseInt(ms, 10) : (ms ?? 0);
    if (isNaN(val)) return '-';
    const totalSec = Math.floor(val / 1000);
    const m = Math.floor(totalSec / 60);
    const ss = totalSec % 60;
    return `${m}:${String(ss).padStart(2, '0')} min`;
  };

  const parseMetadata = (raw: string | object | null) => {
    if (!raw) return null;
    try {
      const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return obj as { datos?: { name?: string; last_name?: string; saldo?: string; NOMBRE_ASESOR?: string; numero_asesor?: string }; analisis?: { resumen?: string; analisis?: string; sentimiento?: string } };
    } catch {
      return null;
    }
  };

  const countsToShow = (counts.length > 0 ? counts : countsFromList)
    .filter((c) => c.analisis_codigo.length <= MAX_CODE_LENGTH);
  const totalRegistros = countsToShow.reduce((acc, c) => acc + c.total, 0);
  const mayorCodigo = countsToShow[0];
  const mayorPorcentaje = totalRegistros > 0 && mayorCodigo ? Math.round((mayorCodigo.total / totalRegistros) * 100) : 0;

  const filteredLlamadas = llamadas.filter((r) => {
    if (searchCodigo) {
      const cod = (r.analisis_codigo || (r.metadata?.analisis_codigo) || '');
      if (cod !== searchCodigo) return false;
    }
    if (searchStatus) {
      const status = (r.status || '').toLowerCase();
      if (searchStatus === 'fallida' && status !== 'fallida') return false;
      if (searchStatus === 'efectiva' && status === 'fallida') return false;
    }
    if (searchPhone.trim()) {
      const phone = (r.phone_number || r.to_number || '').replace(/\D/g, '');
      const search = searchPhone.replace(/\D/g, '');
      if (!phone.includes(search)) return false;
    }
    if (searchDuration) {
      const dMs = typeof r.duration === 'string' ? parseInt(r.duration, 10) : (r.duration ?? 0);
      if (isNaN(dMs)) {
        if (searchDuration === 'mayor_1min') return false;
        return true;
      }
      const umMinutoMs = 60000;
      if (searchDuration === 'mayor_1min' && dMs < umMinutoMs) return false;
      if (searchDuration === 'menor_1min' && dMs >= umMinutoMs) return false;
    }
    return true;
  });

  return (
    <div className="p-8 space-y-6">
        {/* Page Header */}
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-indigo-800">
            Análisis de códigos de resultado
          </h2>
          <p className="text-slate-500">
            Visualización detallada de distribución y métricas de recobro para el período actual.
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
          {/* Period selector + Código filter */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 mr-1">Período:</span>
              {([
                { key: 'today', label: 'Hoy' },
                { key: 'week', label: 'Última semana' },
                { key: 'month', label: 'Este mes' },
                { key: 'custom', label: 'Personalizado' },
                { key: 'all', label: 'Todos' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setTimePeriod(key); applyPeriod(key); }}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                    timePeriod === key
                      ? 'bg-[#ec5b13] text-white border-[#ec5b13]'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-[#ec5b13]/50 hover:text-[#ec5b13]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-slate-400">Código:</span>
              <select
                value={analisisCodigoFilter}
                onChange={(e) => { setAnalisisCodigoFilter(e.target.value); setCurrentPage(1); }}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#ec5b13]/30 focus:border-[#ec5b13] cursor-pointer text-slate-700 bg-white"
              >
                <option value="">Todos</option>
                {Object.keys(RECOVERY_CODIGOS).map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6 sm:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-8">
              {timePeriod === 'custom' && (
                <>
                  <div className="flex flex-col min-w-[140px]">
                    <label className="text-[10px] uppercase font-bold text-slate-400 mb-1">Desde</label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#ec5b13]/30 focus:border-[#ec5b13] cursor-pointer text-slate-700"
                    />
                  </div>
                  <div className="flex flex-col min-w-[140px]">
                    <label className="text-[10px] uppercase font-bold text-slate-400 mb-1">Hasta</label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#ec5b13]/30 focus:border-[#ec5b13] cursor-pointer text-slate-700"
                    />
                  </div>
                </>
              )}
              {timePeriod !== 'custom' && (dateFrom || dateTo || timePeriod === 'all') && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <span>
                    {timePeriod === 'all' && 'Todos los registros'}
                    {timePeriod === 'today' && `Hoy: ${dateFrom}`}
                    {timePeriod === 'week' && `${dateFrom} → ${dateTo}`}
                    {timePeriod === 'month' && `${dateFrom} → ${dateTo}`}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <Button
                onClick={() => { loadCounts(); loadLlamadas(currentPage); }}
                disabled={loading || loadingTable}
                className="bg-[#ec5b13] hover:bg-[#ec5b13]/90 text-white px-5 py-2 rounded-lg font-bold text-sm flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                Filtrar
              </Button>
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  disabled={loading || loadingTable}
                  className="px-4 py-2 text-sm flex items-center gap-2 border-slate-300 hover:bg-slate-50"
                >
                  <X className="h-4 w-4" />
                  Limpiar filtros
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => { loadCounts(); loadLlamadas(currentPage); }}
                disabled={loading || loadingTable}
                className="px-3 py-2"
              >
                <RefreshCw className={`h-4 w-4 ${(loading || loadingTable) ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Donut Chart - más compacto */}
          <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Distribución por código de análisis</h3>
                <p className="text-sm text-slate-500">Composición porcentual del volumen total de llamadas</p>
              </div>
            </div>
            {loading ? (
              <div className="flex justify-center items-center h-[320px]">
                <RefreshCw className="animate-spin h-10 w-10 text-[#ec5b13]" />
              </div>
            ) : countsToShow.length === 0 ? (
              <div className="flex justify-center items-center h-[320px] text-slate-500">
                No hay datos para el período seleccionado
              </div>
            ) : (
              <div className="flex flex-col md:flex-row items-center justify-center gap-8 py-4">
                <DonutChart data={countsToShow} total={totalRegistros} mayorCodigo={mayorCodigo} mayorPorcentaje={mayorPorcentaje} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 w-full md:w-auto">
                  {countsToShow.map((c, i) => {
                    const pct = totalRegistros > 0 ? ((c.total / totalRegistros) * 100).toFixed(1) : '0';
                    return (
                      <div key={c.analisis_codigo} className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: getColorForCode(c.analisis_codigo, i) }}
                        />
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-900">{c.analisis_codigo}</span>
                          <span className="text-xs text-slate-500">{pct}% del total</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {/* Tipos de código dentro del box */}
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-2 mt-6 pt-4 border-t border-slate-100">
              {Object.entries(CODE_COLORS).map(([code]) => {
                const isSelected = selectedCodeInfo === code;
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setSelectedCodeInfo(isSelected ? null : code)}
                    className={`bg-slate-50 p-2 rounded-lg border flex flex-col items-center justify-center transition-colors cursor-pointer text-left w-full ${
                      isSelected ? 'border-[#ec5b13] ring-2 ring-[#ec5b13]/30' : 'border-slate-200 hover:border-[#ec5b13]/50'
                    }`}
                  >
                    <span className="text-xs font-bold text-slate-500 mb-1">{code}</span>
                    <div
                      className="w-full h-1 rounded-full"
                      style={{ backgroundColor: CODE_COLORS[code] }}
                    />
                  </button>
                );
              })}
            </div>
            {/* Descripción del código seleccionado */}
            {selectedCodeInfo && CODE_DEFINICIONES[selectedCodeInfo] && (
              <div className="mt-4 p-4 rounded-lg bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="px-2 py-1 rounded-md font-bold text-sm text-white"
                    style={{ backgroundColor: CODE_COLORS[selectedCodeInfo] || '#64748b' }}
                  >
                    {selectedCodeInfo}
                  </span>
                  <span className="text-sm font-semibold text-slate-700">{CODE_DEFINICIONES[selectedCodeInfo].descripcion}</span>
                </div>
                <p className="text-sm text-slate-600">{CODE_DEFINICIONES[selectedCodeInfo].significado}</p>
              </div>
            )}
          </div>

          {/* Summary + Quick Stats */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex-1">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-slate-900">Resumen Métricas</h3>
              </div>
              <div className="space-y-3">
                {countsToShow.map((c, i) => {
                  const color = getColorForCode(c.analisis_codigo, i);
                  const badge = c.analisis_codigo.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase();
                  const pct = totalRegistros > 0 ? ((c.total / totalRegistros) * 100).toFixed(1) : '0';
                  return (
                    <div
                      key={c.analisis_codigo}
                      className="flex items-center gap-3 p-3 rounded-xl border"
                      style={{
                        backgroundColor: `${color}10`,
                        borderColor: `${color}30`,
                      }}
                    >
                      <div
                        className="w-9 h-9 shrink-0 rounded-lg text-white flex items-center justify-center font-bold text-[10px] tracking-tight"
                        style={{ backgroundColor: color }}
                      >
                        {badge}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm font-semibold text-slate-700 truncate"
                          title={c.analisis_codigo}
                        >
                          {c.analisis_codigo}
                        </p>
                        <p className="text-xs text-slate-400">{pct}% del total</p>
                      </div>
                      <span className="text-base font-bold shrink-0" style={{ color }}>
                        {c.total.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
                {countsToShow.length === 0 && !loading && (
                  <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 text-center text-slate-500">
                    Sin registros
                  </div>
                )}
              </div>
              <div className="mt-8 pt-6 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Total Registros</span>
                  <span className="text-2xl font-black text-[#ec5b13]">{totalRegistros.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h3 className="text-lg font-bold text-slate-900">Detalle de últimas capturas</h3>
              <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 sm:items-end sm:justify-end">
              <div className="min-w-[140px] sm:max-w-[160px]">
                <select
                  value={searchCodigo}
                  onChange={(e) => setSearchCodigo(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#ec5b13]/30 focus:border-[#ec5b13] cursor-pointer"
                >
                  <option value="">Código (Todos)</option>
                  {Object.keys(CODE_COLORS).map((code) => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </select>
              </div>
              <div className="min-w-[140px] sm:max-w-[160px]">
                <select
                  value={searchStatus}
                  onChange={(e) => setSearchStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#ec5b13]/30 focus:border-[#ec5b13] cursor-pointer"
                >
                  <option value="">Estado (Todos)</option>
                  <option value="fallida">Fallida</option>
                  <option value="efectiva">Efectiva</option>
                </select>
              </div>
              <div className="relative min-w-[140px] sm:max-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm h-4 w-4" />
                <input
                  type="text"
                  placeholder="Teléfono..."
                  value={searchPhone}
                  onChange={(e) => setSearchPhone(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#ec5b13]/30 focus:border-[#ec5b13] w-full"
                />
              </div>
              <div className="min-w-[160px] sm:max-w-[180px]">
                <select
                  value={searchDuration}
                  onChange={(e) => setSearchDuration(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#ec5b13]/30 focus:border-[#ec5b13] cursor-pointer"
                >
                  <option value="">Duración (Todos)</option>
                  <option value="mayor_1min">Mayor a 1 min</option>
                  <option value="menor_1min">Menor a 1 min</option>
                </select>
              </div>
              </div>
            </div>
          </div>
          {error && (
            <div className="mx-6 mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}
          {loadingTable ? (
            <div className="flex justify-center items-center py-16">
              <RefreshCw className="animate-spin h-8 w-8 text-[#ec5b13]" />
            </div>
          ) : filteredLlamadas.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <Phone className="w-14 h-14 mx-auto mb-3 text-slate-300" />
              <p className="font-medium">No hay llamadas con análisis para mostrar</p>
              <p className="text-sm mt-1">Ajusta los filtros o el rango de fechas</p>
            </div>
          ) : (
            <div className="p-6 space-y-4">
              {filteredLlamadas.map((row) => {
                const codigo = row.analisis_codigo || (parseMetadata(row.metadata)?.analisis?.analisis) || '-';
                const color = getColorForCode(codigo, Object.keys(CODE_COLORS).indexOf(codigo));
                const meta = parseMetadata(row.metadata);
                const fullName = meta?.datos?.last_name ? `${row.name || meta?.datos?.name || '-'} ${meta.datos.last_name}` : (row.name || meta?.datos?.name || '-');
                const phone = row.to_number || row.phone_number || '-';
                const summary = row.summary || meta?.analisis?.resumen;
                const transcript = row.transcript || '';
                const recordings = row.recordings;
                const endReason = row.end_reason;
                const cost = row.cost;
                const isExpanded = expandedId === row.id;

                return (
                  <div
                    key={row.id}
                    className="relative bg-white border border-slate-200 shadow-xl shadow-slate-200/50 rounded-[16px] overflow-hidden transition-all duration-200 hover:shadow-2xl hover:-translate-y-[1px]"
                  >
                    <div className="p-6">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                        <div className="flex items-start gap-4">
                          <div className="p-3 bg-[#ec5b13]/10 rounded-xl text-[#ec5b13]">
                            <Phone className="w-6 h-6" />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-slate-800 leading-tight">
                              {fullName}
                            </h3>
                            <div className="flex flex-wrap items-center gap-3 mt-2 text-slate-600">
                              <div className="flex items-center gap-2">
                                <Phone className="w-4 h-4 text-slate-400" />
                                <span className="text-sm font-medium">{phone}</span>
                              </div>
                              {row.call_id && (
                                <>
                                  <span className="h-4 w-px bg-slate-200" />
                                  <div className="flex items-center gap-2">
                                    <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold">Call ID:</span>
                                    <code className="font-mono text-[11px] text-slate-500 break-all">{row.call_id}</code>
                                  </div>
                                </>
                              )}
                              {meta?.datos?.NOMBRE_ASESOR && (
                                <>
                                  <span className="h-4 w-px bg-slate-200" />
                                  <div className="flex items-center gap-2">
                                    <User className="w-4 h-4 text-slate-400" />
                                    <span className="text-sm font-medium text-[#ec5b13]">{meta.datos.NOMBRE_ASESOR}</span>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <span
                              className="px-3 py-1.5 rounded-lg font-bold text-xs text-white shadow-sm"
                              style={{ backgroundColor: color }}
                            >
                              {codigo}
                            </span>
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium border ${
                                (row.status || '').toLowerCase() === 'efectiva'
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : 'bg-red-100 text-red-800 border-red-300'
                              }`}
                            >
                              {row.status || '-'}
                            </span>
                          </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-2">
                        <div className="space-y-3 text-slate-600">
                          <div className="flex items-center gap-3">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            <div className="text-sm">
                              <span className="text-slate-400">Fecha:</span>
                              <span className="font-semibold ml-1">{formatDate(row.created_at || '')}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Clock className="w-4 h-4 text-slate-400" />
                            <div className="text-sm">
                              <span className="text-slate-400">Duración:</span>
                              <span className="font-medium ml-1">{formatDuration(row.duration)}</span>
                            </div>
                          </div>
                          {endReason && (
                            <div className="text-sm">
                              <span className="text-slate-400">Fin:</span>
                              <span className="font-medium ml-1 capitalize">{endReason.replace(/_/g, ' ')}</span>
                            </div>
                          )}
                          {cost != null && cost !== '' && (
                            <div className="text-sm">
                              <span className="text-slate-400">Costo:</span>
                              <span className="font-medium ml-1">${cost}</span>
                            </div>
                          )}
                        </div>

                        <div className={`md:col-span-2 space-y-3 ${(row.status || '').toLowerCase() === 'efectiva' ? 'flex flex-col' : ''}`}>
                          {summary && (
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Resumen</p>
                              <p className="text-sm text-slate-700">{summary}</p>
                            </div>
                          )}
                          {recordings && (
                            <div className={`flex flex-col gap-3 ${(row.status || '').toLowerCase() === 'efectiva' ? 'justify-end' : ''}`}>
                              <div className="flex items-center gap-2 flex-wrap">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    togglePlayPause(row.id, recordings);
                                  }}
                                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 hover:bg-emerald-100 text-sm font-medium transition-colors shrink-0"
                                >
                                  {playingId === row.id && isAudioPlaying ? (
                                    <>
                                      <Pause className="w-4 h-4" />
                                      Pausar
                                    </>
                                  ) : (
                                    <>
                                      <Play className="w-4 h-4" />
                                      {playingId === row.id ? 'Reproducir' : 'Escuchar grabación'}
                                    </>
                                  )}
                                </button>
                                {playingId === row.id && (
                                  <>
                                    <div className="flex-1 min-w-[120px] flex items-center gap-2">
                                      <input
                                        type="range"
                                        min={0}
                                        max={audioDuration || 100}
                                        value={audioCurrentTime}
                                        onChange={handleProgressChange}
                                        onClick={(e) => e.stopPropagation()}
                                        className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                                        style={{
                                          background: `linear-gradient(to right, #059669 0%, #059669 ${(audioDuration ? (audioCurrentTime / audioDuration) * 100 : 0)}%, #e2e8f0 ${(audioDuration ? (audioCurrentTime / audioDuration) * 100 : 0)}%, #e2e8f0 100%)`,
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
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSpeed(r);
                                          }}
                                          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
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

                      {transcript && (
                        <div className="mt-4 border-t border-slate-100 pt-4">
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : row.id)}
                            className="flex items-center gap-2 text-sm font-medium text-[#ec5b13] hover:text-[#ec5b13]/80 transition-colors"
                          >
                            <FileText className="w-4 h-4" />
                            {isExpanded ? (
                              <>Ocultar detalles <ChevronUp className="w-4 h-4" /></>
                            ) : (
                              <>Ver transcripción <ChevronDown className="w-4 h-4" /></>
                            )}
                          </button>
                          {isExpanded && transcript && (
                            <div className="mt-3">
                              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 max-h-48 overflow-y-auto">
                                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2">Transcripción</p>
                                <pre className="text-xs text-slate-600 whitespace-pre-wrap font-sans">{transcript}</pre>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3">
                        {row.from_number && (
                          <span className="text-xs text-slate-500">Desde: {row.from_number}</span>
                        )}
                        {row.interest === 'yes' && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            Interés: sí
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {!loadingTable && totalPaginas > 1 && filteredLlamadas.length > 0 && (
            <div className="flex items-center justify-between p-4 border-t border-slate-200">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <span className="text-sm text-slate-500">
                Página {currentPage} de {totalPaginas}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPaginas}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                Siguiente
              </Button>
            </div>
          )}
        </div>
    </div>
  );
}

function DonutChart({
  data,
  total,
  mayorCodigo,
  mayorPorcentaje,
}: {
  data: { analisis_codigo: string; total: number }[];
  total: number;
  mayorCodigo?: { analisis_codigo: string; total: number };
  mayorPorcentaje: number;
}) {
  if (data.length === 0) return null;
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const segments = data.map((d, i) => {
    const pct = total > 0 ? d.total / total : 0;
    const segment = {
      code: d.analisis_codigo,
      color: getColorForCode(d.analisis_codigo, i),
      dashArray: `${pct * circumference} ${circumference}`,
      dashOffset: -offset,
    };
    offset += pct * circumference;
    return segment;
  });

  return (
    <div className="relative w-64 h-64 flex-shrink-0">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" fill="transparent" r={radius} stroke="#f1f5f9" strokeWidth="3" />
        {segments.map((s) => (
          <circle
            key={s.code}
            cx="18"
            cy="18"
            fill="transparent"
            r={radius}
            stroke={s.color}
            strokeDasharray={s.dashArray}
            strokeDashoffset={s.dashOffset}
            strokeLinecap="round"
            strokeWidth="3.5"
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-4xl font-black text-slate-900">{mayorPorcentaje}%</span>
        <span
          className="text-xs font-bold uppercase tracking-wider"
          style={{ color: mayorCodigo ? getColorForCode(mayorCodigo.analisis_codigo, 0) : undefined }}
        >
          {mayorCodigo?.analisis_codigo ?? '-'} (Mayoría)
        </span>
      </div>
    </div>
  );
}
