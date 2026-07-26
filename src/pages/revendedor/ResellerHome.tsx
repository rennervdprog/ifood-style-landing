import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import BottomNav from "@/components/BottomNav";
import { useResellerDashboard, brl } from "./useResellerDashboard";
import { AppIcon } from "@/components/ui/app-icon";
import { Copy, Share2, Users, Wallet, TrendingUp, ArrowRight, Loader2, Info, Clock } from "lucide-react";
import {
  getReferralEarningStage,
  RECURRING_STARTS_TOOLTIP,
  FREE_GMV_EXPLAINER,
} from "@/lib/resellerEarnings";

export default function ResellerHome() {
  const navigate = useNavigate();
  const { data, isLoading } = useResellerDashboard();

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <AppIcon name="Loader2" className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!data?.registered) {
    // Não deveria acontecer (useIsReseller já filtrou), mas fallback:
    navigate("/revendedor", { replace: true });
    return null;
  }

  const r = data.reseller!;
  const s = data.stats!;
  const stores = data.stores || [];
  const link = `${window.location.origin}/cadastro-lojista?ref=${r.code}`;
  const available =
    s.balance_pending_cents + s.balance_paid_cents - s.withdrawn_cents - s.pending_withdrawal_cents;

  const awaitingActivation = stores.filter(
    (st) => getReferralEarningStage(st) === "bounty_paid_free_tier"
  ).length;

  const copy = () => {
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  };
  const share = () => {
    const msg = `Conheça o ItaSuper — plataforma de delivery próprio pra sua loja. Grátis até R$ 5.000/mês de vendas. Cadastre-se pelo meu link: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <div className="min-h-dvh bg-background pb-24">
      <header className="sticky top-0 z-30 bg-card/80 backdrop-blur-xl border-b border-border/50">
        <div className="px-4 h-14 flex items-center justify-between">
          <div>
            <h1 className="text-base font-black tracking-tight">Painel do Revendedor</h1>
            <p className="text-[10px] text-muted-foreground">
              Código <span className="font-mono font-semibold">{r.code}</span>
              {" · "}
              <span className={
                r.status === "approved" ? "text-green-600" :
                r.status === "pending" ? "text-amber-600" : "text-red-600"
              }>{r.status}</span>
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => navigate("/revendedor")}>
            Painel completo <AppIcon name="ArrowRight" className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 max-w-md mx-auto">
        {r.status === "pending" && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
            ⏳ Cadastro em análise — comissões só passam a ser creditadas após aprovação.
          </div>
        )}
        {r.status === "blocked" && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-3 text-xs">
            🚫 Conta bloqueada. Fale com o suporte.
          </div>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Seu link de indicação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="bg-muted/40 rounded-lg px-3 py-2 text-xs font-mono break-all">{link}</div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={copy} className="flex-1">
                <AppIcon name="Copy" className="h-3 w-3 mr-1" /> Copiar
              </Button>
              <Button size="sm" onClick={share} className="flex-1">
                <AppIcon name="Share2" className="h-3 w-3 mr-1" /> WhatsApp
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground leading-snug pt-1">
              {FREE_GMV_EXPLAINER}
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-2">
          <Card>
            <CardContent className="pt-4">
              <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                <AppIcon name="Users" className="h-3 w-3" /> Lojas ativas
              </div>
              <div className="text-xl font-black">{s.active_referrals}</div>
              <div className="text-[9px] text-muted-foreground">de {s.total_referrals} indicadas</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1 cursor-help">
                      <AppIcon name="Wallet" className="h-3 w-3" /> Disponível
                      <AppIcon name="Info" className="h-2.5 w-2.5 opacity-60" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[220px] text-[11px]">
                    {RECURRING_STARTS_TOOLTIP}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <div className="text-xl font-black text-amber-600">{brl(Math.max(0, available))}</div>
              <div className="text-[9px] text-muted-foreground">Mês: {brl(s.earnings_this_month_cents)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                <AppIcon name="TrendingUp" className="h-3 w-3" /> Comissão MRR
              </div>
              <div className="text-xl font-black">{(r.commission_rate * 100).toFixed(0)}%</div>
              <div className="text-[9px] text-muted-foreground">após loja pagar plano</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                <AppIcon name="Clock" className="h-3 w-3" /> Aguardando ativação
              </div>
              <div className="text-xl font-black text-blue-600">{awaitingActivation}</div>
              <div className="text-[9px] text-muted-foreground">lojas em fase gratuita</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-sm">Últimas lojas indicadas</CardTitle>
            <Button size="sm" variant="ghost" onClick={() => navigate("/pedidos")}>
              Ver todas
            </Button>
          </CardHeader>
          <CardContent>
            {stores.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                Nenhuma loja ainda. Compartilhe seu link acima!
              </p>
            ) : (
              <div className="space-y-1">
                {stores.slice(0, 3).map((st) => (
                  <div key={st.store_id} className="flex justify-between items-center py-1.5 border-b last:border-0">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{st.name}</div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {st.plan_type || "—"} · {brl(st.commissions_total_cents)} gerado
                      </div>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                      st.referral_status === "active" ? "bg-green-500/10 text-green-600" :
                      st.referral_status === "churned" ? "bg-red-500/10 text-red-600" :
                      "bg-muted text-muted-foreground"
                    }`}>{st.referral_status}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Como funciona</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1.5">
            <p>• Toda loja cadastrada pelo seu link fica <strong>vinculada permanentemente</strong> à sua conta.</p>
            <p>• Bônus de <strong>R$ 50</strong> por loja que ativa e completa 20 pedidos.</p>
            <p>• <strong>{(r.commission_rate * 100).toFixed(0)}% da mensalidade</strong> a partir do mês em que a loja passa do GMV gratuito (R$ 5.000 no Essencial · R$ 2.500 na Autonomia).</p>
            <p>• Enquanto a loja estiver em fase gratuita, a mensalidade é R$ 0 — a comissão recorrente também.</p>
            <p>• Se a loja cancelar, a comissão daquele mês encerra automaticamente.</p>
          </CardContent>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
}