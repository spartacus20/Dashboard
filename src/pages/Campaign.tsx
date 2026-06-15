import { useState, useEffect, useMemo } from 'react';
import { Megaphone, RefreshCw, AlertCircle, Search, BarChart3, Upload, Pencil, Trash2, ChevronLeft, ChevronRight, X, Info } from 'lucide-react';
import { RetellBatchCall } from '../types';
import { fetchBatchCalls, fetchFolders, deleteBatchCall, fetchAgentIdForBatch } from '../api';
import { useCallsContext } from '../context/CallsContext';
import { BatchCallingTab } from './campaign/BatchCallingTab';
import { Button } from '../components/ui/button';
import { CAMPAIGN_PAGE_SIZE as ITEMS_PER_PAGE } from '../lib/constants';

interface BatchCallWithWorkspace extends RetellBatchCall {
  workspace_api_key: string;
  workspace_name: string;
}

interface CampaignProps {
  onNavigate: (page: string) => void;
}

export function Campaign({ onNavigate: _onNavigate }: CampaignProps) {
  const { apiKey, apiKeyTest, clientId } = useCallsContext();
  const [campaignTab, setCampaignTab] = useState<'campaigns' | 'batch-calling'>('campaigns');
  const [currentPage, setCurrentPage] = useState(1);
  const [batchCallsByWorkspace, setBatchCallsByWorkspace] = useState<BatchCallWithWorkspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workspaceFilter, setWorkspaceFilter] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [workspaceFoldersByApiKey, setWorkspaceFoldersByApiKey] = useState<Record<string, string>>({});
  const [batchToDelete, setBatchToDelete] = useState<BatchCallWithWorkspace | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isPlannedStatus = (s: string) => (s || '').toLowerCase().trim() === 'planned';

  // Lanzadas = ya enviadas/en curso/completadas (cualquier estado que no sea planned)
  const isLaunchedStatus = (s: string) => !isPlannedStatus(s) && (s || '').trim() !== '';

  const handleDeleteClick = (batch: BatchCallWithWorkspace) => setBatchToDelete(batch);
  const handleDeleteCancel = () => setBatchToDelete(null);

  const handleDeleteConfirm = async () => {
    if (!batchToDelete) return;
    setIsDeleting(true);
    setError(null);
    try {
      await deleteBatchCall(batchToDelete.workspace_api_key, batchToDelete.batch_call_id);
      setBatchToDelete(null);
      await loadAllBatchCalls();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar la campaña');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditClick = () => {
    setCampaignTab('batch-calling');
  };

  // Cargar nombres de folders en paralelo, actualizando el estado de forma incremental
  useEffect(() => {
    const apiKeysToUse = apiKeyTest && apiKeyTest.length > 0 ? apiKeyTest : apiKey ? [apiKey] : [];
    if (apiKeysToUse.length === 0) return;

    const baseClientId = (clientId || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

    const resolveFolderName = (folders: { folderName: string }[]): string => {
      if (folders.length === 1) return folders[0].folderName;
      let best = folders[0];
      let bestScore = -1;
      for (const folder of folders) {
        const norm = folder.folderName.toLowerCase().replace(/[^a-z0-9]+/g, '');
        let score = 0;
        if (baseClientId && norm.includes(baseClientId)) {
          score = baseClientId.length;
        } else if (baseClientId) {
          const maxLen = Math.min(baseClientId.length, norm.length);
          while (score < maxLen && baseClientId[score] === norm[score]) score++;
        }
        if (score > bestScore) { bestScore = score; best = folder; }
      }
      return best.folderName;
    };

    apiKeysToUse.forEach(async (key) => {
      try {
        const folders = await fetchFolders(key);
        if (!folders || folders.length === 0) return;
        const name = resolveFolderName(folders);
        setWorkspaceFoldersByApiKey(prev => ({ ...prev, [key]: name }));
      } catch {
        // silencioso
      }
    });
  }, [apiKey, apiKeyTest, clientId]);

  // Mapear cada API key a un nombre de workspace (folders primero, fallback genérico)
  const workspaceNameByApiKey = useMemo(() => {
    const mapping: Record<string, string> = {};
    const keys = (apiKeyTest && apiKeyTest.length > 0 ? apiKeyTest : apiKey ? [apiKey] : []) as string[];
    keys.forEach((key, index) => {
      mapping[key] = workspaceFoldersByApiKey[key] || `Workspace ${index + 1}`;
    });
    return mapping;
  }, [apiKey, apiKeyTest, workspaceFoldersByApiKey]);

  const availableWorkspaces = useMemo(
    () => Array.from(new Set(Object.values(workspaceNameByApiKey).filter(Boolean))),
    [workspaceNameByApiKey]
  );

  // Lista de API keys a consultar (todas las cargadas por client_id)
  const apiKeysToFetch = useMemo(() => {
    if (apiKeyTest && apiKeyTest.length > 0) return apiKeyTest;
    if (apiKey) return [apiKey];
    return [];
  }, [apiKey, apiKeyTest]);

  // Prioridad para ordenar: planned e in_progress/running primero
  const getSortPriority = (status: string) => {
    const s = (status || '').toLowerCase().trim();
    if (s === 'planned') return 0;
    if (s === 'in_progress' || s === 'running') return 1;
    return 2;
  };

  // Filtrar, ordenar y paginar campañas
  const filteredBatchCalls = useMemo(() => {
    let list = batchCallsByWorkspace;
    if (workspaceFilter) list = list.filter((b) => b.workspace_name === workspaceFilter);
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      list = list.filter(
        (b) =>
          (b.name && b.name.toLowerCase().includes(term)) ||
          (b.batch_call_id && b.batch_call_id.toLowerCase().includes(term)) ||
          (b.from_number && b.from_number.includes(term))
      );
    }
    return [...list].sort(
      (a, b) => getSortPriority(a.status || '') - getSortPriority(b.status || '')
    );
  }, [batchCallsByWorkspace, workspaceFilter, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredBatchCalls.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const displayBatchCalls = filteredBatchCalls.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE
  );

  // Cargar batch calls de todas las API keys
  const loadAllBatchCalls = async () => {
    if (apiKeysToFetch.length === 0) {
      setBatchCallsByWorkspace([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const results = await Promise.all(
        apiKeysToFetch.map(async (key) => {
          try {
            const list = await fetchBatchCalls(key);
            const workspaceName = workspaceNameByApiKey[key] || 'Workspace';
            return (list || []).map((batch: RetellBatchCall) => ({
              ...batch,
              workspace_api_key: key,
              workspace_name: workspaceName,
            }));
          } catch (err) {
            // console.error(`Error obteniendo batch calls para API key ${key.substring(0, 10)}...:`, err);
            return [] as BatchCallWithWorkspace[];
          }
        })
      );

      const combined = results.flat();
      setBatchCallsByWorkspace(combined);
    } catch (err) {
      // console.error('Error cargando campañas:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar las campañas');
      setBatchCallsByWorkspace([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllBatchCalls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKeysToFetch.join(',')]);

  // Actualizar nombres de workspace cuando terminen de cargarse los phone numbers
  useEffect(() => {
    if (!loading && Object.keys(workspaceNameByApiKey).length > 0 && batchCallsByWorkspace.length > 0) {
      setBatchCallsByWorkspace((prev) =>
        prev.map((b) => ({
          ...b,
          workspace_name: workspaceNameByApiKey[b.workspace_api_key] || b.workspace_name,
        }))
      );
    }

  }, [workspaceNameByApiKey, loading, batchCallsByWorkspace.length]);

  const [selectedBatch, setSelectedBatch] = useState<BatchCallWithWorkspace | null>(null);
  const [modalAgent, setModalAgent] = useState<{ agent_id: string | null; agent_name: string | null } | undefined>(undefined);

  useEffect(() => {
    if (!selectedBatch) { setModalAgent(undefined); return; }
    setModalAgent(undefined);
    fetchAgentIdForBatch(selectedBatch.workspace_api_key, selectedBatch.batch_call_id)
      .then((result) => setModalAgent(result));
  }, [selectedBatch]);

  const getStatusBadgeClass = (status: string) => {
    if (status === 'completed') return 'bg-emerald-100 text-emerald-700';
    if (status === 'sent') return 'bg-green-100 text-green-700';
    if (status === 'in_progress' || status === 'running') return 'bg-blue-100 text-blue-800';
    if (isPlannedStatus(status)) return 'bg-amber-100 text-amber-700';
    return 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="p-8 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Campaña</h2>
          <p className="text-slate-600">Lista de batch calls y creación de nuevas campañas desde CSV</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setCampaignTab('campaigns')}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
              campaignTab === 'campaigns'
                ? 'bg-[#05163b] text-white'
                : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Megaphone className="w-4 h-4" />
            Campañas
          </button>
          <button
            type="button"
            onClick={() => setCampaignTab('batch-calling')}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
              campaignTab === 'batch-calling'
                ? 'bg-[#05163b] text-white'
                : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Upload className="w-4 h-4" />
            Batch Calling
          </button>
        </div>
      </div>

      {campaignTab === 'batch-calling' ? (
        <BatchCallingTab apiKeys={apiKeysToFetch} workspaceNameByApiKey={workspaceNameByApiKey} />
      ) : (
      <div className="bg-white rounded-xl shadow-lg border border-slate-200">
        <div className="p-6 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-slate-50 to-blue-50">
          <h3 className="text-lg font-semibold text-slate-800">Campañas</h3>

          <div className="flex flex-wrap gap-2 items-center justify-end">
            <div className="relative flex items-center">
              <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                placeholder="Buscar por nombre, ID o número..."
                className="pl-9 pr-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-56 min-w-0"
              />
            </div>

            {availableWorkspaces.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Workspace:</span>
                <select
                  value={workspaceFilter || ''}
                  onChange={(e) => { setWorkspaceFilter(e.target.value || null); setCurrentPage(1); }}
                  className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Todos</option>
                  {availableWorkspaces.map((ws) => (
                    <option key={ws} value={ws}>
                      {ws}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={() => loadAllBatchCalls()}
              disabled={loading}
              className={`px-4 py-2 rounded-lg text-white flex items-center ${
                loading
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800'
              }`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Cargando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-5 w-5 mr-1" />
                  Actualizar
                </>
              )}
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="p-4 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </div>
          )}

          {loading && (
            <div className="p-6 text-center text-slate-600">
              Cargando datos...
            </div>
          )}

          {!loading && !error && filteredBatchCalls.length > 0 && (
            <div className="flex items-center justify-between text-sm text-slate-500 pb-1">
              <span>{filteredBatchCalls.length} campaña{filteredBatchCalls.length !== 1 ? 's' : ''} en total</span>
              {totalPages > 1 && <span>Página {safePage} de {totalPages}</span>}
            </div>
          )}

          {!loading && !error && displayBatchCalls.length === 0 && (
            <div className="p-6 text-center text-slate-600">
              {batchCallsByWorkspace.length === 0
                ? 'No hay campañas (batch calls) en ninguno de los workspaces configurados.'
                : 'No se encontraron campañas con los filtros aplicados.'}
            </div>
          )}

          {!loading && !error && displayBatchCalls.map((batch) => {
            const total = batch.total_task_count ?? batch.total ?? 0;
            const sent = batch.sent ?? 0;
            const pickedUp = batch.picked_up ?? 0;
            const completed = batch.completed ?? 0;
            const status = batch.status || '—';

            return (
              <div
                key={`${batch.workspace_api_key}-${batch.batch_call_id}`}
                className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:shadow-md cursor-pointer"
                onClick={() => setSelectedBatch(batch)}
              >
                <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="bg-blue-100 p-3 rounded-full">
                      <Megaphone className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-xl font-bold tracking-tight text-slate-800">
                          {batch.name || batch.batch_call_id}
                        </h3>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                          {batch.workspace_name}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 mt-0.5">ID: {batch.batch_call_id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(status)}`}>
                      {status}
                    </span>
                    {isPlannedStatus(status) && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditClick()}
                          className="text-slate-700"
                        >
                          <Pencil className="w-4 h-4 mr-1" />
                          Editar
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteClick(batch)}
                          disabled={isDeleting}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          {isDeleting && batchToDelete?.batch_call_id === batch.batch_call_id ? 'Eliminando...' : 'Eliminar'}
                        </Button>
                      </>
                    )}
                    {isLaunchedStatus(status) && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteClick(batch)}
                        disabled={isDeleting}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        {isDeleting && batchToDelete?.batch_call_id === batch.batch_call_id ? 'Eliminando...' : 'Eliminar'}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" />
                      Progreso
                    </span>
                    <div className="flex flex-wrap items-center gap-3 flex-1">
                      <span className="flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                        <span className="mr-1 opacity-70">Total:</span> {Number(total).toLocaleString()}
                      </span>
                      <span className="text-xs font-semibold text-slate-600">
                        Enviadas: <span className="text-blue-700">{Number(sent).toLocaleString()}</span>
                      </span>
                      <span className="text-xs font-semibold text-slate-600">
                        Contestadas: <span className="text-amber-700">{Number(pickedUp).toLocaleString()}</span>
                      </span>
                      <span className="text-xs font-semibold text-slate-600">
                        Completadas: <span className="text-emerald-700">{Number(completed).toLocaleString()}</span>
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 flex items-center gap-1 shrink-0">
                      <Info className="w-3.5 h-3.5" /> Ver detalles
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Controles de paginación */}
          {!loading && !error && totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
                .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('...');
                  acc.push(p);
                  return acc;
                }, [])
                .map((item, idx) =>
                  item === '...' ? (
                    <span key={`dots-${idx}`} className="px-1 text-slate-400 text-sm">…</span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setCurrentPage(item as number)}
                      className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                        safePage === item
                          ? 'bg-blue-600 text-white'
                          : 'border border-slate-300 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {item}
                    </button>
                  )
                )}
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Modal detalles de campaña */}
      {selectedBatch && (() => {
        const mTotal = Number(selectedBatch.total_task_count ?? selectedBatch.total ?? 0);
        const mSent = Number(selectedBatch.sent ?? 0);
        const mPickedUp = Number(selectedBatch.picked_up ?? 0);
        const mCompleted = Number(selectedBatch.completed ?? 0);
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={() => setSelectedBatch(null)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between px-6 pt-6 pb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-2.5 rounded-xl">
                    <Megaphone className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-slate-800 leading-tight">
                        {selectedBatch.name || selectedBatch.batch_call_id}
                      </h3>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(selectedBatch.status || '—')}`}>
                        {selectedBatch.status || '—'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 font-mono">{selectedBatch.batch_call_id}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedBatch(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Métricas */}
              <div className="grid grid-cols-4 gap-3 px-6 pb-5">
                <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                  <p className="text-xl font-bold text-slate-800">{mTotal.toLocaleString()}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Total</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
                  <p className="text-xl font-bold text-blue-700">{mSent.toLocaleString()}</p>
                  <p className="text-xs text-blue-500 mt-0.5">Enviadas</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-3 text-center border border-amber-100">
                  <p className="text-xl font-bold text-amber-700">{mPickedUp.toLocaleString()}</p>
                  <p className="text-xs text-amber-500 mt-0.5">Contestadas</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
                  <p className="text-xl font-bold text-emerald-700">{mCompleted.toLocaleString()}</p>
                  <p className="text-xs text-emerald-500 mt-0.5">Completadas</p>
                </div>
              </div>

              {/* Detalles */}
              <div className="border-t border-slate-100 px-6 py-5 grid grid-cols-2 gap-x-8 gap-y-4">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Workspace</p>
                  <p className="text-sm font-medium text-slate-700">{selectedBatch.workspace_name}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Desde número</p>
                  <p className="text-sm font-medium text-slate-700">{selectedBatch.from_number || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Zona horaria</p>
                  <p className="text-sm font-medium text-slate-700">{selectedBatch.timezone || '—'}</p>
                </div>
                {selectedBatch.scheduled_timestamp != null && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Programado</p>
                    <p className="text-sm font-medium text-slate-700">
                      {selectedBatch.scheduled_timestamp
                        ? new Date(selectedBatch.scheduled_timestamp * 1000).toLocaleString()
                        : '—'}
                    </p>
                  </div>
                )}
              </div>

              {/* Agente */}
              <div className="border-t border-slate-100 px-6 py-4 bg-slate-50/60">
                <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Agente</p>
                {modalAgent === undefined ? (
                  <p className="text-sm text-slate-400 italic">Cargando…</p>
                ) : modalAgent.agent_id ? (
                  <div>
                    {modalAgent.agent_name && (
                      <p className="text-sm font-semibold text-slate-700 mb-0.5">{modalAgent.agent_name}</p>
                    )}
                    <p className="text-xs font-mono text-slate-400 break-all">{modalAgent.agent_id}</p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">—</p>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal confirmar eliminación */}
      {batchToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => handleDeleteCancel()}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-800 mb-2">¿Eliminar campaña?</h3>
            <p className="text-slate-600 text-sm mb-4">
              Se eliminará la campaña &quot;{batchToDelete.name || batchToDelete.batch_call_id}&quot;. Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => handleDeleteCancel()}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => handleDeleteConfirm()}
                disabled={isDeleting}
              >
                {isDeleting ? 'Eliminando...' : 'Eliminar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
