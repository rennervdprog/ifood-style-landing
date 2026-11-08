// Fase 4 da reorganização do painel (2026-11-08) — cópia Reorg, SOMENTE /admin-teste.
import { Banknote, CheckCircle2, Crown, Info } from "lucide-react";
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

export default function RepasseSectionReorg({ store, storePlan, setDashboardTab, pendingTotal }: Props) {
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

      <p className="text-sm text-muted-foreground">
        O que sua loja deve repassar ao ItaSuper e quando a cobrança acontece
      </p>

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
        <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Plano</span>
        <span className="text-sm font-bold text-foreground">{planLabel}</span>
        {storePlan?.isVip && (
          <span className="inline-flex items-center gap-1 text-xs font-black bg-primary/15 text-primary dark:text-primary border border-primary/30 px-1.5 py-0.5 rounded-full">
            <Crown className="h-3 w-3" /> VIP
          </span>
        )}
        <span className="text-muted-foreground text-xs">·</span>
        <span className="text-xs text-foreground">{deliveryTxt}</span>
        <span className="text-muted-foreground text-xs">·</span>
        <span className="text-xs text-foreground">{pixTxt}</span>
      </div>

      {/* Como funciona — recolhido (Fase 4 Reorg): a tela mostra 1 card de ação por vez */}
      <details className="rounded-2xl border border-border bg-card p-4">
        <summary className="flex cursor-pointer items-center gap-3 text-sm font-bold text-foreground">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 shrink-0">
            <Info className="h-4 w-4 text-primary" />
          </span>
          Como funciona o repasse
        </summary>
        <p className="text-sm text-muted-foreground mt-2">
          Durante a semana, tudo que você vende fica com você — só junta a parte do ItaSuper
          (R$ 0,99 por entrega + R$ 1,99 por pedido em PIX). Toda segunda-feira, se o acumulado
          passou de R$ 150, geramos o PIX pra você quitar. Se a segunda chegar com o saldo
          acima de R$ 500 e ele não for quitado, as vendas pausam até o pagamento. Cobrança
          sem pagar por 30 dias também pausa. Pagou, volta na hora. Hoje sua loja tem{" "}
          <strong className="text-foreground">{formatBRL(displayTotal)}</strong> a repassar.
        </p>
      </details>

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