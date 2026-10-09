import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Settings, X, RefreshCw, Save, XCircle, CheckCircle2, AlertCircle } from 'lucide-react';
import { BASE_URL, canAccessSeguimientos, getStoredClientId } from '../../lib/supabase';
import { authedFetch } from '../../services/api/http';

import { saveBatchCallSettings, getRetellConfig, updateRetellConfig } from '../../services/api/seguimientos';
import { COMMON_TIMEZONES } from '../../lib/timezones';
import { splitEvenly } from '../../lib/splitEvenly';
import { formatScheduledDate } from '../../lib/formatScheduled';
import { zonedTimeToUtc } from '../../lib/dateUtils';


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
  seguimiento: boolean;
  retryDelays: number[];
  retryActiveHours: number;
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
  webhook_url?: string;
}

type WebhookCheckState = 'idle' | 'checking' | 'ok' | 'mismatch' | 'error';
interface WebhookCheck {
  state: WebhookCheckState;
  currentUrl?: string;
  expectedUrl?: string;
  fixing?: boolean;
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


function normalizePhone(value: string): NormalizedPhoneResult {
  const compact = (value || '').trim().replace(/[\s\-().]/g, '');
  if (!compact) return { normalized: '', autoFixedMexico: false };
  const withPlus = compact.startsWith('00') ? `+${compact.slice(2)}` : compact.startsWith('+') ? compact : `+${compact}`;

  if (/^\+521\d{10}$/.test(withPlus)) {
    return { normalized: `+52${withPlus.slice(4)}`, autoFixedMexico: true };
  }

  return { normalized: withPlus, autoFixedMexico: false };
}

function isValidE164(value: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(value);
}

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
  const [skippedRows, setSkippedRows] = useState(0);
  const [invalidRows, setInvalidRows] = useState(0);
  const [autoFixedRows, setAutoFixedRows] = useState(0);
  const [retellOptionsByKey, setRetellOptionsByKey] = useState<Record<string, RetellOptionsByKey>>({});
  const [retellLoadingByKey, setRetellLoadingByKey] = useState<Record<string, boolean>>({});
  const [retellErrorByKey, setRetellErrorByKey] = useState<Record<string, string | null>>({});

  const hasSeguimientos = canAccessSeguimientos();

  // — Validación de webhook por batch —
  const [webhookChecks, setWebhookChecks] = useState<Record<string, WebhookCheck>>({});

