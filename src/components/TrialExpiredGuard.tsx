import { formatBRL } from "@/lib/utils";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Clock, Copy, CheckCircle2, Loader2, CreditCard, Sparkles, MessageCircle, Lock } from "lucide-react";
import { usePendingRepasse } from "@/hooks/usePendingRepasse";
import { REPASSE_RULES } from "@/lib/repasseRules";
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
  const [pixData, setPixData] = useState<{
    qr_code: string | null;
    qr_code_base64: string | null;
    reference_code: string;
    amount: number;
  } | null>(() => {
    // Restaura PIX pendente do localStorage (sobrevive ao reload)
    try {
      const saved = localStorage.getItem(`trial-pix-${storeId}`);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [copied, setCopied] = useState(false);
  const [polling, setPolling] = useState(() => {
    try {
      return !!localStorage.getItem(`trial-pix-${storeId}`);
    } catch {
      return false;
    }
  });

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

  // Bloqueio por REPASSE: vive no banco (stores.status) — a Fase 3 unifica
  // as duas telas: mensalidade pendente e repasse bloqueado aparecem juntos.
  const { data: storeBlock } = useQuery({
    queryKey: ["guard-store-block", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("stores")
        .select("status, billing_blocked_at, billing_block_reason")
        .eq("id", storeId)
        .maybeSingle();
      return data as any;
    },
    enabled: !!storeId,
    refetchInterval: 30_000,
  });
  const isRepasseBlocked = storeBlock?.status === "bloqueado";
  const { total: repasseTotal } = usePendingRepasse(isRepasseBlocked ? storeId : undefined);

  // Cobrança #REP já emitida (segunda-feira) com PIX pronto, se houver.
  const { data: pendingRepasseCharge } = useQuery({
    queryKey: ["guard-pending-repasse", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("financial_transactions")
        .select("id, reference_code, pix_copy_paste, pix_qr_code_base64, amount")
        .eq("store_id", storeId)
        .eq("status", "pending")
        .eq("transaction_kind", "commission_charge")
        .like("reference_code", "#REP-%")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
    enabled: !!storeId && isRepasseBlocked,
    staleTime: 1000 * 30,
  });

  const [repassePix, setRepassePix] = useState<{
    qr: string | null;
    base64: string | null;
    amount: number;
    ref?: string;
  } | null>(null);
  const [repasseLoading, setRepasseLoading] = useState(false);
  const [repasseCopied, setRepasseCopied] = useState(false);

  const repassePixShown =
    repassePix ??
    (pendingRepasseCharge?.pix_copy_paste
      ? {
          qr: pendingRepasseCharge.pix_copy_paste as string,
          base64: pendingRepasseCharge.pix_qr_code_base64 as string | null,
          amount: Number(pendingRepasseCharge.amount),
          ref: pendingRepasseCharge.reference_code as string,
        }
      : null);

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
 
   const shouldBlockMensalidade = isTrialExpired || hasUnpaidBill || isOverdue;
   const shouldBlock = shouldBlockMensalidade || isRepasseBlocked;

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
        try {
          localStorage.removeItem(`trial-pix-${storeId}`);
        } catch {}
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
      const restored = {
        qr_code: pendingPayment.pix_copy_paste,
        qr_code_base64: pendingPayment.pix_qr_code_base64,
        reference_code: pendingPayment.reference_code,
        amount: Number(pendingPayment.amount),
      };
      setPixData(restored);
      setPolling(true);
      try {
        localStorage.setItem(`trial-pix-${storeId}`, JSON.stringify(restored));
      } catch {}
    }
  }, [hasUnpaidBill, pendingPayment, pixData, storeId]);

  // Enquanto a loja está pausada por repasse, confere a reativação:
  // o webhook da Woovi reativa a loja quando o pagamento cai.
  useEffect(() => {
    if (!isRepasseBlocked) return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("stores")
        .select("status")
        .eq("id", storeId)
        .single();
      if (data?.status && data.status !== "bloqueado") {
        toast.success("Pagamento confirmado! Sua loja foi reativada.");
        queryClient.invalidateQueries({ queryKey: ["guard-store-block", storeId] });
        queryClient.invalidateQueries({ queryKey: ["store-plan", storeId] });
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [isRepasseBlocked, storeId, queryClient]);

  // 🔓 Bypass da MENSALIDADE quando ela é R$0 (Essencial gratuito) — as
  // condições acima já exigem monthlyFee > 0. O bloqueio por REPASSE não
  // tem bypass: vale pra qualquer plano, porque as vendas estão pausadas.
  if (!shouldBlock) {
    return <>{children}</>;
  }

  const handleGenerateRepassePix = async () => {
    setRepasseLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("payment-router", {
        body: {
          action: "commission_charge",
          store_id: storeId,
          amount: repasseTotal,
          description: "Repasse ItaSuper",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setRepassePix({
        qr: data?.pix_copy_paste ?? data?.qr_code ?? null,
        base64: data?.pix_qr_code_base64 ?? data?.qr_code_base64 ?? null,
        amount: Number(data?.amount ?? repasseTotal),
        ref: data?.reference_code,
      });
      toast.success("PIX gerado! Pague para reativar sua loja.");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar PIX. Tente novamente.");
    } finally {
      setRepasseLoading(false);
    }
  };

  const handleCopyRepasse = () => {
    if (repassePixShown?.qr) {
      navigator.clipboard.writeText(repassePixShown.qr);
      setRepasseCopied(true);
      toast.success("Código PIX copiado!");
      setTimeout(() => setRepasseCopied(false), 3000);
    }
  };

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
      try {
        localStorage.setItem(`trial-pix-${storeId}`, JSON.stringify(res.data));
      } catch {}
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
      <Card className={`max-w-md w-full border-2 shadow-xl rounded-3xl ${isRepasseBlocked ? "border-destructive/40" : "border-amber-500/30"}`}>
        <CardContent className="p-6 space-y-6">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto ${isRepasseBlocked ? "bg-destructive/10" : "bg-amber-500/10"}`}>
              {isRepasseBlocked ? <Lock className="h-8 w-8 text-destructive" /> : <Clock className="h-8 w-8 text-amber-500" />}
            </div>
            <h1 className="text-2xl font-black text-foreground">
              {isRepasseBlocked ? "Sua loja está pausada" : isRecurring ? "Mensalidade pendente" : "Período de teste expirou"}
            </h1>
            <p className="text-muted-foreground leading-relaxed">
              {isRepasseBlocked ? (
                <>
                  As vendas pararam por um <span className="font-bold text-foreground">repasse em aberto</span>.
                  Quite abaixo pra voltar a vender — a reativação é automática quando o pagamento cair.
                  {shouldBlockMensalidade && " Sua mensalidade também está pendente — quite as duas pra liberar tudo."}
                </>
              ) : isRecurring ? (
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

          {/* Repasse bloqueado: bloco de quitação */}
          {isRepasseBlocked && (
            <div className="bg-destructive/5 border border-destructive/30 rounded-2xl p-4 space-y-3">
              <div>
                <p className="font-bold text-foreground">Repasse à plataforma</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {storeBlock?.billing_block_reason === "overdue"
                    ? "Uma cobrança de repasse ficou mais de 30 dias sem pagar."
                    : `O repasse passou do teto de ${formatBRL(REPASSE_RULES.BLOCK_THRESHOLD_BRL)} na rodada de segunda-feira.`}
                </p>
                <p className="text-3xl font-black text-foreground mt-2">{formatBRL(repasseTotal)}</p>
              </div>

              {!repassePixShown ? (
                <Button
                  onClick={handleGenerateRepassePix}
                  disabled={repasseLoading || repasseTotal <= 0}
                  className="w-full py-5 text-base font-bold rounded-2xl"
                  size="lg"
                >
                  {repasseLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Gerando PIX...
                    </>
                  ) : (
                    <>
                      <CreditCard className="mr-2 h-5 w-5" />
                      Gerar PIX do repasse
                    </>
                  )}
                </Button>
              ) : (
                <div className="space-y-3">
                  <p className="text-center text-2xl font-black text-primary">{formatBRL(repassePixShown.amount)}</p>
                  {repassePixShown.base64 && (
                    <div className="flex justify-center">
                      <img
                        src={`data:image/png;base64,${repassePixShown.base64}`}
                        alt="QR Code PIX"
                        className="w-48 h-48 rounded-xl border border-border"
                      />
                    </div>
                  )}
                  <Button onClick={handleCopyRepasse} variant="outline" className="w-full rounded-xl py-4">
                    {repasseCopied ? (
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
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Aguardando confirmação do pagamento...
                  </div>
                  {repassePixShown.ref && (
                    <p className="text-xs text-center text-muted-foreground">Ref: {repassePixShown.ref}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {shouldBlockMensalidade && (
          <>
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
          </>
          )}

          {/* Warning */}
          <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-500/10 rounded-xl p-3">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              {isRepasseBlocked
                ? "Enquanto o repasse não for quitado, sua loja não recebe pedidos novos. Seus dados e pedidos estão seguros."
                : "Enquanto o pagamento não for confirmado, o acesso ao painel ficará limitado. Seus dados e pedidos estão seguros."}
            </p>
          </div>

          {/* Suporte */}
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
