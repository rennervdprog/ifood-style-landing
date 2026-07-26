import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Users, Plus, Copy, CheckCircle2, DollarSign, Store, Loader2,
  Eye, EyeOff, Search, X, UserCheck, Percent, Truck, CreditCard
} from "lucide-react";
import { formatBRL } from "@/lib/utils";

/* ── Tiny UI atoms ── */
const Input = ({ label, hint, ...props }: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
  <div>
    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
    <input {...props} className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground mt-1 focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition" />
    {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
  </div>
);

const PlanCard = ({ icon, title, subtitle, children }: { icon: string; title: string; subtitle: string; children: React.ReactNode }) => (
  <div className="bg-background border border-border rounded-2xl p-4 space-y-3">
    <div className="flex items-center gap-2">
      <span className="text-base">{icon}</span>
      <div>
        <p className="text-sm font-bold text-foreground">{title}</p>
        <p className="text-[10px] text-muted-foreground">{subtitle}</p>
      </div>
    </div>
    <div className="grid grid-cols-3 gap-2">{children}</div>
  </div>
);

const StatBox = ({ label, value, color = "text-foreground" }: { label: string; value: string; color?: string }) => (
  <div className="bg-muted rounded-xl p-2.5 text-center">
    <p className="text-[10px] text-muted-foreground">{label}</p>
    <p className={`text-sm font-black ${color}`}>{value}</p>
  </div>
);

/* ── Main ── */
const ModeratorManager = () => {
  const qc = useQueryClient();

  // Add form state
  const [showAdd, setShowAdd] = useState(false);
  const [step, setStep] = useState<"search" | "config">("search");
  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [foundUsers, setFoundUsers] = useState<{ user_id: string; full_name: string; email: string; phone: string }[]>([]);
  const [selectedUser, setSelectedUser] = useState<{ user_id: string; full_name: string; email: string; phone: string } | null>(null);

  // Per-plan config
  const [essencialPlanFee, setEssencialPlanFee] = useState(40);
  const [essencialDelivery, setEssencialDelivery] = useState(1);
  const [crescimentoPlanFee, setCrescimentoPlanFee] = useState(40);
  const [crescimentoCommission, setCrescimentoCommission] = useState(1);
  const [crescimentoDelivery, setCrescimentoDelivery] = useState(1);
  const [comissaoCommission, setComissaoCommission] = useState(2);
  const [saving, setSaving] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [expandedMod, setExpandedMod] = useState<string | null>(null);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);

  /* ── Queries ── */
  const { data: moderators, isLoading } = useQuery({
    queryKey: ["moderators"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("moderators").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: referrals } = useQuery({
    queryKey: ["moderator-referrals"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("moderator_referrals").select("*, stores:store_id(name, id)").order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: earnings } = useQuery({
    queryKey: ["moderator-earnings"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("moderator_earnings").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  /* ── Helpers ── */
  const generateCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "MOD-";
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  };

  const getModEarnings = (modId: string) => {
    const me = earnings?.filter((e: any) => e.moderator_id === modId) || [];
    const unpaid = me.filter((e: any) => !e.is_paid);
    const totalUnpaid = unpaid.reduce((s: number, e: any) => s + Number(e.amount), 0);
    const totalPaid = me.filter((e: any) => e.is_paid).reduce((s: number, e: any) => s + Number(e.amount), 0);
    const totalAll = me.reduce((s: number, e: any) => s + Number(e.amount), 0);
    return { unpaid, totalUnpaid, totalPaid, totalAll, all: me };
  };

  const getModReferrals = (modId: string) => referrals?.filter((r: any) => r.moderator_id === modId) || [];

  /* ── Search by email ── */
  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setSearching(true);
    setFoundUsers([]);
    try {
      // Search profiles by email (ilike)
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, phone")
        .ilike("email", `%${searchTerm.trim()}%`)
        .limit(10);
      if (error) throw error;

      if (!data || data.length === 0) {
        toast.error("Nenhum usuário encontrado com esse e-mail. Verifique se ele já tem conta.");
        return;
      }

      // Filter out users already moderators
      const existingUserIds = moderators?.map((m: any) => m.user_id).filter(Boolean) || [];
      const existingEmails = moderators?.map((m: any) => m.email?.toLowerCase()).filter(Boolean) || [];
      const filtered = data.filter(u =>
        !existingUserIds.includes(u.user_id) &&
        !existingEmails.includes(u.email?.toLowerCase())
      );

      if (filtered.length === 0) {
        toast.info("Todos os usuários encontrados já são moderadores.");
        return;
      }

      setFoundUsers(filtered.map(u => ({
        user_id: u.user_id,
        full_name: u.full_name || "",
        email: u.email || "",
        phone: u.phone || "",
      })));
    } catch {
      toast.error("Erro ao buscar usuário.");
    } finally {
      setSearching(false);
    }
  };

  const handleSelectUser = (u: typeof foundUsers[0]) => {
    setSelectedUser(u);
    setFoundUsers([]);
    setSearchTerm("");
    setStep("config");
  };

  const handleCreateModerator = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const code = generateCode();
      const { error } = await (supabase as any).from("moderators").insert({
        name: selectedUser.full_name || selectedUser.email,
        email: selectedUser.email || null,
        phone: selectedUser.phone || null,
        user_id: selectedUser.user_id,
        referral_code: code,
        plan_fee_percent: essencialPlanFee,
        delivery_split: essencialDelivery,
        commission_split_percent: comissaoCommission,
      });
      if (error) throw error;
      toast.success(`Moderador "${selectedUser.full_name || selectedUser.email}" criado! Código: ${code}`);
      resetForm();
      qc.invalidateQueries({ queryKey: ["moderators"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar moderador");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setShowAdd(false);
    setStep("search");
    setSearchTerm("");
    setFoundUsers([]);
    setSelectedUser(null);
    setEssencialPlanFee(40);
    setEssencialDelivery(1);
    setCrescimentoPlanFee(40);
    setCrescimentoCommission(1);
    setCrescimentoDelivery(1);
    setComissaoCommission(2);
  };

  const copyLink = (code: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/cadastro-lojista?ref=${code}`);
    setCopiedCode(code);
    toast.success("Link copiado!");
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleMarkPaid = async (modId: string) => {
    setMarkingPaid(modId);
    try {
      const { error } = await (supabase as any).from("moderator_earnings").update({ is_paid: true, paid_at: new Date().toISOString() }).eq("moderator_id", modId).eq("is_paid", false);
      if (error) throw error;
      toast.success("Ganhos marcados como pagos!");
      qc.invalidateQueries({ queryKey: ["moderator-earnings"] });
    } catch (err: any) { toast.error(err.message); }
    finally { setMarkingPaid(null); }
  };

  const handleToggleActive = async (mod: any) => {
    try {
      const { error } = await (supabase as any).from("moderators").update({ is_active: !mod.is_active }).eq("id", mod.id);
      if (error) throw error;
      toast.success(mod.is_active ? "Moderador desativado" : "Moderador ativado");
      qc.invalidateQueries({ queryKey: ["moderators"] });
    } catch (err: any) { toast.error(err.message); }
  };

  const generateWhatsAppReport = (mod: any) => {
    const { totalUnpaid, totalPaid, totalAll, unpaid } = getModEarnings(mod.id);
    const modRefs = getModReferrals(mod.id);
    let msg = `💼 *Relatório Moderador - ${mod.name}*\n\n`;
    msg += `📊 Lojas indicadas: ${modRefs.length}\n💰 Total ganho: ${formatBRL(totalAll)}\n✅ Já pago: ${formatBRL(totalPaid)}\n⏳ Pendente: ${formatBRL(totalUnpaid)}\n`;
    if (unpaid.length > 0) {
      msg += `\n📋 *Detalhes pendentes:*\n`;
      const byType = (type: string, label: string) => {
        const items = unpaid.filter((e: any) => e.earning_type === type);
        if (items.length) msg += `• ${label}: ${formatBRL(items.reduce((s: number, e: any) => s + Number(e.amount), 0))} (${items.length}x)\n`;
      };
      byType("plan_fee", "Mensalidades");
      byType("commission_split", "Comissão pedidos");
      byType("delivery_split", "Taxa entrega");
    }
    navigator.clipboard.writeText(msg);
    toast.success("Relatório copiado!");
  };

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" /> Moderadores
        </h2>
        <button
          onClick={() => { showAdd ? resetForm() : setShowAdd(true); }}
          className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 transition ${showAdd ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"}`}
        >
          {showAdd ? <><X className="h-4 w-4" /> Cancelar</> : <><Plus className="h-4 w-4" /> Novo Moderador</>}
        </button>
      </div>

      {/* ── Add Form ── */}
      {showAdd && (
        <div className="bg-card border-2 border-primary/20 rounded-2xl overflow-hidden">
          {/* Step indicator */}
          <div className="bg-primary/5 px-4 py-3 flex items-center gap-3 border-b border-border">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step === "search" ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"}`}>
              {step === "search" ? "1" : "✓"}
            </div>
            <div className="h-px flex-1 bg-border" />
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step === "config" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>2</div>
            <p className="text-xs text-muted-foreground ml-2">{step === "search" ? "Buscar usuário" : "Configurar comissões"}</p>
          </div>

          <div className="p-4 space-y-4">
            {step === "search" && (
              <>
                <div>
                  <p className="text-sm font-bold text-foreground mb-1">🔍 Buscar por e-mail</p>
                  <p className="text-xs text-muted-foreground mb-3">Digite o e-mail do usuário que já tem conta na plataforma.</p>
                  <div className="flex gap-2">
                    <input
                      placeholder="Ex: joao@email.com"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleSearch()}
                      className="flex-1 bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none"
                    />
                    <button
                      onClick={handleSearch}
                      disabled={searching || !searchTerm.trim()}
                      className="bg-primary text-primary-foreground px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      Buscar
                    </button>
                  </div>
                </div>

                {/* Results */}
                {foundUsers.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-muted-foreground">{foundUsers.length} resultado(s)</p>
                    {foundUsers.map(u => (
                      <button
                        key={u.user_id}
                        onClick={() => handleSelectUser(u)}
                        className="w-full bg-background border border-border rounded-xl p-3 flex items-center gap-3 hover:border-primary/50 hover:bg-primary/5 transition text-left"
                      >
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <UserCheck className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-foreground truncate">{u.full_name || "Sem nome"}</p>
                          <p className="text-xs text-muted-foreground truncate">{u.email} {u.phone && `· ${u.phone}`}</p>
                        </div>
                        <Plus className="h-5 w-5 text-primary shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {step === "config" && selectedUser && (
              <>
                {/* Selected user badge */}
                <div className="flex items-center gap-3 bg-accent/10 border border-accent/30 rounded-xl p-3">
                  <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                    <UserCheck className="h-5 w-5 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{selectedUser.full_name || "Sem nome"}</p>
                    <p className="text-xs text-muted-foreground truncate">{selectedUser.email}</p>
                  </div>
                  <button onClick={() => { setStep("search"); setSelectedUser(null); }} className="text-muted-foreground hover:text-foreground p-1">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Per-plan config */}
                <div className="space-y-3">
                  <PlanCard icon="📋" title="Plano Essencial" subtitle="R$ 90/mês* · Sem comissão por pedido">
                    <Input label="% Mensalidade" type="number" value={essencialPlanFee} onChange={e => setEssencialPlanFee(Number(e.target.value))} hint={`= ${formatBRL(180 * essencialPlanFee / 100)}`} />
                    <Input label="R$ / Entrega" type="number" step="0.5" value={essencialDelivery} onChange={e => setEssencialDelivery(Number(e.target.value))} />
                    <div className="flex items-center justify-center">
                      <span className="text-[10px] text-muted-foreground bg-muted rounded-lg px-2 py-1">Comissão: ❌</span>
                    </div>
                  </PlanCard>

                  <PlanCard icon="📈" title="Plano Crescimento" subtitle="R$ 100/mês + 2.5% por pedido">
                    <Input label="% Mensalidade" type="number" value={crescimentoPlanFee} onChange={e => setCrescimentoPlanFee(Number(e.target.value))} hint={`= ${formatBRL(100 * crescimentoPlanFee / 100)}`} />
                    <Input label="% Pedido" type="number" step="0.5" value={crescimentoCommission} onChange={e => setCrescimentoCommission(Number(e.target.value))} />
                    <Input label="R$ / Entrega" type="number" step="0.5" value={crescimentoDelivery} onChange={e => setCrescimentoDelivery(Number(e.target.value))} />
                  </PlanCard>

                  <PlanCard icon="💰" title="Plano Comissão" subtitle="6% por pedido · Sem mensalidade">
                    <div className="flex items-center justify-center">
                      <span className="text-[10px] text-muted-foreground bg-muted rounded-lg px-2 py-1">Mensalidade: ❌</span>
                    </div>
                    <Input label="% Pedido" type="number" step="0.5" value={comissaoCommission} onChange={e => setComissaoCommission(Number(e.target.value))} />
                    <div className="flex items-center justify-center">
                      <span className="text-[10px] text-muted-foreground bg-muted rounded-lg px-2 py-1">Entrega: ❌</span>
                    </div>
                  </PlanCard>
                </div>

                <button
                  onClick={handleCreateModerator}
                  disabled={saving}
                  className="w-full bg-primary text-primary-foreground py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><UserCheck className="h-4 w-4" /> Criar Moderador</>}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-2xl p-3 text-center">
          <Users className="h-4 w-4 text-primary mx-auto mb-1" />
          <p className="text-xl font-black text-foreground">{moderators?.length || 0}</p>
          <p className="text-[10px] text-muted-foreground">Moderadores</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-3 text-center">
          <Store className="h-4 w-4 text-primary mx-auto mb-1" />
          <p className="text-xl font-black text-foreground">{referrals?.length || 0}</p>
          <p className="text-[10px] text-muted-foreground">Lojas Indicadas</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-3 text-center">
          <DollarSign className="h-4 w-4 text-destructive mx-auto mb-1" />
          <p className="text-xl font-black text-destructive">
            {formatBRL(earnings?.filter((e: any) => !e.is_paid).reduce((s: number, e: any) => s + Number(e.amount), 0) || 0)}
          </p>
          <p className="text-[10px] text-muted-foreground">A Pagar</p>
        </div>
      </div>

      {/* ── Moderator List ── */}
      {moderators?.map((mod: any) => {
        const { totalUnpaid, totalPaid, totalAll, unpaid } = getModEarnings(mod.id);
        const modRefs = getModReferrals(mod.id);
        const isExpanded = expandedMod === mod.id;

        return (
          <div key={mod.id} className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="p-4 flex items-start justify-between cursor-pointer" onClick={() => setExpandedMod(isExpanded ? null : mod.id)}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-foreground truncate">{mod.name}</h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${mod.is_active ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground"}`}>
                    {mod.is_active ? "Ativo" : "Inativo"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {mod.email || mod.phone || "Sem contato"} · {modRefs.length} lojas · <span className="font-mono font-bold">{mod.referral_code}</span>
                </p>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-xs">Pendente: <span className="font-bold text-destructive">{formatBRL(totalUnpaid)}</span></span>
                  <span className="text-xs">Total: <span className="font-bold text-foreground">{formatBRL(totalAll)}</span></span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={e => { e.stopPropagation(); copyLink(mod.referral_code); }} className="bg-muted text-muted-foreground p-2 rounded-xl">
                  {copiedCode === mod.referral_code ? <CheckCircle2 className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
                </button>
                {isExpanded ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
              </div>
            </div>

            {isExpanded && (
              <div className="border-t border-border p-4 space-y-4">
                {/* Config */}
                <div className="grid grid-cols-3 gap-2">
                  <StatBox label="% Mensalidade" value={`${mod.plan_fee_percent}%`} />
                  <StatBox label="R$ Entrega" value={`R$${Number(mod.delivery_split).toFixed(2)}`} />
                  <StatBox label="% Comissão" value={`${mod.commission_split_percent}%`} />
                </div>

                {/* Referred Stores */}
                {modRefs.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-muted-foreground mb-1.5 flex items-center gap-1"><Store className="h-3.5 w-3.5" /> Lojas Indicadas</h4>
                    <div className="space-y-1">
                      {modRefs.map((ref: any) => (
                        <div key={ref.id} className="bg-muted rounded-xl px-3 py-1.5 text-sm text-foreground flex items-center gap-2">
                          <Store className="h-3.5 w-3.5 text-primary" />
                          {ref.stores?.name || "Loja removida"}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Unpaid */}
                {unpaid.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-muted-foreground mb-1.5 flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" /> Pendentes ({unpaid.length})</h4>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {unpaid.slice(0, 20).map((e: any) => (
                        <div key={e.id} className="bg-muted rounded-xl px-3 py-1.5 text-xs text-foreground flex justify-between">
                          <span>{e.earning_type === "plan_fee" ? "Mensalidade" : e.earning_type === "commission_split" ? "Comissão" : "Entrega"}</span>
                          <span className="font-bold">{formatBRL(Number(e.amount))}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  {totalUnpaid > 0 && (
                    <button onClick={() => handleMarkPaid(mod.id)} disabled={markingPaid === mod.id}
                      className="flex-1 bg-accent text-accent-foreground py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5">
                      {markingPaid === mod.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="h-4 w-4" /> Pagar ({formatBRL(totalUnpaid)})</>}
                    </button>
                  )}
                  <button onClick={() => generateWhatsAppReport(mod)} className="bg-muted text-muted-foreground py-2 px-4 rounded-xl text-sm font-bold flex items-center gap-1.5">
                    <Copy className="h-4 w-4" /> Relatório
                  </button>
                  <button onClick={() => handleToggleActive(mod)} className="bg-muted text-muted-foreground py-2 px-4 rounded-xl text-sm font-bold">
                    {mod.is_active ? "Desativar" : "Ativar"}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {(!moderators || moderators.length === 0) && (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-bold">Nenhum moderador cadastrado</p>
          <p className="text-sm">Clique em "Novo Moderador" para começar.</p>
        </div>
      )}
    </div>
  );
};

export default ModeratorManager;
