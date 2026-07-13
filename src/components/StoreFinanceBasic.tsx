import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DollarSign, TrendingUp, TrendingDown, ShoppingBag, CreditCard, Banknote, Calendar,
  Download, Wallet, Receipt, Clock, ArrowUpRight, ArrowDownRight, Target, Percent,
  AlertTriangle, QrCode, Copy, Loader2, CheckCircle2, X, RotateCcw, AlertCircle,
  TimerReset, ShieldAlert, Smartphone,
} from "lucide-react";
import { sumMoney, averageMoney, formatCurrency, formatBRL, multiplyMoney, subtractMoney } from "@/lib/utils";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay, subWeeks, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useStorePlan } from "@/hooks/useStorePlan";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  recordPixAttempt, isPixCooldownActive,
  getPixCooldownRemainingMs, activatePixCooldown, 
  isSafetyModeActive, getSafetyModeRemainingMs, formatCooldownTime,
} from "@/lib/pixSafeGuard";
import { SIMULATION_MODE, createSimulatedPixCharge, simulatePaymentDelay } from "@/lib/pixSimulation";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";
import PaymentStatement from "@/components/PaymentStatement";

 interface StoreFinanceBasicProps {
   storeId: string;
   storeName: string;
   hideHistory?: boolean;
 }

type DateFilter = "today" | "week" | "month";

type ChargeResult = {
  qr_code: string | null;
  qr_code_base64: string | null;
  reference_code: string;
  amount: number;
  created_at: string;
  status: string;
};

type FinancialTransaction = {
  id: string;
  amount: number;
  created_at: string;
  pix_copy_paste: string | null;
  pix_qr_code: string | null;
  pix_qr_code_base64: string | null;
  reference_code: string;
  status: string;
  transaction_kind: string;
};

// PIX Asaas dueDate = 7 dias; após vencer, o QR/copia-e-cola ainda é pagável.
// Mantemos a cobrança "válida" no UI por 7 dias para não gerar duplicidade no Asaas.
const PIX_CHARGE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const getPendingChargeRemainingMs = (createdAt: string, nowMs = Date.now()) =>
  Math.max(0, new Date(createdAt).getTime() + PIX_CHARGE_TTL_MS - nowMs);

const isPendingChargeExpired = (status: string, createdAt: string, nowMs = Date.now()) =>
  status === "pending" && getPendingChargeRemainingMs(createdAt, nowMs) === 0;

