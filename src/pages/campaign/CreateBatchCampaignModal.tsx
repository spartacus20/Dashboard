import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CalendarClock, FileSpreadsheet, Loader2, Phone, Upload, X } from 'lucide-react';
import { parseBatchCsv, BatchTaskInput, PhoneColumnCandidate, CsvColumn } from '../../lib/parseBatchCsv';
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

  // Detección de la columna de teléfono en el CSV
  const [csvText, setCsvText] = useState<string | null>(null);
  const [columns, setColumns] = useState<CsvColumn[]>([]);
  const [phonePicker, setPhonePicker] = useState<{ candidates: PhoneColumnCandidate[]; showAll: boolean } | null>(null);
  const [phoneHeader, setPhoneHeader] = useState<string | null>(null);

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

  // Aplica el resultado del parser al estado. `uploadName` no-null = venimos de un
  // upload nuevo (se setea/limpia el nombre de archivo); null = elección manual de columna.
  const applyParsed = (parsed: ReturnType<typeof parseBatchCsv>, uploadName: string | null) => {
    setColumns(parsed.columns ?? []);

    if (parsed.needsSelection) {
      const candidates = parsed.candidates ?? [];
      setError(null);
      setTasks([]);
      setHeaders([]);
      setPhoneHeader(null);
      setPhonePicker({ candidates, showAll: candidates.length === 0 });
      if (uploadName !== null) setFileName(uploadName);
      return;
    }

    if (parsed.error) {
      setError(parsed.error);
      setTasks([]);
      setHeaders([]);
      setPhoneHeader(null);
      // Upload nuevo con error → limpiar archivo y cerrar selector; elección manual
      // con error → dejamos el selector abierto para reintentar.
      if (uploadName !== null) { setFileName(null); setPhonePicker(null); }
      return;
    }

    setError(null);
    setTasks(parsed.tasks);
    setHeaders(parsed.headers);
    setPhonePicker(null);
    if (uploadName !== null) setFileName(uploadName);
    const col = (parsed.columns ?? []).find((c) => c.index === parsed.phoneColIndex);
    setPhoneHeader(col?.header ?? null);
  };

  const handleFile = async (file: File) => {
    setParsing(true);
    setError(null);
    try {
      const text = await file.text();
      setCsvText(text);
      applyParsed(parseBatchCsv(text), file.name);
    } catch {
      setError('No se pudo leer el archivo.');
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // El usuario elige la columna de teléfono (caso ambiguo o cambio manual).
  const choosePhoneColumn = (index: number) => {
    if (!csvText) return;
    applyParsed(parseBatchCsv(csvText, index), null);
  };

  // Reabre el selector mostrando TODAS las columnas (para corregir la detección).
  const openManualPicker = () => {
    if (!columns.length) return;
    setPhonePicker({ candidates: [], showAll: true });
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
                    La columna de teléfono se detecta sola — por el nombre (<code className="bg-slate-100 px-1 rounded">phone_number</code>, <code className="bg-slate-100 px-1 rounded">phone</code>, <code className="bg-slate-100 px-1 rounded">teléfono</code>…) o por el contenido, esté en la posición que esté. Si hay varias que parecen teléfono, te dejamos elegirla.
                    El resto de columnas se envían como variables al agente.
                  </span>
                </span>
              )}
            </button>
          </div>

          {/* Selector de columna de teléfono (ambiguo o manual) */}
          {phonePicker && (
            <div className="border border-amber-300 bg-amber-50 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-2">
                <Phone className="w-4 h-4 text-amber-700 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-amber-900">
                  {phonePicker.showAll
                    ? 'Elegí cuál columna es el número de teléfono a llamar:'
                    : phonePicker.candidates.length >= 2
                      ? 'Encontramos varias columnas que parecen teléfono. ¿Cuál es el número a llamar?'
                      : 'Elegí la columna de teléfono:'}
                </div>
              </div>
              <div className="grid gap-2">
                {(phonePicker.showAll ? columns : phonePicker.candidates).map((col) => {
                  const cand = phonePicker.candidates.find((c) => c.index === col.index);
                  return (
                    <button
                      key={col.index}
                      type="button"
                      onClick={() => choosePhoneColumn(col.index)}
                      className="flex items-center justify-between gap-3 text-left border border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50 rounded-lg px-3 py-2 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-800 truncate">{col.header || `(columna ${col.index + 1})`}</div>
                        <div className="text-xs text-slate-500 truncate">ej: {col.sample || '—'}</div>
                      </div>
                      {cand && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 whitespace-nowrap">
                          {cand.byHeader ? 'por nombre' : 'parece teléfono'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {!phonePicker.showAll && columns.length > phonePicker.candidates.length && (
                <button
                  type="button"
                  onClick={() => setPhonePicker({ ...phonePicker, showAll: true })}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Ninguna de estas — ver todas las columnas
                </button>
              )}
            </div>
          )}

          {/* Columna de teléfono detectada (con opción de cambiarla) */}
          {tasks.length > 0 && phoneHeader && (
            <div className="text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
              <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              Teléfono: <span className="font-medium text-slate-700">{phoneHeader}</span>
              <button type="button" onClick={openManualPicker} className="text-blue-600 hover:underline ml-1">
                Cambiar columna
              </button>
            </div>
          )}

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
