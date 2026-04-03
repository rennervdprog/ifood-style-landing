import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Download, ArrowUpRight, ArrowDownRight, Smartphone, Banknote, QrCode, Loader2, X, CheckCircle2, RotateCcw, AlertCircle, TimerReset, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import {
  recordPixAttempt,
  resetPixAttempts,
  isPixCooldownActive,
  getPixCooldownRemainingMs,
  activatePixCooldown,
  activateSafetyMode,
  isSafetyModeActive,
  getSafetyModeRemainingMs,
  formatCooldownTime,
} from "@/lib/pixSafeGuard";
import { SIMULATION_MODE, createSimulatedPixCharge, simulatePaymentDelay } from "@/lib/pixSimulation";

interface StoreFinancePanelProps {
  storeId: string;
  storeName: string;
}

type Period = "week" | "month";

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
    return {
      label: "Expirada",
      className: "bg-destructive/10 text-destructive",
      isExpired: true,
    };
  }

  if (status === "paid" || status === "approved") {
    return {
      label: "Pago",
      className: "bg-primary/10 text-primary",
      isExpired: false,
    };
  }

  if (status === "failed" || status === "cancelled") {
    return {
      label: status === "cancelled" ? "Cancelada" : "Falhou",
      className: "bg-destructive/10 text-destructive",
      isExpired: status === "cancelled",
    };
  }

  return {
    label: "Pendente",
    className: "bg-primary/10 text-primary",
    isExpired: false,
  };
};

