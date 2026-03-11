import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid,
  Cell
} from 'recharts';

interface AgentesPorAgendasChartProps {
  data: any[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899'];

export function AgentesPorAgendasChart({ data }: AgentesPorAgendasChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
        <XAxis type="number" hide />
        <YAxis 
          dataKey="label" 
          type="category" 
          width={100}
          tick={{ fontSize: 11 }}
        />
        <Tooltip 
          cursor={{ fill: 'rgba(0,0,0,0.05)' }}
          contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
        />
        <Bar 
          dataKey="agendas" 
          name="Agendamientos"
          radius={[0, 4, 4, 0]}
          barSize={20}
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
