import { formatBRL } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useStorePlan, StorePlanType } from "@/hooks/useStorePlan";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check, X, Zap, ArrowUpRight, CreditCard, Ticket, Image as ImageIcon,
  Calendar, Loader2, AlertCircle, CheckCircle2, XCircle,
  Sparkles, Shield, Rocket, Info, Gift, Smartphone, BarChart3,
   Heart, Truck, Clock, ArrowRight, Wallet, AlertTriangle, ChevronRight, Crown,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { Progress } from "@/components/ui/progress";
import FixedPlanBillingHistory from "@/components/FixedPlanBillingHistory";
import { PLANS, DELIVERY_FEE_NOTE, PIX_FEE_NOTE } from "@/lib/plansInfo";
import PlansComparisonTable from "@/components/PlansComparisonTable";
import PlanFeeBreakdown from "@/components/fees/PlanFeeBreakdown";
import DeliveryFeeExplainer from "@/components/fees/DeliveryFeeExplainer";
import StoreAddonsPanel from "@/components/StoreAddonsPanel";

interface Props {
  storeId: string;
  storeName: string;
}

 const planLabels: Record<StorePlanType, string> = {
    fixed: "Essencial",
    hybrid: "Crescimento",
    commission_only: "Comissão",
    supporter: "Apoiador",
    autonomy: "Autonomia",
    pdv_only: "Somente PDV",
 };

 const planSubtitles: Record<StorePlanType, string> = {
   fixed: "Mensalidade fixa, sem surpresas",
   hybrid: "Mensalidade reduzida + taxa por venda",
   commission_only: "Sem mensalidade, paga só quando vende",
   supporter: "Plano exclusivo de lançamento",
   autonomy: "Sem comissão e sem taxa de R$2 da plataforma",
   pdv_only: "Só balcão — sem delivery, sem vitrine",
 };

 const planIcons: Record<StorePlanType, React.ElementType> = {
   fixed: Shield,
   hybrid: Rocket,
   commission_only: Sparkles,
   supporter: Crown,
   autonomy: Crown,
   pdv_only: CreditCard,
 };

 const planAccent: Record<StorePlanType, string> = {
   fixed: "text-primary",
   hybrid: "text-primary",
   commission_only: "text-primary",
   supporter: "text-primary",
   autonomy: "text-primary",
   pdv_only: "text-primary",
 };

 const planAccentBg: Record<StorePlanType, string> = {
   fixed: "bg-primary/10",
   hybrid: "bg-primary/10",
   commission_only: "bg-primary/10",
   supporter: "bg-primary/10",
   autonomy: "bg-primary/10",
   pdv_only: "bg-primary/10",
 };

/** Opções de plano para troca — fonte única em plansInfo, filtrando destinos válidos. */
const ALL_SWITCHABLE: StorePlanType[] = ["fixed", "autonomy", "hybrid", "commission_only", "supporter"];
const planOptions: { type: StorePlanType; label: string; fee: number; rate: number; tagline: string; bullets: string[] }[] =
  ALL_SWITCHABLE.filter((id) => !!PLANS[id]).map((id) => {
    const p = PLANS[id];
    return {
      type: id,
      label: p.name,
      fee: p.monthlyFee,
      rate: p.commissionRate,
      tagline: p.tagline,
      bullets: p.features,
    };
  });

const features = [
  { key: "allowPix", label: "Pagamento PIX online", icon: CreditCard },
  { key: "allowLoyalty", label: "Programa de fidelidade", icon: Heart },
  { key: "allowBanners", label: "Banners promocionais", icon: ImageIcon },
  { key: "allowScheduling", label: "Agendamento de pedidos", icon: Clock },
  { key: "allowFullReports", label: "Relatórios completos", icon: BarChart3 },
  { key: "allowPlatformDelivery", label: "Motoboys próprios", icon: Truck },
];

const statusMeta: Record<string, { label: string; color: string; icon: React.ElementType; bg: string }> = {
  pending: { label: "Aguardando", color: "text-muted-foreground", icon: AlertCircle, bg: "bg-muted border-border" },
  approved: { label: "Aprovado", color: "text-primary", icon: CheckCircle2, bg: "bg-primary/10 border-primary/30" },
  rejected: { label: "Recusado", color: "text-destructive", icon: XCircle, bg: "bg-destructive/10 border-destructive/30" },
};

