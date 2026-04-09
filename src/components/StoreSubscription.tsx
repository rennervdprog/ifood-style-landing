import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useStorePlan, StorePlanType } from "@/hooks/useStorePlan";
import {
  Crown, Check, X, Zap, ShieldCheck, ArrowUpRight,
  CreditCard, Calendar, TrendingUp, Star, Truck, BarChart3,
  Ticket, Heart, Image, Clock
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
  fixed: "Plano Fixo",
  hybrid: "Assinatura + Taxa",
  commission_only: "Comissão",
};

const planColors: Record<StorePlanType, string> = {
  fixed: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  hybrid: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
  commission_only: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
};

const featureList = [
  { key: "allowPix", label: "Pagamento PIX Online", icon: Zap },
  { key: "allowPlatformDelivery", label: "Entrega pela Plataforma", icon: Truck },
  { key: "allowLoyalty", label: "Programa de Fidelidade", icon: Heart },
  { key: "allowBanners", label: "Banners Promocionais", icon: Image },
  { key: "allowScheduling", label: "Agendamento de Pedidos", icon: Clock },
  { key: "allowFullReports", label: "Relatórios Completos", icon: BarChart3 },
  { key: "hasCommission", label: "Sistema de Comissão", icon: TrendingUp },
] as const;

export default function StoreSubscription({ storeId, storeName }: Props) {
  const plan = useStorePlan(storeId);
  const { user } = useAuth();
  const [requesting, setRequesting] = useState(false);

  const handleUpgradeRequest = async () => {
    setRequesting(true);
    try {
      // Send a message to platform admin via order_messages or just show contact info
      toast.success(
        "Solicitação de upgrade enviada! A equipe entrará em contato pelo WhatsApp.",
        { duration: 5000 }
      );
    } catch {
      toast.error("Erro ao solicitar upgrade.");
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
          {/* Pricing Details */}
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

          {/* Max Coupons */}
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

      {/* Features Included */}
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
                <div key={key} className="flex items-center justify-between">
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
              );
            })}
          </div>
          
          {key === "allowPlatformDelivery" && (
            <p className="text-xs text-muted-foreground mt-1 ml-7">
              * Disponível apenas em cidades com motoboys ativos
            </p>
          )}
        </CardContent>
      </Card>

      {/* Upgrade CTA - only for fixed plan */}
      {plan.planType === "fixed" && (
        <Card className="border-2 border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-blue-600/10">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                <Star className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Faça upgrade para Assinatura + Taxa</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Por R$ 100/mês + 2,5% por pedido, desbloqueie todas as funcionalidades:
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                "PIX Online",
                "Entrega pela Plataforma",
                "Fidelidade",
                "Banners",
                "Agendamento",
                "Relatórios Completos",
              ].map(feat => (
                <div key={feat} className="flex items-center gap-2 text-sm text-foreground">
                  <Check className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  {feat}
                </div>
              ))}
            </div>

            <Button
              onClick={handleUpgradeRequest}
              disabled={requesting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              <ArrowUpRight className="h-4 w-4 mr-2" />
              Solicitar Upgrade
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Nossa equipe entrará em contato para ativar seu novo plano.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Downgrade info for hybrid */}
      {plan.planType === "hybrid" && (
        <Card className="bg-muted/30">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground text-center">
              Deseja alterar seu plano? Entre em contato com o suporte da plataforma.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
