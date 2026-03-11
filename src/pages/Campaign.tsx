import { useState, useEffect, useMemo } from 'react';
import { Megaphone, RefreshCw, AlertCircle, Search, BarChart3 } from 'lucide-react';
import { RetellBatchCall, RetellPhoneNumber } from '../types';
import { fetchBatchCalls, fetchFolders, getWorkspaceNameFromWebhook } from '../api';
import { useCallsContext } from '../context/CallsContext';

interface BatchCallWithWorkspace extends RetellBatchCall {
  workspace_api_key: string;
  workspace_name: string;
}

interface CampaignProps {
  onNavigate: (page: string) => void;
}

export function Campaign({ onNavigate }: CampaignProps) {
  const { apiKey, apiKeyTest, phoneNumbers, loadPhoneNumbers, clientId } = useCallsContext();
  const [batchCallsByWorkspace, setBatchCallsByWorkspace] = useState<BatchCallWithWorkspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workspaceFilter, setWorkspaceFilter] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [workspaceFoldersByApiKey, setWorkspaceFoldersByApiKey] = useState<Record<string, string>>({});

  // Cargar nombres de workspace desde Retell (folders), igual que en PhoneNumbers
  useEffect(() => {
    const loadFoldersForWorkspaces = async () => {
      const apiKeysToUse =
        apiKeyTest && apiKeyTest.length > 0 ? apiKeyTest : apiKey ? [apiKey] : [];
      if (apiKeysToUse.length === 0) return;

      const newMapping: Record<string, string> = {};
      for (const key of apiKeysToUse) {
        try {
          const folders = await fetchFolders(key);
          if (!folders || folders.length === 0) continue;
          if (folders.length === 1) {
            newMapping[key] = folders[0].folderName;
            continue;
          }
          const baseClientId = (clientId || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
          let bestFolder = folders[0];
          let bestScore = -1;
          for (const folder of folders) {
            const normalizedName = folder.folderName.toLowerCase().replace(/[^a-z0-9]+/g, '');
            let score = 0;
            if (baseClientId && normalizedName.includes(baseClientId)) {
              score = baseClientId.length;
            } else if (baseClientId) {
              const maxLen = Math.min(baseClientId.length, normalizedName.length);
              while (score < maxLen && baseClientId[score] === normalizedName[score]) {
                score++;
              }
            }
            if (score > bestScore) {
              bestScore = score;
              bestFolder = folder;
            }
          }
          newMapping[key] = bestFolder.folderName;
        } catch (e) {
          // console.error('Error al cargar folders para workspace (Campaign):', key, e);
        }
      }
      if (Object.keys(newMapping).length > 0) {
        setWorkspaceFoldersByApiKey(newMapping);
      }
    };
    loadFoldersForWorkspaces();
  }, [apiKey, apiKeyTest, clientId]);

  // Mapear cada API key a un nombre de workspace (misma prioridad que PhoneNumbers: folders → metadata → webhook → fallback)
  const workspaceNameByApiKey = useMemo(() => {
    const mapping: Record<string, string> = {};
    const keys = Array.from(
      new Set(
        (apiKeyTest && apiKeyTest.length > 0 ? apiKeyTest : apiKey ? [apiKey] : []).filter(Boolean)
      )
    ) as string[];

    keys.forEach((key, index) => {
      const phoneForKey = phoneNumbers.find((p: RetellPhoneNumber) => p.workspace_api_key === key);
      const fromFolders = workspaceFoldersByApiKey[key];
      const fromMetadata = phoneForKey?.workspace_name;
      const fromWebhook = phoneForKey?.inbound_webhook_url
        ? getWorkspaceNameFromWebhook(phoneForKey.inbound_webhook_url)
        : null;
      mapping[key] = fromFolders || fromMetadata || fromWebhook || `Workspace ${index + 1}`;
    });
    return mapping;
  }, [apiKey, apiKeyTest, phoneNumbers, workspaceFoldersByApiKey]);

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

  // Filtrar campañas por workspace y búsqueda
  const displayBatchCalls = useMemo(() => {
    let list = batchCallsByWorkspace;
    if (workspaceFilter) {
      list = list.filter((b) => b.workspace_name === workspaceFilter);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      list = list.filter(
        (b) =>
          (b.name && b.name.toLowerCase().includes(term)) ||
          (b.batch_call_id && b.batch_call_id.toLowerCase().includes(term)) ||
          (b.from_number && b.from_number.includes(term))
      );
    }
    return list;
  }, [batchCallsByWorkspace, workspaceFilter, searchTerm]);

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
    loadPhoneNumbers();
  }, [loadPhoneNumbers]);

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

  const getStatusBadgeClass = (status: string) => {
    if (status === 'completed') return 'bg-emerald-100 text-emerald-700';
    if (status === 'in_progress' || status === 'running') return 'bg-blue-100 text-blue-800';
    return 'bg-slate-100 text-slate-700';
  };

  if (apiKeysToFetch.length === 0) {
    return (
      <div className="p-8 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Campaña</h2>
          <p className="text-slate-600">Lista de batch calls por workspace</p>
        </div>
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 text-center text-slate-600">
          <Megaphone className="w-12 h-12 mx-auto mb-3 text-slate-400" />
          <p>No hay API keys configuradas para este cliente. Configura al menos una API key para ver las campañas.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Campaña</h2>
        <p className="text-slate-600">Lista de batch calls de todas las API keys (workspaces) cargadas para este cliente</p>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-slate-200">
        <div className="p-6 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-slate-50 to-blue-50">
          <h3 className="text-lg font-semibold text-slate-800">Campañas</h3>

          <div className="flex flex-wrap gap-2 items-center justify-end">
            <div className="relative flex items-center">
              <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nombre, ID o número..."
                className="pl-9 pr-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-56 min-w-0"
              />
            </div>

            {availableWorkspaces.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Workspace:</span>
                <select
                  value={workspaceFilter || ''}
                  onChange={(e) => setWorkspaceFilter(e.target.value || null)}
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
                className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:shadow-md"
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
                  <div className="flex items-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(status)}`}>
                      {status}
                    </span>
                  </div>
                </div>

                <div className="px-6 py-4 bg-slate-50/50 border-y border-slate-100">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" />
                      Progreso de la campaña
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex items-center px-3 py-1 rounded-full text-xs font-semibold shadow-sm bg-slate-100 text-slate-700">
                        <span className="mr-1 opacity-70">Total:</span> {Number(total).toLocaleString()}
                      </span>
                      <span className="flex items-center text-slate-700 text-xs font-semibold">
                        <span className="mr-1">Enviadas:</span> <span className="text-blue-700">{Number(sent).toLocaleString()}</span>
                      </span>
                      <span className="flex items-center text-slate-700 text-xs font-semibold">
                        <span className="mr-1">Contestadas:</span> <span className="text-amber-700">{Number(pickedUp).toLocaleString()}</span>
                      </span>
                      <span className="flex items-center text-slate-700 text-xs font-semibold">
                        <span className="mr-1">Completadas:</span> <span className="text-emerald-700">{Number(completed).toLocaleString()}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-y-6 gap-x-8">
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Workspace</p>
                      <p className="text-sm font-medium">{batch.workspace_name}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Desde número</p>
                      <p className="text-sm font-medium">{batch.from_number || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Estado</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(status)}`}>
                        {status}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Zona horaria</p>
                      <p className="text-sm font-medium">{batch.timezone || '—'}</p>
                    </div>
                    {batch.scheduled_timestamp != null && (
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Programado</p>
                        <p className="text-sm font-medium">
                          {batch.scheduled_timestamp
                            ? new Date(batch.scheduled_timestamp * 1000).toLocaleString()
                            : '—'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
