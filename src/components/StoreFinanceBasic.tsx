import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DollarSign, TrendingUp, TrendingDown, ShoppingBag, CreditCard, Banknote, Calendar,
  Download, Wallet, Receipt, Clock, ArrowUpRight, ArrowDownRight, Target, Percent,
  AlertTriangle, QrCode, Copy, Loader2, CheckCircle2,
} from "lucide-react";
import { sumMoney, averageMoney, formatCurrency, formatBRL } from "@/lib/utils";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay, subWeeks, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useStorePlan } from "@/hooks/useStorePlan";
import { Button } from "@/components/ui/button";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";

interface StoreFinanceBasicProps {
  storeId: string;
  storeName: string;
}

type DateFilter = "today" | "week" | "month";

const COLORS = {
  pink: "#ec4899",
  blue: "#3b82f6",
  green: "#10b981",
  amber: "#f59e0b",
  purple: "#a855f7",
  cyan: "#06b6d4",
};

const PIE_COLORS = [COLORS.green, COLORS.blue, COLORS.amber];

const StoreFinanceBasic = ({ storeId, storeName }: StoreFinanceBasicProps) => {
  const [dateFilter, setDateFilter] = useState<DateFilter>("week");
  const [isGeneratingPix, setIsGeneratingPix] = useState(false);
  const [pixData, setPixData] = useState<{ qr_code: string; qr_code_base64: string; amount: number } | null>(null);
  const storePlan = useStorePlan(storeId);
  const queryClient = useQueryClient();

  // Fetch store balance (repasse_pendente)
  const { data: storeBalance } = useQuery({
    queryKey: ["store-balance", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_balances")
        .select("repasse_pendente")
        .eq("store_id", storeId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!storeId,
    refetchInterval: 30000,
  });

  const { data: minPayoutSetting } = useQuery({
    queryKey: ["min-payout-amount"],
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_settings")
        .select("value")
        .eq("key", "min_payout_amount")
        .maybeSingle();
      return Number(data?.value || 100);
    },
    staleTime: 1000 * 60 * 10,
  });

  const minPayout = minPayoutSetting ?? 100;
  const pendingFee = Number(storeBalance?.repasse_pendente || 0);
  const canPay = pendingFee >= minPayout;

  const handlePayPlatformFee = async () => {
    if (pendingFee <= 0) return;
    setIsGeneratingPix(true);
    try {
      const { data, error } = await supabase.functions.invoke("store-platform-fee-pix", {
        body: { store_id: storeId, amount: pendingFee },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPixData({ qr_code: data.qr_code, qr_code_base64: data.qr_code_base64, amount: data.amount });
      toast.success("PIX gerado! Escaneie o QR Code para pagar.");
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar PIX.");
    } finally {
      setIsGeneratingPix(false);
    }
  };

  const copyPixCode = () => {
    if (pixData?.qr_code) {
      navigator.clipboard.writeText(pixData.qr_code);
      toast.success("Código PIX copiado!");
    }
  };

  const now = new Date();
  const dateRange = useMemo(() => {
    switch (dateFilter) {
      case "today": return { start: startOfDay(now), end: endOfDay(now) };
      case "week": return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case "month": return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  }, [dateFilter]);

  const prevRange = useMemo(() => {
    switch (dateFilter) {
      case "today": {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
      }
      case "week": return { start: subWeeks(dateRange.start, 1), end: subWeeks(dateRange.end, 1) };
      case "month": return { start: subMonths(dateRange.start, 1), end: subMonths(dateRange.end, 1) };
    }
  }, [dateFilter, dateRange]);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["store-finance-basic", storeId, dateFilter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, total_price, subtotal, delivery_fee, payment_method, status, created_at")
        .eq("store_id", storeId)
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString())
        .in("status", ["pendente", "preparando", "pronto_para_entrega", "em_transito", "saiu_entrega", "entregue", "finalizado"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!storeId,
  });

  const { data: prevOrders } = useQuery({
    queryKey: ["store-finance-basic-prev", storeId, dateFilter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("subtotal, status")
        .eq("store_id", storeId)
        .gte("created_at", prevRange.start.toISOString())
        .lte("created_at", prevRange.end.toISOString())
        .in("status", ["entregue", "finalizado"]);
      if (error) throw error;
      return data || [];
    },
    enabled: !!storeId,
  });

  const completedOrders = orders?.filter(o => ["entregue", "finalizado"].includes(o.status)) || [];
  const totalSales = sumMoney(completedOrders.map(o => o.subtotal));
  const totalDeliveryFees = sumMoney(completedOrders.map(o => o.delivery_fee));
  const totalRevenue = sumMoney(completedOrders.map(o => o.total_price));
  const ticketMedio = averageMoney(totalSales, completedOrders.length);

  const prevTotalSales = sumMoney((prevOrders || []).map(o => o.subtotal));
  const growthPercent = prevTotalSales > 0 ? ((totalSales - prevTotalSales) / prevTotalSales) * 100 : 0;
  const prevLabel = dateFilter === "today" ? "ontem" : dateFilter === "week" ? "semana passada" : "mês passado";

  const paymentBreakdown = useMemo(() => {
    const pix = completedOrders.filter(o => o.payment_method === "pix");
    const card = completedOrders.filter(o => o.payment_method === "cartao");
    const cash = completedOrders.filter(o => o.payment_method !== "pix" && o.payment_method !== "cartao");
    return {
      pix: { count: pix.length, total: sumMoney(pix.map(o => o.total_price)) },
      card: { count: card.length, total: sumMoney(card.map(o => o.total_price)) },
      cash: { count: cash.length, total: sumMoney(cash.map(o => o.total_price)) },
    };
  }, [completedOrders]);

  const dailyData = useMemo(() => {
    if (!completedOrders.length) return [];
    const dayMap: Record<string, { vendas: number; pedidos: number }> = {};
    completedOrders.forEach(o => {
      const day = format(new Date(o.created_at), "dd/MM");
      if (!dayMap[day]) dayMap[day] = { vendas: 0, pedidos: 0 };
      dayMap[day].vendas += Number(o.subtotal);
      dayMap[day].pedidos += 1;
    });
    return Object.entries(dayMap).map(([day, data]) => ({ day, ...data, vendas: Math.round(data.vendas * 100) / 100 }));
  }, [completedOrders]);

  const hourlyData = useMemo(() => {
    if (!completedOrders.length) return [];
    const hours: Record<number, number> = {};
    completedOrders.forEach(o => {
      const h = new Date(o.created_at).getHours();
      hours[h] = (hours[h] || 0) + 1;
    });
    return Array.from({ length: 24 }, (_, h) => ({ hour: `${String(h).padStart(2, "0")}h`, pedidos: hours[h] || 0 })).filter(h => h.pedidos > 0 || (h.hour >= "08h" && h.hour <= "23h"));
  }, [completedOrders]);

  const donutData = useMemo(() => {
    return [
      { name: "PIX", value: paymentBreakdown.pix.count },
      { name: "Cartão", value: paymentBreakdown.card.count },
      { name: "Dinheiro", value: paymentBreakdown.cash.count },
    ].filter(d => d.value > 0);
  }, [paymentBreakdown]);

  const exportCSV = () => {
    const lines = ["Data,Vendas,Pedidos", ...dailyData.map(d => `${d.day},${d.vendas.toFixed(2)},${d.pedidos}`)];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `vendas-${storeName}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado!");
  };

  return (
    <div className="space-y-5">
      {/* Plan Info */}
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <CreditCard className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-foreground text-sm">
              Plano {storePlan.planType === "fixed" ? "Essencial" : storePlan.planType === "hybrid" ? "Crescimento" : "Comissão"}
              {storePlan.isItatingaFixed && " • Itatinga"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {formatBRL(storePlan.monthlyFee)}/mês
              {storePlan.isItatingaFixed 
                ? " • R$1/pedido PIX • Split entrega R$4+R$2"
                : storePlan.commissionRate > 0 ? ` + ${storePlan.commissionRate}% por pedido` : ""
              }
            </p>
          </div>
          {storePlan.isInTrial && (
            <span className="bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-bold px-2 py-1 rounded-full">
              Trial {storePlan.trialDaysLeft}d
            </span>
          )}
        </div>
      </div>

      {/* Platform Fee Balance Card */}
      {pendingFee > 0 && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-foreground text-sm">Taxa plataforma pendente</h3>
              <p className="text-xs text-muted-foreground">
                R$2 por entrega • Acumulado de pedidos finalizados
              </p>
            </div>
            <span className="text-lg font-black text-destructive">
              {formatCurrency(pendingFee)}
            </span>
          </div>

          {!pixData && canPay ? (
            <Button
              onClick={handlePayPlatformFee}
              disabled={isGeneratingPix}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl"
            >
              {isGeneratingPix ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Gerando PIX...</>
              ) : (
                <><QrCode className="h-4 w-4 mr-2" /> Pagar {formatCurrency(pendingFee)} via PIX</>
              )}
            </Button>
          ) : !pixData ? (
            <div className="space-y-2">
              <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-destructive/80 to-destructive rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (pendingFee / minPayout) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                PIX disponível a partir de <strong className="text-foreground">{formatBRL(minPayout)}</strong>
                {" "}— faltam <strong className="text-destructive">{formatBRL((minPayout - pendingFee)))}</strong>
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pixData.qr_code_base64 && (
                <div className="flex justify-center">
                  <img
                    src={`data:image/png;base64,${pixData.qr_code_base64}`}
                    alt="QR Code PIX"
                    className="w-48 h-48 rounded-xl border border-border"
                  />
                </div>
              )}
              <p className="text-center text-xs text-muted-foreground">
                Escaneie o QR Code ou copie o código abaixo
              </p>
              <Button
                onClick={copyPixCode}
                variant="outline"
                className="w-full rounded-xl"
              >
                <Copy className="h-4 w-4 mr-2" /> Copiar código PIX
              </Button>
              <Button
                onClick={() => {
                  setPixData(null);
                  queryClient.invalidateQueries({ queryKey: ["store-balance", storeId] });
                }}
                variant="ghost"
                className="w-full text-xs text-muted-foreground"
              >
                <CheckCircle2 className="h-3 w-3 mr-1" /> Já paguei / Fechar
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Date filter */}
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        {(["today", "week", "month"] as DateFilter[]).map(f => (
          <button key={f} onClick={() => setDateFilter(f)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              dateFilter === f ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-card text-muted-foreground hover:bg-accent border border-border"
            }`}>
            {f === "today" ? "Hoje" : f === "week" ? "Semana" : "Mês"}
          </button>
        ))}
        <span className="text-[10px] text-muted-foreground ml-auto">
          {format(dateRange.start, "dd/MM", { locale: ptBR )} — {format(dateRange.end, "dd/MM", { locale: ptBR )}
        </span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card/60 backdrop-blur-sm rounded-2xl p-4 border border-border/30 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent" />
              <div className="relative">
                <div className="flex items-center gap-1.5 mb-1">
                  <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Faturamento</p>
                </div>
                <p className="text-2xl font-black text-emerald-500 tracking-tight">{formatCurrency(totalRevenue)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{completedOrders.length} pedidos concluídos</p>
              </div>
            </div>

            <div className="bg-card/60 backdrop-blur-sm rounded-2xl p-4 border border-border/30 relative overflow-hidden">
              <div className={`absolute inset-0 bg-gradient-to-br ${growthPercent >= 0 ? "from-emerald-500/5" : "from-red-500/5"} to-transparent`} />
              <div className="relative">
                <div className="flex items-center gap-1.5 mb-1">
                  {growthPercent >= 0 ? <TrendingUp className="h-3.5 w-3.5 text-emerald-500" /> : <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Crescimento</p>
                </div>
                <p className={`text-2xl font-black tracking-tight ${growthPercent >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                  {growthPercent >= 0 ? "+" : ""}{growthPercent.toFixed(1)}%
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">vs {prevLabel}</p>
              </div>
            </div>

            <div className="bg-card/60 backdrop-blur-sm rounded-2xl p-4 border border-border/30 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent" />
              <div className="relative">
                <div className="flex items-center gap-1.5 mb-1">
                  <Target className="h-3.5 w-3.5 text-purple-500" />
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Ticket Médio</p>
                </div>
                <p className="text-2xl font-black text-purple-500 tracking-tight">{formatCurrency(ticketMedio)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">por pedido</p>
              </div>
            </div>

            <div className="bg-card/60 backdrop-blur-sm rounded-2xl p-4 border border-border/30 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent" />
              <div className="relative">
                <div className="flex items-center gap-1.5 mb-1">
                  <Banknote className="h-3.5 w-3.5 text-amber-500" />
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Tx Entrega</p>
                </div>
                <p className="text-2xl font-black text-amber-500 tracking-tight">{formatCurrency(totalDeliveryFees)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">arrecadado em fretes</p>
              </div>
            </div>
          </div>

          {/* Area Chart: Daily Sales */}
          {dailyData.length > 1 && (
            <div className="bg-card/60 backdrop-blur-sm rounded-2xl p-5 border border-border/30">
              <p className="text-xs font-bold text-foreground mb-4">📈 Evolução de Vendas</p>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyData}>
                    <defs>
                      <linearGradient id="basicSalesGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={COLORS.green} stopOpacity={0.4} />
                        <stop offset="100%" stopColor={COLORS.green} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "12px",
                        fontSize: "12px",
                        color: "hsl(var(--foreground))",
                      }}
                      formatter={(value: number) => [`${formatBRL(value)}`, "Vendas"]}
                    />
                    <Area type="monotone" dataKey="vendas" stroke={COLORS.green} strokeWidth={2.5} fill="url(#basicSalesGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Hourly Heatmap */}
          {hourlyData.length > 0 && (
            <div className="bg-card/60 backdrop-blur-sm rounded-2xl p-5 border border-border/30">
              <p className="text-xs font-bold text-foreground mb-4">🕐 Horários de Pico</p>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyData}>
                    <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} interval={1} />
                    <YAxis hide />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "12px",
                        fontSize: "12px",
                        color: "hsl(var(--foreground))",
                      }}
                      formatter={(value: number) => [`${value} pedidos`, "Horário"]}
                    />
                    <Bar dataKey="pedidos" fill={COLORS.blue} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Payment Distribution */}
          {donutData.length > 0 && (
            <div className="bg-card/60 backdrop-blur-sm rounded-2xl p-5 border border-border/30">
              <p className="text-xs font-bold text-foreground mb-4">💳 Distribuição por Pagamento</p>
              <div className="flex items-center gap-4">
                <div className="w-28 h-28 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={donutData} innerRadius={30} outerRadius={50} paddingAngle={4} dataKey="value" strokeWidth={0}>
                        {donutData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-3">
                  {[
                    { name: "PIX", data: paymentBreakdown.pix, color: COLORS.green, emoji: "⚡" },
                    { name: "Cartão", data: paymentBreakdown.card, color: COLORS.blue, emoji: "💳" },
                    { name: "Dinheiro", data: paymentBreakdown.cash, color: COLORS.amber, emoji: "💵" },
                  ].filter(p => p.data.count > 0).map((p) => (
                    <div key={p.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                        <span className="text-xs text-muted-foreground">{p.emoji} {p.name}</span>
                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{p.data.count}x</span>
                      </div>
                      <span className="text-xs font-bold text-foreground">{formatCurrency(p.data.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Revenue Breakdown */}
          <div className="bg-card/60 backdrop-blur-sm rounded-2xl p-5 border border-border/30 space-y-3">
            <p className="text-xs font-bold text-foreground">📊 Composição da Receita</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Vendas (produtos)</span>
                <span className="text-sm font-bold text-foreground">{formatCurrency(totalSales)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Taxas de entrega</span>
                <span className="text-sm font-bold text-foreground">{formatCurrency(totalDeliveryFees)}</span>
              </div>
              {storePlan.isItatingaFixed && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Taxa operacional PIX ({paymentBreakdown.pix.count}x R$1)</span>
                    <span className="text-sm font-bold text-red-500">-{formatCurrency(paymentBreakdown.pix.count)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Split entrega plataforma ({completedOrders.length}x R$2)</span>
                    <span className="text-sm font-bold text-red-500">-{formatCurrency(completedOrders.length * 2)}</span>
                  </div>
                </>
              )}
              <div className="h-px bg-border" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">
                  {storePlan.isItatingaFixed ? "Receita líquida estimada" : "Total bruto"}
                </span>
                <span className="text-sm font-black text-emerald-500">
                  {formatCurrency(
                    storePlan.isItatingaFixed
                      ? totalRevenue - paymentBreakdown.pix.count - completedOrders.length * 2
                      : totalRevenue
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Export */}
          {completedOrders.length > 0 && (
            <button onClick={exportCSV}
              className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/20">
              <Download className="h-4 w-4" /> Exportar CSV
            </button>
          )}

          {completedOrders.length === 0 && (
            <div className="text-center py-12">
              <Receipt className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">Nenhum pedido concluído neste período</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default StoreFinanceBasic;
