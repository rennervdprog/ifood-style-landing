import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Point = { month: string; valor: number };

export default function MrrAreaChart({ data }: { data: Point[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 6, right: 6, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF6A00" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#FF6A00" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="month" tickLine={false} axisLine={false}
          tick={{ fill: "#9ca3af", fontSize: 10, fontWeight: 700 }} />
        <YAxis tickLine={false} axisLine={false}
          tick={{ fill: "#9ca3af", fontSize: 10 }}
          tickFormatter={(v) => `R$${v >= 1000 ? (v/1000).toFixed(1)+"k" : v}`} />
        <Tooltip
          contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }}
          formatter={(v: number) => [v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), "Comissões"]}
        />
        <Area type="monotone" dataKey="valor" stroke="#FF6A00" strokeWidth={3}
          fill="url(#mrrGrad)" dot={{ r: 4, fill: "#FF6A00", strokeWidth: 2, stroke: "#fff" }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}