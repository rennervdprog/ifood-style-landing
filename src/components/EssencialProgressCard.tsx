import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import { TrendingUp, PartyPopper, Check, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";

const WINDOW_DAYS = 60;

// Config por plano: threshold de GMV (60 dias) → fee de upgrade.
// Reaproveita as mesmas colunas `essencial_upgrade_*` e o mesmo cron.
const PLAN_CONFIG: Record<string, { threshold: number; upgradeFee: number; planName: string }> = {
  fixed:    { threshold: 5000, upgradeFee: 180,    planName: "Essencial" },
  autonomy: { threshold: 2500, upgradeFee: 239.90, planName: "Autonomia" },
};

interface Props {
  store: any;
  storePlan: any;
}

export default function EssencialProgressCard({ store, storePlan }: Props) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const cfg = PLAN_CONFIG[storePlan?.planType as string];
  // Elegível para o card dinâmico: planos Essencial/Autonomia na entrada grátis.
  const eligible =
    !!cfg &&
    Number(storePlan?.monthlyFee || 0) === 0 &&
    !storePlan?.isVip &&
    !storePlan?.isEssencialLifetimeFree &&
    !storePlan?.isInTrial;

  const THRESHOLD = cfg?.threshold ?? 5000;
  const UPGRADE_FEE = cfg?.upgradeFee ?? 180;
  const PLAN_NAME = cfg?.planName ?? "Essencial";

  const { data } = useQuery({
    queryKey: ["essencial-progress", store?.id],
    queryFn: async () => {
      const since = new Date(Date.now() - WINDOW_DAYS * 86400_000).toISOString();
      const { data: orders } = await supabase
        .from("orders")
        .select("total_price")
        .eq("store_id", store.id)
        .in("status", ["entregue", "finalizado"])
        .gte("created_at", since);
      const gmv = (orders || []).reduce((s, o: any) => s + Number(o.total_price || 0), 0);
      const { data: plan } = await supabase
        .from("store_plans")
        .select("essencial_upgrade_scheduled_at, essencial_upgrade_response")
        .eq("store_id", store.id)
        .eq("is_active", true)
        .maybeSingle();
      return {
        gmv,
        scheduledAt: (plan as any)?.essencial_upgrade_scheduled_at as string | null,
        response: (plan as any)?.essencial_upgrade_response as string | null,
      };
    },
    enabled: eligible && !!store?.id,
    staleTime: 60_000,
  });

  if (!eligible || !data) return null;

  const pct = Math.min(100, (data.gmv / THRESHOLD) * 100);
  const remaining = Math.max(0, THRESHOLD - data.gmv);
  const scheduled = data.scheduledAt ? new Date(data.scheduledAt) : null;

  async function respond(response: "accepted" | "refused") {
    setSaving(true);
    const { data: res, error } = await supabase.rpc("respond_essencial_upgrade" as any, { _response: response });
    setSaving(false);
    if (error || (res as any)?.error) {
      const msg = error?.message || (res as any)?.error || "erro desconhecido";
      console.error("[respond_essencial_upgrade]", { error, res });
      toast.error(`Não foi possível registrar: ${msg}`);
      return;
    }
    toast.success(response === "accepted" ? "Upgrade aceito. Obrigado!" : "Upgrade recusado. Nenhuma cobrança será feita.");
    qc.invalidateQueries({ queryKey: ["essencial-progress", store?.id] });
  }

  if (data.response === "refused") {
    return (
      <div className="rounded-2xl border-2 border-destructive/60 bg-gradient-to-br from-destructive/15 to-destructive/5 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive animate-pulse" />
          <div className="font-black text-destructive">Loja suspensa</div>
        </div>
        <p className="text-sm text-foreground">
          Sua loja ultrapassou {formatBRL(THRESHOLD)} em vendas e a mensalidade do plano {PLAN_NAME} (<b>{formatBRL(UPGRADE_FEE)}/mês</b>) passou a ser devida. Como o upgrade foi recusado, a loja está <b>inativa</b> — vitrine, cardápio e novos pedidos estão bloqueados.
        </p>
        <p className="text-xs text-muted-foreground">
          Conforme os Termos de Uso (5.2), não há retorno ao plano gratuito. Para reativar, aceite a mensalidade abaixo.
        </p>
        <Button size="sm" disabled={saving} onClick={() => respond("accepted")} className="w-full gap-1">
          <Check className="h-4 w-4" /> Aceitar mensalidade e reativar loja
        </Button>
      </div>
    );
  }

  if (scheduled) {
    const label = scheduled.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
    const accepted = data.response === "accepted";
    return (
      <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <PartyPopper className="h-5 w-5 text-amber-600" />
          <div className="font-black text-foreground">Upgrade {PLAN_NAME} disponível</div>
        </div>
        <p className="text-sm text-muted-foreground">
          Você bateu {formatBRL(THRESHOLD)} em vendas nos últimos {WINDOW_DAYS} dias. Conforme os Termos de Uso, o plano {PLAN_NAME} pago (<b className="text-foreground">{formatBRL(UPGRADE_FEE)}/mês</b>) pode ser ativado a partir de <b className="text-foreground">{label}</b> — mas <b className="text-foreground">apenas com o seu consentimento expresso</b>.
        </p>
        <p className="text-xs text-destructive font-semibold">
          ⚠️ Se você recusar (ou não responder até {label}), a loja será <b>suspensa</b> até aceitar. Não há retorno ao plano gratuito.
        </p>
        {accepted ? (
          <div className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
            <Check className="h-4 w-4" /> Upgrade aceito. Cobrança será gerada em {label}.
          </div>
        ) : (
          <div className="flex gap-2 pt-1">
            <Button size="sm" disabled={saving} onClick={() => respond("accepted")} className="flex-1 gap-1">
              <Check className="h-4 w-4" /> Aceitar upgrade
            </Button>
            <Button size="sm" variant="outline" disabled={saving} onClick={() => respond("refused")} className="flex-1 gap-1">
              <X className="h-4 w-4" /> Recusar
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-primary" />
        <div className="font-bold text-foreground text-sm">Progresso {PLAN_NAME} (últimos {WINDOW_DAYS} dias)</div>
      </div>
      <div className="flex items-baseline justify-between">
        <div className="text-2xl font-black tabular-nums">{formatBRL(data.gmv)}</div>
        <div className="text-xs text-muted-foreground">de {formatBRL(THRESHOLD)}</div>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">
        {remaining > 0 ? (
          <>Faltam <b className="text-foreground">{formatBRL(remaining)}</b> para o plano {PLAN_NAME} pago (<b className="text-foreground">{formatBRL(UPGRADE_FEE)}/mês</b>) ficar disponível — com 30 dias de aviso e consentimento expresso antes de qualquer cobrança.</>
        ) : (
          <>Você atingiu {formatBRL(THRESHOLD)} — em breve o upgrade será agendado.</>
        )}
      </p>
    </div>
  );
}