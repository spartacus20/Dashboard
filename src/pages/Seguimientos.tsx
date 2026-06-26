import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  PhoneCall,
  Settings,
  Eye,
  EyeOff,
  Save,
  RefreshCw,
  XCircle,
  CheckCircle2,
  Clock,
  AlertCircle,
  Copy,
  CalendarDays,
  StopCircle,
  LayoutGrid,
  ChevronLeft,
  Users,
  PhoneIncoming,
  PhoneMissed,
  PhoneOff,
  TrendingUp,
} from 'lucide-react';
import { useCallsContext } from '../context/CallsContext';
import { isAdmin, canAccessSeguimientos } from '../lib/supabase';
import { BASE_URL } from '../services/api/config';
import {
  listSeguimientos,
  updateSeguimiento,
  cancelAllPending,
  getRetellConfig,
  updateRetellConfig,
  listRetellPhoneNumbers,
  getCampaignsSummary,
  CallBackRecord,
  CampaignSummary,
} from '../services/api/seguimientos';

type Tab = 'registros' | 'configuracion';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  answered: 'Contestó',
  exhausted: 'Agotado',
  cancelled: 'Cancelado',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  answered: 'bg-green-100 text-green-800',
  exhausted: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-500',
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  pending: <Clock className="w-3 h-3" />,
  answered: <CheckCircle2 className="w-3 h-3" />,
  exhausted: <AlertCircle className="w-3 h-3" />,
  cancelled: <XCircle className="w-3 h-3" />,
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function truncateBatchId(id: string): string {
  if (id.length <= 16) return id;
  return `${id.slice(0, 8)}…${id.slice(-6)}`;
}

function getContactName(r: CallBackRecord): string {
  const direct = [r.nombre, r.last_name].filter(Boolean).join(' ');
  if (direct) return direct;
  const datos = (r.metadata as any)?.datos;
  if (datos) {
    const metaName = [datos.name, datos.last_name].filter(Boolean).join(' ');
    if (metaName) return metaName;
  }
  return '—';
}

interface SeguimientosProps {
  onNavigate: (page: string) => void;
}

