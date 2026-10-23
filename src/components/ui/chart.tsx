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
  Cell,
  Area,
  AreaChart,
  CartesianGrid
} from "recharts";

const COLORS = ["#6366f1", "#8b5cf6", "#d946ef", "#a855f7", "#3b82f6"];

type ChartType = "bar" | "line" | "pie" | "area";

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
            {data.map((_, index: number) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (type === "area") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="fillArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={colors[0]} stopOpacity={0.8}/>
              <stop offset="95%" stopColor={colors[0]} stopOpacity={0.1}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
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
          <Area
            type="monotone"
            dataKey={yKey}
            stroke={colors[0]}
            fill="url(#fillArea)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  return null;
} 