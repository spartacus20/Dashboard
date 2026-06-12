import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  ChevronLeft, ChevronRight, Edit2, Loader2,
  DollarSign, Euro, Phone, Users, TrendingUp, BarChart3,
  RefreshCw, Download,
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { EXCHANGE_RATE_FALLBACK, EXCHANGE_RATE_TIMEOUT_MS } from '../lib/constants';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CallStat {
  dia: string;
  num_llamadas: number;
  minutos: string;
  gasto_total: string;
}

interface AgendaStat {
  dia: string;
  agendas: number;
  captadas: number;
  agendas_por_fecha: number;
  captadas_por_fecha: number;
  agendas_generadas: number;
  captadas_generadas: number;
  citas_revisadas: number;
  placas_por_fecha: number;
  baterias_por_fecha: number;
  placas_generadas: number;
  baterias_generadas: number;
}

interface TelefoniaRecord {
  dia: string;
  gasto_telefonia: number;
}

interface DayRow {
  dia: string;
  llamadas: number;
  minutos: number;
  gastoUSD: number;
  gastoEUR: number;
  telefonia: number | null;
  agendas: number;
  captadas: number;
  agendas_por_fecha: number;
  captadas_por_fecha: number;
  agendas_generadas: number;
  captadas_generadas: number;
  citas_revisadas: number;
  placas_por_fecha: number;
  baterias_por_fecha: number;
  placas_generadas: number;
  baterias_generadas: number;
  isWeekend: boolean;
  weekLabel: string;
}

interface WeekGroup {
  label: string;
  rows: DayRow[];
}

// ─── Column tooltips ──────────────────────────────────────────────────────────