export function Seguimientos({ onNavigate: _onNavigate }: SeguimientosProps) {
  const { clientId } = useCallsContext();
  const [activeTab, setActiveTab] = useState<Tab>('registros');
  const isCampaignMode = canAccessSeguimientos();

  // — Registros state —
  const [records, setRecords] = useState<CallBackRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [errorRecords, setErrorRecords] = useState('');

  // — Campaign state (solo cuando isCampaignMode) —
  // undefined = mostrando grid de campañas | null = registros sin campaña | string = campaña específica
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null | undefined>(undefined);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  // — Config state —
  const [apiKey, setApiKey] = useState('');
  const [fromNumber, setFromNumber] = useState('');
  const [apiKeySet, setApiKeySet] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [delays, setDelays] = useState<number[]>([20, 60, 120]);
  const [activeHours, setActiveHours] = useState(8);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configMsg, setConfigMsg] = useState('');
  const [configError, setConfigError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [availableNumbers, setAvailableNumbers] = useState<string[]>([]);
  const [loadingNumbers, setLoadingNumbers] = useState(false);

  const PER_PAGE = 50;
  const webhookUrl = `${BASE_URL}/api/callback/webhook/${clientId}`;
  const userIsAdmin = isAdmin();

  const globalMetrics = useMemo(() => {
    const total = campaigns.reduce((s, c) => s + Number(c.total || 0), 0);
    const answered = campaigns.reduce((s, c) => s + Number(c.answered || 0), 0);
    const pending = campaigns.reduce((s, c) => s + Number(c.pending || 0), 0);
    const exhausted = campaigns.reduce((s, c) => s + Number(c.exhausted || 0), 0);
    const cancelled = campaigns.reduce((s, c) => s + Number(c.cancelled || 0), 0);
    const contactRate = total > 0 ? Math.round((answered / total) * 100) : 0;
    const noContact = exhausted + cancelled;
    return { total, answered, pending, exhausted, cancelled, contactRate, noContact };
  }, [campaigns]);

  function getTodayRange() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { start: start.toISOString(), end: end.toISOString() };
  }

  function applyTodayFilter() {
    const { start, end } = getTodayRange();
    setFechaInicio(start.slice(0, 10));
    setFechaFin(end.slice(0, 10));
    setPage(1);
  }

  function clearDateFilter() {
    setFechaInicio('');
    setFechaFin('');
    setPage(1);
  }

  // — Load campaigns summary —
  const loadCampaignsSummary = useCallback(async () => {
    if (!clientId) return;
    setLoadingCampaigns(true);
    try {
      const data = await getCampaignsSummary(clientId);
      setCampaigns(data);
    } catch {
      // fallo silencioso — grid queda vacío
    } finally {
      setLoadingCampaigns(false);
    }
  }, [clientId]);

  // — Load records —
  const loadRecords = useCallback(async () => {
    if (!clientId) return;
    setLoadingRecords(true);
    setErrorRecords('');
    try {
      const { start, end } = fechaInicio
        ? {
            start: new Date(fechaInicio).toISOString(),
            end: fechaFin ? new Date(new Date(fechaFin).getTime() + 86400000).toISOString() : '',
          }
        : { start: '', end: '' };

      const batchFilter =
        isCampaignMode && selectedBatchId !== undefined
          ? { batch_call_id: selectedBatchId }
          : {};

      const res = await listSeguimientos(clientId, {
        status: statusFilter || undefined,
        fecha_inicio: start || undefined,
        fecha_fin: end || undefined,
        ...batchFilter,
        page,
        per_page: PER_PAGE,
      });
      setRecords(res.data);
      setTotal(res.total);
    } catch {
      setErrorRecords('Error al cargar los seguimientos.');
    } finally {
      setLoadingRecords(false);
    }
  }, [clientId, statusFilter, fechaInicio, fechaFin, page, isCampaignMode, selectedBatchId]);

  useEffect(() => {
    if (activeTab !== 'registros') return;
    if (isCampaignMode && selectedBatchId === undefined) {
      loadCampaignsSummary();
    } else {
      loadRecords();
    }
  }, [activeTab, loadRecords, loadCampaignsSummary, isCampaignMode, selectedBatchId]);

  // — Load config —
  const loadConfig = useCallback(async () => {
    if (!clientId) return;
    setLoadingConfig(true);
    setConfigMsg('');
    setConfigError('');
    try {
      const cfg = await getRetellConfig(clientId);
      setApiKeySet(cfg.retell_api_key_set);
      setFromNumber(cfg.retell_from_number || '');
      setDelays(cfg.retell_delays || [20, 60, 120]);
      setActiveHours(cfg.retell_active_hours || 8);
      setApiKey('');
    } catch {
      setConfigError('Error al cargar la configuración.');
    } finally {
      setLoadingConfig(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (activeTab === 'configuracion') loadConfig();
  }, [activeTab, loadConfig]);

  useEffect(() => {
    if (activeTab !== 'configuracion') return;
    if (!clientId) return;
    if (!apiKeySet && !apiKey.trim()) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoadingNumbers(true);
      try {
        const nums = await listRetellPhoneNumbers(clientId, apiKey.trim() || undefined);
        if (!cancelled) setAvailableNumbers(nums);
      } catch {
        if (!cancelled) setAvailableNumbers([]);
      } finally {
        if (!cancelled) setLoadingNumbers(false);
      }
    }, apiKey.trim() ? 600 : 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeTab, clientId, apiKeySet, apiKey]);

  // — Save config —
  const handleSaveConfig = async () => {
    if (!clientId) return;
    setSavingConfig(true);
    setConfigMsg('');
    setConfigError('');
    try {
      const data: {
        retell_api_key?: string;
        retell_from_number?: string;
        retell_delays?: number[];
        retell_active_hours?: number;
      } = {};
      if (apiKey.trim()) data.retell_api_key = apiKey.trim();
      if (fromNumber.trim()) data.retell_from_number = fromNumber.trim();
      data.retell_delays = delays;
      data.retell_active_hours = activeHours;
      await updateRetellConfig(clientId, data);
      setConfigMsg('Configuración guardada correctamente.');
      setApiKey('');
      loadConfig();
    } catch {
      setConfigError('Error al guardar la configuración.');
    } finally {
      setSavingConfig(false);
    }
  };

  // — Parada de emergencia —
  const handleCancelAll = async () => {
    if (!clientId) return;
    if (!cancelConfirm) { setCancelConfirm(true); return; }
    setCancelling(true);
    setCancelConfirm(false);
    try {
      const result = await cancelAllPending(clientId);
      setConfigMsg(`✓ ${result.cancelled} rellamadas canceladas`);
      loadRecords();
    } catch {
      setConfigError('Error al cancelar las rellamadas.');
    } finally {
      setCancelling(false);
    }
  };

  const handleCancel = async (id: number) => {
    await updateSeguimiento(id, { status: 'cancelled' });
    loadRecords();
  };

  const handleReset = async (id: number) => {
    await updateSeguimiento(id, { status: 'pending' });
    loadRecords();
  };

  const copyWebhook = () => navigator.clipboard.writeText(webhookUrl);

  const totalPages = Math.ceil(total / PER_PAGE);

  // — Campaign helpers —
  function handleSelectCampaign(batchId: string | null) {
    setSelectedBatchId(batchId);
    setPage(1);
    setStatusFilter('');
    setFechaInicio('');
    setFechaFin('');
  }

  function handleBackToCampaigns() {
    setSelectedBatchId(undefined);
    setRecords([]);
    setTotal(0);
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-indigo-800">Seguimientos</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestión de reintentos de llamada y configuración de Retell AI
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {([['registros', 'Registros', PhoneCall], ['configuracion', 'Configuración', Settings]] as const).map(
            ([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => { setActiveTab(id); setPage(1); }}
                className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            )
          )}
        </nav>
      </div>

      {/* ── TAB: REGISTROS ── */}
      {activeTab === 'registros' && (
        <div className="space-y-4">

          {/* ── MODO CAMPAÑA: grid de cards ── */}
          {isCampaignMode && selectedBatchId === undefined && (
            <>
              {loadingCampaigns ? (
                <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                  Cargando campañas…
                </div>
              ) : campaigns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <LayoutGrid className="w-10 h-10 mb-3 opacity-30" />
                  <p className="text-sm">No hay campañas con seguimientos</p>
                </div>
              ) : (
                <>
                  {/* Métricas globales */}
                  {campaigns.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-2">
                      {[
                        { label: 'Total contactos', value: globalMetrics.total, icon: Users, color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200' },
                        { label: 'Contestaron', value: globalMetrics.answered, icon: PhoneIncoming, color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
                        { label: 'Pendientes', value: globalMetrics.pending, icon: Clock, color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200' },
                        { label: 'Sin contestar', value: globalMetrics.exhausted, icon: PhoneMissed, color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
                        { label: 'Cancelados', value: globalMetrics.cancelled, icon: PhoneOff, color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-200' },
                        { label: 'Tasa contactación', value: `${globalMetrics.contactRate}%`, icon: TrendingUp, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
                      ].map(({ label, value, icon: Icon, color, bg, border }) => (
                        <div key={label} className={`${bg} border ${border} rounded-xl p-4 flex flex-col gap-1`}>
                          <div className="flex items-center gap-1.5">
                            <Icon className={`w-3.5 h-3.5 ${color}`} />
                            <span className="text-xs text-gray-500">{label}</span>
                          </div>
                          <span className={`text-2xl font-bold ${color}`}>{value}</span>
                        </div>
                      ))}
                    </div>
                  )}

                <div className="flex flex-col gap-4">
                  {campaigns.map((c) => {
                    const tot = Number(c.total) || 0;
                    const answered = Number(c.answered) || 0;
                    const pending = Number(c.pending) || 0;
                    const exhausted = Number(c.exhausted) || 0;
                    const cancelled = Number(c.cancelled) || 0;
                    const isSinCampana = c.batch_call_id === null;

                    return (
                      <div
                        key={c.batch_call_id ?? '__sin_campana__'}
                        className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4 hover:shadow-md transition-shadow"
                      >
                        {/* Header de la card */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className={`font-semibold text-sm truncate ${isSinCampana ? 'italic text-gray-400' : 'text-gray-900'}`}>
                              {isSinCampana ? 'Sin campaña asignada' : truncateBatchId(c.batch_call_id!)}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {c.first_created ? formatDate(c.first_created) : '—'}
                            </p>
                          </div>
                          <span className="shrink-0 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                            {tot} total
                          </span>
                        </div>

                        {/* Barra de progreso por estado */}
                        {tot > 0 && (
                          <div className="space-y-1.5">
                            <div className="flex h-2 rounded-full overflow-hidden bg-gray-100">
                              {answered > 0 && (
                                <div className="bg-green-500" style={{ width: `${(answered / tot) * 100}%` }} title={`Contestó: ${answered}`} />
                              )}
                              {pending > 0 && (
                                <div className="bg-yellow-400" style={{ width: `${(pending / tot) * 100}%` }} title={`Pendiente: ${pending}`} />
                              )}
                              {exhausted > 0 && (
                                <div className="bg-red-400" style={{ width: `${(exhausted / tot) * 100}%` }} title={`Agotado: ${exhausted}`} />
                              )}
                              {cancelled > 0 && (
                                <div className="bg-gray-300" style={{ width: `${(cancelled / tot) * 100}%` }} title={`Cancelado: ${cancelled}`} />
                              )}
                            </div>
                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                              {answered > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />{answered} contestó</span>}
                              {pending > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />{pending} pendiente</span>}
                              {exhausted > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />{exhausted} agotado</span>}
                              {cancelled > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />{cancelled} cancelado</span>}
                            </div>
                          </div>
                        )}

                        <button
                          onClick={() => handleSelectCampaign(c.batch_call_id)}
                          className="w-full text-sm text-blue-600 hover:text-blue-800 font-medium text-right transition-colors"
                        >
                          Ver registros →
                        </button>
                      </div>
                    );
                  })}
                </div>
                </>
              )}
            </>
          )}

          {/* ── TABLA DE REGISTROS (modo normal, o modo campaña con campaña seleccionada) ── */}
          {(!isCampaignMode || selectedBatchId !== undefined) && (
            <>
              {/* Back button — solo en modo campaña */}
              {isCampaignMode && selectedBatchId !== undefined && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleBackToCampaigns}
                    className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Volver a campañas
                  </button>
                  <span className="text-gray-300">|</span>
                  <span className="text-sm font-medium text-gray-700">
                    {selectedBatchId === null ? 'Sin campaña asignada' : truncateBatchId(selectedBatchId)}
                  </span>
                </div>
              )}

              {/* Filtros */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={applyTodayFilter}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                    fechaInicio === new Date().toISOString().slice(0, 10)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <CalendarDays className="w-4 h-4" />
                  Hoy
                </button>

                <input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => { setFechaInicio(e.target.value); setPage(1); }}
                  className="text-sm border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-400">—</span>
                <input
                  type="date"
                  value={fechaFin}
                  onChange={(e) => { setFechaFin(e.target.value); setPage(1); }}
                  className="text-sm border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {(fechaInicio || fechaFin) && (
                  <button onClick={clearDateFilter} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
                    <XCircle className="w-4 h-4" />
                  </button>
                )}

                <div className="w-px h-6 bg-gray-200" />

                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                  className="text-sm border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todos los estados</option>
                  {Object.entries(STATUS_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
                <button
                  onClick={loadRecords}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Actualizar
                </button>
                <span className="text-sm text-gray-400 ml-auto">{total} registros</span>
              </div>

              {/* Error */}
              {errorRecords && (
                <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {errorRecords}
                </div>
              )}

              {/* Tabla */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                {loadingRecords ? (
                  <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
                    <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                    Cargando…
                  </div>
                ) : records.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                    <PhoneCall className="w-10 h-10 mb-3 opacity-30" />
                    <p className="text-sm">No hay registros</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          {['Contacto', 'Teléfono', 'Intentos', 'Estado', 'Última llamada'].map(h => (
                            <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {records.map((r) => (
                          <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 font-medium text-gray-900">
                              {getContactName(r)}
                            </td>
                            <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                              {r.phone_number}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <span className="font-semibold text-gray-800">{r.intento_actual}</span>
                                <span className="text-gray-400">/</span>
                                <span className="text-gray-500">{r.max_intentos}</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                                <div
                                  className="bg-blue-500 h-1 rounded-full"
                                  style={{ width: `${Math.min(100, (r.intento_actual / r.max_intentos) * 100)}%` }}
                                />
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] || STATUS_COLORS.pending}`}>
                                {STATUS_ICON[r.status]}
                                {STATUS_LABELS[r.status] || r.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-500 text-xs">
                              {formatDate(r.updated_at || r.created_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-md disabled:opacity-40 hover:bg-gray-50"
                  >
                    Anterior
                  </button>
                  <span className="text-sm text-gray-600">
                    Página {page} de {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-md disabled:opacity-40 hover:bg-gray-50"
                  >
                    Siguiente
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── TAB: CONFIGURACIÓN ── */}
      {activeTab === 'configuracion' && (
        <div className="max-w-2xl space-y-6">
          {loadingConfig ? (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <RefreshCw className="w-4 h-4 animate-spin" /> Cargando configuración…
            </div>
          ) : (
            <>
              {/* Webhook URL — solo admin */}
              {userIsAdmin && <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">
                  URL del Webhook (Retell)
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm bg-white border border-blue-200 rounded-md px-3 py-2 text-blue-900 break-all">
                    {webhookUrl}
                  </code>
                  <button
                    onClick={copyWebhook}
                    className="shrink-0 p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-md transition-colors"
                    title="Copiar"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-blue-600 mt-2">
                  Pegá esta URL en la configuración de webhook de tu agente en Retell AI.
                </p>
              </div>}

              {/* Credenciales — solo admin */}
              {userIsAdmin && <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-5">
                <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <Settings className="w-4 h-4 text-gray-500" />
                  Credenciales Retell AI
                </h2>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    API Key de Retell
                  </label>
                  {apiKeySet && (
                    <p className="text-xs text-green-600 mb-2 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Ya tenés una API key configurada. Dejá el campo vacío para no cambiarla.
                    </p>
                  )}
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={apiKeySet ? 'Nueva API key (opcional)' : 'key_xxxxxxxxxxxxxxxx'}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Número de salida (From Number)
                  </label>
                  {loadingNumbers ? (
                    <div className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-400 bg-gray-50">
                      Cargando números…
                    </div>
                  ) : availableNumbers.length > 0 ? (
                    <select
                      value={fromNumber}
                      onChange={(e) => setFromNumber(e.target.value)}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">— Seleccionar número —</option>
                      {availableNumbers.map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={fromNumber}
                      onChange={(e) => setFromNumber(e.target.value)}
                      placeholder="+34XXXXXXXXX"
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {availableNumbers.length > 0
                      ? 'Números disponibles en tu cuenta Retell.'
                      : 'Número con prefijo internacional desde el que se hacen los reintentos.'}
                  </p>
                </div>
              </div>}

              {/* Ventana activa y delays */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-5">
                <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <Settings className="w-4 h-4 text-gray-500" />
                  Configuración de rellamadas
                </h2>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ventana de rellamadas (horas)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      max={24}
                      value={activeHours}
                      onChange={(e) => setActiveHours(Number(e.target.value))}
                      className="w-24 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-500">
                      horas desde el <code className="text-xs bg-gray-100 px-1 rounded">date_to_call</code> de cada registro
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Pasadas estas horas, los reintentos se cancelan automáticamente.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tiempos entre reintentos (minutos)
                  </label>
                  <p className="text-xs text-gray-400 mb-3">
                    Cada fila es un intento. El largo de la lista define cuántos reintentos se hacen.
                  </p>
                  <div className="space-y-2">
                    {delays.map((min, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 w-24 shrink-0">
                          {i === 0 ? 'Tras llamada original' : `Tras intento ${i}`}
                        </span>
                        <input
                          type="number"
                          min={1}
                          value={min}
                          onChange={(e) => {
                            const next = [...delays];
                            next[i] = Number(e.target.value);
                            setDelays(next);
                          }}
                          className="w-24 border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-xs text-gray-400">min</span>
                        <span className="text-xs text-gray-300">
                          ({min >= 60 ? `${(min / 60).toFixed(1)}h` : `${min}min`})
                        </span>
                        <button
                          onClick={() => setDelays(delays.filter((_, j) => j !== i))}
                          className="text-red-400 hover:text-red-600 transition-colors"
                          title="Eliminar intento"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setDelays([...delays, 60])}
                    className="mt-3 text-sm text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    + Agregar intento
                  </button>
                  {delays.length > 0 && (
                    <p className="text-xs text-gray-500 mt-2">
                      Total: <strong>{delays.length}</strong> reintentos configurados
                    </p>
                  )}
                </div>

                {/* Parada de emergencia */}
                <div className="border-t border-red-100 pt-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Parada de emergencia</p>
                  <p className="text-xs text-gray-400 mb-3">
                    Cancela todas las rellamadas pendientes de inmediato. No se podrán recuperar.
                  </p>
                  <button
                    onClick={handleCancelAll}
                    disabled={cancelling}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors disabled:opacity-50 ${
                      cancelConfirm
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'border border-red-300 text-red-600 hover:bg-red-50'
                    }`}
                  >
                    {cancelling
                      ? <RefreshCw className="w-4 h-4 animate-spin" />
                      : <StopCircle className="w-4 h-4" />
                    }
                    {cancelling ? 'Cancelando…' : cancelConfirm ? '¿Confirmar? Tocá de nuevo' : 'Cancelar todas las pendientes'}
                  </button>
                  {cancelConfirm && (
                    <button onClick={() => setCancelConfirm(false)} className="mt-2 text-xs text-gray-400 hover:text-gray-600">
                      No, volver atrás
                    </button>
                  )}
                </div>

                {configMsg && (
                  <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                    <CheckCircle2 className="w-4 h-4" />
                    {configMsg}
                  </div>
                )}
                {configError && (
                  <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                    <AlertCircle className="w-4 h-4" />
                    {configError}
                  </div>
                )}

                <button
                  onClick={handleSaveConfig}
                  disabled={savingConfig}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {savingConfig ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {savingConfig ? 'Guardando…' : 'Guardar configuración'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