  // — Estado del modal de configuración de seguimiento —
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configBatchId, setConfigBatchId] = useState<string | null>(null);
  const [configDelays, setConfigDelays] = useState<number[]>([20, 60, 120]);
  const [configActiveHours, setConfigActiveHours] = useState(8);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configMsg, setConfigMsg] = useState('');
  const [configError, setConfigError] = useState('');

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
          <CardTitle>Campañas</CardTitle>
          <CardDescription>
            No hay API keys configuradas para este cliente. Configura al menos una API key para crear campañas.
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
            seguimiento: false,
            retryDelays: [20, 60, 120],
            retryActiveHours: 8,
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

  function updateBatchConfig(batchId: string, key: keyof BatchConfig, value: string | boolean) {
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
      // Rutas AUTENTICADAS: la key nunca viaja — el server la resuelve por índice
      const clientId = getStoredClientId();
      if (!clientId) throw new Error('Sin cliente seleccionado');
      const idx = Math.max(0, apiKeys.indexOf(apiKey));
      const [numbersRes, agentsRes] = await Promise.all([
        authedFetch(`${BASE_URL}/api/telephony/${clientId}/phone-numbers?workspace_index=${idx}`),
        authedFetch(`${BASE_URL}/api/telephony/${clientId}/agents?workspace_index=${idx}`),
      ]);
      const numbersData = await numbersRes.json();
      const agentsData = await agentsRes.json();

      if (!numbersRes.ok || !numbersData.success) {
        throw new Error(numbersData.error || `Error ${numbersRes.status} al listar números`);
      }
      if (!agentsRes.ok || !agentsData.success) {
        throw new Error(typeof agentsData.error === 'string' ? agentsData.error : `Error ${agentsRes.status} al listar agentes`);
      }

      setRetellOptionsByKey((prev) => ({
        ...prev,
        [apiKey]: {
          phoneNumbers: numbersData.data || [],
          agents: agentsData.data || [],
        },
      }));
    } catch (err: any) {
      setRetellErrorByKey((prev) => ({ ...prev, [apiKey]: err?.message || 'Error al cargar números/agentes' }));
    } finally {
      setRetellLoadingByKey((prev) => ({ ...prev, [apiKey]: false }));
    }
  }

  const openConfigModal = useCallback((batchId: string) => {
    const batch = batches.find((item) => item.id === batchId);
    if (!batch) return;
    setConfigBatchId(batchId);
    setConfigMsg('');
    setConfigError('');
    setConfigDelays(batch.config.retryDelays);
    setConfigActiveHours(batch.config.retryActiveHours);
    setShowConfigModal(true);
  }, [batches]);

  const handleSaveConfig = async () => {
    if (!configBatchId) return;
    const validDelays = configDelays.filter((delay) => Number.isFinite(delay) && delay > 0);
    if (validDelays.length === 0 || !Number.isFinite(configActiveHours) || configActiveHours < 1) {
      setConfigError('Indica al menos un reintento y una ventana válida.');
      return;
    }
    setSavingConfig(true);
    setConfigMsg('');
    setConfigError('');
    try {
      setBatches((prev) => prev.map((batch) => (
        batch.id === configBatchId
          ? {
              ...batch,
              config: {
                ...batch.config,
                seguimiento: true,
                retryDelays: validDelays,
                retryActiveHours: configActiveHours,
              },
            }
          : batch
      )));
      setConfigMsg('Configuración guardada y seguimiento activado.');
    } catch {
      setConfigError('Error al guardar la configuración.');
    } finally {
      setSavingConfig(false);
    }
  };

  async function validateAgentWebhook(batchId: string, agentId: string, apiKey: string) {
    const clientId = getStoredClientId();
    if (!clientId || !agentId || !apiKey || !BASE_URL) return;
    const expectedUrl = `${BASE_URL}/api/callback/webhook/${clientId}`;
    setWebhookChecks((prev) => ({ ...prev, [batchId]: { state: 'checking', expectedUrl } }));
    try {
      const idx = Math.max(0, apiKeys.indexOf(apiKey));
      const res = await authedFetch(`${BASE_URL}/api/telephony/${clientId}/agent/${encodeURIComponent(agentId)}?workspace_index=${idx}`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Error al consultar agente');
      const currentUrl: string = data.agent?.webhook_url || '';
      const matches = currentUrl === expectedUrl;
      setWebhookChecks((prev) => ({
        ...prev,
        [batchId]: { state: matches ? 'ok' : 'mismatch', currentUrl, expectedUrl },
      }));
    } catch {
      setWebhookChecks((prev) => ({
        ...prev,
        [batchId]: { state: 'error', expectedUrl },
      }));
    }
  }

  async function fixAgentWebhook(batchId: string, agentId: string, apiKey: string) {
    const check = webhookChecks[batchId];
    const clientId = getStoredClientId();
    if (!check?.expectedUrl || !BASE_URL || !clientId) return;
    setWebhookChecks((prev) => ({ ...prev, [batchId]: { ...prev[batchId], fixing: true } }));
    try {
      const idx = Math.max(0, apiKeys.indexOf(apiKey));
      const res = await authedFetch(`${BASE_URL}/api/telephony/${clientId}/agent/${encodeURIComponent(agentId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ workspace_index: idx, webhook_url: check.expectedUrl }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Error al actualizar agente');
      setWebhookChecks((prev) => ({
        ...prev,
        [batchId]: { state: 'ok', currentUrl: check.expectedUrl, expectedUrl: check.expectedUrl, fixing: false },
      }));
    } catch {
      setWebhookChecks((prev) => ({
        ...prev,
        [batchId]: { ...prev[batchId], fixing: false, state: 'error' },
      }));
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
    if (!target.config.apiKey.trim() || !target.config.fromNumber.trim() || !target.config.agentId.trim()) {
      setBatches((prev) =>
        prev.map((b) => (b.id === batchId ? { ...b, status: 'error', error: 'API Key, From Number y Agent ID son obligatorios.' } : b)),
      );
      return false;
    }
    if (target.contactsCount === 0) {
      setBatches((prev) => prev.map((b) => (b.id === batchId ? { ...b, status: 'error', error: 'Esta campaña no tiene contactos.' } : b)));
      return false;
    }

    setBatches((prev) => prev.map((b) => (b.id === batchId ? { ...b, status: 'sending', error: null, response: null } : b)));
    try {
      const clientId = getStoredClientId();
      if (!clientId) throw new Error('Sin cliente seleccionado');
      // La apiKey ya NO viaja: el server la resuelve por workspace_index
      const body: any = {
        workspace_index: Math.max(0, apiKeys.indexOf(target.config.apiKey.trim())),
        csvContent: target.csvContent,
        from_number: target.config.fromNumber.trim(),
      };
      if (target.config.agentId.trim()) body.agent_id = target.config.agentId.trim();
      if (target.config.batchName.trim()) body.batch_name = target.config.batchName.trim();
      if (target.config.startTime.trim()) {
        const raw = target.config.startTime.trim();
        const tz = target.config.timezone.trim() || DEFAULT_TIMEZONE;
        // El input es <input type="datetime-local"> ('YYYY-MM-DDTHH:mm', sin zona).
        // Esos dígitos son la hora de PARED en la zona ELEGIDA (tz), NO en la del
        // navegador. zonedTimeToUtc los convierte al instante UTC real, así
        // "18:25 + Europe/Madrid" se guarda como 16:25Z sin importar dónde esté el
        // navegador (antes se usaba new Date(raw), que interpretaba en la zona del
        // navegador → desfase por el offset, ej. +5h desde Argentina).
        const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
        if (m) {
          body.start_time = zonedTimeToUtc(+m[1], +m[2], +m[3], +m[4], +m[5], m[6] ? +m[6] : 0, tz).toISOString();
        } else {
          const parsed = new Date(raw);
          body.start_time = Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString();
        }
      }
      if (target.config.timezone.trim()) body.timezone = target.config.timezone.trim();
      if (target.config.reservedConcurrency.trim()) body.reserved_concurrency = target.config.reservedConcurrency.trim();
      body.seguimiento = target.config.seguimiento;
      body.retry_delays = target.config.retryDelays;
      body.retry_active_hours = target.config.retryActiveHours;

      const response = await authedFetch(`${BASE_URL}/api/telephony/${clientId}/batch-call-csv`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const data: BatchResponse = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || `Error ${response.status}`);
      setBatches((prev) => prev.map((b) => (b.id === batchId ? { ...b, status: 'success', response: data, error: null } : b)));
      return true;
    } catch (err: any) {
      setBatches((prev) =>
        prev.map((b) => (b.id === batchId ? { ...b, status: 'error', error: err?.message || 'Error al crear la campaña' } : b)),
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
    setMessage('Enviando campañas una por una...');
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

  // Validar webhook del agente cuando seguimiento está activo y hay agente seleccionado
  const seguimientoAgentKey = batches
    .map((b) => `${b.id}|${b.config.seguimiento}|${b.config.agentId}|${b.config.apiKey}`)
    .join('~');

  useEffect(() => {
    if (!hasSeguimientos) return;
    batches.forEach((batch) => {
      if (batch.config.seguimiento && batch.config.agentId.trim() && batch.config.apiKey.trim()) {
        void validateAgentWebhook(batch.id, batch.config.agentId.trim(), batch.config.apiKey.trim());
      } else if (!batch.config.seguimiento) {
        setWebhookChecks((prev) => {
          if (!prev[batch.id]) return prev;
          const { [batch.id]: _, ...next } = prev;
          return next;
        });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seguimientoAgentKey]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>1) Archivo CSV</CardTitle>
          <CardDescription>Sube el CSV de contactos que quieres repartir en varias campañas.</CardDescription>
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
                    <span>Campaña {batch.partNumber}</span>
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
                      <label className="block text-sm font-medium text-gray-700">Agent ID</label>
                      {(retellOptionsByKey[batch.config.apiKey.trim()]?.agents || []).length > 0 ? (
                        <select value={batch.config.agentId} onChange={(e) => updateBatchConfig(batch.id, 'agentId', e.target.value)} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" required>
                          <option value="" disabled>Sin override de agente</option>
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
                      <label className="block text-sm font-medium text-gray-700">Nombre de la campaña (opcional)</label>
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
                        Si lo dejas vacío, la campaña se enviará inmediatamente al pulsar <span className="font-semibold">Enviar</span>.
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-gray-700">Zona horaria</label>
                      <select
                        value={batch.config.timezone}
                        onChange={(e) => updateBatchConfig(batch.id, 'timezone', e.target.value)}
                        className="w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 pr-8 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#05163b]/30 focus:border-[#05163b]"
                      >
                        {COMMON_TIMEZONES.map((tz) => (
                          <option key={tz} value={tz}>
                            {tz}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-gray-700">Reserved concurrency (opcional)</label>
                      <input type="number" min={0} value={batch.config.reservedConcurrency} onChange={(e) => updateBatchConfig(batch.id, 'reservedConcurrency', e.target.value)} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" />
                    </div>
                    {hasSeguimientos && (
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-gray-700">Seguimiento automático</label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateBatchConfig(batch.id, 'seguimiento', !batch.config.seguimiento)}
                            className={`flex-1 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                              batch.config.seguimiento
                                ? 'bg-indigo-50 border-indigo-400 text-indigo-700 hover:bg-indigo-100'
                                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {batch.config.seguimiento ? 'Activado' : 'Desactivado'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void openConfigModal(batch.id)}
                            title="Configurar reintentos"
                            className="p-2 rounded-md border border-gray-300 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-xs text-gray-400">
                          {batch.config.seguimiento
                            ? 'Los contactos que no contesten serán reintentados automáticamente'
                            : 'Esta campaña no generará reintentos automáticos'}
                        </p>
                        {batch.config.seguimiento && batch.config.agentId && (() => {
                          const check = webhookChecks[batch.id];
                          if (!check || check.state === 'idle') return null;
                          if (check.state === 'checking') return (
                            <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              Verificando webhook del agente…
                            </div>
                          );
                          if (check.state === 'ok') return (
                            <div className="flex items-center gap-1.5 text-xs text-green-700 mt-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Webhook configurado correctamente
                            </div>
                          );
                          if (check.state === 'mismatch') return (
                            <div className="rounded-md border border-orange-200 bg-orange-50 p-3 mt-1 space-y-2">
                              <div className="flex items-center gap-1.5 text-xs text-orange-700 font-medium">
                                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                El webhook del agente no coincide con el de seguimientos
                              </div>
                              <div className="space-y-1 text-xs text-orange-600">
                                <p>Actual: <code className="bg-orange-100 px-1 rounded break-all">{check.currentUrl || '(vacío)'}</code></p>
                                <p>Requerido: <code className="bg-orange-100 px-1 rounded break-all">{check.expectedUrl}</code></p>
                              </div>
                              <button
                                type="button"
                                onClick={() => void fixAgentWebhook(batch.id, batch.config.agentId, batch.config.apiKey)}
                                disabled={check.fixing}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 transition-colors"
                              >
                                {check.fixing && <RefreshCw className="w-3 h-3 animate-spin" />}
                                {check.fixing ? 'Corrigiendo…' : 'Corregir automáticamente'}
                              </button>
                            </div>
                          );
                          if (check.state === 'error') return (
                            <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-1">
                              <AlertCircle className="w-3 h-3" />
                              No se pudo verificar el webhook del agente
                            </div>
                          );
                          return null;
                        })()}
                      </div>
                    )}
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
                      {batch.status === 'sending' ? 'Enviando…' : 'Enviar campaña'}
                    </Button>
                    <span className="text-xs text-gray-500">Si hay varias campañas, puedes enviarlas una por una desde aquí.</span>
                  </div>

                  {batch.error && <p className="text-sm text-red-600">{batch.error}</p>}
                  {batch.response && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 space-y-1.5">
                      <p className="font-semibold">Campaña cargada correctamente.</p>
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

      {/* Modal de configuración de seguimiento */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Configuración de reintentos</h2>
                {configBatchId && (() => {
                  const b = batches.find((x) => x.id === configBatchId);
                  return b ? (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Campaña: <span className="font-medium text-gray-600">{b.config.batchName || `Batch ${b.partNumber}`}</span>
                    </p>
                  ) : null;
                })()}
              </div>
              <button onClick={() => setShowConfigModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingConfig ? (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <RefreshCw className="w-4 h-4 animate-spin" /> Cargando…
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ventana de rellamadas (horas)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      max={24}
                      value={configActiveHours}
                      onChange={(e) => setConfigActiveHours(Number(e.target.value))}
                      className="w-24 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-500">horas desde la llamada original</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Pasadas estas horas, los reintentos se cancelan.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tiempos entre reintentos (minutos)
                  </label>
                  <p className="text-xs text-gray-400 mb-2">Cada fila es un intento. El largo define cuántos reintentos se hacen.</p>
                  <div className="space-y-2">
                    {configDelays.map((min, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 w-28 shrink-0">
                          {i === 0 ? 'Tras llamada original' : `Tras intento ${i}`}
                        </span>
                        <input
                          type="number"
                          min={1}
                          value={min}
                          onChange={(e) => {
                            const next = [...configDelays];
                            next[i] = Number(e.target.value);
                            setConfigDelays(next);
                          }}
                          className="w-20 border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-xs text-gray-400">min</span>
                        <span className="text-xs text-gray-300">({min >= 60 ? `${(min / 60).toFixed(1)}h` : `${min}min`})</span>
                        <button
                          onClick={() => setConfigDelays(configDelays.filter((_, j) => j !== i))}
                          className="text-red-400 hover:text-red-600"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setConfigDelays([...configDelays, 60])}
                    className="mt-3 text-sm text-blue-600 hover:text-blue-800"
                  >
                    + Agregar intento
                  </button>
                  {configDelays.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      Total: <strong>{configDelays.length}</strong> reintentos configurados
                    </p>
                  )}
                </div>

                {configMsg && (
                  <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                    <CheckCircle2 className="w-4 h-4" />{configMsg}
                  </div>
                )}
                {configError && (
                  <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                    <AlertCircle className="w-4 h-4" />{configError}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => setShowConfigModal(false)}
                    className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cerrar
                  </button>
                  <button
                    onClick={handleSaveConfig}
                    disabled={savingConfig}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingConfig ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {savingConfig ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
