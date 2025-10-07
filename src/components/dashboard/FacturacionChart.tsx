import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Chart } from "../ui/chart";
import { TrendingUp } from 'lucide-react';

interface FacturacionChartProps {
  data?: any[];
}

export function FacturacionChart({ data = [] }: FacturacionChartProps) {
  const chartData = data.length > 0 ? data : [];
  const totalFacturacion = chartData.reduce((sum, item) => sum + item.facturacion, 0);
  
  // Calcular el promedio diario basado en el rango de fechas, no en el número de días con datos
  const calcularPromedioDiario = () => {
    if (chartData.length === 0) return 0;
    
    // Obtener la fecha más antigua y la más reciente
    const fechas = chartData.map(item => new Date(item.date)).sort((a, b) => a.getTime() - b.getTime());
    const fechaInicio = fechas[0];
    const fechaFin = fechas[fechas.length - 1];
    
    // Calcular la diferencia en días
    const diffTime = fechaFin.getTime() - fechaInicio.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 para incluir ambos días
    
    return diffDays > 0 ? totalFacturacion / diffDays : 0;
  };
  
  const promedioFacturacion = calcularPromedioDiario();

  // Si no hay datos, mostrar mensaje
  if (chartData.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <CardTitle>Facturación Total</CardTitle>
          </div>
          <CardDescription>
            No hay datos de facturación disponibles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-slate-500">
            <p>No se encontraron datos de facturación para mostrar</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-green-600" />
          <CardTitle>Facturación Total</CardTitle>
        </div>
        <CardDescription>
          Evolución de la facturación en el período seleccionado
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid grid-cols-2 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">
              ${totalFacturacion.toLocaleString()}
            </p>
            <p className="text-sm text-slate-600">Total facturado</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">
              ${promedioFacturacion.toLocaleString()}
            </p>
            <p className="text-sm text-slate-600">Promedio diario</p>
          </div>
        </div>
        <div className="h-[300px]">
          <Chart
            data={chartData}
            type="area"
            xKey="date"
            yKey="facturacion"
            height={300}
            colors={["#10b981"]}
          />
        </div>
      </CardContent>
    </Card>
  );
}
