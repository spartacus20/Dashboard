import React, { ReactElement } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  LineChart,
  Line,
  CartesianGrid,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { cn } from "../../lib/utils";

interface ChartProps {
  data: any[];
  type: "bar" | "area" | "line" | "pie";
  xKey: string;
  yKey: string;
  className?: string;
  colors?: string[];
  height?: number;
  title?: string;
  description?: string;
  showLegend?: boolean;
  showTooltip?: boolean;
  showGrid?: boolean;
}

const DEFAULT_COLORS = ["#8b5cf6", "#d946ef", "#a855f7", "#6366f1", "#3b82f6"];

export function Chart({
  data,
  type,
  xKey,
  yKey,
  className,
  colors = DEFAULT_COLORS,
  height = 300,
  title,
  description,
  showLegend = true,
  showTooltip = true,
  showGrid = true,
}: ChartProps) {
  const renderChart = (): ReactElement => {
    switch (type) {
      case "bar":
        return (
          <BarChart data={data}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#333" />}
            <XAxis dataKey={xKey} stroke="#666" />
            <YAxis stroke="#666" />
            {showTooltip && <Tooltip contentStyle={{ backgroundColor: "#1f2937", color: "#fff", border: "none" }} />}
            {showLegend && <Legend />}
            <Bar dataKey={yKey} fill={colors[0]} radius={[4, 4, 0, 0]} />
          </BarChart>
        );
      case "area":
        return (
          <AreaChart data={data}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#333" />}
            <XAxis dataKey={xKey} stroke="#666" />
            <YAxis stroke="#666" />
            {showTooltip && <Tooltip contentStyle={{ backgroundColor: "#1f2937", color: "#fff", border: "none" }} />}
            {showLegend && <Legend />}
            <Area type="monotone" dataKey={yKey} stroke={colors[0]} fill={colors[0]} fillOpacity={0.3} />
          </AreaChart>
        );
      case "line":
        return (
          <LineChart data={data}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#333" />}
            <XAxis dataKey={xKey} stroke="#666" />
            <YAxis stroke="#666" />
            {showTooltip && <Tooltip contentStyle={{ backgroundColor: "#1f2937", color: "#fff", border: "none" }} />}
            {showLegend && <Legend />}
            <Line type="monotone" dataKey={yKey} stroke={colors[0]} strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        );
      case "pie":
        return (
          <PieChart>
            {showTooltip && <Tooltip contentStyle={{ backgroundColor: "#1f2937", color: "#fff", border: "none" }} />}
            {showLegend && <Legend />}
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius={80}
              fill="#8884d8"
              dataKey={yKey}
              nameKey={xKey}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
          </PieChart>
        );
      default:
        // Devolver un gráfico vacío por defecto
        return <BarChart data={[]}><XAxis /></BarChart>;
    }
  };

  return (
    <div className={cn("w-full", className)}>
      {(title || description) && (
        <div className="mb-4">
          {title && <h3 className="text-lg font-semibold text-white">{title}</h3>}
          {description && <p className="text-sm text-gray-400">{description}</p>}
        </div>
      )}
      <div className="w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
} 