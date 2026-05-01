import { formatBRL } from "@/lib/utils";
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
  AlertCircle, CheckCircle2, XCircle, ArrowRight,
  Calendar, Pause, Play, Receipt, Send, History, Settings2
} from "lucide-react";

type PlanType = "fixed" | "hybrid" | "commission_only";
type DisplayPlan = PlanType | "supporter";

const SUPPORTER_FEE = 130;
const SUPPORTER_LIMIT = 10;

 const planLabels: Record<DisplayPlan, string> = {
   supporter: "Apoiadores",
   fixed: "Essencial",
   hybrid: "Crescimento",
   commission_only: "Comissão",
 };

const planColors: Record<DisplayPlan, string> = {
  supporter: "bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-500/30",
  fixed: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  hybrid: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
  commission_only: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
};

const planDescriptions: Record<DisplayPlan, string> = {
  supporter: "R$ 130/mês vitalício • Apenas 10 vagas • Todas as funcionalidades",
  fixed: "Mensalidade fixa, sem comissão, funcionalidades básicas",
  hybrid: "Mensalidade + taxa por pedido, todas funcionalidades",
  commission_only: "Apenas comissão por pedido, todas funcionalidades",
};

const planDefaults: Record<DisplayPlan, { monthly_fee: number; commission_rate: number }> = {
  supporter: { monthly_fee: SUPPORTER_FEE, commission_rate: 0 },
  fixed: { monthly_fee: 180, commission_rate: 0 },
  hybrid: { monthly_fee: 100, commission_rate: 2.5 },
  commission_only: { monthly_fee: 0, commission_rate: 5 },
};

const featuresByPlan: Record<DisplayPlan, string[]> = {
  supporter: ["Preço vitalício R$130", "Sem comissão", "Tudo incluso", "PIX, Fidelidade, Banners", "Apenas 10 vagas"],
  fixed: ["Cardápio digital", "Pedidos online", "Dinheiro/Cartão", "Até 3 cupons"],
  hybrid: ["Tudo do Fixo +", "PIX Online", "Entrega plataforma*", "Fidelidade", "Banners", "Relatórios completos", "Cupons ilimitados"],
  commission_only: ["Tudo do Híbrido", "Sem mensalidade"],
};

function resolveDisplayPlan(plan: { plan_type: string; monthly_fee: number } | null | undefined): DisplayPlan | null {
  if (!plan) return null;
  if (plan.plan_type === "fixed" && Number(plan.monthly_fee) === SUPPORTER_FEE) return "supporter";
  return plan.plan_type as PlanType;
}

