/**
 * FinanceChartsTeste — cópias Teste dos gráficos da Visão Geral.
 * Só na versão Teste; o original (FinanceCharts.tsx, usado pelo painel do
 * lojista e pelo /super-admin) continua intacto.
 *
 * O que muda e por quê (print do Renner, 27/10 ~21:28, filtro 7 dias):
 * - Evolução: o pico do PDV (~R$ 979 em 22/10) saía cortado no topo — o eixo Y
 *   automático do Recharts não dava folga. Aqui o teto é explícito, com 10%
 *   de folga arredondado para a centena seguinte (computeYDomainMax).
 * - Pagamento: a legenda (8 métodos) era maior que o `h-32` fixo do cartão e
 *   transbordava por cima e por baixo, cobrindo o "Horário de pico". Aqui o
 *   layout empilha (rosca em cima, legenda embaixo) e o cartão cresce com o
 *   conteúdo — sem altura fixa.
 */
import { formatBRL } from "@/lib/utils";
import {
  AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, PieChart, Pie, Cell,
} from "recharts";

export const CHART_COLORS_TESTE = {
  delivery: "#f97316",
  pdv: "#3b82f6",
};

const CustomTooltipTeste = ({ active, payload, label, formatter }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl shadow-xl p-3 min-w-[140px]">
      {label && <p className="text-[10px] text-muted-foreground font-semibold mb-1.5">{label}</p>}
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
            {entry.name}
          </span>
          <span className="text-xs font-black text-foreground">
            {formatter ? formatter(entry.value) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── Teto do eixo Y (Evolução) ───────────────────────────────────────────────

/**
 * Maior valor do eixo Y: 10% acima do maior ponto (delivery ou PDV),
 * arredondado para a centena seguinte. Sem dados, 100 (nunca 0).
 * Ex.: pico R$ 978,98 → 1100; pico R$ 350 → 400.
 */
export function computeYDomainMax(data: { delivery: number; pdv: number }[]): number {
  const max = Math.max(0, ...data.flatMap((d) => [d.delivery, d.pdv]));
  if (max <= 0) return 100;
  return Math.ceil((max * 1.1) / 100) * 100;
}

// ─── 1. Evolução diária (delivery + PDV) ─────────────────────────────────────

interface DailyDataTeste {
  day: string;
  delivery: number;
  pdv: number;
  total: number;
  orders_delivery: number;
  orders_pdv: number;
}

interface DailySalesChartTesteProps {
  data: DailyDataTeste[];
  showPdv?: boolean;
}

export const DailySalesChartTeste = ({ data, showPdv = true }: DailySalesChartTesteProps) => {
  const hasData = data.some((d) => d.total > 0);
  if (!hasData)
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-xs text-muted-foreground">Sem dados no período</p>
      </div>
    );

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 5, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="gradDeliveryTeste" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS_TESTE.delivery} stopOpacity={0.3} />
            <stop offset="95%" stopColor={CHART_COLORS_TESTE.delivery} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradPdvTeste" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS_TESTE.pdv} stopOpacity={0.3} />
            <stop offset="95%" stopColor={CHART_COLORS_TESTE.pdv} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(156,163,175,0.1)" />
        <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 10, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
          domain={[0, computeYDomainMax(data)]}
          tickFormatter={(v) => (v >= 1000 ? `R$${(v / 1000).toFixed(1)}k` : `R$${v}`)}
          width={48}
        />
        <Tooltip content={<CustomTooltipTeste formatter={formatBRL} />} />
        {showPdv && <Legend wrapperStyle={{ fontSize: 11 }} />}
        <Area type="monotone" dataKey="delivery" name="Delivery" stroke={CHART_COLORS_TESTE.delivery}
          strokeWidth={2} fill="url(#gradDeliveryTeste)" dot={false} activeDot={{ r: 4 }} />
        {showPdv && (
          <Area type="monotone" dataKey="pdv" name="PDV" stroke={CHART_COLORS_TESTE.pdv}
            strokeWidth={2} fill="url(#gradPdvTeste)" dot={false} activeDot={{ r: 4 }} />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
};

// ─── 2. Distribuição por método de pagamento ─────────────────────────────────

interface PaymentDataTeste {
  name: string;
  value: number;
  color: string;
}

export const PaymentBreakdownChartTeste = ({ data }: { data: PaymentDataTeste[] }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0)
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-xs text-muted-foreground">Sem dados</p>
      </div>
    );

  return (
    <div className="flex flex-col items-center gap-3">
      <ResponsiveContainer width={120} height={120}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={30} outerRadius={52}
            dataKey="value" paddingAngle={2}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltipTeste formatter={formatBRL} />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="w-full space-y-1.5 min-w-0">
        {data.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
            <span className="text-[11px] text-muted-foreground flex-1 truncate">{item.name}</span>
            <div className="text-right shrink-0">
              <p className="text-[11px] font-black text-foreground">{formatBRL(item.value)}</p>
              <p className="text-[9px] text-muted-foreground">{total > 0 ? ((item.value / total) * 100).toFixed(0) : 0}%</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
