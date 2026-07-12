import { formatBRL } from "@/lib/utils";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { parseBRL, parsePercent } from "@/hooks/useBRLInput";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AdminStoreAddonsPanel } from "@/components/admin/AdminStoreAddonsPanel";
import {
  Store, Crown, Search, Loader2, Check, X,
  CreditCard, TrendingUp, Zap, Truck, Heart,
  Image, Clock, BarChart3, Ticket, ChevronDown, ChevronUp,
  AlertCircle, CheckCircle2, XCircle, ArrowRight,
  Calendar, Pause, Play, Receipt, Send, History, Settings2
} from "lucide-react";

type PlanType = "fixed" | "hybrid" | "commission_only" | "autonomy";
type DisplayPlan = PlanType | "supporter";

const SUPPORTER_FEE = 75;
const SUPPORTER_LIMIT = 10;

// Fallback estático — usado apenas se a tabela plan_templates falhar/estiver vazia.
// Mantido para garantir que o painel nunca quebre.
const FALLBACK_LABELS: Record<DisplayPlan, string> = {
  supporter: "Apoiadores",
  fixed: "Essencial",
  hybrid: "Crescimento",
  commission_only: "Comissão",
  autonomy: "Autonomia",
};

const FALLBACK_DESCRIPTIONS: Record<DisplayPlan, string> = {
  supporter: "R$ 75/mês vitalício • Apenas 10 vagas • Todas as funcionalidades",
  fixed: "Mensalidade fixa, sem comissão, funcionalidades básicas",
  hybrid: "Mensalidade + taxa por pedido, todas funcionalidades",
  commission_only: "Apenas comissão por pedido, todas funcionalidades",
  autonomy: "Mensalidade fixa, sem taxa de R$2 da plataforma para o cliente",
};

const FALLBACK_DEFAULTS: Record<DisplayPlan, { monthly_fee: number; commission_rate: number }> = {
  supporter: { monthly_fee: SUPPORTER_FEE, commission_rate: 0 },
  fixed: { monthly_fee: 90, commission_rate: 0 },
  hybrid: { monthly_fee: 50, commission_rate: 2.5 },
  commission_only: { monthly_fee: 0, commission_rate: 6 },
  autonomy: { monthly_fee: 229.9, commission_rate: 0 },
};

const FALLBACK_FEATURES: Record<DisplayPlan, string[]> = {
  supporter: ["Preço vitalício R$75", "Sem comissão", "Tudo incluso", "PIX, Fidelidade, Banners", "Apenas 10 vagas"],
  fixed: ["Cardápio digital", "Pedidos online", "Dinheiro/Cartão", "Até 3 cupons"],
  hybrid: ["Tudo do Fixo +", "PIX Online", "Entrega plataforma*", "Fidelidade", "Banners", "Relatórios completos", "Cupons ilimitados"],
  commission_only: ["Tudo do Híbrido", "Sem mensalidade"],
  autonomy: ["Tudo do Essencial", "Sem taxa R$2 da plataforma", "Cliente paga a taxa exata"],
};

const planColors: Record<DisplayPlan, string> = {
  supporter: "bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-500/30",
  fixed: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  hybrid: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
  commission_only: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  autonomy: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30",
};

function resolveDisplayPlan(
  plan: { plan_type: string; monthly_fee: number } | null | undefined,
  supporterFee?: number,
): DisplayPlan | null {
  if (!plan) return null;
  // supporter é armazenado como plan_type='fixed'. Detectamos por:
  //  - fee bate com o valor do template supporter (configurável); ou
  //  - valores históricos (75 / 130) para retrocompatibilidade.
  if (plan.plan_type === "fixed") {
    const fee = Number(plan.monthly_fee);
    if (fee === SUPPORTER_FEE || fee === 130) return "supporter";
    if (supporterFee != null && fee === Number(supporterFee)) return "supporter";
  }
  return plan.plan_type as PlanType;
}

