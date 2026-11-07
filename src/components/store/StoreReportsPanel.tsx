import { useMemo, useState, lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { Calendar as CalIcon, Download, ArrowUpRight, ArrowDownRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import TutorialHelpButton from "@/components/TutorialHelp";

const DailyRevenueChart = lazy(() =>
  import("@/components/admin/AdminCharts").then((m) => ({ default: m.DailyRevenueChart }))
);
const HourlyBarChart = lazy(() =>
  import("@/components/admin/AdminCharts").then((m) => ({ default: m.HourlyBarChart }))
);
const PaymentPieChart = lazy(() =>
  import("@/components/admin/AdminCharts").then((m) => ({ default: m.PaymentPieChart }))
);

type SubTab = "overview" | "sales" | "products" | "hours" | "funil";

// Mapas únicos de rótulos (o mapa local antigo não cobria os valores reais
// do banco — cash, maquininha_pix, whatsapp_bot etc. vazavam crus na tela).
import { PAYMENT_METHOD_LABELS as PAYMENT_LABELS, ORDER_SOURCE_LABELS as SOURCE_LABELS } from "@/lib/orderLabels";

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

  // Pedidos brutos do período (com 1 dia de margem, filtrados pela data
  // local) — base dos cancelamentos por motivo.
  const { data: extraOrders } = useQuery({
    queryKey: ["store-report-extra", storeId, startDate, endDate],
    queryFn: async () => {
      const from = parseISO(startDate); from.setDate(from.getDate() - 1);
      const to = parseISO(endDate); to.setDate(to.getDate() + 1);
      const { data, error } = await supabase
        .from("orders")
        .select("created_at, status, cancel_reason")
        .eq("store_id", storeId)
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString());
      if (error) throw error;
      return (data || []).filter((o: any) => {
        const d = isoDate(new Date(o.created_at));
        return d >= startDate && d <= endDate;
      });
    },
    staleTime: 60_000,
    enabled: !!storeId && !!startDate && !!endDate,
  });

  // Funil da loja: eventos de page_views da loja no período (mesma margem
  // de 1 dia + filtro pela data local da query de cancelamentos).
  const { data: funnelRows } = useQuery({
    queryKey: ["store-report-funnel", storeId, startDate, endDate],
    queryFn: async () => {
      const from = parseISO(startDate); from.setDate(from.getDate() - 1);
      const to = parseISO(endDate); to.setDate(to.getDate() + 1);
      const { data, error } = await supabase
        .from("page_views")
        .select("page, visitor_hash, created_at")
        .eq("store_id", storeId)
        .in("page", ["store_page", "product_view", "cart_view", "checkout"])
        .gte("created_at", from.toISOString())
        .lte("created_at", to.toISOString())
        .limit(20000);
      if (error) throw error;
      return (data || []).filter((r: any) => {
        const d = isoDate(new Date(r.created_at));
        return d >= startDate && d <= endDate;
      });
    },
    staleTime: 60_000,
    enabled: !!storeId && !!startDate && !!endDate,
  });

  // Catálogo ativo da loja — base dos "nunca venderam no período".
  const { data: catalogProducts } = useQuery({
    queryKey: ["store-catalog-products", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name")
        .eq("store_id", storeId)
        .eq("is_available", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    staleTime: 300_000,
    enabled: !!storeId,
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

  // Semana completa: agrega as linhas por data da RPC no dia da semana.
  const weekdayStats = useMemo(() => {
    const acc = WEEKDAYS.map((label, dow) => ({ label, dow, pedidos: 0, receita: 0 }));
    for (const d of dias) {
      const dow = parseISO(d.data).getDay();
      acc[dow].pedidos += Number(d.pedidos || 0);
      acc[dow].receita += Number(d.receita || 0);
    }
    return [1, 2, 3, 4, 5, 6, 0].map((dow) => acc[dow]);
  }, [dias]);
  const weekdayMaxReceita = Math.max(0, ...weekdayStats.map((w) => w.receita));

  // Cancelamentos por motivo: códigos conhecidos viram rótulo; motivo em
  // texto livre aparece como foi escrito; sem registro tem balde próprio.
  const cancelStats = useMemo(() => {
    const CANCEL_LABELS: Record<string, string> = {
      client_request: "Cliente pediu",
      pix_expirado: "Pix expirado",
      out_of_stock: "Falta de estoque",
      store_closed: "Loja fechada",
      other: "Outro motivo",
    };
    const map = new Map<string, number>();
    let total = 0;
    for (const o of extraOrders || []) {
      if (o.status !== "cancelado") continue;
      total += 1;
      const raw = String(o.cancel_reason || "").trim();
      const label = !raw ? "Sem motivo registrado" : CANCEL_LABELS[raw.toLowerCase()] || raw;
      map.set(label, (map.get(label) || 0) + 1);
    }
    const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 8).map(([label, count]) => ({ label, count }));
    const rest = sorted.slice(8).reduce((s, [, c]) => s + c, 0);
    if (rest > 0) top.push({ label: "Outros motivos", count: rest });
    return { total, rows: top };
  }, [extraOrders]);

  // Curva ABC sobre a receita de itens: A concentra até 80%, B até 95%.
  const abc = useMemo(() => {
    const sorted = [...produtos].sort((a, b) => Number(b.receita || 0) - Number(a.receita || 0));
    const total = sorted.reduce((sum, p) => sum + Number(p.receita || 0), 0);
    const byKey = new Map<string, "A" | "B" | "C">();
    const counts = { A: 0, B: 0, C: 0 };
    const rev = { A: 0, B: 0, C: 0 };
    let cum = 0;
    for (const p of sorted) {
      const prevShare = total > 0 ? cum / total : 1;
      const cls: "A" | "B" | "C" = prevShare < 0.8 ? "A" : prevShare < 0.95 ? "B" : "C";
      byKey.set((p.product_id || "") + p.nome, cls);
      counts[cls] += 1;
      rev[cls] += Number(p.receita || 0);
      cum += Number(p.receita || 0);
    }
    return { byKey, counts, rev, total };
  }, [produtos]);

  const neverSold = useMemo(() => {
    const sold = new Set(produtos.map((p) => p.product_id).filter(Boolean));
    return (catalogProducts || []).filter((p: any) => !sold.has(p.id));
  }, [catalogProducts, produtos]);

  // Etapas do funil: visualizações e visitantes únicos por evento.
  const funnelStages = useMemo(() => {
    const defs = [
      { page: "store_page", label: "Visitaram a loja" },
      { page: "product_view", label: "Viram um produto" },
      { page: "cart_view", label: "Abriram o carrinho" },
      { page: "checkout", label: "Foram ao checkout" },
    ];
    return defs.map((d) => {
      const rows = (funnelRows || []).filter((r: any) => r.page === d.page);
      const uniques = new Set(rows.map((r: any) => r.visitor_hash).filter(Boolean)).size;
      return { ...d, views: rows.length, uniques };
    });
  }, [funnelRows]);
  const funnelTop = Math.max(1, funnelStages[0]?.uniques || 0);

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
    { key: "funil", label: "Funil" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-lg font-bold text-foreground">Relatórios Detalhados</h3>
        <div className="flex items-center gap-2">
        <TutorialHelpButton tutorialId="reports" />
        <button
          onClick={exportCSV}
          disabled={!data || isLoading}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-lg shadow-primary/20 disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" /> Exportar CSV
        </button>
        </div>
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

      {!isLoading && pedidos === 0 && !error && sub !== "funil" && (
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

          {(sub === "overview" || sub === "hours") && weekdayMaxReceita > 0 && (
            <div className="bg-card/60 rounded-2xl p-5 border border-border/30">
              <p className="text-xs font-bold text-foreground mb-3">📅 Dias da Semana</p>
              <div className="space-y-2">
                {weekdayStats.map((w) => {
                  const pct = weekdayMaxReceita > 0 ? (w.receita / weekdayMaxReceita) * 100 : 0;
                  const isBest = w.receita === weekdayMaxReceita && w.receita > 0;
                  return (
                    <div key={w.dow} className="flex items-center gap-3">
                      <span className={`text-xs font-bold w-10 ${isBest ? "text-primary" : "text-foreground"}`}>{w.label}</span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[11px] text-muted-foreground w-16 text-right">{w.pedidos}x</span>
                      <span className="text-xs font-bold text-foreground w-24 text-right">{formatCurrency(w.receita)}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground mt-3">A semana inteira do período — o dia em destaque é o que mais vende.</p>
            </div>
          )}

          {(sub === "overview" || sub === "sales") && cancelStats.total > 0 && (
            <div className="bg-card/60 rounded-2xl p-5 border border-border/30">
              <p className="text-xs font-bold text-foreground mb-3">❌ Cancelamentos por Motivo ({cancelStats.total})</p>
              <div className="space-y-2">
                {cancelStats.rows.map((r) => {
                  const pct = cancelStats.total > 0 ? (r.count / cancelStats.total) * 100 : 0;
                  return (
                    <div key={r.label} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-foreground flex-1 min-w-0 truncate" title={r.label}>{r.label}</span>
                      <div className="w-28 h-2 bg-muted rounded-full overflow-hidden shrink-0">
                        <div className="h-full bg-destructive rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[11px] text-muted-foreground w-16 text-right shrink-0">{r.count}x · {pct.toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground mt-3">Por que os pedidos do período foram cancelados — é aqui que aparece o vazamento pra corrigir.</p>
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

          {sub === "products" && produtos.length > 0 && (
            <div className="bg-card/60 rounded-2xl p-4 border border-border/30">
              <p className="text-xs font-bold text-foreground">
                Curva ABC: <span className="text-primary">A = {abc.counts.A} produtos · {abc.total > 0 ? ((abc.rev.A / abc.total) * 100).toFixed(0) : 0}% da receita</span>
                {" · "}B = {abc.counts.B} · C = {abc.counts.C}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">Poucos produtos pagam a conta: a classe A concentra a receita de itens do período. A etiqueta A/B/C aparece em cada produto da lista abaixo.</p>
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
                            {(() => {
                              const cls = abc.byKey.get((p.product_id || "") + p.nome);
                              if (!cls) return null;
                              const clsStyle = cls === "A" ? "bg-primary text-primary-foreground" : cls === "B" ? "bg-foreground text-background" : "bg-muted text-muted-foreground";
                              return <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0 ${clsStyle}`}>{cls}</span>;
                            })()}
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
          {sub === "products" && neverSold.length > 0 && (
            <div className="bg-card/60 rounded-2xl p-5 border border-border/30">
              <p className="text-xs font-bold text-foreground mb-2">💤 Sem Vendas no Período ({neverSold.length})</p>
              <p className="text-[10px] text-muted-foreground mb-3">Produtos ativos do cardápio que não venderam nenhuma unidade no período — candidatos a sair do cardápio, virar combo ou ganhar destaque.</p>
              <div className="flex flex-wrap gap-1.5">
                {neverSold.map((p: any) => (
                  <span key={p.id} className="text-[11px] font-semibold bg-muted text-muted-foreground px-2 py-1 rounded-full">{p.name}</span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {sub === "funil" && !isLoading && (
        <div className="bg-card/60 rounded-2xl p-5 border border-border/30">
          <p className="text-xs font-bold text-foreground mb-1">🧭 Funil da Loja</p>
          <p className="text-[10px] text-muted-foreground mb-4">Do clique na vitrine ao checkout, no período selecionado. Visitantes = pessoas diferentes; visualizações = total de aberturas.</p>
          <div className="space-y-3">
            {funnelStages.map((st) => {
              const pct = (st.uniques / funnelTop) * 100;
              return (
                <div key={st.page}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-bold text-foreground">{st.label}</span>
                    <span className="text-xs text-muted-foreground"><strong className="text-foreground text-sm">{st.uniques}</strong> visitantes · {st.views} visualizações · {pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden mt-1">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                </div>
              );
            })}
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-bold text-foreground">Viraram pedido</span>
                <span className="text-xs text-muted-foreground"><strong className="text-foreground text-sm">{pedidos}</strong> pedidos no período</span>
              </div>
              <div className="h-2.5 bg-muted rounded-full overflow-hidden mt-1">
                <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, (pedidos / funnelTop) * 100)}%` }} />
              </div>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-4">As etapas "viram um produto" e "abriram o carrinho" começaram a ser medidas agora — antes, só visita e checkout eram registrados. Os números dessas duas etapas crescem a partir de hoje.</p>
        </div>
      )}
    </div>
  );
}