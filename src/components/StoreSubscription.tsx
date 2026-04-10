import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useStorePlan, StorePlanType } from "@/hooks/useStorePlan";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Crown, Check, X, Zap, ShieldCheck, ArrowUpRight,
  CreditCard, TrendingUp, Star, Truck, BarChart3,
  Ticket, Heart, Image, Clock, Loader2, AlertCircle, CheckCircle2, XCircle,
  Sparkles, Shield, Rocket, Calendar, Info, ChevronRight, Gift, Award
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { Progress } from "@/components/ui/progress";

interface Props {
  storeId: string;
  storeName: string;
}

const planLabels: Record<StorePlanType, string> = {
  fixed: "Essencial",
  hybrid: "Crescimento",
  commission_only: "Comissão Pura",
};

const planSubtitles: Record<StorePlanType, string> = {
  fixed: "Ideal para quem está começando",
  hybrid: "Perfeito para negócios em expansão",
  commission_only: "Sem custos fixos, pague só quando vender",
};

const planIcons: Record<StorePlanType, React.ElementType> = {
  fixed: Shield,
  hybrid: Rocket,
  commission_only: Sparkles,
};

const planGradients: Record<StorePlanType, string> = {
  fixed: "from-amber-500/20 via-amber-400/10 to-transparent",
  hybrid: "from-blue-500/20 via-blue-400/10 to-transparent",
  commission_only: "from-emerald-500/20 via-emerald-400/10 to-transparent",
};

const planAccents: Record<StorePlanType, string> = {
  fixed: "text-amber-600 dark:text-amber-400",
  hybrid: "text-blue-600 dark:text-blue-400",
  commission_only: "text-emerald-600 dark:text-emerald-400",
};

const planBadgeColors: Record<StorePlanType, string> = {
  fixed: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  hybrid: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
  commission_only: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
};

const planOptions: { type: StorePlanType; label: string; fee: number; rate: number; desc: string; highlights: string[] }[] = [
  {
    type: "fixed", label: "Essencial", fee: 180, rate: 0,
    desc: "R$ 180/mês • Sem taxa por pedido",
    highlights: ["Sem taxa por pedido", "Motoboy próprio", "Até 3 cupons"],
  },
  {
    type: "hybrid", label: "Crescimento", fee: 100, rate: 2.5,
    desc: "R$ 100/mês + 2,5% por pedido",
    highlights: ["Entregador próprio", "Relatórios completos", "Cupons ilimitados"],
  },
  {
    type: "commission_only", label: "Comissão", fee: 0, rate: 5,
    desc: "Sem mensalidade • 5% por pedido",
    highlights: ["Sem investimento inicial", "Todos os recursos", "Suporte completo"],
  },
];

// Itatinga-specific plan highlights
const itatingaFixedHighlights = ["PIX integrado", "Entregador próprio", "R$1/pedido PIX", "Cupons ilimitados"];

