import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Store, Crown, Search, Loader2, Check, X,
  CreditCard, TrendingUp, Zap, Truck, Heart,
  Image, Clock, BarChart3, Ticket, ChevronDown, ChevronUp,
  AlertCircle, CheckCircle2, XCircle, ArrowRight
} from "lucide-react";

type PlanType = "fixed" | "hybrid" | "commission_only";

const planLabels: Record<PlanType, string> = {
  fixed: "Plano Fixo",
  hybrid: "Assinatura + Taxa",
  commission_only: "Comissão",
};

const planColors: Record<PlanType, string> = {
  fixed: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  hybrid: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
  commission_only: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
};

const planDescriptions: Record<PlanType, string> = {
  fixed: "Mensalidade fixa, sem comissão, funcionalidades básicas",
  hybrid: "Mensalidade + taxa por pedido, todas funcionalidades",
  commission_only: "Apenas comissão por pedido, todas funcionalidades",
};

const planDefaults: Record<PlanType, { monthly_fee: number; commission_rate: number }> = {
  fixed: { monthly_fee: 180, commission_rate: 0 },
  hybrid: { monthly_fee: 100, commission_rate: 2.5 },
  commission_only: { monthly_fee: 0, commission_rate: 15 },
};

const featuresByPlan: Record<PlanType, string[]> = {
  fixed: ["Cardápio digital", "Pedidos online", "Dinheiro/Cartão", "Até 3 cupons"],
  hybrid: ["Tudo do Fixo +", "PIX Online", "Entrega plataforma*", "Fidelidade", "Banners", "Relatórios completos", "Cupons ilimitados"],
  commission_only: ["Tudo do Híbrido", "Sem mensalidade"],
};

