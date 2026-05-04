import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Copy, Download, ArrowUpRight, ArrowDownRight, Smartphone, Banknote,
  QrCode, Loader2, X, CheckCircle2, RotateCcw, AlertCircle, TimerReset,
  ShieldAlert, TrendingUp, TrendingDown, Receipt, Calendar, Monitor,
} from "lucide-react";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  recordPixAttempt, resetPixAttempts, isPixCooldownActive,
  getPixCooldownRemainingMs, activatePixCooldown, activateSafetyMode,
  isSafetyModeActive, getSafetyModeRemainingMs, formatCooldownTime,
} from "@/lib/pixSafeGuard";
import { SIMULATION_MODE, createSimulatedPixCharge, simulatePaymentDelay } from "@/lib/pixSimulation";
import { multiplyMoney, subtractMoney, sumMoney, averageMoney, formatBRL } from "@/lib/utils";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import {
  DailySalesChart, PaymentBreakdownChart, HourlyChart,
  KpiCard, CommissionSummary, useFinanceChartData, CHART_COLORS,
} from "@/components/FinanceCharts";
import PaymentStatement from "@/components/PaymentStatement";

 interface StoreFinancePanelProps {
   storeId: string;
   storeName: string;
   hideHistory?: boolean;
 }

type DateFilter = "today" | "week" | "month" | "custom";

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

const PIX_CHARGE_TTL_MS = 5 * 60 * 1000;

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
    return {
      label: status === "cancelled" ? "Cancelada" : "Falhou",
      className: "bg-red-500/20 text-red-400 border-red-500/30",
      isExpired: status === "cancelled",
    };
  }
  return { label: "Pendente", className: "bg-amber-500/20 text-amber-400 border-amber-500/30", isExpired: false };
};

// Neon color palette
const NEON_COLORS = {
  pink: "#ec4899",
  blue: "#3b82f6",
  green: "#10b981",
  purple: "#a855f7",
  amber: "#f59e0b",
  cyan: "#06b6d4",
};

