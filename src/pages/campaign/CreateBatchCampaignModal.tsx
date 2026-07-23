import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CalendarClock, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react';
import { parseBatchCsv, BatchTaskInput } from '../../lib/parseBatchCsv';
import { BatchWorkspace, CallWindow, createBatchCampaign } from '../../services/api/batchCampaigns';
import { COMMON_TIMEZONES } from '../../lib/timezones';
import { splitEvenly } from '../../lib/splitEvenly';
import { CampaignPartCard } from './CampaignPartCard';
import { CampaignPart, canCreatePart, makeBlankPart, toMinutes } from './campaignParts';

const PREVIEW_ROWS = 60;
const MAX_PARTS = 50;

export function CreateBatchCampaignModal({ clientId, workspaces, syncing, onSyncWorkspace, onClose, onCreated }: {
  clientId: string;
  workspaces: BatchWorkspace[];
  syncing?: boolean;
  onSyncWorkspace?: (workspaceId: string) => void;
  onClose: () => void;
  onCreated: (createdWorkspaceId?: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const detectedTz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const timezones = useMemo(
    () => [...new Set([detectedTz, ...COMMON_TIMEZONES])],
    [detectedTz]
  );

  // CSV compartido (se sube una vez y se reparte en N partes)
  const [tasks, setTasks] = useState<BatchTaskInput[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Partes: cada una es una campaña independiente
  const [partsCount, setPartsCount] = useState(1);
  const [parts, setParts] = useState<CampaignPart[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Reparte los contactos en `partsCount` partes. La config de cada parte se
  // preserva por índice al re-dividir; solo se recalcula su chunk de contactos.
  useEffect(() => {
    const n = Math.max(1, partsCount || 1);
    setParts(prev => {
      const chunks = splitEvenly(tasks, n);
      const next: CampaignPart[] = [];
      for (let i = 0; i < n; i++) {
        const existing = prev[i] ?? makeBlankPart(detectedTz);
        next.push({ ...existing, tasks: chunks[i] ?? [] });
      }
      return next;
    });
  }, [tasks, partsCount, detectedTz]);

  // Mantener una parte expandida válida cuando cambia la cantidad de partes.
  useEffect(() => {
    setExpandedId(prev => (prev && parts.some(p => p.id === prev) ? prev : parts[0]?.id ?? null));
  }, [parts]);

  const handleFile = async (file: File) => {
    setParsing(true);
    setError(null);
    try {
      const text = await file.text();
      const parsed = parseBatchCsv(text);
      if (parsed.error) {
        setError(parsed.error);
        setTasks([]);
        setHeaders([]);
        setFileName(null);
      } else {
        setTasks(parsed.tasks);
        setHeaders(parsed.headers);
        setFileName(file.name);
      }
    } catch {
      setError('No se pudo leer el archivo.');
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const updatePart = (id: string, patch: Partial<CampaignPart>) =>
    setParts(prev => prev.map(p => (p.id === id ? { ...p, ...patch } : p)));

  // Crea (o reintenta) todas las partes que aún no se crearon, una por una.
  // No es atómico: cada parte es un POST independiente; las que quedan OK se
  // marcan 'success' y no se recrean; las que fallan se pueden reintentar.
  async function createAll() {
    setCreating(true);
    setError(null);
    const snapshot = parts;
    for (let i = 0; i < snapshot.length; i++) {
      const p = snapshot[i];
      if (p.status === 'success' || !canCreatePart(p)) continue;
      updatePart(p.id, { status: 'creating', errorMsg: undefined });
      try {
        const call_window: CallWindow | null = p.useWindow
          ? { windows: [{ start: toMinutes(p.windowStart), end: toMinutes(p.windowEnd) }], timezone: p.timezone, day: p.windowDays }
          : null;
        const minutes = (v: string) => {
          const x = parseInt(v, 10);
          return Number.isFinite(x) && x > 0 ? x * 60 : null; // → segundos
        };
        const maxConc = parseInt(p.maxConcurrency, 10);
        const finalName = p.name.trim();
        // El form pide REINTENTOS (adicionales a la llamada inicial); el backend
        // espera intentos TOTALES = reintentos + 1. Apagado = 1 (solo la inicial).
        const retries = Math.min(9, Math.max(1, parseInt(p.maxRetries, 10) || 3));

        const res = await createBatchCampaign(clientId, {
          workspace_id: p.workspaceId,
          name: finalName,
          tasks: p.tasks,
          from_number: p.fromNumber,
          ...(p.agentId ? { override_agent_id: p.agentId } : {}),
          scheduled_at: p.mode === 'scheduled' && p.scheduledAt ? new Date(p.scheduledAt).getTime() : null,
          call_window,
          max_concurrency: Number.isFinite(maxConc) && maxConc > 0 ? maxConc : null,
          max_retry_attempts: p.retriesOn ? retries + 1 : 1,
          retry_delay_voicemail: p.retriesOn ? minutes(p.delayVoicemailMin) : null,
          retry_delay_no_answer: p.retriesOn ? minutes(p.delayNoAnswerMin) : null,
          retry_delay_busy: p.retriesOn ? minutes(p.delayBusyMin) : null,
        });
        updatePart(p.id, { status: 'success', batchId: res.batch_id, errorMsg: undefined });
      } catch (err) {
        updatePart(p.id, { status: 'error', errorMsg: err instanceof Error ? err.message : 'Error al crear la campaña' });
      }
    }
    setCreating(false);
  }

  const previewColumns = (headers.length ? headers : ['phone_number']).filter(Boolean);
  const previewTasks = tasks.slice(0, PREVIEW_ROWS);

  const totalTasks = tasks.length;
  const pendingParts = parts.filter(p => p.status !== 'success');
  const successCount = parts.filter(p => p.status === 'success').length;
  const errorCount = parts.filter(p => p.status === 'error').length;
  const allPendingValid = pendingParts.length > 0 && pendingParts.every(canCreatePart);
  const canCreate = !creating && totalTasks > 0 && allPendingValid;
  const anySuccess = successCount > 0;
  // Una vez que se creó ≥1 parte (o mientras se crea), no se puede cambiar el CSV
  // ni la cantidad de partes: rompería la correspondencia parte↔contactos ya enviados.
  const lockSetup = creating || anySuccess;

  const createLabel = creating
    ? 'Creando…'
    : anySuccess && errorCount > 0
      ? `Reintentar fallidas (${errorCount})`
      : parts.length <= 1
        ? 'Crear campaña'
        : `Crear ${pendingParts.length} campaña${pendingParts.length !== 1 ? 's' : ''}`;

  function handleClose() {
    if (successCount > 0) {
      const firstWs = parts.find(p => p.status === 'success')?.workspaceId;
      onCreated(firstWs);
    } else {
      onClose();
    }
  }

  const label = 'block text-sm font-medium text-slate-700 mb-1';

  // El backdrop NO cierra el modal: solo la X / Cerrar lo cierran, para no perder la
  // configuración por un click accidental fuera del popup.
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white rounded-t-xl z-10">
          <h4 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-blue-700" /> Nueva campaña programada
          </h4>
          <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {error && (
            <div className="p-3 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          {/* CSV (uno solo, se reparte en las partes) */}
          <div>
            <label className={label}>Contactos (CSV) *</label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={parsing || lockSetup}
              className="w-full border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50/50 rounded-xl p-6 text-center transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {parsing ? (
                <span className="flex items-center justify-center gap-2 text-slate-600">
                  <Loader2 className="w-5 h-5 animate-spin" /> Procesando archivo...
                </span>
              ) : fileName ? (
                <span className="flex items-center justify-center gap-2 text-emerald-700 font-medium">
                  <FileSpreadsheet className="w-5 h-5" /> {fileName} — {tasks.length.toLocaleString('es')} contactos
                </span>
              ) : (
                <span className="flex flex-col items-center gap-1 text-slate-500">
                  <Upload className="w-6 h-6" />
                  <span className="font-medium text-slate-700">Subir CSV</span>
                  <span className="text-xs">
                    La primera columna es el teléfono — vale <code className="bg-slate-100 px-1 rounded">phone_number</code>, <code className="bg-slate-100 px-1 rounded">phone</code>, <code className="bg-slate-100 px-1 rounded">number</code>, <code className="bg-slate-100 px-1 rounded">teléfono</code>… se detecta sola.
                    El resto de columnas se envían como variables al agente.
                  </span>
                </span>
              )}
            </button>
          </div>

          {/* Preview del CSV completo */}
          {tasks.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto max-h-56 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr>
                      {previewColumns.map((col, ci) => (
                        <th key={ci} className="text-left px-3 py-2 font-medium text-slate-600 border-b border-slate-200 whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewTasks.map((t, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="px-3 py-1.5 text-slate-700 whitespace-nowrap">{t.to_number}</td>
                        {previewColumns.slice(1).map((col, ci) => (
                          <td key={ci} className="px-3 py-1.5 text-slate-500 whitespace-nowrap">
                            {t.dynamic_variables?.[col] ?? ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {tasks.length > PREVIEW_ROWS && (
                <div className="px-3 py-2 text-xs text-slate-500 bg-slate-50 border-t border-slate-200">
                  Mostrando {PREVIEW_ROWS} de {tasks.length.toLocaleString('es')} contactos
                </div>
              )}
            </div>
          )}

          {/* Cantidad de partes + tarjetas por parte */}
          {tasks.length > 0 && (
            <>
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <label className={label}>Dividir en cuántas partes</label>
                  <input
                    type="number"
                    min={1}
                    max={MAX_PARTS}
                    disabled={lockSetup}
                    value={partsCount}
                    onChange={e => {
                      const v = parseInt(e.target.value || '1', 10);
                      setPartsCount(Math.max(1, Math.min(MAX_PARTS, Number.isFinite(v) ? v : 1)));
                    }}
                    className="w-32 px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
                <p className="text-xs text-slate-500 pb-2.5">
                  Cada parte es una campaña independiente (su propio workspace, número, agente y horario).
                  {parts.length > 1 && ' Elegí workspaces distintos para que corran en paralelo.'}
                </p>
              </div>

              <div className="space-y-3">
                {parts.map((part, i) => (
                  <CampaignPartCard
                    key={part.id}
                    part={part}
                    index={i}
                    total={parts.length}
                    workspaces={workspaces}
                    clientId={clientId}
                    syncing={syncing}
                    onSyncWorkspace={onSyncWorkspace}
                    onChange={patch => updatePart(part.id, patch)}
                    expanded={expandedId === part.id}
                    onToggleExpand={() => setExpandedId(prev => (prev === part.id ? null : part.id))}
                    detectedTz={detectedTz}
                    timezones={timezones}
                    disabled={creating || part.status === 'success'}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <div className="p-5 border-t border-slate-200 flex items-center justify-between gap-3 sticky bottom-0 bg-white rounded-b-xl">
          <p className="text-xs text-slate-500">
            {anySuccess || errorCount > 0
              ? <>{successCount} creada{successCount !== 1 ? 's' : ''}{errorCount > 0 ? `, ${errorCount} con error` : ''}.</>
              : totalTasks > 0
                ? <>{totalTasks.toLocaleString('es')} contactos en {parts.length} parte{parts.length !== 1 ? 's' : ''}.</>
                : null}
          </p>
          <div className="flex gap-2">
            <button onClick={handleClose} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50">
              {anySuccess ? 'Cerrar' : 'Cancelar'}
            </button>
            <button
              onClick={createAll}
              disabled={!canCreate}
              className="px-4 py-2 rounded-lg bg-[#0a2a5a] hover:bg-[#1e4a8a] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium flex items-center gap-2"
            >
              {creating && <Loader2 className="w-4 h-4 animate-spin" />}
              {createLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
