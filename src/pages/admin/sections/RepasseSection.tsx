import { Banknote, CheckCircle2, Crown } from "lucide-react";
import CommissionAlert from "@/components/CommissionAlert";
import PlatformSplitAlert from "@/components/PlatformSplitAlert";
import RepassePendingCharges from "@/components/RepassePendingCharges";
import { formatBRL } from "@/lib/utils";

interface Props {
  store: any;
  storePlan: any;
  setDashboardTab: (t: any) => void;
  pendingTotal: number;
}

export default function RepasseSection({ store, storePlan, setDashboardTab, pendingTotal }: Props) {
  const showCommission = !!storePlan?.hasCommission;
  const showSplit =
    !storePlan?.hasCommission &&
    !!storePlan?.isItatingaFixed &&
    (storePlan?.platformDeliverySplit || 0) > 0;

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

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center">
          <Banknote className="h-5 w-5 text-blue-500" />
        </div>
        <div>
          <h2 className="text-lg font-black text-foreground tracking-tight">Repasse da Plataforma</h2>
          <p className="text-xs text-muted-foreground">
            {pendingTotal > 0
              ? "Você tem valor acumulado a repassar"
              : "Nenhum repasse pendente no momento"}
          </p>
        </div>
      </div>

      {/* Contexto do plano ativo — reflete VIP */}
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

      {pendingTotal <= 0 && !showCommission && !showSplit && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 flex items-center justify-center mb-4">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          </div>
          <h3 className="font-black text-foreground mb-1">Sem pendências de repasse</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Quando houver saldo acumulado com a plataforma (delivery, comissão ou PDV), ele aparecerá aqui.
          </p>
        </div>
      )}

      {showCommission && (
        <CommissionAlert
          storeId={store.id}
          storeName={store.name}
          onGoToFinance={() => setDashboardTab("finance")}
        />
      )}

      {showSplit && (
        <PlatformSplitAlert
          storeId={store.id}
          storeName={store.name}
          splitPerOrder={storePlan.platformDeliverySplit}
          onGoToFinance={() => setDashboardTab("finance")}
        />
      )}

      <RepassePendingCharges storeId={store.id} />
    </div>
  );
}