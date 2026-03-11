import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Chart } from "../ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  ResponsiveContainer as RechartsResponsiveContainer,
  ComposedChart as RechartsComposedChart,
  Bar as RechartsBar,
  Line as RechartsLine,
  PieChart as RechartsPieChart,
  Pie as RechartsPie,
  Cell as RechartsCell,
  XAxis as RechartsXAxis,
  YAxis as RechartsYAxis,
  Tooltip as RechartsTooltip,
  Legend as RechartsLegend,
  CartesianGrid as RechartsCartesianGrid,
} from "recharts";

interface DashboardChartsProps {
  dashboardData: any;
  agendaEnabled: boolean;
  launchEnabled: boolean;
  timePeriod: string;
  isLongRange: boolean;

  // Datos procesados
  hourlyAgendasData: any[];
  housingTypeData: any[];
  interestData: any[];
  agentesPorAgendasData: any[];
  effectiveCallsData: any[];
  asistenciaByHour: any[];
  disconnectionData: any[];
  combinedCallsAgendasData: any[];
  agendaPropertyTypeData: any[];
  hasAgendasInPeriod: boolean;

  // Estados de carga Launch
  asistenciaLoading: boolean;
  asistenciaError: string | null;
  launchRegionLoading: boolean;
  launchRegionError: string | null;
  launchRegionMetrics: any;

  // Helpers
  calculateLaunchPercentage: (v: number, t: number) => number;

  // Filtros horarios
  hourRangeStart: string;
  hourRangeEnd: string;
  handleHourRangeChange: (type: "start" | "end", val: string) => void;
  effectiveCallsHourStart: string;
  effectiveCallsHourEnd: string;
  handleEffectiveCallsHourRangeChange: (
    type: "start" | "end",
    val: string,
  ) => void;
}

