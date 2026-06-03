import {
  AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";
import { formatBRL } from "@/lib/utils";

/**
 * Charts isolados em chunk próprio para que `recharts` (~150KB gzipped)
 * não entre no bundle inicial do AdminDashboardV2. Carregado via React.lazy().
 */

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "12px",
  fontSize: "12px",
  color: "hsl(var(--foreground))",
};

export function DailyRevenueChart({ data }: { data: Array<{ day: string; vendas: number; pedidos: number }> }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="day"
          tick={{ fontSize: 9, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
          interval={Math.max(0, Math.floor(data.length / 8))}
        />
        <YAxis hide />
        <RechartsTooltip
          contentStyle={tooltipStyle}
          formatter={(value: number, name: string) => [
            name === "vendas" ? formatBRL(value) : `${value}`,
            name === "vendas" ? "Vendas" : "Pedidos",
          ]}
        />
        <Area type="monotone" dataKey="vendas" stroke="#10b981" strokeWidth={2} fill="url(#revenueGrad)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function HourlyBarChart({ data }: { data: Array<{ hour: string; pedidos: number }> }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <XAxis
          dataKey="hour"
          tick={{ fontSize: 9, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
          interval={1}
        />
        <YAxis hide />
        <RechartsTooltip
          contentStyle={tooltipStyle}
          formatter={(value: number) => [`${value} pedidos`, ""]}
        />
        <Bar dataKey="pedidos" fill="#3b82f6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function WeekdayBarChart({ data }: { data: Array<{ dia: string; vendas: number; pedidos: number }> }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <XAxis dataKey="dia" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
        <YAxis hide />
        <RechartsTooltip
          contentStyle={tooltipStyle}
          formatter={(value: number, name: string) => [
            name === "vendas" ? formatBRL(value) : `${value}`,
            name === "vendas" ? "Vendas" : "Pedidos",
          ]}
        />
        <Bar dataKey="vendas" fill="#a855f7" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PaymentPieChart({
  data,
  colors,
}: {
  data: Array<{ name: string; value: number; total: number }>;
  colors: string[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} innerRadius={30} outerRadius={50} paddingAngle={4} dataKey="value" strokeWidth={0}>
          {data.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}