const formatDateBR = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function StoreSubscription({ storeId, storeName }: Props) {
  const plan = useStorePlan(storeId);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedPlan, setSelectedPlan] = useState<StorePlanType | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [showChangePlan, setShowChangePlan] = useState(false);

  const { data: prorataCredit } = useQuery({
    queryKey: ["prorata-credit", storeId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("calculate_prorata_credit", { _store_id: storeId });
      if (error) throw error;
      return data as number;
    },
    enabled: !!storeId && showChangePlan,
  });

  const { data: pendingRequest } = useQuery({
    queryKey: ["plan-change-request", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_change_requests" as any)
        .select("*")
        .eq("store_id", storeId)
        .order("requested_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!storeId,
  });

  // Pending unpaid charge for current plan
  const { data: pendingCharge } = useQuery({
    queryKey: ["pending-plan-charge", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("financial_transactions")
        .select("id, reference_code, amount, status, created_at, pix_copy_paste, pix_qr_code_base64")
        .eq("store_id", storeId)
        .eq("transaction_kind", "commission_charge")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!storeId,
    refetchInterval: 30000,
  });

  const hasPendingRequest = pendingRequest?.status === "pending";

  const handleRequestChange = async () => {
    if (!selectedPlan || !user) return;
    const target = planOptions.find(p => p.type === selectedPlan);
    if (!target) return;

    setRequesting(true);
    try {
      const { error } = await supabase
        .from("plan_change_requests" as any)
        .insert({
          store_id: storeId,
          current_plan_type: plan.planType,
          current_monthly_fee: plan.monthlyFee,
          requested_plan_type: target.type,
          requested_monthly_fee: target.fee,
          requested_commission_rate: target.rate,
          prorata_credit: prorataCredit || 0,
        });
      if (error) throw error;
      toast.success("Solicitação enviada! Aguarde aprovação do administrador.");
      setShowChangePlan(false);
      setSelectedPlan(null);
      queryClient.invalidateQueries({ queryKey: ["plan-change-request", storeId] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao solicitar troca de plano.");
    } finally {
      setRequesting(false);
    }
  };

  const handleCopyPix = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Código PIX copiado!");
  };

  if (plan.isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center space-y-3">
          <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-sm text-muted-foreground">Carregando plano...</p>
        </div>
      </div>
    );
  }

  const PlanIcon = planIcons[plan.planType];
  const availablePlans = planOptions.filter(p => p.type !== plan.planType);
  const enabledFeatures = features.filter(f => (plan as any)[f.key]);
  const disabledFeatures = features.filter(f => !(plan as any)[f.key]);

  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-6">
      {/* Explicador rápido de taxas — uma fonte de verdade */}
      <Card className="border-0 shadow-sm bg-card">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" />
            <p className="text-sm font-bold text-foreground">
              Como cobramos no seu plano
            </p>
          </div>
          <PlanFeeBreakdown
            planId={plan.planType}
            orderValue={50}
            viaPix
            monthlyFeeOverride={plan.monthlyFee}
            commissionRateOverride={plan.commissionRate}
            pixFeeOverride={plan.pixOperationalFee}
            isVip={plan.isVip}
          />
          <DeliveryFeeExplainer mode="store" platformFee={plan.platformDeliverySplit} />
          {plan.isVip && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/25 p-2.5">
              <Crown className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                <strong>Condições personalizadas</strong> — sua loja tem valores negociados diferentes do plano padrão. Os números abaixo já refletem o seu acordo.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ───────── HERO: Current plan ───────── */}
      <Card className="overflow-hidden border-0 shadow-md">
        <div className={`${planAccentBg[plan.planType]} p-5`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-12 w-12 rounded-2xl bg-background shadow-sm flex items-center justify-center shrink-0">
                <PlanIcon className={`h-6 w-6 ${planAccent[plan.planType]}`} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Plano Atual</p>
                <h2 className="text-xl font-bold text-foreground truncate">{planLabels[plan.planType]}</h2>
                <p className="text-xs text-muted-foreground truncate">{planSubtitles[plan.planType]}</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <Badge className="bg-background text-foreground border border-border/60">
                {plan.isInTrial ? `Trial · ${plan.trialDaysLeft}d` : "Ativo"}
              </Badge>
              {plan.isVip && (
                <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 gap-1">
                  <Crown className="h-3 w-3" /> VIP
                </Badge>
              )}
            </div>
          </div>
        </div>

        <CardContent className="p-5 space-y-4">
          {/* Trial progress */}
          {plan.isInTrial && (
            <div className="rounded-xl bg-primary/10 border border-primary/20 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Gift className="h-4 w-4 text-primary" />
                <p className="text-xs font-bold text-primary">
                  Período grátis · {plan.trialDaysLeft} {plan.trialDaysLeft === 1 ? "dia restante" : "dias restantes"}
                </p>
              </div>
              <Progress value={((7 - plan.trialDaysLeft) / 7) * 100} className="h-1.5" />
            </div>
          )}

          {/* Price summary — 2 big metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Mensalidade</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {plan.monthlyFee > 0 ? formatBRL(plan.monthlyFee) : "Grátis"}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {plan.monthlyFee > 0 ? "cobrada todo mês" : "sem mensalidade"}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                {plan.isFixedPlan ? "Taxa por pedido PIX" : "Taxa por pedido"}
              </p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {plan.isFixedPlan
                  ? (plan.pixOperationalFee > 0 ? formatBRL(plan.pixOperationalFee) : "Grátis")
                  : plan.commissionRate > 0 ? `${plan.commissionRate}%` : "Grátis"}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {plan.isFixedPlan
                  ? (plan.pixOperationalFee > 0 ? "só em pedidos pagos via PIX" : "PIX sem taxa nesta loja")
                  : "sobre o subtotal"}
              </p>
            </div>
          </div>

          {/* Delivery fee disclosure (paid by client) — reflete override VIP */}
          {plan.isFixedPlan && plan.platformDeliverySplit > 0 && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                  <Truck className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground">
                    Taxa de entrega: {formatBRL(plan.platformDeliverySplit)} por pedido
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                    Cobrada do <strong>cliente</strong> no checkout (não sai do seu caixa). Destinada à manutenção da infraestrutura, tecnologia e suporte da plataforma.
                  </p>
                </div>
              </div>
            </div>
          )}
          {plan.isFixedPlan && plan.platformDeliverySplit === 0 && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                  <Truck className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground">Sem taxa de plataforma na entrega</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                    Sua loja tem condição especial: o cliente paga exatamente a taxa que você define, sem acréscimo da plataforma.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Next billing callout */}
          {plan.monthlyFee > 0 && plan.nextBillingDate && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Calendar className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground">Próxima cobrança</p>
                  <p className="text-[11px] text-muted-foreground truncate">{formatDateBR(plan.nextBillingDate)}</p>
                </div>
              </div>
              <p className="text-base font-bold text-foreground shrink-0">{formatBRL(plan.monthlyFee)}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ───────── PENDÊNCIAS: Unpaid PIX charge ───────── */}
      {pendingCharge && (
        <Card className="border-2 border-border bg-muted overflow-hidden">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">Cobrança em aberto</p>
                <p className="text-xs text-muted-foreground">
                  {(pendingCharge as any).reference_code} · {formatBRL(Number((pendingCharge as any).amount))}
                </p>
              </div>
            </div>
            {(pendingCharge as any).pix_copy_paste ? (
              <div className="space-y-2">
                <div className="rounded-lg bg-background border border-border p-2 max-h-20 overflow-auto">
                  <p className="text-[10px] font-mono break-all text-muted-foreground">
                    {(pendingCharge as any).pix_copy_paste}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="default"
                  className="w-full"
                  onClick={() => handleCopyPix((pendingCharge as any).pix_copy_paste)}
                >
                  Copiar código PIX
                </Button>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Código PIX ainda não disponível — atualize em alguns segundos.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ───────── PLAN CHANGE REQUEST STATUS ───────── */}
      {pendingRequest && (
        <Card className={`border ${statusMeta[pendingRequest.status]?.bg || ""}`}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              {(() => {
                const cfg = statusMeta[pendingRequest.status];
                const StatusIcon = cfg?.icon || AlertCircle;
                return (
                  <div className={`h-10 w-10 rounded-xl ${cfg?.bg} flex items-center justify-center shrink-0 border-0`}>
                    <StatusIcon className={`h-5 w-5 ${cfg?.color}`} />
                  </div>
                );
              })()}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-foreground">Troca de plano</p>
                  <Badge variant="outline" className={`text-[10px] ${statusMeta[pendingRequest.status]?.color}`}>
                    {statusMeta[pendingRequest.status]?.label}
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                  <span>{planLabels[pendingRequest.current_plan_type as StorePlanType]}</span>
                  <ArrowRight className="h-3 w-3" />
                  <span className="font-semibold text-foreground">{planLabels[pendingRequest.requested_plan_type as StorePlanType]}</span>
                </div>
                {pendingRequest.status === "pending" && (
                  <p className="text-[11px] text-muted-foreground mt-1">Aguardando aprovação do administrador</p>
                )}
                {pendingRequest.admin_notes && pendingRequest.status !== "pending" && (
                  <p className={`text-[11px] mt-1 ${statusMeta[pendingRequest.status]?.color}`}>
                    Nota: {pendingRequest.admin_notes}
                  </p>
                )}
                {pendingRequest.prorata_credit > 0 && (
                  <p className="text-[11px] font-semibold text-primary mt-1">
                    Crédito aplicado: {formatBRL(Number(pendingRequest.prorata_credit))}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ───────── FEATURES INCLUDED ───────── */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-foreground">O que está incluso</h3>
              <p className="text-xs text-muted-foreground">Recursos do plano {planLabels[plan.planType]}</p>
            </div>
            <Badge variant="secondary" className="shrink-0">
              {enabledFeatures.length}/{features.length}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {enabledFeatures.map(f => {
              const Icon = f.icon;
              return (
                <div key={f.key} className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/15 p-2.5">
                  <Icon className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-xs font-medium text-foreground truncate">{f.label}</span>
                  <Check className="h-3.5 w-3.5 text-primary ml-auto shrink-0" />
                </div>
              );
            })}
            {disabledFeatures.map(f => {
              const Icon = f.icon;
              return (
                <div key={f.key} className="flex items-center gap-2 rounded-lg bg-muted/30 border border-border/40 p-2.5 opacity-50">
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground line-through truncate">{f.label}</span>
                  <X className="h-3.5 w-3.5 text-muted-foreground/50 ml-auto shrink-0" />
                </div>
              );
            })}
          </div>

          {/* Coupons row */}
          <div className="flex items-center justify-between rounded-lg bg-muted/30 border border-border/40 p-3">
            <div className="flex items-center gap-2">
              <Ticket className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-foreground">Cupons ativos</span>
            </div>
            <span className="text-sm font-bold text-foreground">
              {plan.maxCoupons === null ? "Ilimitados" : `Até ${plan.maxCoupons}`}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ───────── BILLING DETAILS (compact, only for paid plans) ───────── */}
      {plan.monthlyFee > 0 && (
        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Detalhes da cobrança</h3>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div className="flex flex-col">
                <span className="text-muted-foreground">Loja</span>
                <span className="font-medium text-foreground truncate">{storeName}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground">Início do plano</span>
                <span className="font-medium text-foreground">{formatDateBR(plan.startedAt)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground">Última cobrança</span>
                <span className="font-medium text-foreground">{formatDateBR(plan.lastBilledAt)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground">Próxima cobrança</span>
                <span className="font-medium text-foreground">{formatDateBR(plan.nextBillingDate)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ───────── BILLING HISTORY ───────── */}
      {plan.isFixedPlan && <FixedPlanBillingHistory storeId={storeId} storeName={storeName} />}

      {/* ───────── APP ADDON ───────── */}
      <AppAddonCard storeId={storeId} />

      {/* ───────── MÓDULOS (PDV etc.) ───────── */}
      <StoreAddonsPanel storeId={storeId} />

      {/* ───────── CHANGE PLAN CTA ───────── */}
      {!showChangePlan && !hasPendingRequest && (
        <Button
          variant="outline"
          className="w-full h-12 gap-2 border-dashed border-2"
          onClick={() => setShowChangePlan(true)}
        >
          <ArrowUpRight className="h-4 w-4" />
          <span className="font-semibold">Trocar de plano</span>
          <ChevronRight className="h-4 w-4 ml-auto opacity-50" />
        </Button>
      )}

      {/* ───────── CHANGE PLAN PANEL ───────── */}
      {showChangePlan && (
        <Card className="border-2 border-primary/30 overflow-hidden">
          <div className="bg-primary/5 p-4 border-b border-primary/10">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="text-base font-bold text-foreground">Escolher novo plano</h3>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              A mudança será aplicada após aprovação do administrador.
            </p>
          </div>

          <CardContent className="p-4 space-y-3">
            {/* Prorata credit info */}
            {plan.monthlyFee > 0 && (prorataCredit ?? 0) > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/20 p-3">
                <Gift className="h-4 w-4 text-primary shrink-0" />
                <p className="text-xs text-primary">
                  Você tem <strong>{formatBRL(prorataCredit ?? 0)}</strong> de crédito não utilizado do plano atual.
                </p>
              </div>
            )}

            {/* Plan options */}
            <div className="space-y-2">
              {availablePlans.map(opt => {
                const OptIcon = planIcons[opt.type];
                const isSelected = selectedPlan === opt.type;
                return (
                  <button
                    key={opt.type}
                    onClick={() => setSelectedPlan(opt.type)}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30 hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected ? "bg-primary/15" : planAccentBg[opt.type]
                      }`}>
                        <OptIcon className={`h-4 w-4 ${isSelected ? "text-primary" : planAccent[opt.type]}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-bold text-foreground">{opt.label}</p>
                          <p className="text-sm font-bold text-foreground shrink-0">
                            {opt.fee > 0 ? `${formatBRL(opt.fee)}/mês` : "Grátis"}
                          </p>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{opt.tagline}</p>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {opt.bullets.slice(0, 3).map(b => (
                            <span key={b} className="text-[10px] bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded">
                              {b}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 ${
                        isSelected ? "border-primary bg-primary" : "border-muted-foreground/30"
                      }`}>
                        {isSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Summary */}
            {selectedPlan && (
              <div className="rounded-lg bg-muted/40 border border-border/50 p-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Plano atual</span>
                  <span className="text-foreground">{planLabels[plan.planType]}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Novo plano</span>
                  <span className="font-bold text-primary">{planLabels[selectedPlan]}</span>
                </div>
                {(prorataCredit ?? 0) > 0 && (
                  <div className="flex items-center justify-between text-xs pt-1.5 border-t border-border/50">
                    <span className="text-muted-foreground">Crédito a aplicar</span>
                    <span className="font-bold text-primary">
                      {formatBRL(prorataCredit ?? 0)}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setShowChangePlan(false); setSelectedPlan(null); }}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                disabled={!selectedPlan || requesting}
                onClick={handleRequestChange}
              >
                {requesting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowUpRight className="h-4 w-4 mr-2" />}
                Solicitar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ───────── HELP NOTE ───────── */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30 border border-border/40">
        <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Dúvidas sobre seu plano? Entre em contato com o suporte. Trocas e cancelamentos são processados
          após aprovação do administrador.
        </p>
      </div>
    </div>
  );
}

/* ─── App Addon Card ─── */
function AppAddonCard({ storeId }: { storeId: string }) {
  const [subscribing, setSubscribing] = useState(false);
  const queryClient = useQueryClient();

  const { data: store } = useQuery({
    queryKey: ["store-app-status", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("app_enabled, app_subscribed")
        .eq("id", storeId)
        .single();
      if (error) throw error;
      return data as { app_enabled: boolean; app_subscribed: boolean };
    },
    enabled: !!storeId,
  });

  if (!store?.app_enabled) return null;

  const handleToggleSubscription = async () => {
    setSubscribing(true);
    try {
      const { error } = await supabase
        .from("stores")
        .update({ app_subscribed: !store.app_subscribed })
        .eq("id", storeId);
      if (error) throw error;

      await supabase
        .from("store_plans")
        .update({ app_addon_fee: !store.app_subscribed ? 99 : 0 })
        .eq("store_id", storeId);

      toast.success(store.app_subscribed ? "App cancelado." : "App ativado com sucesso! 🚀");
      queryClient.invalidateQueries({ queryKey: ["store-app-status", storeId] });
      queryClient.invalidateQueries({ queryKey: ["store-plan", storeId] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao alterar assinatura do app.");
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <Card className="overflow-hidden border-2 border-primary/20">
      <div className="bg-primary/5 p-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
            <Smartphone className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-foreground">App próprio</h3>
              {store.app_subscribed && (
                <Badge className="text-[10px] bg-primary/15 text-primary border-primary/20">Ativo</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Seu app exclusivo na Play Store</p>
          </div>
          <p className="text-base font-bold text-foreground shrink-0">R$ 99<span className="text-[10px] text-muted-foreground">/mês</span></p>
        </div>
      </div>
      <CardContent className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-1.5">
          {[
            "App com sua marca",
            "Push ilimitadas",
            "Só sua loja",
            "Sem WhatsApp API",
          ].map((item) => (
            <div key={item} className="flex items-center gap-1.5">
              <Check className="h-3 w-3 text-primary shrink-0" />
              <span className="text-[11px] text-foreground">{item}</span>
            </div>
          ))}
        </div>

        <Button
          className="w-full"
          variant={store.app_subscribed ? "outline" : "default"}
          onClick={handleToggleSubscription}
          disabled={subscribing}
        >
          {subscribing ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : store.app_subscribed ? (
            <XCircle className="h-4 w-4 mr-2" />
          ) : (
            <Rocket className="h-4 w-4 mr-2" />
          )}
          {store.app_subscribed ? "Cancelar app" : "Assinar — R$ 99/mês"}
        </Button>

        {store.app_subscribed && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/15">
            <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              App ativo! O administrador gerará o APK com a identidade da sua loja.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
