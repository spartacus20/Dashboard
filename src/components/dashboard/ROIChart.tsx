import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Chart } from "../ui/chart";
import { BarChart3 } from 'lucide-react';

interface ROIChartProps {
  data?: any[];
  totalROI?: number; // ROI total real del período
  timePeriod?: string;
}

export function ROIChart({ data = [], totalROI, timePeriod }: ROIChartProps) {
  const chartData = data.length > 0 ? data : [];
  
  // Usar el ROI total real si está disponible, sino calcular promedio de los datos
  const promedioROI = totalROI !== undefined ? totalROI : 
    (chartData.length > 0 ? chartData.reduce((sum, item) => sum + (item.roi || 0), 0) / chartData.length : 0);
  
  const maxROI = chartData.length > 0 
    ? Math.max(...chartData.map(item => item.roi || 0)) 
    : 0;

  // Si no hay datos, mostrar mensaje
  if (chartData.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-600" />
            <CardTitle>Retorno de Inversión (ROI)</CardTitle>
          </div>
          <CardDescription>
            No hay datos de ROI disponibles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-[300px] text-slate-500 space-y-2">
            <p>No se encontraron datos de ROI para mostrar</p>
            <p className="text-xs">Verifica que el endpoint /api/sales/roi-by-day esté funcionando</p>
            <p className="text-xs">Datos recibidos: {JSON.stringify(data)}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-emerald-600" />
          <CardTitle>Retorno de Inversión (ROI)</CardTitle>
        </div>
        <CardDescription>
          Evolución del ROI en el período seleccionado
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className={`mb-4 grid gap-4 ${timePeriod === 'today' ? 'grid-cols-1' : 'grid-cols-2'}`}>
          <div className="text-center">
            <p className="text-2xl font-bold text-emerald-600">
              {promedioROI.toFixed(1)}%
            </p>
            <p className="text-sm text-slate-600">ROI promedio</p>
          </div>
          {timePeriod !== 'today' && (
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">
                {maxROI.toFixed(1)}%
              </p>
              <p className="text-sm text-slate-600">ROI máximo</p>
            </div>
          )}
        </div>
        <div className="h-[300px]">
          <Chart
            data={chartData}
            type="line"
            xKey="date"
            yKey="roi"
            height={300}
            colors={["#10b981"]}
          />
        </div>
      </CardContent>
    </Card>
  );
}