export default function AdminPlanManager() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [expandedStore, setExpandedStore] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  // Buscar plan_templates do banco (com fallback para constantes locais se falhar)
  const { data: planTemplates } = useQuery({
    queryKey: ["plan-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_templates" as any)
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Helpers que leem do banco com fallback seguro
  const getTemplate = (key: DisplayPlan) =>
    (planTemplates || []).find((t: any) => t.plan_key === key);

  const planLabels: Record<DisplayPlan, string> = {
    supporter: getTemplate("supporter")?.label || FALLBACK_LABELS.supporter,
    fixed: getTemplate("fixed")?.label || FALLBACK_LABELS.fixed,
    hybrid: getTemplate("hybrid")?.label || FALLBACK_LABELS.hybrid,
    commission_only: getTemplate("commission_only")?.label || FALLBACK_LABELS.commission_only,
    autonomy: getTemplate("autonomy")?.label || FALLBACK_LABELS.autonomy,
  };

  const planDescriptions: Record<DisplayPlan, string> = {
    supporter: getTemplate("supporter")?.description || FALLBACK_DESCRIPTIONS.supporter,
    fixed: getTemplate("fixed")?.description || FALLBACK_DESCRIPTIONS.fixed,
    hybrid: getTemplate("hybrid")?.description || FALLBACK_DESCRIPTIONS.hybrid,
    commission_only: getTemplate("commission_only")?.description || FALLBACK_DESCRIPTIONS.commission_only,
    autonomy: getTemplate("autonomy")?.description || FALLBACK_DESCRIPTIONS.autonomy,
  };

  const planDefaults: Record<DisplayPlan, { monthly_fee: number; commission_rate: number }> = {
    supporter: {
      monthly_fee: Number(getTemplate("supporter")?.monthly_fee ?? FALLBACK_DEFAULTS.supporter.monthly_fee),
      commission_rate: Number(getTemplate("supporter")?.commission_rate ?? FALLBACK_DEFAULTS.supporter.commission_rate),
    },
    fixed: {
      monthly_fee: Number(getTemplate("fixed")?.monthly_fee ?? FALLBACK_DEFAULTS.fixed.monthly_fee),
      commission_rate: Number(getTemplate("fixed")?.commission_rate ?? FALLBACK_DEFAULTS.fixed.commission_rate),
    },
    hybrid: {
      monthly_fee: Number(getTemplate("hybrid")?.monthly_fee ?? FALLBACK_DEFAULTS.hybrid.monthly_fee),
      commission_rate: Number(getTemplate("hybrid")?.commission_rate ?? FALLBACK_DEFAULTS.hybrid.commission_rate),
    },
    commission_only: {
      monthly_fee: Number(getTemplate("commission_only")?.monthly_fee ?? FALLBACK_DEFAULTS.commission_only.monthly_fee),
      commission_rate: Number(getTemplate("commission_only")?.commission_rate ?? FALLBACK_DEFAULTS.commission_only.commission_rate),
    },
    autonomy: {
      monthly_fee: Number(getTemplate("autonomy")?.monthly_fee ?? FALLBACK_DEFAULTS.autonomy.monthly_fee),
      commission_rate: Number(getTemplate("autonomy")?.commission_rate ?? FALLBACK_DEFAULTS.autonomy.commission_rate),
    },
  };

  const featuresByPlan: Record<DisplayPlan, string[]> = {
    supporter: getTemplate("supporter")?.features || FALLBACK_FEATURES.supporter,
    fixed: getTemplate("fixed")?.features || FALLBACK_FEATURES.fixed,
    hybrid: getTemplate("hybrid")?.features || FALLBACK_FEATURES.hybrid,
    commission_only: getTemplate("commission_only")?.features || FALLBACK_FEATURES.commission_only,
    autonomy: getTemplate("autonomy")?.features || FALLBACK_FEATURES.autonomy,
  };

  const { data: stores } = useQuery({
    queryKey: ["admin-all-stores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, status, address_city");
      if (error) throw error;
      return data;
    },
  });

  const { data: storePlans, isLoading } = useQuery({
    queryKey: ["admin-store-plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("store_plans").select("*").eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  // Fetch plan change requests
  const { data: planRequests } = useQuery({
    queryKey: ["admin-plan-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_change_requests" as any)
        .select("*")
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const pendingRequests = (planRequests || []).filter((r: any) => r.status === "pending");

  const getStorePlan = (storeId: string) => {
    return storePlans?.find(p => p.store_id === storeId);
  };

  const handleSetPlan = async (storeId: string, planType: PlanType, monthlyFee: number, commissionRate: number) => {
    setSaving(storeId);
    try {
      // Preserva overrides VIP, PDV e trial — UPDATE quando já existe, INSERT caso contrário.
      const { data: existing } = await supabase
        .from("store_plans")
        .select("id")
        .eq("store_id", storeId)
        .maybeSingle();

      const nextBilling = monthlyFee > 0
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        : null;

      if (existing) {
        const { error } = await supabase
          .from("store_plans")
          .update({
            plan_type: planType,
            monthly_fee: monthlyFee,
            commission_rate: commissionRate,
            is_active: true,
            next_billing_date: nextBilling,
          } as any)
          .eq("store_id", storeId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("store_plans")
          .insert({
            store_id: storeId,
            plan_type: planType,
            monthly_fee: monthlyFee,
            commission_rate: commissionRate,
            is_active: true,
            started_at: new Date().toISOString(),
            next_billing_date: nextBilling,
            pdv_enabled: false,
            pdv_commission_rate: planType === "fixed" ? 0 : planType === "hybrid" ? 1.0 : 2.0,
            pdv_commission_pending: 0,
            pdv_fixed_fee_per_sale: planType === "fixed" ? 1.0 : 0,
          });
        if (error) throw error;
      }

      // Also update the store's commission_rate for backward compatibility
      await supabase
        .from("stores")
        .update({ commission_rate: commissionRate } as any)
        .eq("id", storeId);

      toast.success(`Plano atualizado com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["admin-store-plans"] });
      queryClient.invalidateQueries({ queryKey: ["admin-all-stores"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar plano.");
    } finally {
      setSaving(null);
    }
  };

  // Toggle PDV ativo/inativo para uma loja
  const handleTogglePdv = async (storeId: string, currentEnabled: boolean) => {
    setSaving(storeId);
    try {
      const { error } = await supabase
        .from("store_plans")
        .update({ pdv_enabled: !currentEnabled } as any)
        .eq("store_id", storeId)
        .eq("is_active", true);
      if (error) throw error;
      toast.success(!currentEnabled ? "PDV ativado!" : "PDV desativado.");
      queryClient.invalidateQueries({ queryKey: ["admin-store-plans"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao alterar PDV.");
    } finally {
      setSaving(null);
    }
  };

  // Atualizar taxa PDV de uma loja
  const handleSetPdvRate = async (storeId: string, rate: number) => {
    setSaving(storeId);
    try {
      const { error } = await supabase
        .from("store_plans")
        .update({ pdv_commission_rate: rate } as any)
        .eq("store_id", storeId)
        .eq("is_active", true);
      if (error) throw error;
      toast.success("Taxa PDV atualizada!");
      queryClient.invalidateQueries({ queryKey: ["admin-store-plans"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar taxa PDV.");
    } finally {
      setSaving(null);
    }
  };

  const filteredStores = (stores || []).filter(s =>
    !search.trim() || s.name.toLowerCase().includes(search.toLowerCase())
  );

  // Plan distribution stats
  const planStats: Record<DisplayPlan | "no_plan", number> = {
    supporter: 0,
    fixed: 0,
    hybrid: 0,
    commission_only: 0,
    autonomy: 0,
    no_plan: 0,
  };
  (stores || []).forEach(s => {
    const plan = getStorePlan(s.id);
    const display = resolveDisplayPlan(plan, planDefaults.supporter.monthly_fee);
    if (display) planStats[display]++;
    else planStats.no_plan++;
  });

  const supporterUsed = planStats.supporter;
  const supporterAvailable = Math.max(0, SUPPORTER_LIMIT - supporterUsed);
  const totalRevenue = (storePlans || []).reduce((acc, p) => acc + (p.monthly_fee || 0), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Pending Plan Change Requests */}
      {pendingRequests.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            <h3 className="font-bold text-foreground">
              Solicitações de Troca ({pendingRequests.length})
            </h3>
          </div>
          {pendingRequests.map((req: any) => {
            const storeName = stores?.find(s => s.id === req.store_id)?.name || "Loja";
            return (
              <PlanChangeRequestCard
                key={req.id}
                request={req}
                storeName={storeName}
                onProcessed={() => {
                  queryClient.invalidateQueries({ queryKey: ["admin-plan-requests"] });
                  queryClient.invalidateQueries({ queryKey: ["admin-store-plans"] });
                }}
              />
            );
          })}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-card rounded-2xl p-4 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <CreditCard className="h-4 w-4 text-primary" />
            </div>
          </div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Receita Mensal</p>
          <p className="text-xl font-black text-primary mt-0.5">R$ {totalRevenue.toFixed(0)}</p>
          <p className="text-[10px] text-muted-foreground">assinaturas ativas</p>
        </div>
        <div className="bg-card rounded-2xl p-4 border-2 border-pink-500/30">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-xl bg-pink-500/10 flex items-center justify-center">
              <Heart className="h-4 w-4 text-pink-500" />
            </div>
          </div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Apoiador</p>
          <p className="text-xl font-black text-foreground mt-0.5">{supporterUsed}/{SUPPORTER_LIMIT}</p>
          <p className="text-[10px] text-muted-foreground">{supporterAvailable} vagas restantes</p>
        </div>
        {(["fixed", "commission_only", "autonomy"] as PlanType[]).map(pt => (
          <div key={pt} className="bg-card rounded-2xl p-4 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                pt === "fixed" ? "bg-amber-500/10" : pt === "hybrid" ? "bg-blue-500/10" : pt === "autonomy" ? "bg-purple-500/10" : "bg-emerald-500/10"
              }`}>
                <Crown className={`h-4 w-4 ${
                  pt === "fixed" ? "text-amber-500" : pt === "hybrid" ? "text-blue-500" : pt === "autonomy" ? "text-purple-500" : "text-emerald-500"
                }`} />
              </div>
            </div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{planLabels[pt]}</p>
            <p className="text-xl font-black text-foreground mt-0.5">{planStats[pt]}</p>
            <p className="text-[10px] text-muted-foreground">lojas</p>
          </div>
        ))}
      </div>

      {/* Plan Overview Cards */}
      <div className="grid lg:grid-cols-5 gap-3">
        {(["supporter", "fixed", "hybrid", "commission_only", "autonomy"] as DisplayPlan[]).map(pt => (
          <div key={pt} className={`bg-card rounded-2xl border-2 p-4 space-y-3 ${
            pt === "supporter" ? "border-pink-500/30" :
            pt === "fixed" ? "border-amber-500/20" :
            pt === "hybrid" ? "border-blue-500/20" :
            pt === "autonomy" ? "border-purple-500/30" : "border-emerald-500/20"
          }`}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground text-sm flex items-center gap-1">
                {pt === "supporter" && <Heart className="h-3.5 w-3.5 text-pink-500" />}
                {planLabels[pt]}
              </h3>
              <Badge className={`border text-xs ${planColors[pt]}`}>
                {pt === "supporter" ? `${supporterAvailable} vagas` : planLabels[pt]}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{planDescriptions[pt]}</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-foreground">
                {planDefaults[pt].monthly_fee > 0 ? `R$ ${planDefaults[pt].monthly_fee}` : "R$ 0"}
              </span>
              <span className="text-xs text-muted-foreground">/mês</span>
              {planDefaults[pt].commission_rate > 0 && (
                <span className="text-xs text-muted-foreground ml-2">+ {planDefaults[pt].commission_rate}%</span>
              )}
            </div>
            <div className="space-y-1.5">
              {featuresByPlan[pt].map(f => (
                <div key={f} className="flex items-center gap-2 text-xs text-foreground">
                  <Check className="h-3 w-3 text-primary shrink-0" />
                  {f}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar loja..."
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      {/* Store List */}
      <div className="space-y-2">
        {filteredStores.map(store => {
          const plan = getStorePlan(store.id);
          const isExpanded = expandedStore === store.id;
          const currentDisplay = resolveDisplayPlan(plan, planDefaults.supporter.monthly_fee);

          return (
            <div key={store.id} className="bg-card rounded-2xl border border-border overflow-hidden">
              <button
                onClick={() => setExpandedStore(isExpanded ? null : store.id)}
                className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    {currentDisplay === "supporter"
                      ? <Heart className="h-4 w-4 text-pink-500" />
                      : <Store className="h-4 w-4 text-primary" />}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-foreground">{store.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {store.address_city || "Itatinga"} • {store.status === "ativo" ? "Ativa" : store.status}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {currentDisplay ? (
                    <Badge className={`border text-[10px] ${planColors[currentDisplay]}`}>
                      {planLabels[currentDisplay]}
                      {plan ? ` • R$ ${Number(plan.monthly_fee ?? 0)}/mês` : ""}
                      {plan ? ` + ${Number(plan.commission_rate ?? 0)}%` : ""}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      Sem plano
                    </Badge>
                  )}
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-border p-4 space-y-4">
                  {/* Controle Total: datas, pause, gerar cobrança, histórico */}
                  {plan && currentDisplay && (
                    <FullControlPanel
                      plan={plan}
                      storeName={store.name}
                      currentDisplay={currentDisplay}
                      onChange={() => {
                        queryClient.invalidateQueries({ queryKey: ["admin-store-plans"] });
                      }}
                    />
                  )}

                  {/* Plan selection buttons */}
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                      {plan ? "Alterar plano" : "Definir plano"}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(["supporter", "fixed", "hybrid", "commission_only"] as DisplayPlan[]).map(pt => {
                        const isCurrentPlan = currentDisplay === pt;
                        const defaults = planDefaults[pt];
                        const isSupporterFull = pt === "supporter" && !isCurrentPlan && supporterAvailable <= 0;
                        return (
                          <button
                            key={pt}
                            onClick={() => {
                              if (isCurrentPlan || isSupporterFull) return;
                              // Supporter is stored as fixed plan with fee=130
                              const dbPlanType: PlanType = pt === "supporter" ? "fixed" : pt;
                              handleSetPlan(store.id, dbPlanType, defaults.monthly_fee, defaults.commission_rate);
                            }}
                            disabled={saving === store.id || isCurrentPlan || isSupporterFull}
                            className={`p-3 rounded-xl border-2 text-left transition-all ${
                              isCurrentPlan
                                ? "border-primary bg-primary/5 opacity-80"
                                : pt === "supporter"
                                  ? "border-pink-500/30 hover:border-pink-500 hover:bg-pink-500/5"
                                  : "border-border hover:border-primary/50 hover:bg-primary/5"
                            } disabled:opacity-50`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-bold text-foreground flex items-center gap-1">
                                {pt === "supporter" && <Heart className="h-3 w-3 text-pink-500" />}
                                {planLabels[pt]}
                              </span>
                              {isCurrentPlan && <Check className="h-3.5 w-3.5 text-primary" />}
                            </div>
                            <p className="text-lg font-black text-foreground">
                              {defaults.monthly_fee > 0 ? `R$ ${defaults.monthly_fee}` : "R$ 0"}
                              <span className="text-[10px] text-muted-foreground font-normal">/mês</span>
                            </p>
                            {defaults.commission_rate > 0 && (
                              <p className="text-[10px] text-muted-foreground">+ {defaults.commission_rate}% por pedido</p>
                            )}
                            {pt === "supporter" && (
                              <p className="text-[10px] text-pink-600 font-semibold mt-0.5">
                                {isSupporterFull ? "Esgotado" : `${supporterAvailable}/${SUPPORTER_LIMIT} vagas`}
                              </p>
                            )}
                            {saving === store.id && (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary mt-1" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom values */}
                  {plan && (
                    <CustomPlanEditor
                      storeId={store.id}
                      currentFee={plan.monthly_fee}
                      currentRate={plan.commission_rate}
                      currentPixOverride={(plan as any).pix_operational_fee_override}
                      currentDeliveryOverride={(plan as any).platform_delivery_split_override}
                      currentPdvFixedFee={(plan as any).pdv_fixed_fee_per_sale}
                      currentLifetimeFree={!!(plan as any).essencial_lifetime_free}
                      displayPlan={currentDisplay ?? (plan.plan_type as PlanType)}
                      planDefault={planDefaults[currentDisplay ?? (plan.plan_type as PlanType)]}
                      onSave={() => {
                        queryClient.invalidateQueries({ queryKey: ["admin-store-plans"] });
                        queryClient.invalidateQueries({ queryKey: ["admin-all-stores"] });
                      }}
                    />
                  )}

                  {/* PDV Config */}
                  {plan && (
                    <div className="mt-3 pt-3 border-t border-border/30">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            🖥️ Módulo PDV
                          </p>
                          <p className="text-[10px] text-muted-foreground">Lojista controla pelo painel dele</p>
                        </div>
                        <button
                          onClick={() => handleTogglePdv(store.id, !!(plan as any).pdv_enabled)}
                          disabled={saving === store.id}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            (plan as any).pdv_enabled !== false ? "bg-primary" : "bg-muted-foreground/30"
                          }`}
                        >
                          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                            (plan as any).pdv_enabled !== false ? "translate-x-6" : "translate-x-1"
                          }`} />
                        </button>
                      </div>

                      {(plan as any).pdv_enabled && (
                        <div className="mt-2 flex items-center gap-2">
                          <p className="text-[10px] text-muted-foreground whitespace-nowrap">Comissão PDV:</p>
                          <div className="flex items-center gap-1 bg-muted/40 rounded-lg px-2 py-1">
                            <input
                              type="number"
                              min="0"
                              max="10"
                              step="0.5"
                              defaultValue={(plan as any).pdv_commission_rate ?? 0}
                              onBlur={(e) => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val) && val !== (plan as any).pdv_commission_rate) {
                                  handleSetPdvRate(store.id, val);
                                }
                              }}
                              className="w-12 bg-transparent text-xs font-bold text-foreground text-center focus:outline-none"
                            />
                            <span className="text-[10px] text-muted-foreground">%</span>
                          </div>
                          {(plan as any).pdv_commission_pending > 0 && (
                            <span className="text-[10px] text-amber-500 font-semibold">
                              Pendente: R$ {Number((plan as any).pdv_commission_pending).toFixed(2)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CustomPlanEditor({ storeId, currentFee, currentRate, currentPixOverride, currentDeliveryOverride, currentPdvFixedFee, displayPlan, planDefault, onSave }: {
  storeId: string;
  currentFee: number;
  currentRate: number;
  currentPixOverride: number | null | undefined;
  currentDeliveryOverride: number | null | undefined;
  currentPdvFixedFee: number | null | undefined;
  displayPlan: DisplayPlan;
  planDefault: { monthly_fee: number; commission_rate: number };
  onSave: () => void;
}) {
  // supporter é gravado no banco como plan_type='fixed'
  const dbPlanType: PlanType = displayPlan === "supporter" ? "fixed" : displayPlan;
  // Default da taxa fixa PDV por plano (planos com cobrança fixa por venda).
  const DEFAULT_PDV_FIXED_BY_PLAN: Record<DisplayPlan, number> = {
    supporter: 0,
    fixed: 1,
    autonomy: 1,
    hybrid: 0,
    commission_only: 0,
  };
  const defaultPdvFixed = DEFAULT_PDV_FIXED_BY_PLAN[displayPlan] ?? (dbPlanType === "fixed" ? 1 : 0);
  const [fee, setFee] = useState(currentFee);
  const [rate, setRate] = useState(currentRate);
  const [pdvFixedFee, setPdvFixedFee] = useState(currentPdvFixedFee ?? 0);
  const [pdvCommRate, setPdvCommRate] = useState(0);
  const [pixOverrideEnabled, setPixOverrideEnabled] = useState(currentPixOverride != null);
  const [pixOverride, setPixOverride] = useState(currentPixOverride ?? 1.99);
  const [deliveryOverrideEnabled, setDeliveryOverrideEnabled] = useState(currentDeliveryOverride != null);
  const [deliveryOverride, setDeliveryOverride] = useState(currentDeliveryOverride ?? 2.00);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Toggle operacional: preenchimento automático do PIN de entrega (por loja)
  const { data: storeFlags, refetch: refetchStoreFlags } = useQuery({
    queryKey: ["admin-store-flags", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("driver_pin_autofill" as any)
        .eq("id", storeId)
        .maybeSingle();
      if (error) throw error;
      return (data as any) as { driver_pin_autofill: boolean | null } | null;
    },
    enabled: expanded,
  });
  const pinAutofill = !!storeFlags?.driver_pin_autofill;
  const [pinAutofillSaving, setPinAutofillSaving] = useState(false);
  const togglePinAutofill = async () => {
    setPinAutofillSaving(true);
    try {
      const target = !pinAutofill;
      const { data, error } = await supabase.functions.invoke("admin-set-pin-autofill", {
        body: { store_id: storeId, enabled: target },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const persisted = (data as any)?.driver_pin_autofill;
      if (persisted !== target) throw new Error("Alteração não persistida.");
      await refetchStoreFlags();
      toast.success(target ? "Auto-PIN ativado para esta loja." : "Auto-PIN desativado.");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao atualizar auto-PIN.");
    } finally {
      setPinAutofillSaving(false);
    }
  };

  const finalPix = pixOverrideEnabled ? pixOverride : null;
  const finalDelivery = deliveryOverrideEnabled ? deliveryOverride : null;

  const hasCustom =
    fee !== currentFee || rate !== currentRate ||
    pdvFixedFee !== (currentPdvFixedFee ?? 0) ||
    finalPix !== (currentPixOverride ?? null) ||
    finalDelivery !== (currentDeliveryOverride ?? null);

  // Detectar valores VIP comparando com o default REAL do plano (vindo de plan_templates).
  const isVip =
    Number(currentFee) !== Number(planDefault.monthly_fee) ||
    Number(currentRate) !== Number(planDefault.commission_rate) ||
    currentPixOverride != null ||
    currentDeliveryOverride != null ||
    (currentPdvFixedFee != null && Number(currentPdvFixedFee) !== defaultPdvFixed);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("store_plans")
        .update({
          monthly_fee: fee,
          commission_rate: rate,
          pdv_fixed_fee_per_sale: pdvFixedFee,
          pix_operational_fee_override: finalPix,
          platform_delivery_split_override: finalDelivery,
        } as any)
        .eq("store_id", storeId)
        .eq("is_active", true);
      if (error) throw error;
      await supabase.from("stores").update({ commission_rate: rate } as any).eq("id", storeId);
      toast.success("Configuração VIP salva!");
      onSave();
    } catch {
      toast.error("Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    // Usa o default REAL do plano (plan_templates) e respeita supporter.
    const d = { fee: Number(planDefault.monthly_fee), rate: Number(planDefault.commission_rate) };
    setSaving(true);
    try {
      await supabase.from("store_plans").update({
        monthly_fee: d.fee, commission_rate: d.rate, pdv_fixed_fee_per_sale: defaultPdvFixed,
        pix_operational_fee_override: null, platform_delivery_split_override: null,
      } as any).eq("store_id", storeId).eq("is_active", true);
      setFee(d.fee); setRate(d.rate);
      setPdvFixedFee(defaultPdvFixed);
      setPixOverrideEnabled(false); setDeliveryOverrideEnabled(false);
      toast.success("Valores resetados para o padrão do plano.");
      onSave();
    } catch { toast.error("Erro ao resetar."); }
    finally { setSaving(false); }
  };

  return (
    <div className="rounded-2xl border border-border overflow-hidden">
      {/* Header clicável */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4 text-amber-500" />
          <span className="text-xs font-black text-foreground">Configuração VIP</span>
          {isVip && (
            <span className="text-[10px] font-black bg-amber-500/15 text-amber-600 border border-amber-500/25 px-1.5 py-0.5 rounded-full">
              Personalizado
            </span>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="p-4 space-y-4">

          {/* Seção 1: Cobrança mensal */}
          <div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">💰 Cobrança mensal</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-muted-foreground font-semibold block mb-1">Mensalidade (R$)</label>
                <div className="flex items-center gap-1 bg-muted/40 border border-border rounded-xl px-3 py-2">
                  <span className="text-xs text-muted-foreground">R$</span>
                  <input type="number" min="0" step="10" value={fee}
                    onChange={e => setFee(Number(e.target.value))}
                    className="flex-1 bg-transparent text-sm font-bold text-foreground focus:outline-none min-w-0" />
                </div>
                {fee === 0 && <p className="text-[10px] text-emerald-500 mt-1">✓ Isento</p>}
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground font-semibold block mb-1">Comissão delivery (%)</label>
                <div className="flex items-center gap-1 bg-muted/40 border border-border rounded-xl px-3 py-2">
                  <input type="number" min="0" max="30" step="0.5" value={rate}
                    onChange={e => setRate(Number(e.target.value))}
                    className="flex-1 bg-transparent text-sm font-bold text-foreground focus:outline-none min-w-0" />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
                {rate === 0 && <p className="text-[10px] text-emerald-500 mt-1">✓ Isento</p>}
              </div>
            </div>
          </div>

          {/* Seção 2: PDV */}
          <div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">🖥️ PDV Presencial</p>
            <div>
              <label className="text-[11px] text-muted-foreground font-semibold block mb-1">Taxa fixa por venda PDV (R$)</label>
              <div className="flex items-center gap-1 bg-muted/40 border border-border rounded-xl px-3 py-2">
                <span className="text-xs text-muted-foreground">R$</span>
                <input type="number" min="0" step="0.10" value={pdvFixedFee}
                  onChange={e => setPdvFixedFee(Number(e.target.value))}
                  className="flex-1 bg-transparent text-sm font-bold text-foreground focus:outline-none min-w-0" />
                <span className="text-[10px] text-muted-foreground">por venda</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Padrão: R$ 1,00. Use 0 para isentar.</p>
            </div>
          </div>

          {/* Seção 2b: Operacional — Auto-PIN por loja */}
          <div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">🔐 Operacional</p>
            <div className="bg-muted/20 rounded-xl p-3">
              <label className="flex items-center justify-between cursor-pointer gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground">Auto-preencher PIN de entrega</p>
                  <p className="text-[10px] text-muted-foreground">Quando ativo, o entregador vê o PIN já preenchido ao finalizar a entrega desta loja.</p>
                </div>
                <button
                  onClick={togglePinAutofill}
                  disabled={pinAutofillSaving}
                  className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${pinAutofill ? "bg-primary" : "bg-muted-foreground/30"} ${pinAutofillSaving ? "opacity-50" : ""}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${pinAutofill ? "left-5" : "left-0.5"}`} />
                </button>
              </label>
            </div>
          </div>

          {/* Seção 3: Taxas por transação */}
          <div>
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">⚡ Taxas por transação</p>
            <div className="space-y-3">
              {/* PIX */}
              <div className="bg-muted/20 rounded-xl p-3 space-y-2">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="text-xs font-bold text-foreground">Taxa PIX personalizada</p>
                    <p className="text-[10px] text-muted-foreground">Padrão: R$ 1,99 por transação</p>
                  </div>
                  <button
                    onClick={() => setPixOverrideEnabled(!pixOverrideEnabled)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${pixOverrideEnabled ? "bg-primary" : "bg-muted-foreground/30"}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${pixOverrideEnabled ? "left-5" : "left-0.5"}`} />
                  </button>
                </label>
                {pixOverrideEnabled && (
                  <div className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2">
                    <span className="text-xs text-muted-foreground">R$</span>
                    <input type="number" min="0" step="0.10" value={pixOverride}
                      onChange={e => setPixOverride(Number(e.target.value))}
                      className="flex-1 bg-transparent text-sm font-bold text-foreground focus:outline-none" />
                    <span className="text-[10px] text-muted-foreground">por transação</span>
                  </div>
                )}
                {pixOverrideEnabled && pixOverride === 0 && (
                  <p className="text-[10px] text-emerald-500">✓ PIX isento para esta loja</p>
                )}
              </div>

              {/* Taxa de entrega */}
              <div className="bg-muted/20 rounded-xl p-3 space-y-2">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="text-xs font-bold text-foreground">Taxa de entrega personalizada</p>
                    <p className="text-[10px] text-muted-foreground">Padrão: R$ 2,00 por entrega — só cobrada quando a loja absorve a taxa (split ≠ cliente)</p>
                  </div>
                  <button
                    onClick={() => setDeliveryOverrideEnabled(!deliveryOverrideEnabled)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${deliveryOverrideEnabled ? "bg-primary" : "bg-muted-foreground/30"}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${deliveryOverrideEnabled ? "left-5" : "left-0.5"}`} />
                  </button>
                </label>
                {deliveryOverrideEnabled && (
                  <div className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-2">
                    <span className="text-xs text-muted-foreground">R$</span>
                    <input type="number" min="0" step="0.50" value={deliveryOverride}
                      onChange={e => setDeliveryOverride(Number(e.target.value))}
                      className="flex-1 bg-transparent text-sm font-bold text-foreground focus:outline-none" />
                    <span className="text-[10px] text-muted-foreground">por entrega</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-card border border-border/50 rounded-2xl p-3 space-y-2">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">📊 Resumo desta configuração</p>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Mensalidade</span>
                <span className={`font-bold ${fee === 0 ? "text-emerald-500" : "text-foreground"}`}>
                  {fee === 0 ? "Isento" : `R$ ${fee.toFixed(2).replace(".", ",")}/mês`}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Comissão delivery</span>
                <span className={`font-bold ${rate === 0 ? "text-emerald-500" : "text-foreground"}`}>
                  {rate === 0 ? "Isento" : `${rate}%`}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Taxa fixa PDV</span>
                <span className={`font-bold ${pdvFixedFee === 0 ? "text-emerald-500" : "text-foreground"}`}>
                  {pdvFixedFee === 0 ? "Isento" : `R$ ${pdvFixedFee.toFixed(2).replace(".", ",")} /venda`}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Taxa PIX</span>
                <span className="font-bold text-foreground">
                  {finalPix === null ? "R$ 1,99 (padrão)" : finalPix === 0 ? <span className="text-emerald-500">Isento</span> : `R$ ${Number(finalPix).toFixed(2).replace(".", ",")}`}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Taxa entrega</span>
                <span className="font-bold text-foreground">
                  {finalDelivery === null ? "R$ 2,00 (padrão)" : `R$ ${Number(finalDelivery).toFixed(2).replace(".", ",")}`}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Auto-PIN entrega</span>
                <span className={`font-bold ${pinAutofill ? "text-emerald-500" : "text-foreground"}`}>
                  {pinAutofill ? "Ativado" : "Desativado"}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground italic">
                ℹ️ Taxa de entrega só é cobrada da loja quando o split de plataforma é "loja". Se o cliente paga a taxa, este valor não é debitado.
              </p>
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-2">
            {isVip && (
              <button onClick={handleReset} disabled={saving}
                className="flex-1 py-2.5 rounded-xl border border-border text-xs font-bold text-muted-foreground hover:bg-muted/40 transition-colors disabled:opacity-50">
                Resetar padrão
              </button>
            )}
            <button onClick={handleSave} disabled={saving || !hasCustom}
              className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-black disabled:opacity-40 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crown className="h-3.5 w-3.5" />}
              {saving ? "Salvando..." : "Salvar Configuração VIP"}
            </button>
          </div>
          <AdminStoreAddonsPanel storeId={storeId} />
        </div>
      )}
    </div>
  );
}


function FullControlPanel({ plan, storeName, currentDisplay, onChange }: {
  plan: any;
  storeName: string;
  currentDisplay: DisplayPlan;
  onChange: () => void;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [savingDates, setSavingDates] = useState(false);

  const toDateInput = (iso: string | null | undefined) => {
    if (!iso) return "";
    return new Date(iso).toISOString().slice(0, 10);
  };

  const [trialEnds, setTrialEnds] = useState(toDateInput(plan.trial_ends_at));
  const [nextBilling, setNextBilling] = useState(toDateInput(plan.next_billing_date));
  const [lastBilled, setLastBilled] = useState(toDateInput(plan.last_billed_at));
  const [startedAt, setStartedAt] = useState(toDateInput(plan.started_at));

  const isPaused = plan.is_active === false;

  const logAdmin = async (action: string, details: any) => {
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      await supabase.from("admin_logs" as any).insert({
        admin_user_id: u.user.id,
        action,
        target_type: "store_plan",
        target_id: plan.store_id,
        details,
      } as any);
    } catch (err) {
      console.warn("admin_logs insert failed:", err);
    }
  };

  const handleSaveDates = async () => {
    setSavingDates(true);
    try {
      const patch: any = {
        trial_ends_at: trialEnds ? new Date(trialEnds).toISOString() : null,
        next_billing_date: nextBilling ? new Date(nextBilling).toISOString() : null,
        last_billed_at: lastBilled ? new Date(lastBilled).toISOString() : null,
        started_at: startedAt ? new Date(startedAt).toISOString() : plan.started_at || new Date().toISOString(),
      };
      const { error } = await supabase
        .from("store_plans")
        .update(patch)
        .eq("id", plan.id);
      if (error) throw error;

      await logAdmin("plan_dates_updated", {
        store_name: storeName,
        before: {
          trial_ends_at: plan.trial_ends_at,
          next_billing_date: plan.next_billing_date,
          last_billed_at: plan.last_billed_at,
          started_at: plan.started_at,
        },
        after: patch,
      });

      toast.success("Datas atualizadas e registradas no log.");
      setEditing(false);
      onChange();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar datas.");
    } finally {
      setSavingDates(false);
    }
  };

  const handleTogglePause = async () => {
    setPausing(true);
    try {
      const newActive = !plan.is_active === false ? false : !plan.is_active; // toggle
      const target = !plan.is_active; // if currently inactive -> reactivate
      const { error } = await supabase
        .from("store_plans")
        .update({ is_active: target })
        .eq("id", plan.id);
      if (error) throw error;

      await logAdmin(target ? "plan_reactivated" : "plan_paused", {
        store_name: storeName,
      });

      toast.success(target ? "Cobrança reativada." : "Cobrança pausada.");
      onChange();
    } catch (err: any) {
      toast.error(err.message || "Erro ao alterar status.");
    } finally {
      setPausing(false);
    }
  };

  const handleGenerateCharge = async () => {
    if (!confirm(`Gerar cobrança imediata de R$ ${Number(plan.monthly_fee).toFixed(2)} para "${storeName}"?`)) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("monthly-billing", {
        body: { store_id: plan.store_id, force: true },
      });
      if (error) throw error;
      const billed = (data as any)?.billed ?? 0;
      if (billed > 0) {
        toast.success(`Cobrança gerada para "${storeName}"!`);
        await logAdmin("manual_charge_generated", {
          store_name: storeName,
          amount: plan.monthly_fee,
          response: data,
        });
        onChange();
      } else {
        toast.warning((data as any)?.message || "Nenhuma cobrança gerada. Verifique se a loja está ativa e tem subconta Asaas.");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar cobrança.");
    } finally {
      setGenerating(false);
    }
  };

  const fmtDate = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";

  return (
    <div className="bg-muted/30 rounded-xl p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-primary" />
          <p className="text-xs font-bold text-foreground uppercase tracking-widest">Controle Total</p>
        </div>
        {isPaused ? (
          <Badge className="bg-destructive/10 text-destructive border-destructive/30 border text-[10px]">
            ⏸ Cobrança pausada
          </Badge>
        ) : (
          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 border text-[10px]">
            ▶ Ativa
          </Badge>
        )}
      </div>

      {/* Datas (read-only ou edit) */}
      {!editing ? (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-background rounded-lg p-2">
            <p className="text-[9px] uppercase text-muted-foreground font-semibold">Início</p>
            <p className="font-bold text-foreground">{fmtDate(plan.started_at)}</p>
          </div>
          <div className="bg-background rounded-lg p-2">
            <p className="text-[9px] uppercase text-muted-foreground font-semibold">Fim do trial</p>
            <p className="font-bold text-foreground">{fmtDate(plan.trial_ends_at)}</p>
          </div>
          <div className="bg-background rounded-lg p-2">
            <p className="text-[9px] uppercase text-muted-foreground font-semibold">Última cobrança</p>
            <p className="font-bold text-foreground">{fmtDate(plan.last_billed_at)}</p>
          </div>
          <div className="bg-background rounded-lg p-2">
            <p className="text-[9px] uppercase text-muted-foreground font-semibold">Próxima cobrança</p>
            <p className="font-bold text-primary">{fmtDate(plan.next_billing_date)}</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <label className="text-[9px] uppercase text-muted-foreground font-semibold">Início</label>
            <input
              type="date"
              value={startedAt}
              onChange={(e) => setStartedAt(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-xs text-foreground mt-1"
            />
          </div>
          <div>
            <label className="text-[9px] uppercase text-muted-foreground font-semibold">Fim do trial</label>
            <input
              type="date"
              value={trialEnds}
              onChange={(e) => setTrialEnds(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-xs text-foreground mt-1"
            />
          </div>
          <div>
            <label className="text-[9px] uppercase text-muted-foreground font-semibold">Última cobrança</label>
            <input
              type="date"
              value={lastBilled}
              onChange={(e) => setLastBilled(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-xs text-foreground mt-1"
            />
          </div>
          <div>
            <label className="text-[9px] uppercase text-muted-foreground font-semibold">Próxima cobrança</label>
            <input
              type="date"
              value={nextBilling}
              onChange={(e) => setNextBilling(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-xs text-foreground mt-1"
            />
          </div>
        </div>
      )}

      {currentDisplay === "supporter" && (
        <p className="text-[10px] text-pink-600 font-semibold">
          ⭐ Plano vitalício • Preço travado em R$ {SUPPORTER_FEE}
        </p>
      )}

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-2">
        {editing ? (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditing(false);
                setTrialEnds(toDateInput(plan.trial_ends_at));
                setNextBilling(toDateInput(plan.next_billing_date));
                setLastBilled(toDateInput(plan.last_billed_at));
                setStartedAt(toDateInput(plan.started_at));
              }}
              disabled={savingDates}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSaveDates}
              disabled={savingDates}
              className="text-xs"
            >
              {savingDates ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvar datas"}
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(true)}
              className="text-xs"
            >
              <Calendar className="h-3 w-3 mr-1" /> Editar datas
            </Button>
            <Button
              size="sm"
              variant={isPaused ? "default" : "outline"}
              onClick={handleTogglePause}
              disabled={pausing}
              className={`text-xs ${!isPaused ? "border-amber-500/40 text-amber-600 hover:bg-amber-500/10" : ""}`}
            >
              {pausing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : isPaused ? (
                <><Play className="h-3 w-3 mr-1" /> Reativar</>
              ) : (
                <><Pause className="h-3 w-3 mr-1" /> Pausar</>
              )}
            </Button>
          </>
        )}
      </div>

      {!editing && Number(plan.monthly_fee) > 0 && (
        <Button
          size="sm"
          onClick={handleGenerateCharge}
          disabled={generating || isPaused}
          className="w-full text-xs bg-primary"
        >
          {generating ? (
            <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Gerando...</>
          ) : (
            <><Send className="h-3 w-3 mr-1" /> Gerar cobrança agora (R$ {Number(plan.monthly_fee).toFixed(0)})</>
          )}
        </Button>
      )}

      {/* Billing history */}
      <div>
        <button
          onClick={() => setShowHistory((s) => !s)}
          className="w-full flex items-center justify-between text-xs font-bold text-muted-foreground py-2 hover:text-foreground"
        >
          <span className="flex items-center gap-1">
            <History className="h-3 w-3" /> Histórico de cobranças
          </span>
          {showHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        {showHistory && <BillingHistoryInline storeId={plan.store_id} />}
      </div>
    </div>
  );
}

function BillingHistoryInline({ storeId }: { storeId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["store-billing-history", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("id, reference_code, amount, status, created_at, settled_at, transaction_kind, metadata")
        .eq("store_id", storeId)
        .eq("transaction_kind", "commission_charge")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-3">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <p className="text-[11px] text-muted-foreground py-2 text-center">Nenhuma cobrança registrada.</p>;
  }

  const statusColor = (s: string) =>
    s === "paid" || s === "settled" || s === "confirmed"
      ? "text-emerald-600 bg-emerald-500/10 border-emerald-500/30"
      : s === "pending"
        ? "text-amber-600 bg-amber-500/10 border-amber-500/30"
        : s === "overdue" || s === "failed" || s === "cancelled"
          ? "text-destructive bg-destructive/10 border-destructive/30"
          : "text-muted-foreground bg-muted border-border";

  return (
    <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
      {data.map((row: any) => (
        <div key={row.id} className="flex items-center justify-between bg-background rounded-lg p-2 border border-border/50">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-foreground truncate">{row.reference_code}</p>
            <p className="text-[10px] text-muted-foreground">
              {new Date(row.created_at).toLocaleDateString("pt-BR")}
              {row.settled_at && ` • pago ${new Date(row.settled_at).toLocaleDateString("pt-BR")}`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-foreground">R$ {Number(row.amount).toFixed(2)}</p>
            <Badge className={`border text-[9px] ${statusColor(row.status)}`}>{row.status}</Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

function PlanChangeRequestCard({ request, storeName, onProcessed }: {
  request: any; storeName: string; onProcessed: () => void;
}) {
  const [processing, setProcessing] = useState(false);
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);

  const handleApprove = async () => {
    setProcessing(true);
    try {
      const { error } = await supabase.rpc("approve_plan_change", {
        _request_id: request.id,
        _admin_notes: notes || null,
      });
      if (error) throw error;
      toast.success(`Plano de "${storeName}" alterado com sucesso!`);
      onProcessed();
    } catch (err: any) {
      toast.error(err.message || "Erro ao aprovar.");
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!notes.trim()) {
      toast.error("Informe o motivo da recusa.");
      setShowNotes(true);
      return;
    }
    setProcessing(true);
    try {
      const { error } = await supabase.rpc("reject_plan_change", {
        _request_id: request.id,
        _admin_notes: notes,
      });
      if (error) throw error;
      toast.success(`Solicitação de "${storeName}" recusada.`);
      onProcessed();
    } catch (err: any) {
      toast.error(err.message || "Erro ao recusar.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="bg-card rounded-2xl border-2 border-amber-500/20 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <Store className="h-4 w-4 text-amber-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">{storeName}</p>
            <p className="text-[10px] text-muted-foreground">
              Solicitado em {new Date(request.requested_at).toLocaleDateString("pt-BR")}
            </p>
          </div>
        </div>
        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30 border">
          Pendente
        </Badge>
      </div>

      <div className="flex items-center gap-3 bg-muted/30 rounded-xl p-3">
        <div className="flex-1 text-center">
          <p className="text-[10px] text-muted-foreground uppercase font-semibold">Plano Atual</p>
          <p className="text-sm font-bold text-foreground">{FALLBACK_LABELS[request.current_plan_type as PlanType]}</p>
          <p className="text-xs text-muted-foreground">R$ {Number(request.current_monthly_fee).toFixed(0)}/mês</p>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 text-center">
          <p className="text-[10px] text-muted-foreground uppercase font-semibold">Novo Plano</p>
          <p className="text-sm font-bold text-primary">{FALLBACK_LABELS[request.requested_plan_type as PlanType]}</p>
          <p className="text-xs text-muted-foreground">
            R$ {Number(request.requested_monthly_fee).toFixed(0)}/mês
            {request.requested_commission_rate > 0 && ` + ${request.requested_commission_rate}%`}
          </p>
        </div>
      </div>

      {request.prorata_credit > 0 && (
        <div className="flex items-center justify-between bg-emerald-500/10 rounded-xl px-3 py-2">
          <span className="text-xs text-emerald-600 font-semibold">Crédito prorata</span>
          <span className="text-sm font-bold text-emerald-600">{formatBRL(Number(request.prorata_credit))}</span>
        </div>
      )}

      {showNotes && (
        <Textarea
          placeholder="Observações (obrigatório para recusa)..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
          className="text-sm"
          rows={2}
        />
      )}

      {!showNotes && (
        <button
          onClick={() => setShowNotes(true)}
          className="text-xs text-primary font-semibold"
        >
          + Adicionar observação
        </button>
      )}

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10"
          disabled={processing}
          onClick={handleReject}
        >
          <XCircle className="h-4 w-4 mr-1" />
          Recusar
        </Button>
        <Button
          size="sm"
          className="flex-1"
          disabled={processing}
          onClick={handleApprove}
        >
          {processing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
          Aprovar e Aplicar
        </Button>
      </div>
    </div>
  );
}
