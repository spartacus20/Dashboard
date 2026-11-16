import React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card';

interface LaunchRegionMetrics {
  europa: { total_llamadas: number; llamadas_contestadas: number; llamadas_fallidas: number };
  latam: { total_llamadas: number; llamadas_contestadas: number; llamadas_fallidas: number };
  espana: { total_llamadas: number; llamadas_contestadas: number; llamadas_fallidas: number };
}

interface LaunchRegionSectionProps {
  launchEnabled: boolean;
  launchRegionLoading: boolean;
  launchRegionError: string | null;
  launchRegionMetrics: LaunchRegionMetrics | null;
}

export function LaunchRegionSection({
  launchEnabled,
  launchRegionLoading,
  launchRegionError,
  launchRegionMetrics,
}: LaunchRegionSectionProps) {
  if (!launchEnabled) return null;

  const calculatePercentage = (value: number, total: number) => {
    if (!total || total <= 0) return 0;
    return Math.round((value / total) * 100);
  };

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-slate-800">
          Tasa de Contestación por Región
        </CardTitle>
        <CardDescription className="text-slate-500">
          Comparación de rendimiento de las campañas de lanzamiento por región
        </CardDescription>
      </CardHeader>
      <CardContent>
        {launchRegionLoading ? (
          <div className="py-4 text-sm text-slate-500">
            Cargando métricas de lanzamiento por región...
          </div>
        ) : launchRegionError ? (
          <div className="py-4 text-sm text-red-600">{launchRegionError}</div>
        ) : launchRegionMetrics ? (
          <div className="grid gap-4 md:grid-cols-3">
            {(["europa", "latam", "espana"] as const).map((key) => {
              const data = launchRegionMetrics[key];
              const label = key === "europa" ? "Europa" : key === "latam" ? "Latam" : "España";
              const tasa = calculatePercentage(data.llamadas_contestadas, data.total_llamadas);
              return (
                <div
                  key={key}
                  className="bg-slate-50 rounded-lg border border-slate-200 p-4 flex flex-col items-center text-center"
                >
                  <div className="text-sm font-medium text-slate-700 mb-1">{label}</div>
                  <div className="text-2xl font-bold text-blue-700 mb-1">{tasa}%</div>
                  <div className="text-xs text-slate-500">
                    {data.llamadas_contestadas.toLocaleString()} contestadas de{" "}
                    {data.total_llamadas.toLocaleString()} llamadas
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-4 text-sm text-slate-500">
            No hay métricas de lanzamiento por región disponibles para este período.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