export default function AdminPlanManager() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [expandedStore, setExpandedStore] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

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
  const planStats: Record<DisplayPlan | "no_plan", number> = {
    supporter: 0,
    fixed: 0,
    hybrid: 0,
    commission_only: 0,
    no_plan: 0,
  };
  (stores || []).forEach(s => {
    const plan = getStorePlan(s.id);
    const display = resolveDisplayPlan(plan);
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
      <div className="grid lg:grid-cols-4 gap-3">
        {(["supporter", "fixed", "hybrid", "commission_only"] as DisplayPlan[]).map(pt => (
          <div key={pt} className={`bg-card rounded-2xl border-2 p-4 space-y-3 ${
            pt === "supporter" ? "border-pink-500/30" :
            pt === "fixed" ? "border-amber-500/20" :
            pt === "hybrid" ? "border-blue-500/20" : "border-emerald-500/20"
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
          const currentDisplay = resolveDisplayPlan(plan);

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
                  {plan && currentDisplay && (
                    <div className="bg-muted/30 rounded-xl p-3 space-y-1">
                      <p className="text-xs text-muted-foreground font-semibold">Plano atual</p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-foreground">{planLabels[currentDisplay]}</span>
                        <span className="text-xs text-muted-foreground">
                          Desde {new Date(plan.started_at).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                      {plan.next_billing_date && (
                        <p className="text-[10px] text-muted-foreground">
                          Próxima cobrança: {new Date(plan.next_billing_date).toLocaleDateString("pt-BR")}
                        </p>
                      )}
                      {currentDisplay === "supporter" && (
                        <p className="text-[10px] text-pink-600 font-semibold">
                          ⭐ Plano vitalício • Preço travado em R$ {SUPPORTER_FEE}
                        </p>
                      )}
                    </div>
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
                      planType={(plan.plan_type as PlanType)}
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

function CustomPlanEditor({ storeId, currentFee, currentRate, currentPixOverride, currentDeliveryOverride, planType, onSave }: {
  storeId: string;
  currentFee: number;
  currentRate: number;
  currentPixOverride: number | null | undefined;
  currentDeliveryOverride: number | null | undefined;
  planType: PlanType;
  onSave: () => void;
}) {
  const [fee, setFee] = useState(currentFee);
  const [rate, setRate] = useState(currentRate);
  const [pixOverrideEnabled, setPixOverrideEnabled] = useState(currentPixOverride !== null && currentPixOverride !== undefined);
  const [pixOverride, setPixOverride] = useState(currentPixOverride ?? 1);
  const [deliveryOverrideEnabled, setDeliveryOverrideEnabled] = useState(currentDeliveryOverride !== null && currentDeliveryOverride !== undefined);
  const [deliveryOverride, setDeliveryOverride] = useState(currentDeliveryOverride ?? 2);
  const [saving, setSaving] = useState(false);

  const finalPixOverride = pixOverrideEnabled ? pixOverride : null;
  const finalDeliveryOverride = deliveryOverrideEnabled ? deliveryOverride : null;
  const changed =
    fee !== currentFee ||
    rate !== currentRate ||
    finalPixOverride !== (currentPixOverride ?? null) ||
    finalDeliveryOverride !== (currentDeliveryOverride ?? null);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("store_plans")
        .update({
          monthly_fee: fee,
          commission_rate: rate,
          pix_operational_fee_override: finalPixOverride,
          platform_delivery_split_override: finalDeliveryOverride,
        } as any)
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
    <div className="bg-muted/30 rounded-xl p-3 space-y-3">
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">⚙️ Valores Personalizados (VIP)</p>

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

      {/* PIX Override */}
      <div className="border-t border-border pt-3 space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={pixOverrideEnabled}
            onChange={e => setPixOverrideEnabled(e.target.checked)}
            className="rounded"
          />
          <span className="text-xs font-bold text-foreground">Customizar taxa PIX desta loja</span>
        </label>
        {pixOverrideEnabled && (
          <div>
            <label className="text-[10px] text-muted-foreground font-semibold">Taxa PIX por transação (R$)</label>
            <input
              type="number"
              min="0"
              step="0.10"
              value={pixOverride}
              onChange={e => setPixOverride(Number(e.target.value))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground mt-1"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Use 0 para isentar a loja da taxa PIX.</p>
          </div>
        )}
      </div>

      {/* Delivery Split Override */}
      <div className="border-t border-border pt-3 space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={deliveryOverrideEnabled}
            onChange={e => setDeliveryOverrideEnabled(e.target.checked)}
            className="rounded"
          />
          <span className="text-xs font-bold text-foreground">Customizar split de entrega da plataforma</span>
        </label>
        {deliveryOverrideEnabled && (
          <div>
            <label className="text-[10px] text-muted-foreground font-semibold">Plataforma por corrida (R$)</label>
            <input
              type="number"
              min="0"
              step="0.50"
              value={deliveryOverride}
              onChange={e => setDeliveryOverride(Number(e.target.value))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground mt-1"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Use 0 para remover a taxa de R$2 da plataforma por entrega.</p>
          </div>
        )}
      </div>

      {changed && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Salvar Valores Personalizados"}
        </button>
      )}
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
          <p className="text-sm font-bold text-foreground">{planLabels[request.current_plan_type as PlanType]}</p>
          <p className="text-xs text-muted-foreground">R$ {Number(request.current_monthly_fee).toFixed(0)}/mês</p>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 text-center">
          <p className="text-[10px] text-muted-foreground uppercase font-semibold">Novo Plano</p>
          <p className="text-sm font-bold text-primary">{planLabels[request.requested_plan_type as PlanType]}</p>
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
