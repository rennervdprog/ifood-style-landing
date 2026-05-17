/**
 * MatrizDashboard — Painel exclusivo do lojista matriz
 * Permite criar/gerenciar unidades, ver financeiro consolidado e relatórios
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatBRL } from "@/lib/utils";
import {
  Store, Plus, LogOut, Building2, TrendingUp, DollarSign,
  ShoppingBag, MapPin, ChevronRight, Loader2, Users, X,
  Copy, Check, AlertCircle,
} from "lucide-react";

interface Network {
  id: string;
  name: string;
  logo_url: string | null;
  plan_type: string;
  monthly_fee: number;
  max_units: number;
  is_approved: boolean;
}

interface Unit {
  id: string;
  name: string;
  slug: string;
  category: string;
  status: string;
  address_city: string | null;
  image_url: string | null;
}

const MatrizDashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState<Unit | null>(null);
  const [activeTab, setActiveTab] = useState<"unidades" | "financeiro" | "relatorios">("unidades");

  // Buscar rede da matriz
  const { data: network, isLoading: loadingNetwork } = useQuery({
    queryKey: ["matriz-network", user?.id],
    queryFn: async (): Promise<Network | null> => {
      const { data } = await supabase
        .from("store_networks")
        .select("*")
        .eq("owner_id", user!.id)
        .maybeSingle();
      return data as any;
    },
    enabled: !!user?.id,
  });

  // Buscar unidades
  const { data: units = [] } = useQuery({
    queryKey: ["matriz-units", network?.id],
    queryFn: async (): Promise<Unit[]> => {
      const { data } = await supabase
        .from("stores")
        .select("id, name, slug, category, status, address_city, image_url")
        .eq("network_id", network!.id)
        .order("created_at", { ascending: true });
      return (data as any) || [];
    },
    enabled: !!network?.id,
  });

  // Buscar financeiro consolidado
  const { data: financials } = useQuery({
    queryKey: ["matriz-financials", network?.id],
    queryFn: async () => {
      if (!network?.id) return null;
      const unitIds = units.map(u => u.id);
      if (unitIds.length === 0) return { totalRevenue: 0, totalOrders: 0, pendingPayout: 0 };

      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

      const [ordersRes, balancesRes] = await Promise.all([
        supabase.from("orders")
          .select("total_price")
          .in("store_id", unitIds)
          .eq("status", "finalizado")
          .gte("created_at", monthStart),
        supabase.from("store_balances")
          .select("repasse_pendente, comissao_pendente")
          .in("store_id", unitIds),
      ]);

      const totalRevenue = (ordersRes.data || []).reduce((s, o: any) => s + Number(o.total_price || 0), 0);
      const totalOrders = (ordersRes.data || []).length;
      const pendingPayout = (balancesRes.data || []).reduce(
        (s, b: any) => s + Number(b.repasse_pendente || 0) + Number(b.comissao_pendente || 0),
        0
      );

      return { totalRevenue, totalOrders, pendingPayout };
    },
    enabled: !!network?.id && units.length > 0,
  });

  const createUnitMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      slug: string;
      category: string;
      city: string;
      cep: string;
    }) => {
      const { data: result, error } = await supabase.rpc("create_network_unit", {
        _name: data.name,
        _slug: data.slug,
        _category: data.category,
        _address_city: data.city,
        _address_cep: data.cep,
      });
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      toast.success("Unidade criada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["matriz-units"] });
      setShowCreateModal(false);
    },
    onError: (err: any) => toast.error(err.message || "Erro ao criar unidade."),
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

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-card border-b border-border sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {network.logo_url ? (
              <img src={network.logo_url} alt={network.name} className="w-10 h-10 rounded-xl object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-black truncate">{network.name}</p>
              <p className="text-[11px] text-muted-foreground">Painel Matriz · {units.length} unidade(s)</p>
            </div>
          </div>
          <button onClick={() => signOut()} className="p-2 text-muted-foreground hover:text-foreground">
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        {!network.is_approved && (
          <div className="px-4 py-2 bg-amber-500/10 border-t border-amber-500/20 flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <p className="text-[11px] text-amber-700 dark:text-amber-400">Aguardando aprovação. Crie as unidades — elas serão liberadas automaticamente após aprovação.</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-t border-border">
          {[
            { id: "unidades", label: "Unidades", icon: Store },
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
            <button
              onClick={() => setShowCreateModal(true)}
              disabled={units.length >= network.max_units}
              className="w-full bg-primary text-primary-foreground rounded-xl p-3.5 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform"
            >
              <Plus className="h-4 w-4" /> Criar nova unidade ({units.length}/{network.max_units})
            </button>

            {units.length === 0 ? (
              <div className="text-center py-12">
                <Store className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm font-bold text-muted-foreground">Nenhuma unidade criada</p>
                <p className="text-xs text-muted-foreground mt-1">Crie a primeira unidade da sua rede</p>
              </div>
            ) : (
              <div className="space-y-2">
                {units.map(unit => (
                  <div key={unit.id} className="bg-card border border-border rounded-2xl p-3.5">
                    <div className="flex items-center gap-3">
                      {unit.image_url ? (
                        <img src={unit.image_url} alt={unit.name} className="w-12 h-12 rounded-xl object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Store className="h-5 w-5 text-primary" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{unit.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {unit.address_city && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                              <MapPin className="h-3 w-3" /> {unit.address_city}
                            </span>
                          )}
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            unit.status === "ativo"
                              ? "bg-green-500/10 text-green-600"
                              : "bg-amber-500/10 text-amber-600"
                          }`}>
                            {unit.status === "ativo" ? "ATIVA" : "PENDENTE"}
                          </span>
                        </div>
                      </div>
                      <button onClick={() => setShowLinkModal(unit)} className="p-2 text-muted-foreground hover:text-primary">
                        <Users className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
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
                <p className="text-[10px] text-muted-foreground">Este mês · todas unidades</p>
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

            {(financials?.pendingPayout || 0) > 0 && (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4">
                <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase mb-1">⚠️ Repasse pendente</p>
                <p className="text-lg font-black text-amber-700 dark:text-amber-400">{formatBRL(financials?.pendingPayout || 0)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">Total a repassar à plataforma (todas as unidades)</p>
              </div>
            )}

            <div className="bg-card border border-border rounded-2xl p-4">
              <p className="text-sm font-bold mb-3">Plano da Rede</p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Mensalidade</span>
                <span className="font-bold">{formatBRL(network.monthly_fee)}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1.5">
                <span className="text-muted-foreground">Tipo</span>
                <span className="font-bold uppercase text-xs">{network.plan_type}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1.5">
                <span className="text-muted-foreground">Unidades</span>
                <span className="font-bold">{units.length} / {network.max_units}</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "relatorios" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground text-center py-2">Performance por unidade neste mês</p>
            {units.map(unit => (
              <UnitReport key={unit.id} unit={unit} />
            ))}
            {units.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">Crie unidades para ver relatórios</p>
            )}
          </div>
        )}
      </div>

      {/* Modal: Criar unidade */}
      {showCreateModal && (
        <CreateUnitModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={(data) => createUnitMutation.mutate(data)}
          submitting={createUnitMutation.isPending}
          networkId={network.id}
          sourceUnits={units}
        />
      )}

      {/* Modal: Vincular usuário à unidade */}
      {showLinkModal && (
        <LinkUserModal
          unit={showLinkModal}
          onClose={() => setShowLinkModal(null)}
        />
      )}
    </div>
  );
};