const COL_TOOLTIPS: Record<string, string> = {
  'llamadas':            'Total de llamadas realizadas ese día',
  'minutos':             'Duración total de las llamadas en minutos',
  'gasto-usd':           'Costo de la IA en dólares — suma de cost en call_logs',
  'gasto-eur':           'Costo de la IA en euros = Gasto $ × tipo de cambio USD/EUR',
  'telefonia':           'Gasto de telefonía ingresado manualmente por día',
  'placas-por-fecha':    'Citas tipo placas solares cuya fecha de visita cae en este día',
  'baterias-por-fecha':  'Citas tipo batería cuya fecha de visita cae en este día',
  'total-agendado':      'Placas + Baterías con visita pactada este día (calculado en frontend)',
  'confirmadas':         'Placas solares aprobadas (aprobada = true) cuya visita cae en este día',
  'placas-generadas':    'Citas tipo placas solares creadas este día (por created_at)',
  'baterias-generadas':  'Citas tipo batería creadas este día (por created_at)',
  'total-captado':       'Placas + Baterías generadas este día (calculado en frontend)',
  'citas-revisadas':     'Citas con revisada = true creadas este día (por created_at)',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function checkIsWeekend(dateStr: string): boolean {
  const d = new Date(dateStr + 'T12:00:00');
  return d.getDay() === 0 || d.getDay() === 6;
}

function getDaysInMonth(year: number, month: number): string[] {
  const today = new Date();
  const totalDays = new Date(year, month, 0).getDate();
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;
  const limit = isCurrentMonth ? today.getDate() : totalDays;
  const days: string[] = [];
  for (let d = 1; d <= limit; d++) {
    days.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return days;
}

function getISOWeek(dateStr: string): number {
  const d = new Date(dateStr + 'T12:00:00');
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function assignWeekLabels(days: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  let counter = 0; let lastISO = -1;
  for (const day of days) {
    const iso = getISOWeek(day);
    if (iso !== lastISO) { counter++; lastISO = iso; }
    map[day] = `Semana ${counter}`;
  }
  return map;
}

function fmtEUR(v: number): string {
  return v.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtUSD(v: number): string {
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtNum(v: number): string { return v.toLocaleString('es-ES'); }
function fmtDate(dia: string): string { return dia.split('-').reverse().join('/'); }

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// ─── Sub-components ───────────────────────────────────────────────────────────

const XIcon = () => (
  <svg width="7" height="7" viewBox="0 0 7 7" fill="none">
    <path d="M1 1l5 5M6 1L1 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
);

// ─── Component ────────────────────────────────────────────────────────────────

interface PresupuestoProps {
  onNavigate: (page: string) => void;
}

export function Presupuesto({ onNavigate: _onNavigate }: PresupuestoProps) {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year,  setYear]  = useState(today.getFullYear());

  const [exchangeRate, setExchangeRate] = useState(EXCHANGE_RATE_FALLBACK);
  const [rateDate,     setRateDate]     = useState<string | null>(null);
  const [fetchingRate, setFetchingRate] = useState(false);
  const [rateFallback, setRateFallback] = useState(false);
  const [rateApiError, setRateApiError] = useState<string | null>(null);
  const [rateSource,   setRateSource]   = useState<string>('');

  const [callStats,     setCallStats]     = useState<CallStat[]>([]);
  const [agendaStats,   setAgendaStats]   = useState<AgendaStat[]>([]);
  const [telefoniaData, setTelefoniaData] = useState<TelefoniaRecord[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);

  const [hiddenCards,   setHiddenCards]   = useState<Set<string>>(new Set());
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const showCol = (key: string) => !hiddenColumns.has(key);

  const [editingDia, setEditingDia] = useState<string | null>(null);
  const [editingVal, setEditingVal] = useState('');
  const [savingDia,  setSavingDia]  = useState<string | null>(null);

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;

  const goPrev = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const goNext = () => {
    if (isCurrentMonth) return;
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  // ── Fetch ───────────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null);
    const pad = (n: number) => String(n).padStart(2, '0');
    const firstDay = `${year}-${pad(month)}-01`;
    const lastDay  = `${year}-${pad(month)}-${new Date(year, month, 0).getDate()}`;

    const [callRes, agendaRes, telRes] = await Promise.all([
      supabase.from('mas_sol_call_stats')
        .select('dia, num_llamadas, minutos, gasto_total')
        .gte('dia', firstDay).lte('dia', lastDay).order('dia'),
      supabase.from('mas_sol_agenda_stats')
        .select('dia, agendas, captadas, agendas_por_fecha, captadas_por_fecha, agendas_generadas, captadas_generadas, citas_revisadas, placas_por_fecha, baterias_por_fecha, placas_generadas, baterias_generadas')
        .gte('dia', firstDay).lte('dia', lastDay).order('dia'),
      supabase.from('mas_sol_daily_telefonia')
        .select('dia, gasto_telefonia')
        .gte('dia', firstDay).lte('dia', lastDay),
    ]);

    const errors: string[] = [];
    if (callRes.error)   errors.push(`call_stats: ${callRes.error.message}`);
    if (agendaRes.error) errors.push(`agenda_stats: ${agendaRes.error.message}`);
    if (telRes.error)    errors.push(`daily_telefonia: ${telRes.error.message}`);
    if (errors.length)   setError(errors.join(' | '));

    setCallStats(callRes.data ?? []);
    setAgendaStats((agendaRes.data ?? []) as AgendaStat[]);
    setTelefoniaData(telRes.data ?? []);
    setLoading(false);
  }, [month, year]);

  // ── Exchange rate ───────────────────────────────────────────────────────────

  const fetchExchangeRate = useCallback(async () => {
    setFetchingRate(true); setRateFallback(false); setRateApiError(null);

    const parseDate = (raw: string): string => {
      if (!raw) return '';
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
      const d = new Date(raw);
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
      return raw.slice(0, 10);
    };

    const APIS = [
      { name: 'ExchangeRate-API', url: 'https://open.er-api.com/v6/latest/USD',
        extract: (d: any) => d.rates?.EUR, date: (d: any) => parseDate(d.time_last_update_utc ?? '') },
      { name: 'Frankfurter (BCE)', url: 'https://api.frankfurter.app/latest?from=USD&to=EUR',
        extract: (d: any) => d.rates?.EUR, date: (d: any) => parseDate(d.date ?? '') },
      { name: 'Currency-API CDN', url: 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',
        extract: (d: any) => d.usd?.eur, date: (d: any) => parseDate(d.date ?? '') },
    ];

    let lastError = '';
    for (const api of APIS) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), EXCHANGE_RATE_TIMEOUT_MS);
        const res = await fetch(api.url, { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const rate = api.extract(data);
        if (!rate || isNaN(rate)) throw new Error('Rate no encontrado');
        setExchangeRate(rate); setRateDate(api.date(data)); setRateSource(api.name);
        supabase.from('mas_sol_config').upsert({ clave: 'tipo_cambio_usd_eur', valor: String(rate), updated_at: new Date().toISOString() });
        setFetchingRate(false); return;
      } catch (err: any) {
        lastError = err?.name === 'AbortError' ? 'Timeout' : (err?.message ?? 'error');
      }
    }

    setRateApiError(lastError); setRateFallback(true);
    const { data } = await supabase.from('mas_sol_config').select('valor').eq('clave', 'tipo_cambio_usd_eur').maybeSingle();
    if (data) { const r = parseFloat(data.valor); if (!isNaN(r) && r > 0) setExchangeRate(r); }
    setFetchingRate(false);
  }, []);

  useEffect(() => { fetchAll(); },         [fetchAll]);
  useEffect(() => { fetchExchangeRate(); }, [fetchExchangeRate]);

  // ── Telefonía editing ────────────────────────────────────────────────────────

  const saveTelefonia = async (dia: string) => {
    if (savingDia) return;
    setSavingDia(dia);
    const raw = editingVal.trim().replace(',', '.');
    const val = parseFloat(raw);
    if (raw === '' || isNaN(val)) {
      await supabase.from('mas_sol_daily_telefonia').delete().eq('dia', dia);
      setTelefoniaData(prev => prev.filter(r => r.dia !== dia));
    } else {
      await supabase.from('mas_sol_daily_telefonia').upsert({ dia, gasto_telefonia: val, updated_at: new Date().toISOString() });
      setTelefoniaData(prev => [...prev.filter(r => r.dia !== dia), { dia, gasto_telefonia: val }]);
    }
    setSavingDia(null); setEditingDia(null); setEditingVal('');
  };

  const startEditTelefonia = (dia: string, current: number | null) => {
    setEditingDia(dia); setEditingVal(current !== null ? String(current) : '');
  };

  // ── Build rows ──────────────────────────────────────────────────────────────

  const rows = useMemo((): DayRow[] => {
    const days       = getDaysInMonth(year, month);
    const weekLabels = assignWeekLabels(days);
    const callMap:   Record<string, CallStat>   = {};
    const agendaMap: Record<string, AgendaStat> = {};
    const telMap:    Record<string, number>     = {};
    for (const r of callStats)     callMap[r.dia.slice(0, 10)]   = r;
    for (const r of agendaStats)   agendaMap[r.dia.slice(0, 10)] = r;
    for (const r of telefoniaData) telMap[r.dia.slice(0, 10)]    = r.gasto_telefonia;

    return days.map(dia => {
      const call   = callMap[dia];
      const agenda = agendaMap[dia];
      const gastoUSD = call ? parseFloat(call.gasto_total) : 0;
      return {
        dia,
        llamadas:           call   ? call.num_llamadas           : 0,
        minutos:            call   ? parseFloat(call.minutos)    : 0,
        gastoUSD,
        gastoEUR:           gastoUSD * exchangeRate,
        telefonia:          telMap[dia] !== undefined ? telMap[dia] : null,
        agendas:            agenda ? agenda.agendas            : 0,
        captadas:           agenda ? agenda.captadas           : 0,
        agendas_por_fecha:  agenda ? agenda.agendas_por_fecha  : 0,
        captadas_por_fecha: agenda ? agenda.captadas_por_fecha : 0,
        agendas_generadas:  agenda ? agenda.agendas_generadas  : 0,
        captadas_generadas: agenda ? agenda.captadas_generadas : 0,
        citas_revisadas:    agenda ? agenda.citas_revisadas    : 0,
        placas_por_fecha:   agenda ? agenda.placas_por_fecha   : 0,
        baterias_por_fecha: agenda ? agenda.baterias_por_fecha : 0,
        placas_generadas:   agenda ? agenda.placas_generadas   : 0,
        baterias_generadas: agenda ? agenda.baterias_generadas : 0,
        isWeekend:          checkIsWeekend(dia),
        weekLabel:          weekLabels[dia],
      };
    });
  }, [callStats, agendaStats, telefoniaData, exchangeRate, month, year]);

  const weekGroups = useMemo((): WeekGroup[] => {
    const groups: WeekGroup[] = [];
    let cur: WeekGroup | null = null;
    for (const row of rows) {
      if (!cur || cur.label !== row.weekLabel) { if (cur) groups.push(cur); cur = { label: row.weekLabel, rows: [row] }; }
      else cur.rows.push(row);
    }
    if (cur) groups.push(cur);
    return groups;
  }, [rows]);

  const totals = useMemo(() => {
    const gastoUSD  = rows.reduce((s, r) => s + r.gastoUSD,           0);
    const gastoEUR  = rows.reduce((s, r) => s + r.gastoEUR,           0);
    const telefonia = rows.reduce((s, r) => s + (r.telefonia ?? 0),   0);
    const agendas   = rows.reduce((s, r) => s + r.agendas,            0);
    const captadas  = rows.reduce((s, r) => s + r.captadas,           0);
    const costoTotal = gastoEUR + telefonia;
    const sumDiarioAgenda  = rows.reduce((s, r) => s + (r.agendas  > 0 ? (r.gastoEUR + (r.telefonia ?? 0)) / r.agendas  : 0), 0);
    const sumDiarioCaptada = rows.reduce((s, r) => s + (r.captadas > 0 ? (r.gastoEUR + (r.telefonia ?? 0)) / r.captadas : 0), 0);
    return {
      gastoUSD, gastoEUR, telefonia, costoTotal, agendas, captadas,
      agendas_pf:   rows.reduce((s, r) => s + r.agendas_por_fecha,  0),
      captadas_pf:  rows.reduce((s, r) => s + r.captadas_por_fecha, 0),
      agendas_gen:  rows.reduce((s, r) => s + r.agendas_generadas,  0),
      captadas_gen: rows.reduce((s, r) => s + r.captadas_generadas, 0),
      citas_rev:    rows.reduce((s, r) => s + r.citas_revisadas,    0),
      placas_pf:    rows.reduce((s, r) => s + r.placas_por_fecha,   0),
      baterias_pf:  rows.reduce((s, r) => s + r.baterias_por_fecha, 0),
      placas_gen:   rows.reduce((s, r) => s + r.placas_generadas,   0),
      baterias_gen: rows.reduce((s, r) => s + r.baterias_generadas, 0),
      mediaAgenda:  agendas  > 0 && rows.length > 0 ? sumDiarioAgenda  / rows.length : null,
      mediaCaptada: captadas > 0 && rows.length > 0 ? sumDiarioCaptada / rows.length : null,
      llamadas:     rows.reduce((s, r) => s + r.llamadas, 0),
      minutos:      rows.reduce((s, r) => s + r.minutos,  0),
    };
  }, [rows]);

  function weekSub(weekRows: DayRow[]) {
    const gastoUSD  = weekRows.reduce((s, r) => s + r.gastoUSD,           0);
    const gastoEUR  = weekRows.reduce((s, r) => s + r.gastoEUR,           0);
    const telefonia = weekRows.reduce((s, r) => s + (r.telefonia ?? 0),   0);
    return {
      gastoUSD, gastoEUR, telefonia,
      agendas_pf:  weekRows.reduce((s, r) => s + r.agendas_por_fecha,  0),
      captadas_pf: weekRows.reduce((s, r) => s + r.captadas_por_fecha, 0),
      agendas_gen: weekRows.reduce((s, r) => s + r.agendas_generadas,  0),
      cap_gen:     weekRows.reduce((s, r) => s + r.captadas_generadas, 0),
      citas_rev:   weekRows.reduce((s, r) => s + r.citas_revisadas,    0),
      placas_pf:   weekRows.reduce((s, r) => s + r.placas_por_fecha,   0),
      baterias_pf: weekRows.reduce((s, r) => s + r.baterias_por_fecha, 0),
      placas_gen:  weekRows.reduce((s, r) => s + r.placas_generadas,   0),
      bat_gen:     weekRows.reduce((s, r) => s + r.baterias_generadas, 0),
      llamadas:    weekRows.reduce((s, r) => s + r.llamadas, 0),
      minutos:     weekRows.reduce((s, r) => s + r.minutos,  0),
    };
  }

  // ── Export CSV ──────────────────────────────────────────────────────────────

  const exportCSV = useCallback(() => {
    const S = ';';
    const n = (v: number, dec = 2) => v.toFixed(dec).replace('.', ',');
    const lines: string[] = [];
    lines.push(`uMindsIA — Costes de llamadas — ${MONTH_NAMES[month - 1]} ${year}`);
    lines.push(`Tipo de cambio USD/EUR${S}${n(exchangeRate, 4)}`);
    lines.push('');
    lines.push(['', '', '', '', '', '', '', 'Agendado / fecha cita', '', '', '', 'Captado / generado ese día', '', '', ''].join(S));
    lines.push(['Semana','Fecha','Llamadas','Minutos','Gasto IA ($)','Gasto IA (€)','Gasto Telefonía','Placas','Baterías','Total','Confirmadas','Placas','Baterías','Total','Revisadas'].join(S));

    for (const group of weekGroups) {
      group.rows.forEach((row, idx) => {
        lines.push([
          idx === 0 ? group.label : '',
          fmtDate(row.dia),
          row.llamadas || '',
          row.minutos  || '',
          n(row.gastoUSD),
          n(row.gastoEUR),
          row.telefonia !== null ? n(row.telefonia) : '',
          row.placas_por_fecha   || '',
          row.baterias_por_fecha || '',
          (row.placas_por_fecha + row.baterias_por_fecha) || '',
          row.agendas_por_fecha  || '',
          row.placas_generadas   || '',
          row.baterias_generadas || '',
          (row.placas_generadas + row.baterias_generadas) || '',
          row.citas_revisadas    || '',
        ].join(S));
      });
      const sub = weekSub(group.rows);
      lines.push([
        'SUBTOTAL', group.label,
        sub.llamadas, sub.minutos,
        n(sub.gastoUSD), n(sub.gastoEUR),
        sub.telefonia > 0 ? n(sub.telefonia) : '',
        sub.placas_pf  || 0, sub.baterias_pf || 0, (sub.placas_pf + sub.baterias_pf) || 0,
        sub.agendas_pf || 0,
        sub.placas_gen || 0, sub.bat_gen     || 0, (sub.placas_gen + sub.bat_gen)     || 0,
        sub.citas_rev  || 0,
      ].join(S));
    }
    lines.push([
      'TOTAL', '',
      totals.llamadas, totals.minutos,
      n(totals.gastoUSD), n(totals.gastoEUR),
      totals.telefonia > 0 ? n(totals.telefonia) : '',
      totals.placas_pf  || 0, totals.baterias_pf || 0, (totals.placas_pf + totals.baterias_pf) || 0,
      totals.agendas_pf || 0,
      totals.placas_gen || 0, totals.baterias_gen || 0, (totals.placas_gen + totals.baterias_gen) || 0,
      totals.citas_rev  || 0,
    ].join(S));
    lines.push('');
    lines.push(['Gasto $ Total','Gasto € Total','Total Telefonía','Gasto Total (€)','Total Agendas','Total Captadas','Media €/Agenda','Media €/Captada'].join(S));
    lines.push([n(totals.gastoUSD),n(totals.gastoEUR),n(totals.telefonia),n(totals.costoTotal),totals.agendas,totals.captadas,totals.mediaAgenda!==null?n(totals.mediaAgenda):'',totals.mediaCaptada!==null?n(totals.mediaCaptada):''].join(S));

    const csv = lines.join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `presupuesto_${year}_${String(month).padStart(2, '0')}_${MONTH_NAMES[month - 1].toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [weekGroups, totals, month, year, exchangeRate]);

  // ── Render ──────────────────────────────────────────────────────────────────

  const dash = <span className="text-gray-300">—</span>;

  const vB2   = (['placas-por-fecha','baterias-por-fecha','total-agendado','confirmadas'] as const).filter(showCol).length;
  const vB3   = (['placas-generadas','baterias-generadas','total-captado','citas-revisadas'] as const).filter(showCol).length;
  const vBase = (['llamadas','minutos','gasto-usd','gasto-eur','telefonia'] as const).filter(showCol).length;

  const ColTh = ({ colKey, tooltip, borderLeft, children }: { colKey: string; tooltip?: string; borderLeft?: boolean; children: React.ReactNode }) => (
    <th className={`px-3 py-3 text-center font-semibold whitespace-nowrap relative group/th${borderLeft ? ' border-l-2 border-blue-400/40' : ''}`}>
      <div className="flex items-center justify-center gap-1">
        <span className="relative group/tip">
          <span className={tooltip ? 'cursor-help' : ''}>{children}</span>
          {tooltip && (
            <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 w-56 rounded-lg bg-gray-900 text-white text-[11px] px-3 py-2 opacity-0 group-hover/tip:opacity-100 pointer-events-none transition-opacity z-50 text-left font-normal leading-relaxed shadow-xl whitespace-normal">
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-gray-900" />
              {tooltip}
            </span>
          )}
        </span>
        <button
          onClick={() => setHiddenColumns(prev => new Set(prev).add(colKey))}
          className="opacity-0 group-hover/th:opacity-60 hover:!opacity-100 w-4 h-4 rounded-full flex items-center justify-center bg-white/20 text-white hover:bg-white/40 transition-opacity flex-shrink-0"
          title="Ocultar columna"
        ><XIcon /></button>
      </div>
    </th>
  );

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Presupuesto</h1>
          <p className="text-sm text-gray-500 mt-1">Costes de llamadas · {MONTH_NAMES[month - 1]} {year}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={goPrev} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold w-40 text-center">{MONTH_NAMES[month - 1]} {year}</span>
          <button onClick={goNext} disabled={isCurrentMonth} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button onClick={exportCSV} disabled={loading || rows.length === 0} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed ml-2">
            <Download className="w-4 h-4" />Exportar
          </button>
          <div className="relative group ml-1">
            <button onClick={fetchExchangeRate} disabled={fetchingRate} className={`flex items-center gap-1 px-2.5 py-2 rounded-lg border text-xs font-mono transition-colors ${rateFallback ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}>
              {fetchingRate ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              {rateFallback ? '⚠' : ''}1$ = {exchangeRate}€
            </button>
            <div className="absolute right-0 top-full mt-1.5 z-20 w-64 rounded-lg border border-gray-200 bg-white shadow-lg px-3 py-2.5 text-xs text-gray-600 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
              <p className="font-semibold text-gray-800 mb-1">Tipo de cambio USD → EUR</p>
              <p><span className="text-gray-400">Tasa:</span> {exchangeRate}</p>
              {rateDate   && <p><span className="text-gray-400">Fecha:</span> {rateDate}</p>}
              {rateSource && !rateFallback && <p><span className="text-gray-400">Fuente:</span> {rateSource}</p>}
              {rateFallback && <p className="text-amber-600 mt-1">⚠ APIs no disponibles — usando último valor guardado{rateApiError ? ` (${rateApiError})` : ''}</p>}
              <p className="text-gray-400 mt-1.5">Clic para actualizar</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <strong>Error Supabase:</strong> {error}
        </div>
      )}

      {/* ── Summary cards ──────────────────────────────────────────────────── */}
      {!loading && (
        <>
          {hiddenCards.size > 0 && (
            <div className="flex justify-end">
              <button onClick={() => setHiddenCards(new Set())} className="text-xs text-gray-400 hover:text-gray-600 underline transition-colors">
                Mostrar todas las cards ({hiddenCards.size} oculta{hiddenCards.size !== 1 ? 's' : ''})
              </button>
            </div>
          )}
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${8 - hiddenCards.size}, 1fr)` }}>
            {[
              { key: 'gasto-usd',     icon: <DollarSign className="w-4 h-4 text-green-500" />,  label: 'Gasto IA ($)',    value: fmtUSD(totals.gastoUSD),                                           accent: false },
              { key: 'gasto-eur',     icon: <Euro       className="w-4 h-4 text-blue-500" />,    label: 'Gasto IA (€)',    value: fmtEUR(totals.gastoEUR),                                           accent: false },
              { key: 'telefonia',     icon: <Phone      className="w-4 h-4 text-purple-500" />,  label: 'Total Telefonía', value: totals.telefonia > 0 ? fmtEUR(totals.telefonia) : '—',            accent: false },
              { key: 'gasto-total',   icon: <BarChart3  className="w-4 h-4 text-orange-500" />,  label: 'Gasto Total (€)', value: fmtEUR(totals.costoTotal),                                         accent: true  },
              { key: 'agendas',       icon: <Users      className="w-4 h-4 text-teal-500" />,    label: 'Total Agendas',   value: String(totals.agendas),                                            accent: false },
              { key: 'captadas',      icon: <TrendingUp className="w-4 h-4 text-indigo-500" />,  label: 'Total Captadas',  value: String(totals.captadas),                                           accent: false },
              { key: 'media-agenda',  icon: <Euro       className="w-4 h-4 text-rose-500" />,    label: 'Media €/Agenda',  value: totals.mediaAgenda  !== null ? fmtEUR(totals.mediaAgenda)  : '—', accent: false },
              { key: 'media-captada', icon: <Euro       className="w-4 h-4 text-amber-500" />,   label: 'Media €/Captada', value: totals.mediaCaptada !== null ? fmtEUR(totals.mediaCaptada) : '—', accent: false },
            ].filter(card => !hiddenCards.has(card.key)).map(card => (
              <div key={card.key} className="relative group">
                <button onClick={() => setHiddenCards(prev => new Set(prev).add(card.key))}
                  className={`absolute top-1.5 right-1.5 z-10 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${card.accent ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600'}`}
                  title="Ocultar card"><XIcon /></button>
                <Card className={card.accent ? 'border-[#0a2a5a] bg-[#0a2a5a] text-white shadow-md' : ''}>
                  <CardContent className="pt-4 pb-4 px-4">
                    <div className="flex items-center gap-1.5 mb-1">
                      {card.icon}
                      <span className={`text-[10px] font-medium uppercase tracking-wide ${card.accent ? 'text-blue-200' : 'text-gray-500'}`}>{card.label}</span>
                    </div>
                    <div className={`text-base font-bold text-center ${card.accent ? 'text-white' : 'text-gray-900'}`}>{card.value}</div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-32 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /><span className="text-sm">Cargando datos…</span>
        </div>
      ) : (
        <>
          {hiddenColumns.size > 0 && (
            <div className="flex justify-end">
              <button onClick={() => setHiddenColumns(new Set())} className="text-xs text-gray-400 hover:text-gray-600 underline transition-colors">
                Mostrar todas las columnas ({hiddenColumns.size} oculta{hiddenColumns.size !== 1 ? 's' : ''})
              </button>
            </div>
          )}

          <div className="rounded-xl border border-gray-200 shadow-sm">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#081f47] text-white text-[9px] uppercase tracking-wider">
                  <th colSpan={2 + vBase} className="bg-[#081f47] border-b border-[#1a3570]" />
                  {vB2 > 0 && <th colSpan={vB2} className="px-3 py-1.5 text-center font-bold border-l-2 border-blue-400/50 bg-[#0d3060]">Agendado <span className="text-blue-300 font-normal normal-case tracking-normal">/ fecha cita</span></th>}
                  {vB3 > 0 && <th colSpan={vB3} className="px-3 py-1.5 text-center font-bold border-l-2 border-blue-400/50 bg-[#0a2a55]">Captado <span className="text-blue-300 font-normal normal-case tracking-normal">/ generado ese día</span></th>}
                </tr>
                <tr className="bg-[#0a2a5a] text-white text-xs">
                  <th className="px-3 py-3 text-left font-semibold whitespace-nowrap w-20"></th>
                  <th className="px-3 py-3 text-center font-semibold whitespace-nowrap">Fecha</th>
                  {showCol('llamadas')  && <ColTh colKey="llamadas"  tooltip={COL_TOOLTIPS['llamadas']}>Llamadas</ColTh>}
                  {showCol('minutos')   && <ColTh colKey="minutos"   tooltip={COL_TOOLTIPS['minutos']}>Minutos</ColTh>}
                  {showCol('gasto-usd') && <ColTh colKey="gasto-usd" tooltip={COL_TOOLTIPS['gasto-usd']}>Gasto IA ($)</ColTh>}
                  {showCol('gasto-eur') && <ColTh colKey="gasto-eur" tooltip={COL_TOOLTIPS['gasto-eur']}>Gasto IA (€)</ColTh>}
                  {showCol('telefonia') && (
                    <th className="px-3 py-3 text-center font-semibold whitespace-nowrap relative group/th">
                      <div className="flex items-center justify-center gap-1">
                        <span className="relative group/tip cursor-help">
                          <span>Telefonía <span className="text-blue-300 font-normal">(editar)</span></span>
                          <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 w-56 rounded-lg bg-gray-900 text-white text-[11px] px-3 py-2 opacity-0 group-hover/tip:opacity-100 pointer-events-none transition-opacity z-50 text-left font-normal leading-relaxed shadow-xl whitespace-normal">
                            <span className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-gray-900" />
                            {COL_TOOLTIPS['telefonia']}
                          </span>
                        </span>
                        <button onClick={() => setHiddenColumns(prev => new Set(prev).add('telefonia'))} className="opacity-0 group-hover/th:opacity-60 hover:!opacity-100 w-4 h-4 rounded-full flex items-center justify-center bg-white/20 text-white hover:bg-white/40 transition-opacity" title="Ocultar columna"><XIcon /></button>
                      </div>
                    </th>
                  )}
                  {showCol('placas-por-fecha')   && <ColTh colKey="placas-por-fecha"   tooltip={COL_TOOLTIPS['placas-por-fecha']}   borderLeft>Placas</ColTh>}
                  {showCol('baterias-por-fecha') && <ColTh colKey="baterias-por-fecha" tooltip={COL_TOOLTIPS['baterias-por-fecha']}>Baterías</ColTh>}
                  {showCol('total-agendado')     && <ColTh colKey="total-agendado"     tooltip={COL_TOOLTIPS['total-agendado']}>Total</ColTh>}
                  {showCol('confirmadas')        && <ColTh colKey="confirmadas"        tooltip={COL_TOOLTIPS['confirmadas']}>Confirmadas</ColTh>}
                  {showCol('placas-generadas')   && <ColTh colKey="placas-generadas"   tooltip={COL_TOOLTIPS['placas-generadas']}   borderLeft>Placas</ColTh>}
                  {showCol('baterias-generadas') && <ColTh colKey="baterias-generadas" tooltip={COL_TOOLTIPS['baterias-generadas']}>Baterías</ColTh>}
                  {showCol('total-captado')      && <ColTh colKey="total-captado"      tooltip={COL_TOOLTIPS['total-captado']}>Total</ColTh>}
                  {showCol('citas-revisadas')    && <ColTh colKey="citas-revisadas"    tooltip={COL_TOOLTIPS['citas-revisadas']}>Revisadas</ColTh>}
                </tr>
              </thead>

              <tbody>
                {weekGroups.map(group => {
                  const sub = weekSub(group.rows);
                  return (
                    <React.Fragment key={group.label}>
                      {group.rows.map((row, idx) => {
                        const isEditing = editingDia === row.dia;
                        const isSaving  = savingDia  === row.dia;
                        const wkColor   = row.isWeekend ? 'text-gray-400' : '';
                        const bgClass   = row.isWeekend ? 'bg-gray-50' : 'bg-white hover:bg-orange-50';

                        return (
                          <tr key={row.dia} className={`border-b border-gray-100 transition-colors ${bgClass}`}>
                            {idx === 0 ? (
                              <td rowSpan={group.rows.length} className="px-3 py-2 text-xs font-bold text-[#0a2a5a] bg-[#eef2fb] border-r border-[#c8d4f0] align-middle text-center whitespace-nowrap">{group.label}</td>
                            ) : null}
                            <td className={`px-3 py-2 text-center font-medium whitespace-nowrap ${row.isWeekend ? 'text-gray-400' : 'text-gray-700'}`}>{fmtDate(row.dia)}</td>

                            {showCol('llamadas')  && <td className={`px-3 py-2 text-center ${wkColor}`}>{row.llamadas  > 0 ? fmtNum(row.llamadas) : dash}</td>}
                            {showCol('minutos')   && <td className={`px-3 py-2 text-center ${wkColor}`}>{row.minutos   > 0 ? fmtNum(row.minutos)  : dash}</td>}
                            {showCol('gasto-usd') && <td className={`px-3 py-2 text-center ${wkColor}`}>{row.gastoUSD  > 0 ? fmtUSD(row.gastoUSD) : dash}</td>}
                            {showCol('gasto-eur') && <td className={`px-3 py-2 text-center ${wkColor}`}>{row.gastoEUR  > 0 ? fmtEUR(row.gastoEUR) : dash}</td>}

                            {showCol('telefonia') && (
                              <td className="px-2 py-1.5 text-center">
                                {isEditing ? (
                                  <input type="number" step="0.01" min="0" placeholder="0.00" value={editingVal}
                                    onChange={e => setEditingVal(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') saveTelefonia(row.dia); if (e.key === 'Escape') { setEditingDia(null); setEditingVal(''); } }}
                                    onBlur={() => saveTelefonia(row.dia)}
                                    className="w-28 text-center text-xs border border-blue-400 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400" autoFocus />
                                ) : (
                                  <button onClick={() => startEditTelefonia(row.dia, row.telefonia)} className="group inline-flex items-center justify-center gap-1 w-full rounded px-2 py-1 hover:bg-blue-50 hover:text-blue-700 transition-colors">
                                    {isSaving ? <Loader2 className="w-3 h-3 animate-spin text-blue-400" /> :
                                      row.telefonia !== null
                                        ? <><span className={row.isWeekend ? 'text-gray-400' : 'text-gray-700'}>{fmtEUR(row.telefonia)}</span><Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-40 flex-shrink-0" /></>
                                        : <><span className="text-gray-300">—</span><Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-40 flex-shrink-0" /></>}
                                  </button>
                                )}
                              </td>
                            )}

                            {showCol('placas-por-fecha')   && <td className={`px-3 py-2 text-center border-l-2 border-blue-100 ${wkColor}`}>{row.placas_por_fecha   > 0 ? row.placas_por_fecha   : dash}</td>}
                            {showCol('baterias-por-fecha') && <td className={`px-3 py-2 text-center ${wkColor}`}>{row.baterias_por_fecha > 0 ? row.baterias_por_fecha : dash}</td>}
                            {showCol('total-agendado')     && <td className={`px-3 py-2 text-center font-medium ${wkColor}`}>{(row.placas_por_fecha + row.baterias_por_fecha) > 0 ? (row.placas_por_fecha + row.baterias_por_fecha) : dash}</td>}
                            {showCol('confirmadas')        && <td className={`px-3 py-2 text-center ${wkColor}`}>{row.agendas_por_fecha   > 0 ? row.agendas_por_fecha   : dash}</td>}
                            {showCol('placas-generadas')   && <td className={`px-3 py-2 text-center border-l-2 border-blue-100 ${wkColor}`}>{row.placas_generadas   > 0 ? row.placas_generadas   : dash}</td>}
                            {showCol('baterias-generadas') && <td className={`px-3 py-2 text-center ${wkColor}`}>{row.baterias_generadas > 0 ? row.baterias_generadas : dash}</td>}
                            {showCol('total-captado')      && <td className={`px-3 py-2 text-center font-medium ${wkColor}`}>{(row.placas_generadas + row.baterias_generadas) > 0 ? (row.placas_generadas + row.baterias_generadas) : dash}</td>}
                            {showCol('citas-revisadas')    && <td className={`px-3 py-2 text-center ${wkColor}`}>{row.citas_revisadas     > 0 ? row.citas_revisadas     : dash}</td>}
                          </tr>
                        );
                      })}

                      {/* Subtotal */}
                      <tr className="bg-[#dde6f7] border-b-2 border-[#a8bce8] text-[#0a2a5a] text-xs font-semibold">
                        <td className="px-3 py-2 text-center text-[10px] font-bold tracking-wide uppercase text-[#0a2a5a]/60">subtotal</td>
                        <td className="px-3 py-2 text-center">{group.label}</td>
                        {showCol('llamadas')           && <td className="px-3 py-2 text-center">{fmtNum(sub.llamadas)}</td>}
                        {showCol('minutos')            && <td className="px-3 py-2 text-center">{fmtNum(sub.minutos)}</td>}
                        {showCol('gasto-usd')          && <td className="px-3 py-2 text-center">{fmtUSD(sub.gastoUSD)}</td>}
                        {showCol('gasto-eur')          && <td className="px-3 py-2 text-center">{fmtEUR(sub.gastoEUR)}</td>}
                        {showCol('telefonia')          && <td className="px-3 py-2 text-center">{sub.telefonia > 0 ? fmtEUR(sub.telefonia) : <span className="opacity-40">—</span>}</td>}
                        {showCol('placas-por-fecha')   && <td className="px-3 py-2 text-center border-l-2 border-[#a8bce8]">{sub.placas_pf}</td>}
                        {showCol('baterias-por-fecha') && <td className="px-3 py-2 text-center">{sub.baterias_pf}</td>}
                        {showCol('total-agendado')     && <td className="px-3 py-2 text-center font-bold">{sub.placas_pf + sub.baterias_pf}</td>}
                        {showCol('confirmadas')        && <td className="px-3 py-2 text-center">{sub.agendas_pf}</td>}
                        {showCol('placas-generadas')   && <td className="px-3 py-2 text-center border-l-2 border-[#a8bce8]">{sub.placas_gen}</td>}
                        {showCol('baterias-generadas') && <td className="px-3 py-2 text-center">{sub.bat_gen}</td>}
                        {showCol('total-captado')      && <td className="px-3 py-2 text-center font-bold">{sub.placas_gen + sub.bat_gen}</td>}
                        {showCol('citas-revisadas')    && <td className="px-3 py-2 text-center">{sub.citas_rev}</td>}
                      </tr>
                    </React.Fragment>
                  );
                })}

                {/* Total */}
                <tr className="bg-[#0a2a5a] text-white text-xs font-bold">
                  <td className="px-3 py-3 text-center" colSpan={2}>TOTAL</td>
                  {showCol('llamadas')           && <td className="px-3 py-3 text-center">{fmtNum(totals.llamadas)}</td>}
                  {showCol('minutos')            && <td className="px-3 py-3 text-center">{fmtNum(totals.minutos)}</td>}
                  {showCol('gasto-usd')          && <td className="px-3 py-3 text-center">{fmtUSD(totals.gastoUSD)}</td>}
                  {showCol('gasto-eur')          && <td className="px-3 py-3 text-center">{fmtEUR(totals.gastoEUR)}</td>}
                  {showCol('telefonia')          && <td className="px-3 py-3 text-center">{totals.telefonia > 0 ? fmtEUR(totals.telefonia) : <span className="opacity-50">—</span>}</td>}
                  {showCol('placas-por-fecha')   && <td className="px-3 py-3 text-center border-l-2 border-blue-400/40">{totals.placas_pf}</td>}
                  {showCol('baterias-por-fecha') && <td className="px-3 py-3 text-center">{totals.baterias_pf}</td>}
                  {showCol('total-agendado')     && <td className="px-3 py-3 text-center">{totals.placas_pf + totals.baterias_pf}</td>}
                  {showCol('confirmadas')        && <td className="px-3 py-3 text-center">{totals.agendas_pf}</td>}
                  {showCol('placas-generadas')   && <td className="px-3 py-3 text-center border-l-2 border-blue-400/40">{totals.placas_gen}</td>}
                  {showCol('baterias-generadas') && <td className="px-3 py-3 text-center">{totals.baterias_gen}</td>}
                  {showCol('total-captado')      && <td className="px-3 py-3 text-center">{totals.placas_gen + totals.baterias_gen}</td>}
                  {showCol('citas-revisadas')    && <td className="px-3 py-3 text-center">{totals.citas_rev}</td>}
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

    </div>
  );
}