export function DashboardCharts(props: DashboardChartsProps) {
  const {
    agendaEnabled,
    launchEnabled,
    isLongRange,
    hourlyAgendasData,
    housingTypeData,
    interestData,
    agentesPorAgendasData,
    effectiveCallsData,
    asistenciaByHour,
    disconnectionData,
    combinedCallsAgendasData,
    agendaPropertyTypeData,
    hasAgendasInPeriod,
    asistenciaLoading,
    launchRegionLoading,
    launchRegionError,
    launchRegionMetrics,
    calculateLaunchPercentage,
    hourRangeStart,
    hourRangeEnd,
    handleHourRangeChange,
    effectiveCallsHourStart,
    effectiveCallsHourEnd,
    handleEffectiveCallsHourRangeChange,
  } = props;

  return (
    <>
      {/* Métricas de lanzamiento por región (si el cliente tiene launch habilitado) */}
      {launchEnabled && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-800">
              Tasa de Contestación por Región
            </CardTitle>
            <CardDescription className="text-slate-500">
              Comparación de rendimiento de las campañas de lanzamiento por
              región
            </CardDescription>
          </CardHeader>
          <CardContent>
            {launchRegionLoading ? (
              <div className="py-4 text-sm text-slate-500">
                Cargando métricas de lanzamiento por región...
              </div>
            ) : launchRegionError ? (
              <div className="py-4 text-sm text-red-600">
                {launchRegionError}
              </div>
            ) : launchRegionMetrics ? (
              <div className="grid gap-4 md:grid-cols-3">
                {(["europa", "latam", "espana"] as const).map((key) => {
                  const data = launchRegionMetrics[key];
                  const label =
                    key === "europa"
                      ? "Europa"
                      : key === "latam"
                        ? "Latam"
                        : "España";
                  const tasa = calculateLaunchPercentage(
                    data.llamadas_contestadas,
                    data.total_llamadas,
                  );
                  return (
                    <div
                      key={key}
                      className="bg-slate-50 rounded-lg border border-slate-200 p-4 flex flex-col items-center text-center"
                    >
                      <div className="text-sm font-medium text-slate-700 mb-1">
                        {label}
                      </div>
                      <div className="text-2xl font-bold text-blue-700 mb-1">
                        {tasa}%
                      </div>
                      <div className="text-xs text-slate-500">
                        {data.llamadas_contestadas.toLocaleString()} contestadas
                        de {data.total_llamadas.toLocaleString()} llamadas
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-4 text-sm text-slate-500">
                No hay métricas de lanzamiento por región disponibles para este
                período.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Gráficos de distribución (Agendas y Vivienda) */}
      <div
        className={`grid gap-4 mb-8 ${agendaEnabled ? "md:grid-cols-2" : "md:grid-cols-1"}`}
      >
        {/* Gráfico de agendamientos por hora */}
        {agendaEnabled && hourlyAgendasData && hourlyAgendasData.length > 0 && (
          <Card className="shadow-lg border border-slate-200">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-800">
                    Agendamientos por Hora
                  </CardTitle>
                  <CardDescription className="text-slate-500">
                    Distribución de agendamientos por hora del día
                  </CardDescription>
                </div>
                {/* Filtro de rango de horas */}
                <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-slate-700">
                      Desde:
                    </label>
                    <Select
                      value={hourRangeStart}
                      onValueChange={(val) =>
                        handleHourRangeChange("start", val)
                      }
                    >
                      <SelectTrigger className="w-20 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => (
                          <SelectItem key={i} value={i.toString()}>
                            {i.toString().padStart(2, "0")}:00
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-slate-700">
                      Hasta:
                    </label>
                    <Select
                      value={hourRangeEnd}
                      onValueChange={(val) => handleHourRangeChange("end", val)}
                    >
                      <SelectTrigger className="w-20 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => (
                          <SelectItem key={i} value={i.toString()}>
                            {i.toString().padStart(2, "0")}:00
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 md:p-6">
              <div className="h-[300px] bg-white rounded-xl p-4 md:p-6">
                <Chart
                  data={hourlyAgendasData}
                  type="line"
                  xKey="label"
                  yKey="agendas"
                  height={300}
                  colors={["#10b981"]}
                  showLegend={false}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Gráfico de tipos de vivienda */}
        {agendaEnabled && housingTypeData && housingTypeData.length > 0 && (
          <Card className="shadow-lg border border-slate-200">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-slate-800">
                Tipos de Vivienda
              </CardTitle>
              <CardDescription className="text-slate-500">
                Distribución de tipos de vivienda
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 md:p-6">
              <div className="h-[300px] bg-white rounded-xl p-4 md:p-6">
                <Chart
                  data={housingTypeData}
                  type="pie"
                  xKey="label"
                  yKey="cantidad"
                  height={300}
                  colors={[
                    "#f59e0b",
                    "#10b981",
                    "#3b82f6",
                    "#8b5cf6",
                    "#ef4444",
                  ]}
                  showLegend={true}
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Gráficos de distribución (Interés y Agentes) */}
      <div
        className={`grid gap-4 mb-8 ${agendaEnabled ? "md:grid-cols-2" : "md:grid-cols-1"}`}
      >
        {interestData && interestData.length > 0 && (
          <Card className="shadow-lg border border-slate-200">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-slate-800">
                Interés
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 md:p-6">
              <div className="h-[300px] bg-white rounded-xl p-4 md:p-6">
                <Chart
                  data={interestData}
                  type="pie"
                  xKey="label"
                  yKey="cantidad"
                  height={300}
                  colors={[
                    "#3b82f6",
                    "#10b981",
                    "#f59e0b",
                    "#8b5cf6",
                    "#ef4444",
                  ]}
                  showLegend={true}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {agendaEnabled &&
          agentesPorAgendasData &&
          agentesPorAgendasData.length > 0 && (
            <Card className="shadow-lg border border-slate-200">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-800">
                  Agentes por Agendas
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 md:p-6">
                <div className="h-[300px] bg-white rounded-xl p-4 md:p-6">
                  <Chart
                    data={agentesPorAgendasData}
                    type="bar"
                    xKey="label"
                    yKey="cantidad"
                    height={300}
                    colors={["#3b82f6"]}
                    showLegend={false}
                  />
                </div>
              </CardContent>
            </Card>
          )}
      </div>

      {/* Gráficos Adicionales (Efectivas, Asistencia, Desconexiones) */}
      <div
        className={`grid gap-4 mb-8 ${agendaEnabled ? "md:grid-cols-2" : "md:grid-cols-1"}`}
      >
        {effectiveCallsData && effectiveCallsData.length > 0 && (
          <Card className="shadow-lg border border-slate-200">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-800">
                    Llamadas Efectivas por Hora
                  </CardTitle>
                </div>
                {/* Filtro de rango de horas */}
                <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-2">
                    <Select
                      value={effectiveCallsHourStart}
                      onValueChange={(val) =>
                        handleEffectiveCallsHourRangeChange("start", val)
                      }
                    >
                      <SelectTrigger className="w-20 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => (
                          <SelectItem key={i} value={i.toString()}>
                            {i.toString().padStart(2, "0")}:00
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={effectiveCallsHourEnd}
                      onValueChange={(val) =>
                        handleEffectiveCallsHourRangeChange("end", val)
                      }
                    >
                      <SelectTrigger className="w-20 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => (
                          <SelectItem key={i} value={i.toString()}>
                            {i.toString().padStart(2, "0")}:00
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 md:p-6">
              <div className="h-[300px] bg-white rounded-xl p-4 md:p-6">
                <Chart
                  data={effectiveCallsData}
                  type="line"
                  xKey="label"
                  yKey="llamadas"
                  height={300}
                  colors={["#dc2626"]}
                  showLegend={false}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {launchEnabled && asistenciaByHour && asistenciaByHour.length > 0 && (
          <Card className="shadow-lg border border-slate-200">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-slate-800">
                Clicks de Asistencia por Hora
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 md:p-6">
              {asistenciaLoading ? (
                <div className="py-4 text-sm text-slate-500">Cargando...</div>
              ) : (
                <div className="h-[300px] bg-white rounded-xl p-4 md:p-6">
                  <Chart
                    data={asistenciaByHour}
                    type="line"
                    xKey="label"
                    yKey="clicks"
                    height={300}
                    colors={["#16a34a"]}
                    showLegend={false}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {disconnectionData && disconnectionData.length > 0 && (
          <Card className="shadow-lg border border-slate-200">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-slate-800">
                Razones de Desconexión
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 md:p-6">
              <div className="h-[300px] bg-white rounded-xl p-4 md:p-6">
                <Chart
                  data={disconnectionData}
                  type="pie"
                  xKey="reason"
                  yKey="count"
                  height={300}
                  showLegend={true}
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Bloque: Llamadas contestadas / Agendas + Agendas por tipo de propiedad */}
      {((combinedCallsAgendasData && combinedCallsAgendasData.length > 0) ||
        (hasAgendasInPeriod &&
          agendaPropertyTypeData &&
          agendaPropertyTypeData.length > 0)) && (
        <div
          className={`grid gap-4 mb-8 ${
            isLongRange
              ? "md:grid-cols-1"
              : hasAgendasInPeriod &&
                  agendaPropertyTypeData &&
                  agendaPropertyTypeData.length > 0
                ? "md:grid-cols-2"
                : "md:grid-cols-1"
          }`}
        >
          {combinedCallsAgendasData && combinedCallsAgendasData.length > 0 && (
            <Card className="shadow-lg border border-slate-200">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-800">
                  Llamadas contestadas / Agendas
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 md:p-6">
                <div className="h-[320px] bg-white rounded-xl p-4 md:p-6">
                  <RechartsResponsiveContainer width="100%" height="100%">
                    <RechartsComposedChart data={combinedCallsAgendasData}>
                      <RechartsCartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                      />
                      <RechartsXAxis
                        dataKey="label"
                        stroke="#888888"
                        fontSize={12}
                      />
                      <RechartsYAxis
                        yAxisId="left"
                        stroke="#1d4ed8"
                        fontSize={12}
                      />
                      <RechartsYAxis
                        yAxisId="right"
                        orientation="right"
                        stroke="#dc2626"
                        fontSize={12}
                      />
                      <RechartsTooltip />
                      <RechartsLegend />
                      <RechartsBar
                        yAxisId="left"
                        dataKey="llamadas"
                        name="Llamadas"
                        fill="#3b82f6"
                        radius={[4, 4, 0, 0]}
                      />
                      <RechartsLine
                        yAxisId="right"
                        type="monotone"
                        dataKey="agendas"
                        name="Agendas"
                        stroke="#dc2626"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </RechartsComposedChart>
                  </RechartsResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {agendaEnabled &&
            hasAgendasInPeriod &&
            agendaPropertyTypeData &&
            agendaPropertyTypeData.length > 0 && (
              <Card className="shadow-lg border border-slate-200">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-slate-800">
                    Agendas por tipo de propiedad
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 md:p-6">
                  <div className="h-[320px] bg-white rounded-xl p-4 md:p-6">
                    <RechartsResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <RechartsTooltip />
                        <RechartsLegend
                          verticalAlign="bottom"
                          height={80}
                          wrapperStyle={{ fontSize: "12px" }}
                        />
                        <RechartsPie
                          data={agendaPropertyTypeData}
                          dataKey="porcentaje"
                          nameKey="label"
                          cx="50%"
                          cy="40%"
                          outerRadius={75}
                          labelLine={false}
                        >
                          {agendaPropertyTypeData.map(
                            (entry: any, index: number) => {
                              const label = (entry.label || "")
                                .toString()
                                .toLowerCase();
                              let fill = "#6366f1";
                              if (label.includes("casa")) fill = "#facc15";
                              else if (label.includes("piso")) fill = "#22c55e";
                              else if (label.includes("alquiler"))
                                fill = "#3b82f6";
                              return (
                                <RechartsCell
                                  key={`cell-${index}`}
                                  fill={fill}
                                />
                              );
                            },
                          )}
                        </RechartsPie>
                      </RechartsPieChart>
                    </RechartsResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
        </div>
      )}
    </>
  );
}
