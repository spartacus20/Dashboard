import React from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid 
} from 'recharts';

interface HourlyAgendasChartProps {
  data: any[];
}

export function HourlyAgendasChart({ data }: HourlyAgendasChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis 
          dataKey="label" 
          tick={{ fontSize: 12 }}
          interval="preserveStartEnd"
        />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip 
          contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
        />
        <Line 
          type="monotone" 
          dataKey="agendas" 
          name="Agendamientos"
          stroke="#10b981" 
          strokeWidth={3}
          dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
          activeDot={{ r: 6, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
