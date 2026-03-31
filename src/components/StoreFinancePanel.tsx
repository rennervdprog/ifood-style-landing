import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Download, ArrowUpRight, ArrowDownRight, Smartphone, Banknote } from "lucide-react";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface StoreFinancePanelProps {
  storeId: string;
  storeName: string;
}

type Period = "week" | "month";

const StoreFinancePanel = ({ storeId, storeName }: StoreFinancePanelProps) => {
  const [period, setPeriod] = useState<Period>("week");

  const now = new Date();
  const dateRange = period === "week"
    ? { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) }
    : { start: startOfMonth(now), end: endOfMonth(now) };

  const { data: orders, isLoading } = useQuery({
    queryKey: ["store-finance-orders", storeId, period],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, total_price, subtotal, delivery_fee, app_fee, payment_method, status, created_at, confirmed_at")
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
  const activeOrders = orders?.filter(o => !["entregue", "finalizado"].includes(o.status)) || [];

  const totalSales = completedOrders.reduce((s, o) => s + Number(o.subtotal), 0);
  const totalCommission = Math.round(totalSales * 0.15 * 100) / 100;
  const storePart = Math.round(totalSales * 0.85 * 100) / 100;

  const physicalSales = completedOrders.filter(o => o.payment_method !== "pix").reduce((s, o) => s + Number(o.subtotal), 0);
  const commissionDue = Math.round(physicalSales * 0.15 * 100) / 100;

  const appSales = completedOrders.filter(o => o.payment_method === "pix").reduce((s, o) => s + Number(o.subtotal), 0);
  const creditFromApp = Math.round(appSales * 0.85 * 100) / 100;

  const activePixSales = activeOrders.filter(o => o.payment_method === "pix").reduce((s, o) => s + Number(o.subtotal), 0);

  const finalBalance = Math.round((creditFromApp - commissionDue) * 100) / 100;

  const periodLabel = period === "week" ? "Semana" : "Mês";

  const copyToClipboard = () => {
    const text = `📊 Resumo Financeiro FoodIta - ${storeName}\n` +
      `Período: ${format(dateRange.start, "dd/MM", { locale: ptBR })} a ${format(dateRange.end, "dd/MM/yyyy", { locale: ptBR })}\n\n` +
      `💰 Vendas Totais: R$ ${totalSales.toFixed(2)}\n` +
      `🏪 Minha Parte (85%): R$ ${storePart.toFixed(2)}\n` +
      `📱 Comissão FoodIta (15%): R$ ${totalCommission.toFixed(2)}\n\n` +
      `--- Detalhes ---\n` +
      `Vendas Presenciais: R$ ${physicalSales.toFixed(2)}\n` +
      `Vendas PIX App: R$ ${appSales.toFixed(2)}\n` +
      `Saldo de Acerto: R$ ${Math.abs(finalBalance).toFixed(2)} ${finalBalance >= 0 ? "(Admin deve à Loja)" : "(Loja deve ao Admin)"}`;
    navigator.clipboard.writeText(text);
    toast.success("Resumo copiado!");
  };

  const downloadTxt = () => {
    const lines = [
      `EXTRATO FINANCEIRO FOODITA - ${storeName.toUpperCase()}`,
      `Período: ${format(dateRange.start, "dd/MM/yyyy")} a ${format(dateRange.end, "dd/MM/yyyy")}`,
      ``,
      `VENDAS TOTAIS: R$ ${totalSales.toFixed(2)}`,
      `MINHA PARTE (85%): R$ ${storePart.toFixed(2)}`,
      `COMISSÃO FOODITA (15%): R$ ${totalCommission.toFixed(2)}`,
      ``,
      `VENDAS PRESENCIAIS (Dinheiro/Cartão): R$ ${physicalSales.toFixed(2)}`,
      `VENDAS PIX APP: R$ ${appSales.toFixed(2)}`,
      `SALDO DE ACERTO: R$ ${Math.abs(finalBalance).toFixed(2)} ${finalBalance >= 0 ? "(Admin deve à Loja)" : "(Loja deve ao Admin)"}`,
      ``,
      `--- PEDIDOS ---`,
      ...(orders || []).map(o =>
        `#${o.id.substring(0, 6).toUpperCase()} | ${format(new Date(o.created_at), "dd/MM HH:mm")} | ${o.payment_method === "pix" ? "PIX App" : o.payment_method === "cartao" ? "Cartão" : "Dinheiro"} | R$ ${Number(o.subtotal).toFixed(2)} | Comissão: R$ ${(Number(o.subtotal) * 0.15).toFixed(2)}`
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `extrato-${storeName.toLowerCase().replace(/\s+/g, "-")}-${format(now, "yyyy-MM-dd")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Extrato baixado!");
  };

  return (
    <div className="space-y-5">
      {/* Period selector */}
      <div className="flex gap-2">
        {(["week", "month"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              period === p
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {p === "week" ? "Semana" : "Mês"}
          </button>
        ))}
        <span className="flex items-center text-xs text-muted-foreground ml-auto">
          {format(dateRange.start, "dd/MM", { locale: ptBR })} — {format(dateRange.end, "dd/MM", { locale: ptBR })}
        </span>
      </div>

      {/* Main summary card */}
      <div className="bg-card rounded-2xl p-5 border border-border">
        <p className="text-xs text-muted-foreground mb-1">Vendas Totais ({periodLabel})</p>
        <p className="text-3xl font-black text-foreground tracking-tight">R$ {totalSales.toFixed(2)}</p>
        <p className="text-xs text-muted-foreground mt-1">{completedOrders.length} pedidos finalizados</p>

        <div className="grid grid-cols-2 gap-4 mt-5 pt-4 border-t border-border">
          <div>
            <p className="text-xs text-muted-foreground">Minha Parte (85%)</p>
            <p className="text-xl font-bold text-green-500">R$ {storePart.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Comissão FoodIta (15%)</p>
            <p className="text-xl font-bold text-muted-foreground">R$ {totalCommission.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Balance card */}
      <div className="bg-card rounded-2xl p-5 border border-border">
        <p className="text-xs text-muted-foreground mb-2">Saldo de Acerto</p>
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center ${finalBalance >= 0 ? "bg-green-500/10" : "bg-red-500/10"}`}>
            {finalBalance >= 0
              ? <ArrowUpRight className="h-5 w-5 text-green-500" />
              : <ArrowDownRight className="h-5 w-5 text-red-500" />
            }
          </div>
          <p className={`text-2xl font-black ${finalBalance >= 0 ? "text-green-500" : "text-red-500"}`}>
            R$ {Math.abs(finalBalance).toFixed(2)}
          </p>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          {finalBalance >= 0
            ? "Você tem a receber do FoodIta no próximo fechamento."
            : "Você possui comissões pendentes para o fechamento de segunda-feira."}
        </p>
      </div>

      {/* Transaction breakdown */}
      <div className="bg-card rounded-2xl border border-border divide-y divide-border">
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Banknote className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Vendas Presenciais</p>
              <p className="text-xs text-muted-foreground">Dinheiro / Cartão</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-foreground">R$ {physicalSales.toFixed(2)}</p>
            <p className="text-xs text-red-500">- R$ {commissionDue.toFixed(2)} comissão</p>
          </div>
        </div>

        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
              <Smartphone className="h-4 w-4 text-green-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Vendas PIX App</p>
              <p className="text-xs text-muted-foreground">Pago online</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-foreground">R$ {appSales.toFixed(2)}</p>
            <p className="text-xs text-green-500">+ R$ {creditFromApp.toFixed(2)} crédito</p>
          </div>
        </div>
      </div>

      {/* Export buttons */}
      <div className="flex gap-2">
        <button onClick={copyToClipboard} className="flex-1 flex items-center justify-center gap-2 bg-muted hover:bg-muted/80 text-foreground rounded-xl py-3 text-sm font-medium transition-colors">
          <Copy className="h-4 w-4" /> Copiar
        </button>
        <button onClick={downloadTxt} className="flex-1 flex items-center justify-center gap-2 bg-muted hover:bg-muted/80 text-foreground rounded-xl py-3 text-sm font-medium transition-colors">
          <Download className="h-4 w-4" /> Baixar Extrato
        </button>
      </div>

      {/* Active PIX orders */}
      {activeOrders.filter(o => o.payment_method === "pix").length > 0 && (
        <div className="bg-card rounded-2xl p-4 border border-blue-500/20 space-y-2">
          <p className="text-sm font-semibold text-blue-500">Pedidos PIX em Andamento</p>
          <p className="text-xs text-muted-foreground">Já pagos via PIX — serão contabilizados ao finalizar.</p>
          {activeOrders.filter(o => o.payment_method === "pix").map(order => (
            <div key={order.id} className="flex justify-between text-xs bg-blue-500/5 rounded-lg p-2.5">
              <span className="text-blue-500 font-semibold">#{order.id.substring(0, 6).toUpperCase()}</span>
              <span className="text-foreground font-medium">R$ {Number(order.subtotal).toFixed(2)}</span>
              <span className="text-muted-foreground capitalize">{order.status.replace(/_/g, " ")}</span>
            </div>
          ))}
          <div className="flex justify-between text-xs pt-2 border-t border-border">
            <span className="text-muted-foreground">Total em andamento</span>
            <span className="text-blue-500 font-bold">R$ {activePixSales.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Order list */}
      {isLoading ? (
        <p className="text-muted-foreground text-center py-8 text-sm">Carregando...</p>
      ) : completedOrders.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Extrato de Pedidos</p>
          {completedOrders.map(order => {
            const sub = Number(order.subtotal);
            const commission = Math.round(sub * 0.15 * 100) / 100;
            const net = Math.round(sub * 0.85 * 100) / 100;
            const isPix = order.payment_method === "pix";
            return (
              <div key={order.id} className="bg-card rounded-xl p-3 border border-border flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isPix ? "bg-green-500/10" : "bg-amber-500/10"}`}>
                  {isPix ? <Smartphone className="h-4 w-4 text-green-500" /> : <Banknote className="h-4 w-4 text-amber-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">#{order.id.substring(0, 6).toUpperCase()}</span>
                    <span className="text-xs text-muted-foreground">{format(new Date(order.created_at), "dd/MM HH:mm")}</span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-xs text-muted-foreground">
                      {isPix ? "PIX App" : order.payment_method === "cartao" ? "Cartão" : "Dinheiro"}
                    </span>
                    <span className="text-sm font-bold text-foreground">R$ {sub.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-[10px] text-muted-foreground">Comissão: R$ {commission.toFixed(2)}</span>
                    <span className="text-xs font-semibold text-green-500">Líquido: R$ {net.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-muted-foreground text-center py-8 text-sm">Nenhum pedido finalizado neste período.</p>
      )}
    </div>
  );
};

export default StoreFinancePanel;
