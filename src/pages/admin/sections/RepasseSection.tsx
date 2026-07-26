import { Banknote, CheckCircle2, Crown, CalendarClock } from "lucide-react";
import RepasseAlert from "@/components/repasse/RepasseAlert";
import RepassePendingCharges from "@/components/RepassePendingCharges";
import { formatBRL } from "@/lib/utils";
import { usePendingRepasse } from "@/hooks/usePendingRepasse";
import { REPASSE_RULES } from "@/lib/repasseRules";

interface Props {
  store: any;
  storePlan: any;
  setDashboardTab: (t: any) => void;
  pendingTotal: number;
}

export default function RepasseSection({ store, storePlan, setDashboardTab, pendingTotal }: Props) {
  // Fonte única do valor pendente e do estado de cobrança PIX ativa.
  const { total: hookTotal, hasPendingCharge } = usePendingRepasse(store?.id);
  const displayTotal = hookTotal || pendingTotal || 0;
  const showAlert = displayTotal > 0 && !hasPendingCharge;

  const planLabel =
    storePlan?.planType === "fixed" ? "Essencial" :
    storePlan?.planType === "supporter" ? "Apoiador" :
    storePlan?.planType === "autonomy" ? "Autonomia" :
    storePlan?.planType === "hybrid" ? "Crescimento" : "Comissão";

  const deliveryTxt =
    (storePlan?.platformDeliverySplit ?? 0) > 0
      ? `Entrega ${formatBRL(storePlan.platformDeliverySplit)}`
      : "Sem taxa de entrega";
  const pixTxt =
    storePlan?.isFixedPlan
      ? ((storePlan?.pixOperationalFee ?? 0) > 0
          ? `PIX ${formatBRL(storePlan.pixOperationalFee)}`
          : "PIX Grátis")
      : ((storePlan?.commissionRate ?? 0) > 0
          ? `Comissão ${storePlan.commissionRate}%`
          : "Sem comissão");

  // Previsão do próximo repasse semanal (toda segunda-feira)
  const nextMonday = (() => {
    const d = new Date();
    const day = d.getDay(); // 0=Dom .. 6=Sab
    const diff = day === 1 ? 7 : (8 - day) % 7 || 7;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  })();
  const daysUntil = Math.max(
    0,
    Math.ceil((nextMonday.getTime() - Date.now()) / 86400000),
  );
  const nextMondayLabel = nextMonday.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center">
          <Banknote className="h-5 w-5 text-blue-500" />
        </div>
        <div>
          <h2 className="text-lg font-black text-foreground tracking-tight">Repasse</h2>
          <p className="text-xs text-muted-foreground">
            {displayTotal > 0
              ? "Você tem valor acumulado a repassar à plataforma"
              : "Nenhum repasse pendente no momento"}
          </p>
        </div>
      </div>

      {/* 1. Cobrança PIX ativa — sempre no topo, ação mais urgente */}
      <RepassePendingCharges storeId={store.id} />

      {/* 2. Alerta unificado quando há saldo sem cobrança emitida */}
      {showAlert && (
        <RepasseAlert
          storeId={store.id}
          storeName={store.name}
          onGoToFinance={() => setDashboardTab("finance")}
        />
      )}

      {/* 3. Contexto do plano ativo — reflete VIP */}
      <div className="rounded-xl border border-border/60 bg-muted/30 p-3 flex items-center gap-2 flex-wrap">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Plano</span>
        <span className="text-sm font-bold text-foreground">{planLabel}</span>
        {storePlan?.isVip && (
          <span className="inline-flex items-center gap-1 text-[10px] font-black bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full">
            <Crown className="h-3 w-3" /> VIP
          </span>
        )}
        <span className="text-muted-foreground text-xs">·</span>
        <span className="text-xs text-foreground">{deliveryTxt}</span>
        <span className="text-muted-foreground text-xs">·</span>
        <span className="text-xs text-foreground">{pixTxt}</span>
      </div>

      {/* 4. Informativo — próximo repasse previsto (neutro, azul) */}
      <div className="rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
            <CalendarClock className="h-5 w-5 text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Próximo repasse previsto
            </p>
            <p className="text-sm font-bold text-foreground capitalize truncate">
              {nextMondayLabel}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {daysUntil === 0
                ? "Hoje é dia de repasse"
                : `Em ${daysUntil} dia${daysUntil > 1 ? "s" : ""} · Repasses são processados toda segunda-feira`}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Acumulado
            </p>
            <p className={`text-base font-black ${displayTotal > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
              {formatBRL(displayTotal)}
            </p>
          </div>
        </div>
      </div>

      {displayTotal <= 0 && !hasPendingCharge && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 flex items-center justify-center mb-4">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          </div>
          <h3 className="font-black text-foreground mb-1">Sem pendências de repasse</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Quando houver saldo acumulado (delivery, comissão do plano ou PDV), ele aparecerá aqui.
            Cobrança automática toda segunda a partir de {formatBRL(REPASSE_RULES.MIN_AUTO_CHARGE_BRL)}.
          </p>
        </div>
      )}
    </div>
  );
}