import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users, Plus, Copy, CheckCircle2, DollarSign, Store, Loader2, Eye, EyeOff, Trash2, Percent } from "lucide-react";
import { formatBRL } from "@/lib/utils";

const ModeratorManager = () => {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [planFeePercent, setPlanFeePercent] = useState(40);
  const [deliverySplit, setDeliverySplit] = useState(1);
  const [commissionSplitPercent, setCommissionSplitPercent] = useState(2);
  const [saving, setSaving] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [expandedMod, setExpandedMod] = useState<string | null>(null);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);

  const { data: moderators, isLoading } = useQuery({
    queryKey: ["moderators"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("moderators" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: referrals } = useQuery({
    queryKey: ["moderator-referrals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("moderator_referrals" as any)
        .select("*, stores:store_id(name, id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: earnings } = useQuery({
    queryKey: ["moderator-earnings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("moderator_earnings" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const generateCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "MOD-";
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  };

  const handleAdd = async () => {
    if (!name.trim()) { toast.error("Nome é obrigatório"); return; }
    setSaving(true);
    try {
      const code = generateCode();
      const { error } = await supabase.from("moderators" as any).insert({
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        referral_code: code,
        plan_fee_percent: planFeePercent,
        delivery_split: deliverySplit,
        commission_split_percent: commissionSplitPercent,
      });
      if (error) throw error;
      toast.success(`Moderador "${name}" criado! Código: ${code}`);
      setName(""); setEmail(""); setPhone("");
      setPlanFeePercent(40); setDeliverySplit(1); setCommissionSplitPercent(2);
      setShowAdd(false);
      queryClient.invalidateQueries({ queryKey: ["moderators"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar moderador");
    } finally {
      setSaving(false);
    }
  };

  const copyLink = (code: string) => {
    const url = `${window.location.origin}/cadastro-lojista?ref=${code}`;
    navigator.clipboard.writeText(url);
    setCopiedCode(code);
    toast.success("Link de referência copiado!");
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const getModEarnings = (modId: string) => {
    const modEarnings = earnings?.filter((e: any) => e.moderator_id === modId) || [];
    const unpaid = modEarnings.filter((e: any) => !e.is_paid);
    const totalUnpaid = unpaid.reduce((sum: number, e: any) => sum + Number(e.amount), 0);
    const totalPaid = modEarnings.filter((e: any) => e.is_paid).reduce((sum: number, e: any) => sum + Number(e.amount), 0);
    const totalAll = modEarnings.reduce((sum: number, e: any) => sum + Number(e.amount), 0);
    return { unpaid, totalUnpaid, totalPaid, totalAll, all: modEarnings };
  };

  const getModReferrals = (modId: string) => {
    return referrals?.filter((r: any) => r.moderator_id === modId) || [];
  };

  const handleMarkPaid = async (modId: string) => {
    setMarkingPaid(modId);
    try {
      const { error } = await supabase
        .from("moderator_earnings" as any)
        .update({ is_paid: true, paid_at: new Date().toISOString() })
        .eq("moderator_id", modId)
        .eq("is_paid", false);
      if (error) throw error;
      toast.success("Ganhos marcados como pagos!");
      queryClient.invalidateQueries({ queryKey: ["moderator-earnings"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setMarkingPaid(null);
    }
  };

  const handleToggleActive = async (mod: any) => {
    try {
      const { error } = await supabase
        .from("moderators" as any)
        .update({ is_active: !mod.is_active })
        .eq("id", mod.id);
      if (error) throw error;
      toast.success(mod.is_active ? "Moderador desativado" : "Moderador ativado");
      queryClient.invalidateQueries({ queryKey: ["moderators"] });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const generateWhatsAppReport = (mod: any) => {
    const { totalUnpaid, totalPaid, totalAll, unpaid } = getModEarnings(mod.id);
    const modRefs = getModReferrals(mod.id);
    
    let msg = `💼 *Relatório Moderador - ${mod.name}*\n\n`;
    msg += `📊 Lojas indicadas: ${modRefs.length}\n`;
    msg += `💰 Total ganho: ${formatBRL(totalAll)}\n`;
    msg += `✅ Já pago: ${formatBRL(totalPaid)}\n`;
    msg += `⏳ Pendente: ${formatBRL(totalUnpaid)}\n\n`;
    
    if (unpaid.length > 0) {
      msg += `📋 *Detalhes pendentes:*\n`;
      const planFees = unpaid.filter((e: any) => e.earning_type === "plan_fee");
      const commSplits = unpaid.filter((e: any) => e.earning_type === "commission_split");
      const delSplits = unpaid.filter((e: any) => e.earning_type === "delivery_split");
      
      if (planFees.length > 0) {
        const total = planFees.reduce((s: number, e: any) => s + Number(e.amount), 0);
        msg += `• Mensalidades: ${formatBRL(total)} (${planFees.length}x)\n`;
      }
      if (commSplits.length > 0) {
        const total = commSplits.reduce((s: number, e: any) => s + Number(e.amount), 0);
        msg += `• Comissão pedidos: ${formatBRL(total)} (${commSplits.length}x)\n`;
      }
      if (delSplits.length > 0) {
        const total = delSplits.reduce((s: number, e: any) => s + Number(e.amount), 0);
        msg += `• Taxa entrega: ${formatBRL(total)} (${delSplits.length}x)\n`;
      }
    }
    
    navigator.clipboard.writeText(msg);
    toast.success("Relatório copiado!");
  };

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" /> Moderadores / Afiliados
        </h2>
        <button onClick={() => setShowAdd(!showAdd)} className="bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5">
          <Plus className="h-4 w-4" /> Novo Moderador
        </button>
      </div>

      {showAdd && (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <h3 className="font-bold text-sm text-foreground">Adicionar Moderador</h3>
          <input placeholder="Nome *" value={name} onChange={e => setName(e.target.value)} className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-sm text-foreground" />
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} className="bg-muted border border-border rounded-xl px-3 py-2 text-sm text-foreground" />
            <input placeholder="Telefone" value={phone} onChange={e => setPhone(e.target.value)} className="bg-muted border border-border rounded-xl px-3 py-2 text-sm text-foreground" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">% Mensalidade</label>
              <input type="number" value={planFeePercent} onChange={e => setPlanFeePercent(Number(e.target.value))} className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-sm text-foreground" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">R$ Entrega</label>
              <input type="number" step="0.5" value={deliverySplit} onChange={e => setDeliverySplit(Number(e.target.value))} className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-sm text-foreground" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">% Comissão</label>
              <input type="number" step="0.5" value={commissionSplitPercent} onChange={e => setCommissionSplitPercent(Number(e.target.value))} className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-sm text-foreground" />
            </div>
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">Exemplos por plano:</p>
            <p>📋 <strong>Essencial</strong> R$180/mês → moderador recebe {planFeePercent}% = {formatBRL(180 * planFeePercent / 100)} + R${deliverySplit.toFixed(2)}/entrega</p>
            <p>📈 <strong>Crescimento</strong> R$100/mês + 2.5% → moderador recebe {planFeePercent}% = {formatBRL(100 * planFeePercent / 100)} + {commissionSplitPercent}% do pedido + R${deliverySplit.toFixed(2)}/entrega</p>
            <p>💰 <strong>Comissão</strong> 5% → moderador recebe {commissionSplitPercent}% do pedido</p>
          </div>
          <button onClick={handleAdd} disabled={saving} className="bg-primary text-primary-foreground px-6 py-2 rounded-xl text-sm font-bold w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Criar Moderador"}
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-2xl p-3 text-center">
          <p className="text-xs text-muted-foreground">Total Moderadores</p>
          <p className="text-xl font-bold text-foreground">{moderators?.length || 0}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-3 text-center">
          <p className="text-xs text-muted-foreground">Lojas Indicadas</p>
          <p className="text-xl font-bold text-foreground">{referrals?.length || 0}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-3 text-center">
          <p className="text-xs text-muted-foreground">A Pagar</p>
          <p className="text-xl font-bold text-destructive">
            {formatBRL(earnings?.filter((e: any) => !e.is_paid).reduce((s: number, e: any) => s + Number(e.amount), 0) || 0)}
          </p>
        </div>
      </div>

      {/* Moderator List */}
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
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${mod.is_active ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>
                    {mod.is_active ? "Ativo" : "Inativo"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {mod.email || mod.phone || "Sem contato"} · {modRefs.length} lojas · Código: <span className="font-mono font-bold">{mod.referral_code}</span>
                </p>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-xs text-muted-foreground">Pendente: <span className="font-bold text-destructive">{formatBRL(totalUnpaid)}</span></span>
                  <span className="text-xs text-muted-foreground">Total: <span className="font-bold text-foreground">{formatBRL(totalAll)}</span></span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={(e) => { e.stopPropagation(); copyLink(mod.referral_code); }}
                  className="bg-muted text-muted-foreground p-2 rounded-xl">
                  {copiedCode === mod.referral_code ? <CheckCircle2 className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
                </button>
                {isExpanded ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
              </div>
            </div>

            {isExpanded && (
              <div className="border-t border-border p-4 space-y-4">
                {/* Config */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-muted rounded-xl p-2">
                    <p className="text-[10px] text-muted-foreground">% Mensalidade</p>
                    <p className="font-bold text-sm text-foreground">{mod.plan_fee_percent}%</p>
                  </div>
                  <div className="bg-muted rounded-xl p-2">
                    <p className="text-[10px] text-muted-foreground">R$ Entrega</p>
                    <p className="font-bold text-sm text-foreground">R${Number(mod.delivery_split).toFixed(2)}</p>
                  </div>
                  <div className="bg-muted rounded-xl p-2">
                    <p className="text-[10px] text-muted-foreground">% Comissão</p>
                    <p className="font-bold text-sm text-foreground">{mod.commission_split_percent}%</p>
                  </div>
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

                {/* Unpaid Earnings */}
                {unpaid.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-muted-foreground mb-1.5 flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" /> Pendentes ({unpaid.length})</h4>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {unpaid.slice(0, 20).map((e: any) => (
                        <div key={e.id} className="bg-muted rounded-xl px-3 py-1.5 text-xs text-foreground flex justify-between">
                          <span>{e.earning_type === "plan_fee" ? "Mensalidade" : e.earning_type === "commission_split" ? "Comissão pedido" : "Taxa entrega"}</span>
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
                      {markingPaid === mod.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="h-4 w-4" /> Marcar Pago ({formatBRL(totalUnpaid)})</>}
                    </button>
                  )}
                  <button onClick={() => generateWhatsAppReport(mod)}
                    className="bg-muted text-muted-foreground py-2 px-4 rounded-xl text-sm font-bold flex items-center gap-1.5">
                    <Copy className="h-4 w-4" /> Relatório
                  </button>
                  <button onClick={() => handleToggleActive(mod)}
                    className="bg-muted text-muted-foreground py-2 px-4 rounded-xl text-sm font-bold">
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
