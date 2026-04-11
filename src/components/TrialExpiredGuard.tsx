import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Clock, Copy, CheckCircle2, Loader2, CreditCard, Sparkles } from "lucide-react";
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
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [polling, setPolling] = useState(false);

  // Only block if: has trial_ends_at, trial expired, and monthly_fee > 0
  const isTrialExpired =
    storePlan.trialEndsAt !== null &&
    !storePlan.isInTrial &&
    storePlan.monthlyFee > 0 &&
    // Don't block if there's already a next_billing_date set (means they already paid)
    !storePlan.lastBilledAt;

  // Poll for payment confirmation
  useEffect(() => {
    if (!polling || !pixData) return;

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("financial_transactions")
        .select("status")
        .eq("reference_code", pixData.reference_code)
        .single();

      if (data?.status === "paid") {
        setPolling(false);
        toast.success("Pagamento confirmado! Bem-vindo ao seu plano.");
        queryClient.invalidateQueries({ queryKey: ["store-plan", storeId] });
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [polling, pixData, storeId, queryClient]);

  if (!isTrialExpired) {
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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-2 border-amber-500/30 shadow-xl rounded-3xl">
        <CardContent className="p-6 space-y-6">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto">
              <Clock className="h-8 w-8 text-amber-500" />
            </div>
            <h1 className="text-2xl font-black text-foreground">Período de teste expirou</h1>
            <p className="text-muted-foreground leading-relaxed">
              Seu período de teste no plano{" "}
              <span className="font-bold text-primary">{planLabel}</span> terminou.
              Para continuar usando todos os recursos, ative seu plano.
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
                    Ativar plano — Pagar via PIX
                  </>
                )}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Após o pagamento, o acesso é liberado automaticamente.
                Próxima cobrança em 30 dias.
              </p>
            </div>
          ) : (
            /* PIX Payment area */
            <div className="space-y-4">
              <div className="text-center space-y-2">
                <p className="text-sm font-bold text-foreground">Escaneie o QR Code ou copie o código:</p>
                <p className="text-2xl font-black text-primary">R$ {pixData.amount.toFixed(2)}</p>
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
        </CardContent>
      </Card>
    </div>
  );
}
