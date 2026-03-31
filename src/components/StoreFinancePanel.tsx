import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, TrendingUp, Wallet, Copy, Download, ArrowUpRight, ArrowDownRight } from "lucide-react";
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

  // Calculations
  const totalSales = orders?.reduce((s, o) => s + Number(o.subtotal), 0) || 0;
  const totalCommission = Math.round(totalSales * 0.15 * 100) / 100;
  const storePart = Math.round(totalSales * 0.85 * 100) / 100;

  // Physical payments (money is with the store) → store owes 15% commission
  const physicalSales = orders?.filter(o => o.payment_method !== "pix").reduce((s, o) => s + Number(o.subtotal), 0) || 0;
  const commissionDue = Math.round(physicalSales * 0.15 * 100) / 100;

  // App payments (money is with admin) → admin owes 85% to store
  const appSales = orders?.filter(o => o.payment_method === "pix").reduce((s, o) => s + Number(o.subtotal), 0) || 0;
  const creditFromApp = Math.round(appSales * 0.85 * 100) / 100;

  // Positive = admin owes store, Negative = store owes admin
  const finalBalance = Math.round((creditFromApp - commissionDue) * 100) / 100;

  const periodLabel = period === "week" ? "Semana" : "Mês";

  const copyToClipboard = () => {
    const text = `📊 Resumo Financeiro ItaFood - ${storeName}\n` +
      `Período: ${format(dateRange.start, "dd/MM", { locale: ptBR })} a ${format(dateRange.end, "dd/MM/yyyy", { locale: ptBR })}\n\n` +
      `💰 Vendas Totais: R$ ${totalSales.toFixed(2)}\n` +
      `🏪 Minha Parte (85%): R$ ${storePart.toFixed(2)}\n` +
      `📱 Comissão ItaFood (15%): R$ ${totalCommission.toFixed(2)}\n\n` +
      `--- Detalhes ---\n` +
      `Vendas Presenciais: R$ ${physicalSales.toFixed(2)}\n` +
      `Vendas PIX App: R$ ${appSales.toFixed(2)}\n` +
      `Saldo de Acerto: R$ ${Math.abs(finalBalance).toFixed(2)} ${finalBalance >= 0 ? "(Admin deve à Loja)" : "(Loja deve ao Admin)"}`;
    navigator.clipboard.writeText(text);
    toast.success("Resumo copiado!");
  };

  const downloadTxt = () => {
    const lines = [
      `EXTRATO FINANCEIRO ITAFOOD - ${storeName.toUpperCase()}`,
      `Período: ${format(dateRange.start, "dd/MM/yyyy")} a ${format(dateRange.end, "dd/MM/yyyy")}`,
      ``,
      `VENDAS TOTAIS: R$ ${totalSales.toFixed(2)}`,
      `MINHA PARTE (85%): R$ ${storePart.toFixed(2)}`,
      `COMISSÃO ITAFOOD (15%): R$ ${totalCommission.toFixed(2)}`,
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
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex gap-2">
        <button
          onClick={() => setPeriod("week")}
          className={`px-4 py-2 rounded-xl text-sm font-bold ${period === "week" ? "bg-primary text-primary-foreground" : "bg-gray-700 text-gray-400"}`}
        >
          Semana
        </button>
        <button
          onClick={() => setPeriod("month")}
          className={`px-4 py-2 rounded-xl text-sm font-bold ${period === "month" ? "bg-primary text-primary-foreground" : "bg-gray-700 text-gray-400"}`}
        >
          Mês
        </button>
      </div>

      <p className="text-xs text-gray-400">
        {format(dateRange.start, "dd/MM", { locale: ptBR })} a {format(dateRange.end, "dd/MM/yyyy", { locale: ptBR })}
      </p>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-3">
        <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
            <DollarSign className="h-4 w-4" />
            Vendas Totais ({periodLabel})
          </div>
          <p className="text-2xl font-black text-white">R$ {totalSales.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">{orders?.length || 0} pedidos finalizados</p>
        </div>

        <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
            <TrendingUp className="h-4 w-4" />
            Minha Parte (85%)
          </div>
          <p className="text-2xl font-black text-green-400">R$ {storePart.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">Comissão ItaFood: R$ {totalCommission.toFixed(2)}</p>
        </div>

        <div className={`rounded-2xl p-4 border ${finalBalance >= 0 ? "bg-green-900/30 border-green-700" : "bg-red-900/30 border-red-700"}`}>
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
            <Wallet className="h-4 w-4" />
            Saldo de Acerto
          </div>
          <div className="flex items-center gap-2">
            {finalBalance >= 0 ? (
              <ArrowUpRight className="h-5 w-5 text-green-400" />
            ) : (
              <ArrowDownRight className="h-5 w-5 text-red-400" />
            )}
            <p className={`text-2xl font-black ${finalBalance >= 0 ? "text-green-400" : "text-red-400"}`}>
              R$ {Math.abs(finalBalance).toFixed(2)}
            </p>
          </div>
          <p className="text-xs mt-2">
            {finalBalance >= 0
              ? "💰 Você tem a receber do ItaFood no próximo fechamento."
              : "⚠️ Você possui comissões pendentes para o fechamento de segunda-feira."}
          </p>
        </div>
      </div>

      {/* Breakdown */}
      <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700 space-y-2">
        <h3 className="text-sm font-bold text-gray-300">Detalhamento</h3>
        <div className="flex justify-between text-xs">
          <span className="text-yellow-400">💵 Vendas Presenciais (Dinheiro/Cartão)</span>
          <span className="text-white font-bold">R$ {physicalSales.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">→ Comissão devida (15%)</span>
          <span className="text-red-400 font-bold">- R$ {commissionDue.toFixed(2)}</span>
        </div>
        <div className="border-t border-gray-700 my-2" />
        <div className="flex justify-between text-xs">
          <span className="text-green-400">📱 Vendas PIX App</span>
          <span className="text-white font-bold">R$ {appSales.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">→ Seu crédito (85%)</span>
          <span className="text-green-400 font-bold">+ R$ {creditFromApp.toFixed(2)}</span>
        </div>
      </div>

      {/* Export buttons */}
      <div className="flex gap-2">
        <button onClick={copyToClipboard} className="flex-1 flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white rounded-xl py-3 text-sm font-bold">
          <Copy className="h-4 w-4" /> Copiar Resumo
        </button>
        <button onClick={downloadTxt} className="flex-1 flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white rounded-xl py-3 text-sm font-bold">
          <Download className="h-4 w-4" /> Baixar Extrato
        </button>
      </div>

      {/* Order table */}
      {isLoading ? (
        <p className="text-gray-400 text-center py-8 text-sm">Carregando...</p>
      ) : orders && orders.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-gray-300">Extrato por Pedido</h3>
          {orders.map(order => {
            const sub = Number(order.subtotal);
            const commission = Math.round(sub * 0.15 * 100) / 100;
            const net = Math.round(sub * 0.85 * 100) / 100;
            const isPix = order.payment_method === "pix";
            return (
              <div key={order.id} className={`rounded-xl p-3 border text-xs ${isPix ? "bg-green-900/20 border-green-800" : "bg-yellow-900/20 border-yellow-800"}`}>
                <div className="flex justify-between mb-1">
                  <span className="font-bold text-white">#{order.id.substring(0, 6).toUpperCase()}</span>
                  <span className="text-gray-400">{format(new Date(order.created_at), "dd/MM HH:mm")}</span>
                </div>
                <div className="flex justify-between">
                  <span className={isPix ? "text-green-400" : "text-yellow-400"}>
                    {isPix ? "📱 PIX App" : order.payment_method === "cartao" ? "💳 Cartão" : "💵 Dinheiro"}
                  </span>
                  <span className="text-white">R$ {sub.toFixed(2)}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-gray-500">Comissão 15%</span>
                  <span className="text-red-400">- R$ {commission.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Líquido</span>
                  <span className="text-green-400 font-bold">R$ {net.toFixed(2)}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-gray-400 text-center py-8 text-sm">Nenhum pedido finalizado neste período.</p>
      )}
    </div>
  );
};

export default StoreFinancePanel;
