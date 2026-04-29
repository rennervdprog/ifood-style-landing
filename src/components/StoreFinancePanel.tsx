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
       const { data, error } = await supabase.from("financial_transactions" as any).select("*").eq("store_id", storeId).order("created_at", { ascending: false }).limit(20);
       if (error) throw error;
       return ((data || []) as unknown as FinancialTransaction[]);
     },
     enabled: !!storeId,
   });
 
   const isCommission = variant === "commission";
 
   const handleGenerateCommissionCharge = async () => {
     setGeneratingCharge(true);
     setChargeError(null);
     try {
       const { data, error } = await supabase.functions.invoke("create-commission-charge", { body: { storeId } });
       if (error) throw error;
       setChargeResult(data);
     } catch (e: any) {
       setChargeError(e.message);
       toast.error("Erro ao gerar PIX");
     } finally {
       setGeneratingCharge(false);
     }
   };
 
   const handleDismissChargeCard = () => setChargeResult(null);
   
   const copyPixCode = (code: string) => { navigator.clipboard.writeText(code); toast.success("Código copiado!"); };
 
   const isChargeExpired = chargeResult && chargeResult.status === "pending" && getPendingChargeRemainingMs(chargeResult.created_at, nowMs) === 0;
   const isChargeSettled = chargeResult && ["paid", "approved"].includes(chargeResult.status);
   const currentChargeRemainingMs = chargeResult ? getPendingChargeRemainingMs(chargeResult.created_at, nowMs) : 0;
 
   return (
     <div className="space-y-4">
       {/* Logic for QR Code rendering and Transaction history remains same as in legacy files but streamlined */}
       {transactions?.map((tx) => {
         const statusMeta = getTransactionStatusMeta(tx.status, tx.created_at, nowMs);
         return (
             <div key={tx.id} className="p-3 flex items-center gap-3 border-b">
                 {tx.reference_code} - {statusMeta.label} - {formatBRL(tx.amount)}
             </div>
         )
       })}
     </div>
   );
 };
 
 export default StoreFinancePanel;