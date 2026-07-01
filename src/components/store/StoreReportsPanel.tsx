import { useMemo, useState, lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { Calendar as CalIcon, Download, ArrowUpRight, ArrowDownRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

const DailyRevenueChart = lazy(() =>
  import("@/components/admin/AdminCharts").then((m) => ({ default: m.DailyRevenueChart }))
);
const HourlyBarChart = lazy(() =>
  import("@/components/admin/AdminCharts").then((m) => ({ default: m.HourlyBarChart }))
);
const PaymentPieChart = lazy(() =>
  import("@/components/admin/AdminCharts").then((m) => ({ default: m.PaymentPieChart }))
);

type SubTab = "overview" | "sales" | "products" | "hours";

const PAYMENT_LABELS: Record<string, string> = {
  pix: "PIX",
  pix_online: "PIX Online",
  pix_machine: "PIX Maquineta",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  cartao_credito: "Crédito",
  cartao_debito: "Débito",
  cartao_maquineta: "Cartão Maquineta",
  online: "Online",
  outros: "Outros",
};

const SOURCE_LABELS: Record<string, string> = {
  delivery: "Delivery",
  pdv: "PDV",
  manual: "Manual",
  balcao: "Balcão",
};

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function parseISO(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
function fmtPtBR(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function growth(cur: number, prev: number) {
  if (prev > 0) return ((cur - prev) / prev) * 100;
  return cur > 0 ? 100 : 0;
}

type Preset = "hoje" | "ontem" | "7d" | "14d" | "30d" | "90d" | "custom";

export default function StoreReportsPanel({ storeId, storeName }: { storeId: string; storeName?: string }) {
  const today = useMemo(() => isoDate(new Date()), []);
  const [preset, setPreset] = useState<Preset>("hoje");
  const [startDate, setStartDate] = useState<string>(today);
  const [endDate, setEndDate] = useState<string>(today);
  const [sub, setSub] = useState<SubTab>("overview");

  function applyPreset(p: Preset) {
    setPreset(p);
    const now = new Date();
    const end = new Date(now);
    let start = new Date(now);
    if (p === "hoje") { /* same day */ }
    else if (p === "ontem") { start.setDate(now.getDate() - 1); end.setDate(now.getDate() - 1); }
    else if (p === "7d") start.setDate(now.getDate() - 6);
    else if (p === "14d") start.setDate(now.getDate() - 13);
    else if (p === "30d") start.setDate(now.getDate() - 29);
    else if (p === "90d") start.setDate(now.getDate() - 89);
    else return; // custom: mantém datas escolhidas
    setStartDate(isoDate(start));
    setEndDate(isoDate(end));
  }

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["store-report", storeId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_store_report" as any, {
        _store_id: storeId,
        _start_date: startDate,
        _end_date: endDate,
      });
      if (error) throw error;
      return data as any;
    },
    staleTime: 60_000,
    enabled: !!storeId && !!startDate && !!endDate,
  });

  const resumo = data?.resumo || {};
  const prev = data?.resumo_anterior || {};
  const receita = Number(resumo.receita_total || 0);
  const pedidos = Number(resumo.pedidos || 0);
  const ticket = Number(resumo.ticket_medio || 0);
  const cancelRate = Number(resumo.taxa_cancelamento || 0);
  const gRev = growth(receita, Number(prev.receita_total || 0));
  const gOrd = growth(pedidos, Number(prev.pedidos || 0));
  const gTk = growth(ticket, Number(prev.ticket_medio || 0));

  const dias: Array<{ data: string; pedidos: number; receita: number }> = data?.dias || [];
  const horarios: Array<{ hora: number; pedidos: number; receita: number }> = data?.horarios || [];
  const pagamentos: Array<{ metodo: string; pedidos: number; receita: number }> = data?.pagamentos || [];
  const origem: Array<{ origem: string; pedidos: number; receita: number }> = data?.origem || [];
  const produtos: Array<{ product_id: string | null; nome: string; quantidade: number; receita: number; ticket_medio: number }> = data?.produtos || [];
  const pico = data?.horario_pico as { hora?: number; pedidos?: number } | null;
  const melhor = data?.melhor_dia as { dow?: number; pedidos?: number; receita?: number } | null;

  const dailyChart = dias.map((d) => {
    const [, m, day] = d.data.split("-");
    return { day: `${day}/${m}`, vendas: Math.round(Number(d.receita) * 100) / 100, pedidos: d.pedidos };
  });
  const hourlyChart = horarios
    .map((h) => ({ hour: `${String(h.hora).padStart(2, "0")}h`, pedidos: h.pedidos }))
    .filter((h) => h.pedidos > 0 || (parseInt(h.hour) >= 8 && parseInt(h.hour) <= 23));
  const paymentPie = pagamentos.map((p) => ({
    name: PAYMENT_LABELS[p.metodo] || p.metodo || "Outros",
    value: p.pedidos,
    total: Number(p.receita || 0),
  }));
  const PIE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#a855f7", "#ef4444", "#0ea5e9"];

  const totalProdReceita = produtos.reduce((s, p) => s + Number(p.receita || 0), 0);

  function exportCSV() {
    const lines: string[] = [];
    lines.push(`Relatório - ${storeName || "Loja"}`);
    lines.push(`Período: ${fmtPtBR(startDate)} a ${fmtPtBR(endDate)}`);
    lines.push("");
    lines.push("RESUMO");
    lines.push(`Receita,${formatCurrency(receita)}`);
    lines.push(`Pedidos,${pedidos}`);
    lines.push(`Ticket Médio,${formatCurrency(ticket)}`);
    lines.push(`Cancelamentos,${resumo.cancelados || 0}`);
    lines.push(`Taxa Cancelamento,${cancelRate.toFixed(2)}%`);
    lines.push("");
    lines.push("VENDAS POR DIA");
    lines.push("Data,Pedidos,Receita");
    dias.forEach((d) => lines.push(`${fmtPtBR(d.data)},${d.pedidos},${formatCurrency(Number(d.receita))}`));
    lines.push("");
    lines.push("PRODUTOS VENDIDOS");
    lines.push("Produto,Quantidade,Receita,% do total");
    produtos.forEach((p) => {
      const pct = totalProdReceita > 0 ? (Number(p.receita) / totalProdReceita) * 100 : 0;
      lines.push(`${p.nome},${p.quantidade},${formatCurrency(Number(p.receita))},${pct.toFixed(1)}%`);
    });
    lines.push("");
    lines.push("PAGAMENTOS");
    lines.push("Método,Pedidos,Receita");
    pagamentos.forEach((p) => lines.push(`${PAYMENT_LABELS[p.metodo] || p.metodo},${p.pedidos},${formatCurrency(Number(p.receita))}`));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-${(storeName || "loja").toLowerCase().replace(/\s+/g, "-")}-${startDate}_a_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório exportado!");
  }

  const presets: { key: Preset; label: string }[] = [
    { key: "hoje", label: "Hoje" },
    { key: "ontem", label: "Ontem" },
    { key: "7d", label: "7 dias" },
    { key: "14d", label: "14 dias" },
    { key: "30d", label: "30 dias" },
    { key: "90d", label: "90 dias" },
  ];
  const subs: { key: SubTab; label: string }[] = [
    { key: "overview", label: "Visão geral" },
    { key: "sales", label: "Vendas" },
    { key: "products", label: "Produtos" },
    { key: "hours", label: "Horários" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-lg font-bold text-foreground">Relatórios Detalhados</h3>
        <button
          onClick={exportCSV}
          disabled={!data || isLoading}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-lg shadow-primary/20 disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" /> Exportar CSV
        </button>
      </div>

      {/* Preset chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        <CalIcon className="h-4 w-4 text-muted-foreground shrink-0" />
        {presets.map((p) => (
          <button
            key={p.key}
            onClick={() => applyPreset(p.key)}
            aria-pressed={preset === p.key}
            className={`px-3.5 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
              preset === p.key
                ? "bg-primary text-primary-foreground shadow shadow-primary/20"
                : "bg-card text-muted-foreground border border-border/60 hover:bg-accent"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom date range */}
      <div className="flex items-center gap-2 flex-wrap">
        <label className="text-[11px] text-muted-foreground font-semibold">De</label>
        <input
          type="date"
          value={startDate}
          max={endDate}
          onChange={(e) => { setStartDate(e.target.value); setPreset("custom"); }}
          className="px-2.5 py-1.5 rounded-lg bg-card border border-border text-xs font-semibold"
        />
        <label className="text-[11px] text-muted-foreground font-semibold">até</label>
        <input
          type="date"
          value={endDate}
          min={startDate}
          max={today}
          onChange={(e) => { setEndDate(e.target.value); setPreset("custom"); }}
          className="px-2.5 py-1.5 rounded-lg bg-card border border-border text-xs font-semibold"
        />
        <button
          onClick={() => { const t = today; setStartDate(t); setEndDate(t); setPreset("hoje"); }}
          className="text-[11px] text-primary font-bold underline underline-offset-2"
        >
          Hoje
        </button>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {subs.map((s) => (
          <button
            key={s.key}
            onClick={() => setSub(s.key)}
            aria-pressed={sub === s.key}
            className={`px-3.5 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
              sub === s.key ? "bg-foreground text-background" : "bg-card text-muted-foreground border border-border/60 hover:bg-accent"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Período: <strong>{fmtPtBR(startDate)}</strong> a <strong>{fmtPtBR(endDate)}</strong>
        {isFetching && <Loader2 className="inline h-3 w-3 ml-2 animate-spin" />}
      </p>

      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 text-destructive text-xs">
          Erro ao carregar relatório. <button onClick={() => refetch()} className="underline font-bold">Tentar novamente</button>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && pedidos === 0 && !error && (
        <div className="p-8 rounded-2xl bg-card/60 border border-border/40 text-center">
          <p className="text-sm font-bold text-foreground">Nenhuma venda no período</p>
          <p className="text-xs text-muted-foreground mt-1">Selecione outra data para ver os resultados.</p>
        </div>
      )}

      {!isLoading && pedidos > 0 && (
        <>
          {(sub === "overview" || sub === "sales") && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Receita Total", value: formatCurrency(receita), g: gRev, color: "emerald" },
                { label: "Pedidos", value: String(pedidos), g: gOrd, color: "blue" },
                { label: "Ticket Médio", value: formatCurrency(ticket), g: gTk, color: "purple" },
                { label: "Taxa Cancelamento", value: `${cancelRate.toFixed(1)}%`, g: null as number | null, color: cancelRate > 5 ? "red" : "emerald" },
              ].map((k) => (
                <div key={k.label} className="bg-card/60 backdrop-blur-sm rounded-2xl p-4 border border-border/30 relative overflow-hidden">
                  <div className={`absolute inset-0 bg-gradient-to-br from-${k.color}-500/5 to-transparent`} />
                  <div className="relative">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{k.label}</p>
                    <p className={`text-2xl font-black tracking-tight mt-1 text-${k.color}-500`}>{k.value}</p>
                    {k.g !== null && (
                      <div className={`flex items-center gap-1 mt-1 text-[10px] font-bold ${k.g >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                        {k.g >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {k.g >= 0 ? "+" : ""}{k.g.toFixed(1)}% vs período anterior
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {sub === "overview" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-card/60 rounded-2xl p-4 border border-border/30">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase">🔥 Horário de Pico</p>
                <p className="text-lg font-black text-foreground mt-1">{pico?.hora != null ? `${String(pico.hora).padStart(2, "0")}:00` : "—"}</p>
                <p className="text-[10px] text-muted-foreground">{pico?.pedidos ? `${pico.pedidos} pedidos` : "Sem dados"}</p>
              </div>
              <div className="bg-card/60 rounded-2xl p-4 border border-border/30">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase">📅 Melhor Dia</p>
                <p className="text-lg font-black text-foreground mt-1">{melhor?.dow != null ? WEEKDAYS[melhor.dow] : "—"}</p>
                <p className="text-[10px] text-muted-foreground">{melhor?.receita ? formatCurrency(Number(melhor.receita)) : "Sem dados"}</p>
              </div>
            </div>
          )}

          {(sub === "overview" || sub === "sales") && origem.length > 0 && (
            <div className="bg-card/60 rounded-2xl p-5 border border-border/30">
              <p className="text-xs font-bold text-foreground mb-3">🚦 Origem dos Pedidos</p>
              <div className="space-y-2">
                {origem.map((o) => {
                  const pct = pedidos > 0 ? (o.pedidos / pedidos) * 100 : 0;
                  return (
                    <div key={o.origem} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-foreground w-20">{SOURCE_LABELS[o.origem] || o.origem}</span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[11px] text-muted-foreground w-14 text-right">{o.pedidos}x</span>
                      <span className="text-xs font-bold text-emerald-500 w-24 text-right">{formatCurrency(Number(o.receita))}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(sub === "overview" || sub === "sales") && dailyChart.length > 1 && (
            <div className="bg-card/60 rounded-2xl p-5 border border-border/30">
              <p className="text-xs font-bold text-foreground mb-4">📈 Evolução Diária</p>
              <div className="h-48">
                <Suspense fallback={null}>
                  <DailyRevenueChart data={dailyChart} />
                </Suspense>
              </div>
            </div>
          )}

          {(sub === "overview" || sub === "hours") && hourlyChart.length > 0 && (
            <div className="bg-card/60 rounded-2xl p-5 border border-border/30">
              <p className="text-xs font-bold text-foreground mb-4">🕐 Pedidos por Horário</p>
              <div className="h-36">
                <Suspense fallback={null}>
                  <HourlyBarChart data={hourlyChart} />
                </Suspense>
              </div>
            </div>
          )}

          {(sub === "overview" || sub === "sales") && paymentPie.length > 0 && (
            <div className="bg-card/60 rounded-2xl p-5 border border-border/30">
              <p className="text-xs font-bold text-foreground mb-4">💳 Métodos de Pagamento</p>
              <div className="flex items-center gap-4">
                <div className="w-28 h-28 shrink-0">
                  <Suspense fallback={null}>
                    <PaymentPieChart data={paymentPie} colors={PIE_COLORS} />
                  </Suspense>
                </div>
                <div className="flex-1 space-y-2">
                  {paymentPie.map((p, i) => (
                    <div key={p.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-muted-foreground">{p.name}</span>
                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{p.value}x</span>
                      </div>
                      <span className="font-bold text-foreground">{formatCurrency(p.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {(sub === "overview" || sub === "products") && (
            <div className="bg-card/60 rounded-2xl p-5 border border-border/30">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-bold text-foreground">🏆 Produtos Vendidos ({produtos.length})</p>
                <p className="text-[10px] text-muted-foreground">Ordenado por quantidade</p>
              </div>
              {produtos.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Sem produtos vendidos no período</p>
              ) : (
                <div className="space-y-2.5">
                  {produtos.map((p, i) => {
                    const pct = totalProdReceita > 0 ? (Number(p.receita) / totalProdReceita) * 100 : 0;
                    return (
                      <div key={(p.product_id || "") + p.nome + i} className="flex items-center gap-3">
                        <span className={`text-xs font-black w-6 text-center ${i < 3 ? "text-amber-500" : "text-muted-foreground"}`}>
                          {i < 3 ? ["🥇", "🥈", "🥉"][i] : `${i + 1}.`}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between text-xs mb-1 gap-2">
                            <span className="font-bold text-foreground truncate">{p.nome}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-muted-foreground">{p.quantidade}x</span>
                              <span className="font-bold text-emerald-500">{formatCurrency(Number(p.receita))}</span>
                            </div>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {pct.toFixed(1)}% da receita · ticket médio {formatCurrency(Number(p.ticket_medio))}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}