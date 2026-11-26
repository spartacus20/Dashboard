import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import * as echarts from 'echarts';

export type EChartsOption = echarts.EChartsCoreOption;

interface EChartProps {
  /** Opción de ECharts. Al cambiar, se re-aplica con notMerge=true. */
  option: EChartsOption;
  className?: string;
  style?: CSSProperties;
}

/**
 * Wrapper mínimo de ECharts para React.
 *
 * ECharts se importa de forma estática aquí, pero como este componente solo lo
 * usa la página LanzamientoV2 (cargada con React.lazy), la librería termina en el
 * chunk async de esa página y NO engorda el bundle principal.
 *
 * - Inicializa el chart al montar y lo destruye al desmontar.
 * - Se redimensiona automáticamente con un ResizeObserver sobre el contenedor.
 */
export function EChart({ option, className, style }: EChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const chart = echarts.init(el);
    chartRef.current = chart;

    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, true);
  }, [option]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: '100%', height: '100%', ...style }}
    />
  );
}

// Registro perezoso (una sola vez) del mapa mundial de ECharts. El GeoJSON se
// descarga del CDN (mismo origen que el diseño original). Devuelve true si el
// mapa quedó disponible, false si falló la descarga.
let worldMapPromise: Promise<boolean> | null = null;

export function ensureWorldMap(): Promise<boolean> {
  const anyEcharts = echarts as unknown as {
    getMap?: (name: string) => unknown;
  };
  if (anyEcharts.getMap && anyEcharts.getMap('world')) {
    return Promise.resolve(true);
  }
  if (worldMapPromise) return worldMapPromise;

  worldMapPromise = fetch('https://cdn.jsdelivr.net/npm/echarts@4.9.0/map/json/world.json')
    .then((r) => r.json())
    .then((geoJson) => {
      echarts.registerMap('world', geoJson);
      return true;
    })
    .catch(() => {
      worldMapPromise = null; // permitir reintento en el próximo montaje
      return false;
    });

  return worldMapPromise;
}
