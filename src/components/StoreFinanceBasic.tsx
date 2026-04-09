import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, TrendingUp, ShoppingBag, CreditCard, Banknote, Calendar, Download } from "lucide-react";
import { sumMoney, averageMoney, formatCurrency } from "@/lib/utils";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";
import { useStorePlan } from "@/hooks/useStorePlan";

interface StoreFinanceBasicProps {
  storeId: string;
  storeName: string;
}

type DateFilter = "today" | "week" | "month";

const StoreFinanceBasic = ({ storeId, storeName }: StoreFinanceBasicProps) => {
  const [dateFilter, setDateFilter] = useState<DateFilter>("week");
  const storePlan = useStorePlan(storeId);

  const now = new Date();
  const dateRange = useMemo(() => {
    switch (dateFilter) {
      case "today": return { start: startOfDay(now), end: endOfDay(now) };
      case "week": return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case "month": return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  }, [dateFilter]);

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

  const completedOrders = orders?.filter(o => ["entregue", "finalizado"].includes(o.status)) || [];
  const totalSales = sumMoney(completedOrders.map(o => o.subtotal));
  const totalDeliveryFees = sumMoney(completedOrders.map(o => o.delivery_fee));
  const totalRevenue = sumMoney(completedOrders.map(o => o.total_price));
  const ticketMedio = averageMoney(totalSales, completedOrders.length);

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

  // Daily sales for bar chart
  const dailyData = useMemo(() => {
    if (!completedOrders.length) return [];
    const dayMap: Record<string, { vendas: number; pedidos: number }> = {};
    completedOrders.forEach(o => {
      const day = format(new Date(o.created_at), "dd/MM");
      if (!dayMap[day]) dayMap[day] = { vendas: 0, pedidos: 0 };
      dayMap[day].vendas += Number(o.subtotal);
      dayMap[day].pedidos += 1;
    });
    return Object.entries(dayMap).map(([day, data]) => ({ day, ...data }));
  }, [completedOrders]);

  const exportCSV = () => {
    const lines = ["Data,Vendas,Pedidos", ...dailyData.map(d => `${d.day},${d.vendas.toFixed(2)},${d.pedidos}`)];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `vendas-${storeName}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado!");
  };

  return (
    <div className="space-y-6">
      {/* Subscription Info */}
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <CreditCard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-sm">Plano {storePlan.planType === "fixed" ? "Fixo Mensal" : "Assinatura + Taxa"}</h3>
            <p className="text-xs text-muted-foreground">
              R$ {storePlan.monthlyFee.toFixed(2)}/mês
              {storePlan.commissionRate > 0 && ` + ${storePlan.commissionRate}% por pedido`}
            </p>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {storePlan.planType === "fixed"
            ? "Sua assinatura mensal inclui acesso ao painel, cardápio digital e gestão de pedidos. Sem cobranças por pedido."
            : "Sua assinatura mensal inclui todos os recursos da plataforma, com taxa reduzida por pedido entregue."}
        </p>
      </div>

      {/* Date filter */}
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        {(["today", "week", "month"] as DateFilter[]).map(f => (
          <button key={f} onClick={() => setDateFilter(f)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              dateFilter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
            }`}>
            {f === "today" ? "Hoje" : f === "week" ? "Semana" : "Mês"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-card border border-border rounded-2xl p-4 text-center">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center mx-auto mb-2">
                <DollarSign className="h-4 w-4 text-emerald-500" />
              </div>
              <p className="text-xl font-black text-emerald-500">{formatCurrency(totalRevenue)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Faturamento Total</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4 text-center">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center mx-auto mb-2">
                <ShoppingBag className="h-4 w-4 text-blue-500" />
              </div>
              <p className="text-xl font-black text-foreground">{completedOrders.length}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Pedidos Concluídos</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4 text-center">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center mx-auto mb-2">
                <TrendingUp className="h-4 w-4 text-purple-500" />
              </div>
              <p className="text-xl font-black text-foreground">{formatCurrency(ticketMedio)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Ticket Médio</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4 text-center">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center mx-auto mb-2">
                <Banknote className="h-4 w-4 text-amber-500" />
              </div>
              <p className="text-xl font-black text-foreground">{formatCurrency(totalDeliveryFees)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Taxas de Entrega</p>
            </div>
          </div>

          {/* Payment Methods Breakdown */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <h4 className="text-sm font-bold text-foreground mb-3">Métodos de Pagamento</h4>
            <div className="space-y-3">
              {paymentBreakdown.cash.count > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">💵</span>
                    <span className="text-sm text-foreground font-medium">Dinheiro</span>
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{paymentBreakdown.cash.count}x</span>
                  </div>
                  <span className="text-sm font-bold text-foreground">{formatCurrency(paymentBreakdown.cash.total)}</span>
                </div>
              )}
              {paymentBreakdown.card.count > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">💳</span>
                    <span className="text-sm text-foreground font-medium">Cartão</span>
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{paymentBreakdown.card.count}x</span>
                  </div>
                  <span className="text-sm font-bold text-foreground">{formatCurrency(paymentBreakdown.card.total)}</span>
                </div>
              )}
              {paymentBreakdown.pix.count > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">⚡</span>
                    <span className="text-sm text-foreground font-medium">PIX</span>
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{paymentBreakdown.pix.count}x</span>
                  </div>
                  <span className="text-sm font-bold text-foreground">{formatCurrency(paymentBreakdown.pix.total)}</span>
                </div>
              )}
              {completedOrders.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhum pedido neste período</p>
              )}
            </div>
          </div>

          {/* Simple Bar Chart */}
          {dailyData.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-4">
              <h4 className="text-sm font-bold text-foreground mb-3">Vendas por Dia</h4>
              <div className="flex items-end gap-2 h-32">
                {dailyData.map((d, i) => {
                  const max = Math.max(...dailyData.map(x => x.vendas), 1);
                  const height = (d.vendas / max) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[9px] text-muted-foreground font-bold">R${d.vendas.toFixed(0)}</span>
                      <div className="w-full rounded-t-lg bg-primary/80 transition-all" style={{ height: `${Math.max(height, 4)}%` }} />
                      <span className="text-[9px] text-muted-foreground">{d.day}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Export */}
          {completedOrders.length > 0 && (
            <button onClick={exportCSV} className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2">
              <Download className="h-4 w-4" /> Exportar CSV
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default StoreFinanceBasic;
