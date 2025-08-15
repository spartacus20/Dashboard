import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from "recharts";
import React from "react";

const COLORS = ["#6366f1", "#8b5cf6", "#d946ef", "#a855f7", "#3b82f6"];

type ChartType = "bar" | "line" | "pie";

interface ChartProps {
  data: any[];
  type?: ChartType;
  xKey?: string;
  yKey?: string;
  height?: number;
  colors?: string[];
  showLegend?: boolean;
}

export function Chart({
  data,
  type = "bar",
  xKey = "label",
  yKey = "llamadas",
  height = 300,
  colors = COLORS,
  showLegend = false
}: ChartProps) {
  if (!data || data.length === 0) return null;

  if (type === "bar") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data}>
          <XAxis dataKey={xKey} stroke="#888888" fontSize={12} />
          <YAxis stroke="#888888" fontSize={12} domain={[0, 'dataMax']} />
          <Tooltip
            contentStyle={{
              background: "white",
              border: "1px solid #e5e7eb",
              color: "#111827",
              fontSize: 13,
            }}
          />
          {showLegend && <Legend />}
          <Bar dataKey={yKey} fill={colors[0]} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (type === "line") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <XAxis dataKey={xKey} stroke="#888888" fontSize={12} />
          <YAxis stroke="#888888" fontSize={12} domain={[0, 'dataMax']} />
          <Tooltip
            contentStyle={{
              background: "white",
              border: "1px solid #e5e7eb",
              color: "#111827",
              fontSize: 13,
            }}
          />
          {showLegend && <Legend />}
          <Line type="monotone" dataKey={yKey} stroke={colors[0]} strokeWidth={2} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (type === "pie") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Tooltip
            contentStyle={{
              background: "white",
              border: "1px solid #e5e7eb",
              color: "#111827",
              fontSize: 13,
            }}
          />
          {showLegend && <Legend />}
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={80}
            fill={colors[0]}
            dataKey={yKey}
            nameKey={xKey}
          >
            {data.map((entry: any, index: number) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    );
  }

  return null;
} 