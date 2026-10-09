import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileUp, Loader2, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { parseBatchCsv, ParsedBatchCsv } from '../../lib/parseBatchCsv';
import { toCallshiftContacts } from '../../lib/callshiftContacts';
import { COMMON_TIMEZONES } from '../../lib/timezones';
import { zonedTimeToUtc } from '../../lib/dateUtils';
import {
  CallshiftAgent,
  CallshiftApiError,
  CallshiftPhone,
  LaunchResult,
  SkippedContact,
  launchCallshiftCampaign,
} from '../../services/api/callshift';

// Nueva campaña de CallShift desde CSV. El CSV se parsea en el navegador para que el
// usuario vea qué se va a llamar antes de lanzar; el backend vuelve a validar todo
// (E.164, lista "no llamar", duplicados) y devuelve los descartados con su motivo.

const MAX_CONTACTS = 10000;

const SKIP_REASON: Record<SkippedContact['reason'], string> = {
  telefono_invalido: 'teléfono inválido',
  no_llamar: 'en la lista "no llamar"',
  duplicado: 'duplicado',
  metadata_no_es_objeto: 'datos extra inválidos',
};

type Mode = 'now' | 'schedule' | 'draft';

// "2026-10-10T18:25" (datetime-local) → instante UTC, interpretado en la zona elegida
// y no en la del navegador.
function localToUtcMs(local: string, timezone: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!m) return null;
  return zonedTimeToUtc(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5]), 0, timezone).getTime();
}

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