const StoreFinancePanel = ({ storeId, storeName }: StoreFinancePanelProps) => {
  const [period, setPeriod] = useState<Period>("week");
  const [generatingCharge, setGeneratingCharge] = useState(false);
  const [chargeResult, setChargeResult] = useState<ChargeResult | null>(null);
  const [chargeError, setChargeError] = useState<string | null>(null);
  const [simulatingPayment, setSimulatingPayment] = useState(false);
  const [dismissedChargeReference, setDismissedChargeReference] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const queryClient = useQueryClient();

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

  // Fetch financial transactions for this store
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

  // Fetch store balance
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

  // DB balance
  const dbComissaoPendente = Number(storeBalance?.comissao_pendente || storeBalance?.pending_commission || 0);

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

    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

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
    if (chargeResult) {
      setDismissedChargeReference(chargeResult.reference_code);
    }
    setChargeResult(null);
    setChargeError(null);
  };

  const pixContextKey = `commission_${storeId}`;
  const [pixCooldownMs, setPixCooldownMs] = useState(0);
  const [safetyModeMs, setSafetyModeMs] = useState(0);

  // Poll cooldown / safety mode timers
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
      toast.error("Sistema de pagamentos em manutenção temporária. Aguarde alguns minutos.");
      return;
    }
    if (!SIMULATION_MODE && isPixCooldownActive(pixContextKey)) {
      toast.error("Muitas tentativas sem pagamento. Por segurança, aguarde alguns minutos para gerar uma nova cobrança.");
      return;
    }
    if (dbComissaoPendente <= 0 && commissionDue <= 0) {
      toast.info("Não há comissões pendentes para pagar.");
      return;
    }

    const chargeAmount = dbComissaoPendente > 0 ? dbComissaoPendente : commissionDue;

    if (!SIMULATION_MODE) {
      recordPixAttempt(pixContextKey);
      if (isPixCooldownActive(pixContextKey)) {
        activatePixCooldown(pixContextKey);
        toast.error("Muitas tentativas sem pagamento. Por segurança, aguarde alguns minutos para gerar uma nova cobrança.");
        return;
      }
    }

    setGeneratingCharge(true);
    setChargeError(null);
    setDismissedChargeReference(null);

    try {
      if (SIMULATION_MODE) {
        // --- SIMULATION MODE: bypass Mercado Pago ---
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

      // Roteador universal de pagamentos com failover automático
      const { data, error } = await supabase.functions.invoke("payment-router", {
        body: {
          action: "commission_charge",
          store_id: storeId,
          amount: chargeAmount,
          description: `Comissão FoodIta - ${storeName}`,
        },
      });

      if (error) {
        console.error("Commission charge request failed:", error);
        throw error;
      }

      if (data?.rate_limited) {
        activateSafetyMode();
        throw new Error("Sistema de pagamentos temporariamente indisponível. Tente novamente em alguns minutos.");
      }

      if (data?.error) throw new Error(data.error);
      // Standardized response: pix_code, qr_code_url
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

      if (data?.reused) {
        toast.info(`Cobrança existente ${data.reference_code} reaberta.`);
      } else {
        toast.success(`Cobrança ${data.reference_code} gerada!`);
      }

      resetPixAttempts(pixContextKey);
      queryClient.invalidateQueries({ queryKey: ["store-financial-transactions", storeId] });
      queryClient.invalidateQueries({ queryKey: ["store-balance", storeId] });
    } catch (err: any) {
      console.error("Commission PIX generation error:", err, "status:", err?.context?.status ?? err?.status, "code:", err?.code);

      if (err?.context?.status === 429 || err?.status === 429) {
        activateSafetyMode();
      }

      const message = /Failed to send request|Failed to fetch/i.test(err?.message || "")
        ? "Falha na conexão ao gerar o PIX. Tente novamente."
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

      {/* Separated debt cards */}
      <div className="grid grid-cols-1 gap-3">
        {/* Valores a Receber do App (Admin deve à Loja) */}
        <div className="bg-card rounded-2xl p-5 border border-green-500/20">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
              <ArrowUpRight className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-sm font-bold text-foreground">Valores a Receber do App</p>
          </div>
          <p className="text-xs text-muted-foreground mb-1">85% das vendas via PIX App (Admin deve a você)</p>
          <p className="text-2xl font-black text-green-500">R$ {creditFromApp.toFixed(2)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            O admin transferirá esse valor via PIX no fechamento.
          </p>
        </div>

        {/* Comissões Pendentes (Loja deve ao Admin) */}
        <div className="bg-card rounded-2xl p-5 border border-red-500/20">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center">
              <ArrowDownRight className="h-4 w-4 text-red-500" />
            </div>
            <p className="text-sm font-bold text-foreground">Comissões Pendentes</p>
          </div>
          <p className="text-xs text-muted-foreground mb-1">15% das vendas em Dinheiro/Cartão (Você deve ao Admin)</p>
          <p className="text-2xl font-black text-red-500">
            R$ {(dbComissaoPendente > 0 ? dbComissaoPendente : commissionDue).toFixed(2)}
          </p>

          {/* Safety Mode Banner */}
          {safetyModeMs > 0 && (
            <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-600">Manutenção temporária no sistema de pagamentos</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  O sistema voltará ao normal em {formatCooldownTime(safetyModeMs)}.
                </p>
              </div>
            </div>
          )}

          {/* Cooldown Banner */}
          {!safetyModeMs && pixCooldownMs > 0 && (
            <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-600">Muitas tentativas sem pagamento</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Por segurança, aguarde {formatCooldownTime(pixCooldownMs)} para gerar uma nova cobrança.
                </p>
              </div>
            </div>
          )}

          {/* ACTION BUTTON: Pagar Comissão via PIX */}
          {(dbComissaoPendente > 0 || commissionDue > 0) && (
            <Button
              onClick={handleGenerateCommissionCharge}
              disabled={generatingCharge || isPixBlocked}
              className="w-full mt-3 bg-red-500 hover:bg-red-600 text-white font-bold"
              size="lg"
            >
              {generatingCharge ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gerando PIX...
                </>
              ) : isPixBlocked ? (
                <>
                  <ShieldAlert className="h-4 w-4" />
                  Aguarde...
                </>
              ) : (
                <>
                  <QrCode className="h-4 w-4" />
                  Pagar Comissão via PIX
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {chargeError && !chargeResult && (
        <div className="bg-card rounded-2xl p-5 border border-destructive/20 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
              <AlertCircle className="h-4 w-4 text-destructive" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-foreground">Não foi possível gerar o PIX</p>
              <p className="text-xs text-muted-foreground">{chargeError}</p>
            </div>
          </div>
          <Button onClick={handleGenerateCommissionCharge} disabled={generatingCharge} className="w-full" variant="outline">
            <RotateCcw className="h-4 w-4" />
            Tentar Novamente
          </Button>
        </div>
      )}

      {/* QR Code Modal/Card */}
      {chargeResult && (
        <div className="bg-card rounded-2xl p-5 border-2 border-primary space-y-3 animate-in slide-in-from-bottom-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-primary">Pague via PIX</p>
            <button onClick={handleDismissChargeCard} className="text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="text-xs text-muted-foreground">
            Fatura: <span className="font-bold text-foreground">{chargeResult.reference_code}</span>
          </p>
          <p className="text-2xl font-black text-center text-foreground">
            R$ {chargeResult.amount.toFixed(2)}
          </p>

          {!isChargeExpired && !isChargeSettled && (
            <div className="rounded-xl border border-border bg-muted/30 p-3 text-center space-y-2">
              <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold ${isChargeUrgent ? "bg-destructive/10 text-destructive animate-pulse" : "bg-primary/10 text-primary"}`}>
                <TimerReset className="h-4 w-4" />
                {formatCountdown(currentChargeRemainingMs)}
              </div>
              <p className="text-xs text-muted-foreground">
                O QR Code é válido por 5 minutos. Se você não concluir o pagamento, precisará gerar um novo.
              </p>
            </div>
          )}

          {isChargeSettled ? (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center space-y-2">
              <CheckCircle2 className="h-8 w-8 text-primary mx-auto" />
              <p className="text-sm font-bold text-foreground">Pagamento confirmado</p>
              <p className="text-xs text-muted-foreground">O webhook já confirmou esta cobrança.</p>
            </div>
          ) : isChargeExpired ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-center space-y-3">
              <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
              <p className="text-sm font-bold text-foreground">Tempo esgotado! Este QR Code expirou para sua segurança.</p>
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
                <Button
                  onClick={() => copyPixCode(chargeResult.qr_code!)}
                  variant="outline"
                  className="w-full"
                >
                  <Copy className="h-4 w-4" />
                  Copiar Código Pix Copia e Cola
                </Button>
              )}

              {/* Simulation: Simulate Payment Button */}
              {SIMULATION_MODE && (
                <Button
                  onClick={handleSimulatePayment}
                  disabled={simulatingPayment}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold"
                >
                  {simulatingPayment ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    "🧪 Simular Pagamento (Ambiente de Teste)"
                  )}
                </Button>
              )}
            </>
          )}

          <p className="text-[10px] text-muted-foreground text-center">
            {isChargeSettled
              ? "Cobrança conciliada com sucesso."
              : isChargeExpired
                ? "A cobrança anterior ficou indisponível e pode ser gerada novamente."
                : "Após o pagamento, o saldo será zerado automaticamente via webhook."}
          </p>
        </div>
      )}

      {/* Balance card */}
      <div className="bg-card rounded-2xl p-5 border border-border">
        <p className="text-xs text-muted-foreground mb-2">Saldo Final</p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[10px] text-green-500 font-bold">Seu Crédito</p>
            <p className="text-sm font-black text-green-500">R$ {creditFromApp.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-[10px] text-red-500 font-bold">Seu Débito</p>
            <p className="text-sm font-black text-red-500">R$ {(dbComissaoPendente > 0 ? dbComissaoPendente : commissionDue).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-[10px] text-foreground font-bold">Líquido</p>
            <p className={`text-sm font-black ${finalBalance >= 0 ? "text-green-500" : "text-red-500"}`}>
              {finalBalance >= 0 ? "+" : "-"}R$ {Math.abs(finalBalance).toFixed(2)}
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3 text-center">
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

      {/* Recent Financial Transactions */}
      {transactions && transactions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Transações Financeiras</p>
          {transactions.map((tx) => {
            const statusMeta = getTransactionStatusMeta(tx.status, tx.created_at, nowMs);
            const canRetryExpiredCharge = tx.transaction_kind === "commission_charge" && statusMeta.isExpired;

            return (
              <div key={tx.id} className="bg-card rounded-xl p-3 border border-border flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  tx.transaction_kind === "commission_charge" ? "bg-destructive/10" : "bg-primary/10"
                }`}>
                  {tx.transaction_kind === "commission_charge"
                    ? <ArrowDownRight className="h-4 w-4 text-destructive" />
                    : <ArrowUpRight className="h-4 w-4 text-primary" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground">{tx.reference_code}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusMeta.className}`}>
                      {statusMeta.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5 gap-2">
                    <span className="text-xs text-muted-foreground">
                      {tx.transaction_kind === "commission_charge" ? "Cobrança Comissão" : "Repasse"}
                    </span>
                    <span className="text-sm font-bold text-foreground">R$ {Number(tx.amount).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1 gap-2">
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(tx.created_at), "dd/MM/yyyy HH:mm")}
                    </p>
                    {canRetryExpiredCharge && (
                      <Button onClick={handleGenerateCommissionCharge} size="sm" variant="outline" className="h-7 px-2 text-[10px]">
                        <RotateCcw className="h-3 w-3" />
                        Gerar nova cobrança
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