const formatCountdown = (remainingMs: number) => {
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const mapTransactionToChargeResult = (transaction: FinancialTransaction): ChargeResult => ({
  qr_code: transaction.pix_copy_paste || transaction.pix_qr_code,
  qr_code_base64: transaction.pix_qr_code_base64,
  reference_code: transaction.reference_code,
  amount: Number(transaction.amount || 0),
  created_at: transaction.created_at,
  status: transaction.status,
});

const getTransactionStatusMeta = (status: string, createdAt: string, nowMs = Date.now()) => {
  if (isPendingChargeExpired(status, createdAt, nowMs)) {
    return { label: "Expirada", className: "bg-red-500/20 text-red-400 border-red-500/30", isExpired: true };
  }
  if (status === "paid" || status === "approved") {
    return { label: "Pago", className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", isExpired: false };
  }
  if (status === "failed" || status === "cancelled") {
    return { label: status === "cancelled" ? "Cancelada" : "Falhou", className: "bg-red-500/20 text-red-400 border-red-500/30", isExpired: status === "cancelled" };
  }
  return { label: "Pendente", className: "bg-amber-500/20 text-amber-400 border-amber-500/30", isExpired: false };
};

const COLORS = {
  pink: "#ec4899",
  blue: "#3b82f6",
  green: "#10b981",
  amber: "#f59e0b",
  purple: "#a855f7",
  cyan: "#06b6d4",
};

const PIE_COLORS = [COLORS.green, COLORS.blue, COLORS.amber];

 const StoreFinanceBasic = ({ storeId, storeName, hideHistory = false }: StoreFinanceBasicProps) => {
  const [dateFilter, setDateFilter] = useState<DateFilter>("week");
  const [chargeResult, setChargeResult] = useState<ChargeResult | null>(null);
  const [chargeError, setChargeError] = useState<string | null>(null);
  const [generatingCharge, setGeneratingCharge] = useState(false);
  const [simulatingPayment, setSimulatingPayment] = useState(false);
  const [dismissedChargeReference, setDismissedChargeReference] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const storePlan = useStorePlan(storeId);
  const queryClient = useQueryClient();

  // Store balance (repasse_pendente)
  const { data: storeBalance } = useQuery({
    queryKey: ["store-balance", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_balances")
        .select("*")
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

  const { data: transactions } = useQuery({
    queryKey: ["store-financial-transactions", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_transactions" as any)
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return ((data || []) as unknown as FinancialTransaction[]);
    },
    enabled: !!storeId,
    refetchInterval: 15000,
  });

  const minPayout = minPayoutSetting ?? 100;
  const pendingFee = Number(storeBalance?.repasse_pendente || 0);
  const canPay = pendingFee >= minPayout;

  const now = new Date();
  const dateRange = useMemo(() => {
    const todayEnd = endOfDay(now);
    switch (dateFilter) {
      case "today": return { start: startOfDay(now), end: todayEnd };
      case "week": {
        const start = new Date(now);
        start.setDate(start.getDate() - 6);
        return { start: startOfDay(start), end: todayEnd };
      }
      case "month": {
        const start = new Date(now);
        start.setDate(start.getDate() - 29);
        return { start: startOfDay(start), end: todayEnd };
      }
    }
  }, [dateFilter]);

  const prevRange = useMemo(() => {
    switch (dateFilter) {
      case "today": {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
      }
      case "week": {
        const prevEnd = new Date(now);
        prevEnd.setDate(prevEnd.getDate() - 7);
        const prevStart = new Date(prevEnd);
        prevStart.setDate(prevStart.getDate() - 6);
        return { start: startOfDay(prevStart), end: endOfDay(prevEnd) };
      }
      case "month": {
        const prevEnd = new Date(now);
        prevEnd.setDate(prevEnd.getDate() - 30);
        const prevStart = new Date(prevEnd);
        prevStart.setDate(prevStart.getDate() - 29);
        return { start: startOfDay(prevStart), end: endOfDay(prevEnd) };
      }
    }
  }, [dateFilter, dateRange]);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["store-finance-basic", storeId, dateFilter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, total_price, subtotal, delivery_fee, app_fee, payment_method, status, created_at")
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
  const activeOrders = orders?.filter(o => !["entregue", "finalizado"].includes(o.status)) || [];
  const totalSales = sumMoney(completedOrders.map(o => o.subtotal));
  const totalDeliveryFees = sumMoney(completedOrders.map(o => o.delivery_fee));
  const totalRevenue = sumMoney(completedOrders.map(o => o.total_price));
  const ticketMedio = averageMoney(totalSales, completedOrders.length);

  // Fixed plan cost calculations
  const pixOrders = completedOrders.filter(o => o.payment_method === "pix");
  const ordersWithDelivery = completedOrders.filter(o => Number(o.delivery_fee) > 0);
  const pixOperationalCost = pixOrders.length * (storePlan.pixOperationalFee || 1);
  const deliveryPlatformCost = ordersWithDelivery.length * (storePlan.platformDeliverySplit || 2);
  const totalPlatformCosts = pixOperationalCost + deliveryPlatformCost;
  const netRevenue = totalRevenue - totalPlatformCosts;

  const prevTotalSales = sumMoney((prevOrders || []).map(o => o.subtotal));
  const growthPercent = prevTotalSales > 0 ? ((totalSales - prevTotalSales) / prevTotalSales) * 100 : 0;
  const prevLabel = dateFilter === "today" ? "ontem" : dateFilter === "week" ? "semana passada" : "mês passado";

  const activePixSales = sumMoney(activeOrders.filter(o => o.payment_method === "pix").map(o => o.subtotal));

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

  // Transaction charge tracking
  const feeTransactions = useMemo(
    () => (transactions || []).filter((tx) => tx.transaction_kind === "commission_charge" || tx.transaction_kind === "store_payout"),
    [transactions]
  );

  const latestFeeCharge = feeTransactions.find(
    (tx) => tx.status !== "cancelled" && tx.status !== "failed"
  ) || null;

  const hasPendingCharge = feeTransactions.some((tx) => tx.status === "pending");
  const currentChargeRemainingMs = chargeResult ? getPendingChargeRemainingMs(chargeResult.created_at, nowMs) : 0;
  const isChargeExpired = chargeResult ? isPendingChargeExpired(chargeResult.status, chargeResult.created_at, nowMs) : false;
  const isChargeSettled = chargeResult ? ["paid", "approved"].includes(chargeResult.status) : false;
  const isChargeUrgent = !!chargeResult && !isChargeExpired && !isChargeSettled && currentChargeRemainingMs <= 60_000;

  useEffect(() => {
    if (!chargeResult && !hasPendingCharge) return;
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [chargeResult, hasPendingCharge]);

  useEffect(() => {
    if (!latestFeeCharge) return;
    if (dismissedChargeReference === latestFeeCharge.reference_code) return;
    const nextCharge = mapTransactionToChargeResult(latestFeeCharge);
    setChargeResult((current) => {
      if (!current) return nextCharge;
      if (current.reference_code === nextCharge.reference_code) {
        const isSameCharge = current.status === nextCharge.status && current.created_at === nextCharge.created_at;
        return isSameCharge ? current : nextCharge;
      }
      const currentStillValid = current.status === "pending" && !isPendingChargeExpired(current.status, current.created_at, nowMs);
      return currentStillValid ? current : nextCharge;
    });
  }, [latestFeeCharge, dismissedChargeReference, nowMs]);

  const handleDismissChargeCard = () => {
    if (chargeResult) setDismissedChargeReference(chargeResult.reference_code);
    setChargeResult(null);
    setChargeError(null);
  };

  // PIX cooldown
  const pixContextKey = `platform_fee_${storeId}`;
  const [pixCooldownMs, setPixCooldownMs] = useState(0);
  const [safetyModeMs, setSafetyModeMs] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setPixCooldownMs(getPixCooldownRemainingMs(pixContextKey));
      setSafetyModeMs(getSafetyModeRemainingMs());
    }, 1000);
    setPixCooldownMs(getPixCooldownRemainingMs(pixContextKey));
    setSafetyModeMs(getSafetyModeRemainingMs());
    return () => window.clearInterval(interval);
  }, [pixContextKey]);

  const isPixBlocked = pixCooldownMs > 0 || safetyModeMs > 0;

  const handlePayPlatformFee = async () => {
    if (!SIMULATION_MODE && isSafetyModeActive()) {
      toast.error("Sistema de pagamentos em manutenção temporária.");
      return;
    }
    // Se já existe cobrança pendente válida, apenas reexibe — não gera outra no Asaas.
    if (chargeResult && chargeResult.status === "pending" && !isChargeExpired) {
      toast.info("Você já tem uma cobrança PIX em aberto. Use o QR abaixo.");
      setDismissedChargeReference(null);
      return;
    }
    if (!SIMULATION_MODE && isPixCooldownActive(pixContextKey)) {
      toast.error("Muitas tentativas. Aguarde alguns minutos.");
      return;
    }
    if (pendingFee <= 0) {
      toast.info("Não há taxas pendentes.");
      return;
    }
    if (pendingFee < minPayout) {
      toast.error(`Valor mínimo para pagamento é ${formatBRL(minPayout)}. Faltam ${formatBRL(minPayout - pendingFee)}.`);
      return;
    }
    if (!SIMULATION_MODE) {
      recordPixAttempt(pixContextKey);
      if (isPixCooldownActive(pixContextKey)) {
        activatePixCooldown(pixContextKey);
        toast.error("Muitas tentativas. Aguarde.");
        return;
      }
    }
    setGeneratingCharge(true);
    setChargeError(null);
    setDismissedChargeReference(null);
    try {
      if (SIMULATION_MODE) {
        const simResult = createSimulatedPixCharge(pendingFee, "TAXA");
        setNowMs(Date.now());
        setChargeResult({
          qr_code: simResult.qr_code,
          qr_code_base64: simResult.qr_code_base64,
          reference_code: simResult.reference_code,
          amount: pendingFee,
          created_at: new Date().toISOString(),
          status: "pending",
        });
        toast.success(`Cobrança ${simResult.reference_code} gerada!`);
      } else {
        const { data, error } = await supabase.functions.invoke("payment-router", {
          body: {
            action: "commission_charge",
            store_id: storeId,
            amount: pendingFee,
            description: `Repasse ItaSuper - ${storeName}`,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setNowMs(Date.now());
        setChargeResult({
          qr_code: data.pix_code ?? data.qr_code ?? null,
          qr_code_base64: data.qr_code_url ?? data.qr_code_base64 ?? null,
          reference_code: data.reference_code || "PIX",
          amount: data.amount || pendingFee,
          created_at: new Date().toISOString(),
          status: "pending",
        });
        toast.success("PIX gerado! Escaneie o QR Code para pagar.");
      }
      queryClient.invalidateQueries({ queryKey: ["store-balance", storeId] });
    } catch (err: any) {
      const msg = err?.message || "Erro ao gerar PIX.";
      setChargeError(msg);
      toast.error(msg);
    } finally {
      setGeneratingCharge(false);
    }
  };

  const handleSimulatePayment = async () => {
    if (!SIMULATION_MODE || !chargeResult) return;
    setSimulatingPayment(true);
    try {
      await simulatePaymentDelay();
      setChargeResult(prev => prev ? { ...prev, status: "paid" } : null);
      toast.success("✅ Pagamento simulado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["store-balance", storeId] });
    } finally {
      setSimulatingPayment(false);
    }
  };

  const copyPixCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Código PIX copiado!");
  };

  const copyToClipboard = () => {
    const text = `📊 Resumo Financeiro - ${storeName}\n` +
      `Período: ${format(dateRange.start, "dd/MM", { locale: ptBR })} a ${format(dateRange.end, "dd/MM/yyyy", { locale: ptBR })}\n\n` +
      `💰 Faturamento: ${formatBRL(totalRevenue)}\n` +
      `📦 Pedidos: ${completedOrders.length}\n` +
      `🎫 Ticket Médio: ${formatBRL(ticketMedio)}\n\n` +
      `--- Custos Plataforma ---\n` +
      `Taxa PIX (${pixOrders.length}x R$${(storePlan.pixOperationalFee || 1.99).toFixed(2).replace(".", ",")}): ${formatBRL(pixOperationalCost)}\n` +
      `Taxa Entrega (${ordersWithDelivery.length}x R$${storePlan.platformDeliverySplit || 2}): ${formatBRL(deliveryPlatformCost)}\n\n` +
      `💵 Receita Líquida: ${formatBRL(netRevenue)}`;
    navigator.clipboard.writeText(text);
    toast.success("Resumo copiado!");
  };

  const downloadTxt = () => {
    const lines = [
      `RELATÓRIO FINANCEIRO — ${storeName}`,
      `Período: ${format(dateRange.start, "dd/MM/yyyy")} a ${format(dateRange.end, "dd/MM/yyyy")}`,
      ``,
      `FATURAMENTO: ${formatBRL(totalRevenue)}`,
      `PEDIDOS: ${completedOrders.length}`,
      `TICKET MÉDIO: ${formatBRL(ticketMedio)}`,
      ``,
      `--- CUSTOS PLATAFORMA ---`,
      `TAXA PIX: ${formatBRL(pixOperationalCost)} (${pixOrders.length} pedidos)`,
      `TAXA ENTREGA: ${formatBRL(deliveryPlatformCost)} (${ordersWithDelivery.length} entregas)`,
      `TOTAL CUSTOS: ${formatBRL(totalPlatformCosts)}`,
      ``,
      `RECEITA LÍQUIDA: ${formatBRL(netRevenue)}`,
      ``,
      `--- PEDIDOS ---`,
      ...(completedOrders || []).map(o =>
        `#${o.id.substring(0, 6).toUpperCase()} | ${format(new Date(o.created_at), "dd/MM HH:mm")} | ${o.payment_method === "pix" ? "PIX App" : o.payment_method === "cartao" ? "Cartão" : "Dinheiro"} | ${formatBRL(Number(o.subtotal))}`
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `extrato-${storeName}.txt`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Extrato baixado!");
  };

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
      {/* Extrato financeiro completo */}
       {!hideHistory && <PaymentStatement storeId={storeId} storeName={storeName} />}

      {/* Plan Info */}
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <CreditCard className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-foreground text-sm">
              Plano {storePlan.planType === "fixed" ? "Essencial" : storePlan.planType === "hybrid" ? "Crescimento" : "Comissão"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {formatBRL(storePlan.monthlyFee)}/mês
              {storePlan.isFixedPlan
                ? ` • R$${(storePlan.pixOperationalFee || 1.99).toFixed(2).replace(".", ",")}/pedido PIX • R$${(storePlan.platformDeliverySplit || 2).toFixed(2).replace(".", ",")}/entrega`
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

      {/* Date filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
        {(["today", "week", "month"] as DateFilter[]).map(f => (
          <button key={f} onClick={() => setDateFilter(f)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              dateFilter === f ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-card/80 text-muted-foreground hover:text-foreground border border-border/50"
            }`}>
            {f === "today" ? "Hoje" : f === "week" ? "7 dias" : "30 dias"}
          </button>
        ))}
        <span className="text-[10px] text-muted-foreground ml-auto whitespace-nowrap">
          {format(dateRange.start, "dd/MM", { locale: ptBR })} — {format(dateRange.end, "dd/MM", { locale: ptBR })}
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
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
              <div className="relative">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Faturamento</p>
                <p className="text-2xl font-black text-foreground mt-1 tracking-tight">{formatBRL(totalRevenue)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{completedOrders.length} pedidos</p>
              </div>
            </div>

            <div className="bg-card/60 backdrop-blur-sm rounded-2xl p-4 border border-border/30 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent" />
              <div className="relative">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Receita Líquida</p>
                <p className="text-2xl font-black text-emerald-400 mt-1 tracking-tight">{formatBRL(netRevenue)}</p>
                <p className="text-[10px] text-emerald-400/60 mt-1">após taxas plataforma</p>
              </div>
            </div>

            <div className="bg-card/60 backdrop-blur-sm rounded-2xl p-4 border border-border/30 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent" />
              <div className="relative">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Ticket Médio</p>
                <p className="text-2xl font-black text-blue-400 mt-1 tracking-tight">{formatBRL(ticketMedio)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">por pedido</p>
              </div>
            </div>

            <div className="bg-card/60 backdrop-blur-sm rounded-2xl p-4 border border-border/30 relative overflow-hidden">
              <div className={`absolute inset-0 bg-gradient-to-br ${growthPercent >= 0 ? "from-emerald-500/5" : "from-red-500/5"} to-transparent`} />
              <div className="relative">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Crescimento</p>
                <div className="flex items-center gap-1.5 mt-1">
                  {growthPercent >= 0 ? <TrendingUp className="h-5 w-5 text-emerald-400" /> : <TrendingDown className="h-5 w-5 text-red-400" />}
                  <p className={`text-2xl font-black tracking-tight ${growthPercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {growthPercent >= 0 ? "+" : ""}{growthPercent.toFixed(1)}%
                  </p>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">vs {prevLabel}</p>
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
                      <span className="text-xs font-bold text-foreground">{formatBRL(p.data.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Vendas via App - Split Automático */}
          <div className="bg-card/60 backdrop-blur-sm rounded-2xl p-5 border border-emerald-500/20 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                </div>
                <p className="text-sm font-bold text-foreground">Vendas via App (PIX)</p>
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">Automático</Badge>
              </div>
              <p className="text-2xl font-black text-emerald-400">{formatBRL(paymentBreakdown.pix.total)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {pixOrders.length} pedidos via PIX. Taxa operacional de R${(storePlan.pixOperationalFee || 1.99).toFixed(2).replace(".", ",")}/pedido (total: {formatBRL(pixOperationalCost)}) descontada automaticamente.
              </p>
              <div className="mt-2 rounded-xl bg-emerald-500/5 border border-emerald-500/10 p-2.5">
                <p className="text-[10px] text-emerald-400 font-semibold">✅ Valor já depositado na sua conta — nada a fazer</p>
              </div>
            </div>
          </div>

          {/* Taxa Plataforma Pendente */}
          <div className="bg-card/60 backdrop-blur-sm rounded-2xl p-5 border border-blue-500/20 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <ArrowDownRight className="h-4 w-4 text-blue-400" />
                </div>
                <p className="text-sm font-bold text-foreground">Taxa Pendente — Entregas</p>
              </div>
              <p className="text-xs text-muted-foreground mb-1">
                Taxa de R${storePlan.platformDeliverySplit || 2}/entrega para pedidos finalizados com pagamento físico. Acumula até atingir o valor mínimo.
              </p>
              <p className="text-2xl font-black text-blue-400">
                {formatBRL(pendingFee)}
              </p>

              {safetyModeMs > 0 && (
                <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-2">
                  <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-amber-400">Manutenção temporária</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Volta em {formatCooldownTime(safetyModeMs)}</p>
                  </div>
                </div>
              )}
              {!safetyModeMs && pixCooldownMs > 0 && (
                <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-amber-400">Muitas tentativas</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Aguarde {formatCooldownTime(pixCooldownMs)}</p>
                  </div>
                </div>
              )}

              {pendingFee > 0 && (() => {
                return canPay ? (
                  <Button
                    onClick={handlePayPlatformFee}
                    disabled={generatingCharge || isPixBlocked}
                    className="w-full mt-3 font-bold text-white shadow-lg bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-blue-500/20 disabled:opacity-50"
                    size="lg"
                  >
                    {generatingCharge ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Gerando PIX...</>
                    ) : isPixBlocked ? (
                      <><ShieldAlert className="h-4 w-4" /> Aguarde...</>
                    ) : (
                      <><QrCode className="h-4 w-4" /> Pagar {formatBRL(pendingFee)} via PIX</>
                    )}
                  </Button>
                ) : (
                  <div className="mt-3 space-y-2">
                    <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, (pendingFee / minPayout) * 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      PIX disponível a partir de <strong className="text-foreground">{formatBRL(minPayout)}</strong>
                      {" "}— faltam <strong className="text-blue-400">{formatBRL(minPayout - pendingFee)}</strong>
                    </p>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Charge Error */}
          {chargeError && !chargeResult && (
            <div className="bg-card/60 rounded-2xl p-5 border border-red-500/20 space-y-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-foreground">Erro ao gerar PIX</p>
                  <p className="text-xs text-muted-foreground">{chargeError}</p>
                </div>
              </div>
              <Button onClick={handlePayPlatformFee} disabled={generatingCharge} className="w-full" variant="outline">
                <RotateCcw className="h-4 w-4" /> Tentar Novamente
              </Button>
            </div>
          )}

          {/* QR Code Card */}
          {chargeResult && (
            <div className="bg-card/60 backdrop-blur-sm rounded-2xl p-5 border-2 border-blue-500/50 space-y-3 animate-in slide-in-from-bottom-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-blue-400">Pague via PIX</p>
                <button onClick={handleDismissChargeCard} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {chargeResult.reference_code && (
                <p className="text-xs text-muted-foreground">
                  Fatura: <span className="font-bold text-foreground">{chargeResult.reference_code}</span>
                </p>
              )}
              <p className="text-2xl font-black text-center text-foreground">{formatBRL(chargeResult.amount)}</p>

              {!isChargeExpired && !isChargeSettled && (
                <div className="rounded-xl border border-border/50 bg-card/40 p-3 text-center space-y-2">
                  <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold ${isChargeUrgent ? "bg-red-500/20 text-red-400 animate-pulse" : "bg-blue-500/20 text-blue-400"}`}>
                    <TimerReset className="h-4 w-4" />
                    {formatCountdown(currentChargeRemainingMs)}
                  </div>
                  <p className="text-[10px] text-muted-foreground">QR Code válido por 5 minutos.</p>
                </div>
              )}

              {isChargeSettled ? (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center space-y-2">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto" />
                  <p className="text-sm font-bold text-foreground">Pagamento confirmado</p>
                </div>
              ) : isChargeExpired ? (
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-center space-y-3">
                  <AlertCircle className="h-8 w-8 text-red-400 mx-auto" />
                  <p className="text-sm font-bold text-foreground">QR Code expirou</p>
                  <Button onClick={handlePayPlatformFee} disabled={generatingCharge} className="w-full">
                    {generatingCharge ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                    Gerar Nova Cobrança
                  </Button>
                </div>
              ) : (
                <>
                  {chargeResult.qr_code_base64 && (
                    <div className="flex justify-center">
                      <img
                        src={chargeResult.qr_code_base64.startsWith("data:") ? chargeResult.qr_code_base64 : `data:image/png;base64,${chargeResult.qr_code_base64}`}
                        alt="QR Code PIX"
                        className="w-48 h-48 rounded-xl"
                      />
                    </div>
                  )}
                  {chargeResult.qr_code && (
                    <Button onClick={() => copyPixCode(chargeResult.qr_code!)} variant="outline" className="w-full">
                      <Copy className="h-4 w-4" /> Copiar Código PIX
                    </Button>
                  )}
                  {SIMULATION_MODE && (
                    <Button
                      onClick={handleSimulatePayment}
                      disabled={simulatingPayment}
                      className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold"
                    >
                      {simulatingPayment ? <><Loader2 className="h-4 w-4 animate-spin" /> Processando...</> : "🧪 Simular Pagamento"}
                    </Button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Balance Summary */}
          <div className="bg-card/60 backdrop-blur-sm rounded-2xl p-5 border border-border/30">
            <p className="text-xs font-bold text-foreground mb-3">📊 Composição da Receita</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Vendas (produtos)</span>
                <span className="text-sm font-bold text-foreground">{formatBRL(totalSales)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Taxas de entrega</span>
                <span className="text-sm font-bold text-foreground">{formatBRL(totalDeliveryFees)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Taxa operacional PIX ({pixOrders.length}x R${(storePlan.pixOperationalFee || 1.99).toFixed(2).replace(".", ",")})</span>
                <span className="text-sm font-bold text-red-400">-{formatBRL(pixOperationalCost)}</span>
              </div>
              {ordersWithDelivery.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Split entrega plataforma ({ordersWithDelivery.length}x R${storePlan.platformDeliverySplit || 2})</span>
                  <span className="text-sm font-bold text-red-400">-{formatBRL(deliveryPlatformCost)}</span>
                </div>
              )}
              {ordersWithDelivery.length > 0 && totalDeliveryFees - deliveryPlatformCost > 0.01 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Repasse ao entregador (diferença da taxa cobrada)</span>
                  <span className="text-sm font-bold text-muted-foreground">{formatBRL(totalDeliveryFees - deliveryPlatformCost)}</span>
                </div>
              )}
              <div className="h-px bg-border" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Receita líquida estimada</span>
                <span className="text-sm font-black text-emerald-400">{formatBRL(netRevenue)}</span>
              </div>
            </div>
          </div>

          {/* Payment breakdown cards */}
          <div className="bg-card/60 backdrop-blur-sm rounded-2xl border border-border/30 divide-y divide-border/30">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Banknote className="h-4 w-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Vendas Presenciais</p>
                  <p className="text-[10px] text-muted-foreground">Dinheiro / Cartão</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-foreground">{formatBRL(paymentBreakdown.card.total + paymentBreakdown.cash.total)}</p>
                <p className="text-[10px] text-blue-400">- {formatBRL(pendingFee)} taxa pendente</p>
              </div>
            </div>
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Smartphone className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Vendas PIX App</p>
                  <p className="text-[10px] text-emerald-400">Split automático ✅</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-foreground">{formatBRL(paymentBreakdown.pix.total)}</p>
                <p className="text-[10px] text-emerald-400">taxa já retida</p>
              </div>
            </div>
          </div>

          {/* Export buttons */}
          <div className="flex gap-2">
            <button onClick={copyToClipboard} className="flex-1 flex items-center justify-center gap-2 bg-card/60 hover:bg-card/80 text-foreground rounded-xl py-3 text-sm font-medium transition-colors border border-border/30">
              <Copy className="h-4 w-4" /> Copiar
            </button>
            <button onClick={downloadTxt} className="flex-1 flex items-center justify-center gap-2 bg-card/60 hover:bg-card/80 text-foreground rounded-xl py-3 text-sm font-medium transition-colors border border-border/30">
              <Download className="h-4 w-4" /> Baixar Extrato
            </button>
          </div>

          {/* Recent Transactions Table */}
          {transactions && transactions.length > 0 && (
            <div className="bg-card/60 backdrop-blur-sm rounded-2xl border border-border/30 overflow-hidden">
              <div className="p-4 border-b border-border/30">
                <p className="text-xs font-bold text-foreground flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-blue-400" />
                  Transações Recentes
                </p>
              </div>
              <div className="divide-y divide-border/20">
                {transactions.map((tx) => {
                  const statusMeta = getTransactionStatusMeta(tx.status, tx.created_at, nowMs);
                  const canRetryExpiredCharge = statusMeta.isExpired;
                  return (
                    <div key={tx.id} className="p-3 flex items-center gap-3 hover:bg-card/40 transition-colors">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        tx.transaction_kind === "commission_charge" ? "bg-red-500/10" : "bg-blue-500/10"
                      }`}>
                        {tx.transaction_kind === "commission_charge"
                          ? <ArrowDownRight className="h-4 w-4 text-red-400" />
                          : <ArrowUpRight className="h-4 w-4 text-blue-400" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-foreground">{tx.reference_code}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusMeta.className}`}>
                            {statusMeta.label}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5 gap-2">
                          <span className="text-[10px] text-muted-foreground">
                            {tx.transaction_kind === "commission_charge" ? "Cobrança" : "Repasse"}
                          </span>
                          <span className="text-sm font-bold text-foreground">{formatBRL(Number(tx.amount))}</span>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-[10px] text-muted-foreground">
                            {format(new Date(tx.created_at), "dd/MM/yyyy HH:mm")}
                          </p>
                          {canRetryExpiredCharge && (
                            <Button onClick={handlePayPlatformFee} size="sm" variant="outline" className="h-6 px-2 text-[10px]">
                              <RotateCcw className="h-3 w-3" /> Nova cobrança
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active PIX orders */}
          {activeOrders.filter(o => o.payment_method === "pix").length > 0 && (
            <div className="bg-card/60 backdrop-blur-sm rounded-2xl p-4 border border-blue-500/20 space-y-2">
              <p className="text-sm font-bold text-blue-400">Pedidos PIX em Andamento</p>
              <p className="text-[10px] text-muted-foreground">Já pagos — contabilizados ao finalizar.</p>
              {activeOrders.filter(o => o.payment_method === "pix").map(order => (
                <div key={order.id} className="flex justify-between text-xs bg-blue-500/5 rounded-xl p-2.5">
                  <span className="text-blue-400 font-semibold">#{order.id.substring(0, 6).toUpperCase()}</span>
                  <span className="text-foreground font-medium">{formatBRL(Number(order.subtotal))}</span>
                  <span className="text-muted-foreground capitalize">{order.status.replace(/_/g, " ")}</span>
                </div>
              ))}
              <div className="flex justify-between text-xs pt-2 border-t border-border/30">
                <span className="text-muted-foreground">Total em andamento</span>
                <span className="text-blue-400 font-bold">{formatBRL(activePixSales)}</span>
              </div>
            </div>
          )}

          {/* Order list */}
          {completedOrders.length > 0 ? (
            <div className="bg-card/60 backdrop-blur-sm rounded-2xl border border-border/30 overflow-hidden">
              <div className="p-4 border-b border-border/30">
                <p className="text-xs font-bold text-foreground">Extrato de Pedidos</p>
                {(() => {
                  const neg = completedOrders.filter(o => {
                    const sub = Number(o.subtotal);
                    const isPix = o.payment_method === "pix";
                    const fee = isPix ? (storePlan.pixOperationalFee || 1) : 0;
                    const dFee = Number(o.delivery_fee) > 0 ? (storePlan.platformDeliverySplit || 2) : 0;
                    return sub - fee - dFee < 0;
                  }).length;
                  if (neg === 0) return null;
                  return (
                    <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
                      ⚠ {neg} {neg === 1 ? "pedido está" : "pedidos estão"} gerando prejuízo — considere definir valor mínimo.
                    </p>
                  );
                })()}
              </div>
              <div className="divide-y divide-border/20">
                {completedOrders.map(order => {
                  const sub = Number(order.subtotal);
                  const isPix = order.payment_method === "pix";
                  const fee = isPix ? (storePlan.pixOperationalFee || 1) : 0;
                  const deliveryFee = Number(order.delivery_fee) > 0 ? (storePlan.platformDeliverySplit || 2) : 0;
                  const totalFees = fee + deliveryFee;
                  const net = sub - totalFees;
                  const isNeg = net < 0;
                  return (
                    <div key={order.id} className={`p-3 flex items-center gap-3 hover:bg-card/40 transition-colors ${isNeg ? "bg-red-500/5 border-l-2 border-red-500" : ""}`} title={isNeg ? "Este pedido está gerando prejuízo (taxas maiores que o subtotal)" : undefined}>
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${isPix ? "bg-emerald-500/10" : "bg-amber-500/10"}`}>
                        {isPix ? <Smartphone className="h-4 w-4 text-emerald-400" /> : <Banknote className="h-4 w-4 text-amber-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-foreground flex items-center gap-1">
                            #{order.id.substring(0, 6).toUpperCase()}
                            {isNeg && <span className="text-[9px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">PREJUÍZO</span>}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{format(new Date(order.created_at), "dd/MM HH:mm")}</span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-[10px] text-muted-foreground">
                            {isPix ? "PIX App" : order.payment_method === "cartao" ? "Cartão" : "Dinheiro"}
                          </span>
                          <span className="text-sm font-bold text-foreground">{formatBRL(sub)}</span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-[10px] text-muted-foreground">
                            Taxas: {formatBRL(totalFees)}
                            {fee > 0 ? ` (PIX R$${fee})` : ""}
                            {deliveryFee > 0 ? ` (Entrega R$${deliveryFee})` : ""}
                          </span>
                          <span className={`text-xs font-semibold ${isNeg ? "text-red-400" : "text-emerald-400"}`}>Líquido: {formatBRL(net)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
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
