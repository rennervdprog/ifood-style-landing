import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useStorePlan, StorePlanType } from "@/hooks/useStorePlan";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Crown, Check, X, Zap, ShieldCheck, ArrowUpRight, ArrowDownRight,
  CreditCard, TrendingUp, Star, Truck, BarChart3,
  Ticket, Heart, Image, Clock, Loader2, AlertCircle, CheckCircle2, XCircle
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";

interface Props {
  storeId: string;
  storeName: string;
}

const planLabels: Record<StorePlanType, string> = {
  fixed: "Essencial (Fixo)",
  hybrid: "Crescimento (Assinatura + Taxa)",
  commission_only: "Comissão Pura",
};

const planColors: Record<StorePlanType, string> = {
  fixed: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  hybrid: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
  commission_only: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
};

const planOptions: { type: StorePlanType; label: string; fee: number; rate: number; desc: string }[] = [
  { type: "fixed", label: "Essencial", fee: 180, rate: 0, desc: "R$ 180/mês • Sem taxa por pedido" },
  { type: "hybrid", label: "Crescimento", fee: 100, rate: 2.5, desc: "R$ 100/mês + 2,5% por pedido" },
  { type: "commission_only", label: "Comissão", fee: 0, rate: 15, desc: "Sem mensalidade • 15% por pedido" },
];

const featureList = [
  { key: "allowPix", label: "Pagamento PIX Online", icon: Zap },
  { key: "allowPlatformDelivery", label: "Entrega pela Plataforma", icon: Truck },
  { key: "allowLoyalty", label: "Programa de Fidelidade", icon: Heart },
  { key: "allowBanners", label: "Banners Promocionais", icon: Image },
  { key: "allowScheduling", label: "Agendamento de Pedidos", icon: Clock },
  { key: "allowFullReports", label: "Relatórios Completos", icon: BarChart3 },
  { key: "hasCommission", label: "Sistema de Comissão", icon: TrendingUp },
] as const;

const statusLabels: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: "Aguardando aprovação", color: "text-amber-600 bg-amber-500/10 border-amber-500/30", icon: AlertCircle },
  approved: { label: "Aprovado", color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/30", icon: CheckCircle2 },
  rejected: { label: "Recusado", color: "text-red-600 bg-red-500/10 border-red-500/30", icon: XCircle },
};

