import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { BASE_URL } from '../../lib/supabase';

type BatchStatus = 'pending' | 'sending' | 'success' | 'error';

interface BatchResponse {
  success: boolean;
  batch_call_id?: string;
  total_contacts?: number;
  error?: string;
  data?: any;
}

interface BatchConfig {
  apiKey: string;
  fromNumber: string;
  agentId: string;
  batchName: string;
  startTime: string;
  timezone: string;
  reservedConcurrency: string;
}

interface BatchDraft {
  id: string;
  partNumber: number;
  contactsCount: number;
  csvContent: string;
  status: BatchStatus;
  error: string | null;
  response: BatchResponse | null;
  config: BatchConfig;
}

interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

interface RetellPhoneNumber {
  phone_number?: string;
  nickname?: string;
}

interface RetellAgent {
  agent_id?: string;
  id?: string;
  agent_name?: string;
  name?: string;
  display_name?: string;
}

interface RetellOptionsByKey {
  phoneNumbers: RetellPhoneNumber[];
  agents: RetellAgent[];
}

interface BatchCallingTabProps {
  apiKeys: string[];
  workspaceNameByApiKey: Record<string, string>;
}

interface NormalizedPhoneResult {
  normalized: string;
  autoFixedMexico: boolean;
}

function maskApiKey(key: string): string {
  if (key.length <= 10) return key;
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

function parseCsvText(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '"') {
      if (inQuotes && content[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && content[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      rows.push(row);
      row = [];
      continue;
    }
    cell += char;
  }

  row.push(cell);
  if (row.some((v) => v.trim().length > 0)) rows.push(row);
  return rows;
}

function parseCsvContent(content: string): ParsedCsv {
  const matrix = parseCsvText(content);
  if (matrix.length === 0) return { headers: [], rows: [] };

  const rawHeaders = matrix[0].map((h, index) => {
    const cleaned = (h || '').trim();
    return index === 0 ? cleaned.replace(/^\uFEFF/, '') : cleaned;
  });
  const headers = rawHeaders.map((h, i) => (h ? h : `columna_${i + 1}`));
  const rows = matrix
    .slice(1)
    .filter((line) => line.some((v) => (v || '').trim().length > 0))
    .map((line) => {
      const record: Record<string, string> = {};
      headers.forEach((header, index) => {
        record[header] = (line[index] || '').trim();
      });
      return record;
    });
  return { headers, rows };
}

function escapeCsvValue(value: string): string {
  const normalized = String(value ?? '');
  if (/[",\r\n]/.test(normalized)) return `"${normalized.replace(/"/g, '""')}"`;
  return normalized;
}

function rowsToCsv(headers: string[], rows: Record<string, string>[]): string {
  const headerLine = headers.map(escapeCsvValue).join(',');
  const lines = rows.map((row) => headers.map((h) => escapeCsvValue(row[h] || '')).join(','));
  return [headerLine, ...lines].join('\n');
}

function splitEvenly<T>(items: T[], parts: number): T[][] {
  if (parts <= 1) return [items];
  const result: T[][] = [];
  const base = Math.floor(items.length / parts);
  let remainder = items.length % parts;
  let start = 0;
  for (let i = 0; i < parts; i++) {
    const size = base + (remainder > 0 ? 1 : 0);
    result.push(items.slice(start, start + size));
    start += size;
    if (remainder > 0) remainder--;
  }
  return result;
}

function normalizePhone(value: string): NormalizedPhoneResult {
  const compact = (value || '').trim().replace(/[\s\-().]/g, '');
  if (!compact) return { normalized: '', autoFixedMexico: false };
  const withPlus = compact.startsWith('00') ? `+${compact.slice(2)}` : compact.startsWith('+') ? compact : `+${compact}`;

  // Compatibilidad: algunos CSV traen México como +521XXXXXXXXXX; en E.164 actual suele ser +52XXXXXXXXXX.
  if (/^\+521\d{10}$/.test(withPlus)) {
    return { normalized: `+52${withPlus.slice(4)}`, autoFixedMexico: true };
  }

  return { normalized: withPlus, autoFixedMexico: false };
}

function isValidE164(value: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(value);
}

function formatScheduledDate(value: unknown, timezone?: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  const raw = Number(value);
  if (!Number.isFinite(raw)) return null;
  const ms = raw > 1e12 ? raw : raw * 1000;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('es-ES', {
    timeZone: timezone || undefined,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const COMMON_TIMEZONES = [
  'Europe/Madrid',
  'Europe/London',
  'Europe/Paris',
  'America/Mexico_City',
  'America/Bogota',
  'America/Lima',
  'America/Santiago',
  'America/Argentina/Buenos_Aires',
  'America/Montevideo',
  'America/Sao_Paulo',
  'America/Los_Angeles',
  'America/New_York',
  'America/Chicago',
  'America/Phoenix',
  'UTC',
];

const DEFAULT_TIMEZONE = 'Europe/Madrid';

export function BatchCallingTab({ apiKeys, workspaceNameByApiKey }: BatchCallingTabProps) {
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [sourceRows, setSourceRows] = useState<Record<string, string>[]>([]);
  const [phoneColumn, setPhoneColumn] = useState('');
  const [partsCount, setPartsCount] = useState(1);
  const [batches, setBatches] = useState<BatchDraft[]>([]);
  const [sendingAll, setSendingAll] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'ok' | 'error' | null>(null);
  const [skippedRows, setSkippedRows] = useState(0); // sin teléfono
  const [invalidRows, setInvalidRows] = useState(0); // teléfono inválido
  const [autoFixedRows, setAutoFixedRows] = useState(0); // corregidos automáticamente (+521 -> +52)
  const [retellOptionsByKey, setRetellOptionsByKey] = useState<Record<string, RetellOptionsByKey>>({});
  const [retellLoadingByKey, setRetellLoadingByKey] = useState<Record<string, boolean>>({});
  const [retellErrorByKey, setRetellErrorByKey] = useState<Record<string, string | null>>({});

  const availableApiKeys = useMemo(() => Array.from(new Set(apiKeys.filter(Boolean))), [apiKeys]);
  const totalContacts = useMemo(() => batches.reduce((acc, b) => acc + b.contactsCount, 0), [batches]);
  const successCount = useMemo(() => batches.filter((b) => b.status === 'success').length, [batches]);
  const errorCount = useMemo(() => batches.filter((b) => b.status === 'error').length, [batches]);
  const sentContacts = useMemo(
    () =>
      batches
        .filter((b) => b.status === 'success')
        .reduce((acc, b) => acc + (typeof b.response?.total_contacts === 'number' ? b.response.total_contacts : b.contactsCount), 0),
    [batches],
  );

  if (availableApiKeys.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Batch Calling</CardTitle>
          <CardDescription>
            No hay API keys configuradas para este cliente. Configura al menos una API key para usar Batch Calling.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  useEffect(() => {
    if (!phoneColumn || sourceRows.length === 0 || headers.length === 0) {
      setBatches([]);
      setSkippedRows(0);
      setInvalidRows(0);
      setAutoFixedRows(0);
      return;
    }

    let missing = 0;
    let invalid = 0;
    let autoFixed = 0;
    const mappedRows = sourceRows
      .map((row) => {
        const phoneInfo = normalizePhone(row[phoneColumn] || '');
        if (!phoneInfo.normalized) {
          missing++;
          return null;
        }
        if (!isValidE164(phoneInfo.normalized)) {
          invalid++;
          return null;
        }
        if (phoneInfo.autoFixedMexico) autoFixed++;
        const mapped: Record<string, string> = { phone_number: phoneInfo.normalized };
        headers.filter((h) => h !== phoneColumn).forEach((h) => (mapped[h] = row[h] || ''));
        return mapped;
      })
      .filter((row): row is Record<string, string> => row !== null);

    setSkippedRows(missing);
    setInvalidRows(invalid);
    setAutoFixedRows(autoFixed);
    if (mappedRows.length === 0) {
      setBatches([]);
      return;
    }
    const mappedHeaders = ['phone_number', ...headers.filter((h) => h !== phoneColumn)];
    const previousByPart = new Map<number, BatchDraft>(batches.map((b) => [b.partNumber, b]));
    const chunks = splitEvenly(mappedRows, Math.max(1, partsCount || 1));
    setBatches(
      chunks.map((chunk, index) => {
        const partNumber = index + 1;
        const previous = previousByPart.get(partNumber);
        return {
          id: `part-${partNumber}`,
          partNumber,
          contactsCount: chunk.length,
          csvContent: rowsToCsv(mappedHeaders, chunk),
          status: 'pending',
          error: null,
          response: null,
          config: previous?.config || {
            apiKey: availableApiKeys[0] || '',
            fromNumber: '',
            agentId: '',
            batchName: `Batch ${partNumber}`,
            startTime: '',
            timezone: DEFAULT_TIMEZONE,
            reservedConcurrency: '',
          },
        };
      }),
    );
  }, [phoneColumn, partsCount, sourceRows, headers, availableApiKeys]);

  useEffect(() => {
    if (availableApiKeys.length === 0) return;
    setBatches((prev) =>
      prev.map((batch) =>
        batch.config.apiKey.trim() && batch.config.timezone.trim()
          ? batch
          : {
              ...batch,
              config: {
                ...batch.config,
                apiKey: batch.config.apiKey.trim() ? batch.config.apiKey : availableApiKeys[0],
                timezone: batch.config.timezone.trim() || DEFAULT_TIMEZONE,
              },
            },
      ),
    );
  }, [availableApiKeys]);

  function updateBatchConfig(batchId: string, key: keyof BatchConfig, value: string) {
    setBatches((prev) =>
      prev.map((batch) => (batch.id === batchId ? { ...batch, config: { ...batch.config, [key]: value } } : batch)),
    );
  }

  function getAgentIdentifier(agent: RetellAgent): string {
    return (agent.agent_id || agent.id || '').trim();
  }

  function getAgentLabel(agent: RetellAgent): string {
    const id = getAgentIdentifier(agent);
    const name = (agent.agent_name || agent.display_name || agent.name || '').trim();
    return name ? `${name} (${id})` : id;
  }

  async function loadRetellOptionsForApiKey(rawApiKey: string) {
    const apiKey = rawApiKey.trim();
    if (!apiKey || !BASE_URL || retellOptionsByKey[apiKey] || retellLoadingByKey[apiKey]) return;
    setRetellLoadingByKey((prev) => ({ ...prev, [apiKey]: true }));
    setRetellErrorByKey((prev) => ({ ...prev, [apiKey]: null }));

    try {
      const [numbersRes, agentsRes] = await Promise.all([
        fetch(`${BASE_URL}/api/microtools/retell/list?apiKey=${encodeURIComponent(apiKey)}`),
        fetch(`${BASE_URL}/api/microtools/retell/list-agents?apiKeyOrigen=${encodeURIComponent(apiKey)}`),
      ]);
      const numbersData = await numbersRes.json();
      const agentsData = await agentsRes.json();

      if (!numbersRes.ok || !numbersData.success) {
        throw new Error(numbersData.error || `Error ${numbersRes.status} al listar números`);
      }
      if (!agentsRes.ok || !agentsData.ok) {
        throw new Error(typeof agentsData.error === 'string' ? agentsData.error : `Error ${agentsRes.status} al listar agentes`);
      }

      setRetellOptionsByKey((prev) => ({
        ...prev,
        [apiKey]: {
          phoneNumbers: numbersData.phoneNumbers || [],
          agents: agentsData.agents || [],
        },
      }));
    } catch (err: any) {
      setRetellErrorByKey((prev) => ({ ...prev, [apiKey]: err?.message || 'Error al cargar números/agentes' }));
    } finally {
      setRetellLoadingByKey((prev) => ({ ...prev, [apiKey]: false }));
    }
  }

  async function handleFileUpload(file: File | null) {
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) {
      setMessage('Solo se permiten archivos .csv');
      setMessageType('error');
      return;
    }
    const parsed = parseCsvContent(await file.text());
    if (parsed.headers.length === 0 || parsed.rows.length === 0) {
      setMessage('El CSV no contiene datos válidos para procesar.');
      setMessageType('error');
      setHeaders([]);
      setSourceRows([]);
      setPhoneColumn('');
      setBatches([]);
      return;
    }
    setFileName(file.name);
    setHeaders(parsed.headers);
    setSourceRows(parsed.rows);
    setPhoneColumn(parsed.headers[0] || '');
    setPartsCount(1);
    setInvalidRows(0);
    setAutoFixedRows(0);
    setMessage(`Archivo cargado: ${file.name}. Elige la columna de teléfono y la cantidad de partes.`);
    setMessageType('ok');
  }

  async function sendBatch(batchId: string): Promise<boolean> {
    const target = batches.find((b) => b.id === batchId);
    if (!target || !BASE_URL) return false;
    if (!target.config.apiKey.trim() || !target.config.fromNumber.trim()) {
      setBatches((prev) =>
        prev.map((b) => (b.id === batchId ? { ...b, status: 'error', error: 'API Key y From Number son obligatorios.' } : b)),
      );
      return false;
    }
    if (target.contactsCount === 0) {
      setBatches((prev) => prev.map((b) => (b.id === batchId ? { ...b, status: 'error', error: 'Este batch no tiene contactos.' } : b)));
      return false;
    }

    setBatches((prev) => prev.map((b) => (b.id === batchId ? { ...b, status: 'sending', error: null, response: null } : b)));
    try {
      const body: any = {
        apiKey: target.config.apiKey.trim(),
        csvContent: target.csvContent,
        from_number: target.config.fromNumber.trim(),
      };
      if (target.config.agentId.trim()) body.agent_id = target.config.agentId.trim();
      if (target.config.batchName.trim()) body.batch_name = target.config.batchName.trim();
      if (target.config.startTime.trim()) {
        const parsed = new Date(target.config.startTime);
        body.start_time = Number.isNaN(parsed.getTime()) ? target.config.startTime.trim() : parsed.toISOString();
      }
      if (target.config.timezone.trim()) body.timezone = target.config.timezone.trim();
      if (target.config.reservedConcurrency.trim()) body.reserved_concurrency = target.config.reservedConcurrency.trim();

      const response = await fetch(`${BASE_URL}/api/microtools/retell/create-batch-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data: BatchResponse = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || `Error ${response.status}`);
      setBatches((prev) => prev.map((b) => (b.id === batchId ? { ...b, status: 'success', response: data, error: null } : b)));
      return true;
    } catch (err: any) {
      setBatches((prev) =>
        prev.map((b) => (b.id === batchId ? { ...b, status: 'error', error: err?.message || 'Error al crear batch call' } : b)),
      );
      return false;
    }
  }

  async function handleSendAllSequential() {
    if (batches.length === 0) {
      setMessage('Primero debes cargar y dividir un CSV.');
      setMessageType('error');
      return;
    }
    setSendingAll(true);
    setMessage('Enviando batches uno por uno...');
    setMessageType(null);
    let ok = 0;
    let fail = 0;
    let sentContactsInRun = 0;
    for (const batch of batches) {
      const sent = await sendBatch(batch.id);
      if (sent) {
        ok++;
        sentContactsInRun += batch.contactsCount;
      } else fail++;
    }
    setSendingAll(false);
    const omitted = skippedRows + invalidRows;
    setMessage(
      `Proceso finalizado. Batches OK: ${ok}, fallidos: ${fail}. Contactos enviados: ${sentContactsInRun}/${sourceRows.length}. Omitidos: ${omitted}.`,
    );
    setMessageType(fail > 0 ? 'error' : 'ok');
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      Array.from(new Set(batches.map((b) => b.config.apiKey.trim()).filter(Boolean))).forEach((key) => {
        void loadRetellOptionsForApiKey(key);
      });
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [batches]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>1) Archivo CSV</CardTitle>
          <CardDescription>Sube el CSV de contactos que quieres repartir en varios batch calls.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="border border-dashed border-gray-300 rounded-xl px-6 py-10 text-center bg-white hover:border-[#05163b] transition-colors cursor-pointer"
            onDrop={(e) => {
              e.preventDefault();
              void handleFileUpload(e.dataTransfer.files?.[0] || null);
            }}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => (document.getElementById('batch-csv-file-input') as HTMLInputElement | null)?.click()}
          >
            <input
              id="batch-csv-file-input"
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => void handleFileUpload(e.target.files?.[0] || null)}
            />
            <p className="text-sm text-gray-600">
              Arrastra aquí un CSV o <span className="font-semibold text-[#05163b]">haz clic para elegir</span>
            </p>
            {fileName && <p className="mt-2 text-sm font-medium text-[#05163b]">Archivo seleccionado: {fileName}</p>}
          </div>
          {fileName && <p className="text-sm text-gray-700">Filas detectadas: {sourceRows.length}</p>}
        </CardContent>
      </Card>

      {headers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>2) Mapeo y división</CardTitle>
            <CardDescription>Selecciona la columna de teléfono y cuántas partes quieres generar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">Columna de teléfono *</label>
                <select value={phoneColumn} onChange={(e) => setPhoneColumn(e.target.value)} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
                  {headers.map((header) => <option key={header} value={header}>{header}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">Cantidad de partes *</label>
                <input type="number" min={1} value={partsCount} onChange={(e) => setPartsCount(Math.max(1, parseInt(e.target.value || '1', 10)))} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" />
              </div>
            </div>
            <div className="text-sm text-gray-600 space-y-1">
              <p>Contactos listos para enviar: <span className="font-semibold text-gray-900">{totalContacts}</span></p>
              {skippedRows > 0 && <p className="text-amber-700">Se omitieron {skippedRows} fila(s) sin teléfono.</p>}
              {invalidRows > 0 && <p className="text-rose-700">Se omitieron {invalidRows} fila(s) con teléfono inválido para E.164.</p>}
              {autoFixedRows > 0 && <p className="text-emerald-700">Se corrigieron automáticamente {autoFixedRows} número(s) con prefijo +521 a +52.</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {batches.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-gray-700">
              {batches.length} batch(es) generados · OK: {successCount} · Error: {errorCount} · Enviados: {sentContacts}/{sourceRows.length}
            </div>
            <Button type="button" onClick={handleSendAllSequential} disabled={sendingAll}>
              {sendingAll ? 'Enviando…' : 'Enviar todos'}
            </Button>
          </div>
          <div className="space-y-4">
            {batches.map((batch) => (
              <Card key={batch.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2">
                    <span>Batch {batch.partNumber}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${batch.status === 'success' ? 'bg-green-50 text-green-700' : batch.status === 'error' ? 'bg-red-50 text-red-700' : batch.status === 'sending' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{batch.status}</span>
                  </CardTitle>
                  <CardDescription>Contactos asignados automáticamente: <strong>{batch.contactsCount}</strong></CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-gray-700">API Key *</label>
                      <select value={batch.config.apiKey} onChange={(e) => { updateBatchConfig(batch.id, 'apiKey', e.target.value); void loadRetellOptionsForApiKey(e.target.value); }} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
                        <option value="">Selecciona una API Key</option>
                        {availableApiKeys.map((key, idx) => <option key={key} value={key}>{workspaceNameByApiKey[key] || `Workspace ${idx + 1}`} - {maskApiKey(key)}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-gray-700">From Number *</label>
                      {(retellOptionsByKey[batch.config.apiKey.trim()]?.phoneNumbers || []).length > 0 ? (
                        <select value={batch.config.fromNumber} onChange={(e) => updateBatchConfig(batch.id, 'fromNumber', e.target.value)} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
                          <option value="">Selecciona un número</option>
                          {(retellOptionsByKey[batch.config.apiKey.trim()]?.phoneNumbers || []).filter((item) => item.phone_number).map((item) => {
                            const phone = item.phone_number as string;
                            const nickname = (item.nickname || '').trim();
                            return <option key={phone} value={phone}>{nickname ? `${nickname} - ${phone}` : phone}</option>;
                          })}
                        </select>
                      ) : (
                        <input type="text" value={batch.config.fromNumber} onChange={(e) => updateBatchConfig(batch.id, 'fromNumber', e.target.value)} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" placeholder="+573001234567" />
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-gray-700">Agent ID (opcional)</label>
                      {(retellOptionsByKey[batch.config.apiKey.trim()]?.agents || []).length > 0 ? (
                        <select value={batch.config.agentId} onChange={(e) => updateBatchConfig(batch.id, 'agentId', e.target.value)} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
                          <option value="">Sin override de agente</option>
                          {(retellOptionsByKey[batch.config.apiKey.trim()]?.agents || []).filter((agent) => getAgentIdentifier(agent)).map((agent) => {
                            const id = getAgentIdentifier(agent);
                            return <option key={id} value={id}>{getAgentLabel(agent)}</option>;
                          })}
                        </select>
                      ) : (
                        <input type="text" value={batch.config.agentId} onChange={(e) => updateBatchConfig(batch.id, 'agentId', e.target.value)} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" placeholder="agent_..." />
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-gray-700">Nombre del batch (opcional)</label>
                      <input
                        type="text"
                        value={batch.config.batchName}
                        onChange={(e) => updateBatchConfig(batch.id, 'batchName', e.target.value)}
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-gray-700">
                        Programar envío (opcional)
                      </label>
                      <input
                        type="datetime-local"
                        value={batch.config.startTime}
                        onChange={(e) => updateBatchConfig(batch.id, 'startTime', e.target.value)}
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                      />
                      <p className="text-xs text-gray-500">
                        Si lo dejas vacío, el batch se enviará inmediatamente al pulsar <span className="font-semibold">Enviar</span>.
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-gray-700">Zona horaria</label>
                      <select
                        value={batch.config.timezone}
                        onChange={(e) => updateBatchConfig(batch.id, 'timezone', e.target.value)}
                        className="w-full appearance-none rounded-md border border-gray-300 bg-white bg-[linear-gradient(45deg,transparent_50%,#64748b_50%),linear-gradient(135deg,#64748b_50%,transparent_50%)] bg-[position:calc(100%-18px)_calc(1em+1px),calc(100%-13px)_calc(1em+1px)] bg-[size:5px_5px,5px_5px] bg-no-repeat px-3 py-2 pr-8 text-sm text-gray-900 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[#05163b]/30 focus:border-[#05163b]"
                      >
                        {COMMON_TIMEZONES.map((tz) => (
                          <option key={tz} value={tz}>
                            {tz}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5"><label className="block text-sm font-medium text-gray-700">Reserved concurrency (opcional)</label><input type="number" min={0} value={batch.config.reservedConcurrency} onChange={(e) => updateBatchConfig(batch.id, 'reservedConcurrency', e.target.value)} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" /></div>
                  </div>

                  {batch.config.apiKey.trim() && (
                    <div className="text-xs">
                      {retellLoadingByKey[batch.config.apiKey.trim()] ? (
                        <p className="text-gray-500">Cargando números y agentes desde Retell...</p>
                      ) : retellErrorByKey[batch.config.apiKey.trim()] ? (
                        <p className="text-amber-700">No se pudieron cargar opciones automáticas: {retellErrorByKey[batch.config.apiKey.trim()]}</p>
                      ) : null}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="button" disabled={sendingAll || batch.status === 'sending' || batch.contactsCount === 0} onClick={() => void sendBatch(batch.id)}>
                      {batch.status === 'sending' ? 'Enviando…' : 'Enviar batch'}
                    </Button>
                    <span className="text-xs text-gray-500">Si hay varios batches, puedes enviarlos uno por uno desde aquí.</span>
                  </div>

                  {batch.error && <p className="text-sm text-red-600">{batch.error}</p>}
                  {batch.response && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 space-y-1.5">
                      <p className="font-semibold">Batch cargado correctamente.</p>
                      <p>
                        Se cargaron <strong>{batch.response.total_contacts ?? batch.contactsCount}</strong> contactos.
                      </p>
                      {batch.response.data?.name && (
                        <p>
                          Campaña: <strong>{batch.response.data.name}</strong>
                        </p>
                      )}
                      {batch.response.data?.from_number && (
                        <p>
                          Número de salida: <strong>{batch.response.data.from_number}</strong>
                        </p>
                      )}
                      <p>
                        Estado inicial:{' '}
                        <strong>{batch.response.data?.status === 'planned' ? 'Programada' : batch.response.data?.status || 'Creada'}</strong>
                      </p>
                      {formatScheduledDate(batch.response.data?.scheduled_timestamp, batch.response.data?.timezone) ? (
                        <p>
                          Fecha y hora de envío:{' '}
                          <strong>
                            {formatScheduledDate(batch.response.data?.scheduled_timestamp, batch.response.data?.timezone)}
                          </strong>
                          {batch.response.data?.timezone ? ` (${batch.response.data.timezone})` : ''}
                        </p>
                      ) : (
                        <p>Se enviará tan pronto como Retell procese la campaña.</p>
                      )}
                      {batch.response.batch_call_id && (
                        <p className="text-xs text-emerald-800/80 pt-1">
                          Referencia: {batch.response.batch_call_id}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {message && <p className={`text-sm ${messageType === 'ok' ? 'text-green-600' : messageType === 'error' ? 'text-red-600' : 'text-gray-600'}`}>{message}</p>}
    </div>
  );
}

