import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, QrCode, Copy, Loader2, CheckCircle2, X, ShieldAlert, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
 import { formatBRL } from "@/lib/utils";
import { useStorePlan } from "@/hooks/useStorePlan";

interface CommissionAlertProps {
  storeId: string;
  storeName: string;
  onGoToFinance?: () => void;
}

const CommissionAlert = ({ storeId, storeName, onGoToFinance }: CommissionAlertProps) => {
  const plan = useStorePlan(storeId);
  const isFeeOnly = plan.commissionRate === 0; // VIP ou plano fixo — pendência é só delivery/PDV
  const [generating, setGenerating] = useState(false);
  const [chargeResult, setChargeResult] = useState<{
    qr_code: string | null;
    qr_code_base64: string | null;
    reference_code: string;
    amount: number;
    status: string;
  } | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const queryClient = useQueryClient();

  const { data: storeBalance } = useQuery({
    queryKey: ["store-balance-alert", storeId],
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
    refetchInterval: 60000,
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

  // Check store status to see if blocked
  const { data: storeData } = useQuery({
    queryKey: ["store-status-alert", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("status, owner_id")
        .eq("id", storeId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!storeId,
  });

  // Get owner profile for document check (CPF/CNPJ é exigido pelo Asaas)
  const { data: ownerProfile } = useQuery({
    queryKey: ["owner-doc-alert", storeData?.owner_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("document")
        .eq("user_id", storeData!.owner_id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!storeData?.owner_id,
  });

  // Check oldest unpaid commission transaction
  const { data: oldestPending } = useQuery({
    queryKey: ["oldest-pending-commission", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("created_at")
        .eq("store_id", storeId)
        .eq("transaction_kind", "commission_charge")
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!storeId,
  });

  const pendingCommission = Number(storeBalance?.comissao_pendente || storeBalance?.pending_commission || 0);
  const hasDocument = !!ownerProfile?.document;
  const isBlocked = storeData?.status === "bloqueado";
  const minPayout = minPayoutSetting ?? 100;
  const canPay = pendingCommission >= minPayout || isBlocked;

  // Calculate days until deactivation
  const daysRemaining = oldestPending?.created_at
    ? Math.max(0, 3 - Math.floor((Date.now() - new Date(oldestPending.created_at).getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  if (dismissed || pendingCommission <= 0) return null;

  const handlePayCommission = async () => {
    if (!hasDocument) {
      toast.error("Cadastre seu CPF/CNPJ no perfil antes de pagar.");
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("payment-router", {
        body: {
          action: "commission_charge",
          store_id: storeId,
          amount: pendingCommission,
          description: `Comissão ItaSuper - ${storeName}`,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.pix_code && !data?.qr_code_url && !data?.qr_code && !data?.qr_code_base64) {
        throw new Error("QR Code não retornado");
      }
      setChargeResult({
        qr_code: data.pix_code ?? data.qr_code ?? null,
        qr_code_base64: data.qr_code_url ?? data.qr_code_base64 ?? null,
        reference_code: data.reference_code,
        amount: Number(data.amount || pendingCommission),
        status: data.status || "pending",
      });
      toast.success(`Cobrança ${data.reference_code} gerada!`);
      queryClient.invalidateQueries({ queryKey: ["store-balance-alert", storeId] });
    } catch (err: any) {
      toast.error(err?.message || "Erro ao gerar cobrança PIX.");
    } finally {
      setGenerating(false);
    }
  };

  const copyPixCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Código PIX copiado!");
  };

  const urgencyLevel = daysRemaining !== null && daysRemaining <= 1 ? "critical" : daysRemaining !== null && daysRemaining <= 2 ? "warning" : "info";

  const borderColor = isBlocked
    ? "border-red-500/50"
    : urgencyLevel === "critical"
    ? "border-red-500/40"
    : urgencyLevel === "warning"
    ? "border-amber-500/40"
    : "border-amber-500/30";

  const bgGradient = isBlocked
    ? "from-red-500/10"
    : urgencyLevel === "critical"
    ? "from-red-500/8"
    : "from-amber-500/8";

  return (
    <div className={`rounded-2xl border-2 ${borderColor} p-5 relative overflow-hidden`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${bgGradient} to-transparent`} />
      <div className="relative space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {isBlocked ? (
              <ShieldAlert className="h-6 w-6 text-red-500" />
            ) : (
              <AlertTriangle className={`h-6 w-6 ${urgencyLevel === "critical" ? "text-red-500 animate-pulse" : "text-amber-500"}`} />
            )}
            <div>
              <h3 className={`font-bold text-sm ${isBlocked ? "text-red-500" : "text-foreground"}`}>
                {isBlocked
                  ? "⛔ Loja Suspensa — Comissão Pendente"
                  : (isFeeOnly ? "Repasse Pendente — Taxa da Plataforma" : "Comissão Pendente — Repasse Plataforma")}
              </h3>
              <div className="text-[10px] text-muted-foreground mt-0.5 space-y-0.5">
                <p>
                  {isBlocked
                    ? "Sua loja foi suspensa por falta de pagamento. Pague para reativar imediatamente."
                    : (isFeeOnly
                        ? "Você possui taxas de entrega e PDV pendentes de vendas físicas (dinheiro/cartão)."
                        : "Você possui taxas e comissões pendentes de vendas físicas (dinheiro/cartão).")}
                </p>
                <p>
                  {isFeeOnly
                    ? "O valor corresponde à taxa da plataforma sobre entregas e vendas no PDV."
                    : "O valor inclui a comissão sobre produtos e a taxa de entrega da plataforma."}
                </p>
              </div>
            </div>
          </div>
          {!isBlocked && !chargeResult && (
            <button onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Amount */}
        <div className="text-center py-2">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Valor a Pagar</p>
          <p className={`text-3xl font-black ${isBlocked ? "text-red-500" : "text-amber-500"}`}>
            {formatBRL(pendingCommission)}
          </p>
        </div>

        {/* Deadline warning */}
        {!isBlocked && daysRemaining !== null && (
          <div className={`rounded-xl p-3 flex items-center gap-2 ${
            urgencyLevel === "critical"
              ? "bg-red-500/10 border border-red-500/30"
              : "bg-amber-500/10 border border-amber-500/20"
          }`}>
            <Clock className={`h-4 w-4 ${urgencyLevel === "critical" ? "text-red-400" : "text-amber-400"}`} />
            <p className={`text-xs font-medium ${urgencyLevel === "critical" ? "text-red-400" : "text-amber-400"}`}>
              {daysRemaining === 0
                ? "⚠️ Último dia! Sua loja será suspensa hoje se o repasse não for efetuado."
                : daysRemaining === 1
                ? "⚠️ Resta 1 dia para efetuar o repasse antes da suspensão automática."
                : `Você tem ${daysRemaining} dias para efetuar o repasse.`}
            </p>
          </div>
        )}

        {/* Always show the deactivation warning */}
        {!isBlocked && (
          <p className="text-[10px] text-muted-foreground text-center">
            ⚠️ Se a comissão não for paga em até <strong>3 dias</strong>, sua loja será automaticamente suspensa.
          </p>
        )}

        {/* QR Code result */}
        {chargeResult ? (
          <div className="space-y-3 bg-card/60 rounded-xl p-4 border border-border/30">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-foreground">Pague via PIX</p>
              <button onClick={() => setChargeResult(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Fatura: <span className="font-bold text-foreground">{chargeResult.reference_code}</span>
            </p>
            <p className="text-2xl font-black text-center text-foreground">{formatBRL(chargeResult.amount)}</p>

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
                <Copy className="h-4 w-4" /> Copiar Código Pix
              </Button>
            )}
            <p className="text-[10px] text-muted-foreground text-center">
              Após o pagamento, a confirmação é automática e sua comissão será zerada.
            </p>
          </div>
        ) : canPay ? (
          <Button
            onClick={handlePayCommission}
            disabled={generating || !hasDocument}
            className={`w-full font-bold text-white shadow-lg ${
              isBlocked
                ? "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-red-500/20"
                : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-amber-500/20"
            }`}
            size="lg"
          >
            {generating ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Gerando PIX...</>
            ) : !hasDocument ? (
              <><AlertTriangle className="h-4 w-4" /> Cadastre CPF/CNPJ no perfil</>
            ) : (
              <><QrCode className="h-4 w-4" /> Pagar Pendência via PIX</>
            )}
          </Button>
        ) : (
          <div className="space-y-2">
            <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (pendingCommission / minPayout) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              PIX disponível a partir de <strong className="text-foreground">{formatBRL(minPayout)}</strong>
              {" "}— faltam <strong className="text-amber-500">{formatBRL((minPayout - pendingCommission))}</strong>
            </p>
          </div>
        )}

        {onGoToFinance && !chargeResult && (
          <button
            onClick={onGoToFinance}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground underline"
          >
            Ver detalhes no painel financeiro
          </button>
        )}
      </div>
    </div>
  );
};

export default CommissionAlert;
