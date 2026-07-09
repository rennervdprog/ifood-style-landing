import { useState } from "react";
import { Store, Trash2, CheckCircle2, Clock, XCircle, Filter, Wallet, Loader2, Percent, DollarSign, ChevronDown, ChevronUp, Smartphone } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type StoreFilter = "all" | "pending" | "active" | "blocked" | "pdv_only";
type PlanType = "commission_only" | "fixed" | "hybrid" | "pdv_only";

const planLabels: Record<PlanType, string> = {
  commission_only: "Só Comissão",
  fixed: "Fixo Mensal",
  hybrid: "Híbrido",
  pdv_only: "Somente PDV",
};

const planColors: Record<PlanType, string> = {
  commission_only: "bg-amber-500/20 text-amber-600",
  fixed: "bg-blue-500/20 text-blue-600",
  hybrid: "bg-purple-500/20 text-purple-600",
  pdv_only: "bg-emerald-500/20 text-emerald-600",
};

const AdminStoreManager = () => {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<StoreFilter>("all");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [creatingWallet, setCreatingWallet] = useState<string | null>(null);
  const [bulkCreating, setBulkCreating] = useState(false);
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState<{ plan_type: PlanType; monthly_fee: number; commission_rate: number }>({
    plan_type: "commission_only", monthly_fee: 0, commission_rate: 6,
  });
  const [savingPlan, setSavingPlan] = useState(false);
  const [togglingApp, setTogglingApp] = useState<string | null>(null);

  const { data: stores, isLoading } = useQuery({
    queryKey: ["admin-stores-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, status, image_url, category, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: storePlans } = useQuery({
    queryKey: ["admin-store-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_plans")
        .select("id, store_id, plan_type, monthly_fee, commission_rate, next_billing_date");
      if (error) throw error;
      return data || [];
    },
  });

  const getStorePlan = (storeId: string) => {
    return (storePlans as any[])?.find((p: any) => p.store_id === storeId);
  };

  const handleEditPlan = (storeId: string) => {
    const existing = getStorePlan(storeId);
    if (existing) {
      setPlanForm({
        plan_type: existing.plan_type as PlanType,
        monthly_fee: Number(existing.monthly_fee),
        commission_rate: Number(existing.commission_rate),
      });
    } else {
      setPlanForm({ plan_type: "commission_only", monthly_fee: 0, commission_rate: 6 });
    }
    setEditingPlan(storeId);
  };

  const handleSavePlan = async () => {
    if (!editingPlan) return;
    setSavingPlan(true);
    try {
      const existing = getStorePlan(editingPlan);
      const now = new Date();
      const nextBilling = planForm.monthly_fee > 0
        ? new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()
        : null;

      if (existing) {
        const { error } = await supabase
          .from("store_plans")
          .update({
            plan_type: planForm.plan_type as any,
            monthly_fee: planForm.monthly_fee,
            commission_rate: planForm.commission_rate,
            next_billing_date: nextBilling,
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("store_plans")
          .insert({
            store_id: editingPlan,
            plan_type: planForm.plan_type as any,
            monthly_fee: planForm.monthly_fee,
            commission_rate: planForm.commission_rate,
            next_billing_date: nextBilling,
          } as any);
        if (error) throw error;
      }

      // Sync commission_rate to stores table
      await supabase
        .from("stores")
        .update({ commission_rate: planForm.commission_rate })
        .eq("id", editingPlan);

      await supabase.rpc("log_admin_action", {
        _action: "change_plan",
        _target_type: "store",
        _target_id: editingPlan,
        _details: {
          old: existing ? { plan_type: existing.plan_type, monthly_fee: existing.monthly_fee, commission_rate: existing.commission_rate } : null,
          new: planForm
        }
      });
      toast.success("Plano atualizado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["admin-store-plans"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stores-list"] });
      setEditingPlan(null);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar plano.");
    } finally {
      setSavingPlan(false);
    }
  };

  const handleToggleApp = async (storeId: string, currentEnabled: boolean) => {
    setTogglingApp(storeId);
    try {
      const { error } = await supabase
        .from("stores")
        .update({ app_enabled: !currentEnabled, ...(!currentEnabled ? {} : { app_subscribed: false }) })
        .eq("id", storeId);
      if (error) throw error;
      toast.success(!currentEnabled ? "App liberado para esta loja!" : "App desativado para esta loja.");
      queryClient.invalidateQueries({ queryKey: ["admin-stores-list"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao alterar app.");
    } finally {
      setTogglingApp(null);
    }
  };

  const handlePlanTypeChange = (type: PlanType) => {
    switch (type) {
      case "commission_only":
        setPlanForm({ plan_type: type, monthly_fee: 0, commission_rate: 6 });
        break;
      case "fixed":
        setPlanForm({ plan_type: type, monthly_fee: 90, commission_rate: 0 });
        break;
      case "hybrid":
        setPlanForm({ plan_type: type, monthly_fee: 100, commission_rate: 2.5 });
        break;
    }
  };

  const filtered = stores?.filter((s) => {
    if (filter === "pending") return s.status === "analise";
    if (filter === "active") return s.status === "ativo";
    if (filter === "blocked") return s.status === "bloqueado";
    if (filter === "pdv_only") {
      const p = getStorePlan(s.id);
      return p?.plan_type === "pdv_only";
    }
    return true;
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.rpc("admin_delete_store", {
        _store_id: deleteTarget.id,
      } as any);
      if (error) throw error;
      toast.success("Loja removida do ItaSuper com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["admin-stores-list"] });
      queryClient.invalidateQueries({ queryKey: ["admin-all-stores"] });
      queryClient.invalidateQueries({ queryKey: ["stores"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir loja.");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "ativo":
        return (
          <span className="px-2 py-0.5 bg-green-500/20 text-green-600 text-xs font-bold rounded-full flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Ativa
          </span>
        );
      case "analise":
        return (
          <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-600 text-xs font-bold rounded-full flex items-center gap-1">
            <Clock className="h-3 w-3" /> Pendente
          </span>
        );
      case "bloqueado":
        return (
          <span className="px-2 py-0.5 bg-red-500/20 text-red-600 text-xs font-bold rounded-full flex items-center gap-1">
            <XCircle className="h-3 w-3" /> Bloqueada
          </span>
        );
      default:
        return null;
    }
  };

  const counts = {
    all: stores?.length || 0,
    pending: stores?.filter((s) => s.status === "analise").length || 0,
    active: stores?.filter((s) => s.status === "ativo").length || 0,
    blocked: stores?.filter((s) => s.status === "bloqueado").length || 0,
    pdv_only: (storePlans as any[])?.filter((p: any) => p.plan_type === "pdv_only").length || 0,
  };

  // Subaccount system removed — split is now automatic via webhook transfers

  const filters: { key: StoreFilter; label: string }[] = [
    { key: "all", label: `Todas (${counts.all})` },
    { key: "pending", label: `Pendentes (${counts.pending})` },
    { key: "active", label: `Aprovadas (${counts.active})` },
    { key: "blocked", label: `Bloqueadas (${counts.blocked})` },
    { key: "pdv_only", label: `Somente PDV (${counts.pdv_only})` },
  ];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
              filter === f.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>


      {/* Store list */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered && filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map((store) => {
            const plan = getStorePlan(store.id);
            const planType = (plan?.plan_type || "commission_only") as PlanType;

            return (
              <div key={store.id} className="bg-card rounded-xl border border-border overflow-hidden">
                {/* Store info row */}
                <div className="p-4 pb-2">
                  <div className="flex items-center gap-3">
                    {store.image_url ? (
                      <img loading="lazy" decoding="async" src={store.image_url} alt={store.name} className="w-11 h-11 rounded-xl object-cover shrink-0" />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center shrink-0">
                        <Store className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-foreground truncate">{store.name}</p>
                        {statusBadge(store.status)}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="text-[11px] text-muted-foreground capitalize">{store.category}</span>
                        <span className="text-muted-foreground/30">•</span>
                        <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${planColors[planType]}`}>
                          {planLabels[planType]}
                        </span>
                        {(store as any).app_enabled && (
                          <>
                            <span className="text-muted-foreground/30">•</span>
                            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-primary/20 text-primary flex items-center gap-0.5">
                              <Smartphone className="h-2.5 w-2.5" /> App
                            </span>
                          </>
                        )}
                      </div>
                      {plan && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {Number(plan.monthly_fee) > 0 && `R$${Number(plan.monthly_fee)}/mês`}
                          {Number(plan.monthly_fee) > 0 && Number(plan.commission_rate) > 0 && " + "}
                          {Number(plan.commission_rate) > 0 && `${plan.commission_rate}% por pedido`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action buttons row */}
                <div className="px-4 pb-3 pt-1 flex items-center gap-2">
                  <button
                    onClick={() => handleToggleApp(store.id, !!(store as any).app_enabled)}
                    disabled={togglingApp === store.id}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all active:scale-[0.97] ${
                      (store as any).app_enabled
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    }`}
                  >
                    {togglingApp === store.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Smartphone className="h-3.5 w-3.5" />}
                    {(store as any).app_enabled ? "App ✓" : "Liberar App"}
                  </button>
                  <button
                    onClick={() => editingPlan === store.id ? setEditingPlan(null) : handleEditPlan(store.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all active:scale-[0.97] ${
                      editingPlan === store.id
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    }`}
                  >
                    {editingPlan === store.id ? <ChevronUp className="h-3.5 w-3.5" /> : <Percent className="h-3.5 w-3.5" />}
                    Plano
                  </button>
                  <button
                    onClick={() => setDeleteTarget({ id: store.id, name: store.name })}
                    className="py-2 px-3 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 active:scale-[0.97] transition-all flex items-center justify-center"
                    title="Excluir loja"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Expandable plan editor */}
                {editingPlan === store.id && (
                  <div className="border-t border-border bg-muted/30 p-4 space-y-3">
                    <p className="text-xs font-bold text-foreground">Plano de {store.name}</p>

                    {/* Plan type selector */}
                    <div className="grid grid-cols-2 gap-2">
                      {(["commission_only", "fixed", "hybrid", "pdv_only"] as PlanType[]).map((type) => (
                        <button
                          key={type}
                          onClick={() => handlePlanTypeChange(type)}
                          className={`px-2 py-2 rounded-lg text-xs font-bold transition-all ${
                            planForm.plan_type === type
                              ? "bg-primary text-primary-foreground ring-2 ring-primary"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          {planLabels[type]}
                        </button>
                      ))}
                    </div>

                    {planForm.plan_type === "pdv_only" && (
                      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-[11px] text-emerald-700 dark:text-emerald-400 space-y-2">
                        <p>
                          Loja <strong>Somente PDV</strong>: sem vitrine pública, sem delivery, sem comissão.
                          Cobrança do módulo PDV (R$ 49/mês) é feita por fora via add-on.
                        </p>
                        <button
                          type="button"
                          onClick={() => handlePlanTypeChange("commission_only")}
                          className="w-full py-1.5 rounded-md bg-emerald-600 text-white text-[11px] font-bold"
                        >
                          Migrar para Só Comissão (habilitar delivery)
                        </button>
                      </div>
                    )}

                    {/* Monthly fee */}
                    {(planForm.plan_type === "fixed" || planForm.plan_type === "hybrid") && (
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Mensalidade (R$)</label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <input
                            type="number"
                            value={planForm.monthly_fee}
                            onChange={(e) => setPlanForm(p => ({ ...p, monthly_fee: Number(e.target.value) }))}
                            className="w-full pl-9 pr-3 py-2 rounded-lg bg-background border border-border text-sm"
                            min={0}
                            step={10}
                          />
                        </div>
                      </div>
                    )}

                    {/* Commission rate */}
                    {(planForm.plan_type === "commission_only" || planForm.plan_type === "hybrid") && (
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Taxa por pedido (%)</label>
                        <div className="relative">
                          <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <input
                            type="number"
                            value={planForm.commission_rate}
                            onChange={(e) => setPlanForm(p => ({ ...p, commission_rate: Number(e.target.value) }))}
                            className="w-full pl-9 pr-3 py-2 rounded-lg bg-background border border-border text-sm"
                            min={0}
                            max={100}
                            step={0.5}
                          />
                        </div>
                      </div>
                    )}

                    {/* Summary */}
                    <div className="bg-background rounded-lg p-3 text-xs text-muted-foreground">
                      {planForm.plan_type === "fixed" && (
                        <p>💰 Cobrança de <strong className="text-foreground">R${planForm.monthly_fee}/mês</strong> sem taxa por pedido.</p>
                      )}
                      {planForm.plan_type === "hybrid" && (
                        <p>💰 Cobrança de <strong className="text-foreground">R${planForm.monthly_fee}/mês</strong> + <strong className="text-foreground">{planForm.commission_rate}%</strong> por pedido entregue.</p>
                      )}
                      {planForm.plan_type === "commission_only" && (
                        <p>💰 Cobrança de <strong className="text-foreground">{planForm.commission_rate}%</strong> por pedido entregue. Sem mensalidade.</p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingPlan(null)}
                        className="flex-1 py-2 rounded-lg bg-muted text-muted-foreground text-sm font-bold"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleSavePlan}
                        disabled={savingPlan}
                        className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50"
                      >
                        {savingPlan ? "Salvando..." : "Salvar Plano"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-8">
          Nenhuma loja encontrada com este filtro.
        </p>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-card border-border max-w-sm mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Excluir Loja
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tem certeza que deseja excluir <strong className="text-foreground">{deleteTarget?.name}</strong>?
              Esta ação é irreversível e removerá todos os produtos, cardápio e horários vinculados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="bg-muted text-foreground border-border hover:bg-muted/80">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold"
            >
              {deleting ? "Excluindo..." : "Excluir Definitivamente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminStoreManager;