export function CallshiftNewCampaignModal({
  clientId,
  agents,
  phones,
  onClose,
  onLaunched,
}: {
  clientId: string;
  agents: CallshiftAgent[];
  phones: CallshiftPhone[];
  onClose: () => void;
  onLaunched: () => void;
}) {
  const detectedTz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const timezones = useMemo(() => [...new Set([detectedTz, ...COMMON_TIMEZONES])], [detectedTz]);

  const [name, setName] = useState('');
  const [agentId, setAgentId] = useState(agents[0]?.agent_id ?? '');
  const [phoneId, setPhoneId] = useState(
    phones.find((p) => p.agent_id === agents[0]?.agent_id)?.phone_id ?? phones[0]?.phone_id ?? '',
  );
  const [fileName, setFileName] = useState('');
  const [csvText, setCsvText] = useState('');
  const [phoneCol, setPhoneCol] = useState<number | undefined>(undefined);
  const [prefix, setPrefix] = useState('');
  const [mode, setMode] = useState<Mode>('now');
  const [scheduledLocal, setScheduledLocal] = useState('');
  const [timezone, setTimezone] = useState(detectedTz);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<CallshiftApiError | Error | null>(null);
  const [result, setResult] = useState<LaunchResult | null>(null);

  const parsed: ParsedBatchCsv | null = useMemo(
    () => (csvText ? parseBatchCsv(csvText, phoneCol) : null),
    [csvText, phoneCol],
  );
  const converted = useMemo(
    () => (parsed && parsed.tasks.length ? toCallshiftContacts(parsed.tasks, prefix) : null),
    [parsed, prefix],
  );
  const withoutPrefix = converted?.rejected.filter((r) => r.problem === 'sin_prefijo').length ?? 0;
  const invalid = converted?.rejected.filter((r) => r.problem === 'invalido').length ?? 0;

  const onAgentChange = (id: string) => {
    setAgentId(id);
    // Por defecto, un número asociado a ese agente.
    const own = phones.find((p) => p.agent_id === id);
    if (own) setPhoneId(own.phone_id);
  };

  const onFile = async (file: File | null) => {
    setError(null);
    setPhoneCol(undefined);
    if (!file) return;
    setFileName(file.name);
    setCsvText(await file.text());
    if (!name.trim()) setName(file.name.replace(/\.csv$/i, ''));
  };

  const scheduledMs = mode === 'schedule' && scheduledLocal ? localToUtcMs(scheduledLocal, timezone) : null;
  const scheduleInvalid = mode === 'schedule' && (!scheduledMs || scheduledMs < Date.now() + 60_000);
  const contactCount = converted?.contacts.length ?? 0;

  const blockers: string[] = [];
  if (!name.trim()) blockers.push('Poné un nombre a la campaña');
  if (!agentId) blockers.push('Elegí un agente');
  if (!phoneId) blockers.push('Elegí un número');
  if (!contactCount) blockers.push('Subí un CSV con al menos un teléfono válido');
  if (contactCount > MAX_CONTACTS) blockers.push(`Máximo ${MAX_CONTACTS} contactos por campaña`);
  if (scheduleInvalid) blockers.push('La hora programada tiene que ser al menos 1 minuto en el futuro');

  const submit = async () => {
    if (blockers.length || !converted) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await launchCallshiftCampaign(clientId, {
        name: name.trim(),
        agent_id: agentId,
        phone_id: phoneId,
        start: mode !== 'draft',
        scheduled_at: mode === 'schedule' ? scheduledMs : null,
        contacts: converted.contacts,
      });
      setResult(res);
      onLaunched();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('No se pudo crear la campaña'));
      if (err instanceof CallshiftApiError && err.campaignId) onLaunched();
    } finally {
      setSubmitting(false);
    }
  };

  const skippedSummary = (skipped: SkippedContact[]) => {
    const counts = new Map<string, number>();
    skipped.forEach((s) => counts.set(s.reason, (counts.get(s.reason) ?? 0) + 1));
    return [...counts.entries()].map(([reason, n]) => `${n} ${SKIP_REASON[reason as SkippedContact['reason']] ?? reason}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-800">Nueva campaña</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {result ? (
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-3 rounded-lg bg-emerald-50 p-4 text-emerald-800">
              <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-semibold">
                  {result.status === 'in_progress'
                    ? 'Campaña lanzada'
                    : result.status === 'scheduled'
                      ? `Campaña programada para ${new Date(result.scheduled_at!).toLocaleString('es-ES', { timeZone: timezone })} (${timezone})`
                      : 'Campaña creada sin lanzar'}
                </p>
                <p>{result.contacts_pushed} contactos cargados.</p>
                {result.skipped.length > 0 && (
                  <p>Descartados: {skippedSummary(result.skipped).join(', ')}.</p>
                )}
                {result.webhook.agent_repaired && (
                  <p className="text-xs mt-1">El agente no estaba enviando sus llamadas a este panel; se corrigió antes de lanzar.</p>
                )}
              </div>
            </div>
            {result.webhook.warning && (
              <div className="flex items-start gap-3 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
                <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
                {result.webhook.warning}
              </div>
            )}
            <div className="flex justify-end">
              <Button type="button" onClick={onClose}>Cerrar</Button>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Campaña octubre" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Agente</label>
                <select className={inputCls} value={agentId} onChange={(e) => onAgentChange(e.target.value)}>
                  {agents.map((a) => (
                    <option key={a.agent_id} value={a.agent_id}>{a.name || a.agent_id}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Número desde el que se llama</label>
                <select className={inputCls} value={phoneId} onChange={(e) => setPhoneId(e.target.value)}>
                  {phones.length === 0 && <option value="">Sin números disponibles</option>}
                  {phones.map((p) => (
                    <option key={p.phone_id} value={p.phone_id}>
                      {p.phone_number || p.phone_id}{p.agent_name ? ` · ${p.agent_name}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contactos (CSV)</label>
              <label className="flex items-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600 cursor-pointer hover:bg-slate-50">
                <FileUp className="w-4 h-4" />
                {fileName || 'Elegir archivo .csv'}
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
              </label>
              <p className="text-xs text-slate-400 mt-1">
                La columna de nombre y la de apellido se detectan solas; el resto de columnas viajan al agente como datos del contacto.
              </p>
            </div>

            {parsed?.needsSelection && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">¿Qué columna tiene el teléfono?</label>
                <select className={inputCls} value={phoneCol ?? ''} onChange={(e) => setPhoneCol(Number(e.target.value))}>
                  <option value="" disabled>Elegir columna...</option>
                  {(parsed.candidates?.length ? parsed.candidates : parsed.columns ?? []).map((c) => (
                    <option key={c.index} value={c.index}>{c.header || `Columna ${c.index + 1}`} (ej: {c.sample || '—'})</option>
                  ))}
                </select>
              </div>
            )}
            {parsed?.error && <p className="text-sm text-red-600">{parsed.error}</p>}

            {converted && (
              <div className="rounded-lg bg-slate-50 p-4 text-sm space-y-2">
                <p className="text-slate-800">
                  <strong>{contactCount}</strong> contactos listos para llamar
                  {converted.firstNameColumn && <> · nombre: <code>{converted.firstNameColumn}</code></>}
                  {converted.lastNameColumn && <> · apellido: <code>{converted.lastNameColumn}</code></>}
                </p>
                {withoutPrefix > 0 && (
                  <div className="flex flex-wrap items-center gap-2 text-amber-700">
                    <AlertTriangle className="w-4 h-4" />
                    {withoutPrefix} números sin código de país. Prefijo a usar:
                    <input
                      className="w-20 rounded border border-amber-300 px-2 py-1 text-sm"
                      value={prefix}
                      onChange={(e) => setPrefix(e.target.value)}
                      placeholder="+34"
                    />
                  </div>
                )}
                {invalid > 0 && <p className="text-amber-700">{invalid} números inválidos se van a descartar.</p>}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">¿Cuándo?</label>
              <div className="flex flex-wrap gap-2">
                {([
                  ['now', 'Lanzar ahora'],
                  ['schedule', 'Programar'],
                  ['draft', 'Crear sin lanzar'],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMode(value)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                      mode === value ? 'bg-[#05163b] text-white border-[#05163b]' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {mode === 'schedule' && (
                <div className="grid gap-3 sm:grid-cols-2 mt-3">
                  <input type="datetime-local" className={inputCls} value={scheduledLocal} onChange={(e) => setScheduledLocal(e.target.value)} />
                  <select className={inputCls} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                    {timezones.map((tz) => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </div>
              )}
              {mode === 'now' && (
                <p className="text-xs text-slate-400 mt-2">Los teléfonos empiezan a sonar en cuanto se cargan los contactos.</p>
              )}
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 space-y-1">
                <p>{error.message}</p>
                {error instanceof CallshiftApiError && error.campaignId && (
                  <p className="text-xs">
                    La campaña se creó igual ({error.contactsPushed ?? 0} contactos cargados) y aparece en la lista: podés lanzarla o borrarla desde ahí.
                  </p>
                )}
                {error instanceof CallshiftApiError && error.skipped && error.skipped.length > 0 && (
                  <p className="text-xs">Descartados: {skippedSummary(error.skipped).join(', ')}.</p>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-2">
              <p className="text-xs text-slate-400">{blockers[0] ?? ''}</p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                <Button type="button" onClick={submit} disabled={submitting || blockers.length > 0}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === 'now' ? 'Lanzar' : mode === 'schedule' ? 'Programar' : 'Crear'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
