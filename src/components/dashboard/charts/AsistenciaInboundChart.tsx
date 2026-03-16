import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid,
  Legend
} from 'recharts';

interface AsistenciaInboundChartProps {
  data: any[];
}

export function AsistenciaInboundChart({ data }: AsistenciaInboundChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis 
          dataKey="hour" 
          tick={{ fontSize: 12 }}
        />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip 
          contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
        />
        <Legend />
        <Bar 
          dataKey="clicks" 
          name="Clicks de Asistencia"
          fill="#8b5cf6" 
          radius={[4, 4, 0, 0]}
          barSize={30}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
