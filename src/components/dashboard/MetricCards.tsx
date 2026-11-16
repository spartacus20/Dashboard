import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

interface MetricCardsProps {
  dashboardData: any;
  agendaEnabled: boolean;
}

export function MetricCards({
  dashboardData,
  agendaEnabled,
}: MetricCardsProps) {
  const metricas = dashboardData?.dashboard_data?.metricas_generales;
  const totalLlamadas = metricas?.total_llamadas || 0;
  const costoTotal = metricas?.costo_total || 0;
  const llamadasEfectivas = metricas?.llamadas_efectivas || 0;
  const llamadasFallidas = metricas?.llamadas_fallidas || 0;
  const totalAgendamientos = metricas?.total_agendamientos || 0;

  const pctContestadas =
    totalLlamadas > 0
      ? ((llamadasEfectivas / totalLlamadas) * 100).toFixed(2)
      : "0";
  const pctFallidas =
    totalLlamadas > 0
      ? ((llamadasFallidas / totalLlamadas) * 100).toFixed(2)
      : "0";
  const pctAgendas =
    llamadasEfectivas > 0
      ? ((totalAgendamientos / llamadasEfectivas) * 100).toFixed(2)
      : "0";
  const costoXAgenda =
    totalAgendamientos > 0
      ? (costoTotal / totalAgendamientos).toFixed(2)
      : "0.00";

  return (
    <>
      {/* Fila 1: 4 tarjetas principales */}
      <div className="grid gap-4 mb-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Llamadas Lanzadas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-center gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-center">
              Llamadas Lanzadas
            </CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center text-center">
            <div className="text-xl font-bold text-center">
              {totalLlamadas.toLocaleString()}
            </div>
            <p className="text-xs text-slate-600 text-center">
              Total registrado en el servidor
            </p>
          </CardContent>
        </Card>

        {/* Costo Total */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-center gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-center">
              Costo Total
            </CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center text-center">
            <div className="text-xl font-bold text-center">
              ${costoTotal.toFixed(2)}
            </div>
            <p className="text-xs text-slate-600 text-center">
              Costo total de llamadas
            </p>
          </CardContent>
        </Card>

        {/* Llamadas Contestadas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-center gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-center">
              Llamadas Contestadas
            </CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-emerald-400"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22,4 12,14.01 9,11.01" />
            </svg>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center text-center">
            <div className="text-xl font-bold text-center">
              {pctContestadas}%
            </div>
            <div className="text-xs text-slate-600 text-center">
              {llamadasEfectivas.toLocaleString()} llamadas contestadas
            </div>
          </CardContent>
        </Card>

        {/* Llamadas Fallidas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-center gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-center">
              Llamadas Fallidas
            </CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-red-400"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center text-center">
            <div className="text-xl font-bold text-center">{pctFallidas}%</div>
            <div className="text-xs text-slate-600 text-center">
              {llamadasFallidas.toLocaleString()} llamadas fallidas
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fila 2: Agendamientos (solo si está habilitado) */}
      {agendaEnabled && (
        <div className="grid gap-4 mb-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Total Agendamientos */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-center gap-2 pb-2">
              <CardTitle className="text-sm font-medium text-center">
                Total Agendamientos
              </CardTitle>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                className="h-4 w-4 text-blue-400"
              >
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                <line x1="16" x2="16" y1="2" y2="6" />
                <line x1="8" x2="8" y1="2" y2="6" />
                <line x1="3" x2="21" y1="10" y2="10" />
              </svg>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center text-center">
              <div className="text-xl font-bold text-center">{pctAgendas}%</div>
              <div className="text-xs text-slate-600 text-center">
                {totalAgendamientos.toLocaleString()} agendamientos
              </div>
            </CardContent>
          </Card>

          {/* Costo por Agenda */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-center gap-2 pb-2">
              <CardTitle className="text-sm font-medium text-center">
                Costo por Agenda
              </CardTitle>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                className="h-4 w-4 text-emerald-400"
              >
                <line x1="12" x2="12" y1="2" y2="22" />
                <path d="M17 5H7L12 2l5 3z" />
                <path d="M17 19H7L12 22l5-3z" />
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
              </svg>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center text-center">
              <div className="text-xl font-bold text-center">
                ${costoXAgenda}
              </div>
              <div className="text-xs text-slate-600 text-center">
                {totalAgendamientos.toLocaleString()} agendamientos
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
