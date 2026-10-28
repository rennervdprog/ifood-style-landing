/**
 * MatrizDashboardV2 — Painel da matriz refeito (Fase 2, plano 28/10/2026).
 *
 * NÃO é o painel em produção (/matriz → MatrizDashboard): esta é a versão
 * nova, na rota /matriz-v2, construída sobre as funções reescritas da
 * Fase 2. O painel antigo continua intacto até a publicação.
 *
 * O que muda em relação ao antigo:
 *  - A matriz é só a página-guia do grupo (decisão 2): ela NÃO vende e
 *    NÃO entra na lista nem na contagem de sublojas.
 *  - A subloja nasce RASCUNHO invisível (C9/M8) com checklist (endereço,
 *    horário, cardápio, entregador) — só entra na vitrine quando o dono
 *    publica com o checklist completo.
 *  - Criação com endereço completo (rua, número, bairro, cidade, CEP) +
 *    taxa de entrega — o formulário antigo nem pedia rua/número/bairro.
 *  - Gerente por CONVITE (7 dias): o dono convida por e-mail e mostra o
 *    link de aceite; desvincular existe (antes não havia como desfazer).
 *  - Pausar a rede pausa as sublojas junto (decisão 9), com confirmação.
 *  - Financeiro mostra o repasse por subloja (só leitura — cada subloja
 *    paga o seu, decisão 7) e a mensalidade efetiva da rede (decisão 1+2).
 *  - Sem cópia de cardápio na criação: herança de cardápio é Fase 3.
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatBRL } from "@/lib/utils";
import SignOutConfirm from "@/components/SignOutConfirm";
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
import {
  Store, Plus, LogOut, Building2, TrendingUp, DollarSign,
  ShoppingBag, MapPin, ChevronRight, Loader2, Users, X,
  AlertCircle, CheckCircle2, Pause, Play, UserPlus, UserX,
  ExternalLink, Copy, Link as LinkIcon, Clock,
} from "lucide-react";
import {
  CHECKLIST_LABELS,
  CHECKLIST_KEYS,
  checklistDoneCount,
  checklistMissingLabels,
  resolveUnitDisplayStatus,
  UNIT_STATUS_LABELS,
  canPublishUnit,
  onlySublojas,
  findMatrizStore,
  slugifyUnitName,
  validateCreateUnitForm,
  parseMoneyField,
  buildInviteLink,
  type UnitChecklist,
  type CreateUnitForm,
} from "@/lib/networkUnits";
import { calcNetworkMonthlyFee } from "@/lib/networkLinkRules";

interface Network {
  id: string;
  name: string;
  logo_url: string | null;
  plan_type: string;
  monthly_fee: number;
  max_units: number;
  is_approved: boolean;
  is_paused?: boolean | null;
  matriz_store_id?: string | null;
}

interface Unit {
  id: string;
  name: string;
  slug: string;
  category: string;
  status: string;
  address_city: string | null;
  address_neighborhood: string | null;
  image_url: string | null;
  is_draft?: boolean | null;
  force_closed?: boolean | null;
  delivery_fee?: number | null;
}

interface ManagerRow {
  store_id: string;
  user_id: string;
  email: string | null;
}

interface InviteRow {
  id: string;
  store_id: string;
  email: string;
  code: string;
  expires_at: string;
  status: string;
}

const CATEGORY_OPTIONS = [
  { value: "restaurante", label: "Restaurante" },
  { value: "lanches", label: "Lanches" },
  { value: "pizzas", label: "Pizzaria" },
  { value: "saudavel", label: "Saudável" },
  { value: "cafeteria", label: "Cafeteria" },
  { value: "japonesa", label: "Japonesa" },
  { value: "churrasco", label: "Churrasco" },
  { value: "sobremesas", label: "Sobremesas" },
  { value: "farmacias", label: "Farmácia" },
  { value: "adegas", label: "Adega" },
];

const MatrizDashboardV2 = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [inviteUnit, setInviteUnit] = useState<Unit | null>(null);
  const [unlinkUnit, setUnlinkUnit] = useState<{ unit: Unit; managerEmail: string | null } | null>(null);
  const [publishUnit, setPublishUnit] = useState<Unit | null>(null);
  const [pauseConfirmOpen, setPauseConfirmOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"unidades" | "financeiro" | "relatorios">("unidades");

  // Buscar rede da matriz
  const { data: network, isLoading: loadingNetwork } = useQuery({
    queryKey: ["matriz-v2-network", user?.id],
    queryFn: async (): Promise<Network | null> => {
      const { data } = await (supabase as any)
        .from("store_networks" as any)
        .select("*")
        .eq("owner_id", user!.id)
        .maybeSingle();
      return data as any;
    },
    enabled: !!user?.id,
  });

  // Buscar lojas da rede (matriz-guia + sublojas)
  const { data: networkStores = [] } = useQuery({
    queryKey: ["matriz-v2-stores", network?.id],
    queryFn: async (): Promise<Unit[]> => {
      const { data } = await (supabase as any)
        .from("stores")
        .select("id, name, slug, category, status, address_city, address_neighborhood, image_url, is_draft, force_closed, delivery_fee, is_matriz")
        .eq("network_id", network!.id)
        .order("created_at", { ascending: true });
      return (data as any) || [];
    },
    enabled: !!network?.id,
  });

  const sublojas = onlySublojas(networkStores as any) as Unit[];
  const matrizStore = findMatrizStore(networkStores as any) as Unit | undefined;
  const sublojaIds = sublojas.map((u) => u.id);

  // Gerentes ativos das sublojas
  const { data: managers = [] } = useQuery({
    queryKey: ["matriz-v2-managers", network?.id, sublojaIds.join(",")],
    queryFn: async (): Promise<ManagerRow[]> => {
      if (sublojaIds.length === 0) return [];
      const { data: links } = await (supabase as any)
        .from("store_managers")
        .select("store_id, user_id")
        .in("store_id", sublojaIds)
        .eq("is_active", true);
      const rows = (links as any) || [];
      if (rows.length === 0) return [];
      const userIds = rows.map((r: any) => r.user_id);
      const { data: profs } = await (supabase as any)
        .from("profiles")
        .select("user_id, email")
        .in("user_id", userIds);
      const emailById = new Map(((profs as any) || []).map((p: any) => [p.user_id, p.email]));
      return rows.map((r: any) => ({ store_id: r.store_id, user_id: r.user_id, email: emailById.get(r.user_id) ?? null }));
    },
    enabled: !!network?.id,
  });
  const managerByStore = new Map(managers.map((m) => [m.store_id, m]));

  // Convites pendentes das sublojas
  const { data: invites = [] } = useQuery({
    queryKey: ["matriz-v2-invites", network?.id, sublojaIds.join(",")],
    queryFn: async (): Promise<InviteRow[]> => {
      if (sublojaIds.length === 0) return [];
      const { data } = await (supabase as any)
        .from("network_invites")
        .select("id, store_id, email, code, expires_at, status")
        .in("store_id", sublojaIds)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      return (data as any) || [];
    },
    enabled: !!network?.id,
  });
  const inviteByStore = new Map<string, InviteRow>();
  for (const inv of invites) {
    if (!inviteByStore.has(inv.store_id)) inviteByStore.set(inv.store_id, inv);
  }

  // Checklist de cada subloja (fonte da verdade: função do banco)
  const { data: checklists = new Map<string, UnitChecklist>() } = useQuery({
    queryKey: ["matriz-v2-checklists", sublojaIds.join(",")],
    queryFn: async (): Promise<Map<string, UnitChecklist>> => {
      const entries = await Promise.all(
        sublojaIds.map(async (storeId) => {
          const { data, error } = await (supabase as any).rpc("network_unit_checklist", { _store_id: storeId });
          if (error) throw error;
          return [storeId, data as UnitChecklist] as const;
        }),
      );
      return new Map(entries);
    },
    enabled: sublojaIds.length > 0,
  });

  // Financeiro consolidado da rede (mês atual + GMV 60d p/ gratuidade)
  const { data: financials } = useQuery({
    queryKey: ["matriz-v2-financials", network?.id, sublojaIds.join(",")],
    queryFn: async () => {
      if (!network?.id) return null;
      if (sublojaIds.length === 0) return { totalRevenue: 0, totalOrders: 0, pendingPayout: 0, gmv60d: 0, repasseByStore: [] as { store_id: string; repasse: number }[] };
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      const gmvStart = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();
      const [ordersRes, gmvRes, balancesRes] = await Promise.all([
        supabase.from("orders")
          .select("total_price")
          .in("store_id", sublojaIds)
          .eq("status", "finalizado")
          .gte("created_at", monthStart),
        supabase.from("orders")
          .select("subtotal")
          .in("store_id", sublojaIds)
          .in("status", ["finalizado", "entregue"])
          .gte("created_at", gmvStart),
        supabase.from("store_balances")
          .select("store_id, repasse_pendente, comissao_pendente")
          .in("store_id", sublojaIds),
      ]);
      const totalRevenue = (ordersRes.data || []).reduce((s, o: any) => s + Number(o.total_price || 0), 0);
      const totalOrders = (ordersRes.data || []).length;
      const gmv60d = (gmvRes.data || []).reduce((s, o: any) => s + Number(o.subtotal || 0), 0);
      const repasseByStore = (balancesRes.data || []).map((b: any) => ({
        store_id: b.store_id,
        repasse: Number(b.repasse_pendente || 0) + Number(b.comissao_pendente || 0),
      }));
      const pendingPayout = repasseByStore.reduce((s, r) => s + r.repasse, 0);
      return { totalRevenue, totalOrders, pendingPayout, gmv60d, repasseByStore };
    },
    enabled: !!network?.id,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["matriz-v2-stores"] });
    queryClient.invalidateQueries({ queryKey: ["matriz-v2-managers"] });
    queryClient.invalidateQueries({ queryKey: ["matriz-v2-invites"] });
    queryClient.invalidateQueries({ queryKey: ["matriz-v2-checklists"] });
    queryClient.invalidateQueries({ queryKey: ["matriz-v2-financials"] });
  };

  const publishMutation = useMutation({
    mutationFn: async (storeId: string) => {
      const { error } = await (supabase as any).rpc("publish_network_unit", { _store_id: storeId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Subloja publicada! Ela já aparece na vitrine.");
      invalidateAll();
      setPublishUnit(null);
    },
    onError: (err: any) => toast.error(err.message || "Erro ao publicar unidade."),
  });

  const unlinkMutation = useMutation({
    mutationFn: async (storeId: string) => {
      const { error } = await (supabase as any).rpc("unlink_unit_user", { _store_id: storeId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Gerente desvinculado.");
      invalidateAll();
      setUnlinkUnit(null);
    },
    onError: (err: any) => toast.error(err.message || "Erro ao desvincular gerente."),
  });

  const pauseMutation = useMutation({
    mutationFn: async (paused: boolean) => {
      const { error } = await (supabase as any).rpc("set_network_paused", { _network_id: network!.id, _paused: paused });
      if (error) throw error;
      return paused;
    },
    onSuccess: (paused) => {
      toast.success(paused ? "Rede pausada — as sublojas pausaram junto." : "Rede reativada — as sublojas voltaram.");
      queryClient.invalidateQueries({ queryKey: ["matriz-v2-network"] });
      invalidateAll();
      setPauseConfirmOpen(false);
    },
    onError: (err: any) => toast.error(err.message || "Erro ao pausar rede."),
  });

  if (loadingNetwork) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!network) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
        <div className="text-center max-w-sm">
          <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-black mb-2">Você não é matriz</h2>
          <p className="text-sm text-muted-foreground mb-4">Esta conta não está configurada como rede matriz.</p>
          <button onClick={() => navigate("/admin")} className="bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm font-bold">
            Ir para painel normal
          </button>
        </div>
      </div>
    );
  }

  const deliveryUnitCount = sublojas.length;
  const effectiveFee = calcNetworkMonthlyFee({
    baseMonthlyFee: Number(network.monthly_fee || 0),
    deliveryUnitCount,
    gmv60d: financials?.gmv60d || 0,
  });
  const onGratuity = (financials?.gmv60d || 0) <= 5000;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-card border-b border-border sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {network.logo_url ? (
              <img src={network.logo_url} alt={network.name} loading="lazy" decoding="async" className="w-10 h-10 rounded-xl object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-black truncate">{network.name}</p>
              <p className="text-[11px] text-muted-foreground">Painel Matriz · {sublojas.length} subloja(s)</p>
            </div>
          </div>
          <SignOutConfirm redirectTo="/portal-parceiro">
            <button className="p-2 text-muted-foreground hover:text-foreground">
              <LogOut className="h-4 w-4" />
            </button>
          </SignOutConfirm>
        </div>

        {!network.is_approved && (
          <div className="px-4 py-2 bg-amber-500/10 border-t border-amber-500/20 flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <p className="text-[11px] text-amber-700 dark:text-amber-400">Aguardando aprovação.</p>
          </div>
        )}
        {network.is_paused && (
          <div className="px-4 py-2 bg-amber-500/10 border-t border-amber-500/20 flex items-center gap-2">
            <Pause className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <p className="text-[11px] text-amber-700 dark:text-amber-400">Rede pausada — as sublojas estão fechadas para pedidos.</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-t border-border">
          {[
            { id: "unidades", label: "Sublojas", icon: Store },
            { id: "financeiro", label: "Financeiro", icon: DollarSign },
            { id: "relatorios", label: "Relatórios", icon: TrendingUp },
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-xs font-bold border-b-2 transition-colors ${
                  active ? "text-primary border-primary" : "text-muted-foreground border-transparent"
                }`}>
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="p-4">
        {activeTab === "unidades" && (
          <div className="space-y-3">
            {/* Página do grupo (matriz-guia): só apresenta, não vende */}
            {matrizStore && (
              <div className="bg-card border border-border rounded-2xl p-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{matrizStore.name}</p>
                    <p className="text-[11px] text-muted-foreground">Página do grupo — esta loja não vende, só apresenta a rede.</p>
                  </div>
                  <button
                    onClick={() => navigate(`/${matrizStore.slug}`)}
                    className="p-2 text-muted-foreground hover:text-primary"
                    title="Ver página do grupo"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setShowCreateModal(true)}
                disabled={sublojas.length >= network.max_units}
                className="flex-1 bg-primary text-primary-foreground rounded-xl p-3.5 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform"
              >
                <Plus className="h-4 w-4" /> Nova subloja ({sublojas.length}/{network.max_units})
              </button>
              <button
                onClick={() => setPauseConfirmOpen(true)}
                disabled={pauseMutation.isPending}
                className="bg-card border border-border rounded-xl px-3.5 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {network.is_paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                {network.is_paused ? "Reativar" : "Pausar rede"}
              </button>
            </div>

            {sublojas.length === 0 ? (
              <div className="text-center py-12">
                <Store className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm font-bold text-muted-foreground">Nenhuma subloja criada</p>
                <p className="text-xs text-muted-foreground mt-1">Crie a primeira subloja da sua rede — ela nasce como rascunho</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sublojas.map(unit => {
                  const checklist = checklists.get(unit.id);
                  const done = checklist ? checklistDoneCount(checklist) : 0;
                  const status = resolveUnitDisplayStatus(unit);
                  const manager = managerByStore.get(unit.id);
                  const invite = inviteByStore.get(unit.id);
                  const canPublish = checklist ? canPublishUnit(unit, checklist) : false;
                  return (
                    <div key={unit.id} className="bg-card border border-border rounded-2xl p-3.5">
                      <div className="flex items-center gap-3">
                        {unit.image_url ? (
                          <img src={unit.image_url} alt={unit.name} loading="lazy" decoding="async" className="w-12 h-12 rounded-xl object-cover" />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Store className="h-5 w-5 text-primary" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate">{unit.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {unit.address_city && (
                              <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                                <MapPin className="h-3 w-3" /> {unit.address_city}
                                {unit.address_neighborhood ? ` · ${unit.address_neighborhood}` : ""}
                              </span>
                            )}
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                              status === "active" ? "bg-green-500/10 text-green-600"
                              : status === "draft" ? "bg-slate-500/10 text-slate-600"
                              : status === "paused" ? "bg-amber-500/10 text-amber-600"
                              : "bg-amber-500/10 text-amber-600"
                            }`}>
                              {UNIT_STATUS_LABELS[status]}
                            </span>
                          </div>
                        </div>
                        <button onClick={() => navigate(`/${unit.slug}`)} className="p-2 text-muted-foreground hover:text-primary" title="Ver loja">
                          <ExternalLink className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Checklist do rascunho */}
                      {unit.is_draft && checklist && (
                        <div className="mt-3 bg-muted/40 rounded-xl p-3">
                          <p className="text-[11px] font-bold text-muted-foreground uppercase mb-2">
                            Para publicar · {done}/4
                          </p>
                          <div className="space-y-1">
                            {CHECKLIST_KEYS.map(k => (
                              <p key={k} className="text-xs flex items-center gap-1.5">
                                {checklist[k]
                                  ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                                  : <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                                <span className={checklist[k] ? "text-muted-foreground" : "font-bold"}>{CHECKLIST_LABELS[k]}</span>
                              </p>
                            ))}
                          </div>
                          {!checklist.ready && (
                            <p className="text-[11px] text-muted-foreground mt-2">
                              Falta: {checklistMissingLabels(checklist).join(", ")}. Horário, cardápio e entregador se configuram no painel da própria subloja.
                            </p>
                          )}
                        </div>
                      )}

                      {/* Gerente */}
                      <div className="mt-3 flex items-center gap-2 text-xs">
                        <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        {manager ? (
                          <span className="truncate">Gerente: <b>{manager.email}</b></span>
                        ) : invite ? (
                          <span className="truncate">Convite pendente para <b>{invite.email}</b> (vale 7 dias)</span>
                        ) : (
                          <span className="text-muted-foreground">Sem gerente</span>
                        )}
                      </div>

                      {/* Ações */}
                      <div className="mt-3 flex gap-2">
                        {unit.is_draft && (
                          <button
                            onClick={() => setPublishUnit(unit)}
                            disabled={!canPublish}
                            className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 font-bold text-xs disabled:opacity-50"
                          >
                            Publicar
                          </button>
                        )}
                        {!manager && (
                          <button
                            onClick={() => setInviteUnit(unit)}
                            className="flex-1 bg-card border border-border rounded-xl py-2.5 font-bold text-xs flex items-center justify-center gap-1.5"
                          >
                            <UserPlus className="h-3.5 w-3.5" /> Convidar gerente
                          </button>
                        )}
                        {manager && (
                          <button
                            onClick={() => setUnlinkUnit({ unit, managerEmail: manager.email })}
                            className="flex-1 bg-card border border-border rounded-xl py-2.5 font-bold text-xs flex items-center justify-center gap-1.5 text-red-600"
                          >
                            <UserX className="h-3.5 w-3.5" /> Desvincular
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "financeiro" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-emerald-500" />
                  <p className="text-[11px] font-bold text-muted-foreground uppercase">Faturamento</p>
                </div>
                <p className="text-xl font-black">{formatBRL(financials?.totalRevenue || 0)}</p>
                <p className="text-[10px] text-muted-foreground">Este mês · todas sublojas</p>
              </div>
              <div className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ShoppingBag className="h-4 w-4 text-blue-500" />
                  <p className="text-[11px] font-bold text-muted-foreground uppercase">Pedidos</p>
                </div>
                <p className="text-xl font-black">{financials?.totalOrders || 0}</p>
                <p className="text-[10px] text-muted-foreground">Este mês · consolidado</p>
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-sm font-bold mb-1">Repasse das sublojas — só leitura</p>
              <p className="text-[11px] text-muted-foreground mb-3">Cada subloja paga o seu repasse (R$ 0,99 por entrega). Aqui você acompanha o total.</p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total pendente</span>
                <span className="font-black">{formatBRL(financials?.pendingPayout || 0)}</span>
              </div>
              {(financials?.repasseByStore || []).map(r => {
                const unit = sublojas.find(u => u.id === r.store_id);
                if (!unit || r.repasse <= 0) return null;
                return (
                  <div key={r.store_id} className="flex items-center justify-between text-sm mt-1.5">
                    <span className="text-muted-foreground truncate">{unit.name}</span>
                    <span className="font-bold">{formatBRL(r.repasse)}</span>
                  </div>
                );
              })}
            </div>

            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-sm font-bold mb-3">Plano da Rede</p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Mensalidade base</span>
                <span className="font-bold">{formatBRL(network.monthly_fee)}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1.5">
                <span className="text-muted-foreground">Mensalidade efetiva</span>
                <span className="font-bold">{formatBRL(effectiveFee)}{onGratuity ? " (gratuita — GMV 60d até R$ 5.000)" : ""}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1.5">
                <span className="text-muted-foreground">GMV 60 dias</span>
                <span className="font-bold">{formatBRL(financials?.gmv60d || 0)}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1.5">
                <span className="text-muted-foreground">Tipo</span>
                <span className="font-bold uppercase text-xs">{network.plan_type}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1.5">
                <span className="text-muted-foreground">Sublojas</span>
                <span className="font-bold">{sublojas.length} / {network.max_units}</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "relatorios" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground text-center py-2">Performance por subloja neste mês</p>
            {sublojas.filter(u => !u.is_draft).map(unit => (
              <UnitReport key={unit.id} unit={unit} />
            ))}
            {sublojas.filter(u => !u.is_draft).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">Publique uma subloja para ver relatórios</p>
            )}
          </div>
        )}
      </div>

      {/* Modal: Criar subloja */}
      {showCreateModal && (
        <CreateUnitModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { invalidateAll(); setShowCreateModal(false); }}
        />
      )}

      {/* Modal: Convidar gerente */}
      {inviteUnit && (
        <InviteManagerModal
          unit={inviteUnit}
          onClose={() => setInviteUnit(null)}
          onCreated={() => { invalidateAll(); }}
        />
      )}

      {/* Confirmar: publicar subloja */}
      <AlertDialog open={publishUnit !== null} onOpenChange={(open) => { if (!open) setPublishUnit(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publicar esta subloja?</AlertDialogTitle>
            <AlertDialogDescription>
              {publishUnit ? `A ${publishUnit.name} aparece na vitrine e começa a vender.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => publishUnit && publishMutation.mutate(publishUnit.id)}
            >
              Publicar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmar: desvincular gerente */}
      <AlertDialog open={unlinkUnit !== null} onOpenChange={(open) => { if (!open) setUnlinkUnit(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desvincular gerente?</AlertDialogTitle>
            <AlertDialogDescription>
              {unlinkUnit ? `${unlinkUnit.managerEmail ?? "O gerente"} perde o acesso a ${unlinkUnit.unit.name} na hora e volta a ser usuário comum.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => unlinkUnit && unlinkMutation.mutate(unlinkUnit.unit.id)}
            >
              Desvincular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmar: pausar / reativar rede */}
      <AlertDialog open={pauseConfirmOpen} onOpenChange={setPauseConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{network.is_paused ? "Reativar a rede?" : "Pausar a rede?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {network.is_paused
                ? "As sublojas voltam a vender."
                : "Pausar a rede fecha todas as sublojas publicadas para pedidos, de uma vez. Dá para reativar depois."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => pauseMutation.mutate(!network.is_paused)}>
              {network.is_paused ? "Reativar" : "Pausar rede"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// ─── COMPONENTE: Card de relatório por unidade ─────────────────────────────
const UnitReport = ({ unit }: { unit: Unit }) => {
  const { data: stats } = useQuery({
    queryKey: ["matriz-v2-unit-stats", unit.id],
    queryFn: async () => {
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const { data } = await supabase
        .from("orders")
        .select("total_price, status")
        .eq("store_id", unit.id)
        .gte("created_at", monthStart);
      const finalized = (data || []).filter((o: any) => o.status === "finalizado");
      const revenue = finalized.reduce((s, o: any) => s + Number(o.total_price || 0), 0);
      return { orders: finalized.length, revenue };
    },
  });

  return (
    <div className="bg-card border border-border rounded-2xl p-3.5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold">{unit.name}</p>
          {unit.address_city && <p className="text-[11px] text-muted-foreground">{unit.address_city}</p>}
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="bg-muted/40 rounded-xl p-2 text-center">
          <p className="text-[10px] text-muted-foreground uppercase">Pedidos</p>
          <p className="text-sm font-black">{stats?.orders ?? "—"}</p>
        </div>
        <div className="bg-muted/40 rounded-xl p-2 text-center">
          <p className="text-[10px] text-muted-foreground uppercase">Faturamento</p>
          <p className="text-sm font-black">{stats ? formatBRL(stats.revenue) : "—"}</p>
        </div>
      </div>
    </div>
  );
};

// ─── MODAL: Criar nova subloja (nasce rascunho) ───────────────────────────
const CreateUnitModal = ({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) => {
  const [form, setForm] = useState<CreateUnitForm>({
    name: "",
    slug: "",
    category: "restaurante",
    address_street: "",
    address_number: "",
    address_neighborhood: "",
    address_city: "",
    address_state: "",
    address_cep: "",
    delivery_fee: "",
    delivery_radius: "",
    minimum_order_value: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [slugTouched, setSlugTouched] = useState(false);

  const set = (key: keyof CreateUnitForm, value: string) => {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === "name" && !slugTouched) {
        next.slug = slugifyUnitName(value);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    const problems = validateCreateUnitForm(form);
    if (problems.length > 0) {
      setErrors(problems);
      return;
    }
    setErrors([]);
    setSubmitting(true);
    try {
      const { data: storeId, error } = await (supabase as any).rpc("create_network_unit", {
        _name: form.name.trim(),
        _slug: form.slug.trim(),
        _category: form.category,
        _address_street: form.address_street.trim(),
        _address_number: form.address_number.trim(),
        _address_neighborhood: form.address_neighborhood.trim(),
        _address_city: form.address_city.trim(),
        _address_state: form.address_state.trim() || null,
        _address_cep: form.address_cep.replace(/\D/g, "") || null,
        _delivery_fee: parseMoneyField(form.delivery_fee),
        _delivery_radius: parseMoneyField(form.delivery_radius),
        _minimum_order_value: parseMoneyField(form.minimum_order_value),
      });
      if (error) throw error;
      if (!storeId) throw new Error("A subloja não foi criada.");
      toast.success("Subloja criada como rascunho! Complete o checklist e publique.");
      onCreated();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar subloja.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = "w-full bg-muted/40 border border-border rounded-xl px-3 py-2.5 text-sm";
  const labelCls = "text-xs font-bold text-muted-foreground block mb-1";

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-background w-full max-w-md rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-background border-b border-border px-5 py-3.5 flex items-center justify-between">
          <h2 className="text-sm font-black">Nova subloja</h2>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-muted-foreground">
            A subloja nasce como <b>rascunho invisível</b> — fora da vitrine e sem vender — até você publicar com o checklist completo.
          </p>
          {errors.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
              {errors.map((e) => (
                <p key={e} className="text-xs text-red-600">{e}</p>
              ))}
            </div>
          )}
          <div>
            <label className={labelCls}>Nome da subloja *</label>
            <input value={form.name} onChange={e => set("name", e.target.value)}
              placeholder="Ex: Cantinho do Tempero — Centro"
              className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Slug (URL única) *</label>
            <input value={form.slug} onChange={e => { setSlugTouched(true); set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-")); }}
              placeholder="cantinho-do-tempero-centro"
              className={inputCls} />
            <p className="text-[10px] text-muted-foreground mt-1">URL: itasuper.com.br/{form.slug || "..."}</p>
          </div>
          <div>
            <label className={labelCls}>Categoria</label>
            <select value={form.category} onChange={e => set("category", e.target.value)} className={inputCls}>
              {CATEGORY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <label className={labelCls}>Rua *</label>
              <input value={form.address_street} onChange={e => set("address_street", e.target.value)}
                placeholder="Av. Getúlio Vargas" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Número *</label>
              <input value={form.address_number} onChange={e => set("address_number", e.target.value)}
                placeholder="1345" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Bairro *</label>
              <input value={form.address_neighborhood} onChange={e => set("address_neighborhood", e.target.value)}
                placeholder="Centro" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Cidade *</label>
              <input value={form.address_city} onChange={e => set("address_city", e.target.value)}
                placeholder="Araruama" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Estado</label>
              <input value={form.address_state} onChange={e => set("address_state", e.target.value)}
                placeholder="RJ" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>CEP *</label>
              <input value={form.address_cep} onChange={e => set("address_cep", e.target.value)}
                placeholder="28970-000" className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={labelCls}>Taxa entrega (R$)</label>
              <input value={form.delivery_fee} onChange={e => set("delivery_fee", e.target.value)}
                placeholder="6,99" className={inputCls} inputMode="decimal" />
            </div>
            <div>
              <label className={labelCls}>Raio (km)</label>
              <input value={form.delivery_radius} onChange={e => set("delivery_radius", e.target.value)}
                placeholder="5" className={inputCls} inputMode="decimal" />
            </div>
            <div>
              <label className={labelCls}>Pedido mín. (R$)</label>
              <input value={form.minimum_order_value} onChange={e => set("minimum_order_value", e.target.value)}
                placeholder="20" className={inputCls} inputMode="decimal" />
            </div>
          </div>
          <button onClick={handleSubmit} disabled={submitting}
            className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-black text-sm disabled:opacity-50 flex items-center justify-center gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Criar subloja (rascunho)
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── MODAL: Convidar gerente ──────────────────────────────────────────────
const InviteManagerModal = ({ unit, onClose, onCreated }: { unit: Unit; onClose: () => void; onCreated: () => void }) => {
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleInvite = async () => {
    if (!email.trim()) {
      toast.error("Digite o e-mail do gerente da unidade.");
      return;
    }
    setInviting(true);
    try {
      const { data: code, error } = await (supabase as any).rpc("invite_unit_manager", {
        _store_id: unit.id,
        _email: email.trim(),
      });
      if (error) throw error;
      setInviteLink(buildInviteLink(window.location.origin, code as string));
      toast.success("Convite criado — vale 7 dias.");
      onCreated();
    } catch (err: any) {
      toast.error(err.message || "Erro ao convidar gerente.");
    } finally {
      setInviting(false);
    }
  };

  const copyLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar. Copie o link manualmente.");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-background w-full max-w-md rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-background border-b border-border px-5 py-3.5 flex items-center justify-between">
          <h2 className="text-sm font-black">Convidar gerente</h2>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-muted/40 rounded-xl p-3">
            <p className="text-xs text-muted-foreground">Subloja</p>
            <p className="text-sm font-bold">{unit.name}</p>
          </div>

          <div className="bg-blue-500/8 border border-blue-500/20 rounded-xl p-3 space-y-2">
            <p className="text-xs font-bold text-blue-700 dark:text-blue-400">Como funciona o convite:</p>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal pl-4">
              <li>A pessoa se cadastra no ItaSuper primeiro (cadastro normal), se ainda não tem conta</li>
              <li>Você manda o link abaixo para ela por e-mail ou WhatsApp</li>
              <li>Ela abre o link, entra com a conta do e-mail convidado e aceita — aí vira gerente desta subloja</li>
              <li>O convite vale 7 dias</li>
            </ol>
          </div>

          {!inviteLink ? (
            <>
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">E-mail do gerente</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="gerente@email.com"
                  className="w-full bg-muted/40 border border-border rounded-xl px-3 py-2.5 text-sm"
                />
              </div>
              <button onClick={handleInvite} disabled={inviting}
                className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-black text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Criar convite
              </button>
            </>
          ) : (
            <div className="space-y-3">
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                  <LinkIcon className="h-3 w-3" /> Link do convite (vale 7 dias)
                </p>
                <p className="text-xs font-bold break-all">{inviteLink}</p>
              </div>
              <button onClick={copyLink}
                className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-black text-sm flex items-center justify-center gap-2">
                <Copy className="h-4 w-4" /> {copied ? "Copiado!" : "Copiar link"}
              </button>
              <button onClick={onClose}
                className="w-full bg-card border border-border rounded-xl py-3 font-bold text-sm">
                Fechar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MatrizDashboardV2;
