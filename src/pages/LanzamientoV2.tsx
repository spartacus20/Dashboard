import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  RefreshCw,
  CalendarDays,
  Calendar,
  Lock,
  Phone,
  PhoneCall,
  MousePointer,
  Link as LinkIcon,
  Activity,
  Download,
  X,
} from 'lucide-react';
import {
  fetchLanzamientoMetricsCustom,
  fetchAsistenciaFunnelMetrics,
  fetchAsistenciaClicksByHour,
  fetchLanzamientoCallsByHour,
} from '../api';
import { COUNTRY_FLAGS } from '../lib/constants';
import { BASE_URL, getClientId } from '../services/api/config';
import { authedFetch } from '../services/api/http';
import { canAccessLanzamientoV2, getUserTimezone } from '../lib/supabase';
import { getPeriodRange, formatMadridDateYYYYMMDD } from '../lib/dateUtils';
import { EChart, ensureWorldMap, type EChartsOption } from '../components/charts/EChart';

// ─── Tipos (mismos datos que la página Lanzamiento original) ──────────────────
interface MetricByCountry {
  pais: string;
  total_llamadas: number;
  llamadas_contestadas: number;
  llamadas_fallidas: number;
  enlaces_enviados: number;
  clicks_totales: number;
  no_llamar: number;
}

interface LanzamientoMetrics {
  total_llamadas: number;
  llamadas_contestadas: number;
  llamadas_fallidas: number;
  total_enlaces_enviados: number;
  total_clicks_totales: number;
  total_no_llamar: number;
  porPais: MetricByCountry[];
}

// ─── Design tokens (del mockup "Dashboard Lanzamientos.dc.html") ──────────────
const FONT_SANS = "'IBM Plex Sans', system-ui, -apple-system, sans-serif";
const FONT_MONO = "'IBM Plex Mono', ui-monospace, monospace";
const NAVY = '#0F1E3D';
const MUTED = '#7C8BA5';
const RED = '#EF4444';
const GREEN = '#16A34A';
const BORDER = '#E7ECF3';

// Fallback (solo si el endpoint de llamadas-por-hora aún no está desplegado).
// Cubre las horas 08:00–20:00. Se marca con el badge "⚠ Datos de ejemplo".
const PLACEHOLDER_CALLS_0800_2000 = [1, 0, 3, 2, 655, 499, 8, 446, 5, 57, 2740, 509, 2];