export default function StoreSubscription({ storeId, storeName }: Props) {
  const plan = useStorePlan(storeId);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedPlan, setSelectedPlan] = useState<StorePlanType | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [showChangePlan, setShowChangePlan] = useState(false);

  // Fetch prorata credit
  const { data: prorataCredit } = useQuery({
    queryKey: ["prorata-credit", storeId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("calculate_prorata_credit", { _store_id: storeId });
      if (error) throw error;
      return data as number;
    },
    enabled: !!storeId && showChangePlan,
  });

  // Fetch existing pending requests
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

      toast.success("Solicitação de troca de plano enviada! Aguarde aprovação do administrador.");
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
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const availablePlans = planOptions.filter(p => p.type !== plan.planType);
  const isUpgrade = selectedPlan && planOptions.findIndex(p => p.type === selectedPlan) < planOptions.findIndex(p => p.type === plan.planType);

  return (
    <div className="space-y-6">
      {/* Current Plan Card */}
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-card to-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Crown className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Seu Plano Atual</CardTitle>
                <CardDescription>{storeName}</CardDescription>
              </div>
            </div>
            <Badge className={`text-sm px-3 py-1 border ${planColors[plan.planType]}`}>
              {planLabels[plan.planType]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-background/60 rounded-xl p-4 border border-border">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <CreditCard className="h-4 w-4" />
                Mensalidade
              </div>
              <p className="text-2xl font-bold text-foreground">
                {plan.monthlyFee > 0 ? `R$ ${plan.monthlyFee.toFixed(0)}` : "—"}
              </p>
              <p className="text-xs text-muted-foreground">/mês</p>
            </div>
            <div className="bg-background/60 rounded-xl p-4 border border-border">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <TrendingUp className="h-4 w-4" />
                Taxa por Pedido
              </div>
              <p className="text-2xl font-bold text-foreground">
                {plan.commissionRate > 0 ? `${plan.commissionRate}%` : "—"}
              </p>
              <p className="text-xs text-muted-foreground">sobre vendas</p>
            </div>
          </div>

          <div className="flex items-center justify-between bg-background/60 rounded-xl p-3 border border-border">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Ticket className="h-4 w-4" />
              Cupons Ativos
            </div>
            <span className="text-sm font-semibold text-foreground">
              {plan.maxCoupons === null ? "Ilimitados" : `Até ${plan.maxCoupons}`}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Pending Request Banner */}
      {pendingRequest && (
        <Card className={`border ${statusLabels[pendingRequest.status]?.color || ""}`}>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start gap-3">
              {(() => {
                const StatusIcon = statusLabels[pendingRequest.status]?.icon || AlertCircle;
                return <StatusIcon className="h-5 w-5 mt-0.5 shrink-0" />;
              })()}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold">
                  Solicitação de troca: {planLabels[pendingRequest.current_plan_type as StorePlanType]} → {planLabels[pendingRequest.requested_plan_type as StorePlanType]}
                </p>
                <p className="text-xs mt-1 opacity-80">
                  {pendingRequest.status === "pending" && "Aguardando aprovação do administrador."}
                  {pendingRequest.status === "approved" && `Aprovado! ${pendingRequest.admin_notes ? `Nota: ${pendingRequest.admin_notes}` : ""}`}
                  {pendingRequest.status === "rejected" && `Recusado. ${pendingRequest.admin_notes ? `Motivo: ${pendingRequest.admin_notes}` : ""}`}
                </p>
                {pendingRequest.prorata_credit > 0 && (
                  <p className="text-xs mt-1 font-semibold">
                    Crédito prorata: R$ {Number(pendingRequest.prorata_credit).toFixed(2)}
                  </p>
                )}
              </div>
              <Badge variant="outline" className={statusLabels[pendingRequest.status]?.color}>
                {statusLabels[pendingRequest.status]?.label}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Features */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Funcionalidades do seu plano
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {featureList.map(({ key, label, icon: Icon }) => {
              const enabled = (plan as any)[key];
              return (
                <div key={key}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon className={`h-4 w-4 ${enabled ? "text-primary" : "text-muted-foreground/40"}`} />
                      <span className={`text-sm ${enabled ? "text-foreground" : "text-muted-foreground/60 line-through"}`}>
                        {label}
                      </span>
                    </div>
                    {enabled ? (
                      <Check className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground/30" />
                    )}
                  </div>
                  {key === "allowPlatformDelivery" && (
                    <p className="text-xs text-muted-foreground mt-1 ml-7">
                      * Disponível apenas em cidades com motoboys ativos
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Change Plan Section */}
      {!showChangePlan && !hasPendingRequest && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setShowChangePlan(true)}
        >
          <ArrowUpRight className="h-4 w-4 mr-2" />
          Solicitar Troca de Plano
        </Button>
      )}

      {showChangePlan && (
        <Card className="border-2 border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Trocar de Plano</CardTitle>
            <CardDescription>
              Selecione o novo plano desejado. A troca será processada após aprovação.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Prorata Credit Info */}
            {plan.monthlyFee > 0 && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                    Crédito Prorata
                  </span>
                </div>
                <p className="text-xs text-emerald-600/80 mt-1">
                  Você tem <strong>R$ {(prorataCredit ?? 0).toFixed(2)}</strong> de crédito restante do plano atual,
                  que será considerado na transição.
                </p>
              </div>
            )}

            {/* Plan Options */}
            <div className="space-y-3">
              {availablePlans.map(opt => (
                <button
                  key={opt.type}
                  onClick={() => setSelectedPlan(opt.type)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    selectedPlan === opt.type
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-foreground">{opt.label}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{opt.desc}</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      selectedPlan === opt.type ? "border-primary bg-primary" : "border-muted-foreground/30"
                    }`}>
                      {selectedPlan === opt.type && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Summary */}
            {selectedPlan && (
              <div className="bg-muted/50 rounded-xl p-4 space-y-2">
                <p className="text-sm font-bold text-foreground">Resumo da troca:</p>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Plano atual</span>
                  <span className="text-foreground">{planLabels[plan.planType]}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Novo plano</span>
                  <span className="font-semibold text-primary">{planLabels[selectedPlan]}</span>
                </div>
                {(prorataCredit ?? 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Crédito prorata</span>
                    <span className="font-semibold text-emerald-600">R$ {(prorataCredit ?? 0).toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
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
                {requesting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Solicitar Troca
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
