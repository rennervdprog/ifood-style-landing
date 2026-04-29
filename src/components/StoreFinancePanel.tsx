import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Download, ArrowUpRight, ArrowDownRight, Smartphone, Banknote, Receipt, Calendar, Loader2, X, CheckCircle2, RotateCcw, AlertCircle, TimerReset } from "lucide-react";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay, subWeeks } from "date-fns";
import { Button } from "@/components/ui/button";
import { formatBRL, multiplyMoney, sumMoney, averageMoney } from "@/lib/utils";
import { usePixCharge, getPendingChargeRemainingMs, formatCountdown, getTransactionStatusMeta, PIX_CHARGE_TTL_MS, mapTransactionToChargeResult, FinancialTransaction, ChargeResult } from "@/hooks/usePixCharge";
import PaymentStatement from "@/components/PaymentStatement";
import { SIMULATION_MODE, createSimulatedPixCharge, simulatePaymentDelay } from "@/lib/pixSimulation";
import { useStorePlan } from "@/hooks/useStorePlan";

interface StoreFinancePanelProps {
  storeId: string;
  storeName: string;
  variant?: "basic" | "commission";
}

export const StoreFinancePanel = ({ storeId, storeName, variant = "commission" }: StoreFinancePanelProps) => {
  const { nowMs } = usePixCharge();
  const [dateFilter, setDateFilter] = useState<"today" | "week" | "month">("week");
  const [generatingCharge, setGeneratingCharge] = useState(false);
  const [chargeResult, setChargeResult] = useState<ChargeResult | null>(null);
  const [chargeError, setChargeError] = useState<string | null>(null);
  const [simulatingPayment, setSimulatingPayment] = useState(false);
  const storePlan = useStorePlan(storeId);
  const queryClient = useQueryClient();

  const isCommission = variant === "commission";

  const dateRange = useMemo(() => {
    const now = new Date();
    switch (dateFilter) {
      case "today": return { start: startOfDay(now), end: endOfDay(now) };
      case "week": return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case "month": return { start: startOfMonth(now), end: endOfMonth(now) };
      default: return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    }
  }, [dateFilter]);

  const { data: orders } = useQuery({
    queryKey: ["store-finance-orders-v2", storeId, dateFilter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("total_price, subtotal, delivery_fee, app_fee, payment_method, status, created_at")
        .eq("store_id", storeId)
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString())
        .in("status", ["entregue", "finalizado"]);
      if (error) throw error;
      return data || [];
    },
    enabled: !!storeId,
  });

  const { data: storeBalance } = useQuery({
    queryKey: ["store-balance", storeId],
    queryFn: async () => {
      const { data, error } = await supabase.from("store_balances").select("*").eq("store_id", storeId).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!storeId,
  });

  const { data: transactions } = useQuery({
    queryKey: ["store-financial-transactions", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data as unknown as FinancialTransaction[]);
    },
    enabled: !!storeId,
  });

  const handleGenerateCharge = async () => {
    setGeneratingCharge(true);
    setChargeError(null);
    try {
      const functionName = isCommission ? "create-commission-charge" : "create-platform-fee-charge";
      const { data, error } = await supabase.functions.invoke(functionName, { body: { storeId } });
      if (error) throw error;
      setChargeResult(data);
    } catch (e: any) {
      setChargeError(e.message);
      toast.error("Erro ao gerar PIX");
    } finally {
      setGeneratingCharge(false);
    }
  };

  const handleSimulatePayment = async () => {
    if (!chargeResult) return;
    setSimulatingPayment(true);
    try {
      await simulatePaymentDelay();
      const { error } = await supabase.from("financial_transactions").update({ status: "paid" }).eq("reference_code", chargeResult.reference_code);
      if (error) throw error;
      setChargeResult(prev => prev ? { ...prev, status: "paid" } : null);
      toast.success("Pagamento simulado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["store-balance", storeId] });
      queryClient.invalidateQueries({ queryKey: ["store-financial-transactions", storeId] });
    } catch (e: any) {
      toast.error("Erro na simulação");
    } finally {
      setSimulatingPayment(false);
    }
  };

  const physicalSales = sumMoney(orders?.filter(o => o.payment_method !== "pix").map(o => o.total_price) || []);
  const appSales = sumMoney(orders?.filter(o => o.payment_method === "pix").map(o => o.total_price) || []);
  const commissionRate = storePlan.commissionRate || 0.1;
  const commissionDue = multiplyMoney(physicalSales, commissionRate);
  const pendingAmount = isCommission ? Number(storeBalance?.comissao_pendente || 0) : Number(storeBalance?.repasse_pendente || 0);

  const isChargeExpired = chargeResult && chargeResult.status === "pending" && getPendingChargeRemainingMs(chargeResult.created_at, nowMs) === 0;
  const isChargeSettled = chargeResult && ["paid", "approved"].includes(chargeResult.status);
  const currentChargeRemainingMs = chargeResult ? getPendingChargeRemainingMs(chargeResult.created_at, nowMs) : 0;

  return (
    <div className="space-y-4">
      {/* QR Code and Actions */}
      {chargeResult ? (
        <Card className="border-2 border-primary/50 bg-primary/5">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-primary">Pague via PIX</p>
              <button onClick={() => setChargeResult(null)}><X className="h-4 w-4" /></button>
            </div>
            <p className="text-2xl font-black text-center">{formatBRL(chargeResult.amount)}</p>
            
            {!isChargeSettled && !isChargeExpired && (
              <div className="flex flex-col items-center gap-2">
                <div className="bg-primary/20 text-primary px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2">
                  <TimerReset className="h-3.5 w-3.5" /> {formatCountdown(currentChargeRemainingMs)}
                </div>
                {chargeResult.qr_code_base64 && (
                  <img src={chargeResult.qr_code_base64.startsWith("data:") ? chargeResult.qr_code_base64 : `data:image/png;base64,${chargeResult.qr_code_base64}`} alt="QR" className="w-40 h-40" />
                )}
                <Button onClick={() => { navigator.clipboard.writeText(chargeResult.qr_code || ""); toast.success("Copiado!"); }} variant="outline" className="w-full">Copiar Código</Button>
                {SIMULATION_MODE && <Button onClick={handleSimulatePayment} disabled={simulatingPayment} className="w-full bg-amber-500">Simular Pagamento</Button>}
              </div>
            )}
            
            {isChargeSettled && <div className="text-center py-4 text-emerald-500 font-bold"><CheckCircle2 className="mx-auto mb-2" /> Confirmado!</div>}
            {isChargeExpired && <div className="text-center py-4 text-red-500 font-bold"><AlertCircle className="mx-auto mb-2" /> Expirado <Button onClick={handleGenerateCharge} size="sm" className="mt-2 w-full">Gerar Novo</Button></div>}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{isCommission ? "Comissão pendente" : "Taxas pendentes"}</p>
              <p className="text-xl font-black">{formatBRL(pendingAmount)}</p>
            </div>
            <Button onClick={handleGenerateCharge} disabled={pendingAmount <= 0 || generatingCharge}>
              {generatingCharge ? <Loader2 className="animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />} Pagar Agora
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Breakdown */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-[10px] uppercase text-muted-foreground font-bold">Vendas Físicas</p>
          <p className="text-sm font-bold">{formatBRL(physicalSales)}</p>
          <p className="text-[10px] text-red-400">-{isCommission ? "comissão" : "taxa"}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] uppercase text-muted-foreground font-bold">Vendas App</p>
          <p className="text-sm font-bold">{formatBRL(appSales)}</p>
          <p className="text-[10px] text-emerald-400">Split ok ✅</p>
        </Card>
      </div>

      <PaymentStatement storeId={storeId} storeName={storeName} />
    </div>
  );
};

export default StoreFinancePanel;