const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`;

// Mapeo nombre de país (ES, como llega del backend) → nombre en el mapa mundial
// de ECharts (EN). Países sin entrada no se pintan en el mapa.
const COUNTRY_EN: Record<string, string> = {
  España: 'Spain', Argentina: 'Argentina', México: 'Mexico', Colombia: 'Colombia',
  Chile: 'Chile', Perú: 'Peru', Brasil: 'Brazil', Venezuela: 'Venezuela',
  Ecuador: 'Ecuador', 'República Dominicana': 'Dominican Rep.', Uruguay: 'Uruguay',
  Paraguay: 'Paraguay', Bolivia: 'Bolivia', 'Costa Rica': 'Costa Rica', Panamá: 'Panama',
  Nicaragua: 'Nicaragua', 'El Salvador': 'El Salvador', Guatemala: 'Guatemala',
  Honduras: 'Honduras', Cuba: 'Cuba', Haití: 'Haiti', 'USA / Canadá': 'United States',
  'Reino Unido': 'United Kingdom', Alemania: 'Germany', Francia: 'France', Italia: 'Italy',
  Irlanda: 'Ireland', Portugal: 'Portugal', 'Países Bajos': 'Netherlands', Bélgica: 'Belgium',
};

const isApplePlatform = () => {
  if (typeof navigator === 'undefined') return false;
  const p = navigator.platform || '';
  const ua = navigator.userAgent || '';
  return /Mac|iPhone|iPad|iPod/.test(p) || /Mac OS X/.test(ua);
};

const getFlag = (pais: string): string => (isApplePlatform() ? COUNTRY_FLAGS[pais] ?? '' : '');

function hexToRgba(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

const nf = new Intl.NumberFormat('es-ES');
const fmt = (n: number) => nf.format(n || 0);
const calcPct = (value: number, total: number) => (total > 0 ? (value / total) * 100 : 0);

// Degradado vertical de área (formato objeto que ECharts acepta sin echarts.graphic).
const areaGradient = (color: string): EChartsOption => ({
  type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
  colorStops: [
    { offset: 0, color: hexToRgba(color, 0.28) },
    { offset: 1, color: hexToRgba(color, 0.02) },
  ],
}) as unknown as EChartsOption;

function processApiData(apiData: any): LanzamientoMetrics {
  const byCountry = Array.isArray(apiData.metrics_by_country) ? apiData.metrics_by_country : [];
  return {
    total_llamadas: apiData.total_llamadas ?? 0,
    llamadas_contestadas: apiData.llamadas_contestadas ?? 0,
    llamadas_fallidas: apiData.llamadas_fallidas ?? 0,
    total_enlaces_enviados: apiData.total_enlaces_enviados ?? 0,
    total_clicks_totales: apiData.total_clicks_totales ?? 0,
    total_no_llamar: apiData.total_no_llamar ?? 0,
    porPais: byCountry.map((item: any) => ({
      pais: item.pais ?? 'no_detectado',
      total_llamadas: parseInt(item.total_llamadas, 10) || 0,
      llamadas_contestadas: parseInt(item.llamadas_contestadas, 10) || 0,
      llamadas_fallidas: parseInt(item.llamadas_fallidas, 10) || 0,
      enlaces_enviados: parseInt(item.enlaces_enviados, 10) || 0,
      clicks_totales: parseInt(item.clicks_totales, 10) || 0,
      no_llamar: parseInt(item.no_llamar, 10) || 0,
    })),
  };
}

const emptyHours = (): number[] => new Array(24).fill(0);

const LanzamientoV2: React.FC = () => {
  const [metrics, setMetrics] = useState<LanzamientoMetrics | null>(null);
  const [linksUnique, setLinksUnique] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'today' | 'custom'>('today');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [worldReady, setWorldReady] = useState(false);
  // Datos horarios (índice = hora local 0-23)
  const [callsByHour, setCallsByHour] = useState<number[]>(emptyHours);
  const [clicksByHour, setClicksByHour] = useState<number[]>(emptyHours);
  const [callsReal, setCallsReal] = useState(false); // false → serie de llamadas es placeholder
  const [showLinksModal, setShowLinksModal] = useState(false);
  const [showClicksModal, setShowClicksModal] = useState(false);
  const [loadingExport, setLoadingExport] = useState(false);
  const [loadingExportLinks, setLoadingExportLinks] = useState(false);
  const reqRef = useRef(0);

  // Inyectar la fuente IBM Plex (una sola vez) para respetar el diseño.
  useEffect(() => {
    const id = 'ibm-plex-lanzamiento-v2';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap';
    document.head.appendChild(link);
  }, []);

  // Registrar el mapa mundial de ECharts.
  useEffect(() => {
    let alive = true;
    ensureWorldMap().then((ok) => { if (alive) setWorldReady(ok); });
    return () => { alive = false; };
  }, []);

  const load = async (period: 'today' | 'custom', cs?: string, ce?: string) => {
    reqRef.current += 1;
    const reqId = reqRef.current;

    // Rango tz-aware, misma lógica que el dashboard (getPeriodRange + zona del usuario).
    const tz = getUserTimezone();
    const range = getPeriodRange(period === 'today' ? 'today' : 'custom', {
      timezone: tz,
      customStart: cs,
      customEnd: ce,
    });
    if (!range) return; // custom sin fechas → no hacemos nada

    setLoading(true);
    setError(null);
    const { fechaInicio, fechaFin } = range;

    try {
      const apiData = await fetchLanzamientoMetricsCustom(fechaInicio, fechaFin);
      if (reqId !== reqRef.current) return;
      setMetrics(processApiData(apiData));

      // Enlaces únicos (funnel) — fechas bare en la zona del usuario. No bloquea la vista.
      const bareStart = period === 'today' ? formatMadridDateYYYYMMDD(new Date(), tz) : (cs || '');
      const bareEnd = period === 'today' ? formatMadridDateYYYYMMDD(new Date(), tz) : (ce || '');
      fetchAsistenciaFunnelMetrics({ fecha_inicio: bareStart, fecha_fin: bareEnd })
        .then((f) => { if (reqId === reqRef.current) setLinksUnique(f?.totals?.total_links_unique ?? null); })
        .catch(() => { if (reqId === reqRef.current) setLinksUnique(null); });

      // Series horarias: clicks (endpoint existente, tz-aware) + llamadas (endpoint nuevo).
      const [clicksRes, callsRes] = await Promise.allSettled([
        fetchAsistenciaClicksByHour(fechaInicio, fechaFin),
        fetchLanzamientoCallsByHour(fechaInicio, fechaFin),
      ]);
      if (reqId !== reqRef.current) return;

      const clicksArr = emptyHours();
      if (clicksRes.status === 'fulfilled') {
        clicksRes.value.forEach((r) => { if (r.hora >= 0 && r.hora < 24) clicksArr[r.hora] = r.clicks_totales || 0; });
      }

      const callsArr = emptyHours();
      let cReal = false;
      if (callsRes.status === 'fulfilled') {
        cReal = true;
        callsRes.value.forEach((r) => { if (r.hora >= 0 && r.hora < 24) callsArr[r.hora] = r.llamadas_efectivas || 0; });
      } else {
        // Fallback: el endpoint de llamadas-por-hora aún no está desplegado.
        PLACEHOLDER_CALLS_0800_2000.forEach((v, i) => { callsArr[8 + i] = v; });
      }

      setClicksByHour(clicksArr);
      setCallsByHour(callsArr);
      setCallsReal(cReal);
    } catch (err) {
      if (reqId !== reqRef.current) return;
      setError(err instanceof Error ? err.message : 'Error al cargar las métricas');
    } finally {
      if (reqId === reqRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (timeRange === 'today') load('today');
    // 'custom' se carga al pulsar "Aplicar".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange]);

  const handleRange = (range: 'today' | 'custom') => {
    reqRef.current += 1;
    setTimeRange(range);
    if (range === 'custom') {
      setShowDatePicker(true);
      const t = new Date();
      const weekAgo = new Date(t.getTime() - 7 * 24 * 60 * 60 * 1000);
      setEndDate(formatMadridDateYYYYMMDD(t, getUserTimezone()));
      setStartDate(formatMadridDateYYYYMMDD(weekAgo, getUserTimezone()));
    } else {
      setShowDatePicker(false);
      setStartDate('');
      setEndDate('');
    }
  };

  const applyCustom = () => {
    if (startDate && endDate) {
      if (startDate > endDate) {
        setError('La fecha de inicio debe ser anterior a la fecha de fin');
        return;
      }
      load('custom', startDate, endDate);
    }
  };

  const refresh = () => load(timeRange, startDate, endDate);

  // ─── Exportación CSV (Enlaces / Clicks), igual que la página Lanzamiento original ──
  const getExportDateRange = (): { fecha_inicio: string; fecha_fin: string } => {
    if (timeRange === 'today' || !startDate || !endDate) {
      const today = formatMadridDateYYYYMMDD(new Date(), getUserTimezone());
      return { fecha_inicio: today, fecha_fin: today };
    }
    return { fecha_inicio: startDate, fecha_fin: endDate };
  };

  const downloadCsv = (rows: any[], headers: string[], fields: string[], prefix: string, fi: string, ff: string) => {
    const escapeCsv = (val: any) => {
      if (val == null) return '';
      const str = String(val);
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const csvLines = [
      headers.map(escapeCsv).join(','),
      ...rows.map((row) => fields.map((f) => escapeCsv(row[f])).join(',')),
    ];
    const blob = new Blob(['﻿' + csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${prefix}_${fi}_${ff}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportClicksCSV = async () => {
    setLoadingExport(true);
    try {
      const { fecha_inicio, fecha_fin } = getExportDateRange();
      const response = await authedFetch(`${BASE_URL}/api/lanzamiento/asistencia/export`, {
        method: 'POST',
        body: JSON.stringify({ client_id: getClientId() || '', fecha_inicio: `${fecha_inicio}T00:00:00Z`, fecha_fin: `${fecha_fin}T23:59:59Z` }),
      });
      if (!response.ok) throw new Error('Error al obtener los datos de clicks');
      const json = await response.json();
      downloadCsv(
        json.data || [],
        ['ID', 'Nombre', 'Teléfono', 'Email', 'Call ID', 'Agent ID', 'Fecha y Hora', 'Campaña', 'Región', 'Workflow', 'Nombre Completo', 'Client ID'],
        ['id', 'name', 'phone_number', 'email', 'call_id', 'agent_id', 'created_at', 'campana', 'region', 'workflow', 'full_name', 'client_id'],
        'clicks', fecha_inicio, fecha_fin,
      );
      setShowClicksModal(false);
    } catch {
      /* silencio */
    } finally {
      setLoadingExport(false);
    }
  };

  const handleExportLinksCSV = async () => {
    setLoadingExportLinks(true);
    try {
      const { fecha_inicio, fecha_fin } = getExportDateRange();
      const response = await authedFetch(`${BASE_URL}/api/lanzamiento/links/export`, {
        method: 'POST',
        body: JSON.stringify({ client_id: getClientId() || '', fecha_inicio: `${fecha_inicio}T00:00:00Z`, fecha_fin: `${fecha_fin}T23:59:59Z` }),
      });
      if (!response.ok) throw new Error('Error al obtener los datos de enlaces');
      const json = await response.json();
      downloadCsv(
        json.data || [],
        ['ID', 'Nombre', 'Teléfono', 'Email', 'Call ID', 'Agent ID', 'Fecha y Hora', 'Campaña', 'Región', 'Client ID'],
        ['id', 'name', 'phone_number', 'email', 'call_id', 'agent_id', 'created_at', 'campana', 'region', 'client_id'],
        'enlaces_unicos', fecha_inicio, fecha_fin,
      );
      setShowLinksModal(false);
    } catch {
      /* silencio */
    } finally {
      setLoadingExportLinks(false);
    }
  };

  // ─── Métricas derivadas (datos reales) ──────────────────────────────────────
  const totalLlamadas = metrics?.total_llamadas ?? 0;
  const efectivas = metrics?.llamadas_contestadas ?? 0;
  const clicksAsistencia = metrics?.total_clicks_totales ?? 0;
  const enlaces = linksUnique ?? metrics?.total_enlaces_enviados ?? 0;
  const noDesean = metrics?.total_no_llamar ?? 0;
  const tasaAsistencia = Math.round(calcPct(clicksAsistencia, efectivas) * 10) / 10;

  const paisesOrdenados = useMemo(() => {
    if (!metrics?.porPais?.length) return [];
    return [...metrics.porPais].sort((a, b) => b.total_llamadas - a.total_llamadas);
  }, [metrics]);

  const topPaises = paisesOrdenados.slice(0, 6);
  const maxLlamadasPais = topPaises.length ? Math.max(1, ...topPaises.map((p) => p.total_llamadas)) : 1;

  // Ventana de horas a mostrar: rango con actividad (± 1h), o 08–20 si no hay datos.
  const { axisHours, callsSeries, clicksSeries } = useMemo(() => {
    const active: number[] = [];
    for (let h = 0; h < 24; h++) if ((callsByHour[h] || 0) > 0 || (clicksByHour[h] || 0) > 0) active.push(h);
    let lo = 8, hi = 20;
    if (active.length) { lo = Math.max(0, active[0] - 1); hi = Math.min(23, active[active.length - 1] + 1); }
    const hours: number[] = [];
    for (let h = lo; h <= hi; h++) hours.push(h);
    return {
      axisHours: hours,
      callsSeries: hours.map((h) => callsByHour[h] || 0),
      clicksSeries: hours.map((h) => clicksByHour[h] || 0),
    };
  }, [callsByHour, clicksByHour]);

  const topHoras = useMemo(() => {
    const arr = callsByHour.map((c, h) => ({ hora: h, calls: c || 0 })).filter((x) => x.calls > 0);
    const max = arr.length ? Math.max(...arr.map((a) => a.calls)) : 1;
    return arr.sort((a, b) => b.calls - a.calls).slice(0, 4).map((a) => ({ hora: hourLabel(a.hora), calls: a.calls, ratio: a.calls / max }));
  }, [callsByHour]);

  // ─── Opciones ECharts (colores del mockup) ──────────────────────────────────
  const comboOption: EChartsOption = useMemo(() => ({
    tooltip: { trigger: 'axis', backgroundColor: NAVY, borderWidth: 0, textStyle: { color: '#fff', fontFamily: FONT_MONO } },
    grid: { left: 44, right: 48, top: 20, bottom: 36 },
    xAxis: { type: 'category', data: axisHours.map(hourLabel), axisLine: { lineStyle: { color: '#E2E8F0' } }, axisTick: { show: false }, axisLabel: { color: '#64748B', fontFamily: FONT_MONO, fontSize: 11 } },
    yAxis: [
      { type: 'value', axisLabel: { color: '#94A3B8', fontFamily: FONT_MONO, fontSize: 10 }, splitLine: { lineStyle: { color: '#EEF2F7' } } },
      { type: 'value', axisLabel: { color: '#94A3B8', fontFamily: FONT_MONO, fontSize: 10 }, splitLine: { show: false } },
    ],
    series: [
      { name: 'Llamadas', type: 'line', smooth: true, data: callsSeries, yAxisIndex: 0, symbol: 'circle', symbolSize: 6, lineStyle: { color: RED, width: 3 }, itemStyle: { color: RED }, areaStyle: { color: areaGradient(RED) } },
      { name: 'Clicks', type: 'line', smooth: true, data: clicksSeries, yAxisIndex: 1, symbol: 'circle', symbolSize: 6, lineStyle: { color: GREEN, width: 3 }, itemStyle: { color: GREEN }, areaStyle: { color: areaGradient(GREEN) } },
    ],
  }), [axisHours, callsSeries, clicksSeries]);

  const gaugeOption: EChartsOption = useMemo(() => ({
    series: [{
      type: 'gauge', startAngle: 210, endAngle: -30, min: 0, max: 100, radius: '100%', center: ['50%', '62%'],
      progress: { show: true, width: 14, itemStyle: { color: GREEN } },
      axisLine: { lineStyle: { width: 14, color: [[1, '#EDF2F7']] } },
      axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false },
      pointer: { show: false }, anchor: { show: false }, title: { show: false },
      detail: { valueAnimation: true, fontFamily: FONT_MONO, fontWeight: 600, fontSize: 34, color: NAVY, offsetCenter: [0, '0%'], formatter: '{value}%' },
      data: [{ value: tasaAsistencia }],
    }],
  }), [tasaAsistencia]);

  const mapOption: EChartsOption = useMemo(() => {
    const byEn = new Map<string, MetricByCountry>();
    paisesOrdenados.forEach((p) => { const en = COUNTRY_EN[p.pais]; if (en) byEn.set(en, p); });
    const data = paisesOrdenados
      .filter((p) => COUNTRY_EN[p.pais])
      .map((p) => ({ name: COUNTRY_EN[p.pais], value: p.total_llamadas }));
    const maxV = Math.max(1, ...data.map((d) => d.value));

    // Tooltip enriquecido: mismos datos que la RegionCard de Lanzamiento.tsx.
    const rowHtml = (label: string, val: number, color: string) =>
      `<div style="display:flex;justify-content:space-between;font-size:12.5px;margin:3px 0;"><span style="color:#6b7280;">${label}:</span><span style="font-weight:600;color:${color};">${fmt(val)}</span></div>`;
    const barHtml = (label: string, pctVal: number, color: string) =>
      `<div style="margin-top:7px;"><div style="display:flex;justify-content:space-between;font-size:11px;color:#6b7280;margin-bottom:3px;"><span>${label}</span><span>${pctVal.toFixed(1).replace('.', ',')}%</span></div><div style="width:100%;height:6px;border-radius:4px;background:#e5e7eb;"><div style="height:6px;border-radius:4px;background:${color};width:${Math.min(100, pctVal)}%;"></div></div></div>`;

    return {
      tooltip: {
        trigger: 'item', backgroundColor: '#fff', borderColor: BORDER, borderWidth: 1,
        padding: [12, 14], textStyle: { color: NAVY },
        extraCssText: 'border-radius:12px; box-shadow:0 10px 30px rgba(15,30,61,.14);',
        formatter: (p: any) => {
          const m = byEn.get(p.name);
          if (!m) return `<div style="font-family:${FONT_SANS};min-width:180px;">${p.name}<br/><b>${p.value == null ? 0 : fmt(p.value)}</b> llamadas</div>`;
          const tContest = calcPct(m.llamadas_contestadas, m.total_llamadas);
          const tClicks = calcPct(m.clicks_totales, m.enlaces_enviados);
          return `<div style="font-family:${FONT_SANS};min-width:232px;">`
            + `<div style="font-weight:700;font-size:15px;margin-bottom:8px;">${getFlag(m.pais)} ${m.pais}</div>`
            + rowHtml('Llamadas', m.total_llamadas, '#2563eb')
            + rowHtml('Contestadas', m.llamadas_contestadas, '#16a34a')
            + rowHtml('Fallidas', m.llamadas_fallidas, '#dc2626')
            + rowHtml('Enlaces', m.enlaces_enviados, '#2563eb')
            + rowHtml('Clicks', m.clicks_totales, '#9333ea')
            + rowHtml('No Llamar', m.no_llamar, '#ea580c')
            + `<div style="margin-top:6px;padding-top:8px;border-top:1px solid #eef2f7;">`
            + barHtml('Tasa de Contestación', tContest, '#22c55e')
            + barHtml('Tasa de Clicks', tClicks, '#a855f7')
            + `</div></div>`;
        },
      },
      visualMap: {
        show: true, left: 6, bottom: 6, min: 0, max: maxV, text: ['+', '0'], calculable: false,
        itemWidth: 12, itemHeight: 70, textStyle: { color: MUTED, fontFamily: FONT_MONO, fontSize: 10 },
        inRange: { color: ['#EAF0FA', hexToRgba(RED, 0.45), RED] },
      },
      series: [{
        type: 'map', map: 'world', roam: true, zoom: 1.15, center: [5, 25],
        itemStyle: { areaColor: '#F1F4F9', borderColor: '#DCE3EC', borderWidth: 0.6 },
        emphasis: { itemStyle: { areaColor: hexToRgba(RED, 0.75) }, label: { show: false } },
        select: { disabled: true }, label: { show: false }, data,
      }],
    } as EChartsOption;
  }, [paisesOrdenados]);

  // ─── Estilos reutilizables ──────────────────────────────────────────────────
  const card: React.CSSProperties = { background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 16 };
  const kpiLabel: React.CSSProperties = { font: `600 10px/1 ${FONT_MONO}`, letterSpacing: '.12em', textTransform: 'uppercase', color: '#8FA2C4' };
  const kpiValue: React.CSSProperties = { font: `600 28px/1 ${FONT_MONO}`, marginTop: 12 };

  // Guard defensivo (además del gating en DashboardApp/Sidebar).
  if (!canAccessLanzamientoV2()) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="p-4 bg-red-50 rounded-full"><Lock className="h-12 w-12 text-red-500" /></div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Acceso Restringido</h2>
          <p className="text-gray-600 max-w-md">No tienes permisos para acceder a esta página.</p>
        </div>
      </div>
    );
  }

  const pillStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 8,
    background: active ? NAVY : '#fff', color: active ? '#fff' : NAVY,
    border: `1px solid ${active ? NAVY : '#DCE3EC'}`, borderRadius: 10,
    padding: '9px 14px', font: `600 13px ${FONT_SANS}`, cursor: 'pointer',
  });

  return (
    <div style={{ background: '#EEF1F6', minHeight: '100%', fontFamily: FONT_SANS, color: NAVY }}>
      <div style={{ padding: '32px 32px 60px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 22, letterSpacing: '-.01em' }}>Lanzamiento v2</div>
            <div style={{ fontSize: 13, color: MUTED, marginTop: 3 }}>Actividad por hora del día y relación con la asistencia</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => handleRange('today')} style={pillStyle(timeRange === 'today')}>Hoy</button>
            <button onClick={() => handleRange('custom')} style={pillStyle(timeRange === 'custom')}>
              <CalendarDays size={15} /> Personalizado
            </button>
            <button onClick={refresh} disabled={loading} aria-label="Refrescar"
              style={{ width: 38, height: 38, borderRadius: 10, background: NAVY, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}>
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Datepicker */}
        {showDatePicker && (
          <div style={{ ...card, padding: 20, marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Inicio</label>
                <input type="date" value={startDate} max={endDate || undefined} onChange={(e) => setStartDate(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #DCE3EC', borderRadius: 10, font: `500 13px ${FONT_SANS}` }} />
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Fin</label>
                <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid #DCE3EC', borderRadius: 10, font: `500 13px ${FONT_SANS}` }} />
              </div>
              <button onClick={applyCustom} disabled={!startDate || !endDate || loading}
                style={{ background: NAVY, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 22px', font: `600 13px ${FONT_SANS}`, cursor: 'pointer' }}>
                <Calendar size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />Aplicar
              </button>
            </div>
          </div>
        )}

        {/* Estados de carga / error */}
        {loading && !metrics ? (
          <div style={{ ...card, padding: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: MUTED }}>
            <RefreshCw size={18} className="animate-spin" /> Cargando métricas...
          </div>
        ) : error ? (
          <div style={{ ...card, padding: 40, textAlign: 'center' }}>
            <p style={{ color: RED, marginBottom: 16 }}>{error}</p>
            <button onClick={refresh}
              style={{ background: NAVY, color: '#fff', border: 'none', borderRadius: 10, padding: '9px 18px', cursor: 'pointer' }}>Reintentar</button>
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
              <KpiCard label="Llamadas totales" value={fmt(totalLlamadas)} icon={<Phone size={14} color={MUTED} />} sub="llamadas realizadas en el período" />
              <KpiCard label="Llamadas efectivas" value={fmt(efectivas)} icon={<PhoneCall size={14} color={MUTED} />} sub="contestadas en el período" />
              <KpiCard label="Clicks de asistencia" value={fmt(clicksAsistencia)} valueColor={GREEN} icon={<MousePointer size={14} color={MUTED} />} sub="clicks en enlaces enviados" onClick={() => setShowClicksModal(true)} />
              <KpiCard label="Enlaces enviados" value={fmt(enlaces)} valueColor={RED} icon={<LinkIcon size={14} color={MUTED} />} sub="enlaces únicos (1 por teléfono)" onClick={() => setShowLinksModal(true)} />
              <div style={{ flex: 1, minWidth: 180, background: NAVY, borderRadius: 16, padding: '18px 20px', color: '#fff' }}>
                <div style={kpiLabel}>No desean llamadas</div>
                <div style={{ ...kpiValue, color: '#FCA5A5' }}>{fmt(noDesean)}</div>
                <div style={{ fontSize: 12, color: '#8FA2C4', marginTop: 8 }}>contactos marcados No Llamar</div>
              </div>
              <KpiCard label="Clicks / llamada" value={`${tasaAsistencia.toString().replace('.', ',')}%`} icon={<Activity size={14} color={MUTED} />} sub="tasa de asistencia" />
            </div>

            {/* Combo por hora */}
            <div style={{ ...card, padding: '22px 24px 10px', marginBottom: 20, borderRadius: 18 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 17 }}>Llamadas efectivas y clicks por hora</div>
                  <div style={{ fontSize: 13, color: MUTED, marginTop: 3 }}>La asistencia (clicks) sigue el ritmo de las llamadas</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  {!callsReal && <PlaceholderBadge label="Llamadas: datos de ejemplo" />}
                  <div style={{ display: 'flex', gap: 16, font: `600 12px ${FONT_MONO}` }}>
                    <Legend color={RED} label="Llamadas" />
                    <Legend color={GREEN} label="Clicks" />
                  </div>
                </div>
              </div>
              <EChart option={comboOption} style={{ height: 330 }} />
            </div>

            {/* Mapa + tabla por país (datos reales) */}
            <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>
              <div style={{ flex: '1.6 1 460px', ...card, borderRadius: 18, padding: '22px 24px' }}>
                <div style={{ fontWeight: 700, fontSize: 17 }}>Origen de las llamadas por país</div>
                <div style={{ fontSize: 13, color: MUTED, marginTop: 3 }}>Intensidad por volumen de llamadas</div>
                {worldReady ? (
                  <EChart option={mapOption} style={{ height: 380 }} />
                ) : (
                  <div style={{ height: 380, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, fontSize: 13 }}>
                    Cargando mapa mundial…
                  </div>
                )}
              </div>
              <div style={{ flex: '1 1 320px', ...card, borderRadius: 18, padding: '20px 22px' }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Llamadas y tasa de contestación</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', font: `600 9px/1 ${FONT_MONO}`, letterSpacing: '.1em', textTransform: 'uppercase', color: '#A0AEC2', marginBottom: 10 }}>
                  <span>País · llamadas</span><span>Tasa contest.</span>
                </div>
                {topPaises.length === 0 ? (
                  <div style={{ color: MUTED, fontSize: 13, padding: '12px 0' }}>Sin datos por país en el período.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {topPaises.map((p) => {
                      const tasa = calcPct(p.llamadas_contestadas, p.total_llamadas);
                      return (
                        <div key={p.pais}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', font: `600 13px ${FONT_MONO}` }}>
                            <span>{getFlag(p.pais)} {p.pais}</span>
                            <span>{fmt(p.total_llamadas)} <span style={{ color: MUTED, fontSize: 11 }}>llam.</span></span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                            <div style={{ flex: 1, height: 7, borderRadius: 4, background: '#F0F2F6' }}>
                              <div style={{ height: '100%', width: `${(p.total_llamadas / maxLlamadasPais) * 100}%`, borderRadius: 4, background: GREEN }} />
                            </div>
                            <span style={{ font: `600 11px ${FONT_MONO}`, color: tasa > 0 ? GREEN : '#A0AEC2', width: 46, textAlign: 'right' }}>
                              {tasa.toFixed(1).replace('.', ',')}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Insight + Gauge + Top horas */}
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ flex: '1.2 1 320px', background: 'linear-gradient(135deg,#EFF4FF,#F6F0FF)', border: '1px solid #DCE3EC', borderRadius: 18, padding: 24 }}>
                <div style={{ font: `600 10px/1 ${FONT_MONO}`, letterSpacing: '.12em', textTransform: 'uppercase', color: '#7C4DFF' }}>Asistencia del período</div>
                <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.35, marginTop: 14 }}>
                  {fmt(clicksAsistencia)} clicks sobre <span style={{ color: RED }}>{fmt(efectivas)}</span> llamadas efectivas.
                </div>
                <p style={{ fontSize: 13.5, color: '#4A5A75', lineHeight: 1.55, margin: '12px 0 0' }}>
                  Una tasa de asistencia del <strong>{tasaAsistencia.toString().replace('.', ',')}%</strong> en el período seleccionado.
                </p>
              </div>
              <div style={{ flex: '1 1 240px', ...card, borderRadius: 18, padding: '20px 22px' }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Tasa de asistencia</div>
                <div style={{ fontSize: 12, color: MUTED }}>clicks por cada llamada efectiva</div>
                <EChart option={gaugeOption} style={{ height: 180 }} />
              </div>
              <div style={{ flex: '1 1 240px', ...card, borderRadius: 18, padding: '20px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>Top horas</div>
                  {!callsReal && <PlaceholderBadge label="Ejemplo" />}
                </div>
                {topHoras.length === 0 ? (
                  <div style={{ color: MUTED, fontSize: 13, padding: '8px 0' }}>Sin llamadas en el período.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {topHoras.map((h) => (
                      <div key={h.hora}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', font: `600 13px ${FONT_MONO}` }}>
                          <span>{h.hora}</span><span>{fmt(h.calls)}</span>
                        </div>
                        <div style={{ height: 7, borderRadius: 4, background: '#F0F2F6', marginTop: 5 }}>
                          <div style={{ height: '100%', width: `${h.ratio * 100}%`, borderRadius: 4, background: RED }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {showLinksModal && (
          <ExportModal
            title="Exportar Enlaces Enviados (únicos)"
            icon={<LinkIcon size={18} color={RED} />}
            count={enlaces}
            countColor={RED}
            fields={['ID', 'Nombre', 'Teléfono', 'Email', 'Call ID', 'Agent ID', 'Fecha y Hora', 'Campaña', 'Región', 'Client ID']}
            loading={loadingExportLinks}
            onCancel={() => setShowLinksModal(false)}
            onDownload={handleExportLinksCSV}
          />
        )}
        {showClicksModal && (
          <ExportModal
            title="Exportar Clicks Totales"
            icon={<MousePointer size={18} color={GREEN} />}
            count={clicksAsistencia}
            countColor={GREEN}
            fields={['ID', 'Nombre', 'Teléfono', 'Email', 'Call ID', 'Agent ID', 'Fecha y Hora', 'Campaña', 'Región', 'Workflow', 'Nombre Completo', 'Client ID']}
            loading={loadingExport}
            onCancel={() => setShowClicksModal(false)}
            onDownload={handleExportClicksCSV}
          />
        )}
      </div>
    </div>
  );
};

// ─── Subcomponentes ───────────────────────────────────────────────────────────
const KpiCard: React.FC<{ label: string; value: string; sub: string; icon: React.ReactNode; valueColor?: string; onClick?: () => void }> = ({ label, value, sub, icon, valueColor, onClick }) => (
  <div
    onClick={onClick}
    title={onClick ? 'Click para descargar CSV' : undefined}
    style={{ flex: 1, minWidth: 180, background: '#fff', border: `1px solid ${onClick ? '#C9BCF3' : BORDER}`, borderRadius: 16, padding: '18px 20px', cursor: onClick ? 'pointer' : 'default' }}
  >
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ font: `600 10px/1 ${FONT_MONO}`, letterSpacing: '.12em', textTransform: 'uppercase', color: MUTED }}>{label}</span>
      {icon}
    </div>
    <div style={{ font: `600 28px/1 ${FONT_MONO}`, marginTop: 12, color: valueColor ?? NAVY }}>{value}</div>
    {onClick ? (
      <div style={{ fontSize: 11.5, color: '#7C4DFF', marginTop: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
        <Download size={12} /> Click para descargar
      </div>
    ) : (
      <div style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>{sub}</div>
    )}
  </div>
);

// Modal de exportación CSV (reutilizado por Enlaces y Clicks), estética de la v2.
const ExportModal: React.FC<{
  title: string;
  icon: React.ReactNode;
  count: number;
  countColor: string;
  fields: string[];
  loading: boolean;
  onCancel: () => void;
  onDownload: () => void;
}> = ({ title, icon, count, countColor, fields, loading, onCancel, onDownload }) => (
  <div
    onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,30,61,.45)', fontFamily: FONT_SANS }}
  >
    <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 20px 50px rgba(15,30,61,.25)', padding: 24, width: '100%', maxWidth: 440, margin: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{icon}<span style={{ fontWeight: 700, fontSize: 16, color: NAVY }}>{title}</span></div>
        <button onClick={onCancel} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: MUTED, display: 'flex' }}><X size={18} /></button>
      </div>
      <p style={{ fontSize: 13.5, color: '#4A5A75', margin: '0 0 12px' }}>
        Se exportarán <span style={{ fontWeight: 700, color: countColor }}>{fmt(count)}</span> registros en formato CSV.
      </p>
      <div style={{ background: '#F6F8FC', borderRadius: 10, padding: 12, marginBottom: 18 }}>
        <div style={{ font: `600 11px ${FONT_MONO}`, color: NAVY, marginBottom: 8 }}>Campos incluidos:</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, fontSize: 12, color: '#4A5A75' }}>
          {fields.map((f) => (
            <span key={f} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 5, height: 5, borderRadius: 3, background: countColor, display: 'inline-block' }} />{f}
            </span>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={onCancel} disabled={loading}
          style={{ flex: 1, background: '#fff', border: '1px solid #DCE3EC', borderRadius: 10, padding: '10px 0', font: `600 13px ${FONT_SANS}`, color: NAVY, cursor: 'pointer' }}>
          Cancelar
        </button>
        <button onClick={onDownload} disabled={loading}
          style={{ flex: 1, background: NAVY, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 0', font: `600 13px ${FONT_SANS}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          {loading ? (<><RefreshCw size={14} className="animate-spin" /> Descargando...</>) : (<><Download size={14} /> Descargar CSV</>)}
        </button>
      </div>
    </div>
  </div>
);

const Legend: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#4A5A75' }}>
    <span style={{ width: 11, height: 11, borderRadius: 3, background: color }} />{label}
  </span>
);

const PlaceholderBadge: React.FC<{ label?: string }> = ({ label = 'Datos de ejemplo' }) => (
  <span title="El endpoint de llamadas por hora aún no está desplegado; se muestran datos de ejemplo."
    style={{ font: `600 10px ${FONT_MONO}`, letterSpacing: '.06em', textTransform: 'uppercase', color: '#B45309', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 6, padding: '3px 8px', whiteSpace: 'nowrap' }}>
    ⚠ {label}
  </span>
);

export default LanzamientoV2;
