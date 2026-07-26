import { formatBRL } from "@/lib/utils";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Clock, Copy, CheckCircle2, Loader2, CreditCard, Sparkles, MessageCircle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { StorePlanFeatures } from "@/hooks/useStorePlan";

interface TrialExpiredGuardProps {
  storePlan: StorePlanFeatures;
  storeId: string;
  children: React.ReactNode;
}

export default function TrialExpiredGuard({ storePlan, storeId, children }: TrialExpiredGuardProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  // 🔓 Escape hatch: se o lojista já está pagando (ou está no plano R$0),
  // permite fechar o guard e ver o app mesmo com alguma cobrança residual.
  const [dismissed, setDismissed] = useState(false);
  const [pixData, setPixData] = useState<{
    qr_code: string | null;
    qr_code_base64: string | null;
    reference_code: string;
    amount: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [polling, setPolling] = useState(false);

  // Número/link de suporte da plataforma (fallback via admin_settings.support_whatsapp)
  const { data: supportCfg } = useQuery({
    queryKey: ["support-whatsapp-cfg"],
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_settings")
        .select("value")
        .eq("key", "support_whatsapp")
        .maybeSingle();
      return (data?.value as { number?: string; link?: string } | null) || null;
    },
    staleTime: 60_000,
  });

  // Check for pending subscription/monthly payment
  const { data: pendingPayment } = useQuery({
    queryKey: ["pending-subscription-payment", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("financial_transactions")
        .select("id, reference_code, pix_copy_paste, pix_qr_code_base64, amount, status")
        .eq("store_id", storeId)
        .eq("status", "pending")
        .or("reference_code.like.#ASSIN-%,reference_code.like.#MENS-%")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!storeId && storePlan.monthlyFee > 0,
    staleTime: 1000 * 30,
  });

   // Block if:
   // 1. Trial expired and never paid (original check)
   // 2. Has a pending monthly/subscription payment (recurring billing unpaid)
   // 3. Billing date is in the past AND fatura já foi gerada
   const isTrialExpired =
     storePlan.trialEndsAt !== null &&
     !storePlan.isInTrial &&
     storePlan.monthlyFee > 0 &&
     !storePlan.lastBilledAt;
 
   const hasUnpaidBill = !!pendingPayment && storePlan.monthlyFee > 0;
   
   // 🔒 BUG FIX: isOverdue agora exige fatura pendente (hasUnpaidBill).
   // Antes bloqueava apenas pela data — se o cron atrasasse ou falhasse,
   // o lojista era bloqueado sem ter recebido nenhuma cobrança para pagar.
   // Agora: só bloqueia por vencimento SE a fatura já foi gerada E não foi paga.
   const isOverdue =
     !storePlan.isInTrial &&
     storePlan.nextBillingDate !== null &&
     new Date(storePlan.nextBillingDate) < new Date() &&
     storePlan.monthlyFee > 0 &&
     hasUnpaidBill; // ← exige fatura existente
 
   const shouldBlock = isTrialExpired || hasUnpaidBill || isOverdue;

  // Poll for payment confirmation
  useEffect(() => {
    const refCode = pixData?.reference_code || pendingPayment?.reference_code;
    if (!polling || !refCode) return;

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("financial_transactions")
        .select("status")
        .eq("reference_code", refCode)
        .single();

      if (data?.status === "paid") {
        setPolling(false);
        setPixData(null);
        toast.success("Pagamento confirmado! Acesso liberado.");
        queryClient.invalidateQueries({ queryKey: ["store-plan", storeId] });
        queryClient.invalidateQueries({ queryKey: ["pending-subscription-payment", storeId] });
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [polling, pixData, pendingPayment, storeId, queryClient]);

  // Auto-show existing pending payment PIX
  useEffect(() => {
    if (hasUnpaidBill && pendingPayment?.pix_copy_paste && !pixData) {
      setPixData({
        qr_code: pendingPayment.pix_copy_paste,
        qr_code_base64: pendingPayment.pix_qr_code_base64,
        reference_code: pendingPayment.reference_code,
        amount: Number(pendingPayment.amount),
      });
      setPolling(true);
    }
  }, [hasUnpaidBill, pendingPayment, pixData]);

  // 🔓 Bypass total quando a mensalidade é R$0 (Essencial gratuito).
  // Sem isso, cobranças órfãs de planos antigos travariam o lojista.
  if (storePlan.monthlyFee === 0 || !shouldBlock || dismissed) {
    return <>{children}</>;
  }

  const handleGeneratePix = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }

      const res = await supabase.functions.invoke("subscribe-plan-payment", {
        body: { store_id: storeId },
      });

      if (res.error) {
        toast.error(res.error.message || "Erro ao gerar pagamento.");
        return;
      }

      setPixData(res.data);
      setPolling(true);
    } catch {
      toast.error("Erro ao gerar PIX. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (pixData?.qr_code) {
      navigator.clipboard.writeText(pixData.qr_code);
      setCopied(true);
      toast.success("Código PIX copiado!");
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const planLabel = storePlan.planType === "fixed" ? "Essencial" : "Crescimento";
  const isRecurring = (hasUnpaidBill || isOverdue) && !isTrialExpired;

  const supportLink =
    supportCfg?.link ||
    (supportCfg?.number
      ? `https://wa.me/${String(supportCfg.number).replace(/\D/g, "")}?text=${encodeURIComponent(
          "Olá! Preciso de ajuda com minha mensalidade ItaSuper."
        )}`
      : null);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-2 border-amber-500/30 shadow-xl rounded-3xl">
        <CardContent className="p-6 space-y-6">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto">
              <Clock className="h-8 w-8 text-amber-500" />
            </div>
            <h1 className="text-2xl font-black text-foreground">
              {isRecurring ? "Mensalidade pendente" : "Período de teste expirou"}
            </h1>
            <p className="text-muted-foreground leading-relaxed">
              {isRecurring ? (
                <>
                  Sua mensalidade do plano{" "}
                  <span className="font-bold text-primary">{planLabel}</span> está pendente.
                  Efetue o pagamento para continuar usando todos os recursos.
                </>
              ) : (
                <>
                  Seu período de teste no plano{" "}
                  <span className="font-bold text-primary">{planLabel}</span> terminou.
                  Para continuar usando todos os recursos, ative seu plano.
                </>
              )}
            </p>
          </div>

          {/* Plan summary */}
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-bold text-foreground">Plano {planLabel}</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-foreground">R$ {storePlan.monthlyFee}</span>
              <span className="text-muted-foreground">/mês</span>
            </div>
            {storePlan.commissionRate > 0 && (
              <p className="text-xs text-muted-foreground">+ {storePlan.commissionRate}% de comissão por pedido</p>
            )}
          </div>

          {!pixData ? (
            /* Generate PIX button */
            <div className="space-y-3">
              <Button
                onClick={handleGeneratePix}
                disabled={loading}
                className="w-full py-6 text-base font-bold rounded-2xl shadow-lg shadow-primary/20"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Gerando PIX...
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-2 h-5 w-5" />
                    {isRecurring ? "Pagar mensalidade — PIX" : "Ativar plano — Pagar via PIX"}
                  </>
                )}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Após o pagamento, o acesso é liberado automaticamente.
                Cobrança mensal recorrente (a cada 30 dias).
              </p>
            </div>
          ) : (
            /* PIX Payment area */
            <div className="space-y-4">
              <div className="text-center space-y-2">
                <p className="text-sm font-bold text-foreground">Escaneie o QR Code ou copie o código:</p>
                <p className="text-2xl font-black text-primary">{formatBRL(pixData.amount)}</p>
              </div>

              {pixData.qr_code_base64 && (
                <div className="flex justify-center">
                  <img
                    src={`data:image/png;base64,${pixData.qr_code_base64}`}
                    alt="QR Code PIX"
                    className="w-48 h-48 rounded-xl border border-border"
                  />
                </div>
              )}

              <Button
                onClick={handleCopy}
                variant="outline"
                className="w-full rounded-xl py-4"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-500" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar código PIX
                  </>
                )}
              </Button>

              {polling && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Aguardando confirmação do pagamento...
                </div>
              )}

              <p className="text-xs text-center text-muted-foreground">
                Ref: {pixData.reference_code}
              </p>
            </div>
          )}

          {/* Warning */}
          <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-500/10 rounded-xl p-3">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              Enquanto o pagamento não for confirmado, o acesso ao painel ficará limitado.
              Seus dados e pedidos estão seguros.
            </p>
          </div>

          {/* Escape hatch: suporte + histórico */}
          <div className="flex flex-col gap-2 pt-1">
            {supportLink && (
              <a
                href={supportLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-emerald-600 hover:text-emerald-700 py-2 rounded-xl border border-emerald-500/30 hover:bg-emerald-500/5 transition"
              >
                <MessageCircle className="h-4 w-4" />
                Falar com o suporte ItaSuper
              </a>
            )}
            <button
              onClick={() => setDismissed(true)}
              className="inline-flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground py-1.5"
            >
              <FileText className="h-3.5 w-3.5" />
              Ver histórico de cobranças no painel
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
