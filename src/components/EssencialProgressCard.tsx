import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import { TrendingUp, PartyPopper } from "lucide-react";

const THRESHOLD = 5000;
const WINDOW_DAYS = 60;
const UPGRADE_FEE = 180;

interface Props {
  store: any;
  storePlan: any;
}

export default function EssencialProgressCard({ store, storePlan }: Props) {
  // Só para Essencial grátis (fixed + fee=0)
  const eligible =
    storePlan?.planType === "fixed" &&
    Number(storePlan?.monthlyFee || 0) === 0 &&
    !storePlan?.isVip &&
    !storePlan?.isEssencialLifetimeFree &&
    !storePlan?.isInTrial;

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
        .select("essencial_upgrade_scheduled_at")
        .eq("store_id", store.id)
        .eq("is_active", true)
        .maybeSingle();
      return { gmv, scheduledAt: (plan as any)?.essencial_upgrade_scheduled_at as string | null };
    },
    enabled: eligible && !!store?.id,
    staleTime: 60_000,
  });

  if (!eligible || !data) return null;

  const pct = Math.min(100, (data.gmv / THRESHOLD) * 100);
  const remaining = Math.max(0, THRESHOLD - data.gmv);
  const scheduled = data.scheduledAt ? new Date(data.scheduledAt) : null;

  if (scheduled && scheduled.getTime() > Date.now()) {
    const label = scheduled.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
    return (
      <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <PartyPopper className="h-5 w-5 text-amber-600" />
          <div className="font-black text-foreground">Parabéns! Você bateu R$ 5.000</div>
        </div>
        <p className="text-sm text-muted-foreground">
          A partir de <b className="text-foreground">{label}</b> sua mensalidade ItaSuper será de{" "}
          <b className="text-foreground">{formatBRL(UPGRADE_FEE)}/mês</b>. Você tem 7 dias para se preparar — nenhuma cobrança será feita antes disso.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-primary" />
        <div className="font-bold text-foreground text-sm">Progresso Essencial (últimos {WINDOW_DAYS} dias)</div>
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
          <>Faltam <b className="text-foreground">{formatBRL(remaining)}</b> para sua mensalidade virar <b className="text-foreground">{formatBRL(UPGRADE_FEE)}/mês</b> (com 7 dias de aviso antes).</>
        ) : (
          <>Você atingiu R$ 5.000 — em breve o upgrade será agendado.</>
        )}
      </p>
    </div>
  );
}