// ─── COMPONENTE: Card de relatório por unidade ─────────────────────────────
const UnitReport = ({ unit }: { unit: Unit }) => {
  const { data: stats } = useQuery({
    queryKey: ["unit-stats", unit.id],
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

// ─── MODAL: Criar nova unidade ────────────────────────────────────────────
const CreateUnitModal = ({ onClose, onSubmit, submitting, networkId, sourceUnits }: any) => {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [category, setCategory] = useState("restaurante");
  const [city, setCity] = useState("");
  const [cep, setCep] = useState("");
  const [cloneFromId, setCloneFromId] = useState<string>(sourceUnits[0]?.id || "");
  const [shouldClone, setShouldClone] = useState(sourceUnits.length > 0);
  const queryClient = useQueryClient();

  const handleSubmit = async () => {
    if (!name.trim() || !slug.trim() || !city.trim()) {
      toast.error("Preencha nome, slug e cidade.");
      return;
    }
    try {
      // Criar unidade
      const { data: storeId, error } = await supabase.rpc("create_network_unit", {
        _name: name.trim(),
        _slug: slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        _category: category,
        _address_city: city.trim(),
        _address_cep: cep.replace(/\D/g, "") || null,
      });
      if (error) throw error;

      // Clonar cardápio se selecionado
      if (shouldClone && cloneFromId && storeId) {
        const { data: cloneResult, error: cloneErr } = await supabase.rpc("clone_menu_from_matriz", {
          _source_store_id: cloneFromId,
          _target_store_id: storeId as any,
        });
        if (cloneErr) {
          toast.warning(`Unidade criada, mas falhou ao clonar cardápio: ${cloneErr.message}`);
        } else {
          const cats = (cloneResult as any)?.categories_copied || 0;
          const prods = (cloneResult as any)?.products_copied || 0;
          toast.success(`Unidade criada! ${cats} categorias e ${prods} produtos copiados.`);
        }
      } else {
        toast.success("Unidade criada com sucesso!");
      }

      queryClient.invalidateQueries({ queryKey: ["matriz-units"] });
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar unidade.");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-background w-full max-w-md rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-background border-b border-border px-5 py-3.5 flex items-center justify-between">
          <h2 className="text-sm font-black">Nova Unidade</h2>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1">Nome da unidade *</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Ex: Itasuper Pizzaria Botucatu"
              className="w-full bg-muted/40 border border-border rounded-xl px-3 py-2.5 text-sm" />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1">Slug (URL única) *</label>
            <input value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
              placeholder="itasuper-pizzaria-botucatu"
              className="w-full bg-muted/40 border border-border rounded-xl px-3 py-2.5 text-sm" />
            <p className="text-[10px] text-muted-foreground mt-1">URL: itasuper.com.br/{slug || "..."}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">Cidade *</label>
              <input value={city} onChange={e => setCity(e.target.value)}
                placeholder="Botucatu"
                className="w-full bg-muted/40 border border-border rounded-xl px-3 py-2.5 text-sm" />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">CEP</label>
              <input value={cep} onChange={e => setCep(e.target.value)}
                placeholder="18690-000"
                className="w-full bg-muted/40 border border-border rounded-xl px-3 py-2.5 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1">Categoria</label>
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="w-full bg-muted/40 border border-border rounded-xl px-3 py-2.5 text-sm">
              <option value="restaurante">Restaurante</option>
              <option value="lanches">Lanches</option>
              <option value="pizzas">Pizzaria</option>
              <option value="saudavel">Saudável</option>
              <option value="cafeteria">Cafeteria</option>
              <option value="japonesa">Japonesa</option>
              <option value="churrasco">Churrasco</option>
              <option value="sobremesas">Sobremesas</option>
              <option value="farmacias">Farmácia</option>
              <option value="adegas">Adega</option>
            </select>
          </div>

          {sourceUnits.length > 0 && (
            <div className="bg-muted/30 rounded-xl p-3 space-y-2">
              <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
                <input type="checkbox" checked={shouldClone} onChange={e => setShouldClone(e.target.checked)} />
                Copiar cardápio de uma unidade existente
              </label>
              {shouldClone && (
                <select value={cloneFromId} onChange={e => setCloneFromId(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs">
                  {sourceUnits.map((u: Unit) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          <button onClick={handleSubmit} disabled={submitting}
            className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-black text-sm disabled:opacity-50 flex items-center justify-center gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Criar unidade
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── MODAL: Vincular usuário à unidade ────────────────────────────────────
const LinkUserModal = ({ unit, onClose }: { unit: Unit; onClose: () => void }) => {
  const [email, setEmail] = useState("");
  const [linking, setLinking] = useState(false);
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  const handleLink = async () => {
    if (!email.trim()) {
      toast.error("Digite o email do gerente da unidade.");
      return;
    }
    setLinking(true);
    try {
      const { error } = await supabase.rpc("link_unit_user", {
        _user_email: email.trim(),
        _store_id: unit.id,
      });
      if (error) throw error;
      toast.success(`${email} agora é gerente desta unidade.`);
      queryClient.invalidateQueries({ queryKey: ["matriz-units"] });
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao vincular usuário.");
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-background w-full max-w-md rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-background border-b border-border px-5 py-3.5 flex items-center justify-between">
          <h2 className="text-sm font-black">Vincular gerente</h2>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-muted/40 rounded-xl p-3">
            <p className="text-xs text-muted-foreground">Unidade</p>
            <p className="text-sm font-bold">{unit.name}</p>
          </div>

          <div className="bg-blue-500/8 border border-blue-500/20 rounded-xl p-3 space-y-2">
            <p className="text-xs font-bold text-blue-700 dark:text-blue-400">📝 Como vincular:</p>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal pl-4">
              <li>O gerente da unidade precisa se cadastrar no ItaSuper primeiro (cadastro normal)</li>
              <li>Depois você coloca o email dele aqui para vincular</li>
              <li>Ele fará login normalmente e verá apenas esta unidade</li>
            </ol>
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1">Email do gerente</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="gerente@email.com"
              className="w-full bg-muted/40 border border-border rounded-xl px-3 py-2.5 text-sm"
            />
          </div>

          <button onClick={handleLink} disabled={linking}
            className="w-full bg-primary text-primary-foreground rounded-xl py-3 font-black text-sm disabled:opacity-50 flex items-center justify-center gap-2">
            {linking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
            Vincular gerente
          </button>
        </div>
      </div>
    </div>
  );
};

export default MatrizDashboard;
