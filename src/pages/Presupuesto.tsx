import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  ChevronLeft, ChevronRight, Edit2, Loader2,
  DollarSign, Euro, Phone, Users, TrendingUp, BarChart3,
  RefreshCw, Download,
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';

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
  isWeekend: boolean;
  weekLabel: string;
}

interface WeekGroup {
  label: string;
  rows: DayRow[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function checkIsWeekend(dateStr: string): boolean {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  return day === 0 || day === 6;
}

function getDaysInMonth(year: number, month: number): string[] {
  const today = new Date();
  const totalDays = new Date(year, month, 0).getDate();
  const isCurrentMonth =
    year === today.getFullYear() && month === today.getMonth() + 1;
  const limit = isCurrentMonth ? today.getDate() : totalDays;

  const days: string[] = [];
  for (let d = 1; d <= limit; d++) {
    days.push(
      `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    );
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
  let counter = 0;
  let lastISO = -1;
  for (const day of days) {
    const iso = getISOWeek(day);
    if (iso !== lastISO) {
      counter++;
      lastISO = iso;
    }
    map[day] = `Semana ${counter}`;
  }
  return map;
}

function fmtEUR(v: number): string {
  return v.toLocaleString('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtUSD(v: number): string {
  return v.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtNum(v: number): string {
  return v.toLocaleString('es-ES');
}

function fmtDate(dia: string): string {
  return dia.split('-').reverse().join('/');
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// ─── Component ────────────────────────────────────────────────────────────────

interface PresupuestoProps {
  onNavigate: (page: string) => void;
}

export function Presupuesto({ onNavigate }: PresupuestoProps) {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());

  // Exchange rate
  const [exchangeRate, setExchangeRate] = useState(0.92);
  const [rateDate, setRateDate] = useState<string | null>(null);
  const [fetchingRate, setFetchingRate] = useState(false);
  const [rateFallback, setRateFallback] = useState(false);
  const [rateApiError, setRateApiError] = useState<string | null>(null);
  const [rateSource, setRateSource] = useState<string>('');

  // Data
  const [callStats, setCallStats] = useState<CallStat[]>([]);
  const [agendaStats, setAgendaStats] = useState<AgendaStat[]>([]);
  const [telefoniaData, setTelefoniaData] = useState<TelefoniaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cards visibility (se resetea al salir de la página)
  const [hiddenCards, setHiddenCards] = useState<Set<string>>(new Set());

  // Inline telefonía editing
  const [editingDia, setEditingDia] = useState<string | null>(null);
  const [editingVal, setEditingVal] = useState('');
  const [savingDia, setSavingDia] = useState<string | null>(null);

  // ── Month navigation ────────────────────────────────────────────────────────

  const isCurrentMonth =
    year === today.getFullYear() && month === today.getMonth() + 1;

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
    setLoading(true);
    setError(null);
    const pad = (n: number) => String(n).padStart(2, '0');
    const firstDay = `${year}-${pad(month)}-01`;
    const lastDay = `${year}-${pad(month)}-${new Date(year, month, 0).getDate()}`;

    const [callRes, agendaRes, telRes] = await Promise.all([
      supabase
        .from('mas_sol_call_stats')
        .select('dia, num_llamadas, minutos, gasto_total')
        .gte('dia', firstDay)
        .lte('dia', lastDay)
        .order('dia'),
      supabase
        .from('mas_sol_agenda_stats')
        .select('dia, agendas, captadas')
        .gte('dia', firstDay)
        .lte('dia', lastDay)
        .order('dia'),
      supabase
        .from('mas_sol_daily_telefonia')
        .select('dia, gasto_telefonia')
        .gte('dia', firstDay)
        .lte('dia', lastDay),
    ]);

    const errors: string[] = [];
    if (callRes.error) errors.push(`call_stats: ${callRes.error.message}`);
    if (agendaRes.error) errors.push(`agenda_stats: ${agendaRes.error.message}`);
    if (telRes.error) errors.push(`daily_telefonia: ${telRes.error.message}`);
    if (errors.length > 0) setError(errors.join(' | '));

    setCallStats(callRes.data ?? []);
    setAgendaStats(agendaRes.data ?? []);
    setTelefoniaData(telRes.data ?? []);

    setLoading(false);
  }, [month, year]);

  // ── Fetch exchange rate from Frankfurter API ────────────────────────────────

  const fetchExchangeRate = useCallback(async () => {
    setFetchingRate(true);
    setRateFallback(false);
    setRateApiError(null);

    // Normaliza cualquier string de fecha a YYYY-MM-DD
    const parseDate = (raw: string): string => {
      if (!raw) return '';
      // Si ya es ISO (2026-06-05) lo devuelve tal cual
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
      // Si es formato RFC ("Fri, 05 Jun 2026 ...") lo parsea
      const d = new Date(raw);
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
      return raw.slice(0, 10);
    };

    // APIs en cascada — se prueba en orden hasta que una responde
    const APIS = [
      {
        name: 'ExchangeRate-API',
        url: 'https://open.er-api.com/v6/latest/USD',
        extract: (d: any): number => d.rates?.EUR,
        date: (d: any): string => parseDate(d.time_last_update_utc ?? ''),
      },
      {
        name: 'Frankfurter (BCE)',
        url: 'https://api.frankfurter.app/latest?from=USD&to=EUR',
        extract: (d: any): number => d.rates?.EUR,
        date: (d: any): string => parseDate(d.date ?? ''),
      },
      {
        name: 'Currency-API CDN',
        url: 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',
        extract: (d: any): number => d.usd?.eur,
        date: (d: any): string => parseDate(d.date ?? ''),
      },
    ];

    let lastError = '';
    for (const api of APIS) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(api.url, { signal: controller.signal });
        clearTimeout(timeout);

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const rate = api.extract(data);
        if (!rate || isNaN(rate)) throw new Error('Rate no encontrado');

        setExchangeRate(rate);
        setRateDate(api.date(data));
        setRateSource(api.name);

        supabase.from('mas_sol_config').upsert({
          clave: 'tipo_cambio_usd_eur',
          valor: String(rate),
          updated_at: new Date().toISOString(),
        });
        setFetchingRate(false);
        return;
      } catch (err: any) {
        lastError = err?.name === 'AbortError' ? 'Timeout' : (err?.message ?? 'error');
      }
    }

    // Todas las APIs fallaron — usar Supabase como último recurso
    setRateApiError(lastError);
    setRateFallback(true);
    const { data } = await supabase
      .from('mas_sol_config')
      .select('valor')
      .eq('clave', 'tipo_cambio_usd_eur')
      .maybeSingle();
    if (data) {
      const r = parseFloat(data.valor);
      if (!isNaN(r) && r > 0) setExchangeRate(r);
    }
    setFetchingRate(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => { fetchExchangeRate(); }, [fetchExchangeRate]);

  // ── Save exchange rate ──────────────────────────────────────────────────────

  // ── Save telefonía ──────────────────────────────────────────────────────────

  const saveTelefonia = async (dia: string) => {
    if (savingDia) return;
    setSavingDia(dia);

    const raw = editingVal.trim().replace(',', '.');
    const val = parseFloat(raw);

    if (raw === '' || isNaN(val)) {
      await supabase.from('mas_sol_daily_telefonia').delete().eq('dia', dia);
      setTelefoniaData(prev => prev.filter(r => r.dia !== dia));
    } else {
      await supabase.from('mas_sol_daily_telefonia').upsert({
        dia,
        gasto_telefonia: val,
        updated_at: new Date().toISOString(),
      });
      setTelefoniaData(prev => {
        const filtered = prev.filter(r => r.dia !== dia);
        return [...filtered, { dia, gasto_telefonia: val }];
      });
    }

    setSavingDia(null);
    setEditingDia(null);
    setEditingVal('');
  };

  const startEditTelefonia = (dia: string, current: number | null) => {
    setEditingDia(dia);
    setEditingVal(current !== null ? String(current) : '');
  };

  // ── Build rows ──────────────────────────────────────────────────────────────

  const rows = useMemo((): DayRow[] => {
    const days = getDaysInMonth(year, month);
    const weekLabels = assignWeekLabels(days);

    const callMap: Record<string, CallStat> = {};
    for (const r of callStats) callMap[r.dia.slice(0, 10)] = r;

    const agendaMap: Record<string, AgendaStat> = {};
    for (const r of agendaStats) agendaMap[r.dia.slice(0, 10)] = r;

    const telMap: Record<string, number> = {};
    for (const r of telefoniaData) telMap[r.dia.slice(0, 10)] = r.gasto_telefonia;

    return days.map(dia => {
      const call = callMap[dia];
      const agenda = agendaMap[dia];
      const gastoUSD = call ? parseFloat(call.gasto_total) : 0;

      return {
        dia,
        llamadas: call ? call.num_llamadas : 0,
        minutos: call ? parseFloat(call.minutos) : 0,
        gastoUSD,
        gastoEUR: gastoUSD * exchangeRate,
        telefonia: telMap[dia] !== undefined ? telMap[dia] : null,
        agendas: agenda ? agenda.agendas : 0,
        captadas: agenda ? agenda.captadas : 0,
        isWeekend: checkIsWeekend(dia),
        weekLabel: weekLabels[dia],
      };
    });
  }, [callStats, agendaStats, telefoniaData, exchangeRate, month, year]);

  const weekGroups = useMemo((): WeekGroup[] => {
    const groups: WeekGroup[] = [];
    let cur: WeekGroup | null = null;
    for (const row of rows) {
      if (!cur || cur.label !== row.weekLabel) {
        if (cur) groups.push(cur);
        cur = { label: row.weekLabel, rows: [row] };
      } else {
        cur.rows.push(row);
      }
    }
    if (cur) groups.push(cur);
    return groups;
  }, [rows]);

  const totals = useMemo(() => {
    const gastoUSD = rows.reduce((s, r) => s + r.gastoUSD, 0);
    const gastoEUR = rows.reduce((s, r) => s + r.gastoEUR, 0);
    const telefonia = rows.reduce((s, r) => s + (r.telefonia ?? 0), 0);
    const agendas = rows.reduce((s, r) => s + r.agendas, 0);
    const captadas = rows.reduce((s, r) => s + r.captadas, 0);
    const costoTotal = gastoEUR + telefonia;

    // Media = promedio de los coste/día individuales sobre TODOS los días del período
    // (días sin agendas aportan 0 pero cuentan en el denominador — igual que la Excel)
    const sumDiarioAgenda = rows.reduce((s, r) =>
      s + (r.agendas > 0 ? (r.gastoEUR + (r.telefonia ?? 0)) / r.agendas : 0), 0);
    const sumDiarioCaptada = rows.reduce((s, r) =>
      s + (r.captadas > 0 ? (r.gastoEUR + (r.telefonia ?? 0)) / r.captadas : 0), 0);

    return {
      gastoUSD,
      gastoEUR,
      telefonia,
      agendas,
      captadas,
      costoTotal,
      mediaAgenda: agendas > 0 && rows.length > 0 ? sumDiarioAgenda / rows.length : null,
      mediaCaptada: captadas > 0 && rows.length > 0 ? sumDiarioCaptada / rows.length : null,
      llamadas: rows.reduce((s, r) => s + r.llamadas, 0),
      minutos: rows.reduce((s, r) => s + r.minutos, 0),
    };
  }, [rows]);

  function weekSub(weekRows: DayRow[]) {
    const gastoUSD = weekRows.reduce((s, r) => s + r.gastoUSD, 0);
    const gastoEUR = weekRows.reduce((s, r) => s + r.gastoEUR, 0);
    const telefonia = weekRows.reduce((s, r) => s + (r.telefonia ?? 0), 0);
    const agendas = weekRows.reduce((s, r) => s + r.agendas, 0);
    const captadas = weekRows.reduce((s, r) => s + r.captadas, 0);
    // Solo costos de días que generaron agendas/captadas
    const costoEnDiasConAgendas = weekRows
      .filter(r => r.agendas > 0)
      .reduce((s, r) => s + r.gastoEUR + (r.telefonia ?? 0), 0);
    const costoEnDiasConCaptadas = weekRows
      .filter(r => r.captadas > 0)
      .reduce((s, r) => s + r.gastoEUR + (r.telefonia ?? 0), 0);
    return {
      gastoUSD, gastoEUR, telefonia, agendas, captadas,
      llamadas: weekRows.reduce((s, r) => s + r.llamadas, 0),
      minutos: weekRows.reduce((s, r) => s + r.minutos, 0),
      mediaAgenda: agendas > 0 ? costoEnDiasConAgendas / agendas : null,
      mediaCaptada: captadas > 0 ? costoEnDiasConCaptadas / captadas : null,
    };
  }

  // ── Export CSV ──────────────────────────────────────────────────────────────

  const exportCSV = useCallback(() => {
    const S = ';'; // separador europeo — abre bien en Excel español
    const n = (v: number, dec = 2) => v.toFixed(dec).replace('.', ',');
    const lines: string[] = [];

    // Cabecera del archivo
    lines.push(`uMindsIA — Costes de llamadas — ${MONTH_NAMES[month - 1]} ${year}`);
    lines.push(`Tipo de cambio USD/EUR${S}${n(exchangeRate, 4)}`);
    lines.push('');

    // Encabezados de columna
    lines.push([
      'Semana', 'Fecha', 'Llamadas', 'Minutos',
      'Gasto IA ($)', 'Gasto IA (€)', 'Gasto Telefonía',
      'Agendas', 'Captadas', 'Coste/Agenda (€)', 'Coste/Captada (€)',
    ].join(S));

    // Filas por semana
    for (const group of weekGroups) {
      group.rows.forEach((row, idx) => {
        const totalCosto = row.gastoEUR + (row.telefonia ?? 0);
        const cpa = row.agendas > 0 ? totalCosto / row.agendas : null;
        const cpc = row.captadas > 0 ? totalCosto / row.captadas : null;
        lines.push([
          idx === 0 ? group.label : '',
          fmtDate(row.dia),
          row.llamadas,
          row.minutos,
          n(row.gastoUSD),
          n(row.gastoEUR),
          row.telefonia !== null ? n(row.telefonia) : '',
          row.agendas || '',
          row.captadas || '',
          cpa !== null ? n(cpa) : '',
          cpc !== null ? n(cpc) : '',
        ].join(S));
      });

      // Subtotal semana
      const sub = weekSub(group.rows);
      lines.push([
        'SUBTOTAL', group.label,
        sub.llamadas, sub.minutos,
        n(sub.gastoUSD), n(sub.gastoEUR),
        sub.telefonia > 0 ? n(sub.telefonia) : '',
        sub.agendas, sub.captadas,
        sub.mediaAgenda !== null ? n(sub.mediaAgenda) : '',
        sub.mediaCaptada !== null ? n(sub.mediaCaptada) : '',
      ].join(S));
    }

    // Total general
    lines.push([
      'TOTAL', '',
      totals.llamadas, totals.minutos,
      n(totals.gastoUSD), n(totals.gastoEUR),
      totals.telefonia > 0 ? n(totals.telefonia) : '',
      totals.agendas, totals.captadas,
      totals.mediaAgenda !== null ? n(totals.mediaAgenda) : '',
      totals.mediaCaptada !== null ? n(totals.mediaCaptada) : '',
    ].join(S));

    // Resumen final
    lines.push('');
    lines.push([
      'Gasto $ Total', 'Gasto € Total', 'Total Telefonía', 'Gasto Total (€)',
      'Total Agendas', 'Total Captadas', 'Media €/Agenda', 'Media €/Captada',
    ].join(S));
    lines.push([
      n(totals.gastoUSD), n(totals.gastoEUR),
      n(totals.telefonia), n(totals.costoTotal),
      totals.agendas, totals.captadas,
      totals.mediaAgenda !== null ? n(totals.mediaAgenda) : '',
      totals.mediaCaptada !== null ? n(totals.mediaCaptada) : '',
    ].join(S));

    // Generar descarga con BOM para que Excel lo abra bien
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

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Presupuesto</h1>
          <p className="text-sm text-gray-500 mt-1">
            Costes de llamadas · {MONTH_NAMES[month - 1]} {year}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={goPrev}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold w-40 text-center">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button
            onClick={goNext}
            disabled={isCurrentMonth}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={exportCSV}
            disabled={loading || rows.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed ml-2"
          >
            <Download className="w-4 h-4" />
            Exportar
          </button>

          {/* ── Tipo de cambio compacto con tooltip ─────────────────────────── */}
          <div className="relative group ml-1">
            <button
              onClick={fetchExchangeRate}
              disabled={fetchingRate}
              className={`flex items-center gap-1 px-2.5 py-2 rounded-lg border text-xs font-mono transition-colors ${
                rateFallback
                  ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                  : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              {fetchingRate
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <RefreshCw className="w-3 h-3" />}
              {rateFallback ? '⚠' : ''}
              1$ = {exchangeRate}€
            </button>

            {/* Tooltip al hacer hover */}
            <div className="absolute right-0 top-full mt-1.5 z-20 w-64 rounded-lg border border-gray-200 bg-white shadow-lg px-3 py-2.5 text-xs text-gray-600 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
              <p className="font-semibold text-gray-800 mb-1">Tipo de cambio USD → EUR</p>
              <p><span className="text-gray-400">Tasa:</span> {exchangeRate}</p>
              {rateDate && <p><span className="text-gray-400">Fecha:</span> {rateDate}</p>}
              {rateSource && !rateFallback && <p><span className="text-gray-400">Fuente:</span> {rateSource}</p>}
              {rateFallback && (
                <p className="text-amber-600 mt-1">⚠ APIs no disponibles — usando último valor guardado{rateApiError ? ` (${rateApiError})` : ''}</p>
              )}
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
              <button
                onClick={() => setHiddenCards(new Set())}
                className="text-xs text-gray-400 hover:text-gray-600 underline transition-colors"
              >
                Mostrar todas las cards ({hiddenCards.size} oculta{hiddenCards.size !== 1 ? 's' : ''})
              </button>
            </div>
          )}
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${8 - hiddenCards.size}, 1fr)` }}>
            {[
              {
                key: 'gasto-usd',
                icon: <DollarSign className="w-4 h-4 text-green-500" />,
                label: 'Gasto IA ($)',
                value: fmtUSD(totals.gastoUSD),
                accent: false,
              },
              {
                key: 'gasto-eur',
                icon: <Euro className="w-4 h-4 text-blue-500" />,
                label: 'Gasto IA (€)',
                value: fmtEUR(totals.gastoEUR),
                accent: false,
              },
              {
                key: 'telefonia',
                icon: <Phone className="w-4 h-4 text-purple-500" />,
                label: 'Total Telefonía',
                value: totals.telefonia > 0 ? fmtEUR(totals.telefonia) : '—',
                accent: false,
              },
              {
                key: 'gasto-total',
                icon: <BarChart3 className="w-4 h-4 text-orange-500" />,
                label: 'Gasto Total (€)',
                value: fmtEUR(totals.costoTotal),
                accent: true,
              },
              {
                key: 'agendas',
                icon: <Users className="w-4 h-4 text-teal-500" />,
                label: 'Total Agendas',
                value: String(totals.agendas),
                accent: false,
              },
              {
                key: 'captadas',
                icon: <TrendingUp className="w-4 h-4 text-indigo-500" />,
                label: 'Total Captadas',
                value: String(totals.captadas),
                accent: false,
              },
              {
                key: 'media-agenda',
                icon: <Euro className="w-4 h-4 text-rose-500" />,
                label: 'Media €/Agenda',
                value: totals.mediaAgenda !== null ? fmtEUR(totals.mediaAgenda) : '—',
                accent: false,
              },
              {
                key: 'media-captada',
                icon: <Euro className="w-4 h-4 text-amber-500" />,
                label: 'Media €/Captada',
                value: totals.mediaCaptada !== null ? fmtEUR(totals.mediaCaptada) : '—',
                accent: false,
              },
            ]
              .filter(card => !hiddenCards.has(card.key))
              .map(card => (
                <div key={card.key} className="relative group">
                  <button
                    onClick={() => setHiddenCards(prev => new Set(prev).add(card.key))}
                    className={`absolute top-1.5 right-1.5 z-10 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${card.accent ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600'}`}
                    title="Ocultar card"
                  >
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                  <Card className={card.accent ? 'border-[#0a2a5a] bg-[#0a2a5a] text-white shadow-md' : ''}>
                    <CardContent className="pt-4 pb-4 px-4">
                      <div className="flex items-center gap-1.5 mb-1">
                        {card.icon}
                        <span className={`text-[10px] font-medium uppercase tracking-wide ${card.accent ? 'text-blue-200' : 'text-gray-500'}`}>
                          {card.label}
                        </span>
                      </div>
                      <div className={`text-base font-bold text-center ${card.accent ? 'text-white' : 'text-gray-900'}`}>
                        {card.value}
                      </div>
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
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span className="text-sm">Cargando datos…</span>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
          <table className="min-w-full text-sm border-collapse">

            {/* ── Column headers ─────────────────────────────────────────── */}
            <thead>
              <tr className="bg-[#0a2a5a] text-white text-xs">
                <th className="px-3 py-3 text-left font-semibold whitespace-nowrap w-20"></th>
                <th className="px-3 py-3 text-center font-semibold whitespace-nowrap">Fecha</th>
                <th className="px-3 py-3 text-center font-semibold whitespace-nowrap">Llamadas</th>
                <th className="px-3 py-3 text-center font-semibold whitespace-nowrap">Minutos</th>
                <th className="px-3 py-3 text-center font-semibold whitespace-nowrap">Gasto IA ($)</th>
                <th className="px-3 py-3 text-center font-semibold whitespace-nowrap">Gasto IA (€)</th>
                <th className="px-3 py-3 text-center font-semibold whitespace-nowrap">
                  Gasto Telefonía
                  <span className="ml-1 text-blue-300 font-normal">(clic para editar)</span>
                </th>
                <th className="px-3 py-3 text-center font-semibold whitespace-nowrap">Agendas</th>
                <th className="px-3 py-3 text-center font-semibold whitespace-nowrap">Captadas</th>
                <th className="px-3 py-3 text-center font-semibold whitespace-nowrap">Coste/Agenda (€)</th>
                <th className="px-3 py-3 text-center font-semibold whitespace-nowrap">Coste/Captada (€)</th>
              </tr>
            </thead>

            <tbody>
              {weekGroups.map(group => {
                const sub = weekSub(group.rows);

                return (
                  <React.Fragment key={group.label}>
                    {/* ── Day rows ────────────────────────────────────────── */}
                    {group.rows.map((row, idx) => {
                      const totalCostoEUR = row.gastoEUR + (row.telefonia ?? 0);
                      const costePorAgenda =
                        row.agendas > 0 ? totalCostoEUR / row.agendas : null;
                      const costePorCaptada =
                        row.captadas > 0 ? totalCostoEUR / row.captadas : null;
                      const isEditing = editingDia === row.dia;
                      const isSaving = savingDia === row.dia;

                      const bgClass = row.isWeekend
                        ? 'bg-gray-50'
                        : 'bg-white hover:bg-orange-50';

                      return (
                        <tr
                          key={row.dia}
                          className={`border-b border-gray-100 transition-colors ${bgClass}`}
                        >
                          {/* Week label cell — only rendered for the first row of each week */}
                          {idx === 0 ? (
                            <td
                              rowSpan={group.rows.length}
                              className="px-3 py-2 text-xs font-bold text-[#0a2a5a] bg-[#eef2fb] border-r border-[#c8d4f0] align-middle text-center whitespace-nowrap"
                            >
                              {group.label}
                            </td>
                          ) : null}

                          <td className={`px-3 py-2 text-center font-medium whitespace-nowrap ${row.isWeekend ? 'text-gray-400' : 'text-gray-700'}`}>
                            {fmtDate(row.dia)}
                          </td>
                          <td className={`px-3 py-2 text-center ${row.isWeekend ? 'text-gray-400' : ''}`}>
                            {row.llamadas > 0 ? fmtNum(row.llamadas) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className={`px-3 py-2 text-center ${row.isWeekend ? 'text-gray-400' : ''}`}>
                            {row.minutos > 0 ? fmtNum(row.minutos) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className={`px-3 py-2 text-center ${row.isWeekend ? 'text-gray-400' : ''}`}>
                            {row.gastoUSD > 0 ? fmtUSD(row.gastoUSD) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className={`px-3 py-2 text-center ${row.isWeekend ? 'text-gray-400' : ''}`}>
                            {row.gastoEUR > 0 ? fmtEUR(row.gastoEUR) : <span className="text-gray-300">—</span>}
                          </td>

                          {/* ── Telefonía editable cell ─────────────────── */}
                          <td className="px-2 py-1.5 text-center">
                            {isEditing ? (
                              <div className="flex items-center justify-center gap-1">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="0.00"
                                  value={editingVal}
                                  onChange={e => setEditingVal(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') saveTelefonia(row.dia);
                                    if (e.key === 'Escape') {
                                      setEditingDia(null);
                                      setEditingVal('');
                                    }
                                  }}
                                  onBlur={() => saveTelefonia(row.dia)}
                                  className="w-28 text-center text-xs border border-blue-400 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                  autoFocus
                                />
                              </div>
                            ) : (
                              <button
                                onClick={() => startEditTelefonia(row.dia, row.telefonia)}
                                className="group inline-flex items-center justify-center gap-1 w-full rounded px-2 py-1 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                              >
                                {isSaving ? (
                                  <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                                ) : row.telefonia !== null ? (
                                  <>
                                    <span className={row.isWeekend ? 'text-gray-400' : 'text-gray-700'}>
                                      {fmtEUR(row.telefonia)}
                                    </span>
                                    <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-40 flex-shrink-0" />
                                  </>
                                ) : (
                                  <>
                                    <span className="text-gray-300">—</span>
                                    <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-40 flex-shrink-0" />
                                  </>
                                )}
                              </button>
                            )}
                          </td>

                          <td className={`px-3 py-2 text-center ${row.isWeekend ? 'text-gray-400' : ''}`}>
                            {row.agendas > 0 ? row.agendas : <span className="text-gray-300">—</span>}
                          </td>
                          <td className={`px-3 py-2 text-center ${row.isWeekend ? 'text-gray-400' : ''}`}>
                            {row.captadas > 0 ? row.captadas : <span className="text-gray-300">—</span>}
                          </td>
                          <td className={`px-3 py-2 text-center font-medium ${row.isWeekend ? 'text-gray-400' : 'text-gray-700'}`}>
                            {costePorAgenda !== null ? fmtEUR(costePorAgenda) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className={`px-3 py-2 text-center font-medium ${row.isWeekend ? 'text-gray-400' : 'text-gray-700'}`}>
                            {costePorCaptada !== null ? fmtEUR(costePorCaptada) : <span className="text-gray-300">—</span>}
                          </td>
                        </tr>
                      );
                    })}

                    {/* ── Week subtotal row ───────────────────────────────── */}
                    <tr className="bg-[#dde6f7] border-b-2 border-[#a8bce8] text-[#0a2a5a] text-xs font-semibold">
                      <td className="px-3 py-2 text-center text-[10px] font-bold tracking-wide uppercase text-[#0a2a5a]/60">
                        subtotal
                      </td>
                      <td className="px-3 py-2 text-center">{group.label}</td>
                      <td className="px-3 py-2 text-center">{fmtNum(sub.llamadas)}</td>
                      <td className="px-3 py-2 text-center">{fmtNum(sub.minutos)}</td>
                      <td className="px-3 py-2 text-center">{fmtUSD(sub.gastoUSD)}</td>
                      <td className="px-3 py-2 text-center">{fmtEUR(sub.gastoEUR)}</td>
                      <td className="px-3 py-2 text-center">
                        {sub.telefonia > 0 ? fmtEUR(sub.telefonia) : <span className="opacity-40">—</span>}
                      </td>
                      <td className="px-3 py-2 text-center">{sub.agendas}</td>
                      <td className="px-3 py-2 text-center">{sub.captadas}</td>
                      <td className="px-3 py-2 text-center">
                        {sub.mediaAgenda !== null ? fmtEUR(sub.mediaAgenda) : <span className="opacity-40">—</span>}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {sub.mediaCaptada !== null ? fmtEUR(sub.mediaCaptada) : <span className="opacity-40">—</span>}
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}

              {/* ── Grand total row ─────────────────────────────────────────── */}
              <tr className="bg-[#0a2a5a] text-white text-xs font-bold">
                <td className="px-3 py-3 text-center" colSpan={2}>TOTAL</td>
                <td className="px-3 py-3 text-center">{fmtNum(totals.llamadas)}</td>
                <td className="px-3 py-3 text-center">{fmtNum(totals.minutos)}</td>
                <td className="px-3 py-3 text-center">{fmtUSD(totals.gastoUSD)}</td>
                <td className="px-3 py-3 text-center">{fmtEUR(totals.gastoEUR)}</td>
                <td className="px-3 py-3 text-center">
                  {totals.telefonia > 0 ? fmtEUR(totals.telefonia) : <span className="opacity-50">—</span>}
                </td>
                <td className="px-3 py-3 text-center">{totals.agendas}</td>
                <td className="px-3 py-3 text-center">{totals.captadas}</td>
                <td className="px-3 py-3 text-center">
                  {totals.mediaAgenda !== null ? fmtEUR(totals.mediaAgenda) : <span className="opacity-50">—</span>}
                </td>
                <td className="px-3 py-3 text-center">
                  {totals.mediaCaptada !== null ? fmtEUR(totals.mediaCaptada) : <span className="opacity-50">—</span>}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