const featureCategories = [
  {
    title: "Pagamentos",
    icon: CreditCard,
    features: [
      { key: "allowPix", label: "Pagamento PIX Online", desc: "Receba via PIX com QR Code automático" },
    ],
  },
  /* Logística — motoboy plataforma oculto */
  /*{
    title: "Logística",
    icon: Truck,
    features: [
      { key: "allowPlatformDelivery", label: "Motoboys da Plataforma", desc: "Entregadores disponíveis na sua região" },
    ],
  },*/
  {
    title: "Marketing",
    icon: Heart,
    features: [
      { key: "allowLoyalty", label: "Programa de Fidelidade", desc: "Fidelize clientes com pontos e recompensas" },
      { key: "allowBanners", label: "Banners Promocionais", desc: "Destaque promoções na sua loja" },
    ],
  },
  {
    title: "Gestão",
    icon: BarChart3,
    features: [
      { key: "allowScheduling", label: "Agendamento de Pedidos", desc: "Permita pedidos programados" },
      { key: "allowFullReports", label: "Relatórios Completos", desc: "Gráficos e analytics detalhados" },
      { key: "hasCommission", label: "Sistema de Comissão", desc: "Gestão automática de comissões" },
    ],
  },
];

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType; bg: string }> = {
  pending: { label: "Aguardando aprovação", color: "text-amber-600", icon: AlertCircle, bg: "bg-amber-500/10 border-amber-500/30" },
  approved: { label: "Aprovado", color: "text-emerald-600", icon: CheckCircle2, bg: "bg-emerald-500/10 border-emerald-500/30" },
  rejected: { label: "Recusado", color: "text-red-600", icon: XCircle, bg: "bg-red-500/10 border-red-500/30" },
};

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
      toast.success("Solicitação enviada! Aguarde aprovação.");
      setShowChangePlan(false);
      setSelectedPlan(null);
      queryClient.invalidateQueries({ queryKey: ["plan-change-request", storeId] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao solicitar troca de plano.");
    } finally {
      setRequesting(false);
    }
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

  // Calculate enabled feature count
  const allFeatureKeys = featureCategories.flatMap(c => c.features.map(f => f.key));
  const enabledCount = allFeatureKeys.filter(k => (plan as any)[k]).length;
  const totalCount = allFeatureKeys.length;
  const featurePercent = Math.round((enabledCount / totalCount) * 100);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Hero Plan Card */}
      <Card className="overflow-hidden border-0 shadow-lg">
        <div className={`bg-gradient-to-br ${planGradients[plan.planType]} p-6 pb-0`}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-2xl bg-background/80 backdrop-blur flex items-center justify-center shadow-sm">
                <PlanIcon className={`h-7 w-7 ${planAccents[plan.planType]}`} />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Plano Atual</p>
                <h2 className="text-2xl font-bold text-foreground">{planLabels[plan.planType]}</h2>
                <p className="text-sm text-muted-foreground">{planSubtitles[plan.planType]}</p>
              </div>
            </div>
            <Badge className={`text-xs px-3 py-1.5 border ${planBadgeColors[plan.planType]}`}>
              Ativo
            </Badge>
          </div>

          {/* Trial Banner */}
          {plan.isInTrial && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 mb-4">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                <Gift className="h-5 w-5 text-emerald-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                  Período de teste grátis
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Progress value={((7 - plan.trialDaysLeft) / 7) * 100} className="h-1.5 flex-1 bg-emerald-200/30" />
                  <span className="text-xs font-semibold text-emerald-600 shrink-0">{plan.trialDaysLeft} dias</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <CardContent className="p-6 space-y-5">
          {/* Itatinga Fixed Plan Info Banner */}
          {plan.isItatingaFixed && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <div className="h-10 w-10 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
                <Zap className="h-5 w-5 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-blue-700 dark:text-blue-400">
                  Plano Especial Itatinga
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PIX integrado incluso. Taxa operacional de R$ 1 por pedido PIX. 
                  Use seu próprio entregador.
                </p>
              </div>
            </div>
          )}

          {/* Price Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-muted/40 rounded-xl p-4 text-center border border-border/50">
              <CreditCard className="h-4 w-4 mx-auto mb-2 text-muted-foreground" />
              <p className="text-2xl font-bold text-foreground">
                {plan.monthlyFee > 0 ? `R$${plan.monthlyFee}` : "—"}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mt-1">Mensal</p>
            </div>
            <div className="bg-muted/40 rounded-xl p-4 text-center border border-border/50">
              <TrendingUp className="h-4 w-4 mx-auto mb-2 text-muted-foreground" />
              <p className="text-2xl font-bold text-foreground">
                {plan.isItatingaFixed ? "R$1" : plan.commissionRate > 0 ? `${plan.commissionRate}%` : "—"}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mt-1">
                {plan.isItatingaFixed ? "Taxa/PIX" : "Taxa/Pedido"}
              </p>
            </div>
            <div className="bg-muted/40 rounded-xl p-4 text-center border border-border/50">
              <Ticket className="h-4 w-4 mx-auto mb-2 text-muted-foreground" />
              <p className="text-2xl font-bold text-foreground">
                {plan.maxCoupons === null ? "∞" : plan.maxCoupons}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mt-1">Cupons</p>
            </div>
          </div>

          {/* Feature Usage */}
          <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Recursos incluídos</span>
              </div>
              <span className="text-sm font-bold text-primary">{enabledCount}/{totalCount}</span>
            </div>
            <Progress value={featurePercent} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {featurePercent === 100
                ? "Todos os recursos estão desbloqueados!"
                : `Faça upgrade para desbloquear ${totalCount - enabledCount} recursos adicionais`}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Pending Request */}
      {pendingRequest && (
        <Card className={`border ${statusConfig[pendingRequest.status]?.bg || ""}`}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              {(() => {
                const cfg = statusConfig[pendingRequest.status];
                const StatusIcon = cfg?.icon || AlertCircle;
                return (
                  <div className={`h-10 w-10 rounded-xl ${cfg?.bg} flex items-center justify-center shrink-0`}>
                    <StatusIcon className={`h-5 w-5 ${cfg?.color}`} />
                  </div>
                );
              })()}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">
                  Solicitação de troca de plano
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {planLabels[pendingRequest.current_plan_type as StorePlanType]} → {planLabels[pendingRequest.requested_plan_type as StorePlanType]}
                </p>
                {pendingRequest.status === "pending" && (
                  <p className="text-xs text-amber-600 mt-1">Aguardando aprovação do administrador</p>
                )}
                {pendingRequest.status === "approved" && pendingRequest.admin_notes && (
                  <p className="text-xs text-emerald-600 mt-1">Nota: {pendingRequest.admin_notes}</p>
                )}
                {pendingRequest.status === "rejected" && pendingRequest.admin_notes && (
                  <p className="text-xs text-red-600 mt-1">Motivo: {pendingRequest.admin_notes}</p>
                )}
                {pendingRequest.prorata_credit > 0 && (
                  <p className="text-xs font-semibold mt-1">Crédito: R$ {Number(pendingRequest.prorata_credit).toFixed(2)}</p>
                )}
              </div>
              <Badge variant="outline" className={`text-[10px] ${statusConfig[pendingRequest.status]?.bg}`}>
                {statusConfig[pendingRequest.status]?.label}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Features by Category */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Detalhes do plano
          </CardTitle>
          <CardDescription>Funcionalidades incluídas no plano {planLabels[plan.planType]}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {featureCategories.map(cat => {
            const CatIcon = cat.icon;
            return (
              <div key={cat.title} className="space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <CatIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{cat.title}</span>
                </div>
                {cat.features.map(feat => {
                  const enabled = (plan as any)[feat.key];
                  return (
                    <div
                      key={feat.key}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                        enabled
                          ? "bg-primary/5 border-primary/20"
                          : "bg-muted/20 border-border/50 opacity-60"
                      }`}
                    >
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                        enabled ? "bg-primary/10" : "bg-muted/50"
                      }`}>
                        {enabled
                          ? <Check className="h-4 w-4 text-primary" />
                          : <X className="h-4 w-4 text-muted-foreground/50" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${enabled ? "text-foreground" : "text-muted-foreground line-through"}`}>
                          {feat.label}
                        </p>
                        <p className="text-xs text-muted-foreground">{feat.desc}</p>
                      </div>
                      {!enabled && (
                        <Badge variant="outline" className="text-[10px] shrink-0 border-dashed">
                          Upgrade
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Coupons note */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/30 border border-border/50">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">
                <strong>Cupons:</strong> {plan.maxCoupons === null
                  ? "Você pode criar cupons ilimitados no seu plano."
                  : `Seu plano permite até ${plan.maxCoupons} cupons ativos simultaneamente.`}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Billing Info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Informações de cobrança
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Loja</span>
              <span className="text-sm font-medium text-foreground">{storeName}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Plano</span>
              <span className="text-sm font-medium text-foreground">{planLabels[plan.planType]}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Mensalidade</span>
              <span className="text-sm font-bold text-foreground">
                {plan.monthlyFee > 0 ? `R$ ${plan.monthlyFee.toFixed(2)}` : "Isento"}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border/50">
              <span className="text-sm text-muted-foreground">Taxa por pedido</span>
              <span className="text-sm font-bold text-foreground">
                {plan.commissionRate > 0 ? `${plan.commissionRate}%` : "Sem taxa"}
              </span>
            </div>
            {plan.isInTrial && plan.trialEndsAt && (
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Trial expira em</span>
                <span className="text-sm font-bold text-orange-600 dark:text-orange-400">
                  {new Date(plan.trialEndsAt).toLocaleDateString("pt-BR")} ({plan.trialDaysLeft} dias)
                </span>
              </div>
            )}
            {plan.startedAt && (
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Início do plano</span>
                <span className="text-sm text-foreground">
                  {new Date(plan.startedAt).toLocaleDateString("pt-BR")}
                </span>
              </div>
            )}
            {plan.lastBilledAt && (
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Última cobrança</span>
                <span className="text-sm text-foreground">
                  {new Date(plan.lastBilledAt).toLocaleDateString("pt-BR")}
                </span>
              </div>
            )}
            {plan.nextBillingDate && (
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Próxima cobrança</span>
                <span className="text-sm font-bold text-foreground">
                  {new Date(plan.nextBillingDate).toLocaleDateString("pt-BR")}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge className={`${planBadgeColors[plan.planType]} border`}>
                {plan.isInTrial ? `Trial (${plan.trialDaysLeft}d)` : "Ativo"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Change Plan */}
      {!showChangePlan && !hasPendingRequest && (
        <Button
          variant="outline"
          className="w-full h-14 text-base gap-3 border-dashed border-2"
          onClick={() => setShowChangePlan(true)}
        >
          <ArrowUpRight className="h-5 w-5" />
          Solicitar Troca de Plano
          <ChevronRight className="h-4 w-4 ml-auto" />
        </Button>
      )}

      {showChangePlan && (
        <Card className="border-2 border-primary/30 overflow-hidden">
          <div className="bg-gradient-to-r from-primary/10 to-transparent p-5 pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Trocar de Plano
            </CardTitle>
            <CardDescription className="mt-1">
              Selecione o novo plano. A mudança será aplicada após aprovação do administrador.
            </CardDescription>
          </div>
          <CardContent className="p-5 space-y-4">
            {/* Prorata */}
            {plan.monthlyFee > 0 && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CreditCard className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Crédito Prorata</span>
                </div>
                <p className="text-xs text-emerald-600/80">
                  Você tem <strong>R$ {(prorataCredit ?? 0).toFixed(2)}</strong> de crédito do plano atual que será considerado.
                </p>
              </div>
            )}

            {/* Plan Cards */}
            <div className="space-y-3">
              {availablePlans.map(opt => {
                const OptIcon = planIcons[opt.type];
                const isSelected = selectedPlan === opt.type;
                return (
                  <button
                    key={opt.type}
                    onClick={() => setSelectedPlan(opt.type)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 shadow-md"
                        : "border-border hover:border-primary/30 hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isSelected ? "bg-primary/10" : "bg-muted/50"
                      }`}>
                        <OptIcon className={`h-5 w-5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-foreground">{opt.label}</p>
                          {opt.fee === 0 && (
                            <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600">Sem mensalidade</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">{opt.desc}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {opt.highlights.map(h => (
                            <span key={h} className="text-[10px] bg-muted/60 text-muted-foreground px-2 py-0.5 rounded-full">
                              {h}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 ${
                        isSelected ? "border-primary bg-primary" : "border-muted-foreground/30"
                      }`}>
                        {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Summary */}
            {selectedPlan && (
              <div className="bg-muted/40 rounded-xl p-4 space-y-2 border border-border/50">
                <p className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Info className="h-4 w-4 text-primary" />
                  Resumo da troca
                </p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">De</span>
                    <span className="text-foreground">{planLabels[plan.planType]}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Para</span>
                    <span className="font-semibold text-primary">{planLabels[selectedPlan]}</span>
                  </div>
                  {(prorataCredit ?? 0) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Crédito</span>
                      <span className="font-semibold text-emerald-600">R$ {(prorataCredit ?? 0).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-1">
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
                Solicitar Troca
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