const DONUT_COLORS = [NEON_COLORS.pink, NEON_COLORS.blue, NEON_COLORS.amber];

 const StoreFinancePanel = ({ storeId, storeName, hideHistory = false }: StoreFinancePanelProps) => {
  const [dateFilter, setDateFilter] = useState<DateFilter>("week");
  const [generatingCharge, setGeneratingCharge] = useState(false);
  const [chargeResult, setChargeResult] = useState<ChargeResult | null>(null);
  const [chargeError, setChargeError] = useState<string | null>(null);
  const [simulatingPayment, setSimulatingPayment] = useState(false);
  const [dismissedChargeReference, setDismissedChargeReference] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const queryClient = useQueryClient();

  const now = new Date();
  const dateRange = useMemo(() => {
    switch (dateFilter) {
      case "today":
        return { start: startOfDay(now), end: endOfDay(now) };
      case "week":
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case "month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      default:
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    }
  }, [dateFilter]);

  // Previous week for growth comparison
  const prevWeekRange = useMemo(() => {
    const prevStart = subWeeks(dateRange.start, 1);
    const prevEnd = subWeeks(dateRange.end, 1);
    return { start: prevStart, end: prevEnd };
  }, [dateRange]);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["store-finance-orders", storeId, dateFilter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, total_price, subtotal, delivery_fee, app_fee, payment_method, status, created_at, confirmed_at, order_source, commission_rate")
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

  // Busca movimentações PDV para o hook de gráficos
  const { data: pdvMovementsForChart = [] } = useQuery({
    queryKey: ["pdv-movements-chart", storeId, dateFilter],
    queryFn: async () => {
      const { start, end } = getDateRange(dateFilter);
      const { data } = await supabase.from("pdv_movements" as any)
        .select("id, amount, created_at, type, payment_method")
        .eq("store_id", storeId)
        .eq("type", "sale")
        .gte("created_at", start)
        .lte("created_at", end);
      return (data || []) as any[];
    },
    enabled: !!storeId,
    staleTime: 60_000,
  });

  // Busca comissão PDV pendente direto do banco (calculada pelo trigger, fonte da verdade)
  const { data: pdvPlanData } = useQuery({
    queryKey: ["store-pdv-plan", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("store_plans")
        .select("pdv_commission_pending, pdv_commission_rate, pdv_enabled")
        .eq("store_id", storeId)
        .eq("is_active", true)
        .maybeSingle();
      return data;
    },
    enabled: !!storeId,
    staleTime: 30_000,
  });

  // Previous period orders for growth comparison
  const { data: prevOrders } = useQuery({
    queryKey: ["store-finance-prev-orders", storeId, dateFilter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("subtotal, status")
        .eq("store_id", storeId)
        .gte("created_at", prevWeekRange.start.toISOString())
        .lte("created_at", prevWeekRange.end.toISOString())
        .in("status", ["entregue", "finalizado"]);
      if (error) throw error;
      return data || [];
    },
    enabled: !!storeId,
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

  // Fetch store owner profile to check PIX key + use plan commission rate
  const { data: storeData } = useQuery({
    queryKey: ["store-owner", storeId],
    queryFn: async () => {
      const [storeResult, planResult] = await Promise.all([
        supabase.from("stores").select("owner_id, commission_rate").eq("id", storeId).single(),
        supabase.from("store_plans").select("commission_rate, plan_type").eq("store_id", storeId).eq("is_active", true).maybeSingle(),
      ]);
      if (storeResult.error) throw storeResult.error;
      return {
        ...storeResult.data,
        plan_commission_rate: planResult.data?.commission_rate,
        plan_type: planResult.data?.plan_type,
      };
    },
    enabled: !!storeId,
  });

  // Use plan commission rate (accurate per-plan) with fallback to store default.
  // Esse valor é usado APENAS como fallback. O cálculo real usa order.commission_rate
  // (taxa salva no momento do pedido) para preservar histórico correto.
  const commissionRate = ((storeData as any)?.plan_commission_rate ?? (storeData as any)?.commission_rate ?? 5) / 100;
  const commissionPct = Math.round(commissionRate * 100);

  /**
   * 🔒 Helper: retorna a taxa de comissão correta para cada pedido individual.
   * Prioriza o valor histórico salvo em orders.commission_rate.
   * Se não houver (pedidos antigos antes da correção), usa a taxa atual do plano.
   */
  const getOrderCommissionRate = (order: any): number => {
    const saved = order?.commission_rate;
    if (saved !== null && saved !== undefined) {
      return Number(saved) / 100;
    }
    return commissionRate;
  };

  const { data: ownerProfile } = useQuery({
    queryKey: ["owner-profile", storeData?.owner_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("pix_key, pix_type, document")
        .eq("user_id", storeData!.owner_id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!storeData?.owner_id,
  });

  const hasPixKey = !!ownerProfile?.pix_key;
  const hasDocument = !!ownerProfile?.document;

  const completedOrders = orders?.filter(o => ["entregue", "finalizado"].includes(o.status)) || [];

  // Separar por canal
  const deliveryOrders = completedOrders.filter(o => (o as any).order_source !== "pdv");
  const pdvOrders = completedOrders.filter(o => (o as any).order_source === "pdv");
  const hasPdv = pdvOrders.length > 0;

  const totalSales = sumMoney(completedOrders.map((order) => order.subtotal));
  const deliverySales = sumMoney(deliveryOrders.map((order) => order.subtotal));
  const pdvSalesTotal = sumMoney(pdvOrders.map((order) => order.subtotal));
  const pdvCommissionTotal = sumMoney(pdvOrders.map((order) => multiplyMoney(order.subtotal, getOrderCommissionRate(order))));
  const activeOrders = orders?.filter(o => !["entregue", "finalizado"].includes(o.status)) || [];

  // Usa taxa histórica de cada pedido para cálculo correto
  const totalCommission = sumMoney(completedOrders.map((order) => multiplyMoney(order.subtotal, getOrderCommissionRate(order))));
  const storePart = subtractMoney(totalSales, totalCommission);

  // Delivery: físico (dinheiro/cartão) vs app (PIX) — excluindo PDV
  const physicalSales = sumMoney(deliveryOrders.filter(o => o.payment_method !== "pix").map((order) => order.subtotal));
  const commissionDue = sumMoney(deliveryOrders.filter(o => o.payment_method !== "pix").map((order) => multiplyMoney(order.subtotal, getOrderCommissionRate(order))));

  const appSales = sumMoney(deliveryOrders.filter(o => o.payment_method === "pix").map((order) => order.subtotal));
  const appCommission = sumMoney(deliveryOrders.filter(o => o.payment_method === "pix").map((order) => multiplyMoney(order.subtotal, getOrderCommissionRate(order))));
  const creditFromApp = subtractMoney(appSales, appCommission);

  const activePixSales = sumMoney(activeOrders.filter(o => o.payment_method === "pix").map((order) => order.subtotal));
  const finalBalance = subtractMoney(creditFromApp, commissionDue);

  const ticketMedio = averageMoney(totalSales, completedOrders.length);

  // Growth calculation
  const prevTotalSales = sumMoney((prevOrders || []).map(o => o.subtotal));
  const growthPercent = prevTotalSales > 0 ? ((totalSales - prevTotalSales) / prevTotalSales) * 100 : 0;

  // DB balance
  const dbComissaoPendente = Number(storeBalance?.comissao_pendente || storeBalance?.pending_commission || 0);

  // Chart data: daily sales
  const chartData = useMemo(() => {
    if (!completedOrders.length) return [];
    const dayMap: Record<string, number> = {};
    completedOrders.forEach((order) => {
      const day = format(new Date(order.created_at), "dd/MM");
      dayMap[day] = (dayMap[day] || 0) + Number(order.subtotal);
    });
    return Object.entries(dayMap).map(([day, value]) => ({ day, value: Math.round(value * 100) / 100 }));
  }, [completedOrders]);

  // Donut data: payment method distribution
  const donutData = useMemo(() => {
    const pix = completedOrders.filter(o => o.payment_method === "pix").length;
    const card = completedOrders.filter(o => o.payment_method === "cartao").length;
    const cash = completedOrders.filter(o => o.payment_method !== "pix" && o.payment_method !== "cartao").length;
    return [
      { name: "PIX", value: pix },
      { name: "Cartão", value: card },
      { name: "Dinheiro", value: cash },
    ].filter(d => d.value > 0);
  }, [completedOrders]);

  // Commission transactions
  const commissionTransactions = useMemo(
    () => (transactions || []).filter((tx) => tx.transaction_kind === "commission_charge"),
    [transactions]
  );

  const latestCommissionCharge = commissionTransactions.find(
    (tx) => tx.status !== "cancelled" && tx.status !== "failed"
  ) || null;

  const hasPendingCommissionCharge = commissionTransactions.some((tx) => tx.status === "pending");
  const currentChargeRemainingMs = chargeResult ? getPendingChargeRemainingMs(chargeResult.created_at, nowMs) : 0;
  const isChargeExpired = chargeResult ? isPendingChargeExpired(chargeResult.status, chargeResult.created_at, nowMs) : false;
  const isChargeSettled = chargeResult ? ["paid", "approved"].includes(chargeResult.status) : false;
  const isChargeUrgent = !!chargeResult && !isChargeExpired && !isChargeSettled && currentChargeRemainingMs <= 60_000;

  useEffect(() => {
    if (!chargeResult && !hasPendingCommissionCharge) return;
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [chargeResult, hasPendingCommissionCharge]);

  useEffect(() => {
    if (!latestCommissionCharge) return;
    if (dismissedChargeReference === latestCommissionCharge.reference_code) return;
    const nextCharge = mapTransactionToChargeResult(latestCommissionCharge);
    setChargeResult((current) => {
      if (!current) return nextCharge;
      if (current.reference_code === nextCharge.reference_code) {
        const isSameCharge =
          current.status === nextCharge.status &&
          current.created_at === nextCharge.created_at &&
          current.qr_code === nextCharge.qr_code &&
          current.qr_code_base64 === nextCharge.qr_code_base64 &&
          current.amount === nextCharge.amount;
        return isSameCharge ? current : nextCharge;
      }
      const currentStillValid = current.status === "pending" && !isPendingChargeExpired(current.status, current.created_at, nowMs);
      return currentStillValid ? current : nextCharge;
    });
  }, [latestCommissionCharge, dismissedChargeReference, nowMs]);

  const handleDismissChargeCard = () => {
    if (chargeResult) setDismissedChargeReference(chargeResult.reference_code);
    setChargeResult(null);
    setChargeError(null);
  };

  const pixContextKey = `commission_${storeId}`;
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

  const handleGenerateCommissionCharge = async () => {
    if (!SIMULATION_MODE && isSafetyModeActive()) {
      toast.error("Sistema de pagamentos em manutenção temporária.");
      return;
    }
    if (!SIMULATION_MODE && isPixCooldownActive(pixContextKey)) {
      toast.error("Muitas tentativas. Aguarde alguns minutos.");
      return;
    }
    if (dbComissaoPendente <= 0 && commissionDue <= 0) {
      toast.info("Não há comissões pendentes.");
      return;
    }
    const chargeAmount = dbComissaoPendente > 0 ? dbComissaoPendente : commissionDue;
    if (chargeAmount < minPayout) {
      toast.error(`Valor mínimo para cobrança é ${formatBRL(minPayout)}. Faltam ${formatBRL(minPayout - chargeAmount)}.`);
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
        const simResult = createSimulatedPixCharge(chargeAmount, "FAT");
        setNowMs(Date.now());
        setChargeResult({
          qr_code: simResult.qr_code,
          qr_code_base64: simResult.qr_code_base64,
          reference_code: simResult.reference_code,
          amount: simResult.amount,
          created_at: simResult.created_at,
          status: "pending",
        });
        toast.success(`[SIMULAÇÃO] Cobrança ${simResult.reference_code} gerada!`);
        return;
      }
      const { data, error } = await supabase.functions.invoke("payment-router", {
        body: {
          action: "commission_charge",
          store_id: storeId,
          amount: chargeAmount,
          description: `Comissão ItaSuper - ${storeName}`,
        },
      });
      if (error) throw error;
      if (data?.rate_limited) {
        activateSafetyMode();
        throw new Error("Sistema temporariamente indisponível.");
      }
      if (data?.error) throw new Error(data.error);
      if (!data?.pix_code && !data?.qr_code_url && !data?.qr_code && !data?.qr_code_base64) throw new Error("QR Code não retornado");
      const createdAt = data?.created_at || new Date().toISOString();
      setNowMs(Date.now());
      setChargeResult({
        qr_code: data.pix_code ?? data.qr_code ?? null,
        qr_code_base64: data.qr_code_url ?? data.qr_code_base64 ?? null,
        reference_code: data.reference_code,
        amount: Number(data.amount || chargeAmount),
        created_at: createdAt,
        status: data.status || "pending",
      });
      if (data?.reused) toast.info(`Cobrança existente ${data.reference_code} reaberta.`);
      else toast.success(`Cobrança ${data.reference_code} gerada!`);
      resetPixAttempts(pixContextKey);
      queryClient.invalidateQueries({ queryKey: ["store-financial-transactions", storeId] });
      queryClient.invalidateQueries({ queryKey: ["store-balance", storeId] });
    } catch (err: any) {
      if (err?.context?.status === 429 || err?.status === 429) activateSafetyMode();
      const message = /Failed to send request|Failed to fetch/i.test(err?.message || "")
        ? "Falha na conexão."
        : err?.message || "Erro ao gerar cobrança PIX.";
      setChargeResult(null);
      setChargeError(message);
      toast.error(message);
    } finally {
      setGeneratingCharge(false);
    }
  };

  const handleSimulatePayment = async () => {
    if (!chargeResult) return;
    setSimulatingPayment(true);
    try {
      await simulatePaymentDelay();
      setChargeResult((prev) => prev ? { ...prev, status: "paid" } : null);
      toast.success(`[SIMULAÇÃO] Pagamento ${chargeResult.reference_code} confirmado!`);
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
    const text = `📊 Resumo Financeiro ItaSuper - ${storeName}\n` +
      `Período: ${format(dateRange.start, "dd/MM", { locale: ptBR })} a ${format(dateRange.end, "dd/MM/yyyy", { locale: ptBR })}\n\n` +
      `💰 Vendas Totais: ${formatBRL(totalSales)}\n` +
      `📱 Comissão Total: ${formatBRL(totalCommission)}\n\n` +
      `--- Vendas via App (Split Automático ✅) ---\n` +
      `Vendas PIX App: ${formatBRL(appSales)}\n` +
      `Comissão retida: ${formatBRL(appCommission)}\n` +
      `Lojista recebeu: ${formatBRL(creditFromApp)}\n\n` +
      `--- Vendas Físicas (Cobrança Manual) ---\n` +
      `Vendas Dinheiro/Cartão: ${formatBRL(physicalSales)}\n` +
      `Comissão a cobrar: ${formatBRL(commissionDue)}`;
    navigator.clipboard.writeText(text);
    toast.success("Resumo copiado!");
  };

  const downloadTxt = () => {
    const lines = [
      `EXTRATO FINANCEIRO ITASUPER - ${storeName.toUpperCase()}`,
      `Período: ${format(dateRange.start, "dd/MM/yyyy")} a ${format(dateRange.end, "dd/MM/yyyy")}`,
      ``,
      `VENDAS TOTAIS: ${formatBRL(totalSales)}`,
      `COMISSÃO TOTAL: ${formatBRL(totalCommission)}`,
      ``,
      `--- VENDAS VIA APP (SPLIT AUTOMÁTICO) ---`,
      `VENDAS PIX APP: ${formatBRL(appSales)}`,
      `COMISSÃO RETIDA: ${formatBRL(appCommission)}`,
      `LOJISTA RECEBEU: ${formatBRL(creditFromApp)}`,
      ``,
      `--- VENDAS FÍSICAS (COBRANÇA MANUAL) ---`,
      `VENDAS DINHEIRO/CARTÃO: ${formatBRL(physicalSales)}`,
      `COMISSÃO A COBRAR: ${formatBRL(commissionDue)}`,
      ``,
      `--- PEDIDOS ---`,
      ...(orders || []).map(o =>
        `#${o.id.substring(0, 6).toUpperCase()} | ${format(new Date(o.created_at), "dd/MM HH:mm")} | ${o.payment_method === "pix" ? "PIX App" : o.payment_method === "cartao" ? "Cartão" : "Dinheiro"} | ${formatBRL(Number(o.subtotal))} | Comissão: ${formatBRL(multiplyMoney(Number(o.subtotal), getOrderCommissionRate(o)))}`
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

  const filterLabels: Record<DateFilter, string> = {
    today: "Hoje",
    week: "7 dias",
    month: "30 dias",
    custom: "Personalizado",
  };

  return (
    <div className="space-y-6">
      {/* Extrato financeiro completo */}
       {!hideHistory && <PaymentStatement storeId={storeId} storeName={storeName} />}

      {/* Date filter bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
        {(["today", "week", "month"] as DateFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setDateFilter(f)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              dateFilter === f
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                : "bg-card/80 text-muted-foreground hover:text-foreground border border-border/50"
            }`}
          >
            {filterLabels[f]}
          </button>
        ))}
        <span className="text-[10px] text-muted-foreground ml-auto whitespace-nowrap">
          {format(dateRange.start, "dd/MM", { locale: ptBR })} — {format(dateRange.end, "dd/MM", { locale: ptBR })}
        </span>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 gap-3">
        {/* Faturamento Total */}
        <div className="bg-card/60 backdrop-blur-sm rounded-2xl p-4 border border-border/30 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
          <div className="relative">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Faturamento</p>
            <p className="text-2xl font-black text-foreground mt-1 tracking-tight">
              {formatBRL(totalSales)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">{completedOrders.length} pedidos</p>
          </div>
        </div>

        {/* Lucro Líquido */}
        <div className="bg-card/60 backdrop-blur-sm rounded-2xl p-4 border border-border/30 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent" />
          <div className="relative">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Lucro Líquido</p>
            <p className="text-2xl font-black text-emerald-400 mt-1 tracking-tight">
              {formatBRL(storePart)}
            </p>
            <p className="text-[10px] text-emerald-400/60 mt-1">{(storeData as any)?.plan_type === 'fixed' ? '100% do subtotal (- R$1 PIX)' : `${100 - commissionPct}% do faturamento`}</p>
          </div>
        </div>

        {/* Ticket Médio */}
        <div className="bg-card/60 backdrop-blur-sm rounded-2xl p-4 border border-border/30 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent" />
          <div className="relative">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Ticket Médio</p>
            <p className="text-2xl font-black text-blue-400 mt-1 tracking-tight">
              {formatBRL(ticketMedio)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">por pedido</p>
          </div>
        </div>

        {/* Crescimento */}
        <div className="bg-card/60 backdrop-blur-sm rounded-2xl p-4 border border-border/30 relative overflow-hidden">
          <div className={`absolute inset-0 bg-gradient-to-br ${growthPercent >= 0 ? "from-emerald-500/5" : "from-red-500/5"} to-transparent`} />
          <div className="relative">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Crescimento</p>
            <div className="flex items-center gap-1.5 mt-1">
              {growthPercent >= 0 ? (
                <TrendingUp className="h-5 w-5 text-emerald-400" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-400" />
              )}
              <p className={`text-2xl font-black tracking-tight ${growthPercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {growthPercent >= 0 ? "+" : ""}{growthPercent.toFixed(1)}%
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">vs período anterior</p>
          </div>
        </div>
      </div>

      {/* ── RESUMO DE COMISSÕES (delivery + PDV) — topo da aba financeiro ── */}
      <CommissionSummary
        deliveryCommission={chartUnified.deliveryCommission}
        pdvCommission={chartUnified.pdvCommission}
        pdvCommissionPending={Number(pdvPlanData?.pdv_commission_pending || 0)}
        planType={storePlan?.plan_type || "commission_only"}
        deliveryRate={Number(storePlan?.commission_rate || 0)}
        pdvRate={Number(pdvPlanData?.pdv_commission_rate || 0)}
      />

      {/* ── GRÁFICO DIÁRIO: Delivery + PDV ── */}
      {chartUnified.dailyData.length > 1 && (
        <div className="bg-card/60 backdrop-blur-sm rounded-2xl p-5 border border-border/30">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-foreground">Evolução Diária — Delivery vs PDV</p>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary inline-block" />Delivery</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />PDV</span>
            </div>
          </div>
          <div className="h-48">
            <DailySalesChart data={chartUnified.dailyData} showPdv={chartUnified.totalPdv > 0} />
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border/30">
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground">Delivery</p>
              <p className="text-sm font-black text-primary">{formatBRL(chartUnified.totalDelivery)}</p>
              <p className="text-[9px] text-muted-foreground">{chartUnified.deliveryOrders.length} pedidos</p>
            </div>
            <div className="text-center border-x border-border/30">
              <p className="text-[10px] text-muted-foreground">PDV</p>
              <p className="text-sm font-black text-blue-500">{formatBRL(chartUnified.totalPdv)}</p>
              <p className="text-[9px] text-muted-foreground">{chartUnified.pdvOrders.length} vendas</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground">Total</p>
              <p className="text-sm font-black text-foreground">{formatBRL(chartUnified.totalRevenue)}</p>
              <p className="text-[9px] text-muted-foreground">ticket {formatBRL(chartUnified.ticketMedio)}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── PAGAMENTOS + HORÁRIO DE PICO ── */}
      <div className="grid grid-cols-1 gap-4">
        {chartUnified.paymentData.length > 0 && (
          <div className="bg-card/60 backdrop-blur-sm rounded-2xl p-5 border border-border/30">
            <p className="text-xs font-bold text-foreground mb-3">Formas de Pagamento</p>
            <div className="h-36">
              <PaymentBreakdownChart data={chartUnified.paymentData} />
            </div>
          </div>
        )}
        {chartUnified.hourlyData.length > 0 && (
          <div className="bg-card/60 backdrop-blur-sm rounded-2xl p-5 border border-border/30">
            <p className="text-xs font-bold text-foreground mb-3">Horário de Pico</p>
            <HourlyChart data={chartUnified.hourlyData} />
          </div>
        )}
      </div>

      {/* ── PRODUTOS PDV MAIS VENDIDOS ── */}
      {chartUnified.topProducts.length > 0 && (
        <div className="bg-card/60 backdrop-blur-sm rounded-2xl p-5 border border-border/30">
          <p className="text-xs font-bold text-foreground mb-3">🏆 Produtos Mais Vendidos (PDV)</p>
          <div className="space-y-2">
            {chartUnified.topProducts.map((p, i) => {
              const maxRevenue = chartUnified.topProducts[0]?.revenue || 1;
              return (
                <div key={p.name} className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-muted-foreground w-4 shrink-0">{i+1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-xs font-semibold text-foreground truncate">{p.name}</p>
                      <p className="text-xs font-black text-foreground shrink-0 ml-2">{formatBRL(p.revenue)}</p>
                    </div>
                    <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500/70 rounded-full transition-all"
                           style={{ width: `${(p.revenue/maxRevenue)*100}%` }} />
                    </div>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{p.qty} unidades</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── GRÁFICO DE VOLUME (legado, mantido por compatibilidade) ── */}
      {chartData.length > 1 && (
        <div className="bg-card/60 backdrop-blur-sm rounded-2xl p-5 border border-border/30">
          <p className="text-xs font-bold text-foreground mb-4">Volume de Vendas (Delivery)</p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={NEON_COLORS.pink} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={NEON_COLORS.pink} stopOpacity={0} />
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
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={NEON_COLORS.pink}
                  strokeWidth={2.5}
                  fill="url(#salesGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Donut Chart: Payment Distribution */}
      {donutData.length > 0 && (
        <div className="bg-card/60 backdrop-blur-sm rounded-2xl p-5 border border-border/30">
          <p className="text-xs font-bold text-foreground mb-4">Distribuição por Pagamento</p>
          <div className="flex items-center gap-4">
            <div className="w-28 h-28 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    innerRadius={30}
                    outerRadius={50}
                    paddingAngle={4}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {donutData.map((_, index) => (
                      <Cell key={index} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2">
              {donutData.map((entry, index) => (
                <div key={entry.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length] }} />
                    <span className="text-xs text-muted-foreground">{entry.name}</span>
                  </div>
                  <span className="text-xs font-bold text-foreground">{entry.value} pedidos</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Split Automático - Vendas App */}
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
          <p className="text-2xl font-black text-emerald-400">{formatBRL(creditFromApp)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Você recebeu {formatBRL(creditFromApp)} de {formatBRL(appSales)} em vendas pelo app. A comissão da plataforma ({formatBRL(appCommission)}) já foi descontada automaticamente.
          </p>
          <div className="mt-2 rounded-xl bg-emerald-500/5 border border-emerald-500/10 p-2.5">
            <p className="text-[10px] text-emerald-400 font-semibold">✅ Valor já depositado na sua conta — nada a fazer</p>
          </div>
        </div>
      </div>

      {/* PDV — Caixa Presencial (exibe se tiver vendas PDV no período OU comissão pendente) */}
      {(hasPdv || Number(pdvPlanData?.pdv_commission_pending) > 0) && (
        <div className="bg-card/60 backdrop-blur-sm rounded-2xl p-5 border border-blue-500/20 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Monitor className="h-4 w-4 text-blue-400" />
              </div>
              <p className="text-sm font-bold text-foreground">PDV — Caixa Presencial</p>
              {pdvOrders.length > 0 && (
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]">
                  {pdvOrders.length} pedido{pdvOrders.length !== 1 ? "s" : ""}
                </Badge>
              )}
            </div>

            {/* Vendas do período */}
            {hasPdv && (
              <p className="text-2xl font-black text-blue-400">{formatBRL(pdvSalesTotal)}</p>
            )}

            <div className="mt-2 grid grid-cols-2 gap-2">
              {hasPdv && (
                <div className="bg-blue-500/5 rounded-xl p-2.5">
                  <p className="text-[10px] text-muted-foreground">Recebido direto</p>
                  <p className="text-sm font-black text-foreground">
                    {formatBRL(pdvSalesTotal)}
                  </p>
                </div>
              )}

              {/* Comissão pendente — lida do banco (acumulada pelo trigger) */}
              <div className="bg-amber-500/5 rounded-xl p-2.5">
                <p className="text-[10px] text-muted-foreground">Comissão PDV pendente</p>
                <p className="text-sm font-black text-amber-500">
                  {Number(pdvPlanData?.pdv_commission_pending) > 0
                    ? formatBRL(Number(pdvPlanData?.pdv_commission_pending))
                    : "R$ 0,00"
                  }
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Taxa PDV: <span className="font-bold text-foreground">
                    {Number(pdvPlanData?.pdv_commission_rate) === 0
                      ? "0% (isento)"
                      : `${pdvPlanData?.pdv_commission_rate}%`
                    }
                  </span>
                  {" · "}taxa delivery não se aplica ao PDV
                </p>
              </div>
            </div>

            {/* Informação da taxa PDV */}
            <p className="text-[10px] text-muted-foreground mt-2">
              {Number(pdvPlanData?.pdv_commission_rate) === 0
                ? "✅ Seu plano não cobra comissão nas vendas presenciais. Apenas mensalidade mensal."
                : `💳 PDV usa maquininha própria (sem PIX Asaas). Comissão de ${pdvPlanData?.pdv_commission_rate}% cobrada na fatura mensal — diferente da taxa de delivery.`
              }
            </p>
          </div>
        </div>
      )}

      {/* Comissões Pendentes - Vendas Físicas */}
      <div className="bg-card/60 backdrop-blur-sm rounded-2xl p-5 border border-red-500/20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-xl bg-red-500/10 flex items-center justify-center">
              <ArrowDownRight className="h-4 w-4 text-red-400" />
            </div>
            <p className="text-sm font-bold text-foreground">Taxa Pendente — Vendas Físicas</p>
          </div>
          <p className="text-xs text-muted-foreground mb-1">Você recebeu o valor na hora (dinheiro/cartão). A taxa de {commissionPct}% da plataforma precisa ser repassada.</p>
          <p className="text-2xl font-black text-red-400">
            {formatBRL((dbComissaoPendente > 0 ? dbComissaoPendente : commissionDue))}
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

          {(!hasPixKey || !hasDocument) && (
            <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-400">
                  {!hasDocument && !hasPixKey
                    ? "CPF/CNPJ e Chave PIX não cadastrados"
                    : !hasDocument
                    ? "CPF/CNPJ não cadastrado"
                    : "Chave PIX não cadastrada"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  O lojista precisa cadastrar {!hasDocument ? "o CPF/CNPJ" : ""}{!hasDocument && !hasPixKey ? " e " : ""}{!hasPixKey ? "a chave PIX" : ""} no perfil para que a cobrança de comissão funcione corretamente.
                </p>
              </div>
            </div>
          )}

          {(dbComissaoPendente > 0 || commissionDue > 0) && (() => {
            const pendingTotal = dbComissaoPendente > 0 ? dbComissaoPendente : commissionDue;
            const canPay = pendingTotal >= minPayout;
            return canPay ? (
              <Button
                onClick={handleGenerateCommissionCharge}
                disabled={generatingCharge || isPixBlocked || !hasPixKey || !hasDocument}
                className="w-full mt-3 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-bold shadow-lg shadow-red-500/20 disabled:opacity-50"
                size="lg"
              >
                {generatingCharge ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Gerando PIX...</>
                ) : isPixBlocked ? (
                  <><ShieldAlert className="h-4 w-4" /> Aguarde...</>
                ) : !hasPixKey || !hasDocument ? (
                  <><AlertCircle className="h-4 w-4" /> Dados incompletos</>
                ) : (
                  <><QrCode className="h-4 w-4" /> Pagar Pendência via PIX</>
                )}
              </Button>
            ) : (
              <div className="mt-3 space-y-2">
                <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 to-pink-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, (pendingTotal / minPayout) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Cobrança disponível a partir de <strong className="text-foreground">{formatBRL(minPayout)}</strong>
                  {" "}— faltam <strong className="text-red-400">{formatBRL(minPayout - pendingTotal)}</strong>
                </p>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Charge error */}
      {chargeError && !chargeResult && (
        <div className="bg-card/60 rounded-2xl p-5 border border-red-500/20 space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
            <div>
              <p className="text-sm font-bold text-foreground">Erro ao gerar PIX</p>
              <p className="text-xs text-muted-foreground">{chargeError}</p>
            </div>
          </div>
          <Button onClick={handleGenerateCommissionCharge} disabled={generatingCharge} className="w-full" variant="outline">
            <RotateCcw className="h-4 w-4" /> Tentar Novamente
          </Button>
        </div>
      )}

      {/* QR Code Card */}
      {chargeResult && (
        <div className="bg-card/60 backdrop-blur-sm rounded-2xl p-5 border-2 border-pink-500/50 space-y-3 animate-in slide-in-from-bottom-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-pink-400">Pague via PIX</p>
            <button onClick={handleDismissChargeCard} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Fatura: <span className="font-bold text-foreground">{chargeResult.reference_code}</span>
          </p>
          <p className="text-2xl font-black text-center text-foreground">{formatBRL(chargeResult.amount)}</p>

          {!isChargeExpired && !isChargeSettled && (
            <div className="rounded-xl border border-border/50 bg-card/40 p-3 text-center space-y-2">
              <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold ${isChargeUrgent ? "bg-red-500/20 text-red-400 animate-pulse" : "bg-pink-500/20 text-pink-400"}`}>
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
              <Button onClick={handleGenerateCommissionCharge} disabled={generatingCharge} className="w-full">
                {generatingCharge ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                Gerar Nova Cobrança
              </Button>
            </div>
          ) : (
            <>
              {chargeResult.qr_code_base64 && (
                <div className="flex justify-center">
                  <img
                    src={chargeResult.qr_code_base64!.startsWith("data:") ? chargeResult.qr_code_base64! : `data:image/png;base64,${chargeResult.qr_code_base64}`}
                    alt="QR Code PIX"
                    className="w-48 h-48 rounded-xl"
                  />
                </div>
              )}
              {chargeResult.qr_code && (
                <Button onClick={() => copyPixCode(chargeResult.qr_code!)} variant="outline" className="w-full">
                  <Copy className="h-4 w-4" /> Copiar Código Pix
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
        <p className="text-xs font-bold text-foreground mb-3">Resumo de Acertos</p>
        <div className="grid grid-cols-2 gap-3 text-center">
          <div>
            <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">App (automático)</p>
            <p className="text-sm font-black text-emerald-400 mt-1">{formatBRL(appCommission)}</p>
            <p className="text-[10px] text-muted-foreground">comissão já retida</p>
          </div>
          <div>
            <p className="text-[10px] text-red-400 font-semibold uppercase tracking-wider">Físico (a cobrar)</p>
            <p className="text-sm font-black text-red-400 mt-1">{formatBRL((dbComissaoPendente > 0 ? dbComissaoPendente : commissionDue))}</p>
            <p className="text-[10px] text-muted-foreground">comissão pendente</p>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-3 text-center">
          Vendas via app são acertadas automaticamente pelo split. Vendas físicas precisam de cobrança manual.
        </p>
      </div>

      {/* Payment breakdown */}
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
            <p className="text-sm font-bold text-foreground">{formatBRL(physicalSales)}</p>
            <p className="text-[10px] text-red-400">- {formatBRL(commissionDue)} comissão</p>
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
            <p className="text-sm font-bold text-foreground">{formatBRL(appSales)}</p>
            <p className="text-[10px] text-emerald-400">comissão já retida</p>
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
              <Receipt className="h-4 w-4 text-pink-400" />
              Transações Recentes
            </p>
          </div>
          <div className="divide-y divide-border/20">
            {transactions.map((tx) => {
              const statusMeta = getTransactionStatusMeta(tx.status, tx.created_at, nowMs);
              const canRetryExpiredCharge = tx.transaction_kind === "commission_charge" && statusMeta.isExpired;
              return (
                <div key={tx.id} className="p-3 flex items-center gap-3 hover:bg-card/40 transition-colors">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    tx.transaction_kind === "commission_charge" ? "bg-red-500/10" : "bg-emerald-500/10"
                  }`}>
                    {tx.transaction_kind === "commission_charge"
                      ? <ArrowDownRight className="h-4 w-4 text-red-400" />
                      : <ArrowUpRight className="h-4 w-4 text-emerald-400" />
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
                        <Button onClick={handleGenerateCommissionCharge} size="sm" variant="outline" className="h-6 px-2 text-[10px]">
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
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-pink-400" />
        </div>
      ) : completedOrders.length > 0 ? (
        <div className="bg-card/60 backdrop-blur-sm rounded-2xl border border-border/30 overflow-hidden">
          <div className="p-4 border-b border-border/30">
            <p className="text-xs font-bold text-foreground">Extrato de Pedidos</p>
          </div>
          <div className="divide-y divide-border/20">
            {completedOrders.map(order => {
              const sub = Number(order.subtotal);
              // 🔒 Usa taxa histórica do pedido (corrigido)
              const commission = multiplyMoney(sub, getOrderCommissionRate(order));
              const net = subtractMoney(sub, commission);
              const isPix = order.payment_method === "pix";
              return (
                <div key={order.id} className="p-3 flex items-center gap-3 hover:bg-card/40 transition-colors">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${isPix ? "bg-emerald-500/10" : "bg-amber-500/10"}`}>
                    {isPix ? <Smartphone className="h-4 w-4 text-emerald-400" /> : <Banknote className="h-4 w-4 text-amber-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">#{order.id.substring(0, 6).toUpperCase()}</span>
                      <span className="text-[10px] text-muted-foreground">{format(new Date(order.created_at), "dd/MM HH:mm")}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[10px] text-muted-foreground">
                        {isPix ? "PIX App" : order.payment_method === "cartao" ? "Cartão" : "Dinheiro"}
                      </span>
                      <span className="text-sm font-bold text-foreground">{formatBRL(sub)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[10px] text-muted-foreground">Comissão: {formatBRL(commission)}</span>
                      <span className="text-xs font-semibold text-emerald-400">Líquido: {formatBRL(net)}</span>
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
          <p className="text-muted-foreground text-sm">Nenhum pedido finalizado neste período.</p>
        </div>
      )}
    </div>
  );
};

export default StoreFinancePanel;
