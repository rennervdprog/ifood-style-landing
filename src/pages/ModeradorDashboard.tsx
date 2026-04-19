import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { formatBRL } from "@/lib/utils";
import { DollarSign, Store, TrendingUp, Clock, CheckCircle2, Copy, Loader2, LogOut, Users } from "lucide-react";
import { toast } from "sonner";
import AppHeader from "@/components/AppHeader";

const ModeradorDashboard = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [linking, setLinking] = useState(false);

  // Try to find & auto-link moderator by email
  const { data: moderator, isLoading: modLoading, refetch: refetchMod } = useQuery({
    queryKey: ["my-moderator", user?.id],
    queryFn: async () => {
      if (!user) return null;

      // First check by user_id
      const { data: byUserId } = await (supabase as any)
        .from("moderators")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (byUserId) return byUserId;

      // Try auto-link by email
      if (user.email) {
        const { data: byEmail } = await (supabase as any)
          .from("moderators")
          .select("*")
          .eq("email", user.email)
          .is("user_id", null)
          .eq("is_active", true)
          .maybeSingle();

        if (byEmail) {
          setLinking(true);
          await (supabase as any)
            .from("moderators")
            .update({ user_id: user.id })
            .eq("id", byEmail.id);
          setLinking(false);
          return { ...byEmail, user_id: user.id };
        }
      }

      return null;
    },
    enabled: !!user && !authLoading,
  });

  const { data: referrals } = useQuery({
    queryKey: ["my-mod-referrals", moderator?.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("moderator_referrals")
        .select("*, stores:store_id(name, id)")
        .eq("moderator_id", moderator.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!moderator?.id,
  });

  const { data: earnings } = useQuery({
    queryKey: ["my-mod-earnings", moderator?.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("moderator_earnings")
        .select("*")
        .eq("moderator_id", moderator.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!moderator?.id,
  });

  const unpaid = earnings?.filter((e: any) => !e.is_paid) || [];
  const paid = earnings?.filter((e: any) => e.is_paid) || [];
  const totalUnpaid = unpaid.reduce((s: number, e: any) => s + Number(e.amount), 0);
  const totalPaid = paid.reduce((s: number, e: any) => s + Number(e.amount), 0);
  const totalAll = (earnings || []).reduce((s: number, e: any) => s + Number(e.amount), 0);

  const copyLink = () => {
    if (!moderator?.referral_code) return;
    const url = `${window.location.origin}/cadastro-lojista?ref=${moderator.referral_code}`;
    navigator.clipboard.writeText(url);
    toast.success("Link de indicação copiado!");
  };

  if (authLoading || modLoading || linking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <Users className="h-16 w-16 text-muted-foreground mb-4 opacity-30" />
        <h1 className="text-xl font-black text-foreground mb-2">Painel do Moderador</h1>
        <p className="text-sm text-muted-foreground mb-6">Faça login para acessar seu painel.</p>
        <button onClick={() => navigate("/auth")} className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold">
          Entrar
        </button>
      </div>
    );
  }

  if (!moderator) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <Users className="h-16 w-16 text-muted-foreground mb-4 opacity-30" />
        <h1 className="text-xl font-black text-foreground mb-2">Acesso Não Encontrado</h1>
        <p className="text-sm text-muted-foreground mb-2">
          Nenhum perfil de moderador vinculado a este e-mail.
        </p>
        <p className="text-xs text-muted-foreground mb-6">
          Entre em contato com o administrador para ser cadastrado como moderador.
        </p>
        <button onClick={() => navigate("/")} className="bg-muted text-muted-foreground px-6 py-3 rounded-xl font-bold">
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      <AppHeader />
      <div className="max-w-lg mx-auto px-4 pt-4 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-foreground">Olá, {moderator.name} 👋</h1>
            <p className="text-xs text-muted-foreground">Painel do Moderador</p>
          </div>
          <SignOutConfirm
            triggerClassName="bg-muted text-muted-foreground p-2 rounded-xl hover:bg-destructive/10 hover:text-destructive transition-colors"
            triggerTitle="Sair"
          />
        </div>

        {/* Referral Link */}
        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4">
          <p className="text-xs font-bold text-primary mb-2">🔗 Seu Link de Indicação</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-background text-foreground text-xs px-3 py-2 rounded-xl truncate border border-border">
              {window.location.origin}/cadastro-lojista?ref={moderator.referral_code}
            </code>
            <button onClick={copyLink} className="bg-primary text-primary-foreground p-2 rounded-xl shrink-0">
              <Copy className="h-4 w-4" />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            Código: <span className="font-mono font-bold">{moderator.referral_code}</span>
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <Store className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-black text-foreground">{referrals?.length || 0}</p>
            <p className="text-xs text-muted-foreground">Lojas Indicadas</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <TrendingUp className="h-5 w-5 text-accent mx-auto mb-1" />
            <p className="text-2xl font-black text-foreground">{formatBRL(totalAll)}</p>
            <p className="text-xs text-muted-foreground">Total Ganho</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <Clock className="h-5 w-5 text-destructive mx-auto mb-1" />
            <p className="text-2xl font-black text-destructive">{formatBRL(totalUnpaid)}</p>
            <p className="text-xs text-muted-foreground">Pendente</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <CheckCircle2 className="h-5 w-5 text-accent mx-auto mb-1" />
            <p className="text-2xl font-black text-foreground">{formatBRL(totalPaid)}</p>
            <p className="text-xs text-muted-foreground">Já Recebido</p>
          </div>
        </div>

        {/* Commission Config */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="text-sm font-bold text-foreground mb-3">📊 Suas Taxas</h3>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-muted rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground">% Mensalidade</p>
              <p className="text-lg font-black text-foreground">{moderator.plan_fee_percent}%</p>
            </div>
            <div className="bg-muted rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground">R$ Entrega</p>
              <p className="text-lg font-black text-foreground">R${Number(moderator.delivery_split).toFixed(2)}</p>
            </div>
            <div className="bg-muted rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground">% Comissão</p>
              <p className="text-lg font-black text-foreground">{moderator.commission_split_percent}%</p>
            </div>
          </div>
        </div>

        {/* Referred Stores */}
        {referrals && referrals.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <Store className="h-4 w-4 text-primary" /> Lojas Indicadas
            </h3>
            <div className="space-y-2">
              {referrals.map((ref: any) => (
                <div key={ref.id} className="bg-muted rounded-xl px-4 py-2.5 flex items-center gap-2">
                  <Store className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm text-foreground font-medium truncate">{ref.stores?.name || "Loja removida"}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Earnings History */}
        {earnings && earnings.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-accent" /> Histórico de Ganhos
            </h3>
            <div className="max-h-60 overflow-y-auto space-y-1.5">
              {earnings.slice(0, 30).map((e: any) => (
                <div key={e.id} className="bg-muted rounded-xl px-4 py-2 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-foreground font-medium">
                      {e.earning_type === "plan_fee" ? "📋 Mensalidade" : e.earning_type === "commission_split" ? "💰 Comissão pedido" : "🛵 Taxa entrega"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(e.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-foreground">{formatBRL(Number(e.amount))}</p>
                    <span className={`text-[10px] font-bold ${e.is_paid ? "text-accent" : "text-destructive"}`}>
                      {e.is_paid ? "Pago" : "Pendente"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(!earnings || earnings.length === 0) && (
          <div className="text-center py-8 text-muted-foreground">
            <DollarSign className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-bold">Nenhum ganho ainda</p>
            <p className="text-xs">Compartilhe seu link para começar a ganhar!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModeradorDashboard;