export default function AdminPlanManager() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [expandedStore, setExpandedStore] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const { data: stores } = useQuery({
    queryKey: ["admin-all-stores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stores").select("*");
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

  const getStorePlan = (storeId: string) => {
    return storePlans?.find(p => p.store_id === storeId);
  };

  const handleSetPlan = async (storeId: string, planType: PlanType, monthlyFee: number, commissionRate: number) => {
    setSaving(storeId);
    try {
      // Delete existing plan (unique constraint on store_id)
      await supabase
        .from("store_plans")
        .delete()
        .eq("store_id", storeId);

      // Create new plan
      const { error } = await supabase
        .from("store_plans")
        .insert({
          store_id: storeId,
          plan_type: planType,
          monthly_fee: monthlyFee,
          commission_rate: commissionRate,
          is_active: true,
          started_at: new Date().toISOString(),
          next_billing_date: monthlyFee > 0
            ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            : null,
        });

      if (error) throw error;

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

  const filteredStores = (stores || []).filter(s =>
    !search.trim() || s.name.toLowerCase().includes(search.toLowerCase())
  );

  // Plan distribution stats
  const planStats = {
    fixed: 0,
    hybrid: 0,
    commission_only: 0,
    no_plan: 0,
  };
  (stores || []).forEach(s => {
    const plan = getStorePlan(s.id);
    if (plan) planStats[plan.plan_type as PlanType]++;
    else planStats.no_plan++;
  });

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
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
        {(["fixed", "hybrid", "commission_only"] as PlanType[]).map(pt => (
          <div key={pt} className="bg-card rounded-2xl p-4 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                pt === "fixed" ? "bg-amber-500/10" : pt === "hybrid" ? "bg-blue-500/10" : "bg-emerald-500/10"
              }`}>
                <Crown className={`h-4 w-4 ${
                  pt === "fixed" ? "text-amber-500" : pt === "hybrid" ? "text-blue-500" : "text-emerald-500"
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
      <div className="grid lg:grid-cols-3 gap-3">
        {(["fixed", "hybrid", "commission_only"] as PlanType[]).map(pt => (
          <div key={pt} className={`bg-card rounded-2xl border-2 p-4 space-y-3 ${
            pt === "fixed" ? "border-amber-500/20" : pt === "hybrid" ? "border-blue-500/20" : "border-emerald-500/20"
          }`}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground text-sm">{planLabels[pt]}</h3>
              <Badge className={`border text-xs ${planColors[pt]}`}>{planLabels[pt]}</Badge>
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
          const currentPlan = (plan?.plan_type as PlanType) || null;

          return (
            <div key={store.id} className="bg-card rounded-2xl border border-border overflow-hidden">
              <button
                onClick={() => setExpandedStore(isExpanded ? null : store.id)}
                className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Store className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-foreground">{store.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {store.address_city || "Itatinga"} • {store.status === "ativo" ? "Ativa" : store.status}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {currentPlan ? (
                    <Badge className={`border text-[10px] ${planColors[currentPlan]}`}>
                      {planLabels[currentPlan]}
                      {plan?.monthly_fee ? ` • R$ ${plan.monthly_fee}/mês` : ""}
                      {plan?.commission_rate ? ` + ${plan.commission_rate}%` : ""}
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
                  {/* Current plan info */}
                  {plan && (
                    <div className="bg-muted/30 rounded-xl p-3 space-y-1">
                      <p className="text-xs text-muted-foreground font-semibold">Plano atual</p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-foreground">{planLabels[currentPlan!]}</span>
                        <span className="text-xs text-muted-foreground">
                          Desde {new Date(plan.started_at).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                      {plan.next_billing_date && (
                        <p className="text-[10px] text-muted-foreground">
                          Próxima cobrança: {new Date(plan.next_billing_date).toLocaleDateString("pt-BR")}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Plan selection buttons */}
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                      {plan ? "Alterar plano" : "Definir plano"}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {(["fixed", "hybrid", "commission_only"] as PlanType[]).map(pt => {
                        const isCurrentPlan = currentPlan === pt;
                        const defaults = planDefaults[pt];
                        return (
                          <button
                            key={pt}
                            onClick={() => {
                              if (isCurrentPlan) return;
                              handleSetPlan(store.id, pt, defaults.monthly_fee, defaults.commission_rate);
                            }}
                            disabled={saving === store.id || isCurrentPlan}
                            className={`p-3 rounded-xl border-2 text-left transition-all ${
                              isCurrentPlan
                                ? "border-primary bg-primary/5 opacity-80"
                                : "border-border hover:border-primary/50 hover:bg-primary/5"
                            } disabled:opacity-50`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-bold text-foreground">{planLabels[pt]}</span>
                              {isCurrentPlan && <Check className="h-3.5 w-3.5 text-primary" />}
                            </div>
                            <p className="text-lg font-black text-foreground">
                              {defaults.monthly_fee > 0 ? `R$ ${defaults.monthly_fee}` : "R$ 0"}
                              <span className="text-[10px] text-muted-foreground font-normal">/mês</span>
                            </p>
                            {defaults.commission_rate > 0 && (
                              <p className="text-[10px] text-muted-foreground">+ {defaults.commission_rate}% por pedido</p>
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
                      planType={currentPlan!}
                      onSave={() => {
                        queryClient.invalidateQueries({ queryKey: ["admin-store-plans"] });
                        queryClient.invalidateQueries({ queryKey: ["admin-all-stores"] });
                      }}
                    />
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

function CustomPlanEditor({ storeId, currentFee, currentRate, planType, onSave }: {
  storeId: string; currentFee: number; currentRate: number; planType: PlanType; onSave: () => void;
}) {
  const [fee, setFee] = useState(currentFee);
  const [rate, setRate] = useState(currentRate);
  const [saving, setSaving] = useState(false);
  const changed = fee !== currentFee || rate !== currentRate;

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("store_plans")
        .update({ monthly_fee: fee, commission_rate: rate } as any)
        .eq("store_id", storeId)
        .eq("is_active", true);
      if (error) throw error;

      await supabase
        .from("stores")
        .update({ commission_rate: rate } as any)
        .eq("id", storeId);

      toast.success("Valores personalizados salvos!");
      onSave();
    } catch {
      toast.error("Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-muted/30 rounded-xl p-3 space-y-2">
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Valores personalizados</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-muted-foreground font-semibold">Mensalidade (R$)</label>
          <input
            type="number"
            min="0"
            step="10"
            value={fee}
            onChange={e => setFee(Number(e.target.value))}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground mt-1"
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground font-semibold">Taxa comissão (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={rate}
            onChange={e => setRate(Number(e.target.value))}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground mt-1"
          />
        </div>
      </div>
      {changed && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Salvar Valores"}
        </button>
      )}
    </div>
  );
}
