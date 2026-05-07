import { useCallback, useEffect, useRef, useState } from 'react';
import {
  RefreshCw,
  Search,
  X,
  Phone,
  Calendar,
  Clock,
  FileText,
  ChevronDown,
  ChevronUp,
  Play,
  Pause,
  MapPin,
  User,
  Filter,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useCallsContext } from '../context/CallsContext';
import { listInteresadosCalls } from '../services/api/calls';

const MIN_DURATION_MS = 60_000;
const PER_PAGE = 50;

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

  const [llamadas, setLlamadas] = useState<Llamada[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchPhone, setSearchPhone] = useState('');
  const [soloMayorUnMin, setSoloMayorUnMin] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [totalLlamadas, setTotalLlamadas] = useState(0);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedSummaryId, setExpandedSummaryId] = useState<number | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Audio setup
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.preload = 'metadata';
    try { (audioRef.current as any).crossOrigin = 'anonymous'; } catch {}
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

  const loadLlamadas = useCallback(async (page = 1) => {
    if (!apiKey || !clientId) return;
    setLoading(true);
    setError(null);
    try {
      const params: Parameters<typeof listInteresadosCalls>[1] = {
        client_id: clientId,
        page,
        per_page: PER_PAGE,
        sort_order: 'DESC',
      };
      if (dateFrom) params.fecha_inicio = `${dateFrom}T00:00:00.000Z`;
      if (dateTo) params.fecha_fin = `${dateTo}T23:59:59.999Z`;
      if (soloMayorUnMin) params.min_duration_ms = MIN_DURATION_MS;

      const res = await listInteresadosCalls(apiKey, params);
      setLlamadas(res.llamadas || []);
      setTotalLlamadas(res.total_llamadas ?? 0);
      setTotalPaginas(res.total_paginas ?? 0);
      setCurrentPage(res.pagina_actual ?? page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar interesados');
    } finally {
      setLoading(false);
    }
  }, [apiKey, clientId, dateFrom, dateTo, soloMayorUnMin]);

  useEffect(() => {
    if (apiKey && clientId) loadLlamadas(1);
  }, [apiKey, clientId]);

  const handleFilter = () => {
    setCurrentPage(1);
    loadLlamadas(1);
  };

  const handleClearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setSearchPhone('');
    setSoloMayorUnMin(true);
    setCurrentPage(1);
    setTimeout(() => loadLlamadas(1), 0);
  };

  const hasActiveFilters = !!(dateFrom || dateTo || searchPhone || !soloMayorUnMin);

  const togglePlay = (row: Llamada) => {
    if (!audioRef.current || !row.recordings) return;
    const url = row.recordings;
    if (playingId === row.id && !audioRef.current.paused) {
      audioRef.current.pause();
      setIsAudioPlaying(false);
      return;
    }
    if (audioRef.current.src !== url) {
      audioRef.current.pause();
      audioRef.current.src = url;
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

  // Filtro local por teléfono (se hace client-side sobre la página cargada)
  const filteredLlamadas = llamadas.filter((r) => {
    if (searchPhone.trim()) {
      const phone = (r.to_number || '').replace(/\D/g, '');
      const search = searchPhone.replace(/\D/g, '');
      if (!phone.includes(search)) return false;
    }
    return true;
  });

  return (
    <div className="p-8 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Interesados</h2>
        <div className="flex flex-wrap items-center gap-2 text-slate-600">
          <p>Llamadas efectivas con sentimiento positivo captadas por el agente</p>
          {totalLlamadas > 0 && !loading && (
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
              {totalLlamadas.toLocaleString()} {totalLlamadas === 1 ? 'interesado' : 'interesados'}
            </span>
          )}
        </div>
      </div>

      <Card className="bg-white shadow-lg border-0">
        {/* Card Header con filtros */}
        <CardHeader className="border-b border-slate-200 pb-4 bg-gradient-to-r from-slate-50 to-blue-50">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <CardTitle className="text-slate-800">Interesados</CardTitle>
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
          </div>

          {/* Filtros */}
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-end">
            <div className="flex flex-col min-w-[140px]">
              <label className="text-[10px] uppercase font-bold text-slate-400 mb-1">Desde</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-400/30 focus:border-blue-500 cursor-pointer text-slate-700 bg-white"
              />
            </div>
            <div className="flex flex-col min-w-[140px]">
              <label className="text-[10px] uppercase font-bold text-slate-400 mb-1">Hasta</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-400/30 focus:border-blue-500 cursor-pointer text-slate-700 bg-white"
              />
            </div>
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

            {/* Checkbox mayor 1 min */}
            <label className="flex items-center gap-2 cursor-pointer select-none px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50 transition-colors">
              <input
                type="checkbox"
                checked={soloMayorUnMin}
                onChange={(e) => setSoloMayorUnMin(e.target.checked)}
                className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
              />
              <span className="font-medium">Mayores a 1 min</span>
            </label>

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
          ) : filteredLlamadas.length === 0 ? (
            <div className="text-center py-20 text-slate-500">
              <Phone className="w-14 h-14 mx-auto mb-3 text-slate-300" />
              <p className="font-medium text-slate-600">No hay interesados para mostrar</p>
              <p className="text-sm mt-1">Ajusta los filtros o el rango de fechas</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredLlamadas.map((row) => {
                const meta = parseMeta(row.metadata);
                const nombreMeta = meta?.name || row.name;
                const puebloCiudad = meta?.pueblo_ciudad;
                const isExpanded = expandedId === row.id;
                const durationMs = typeof row.duration === 'string' ? parseInt(row.duration, 10) : (row.duration ?? 0);

                return (
                  <div
                    key={row.id}
                    className="relative bg-white border border-slate-200 shadow-md shadow-slate-100/60 rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-[1px]"
                  >
                    <div className="p-5">
                      {/* Top row: nombre + badges */}
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                        <div className="flex items-start gap-4">
                          <div className="p-3 bg-blue-50 rounded-xl text-blue-500 shrink-0">
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

                        {/* Badge duración */}
                        <div className="shrink-0">
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

                      {/* Transcripción expandible */}
                      {row.transcript && (
                        <div className="mt-4 border-t border-slate-100 pt-3">
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : row.id)}
                            className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                          >
                            <FileText className="w-4 h-4" />
                            {isExpanded ? (
                              <>Ocultar transcripción <ChevronUp className="w-4 h-4" /></>
                            ) : (
                              <>Ver transcripción <ChevronDown className="w-4 h-4" /></>
                            )}
                          </button>
                          {isExpanded && (
                            <div className="mt-3 bg-slate-50 p-4 rounded-xl border border-slate-100 max-h-52 overflow-y-auto">
                              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2">Transcripción</p>
                              <pre className="text-xs text-slate-600 whitespace-pre-wrap font-sans">{row.transcript}</pre>
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
          {!loading && totalPaginas > 1 && filteredLlamadas.length > 0 && (
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
    </div>
  );
}
