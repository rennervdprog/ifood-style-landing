import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp, Wallet, Crown, Store as StoreIcon, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { MetricCard } from "@/pages/admin/components/FinanceTab";
import { formatBRL, sumMoney, addMoney } from "@/lib/utils";
import GatewaySelectorTeste from "../components/GatewaySelectorTeste";
import {
  getStoresWithDebt,
  type FailedPayoutsSummary,
} from "@/lib/superAdminConsolidado";

/* ─────────────────────────────────────────────────────────────
 * ConsolidadoTabTeste — Consolidado redesenhado (Fase 4).
 *
 * Cópia TESTE do ConsolidadoTab: MESMOS números de hoje, novo visual
 * do protótipo aprovado pelo Renner (27/10 ~22:50, "como está"):
 * herói + filtro 7/30 dias, "Precisa de atenção", "Saldos por loja"
 * e o gateway em cartão próprio. Nada de lógica de dinheiro mudou:
 * o volume continua sendo a soma de `subtotal` só de pedidos
 * finalizados/entregues (settlement) — decisão dele, não alinhar
 * com o herói da Visão Geral.
 *
 * IMPORTANTE: o fluxo de repasse é LOJA → PLATAFORMA.
 * "A receber" = dívidas das lojas com a plataforma
 * (mensalidade + comissão % + R$ 0,99/entrega + taxa PDV).
 * A plataforma NUNCA deve para a loja no fluxo normal.
 * ─────────────────────────────────────────────────────────── */

export interface FinanceHeroTotals {
  totalVolume: number;
  grossProfit: number;
  totalOrders: number;
  storesWithSales: number;
}

interface ConsolidadoTabTesteProps {
  storeBalances: any[];
  parentStorePlans: any[];
  stores: any[];
  testStoreIds: string[];
  financeTotals: FinanceHeroTotals & { totalDriverFees: number };
  /** Totais do OUTRO período (para a linha de contexto do herói). */
  financeTotalsOther?: FinanceHeroTotals;
  financeFilter: "week" | "month";
  onFinanceFilterChange: (v: "week" | "month") => void;
  /** Repasses com falha (financial_transactions: store_payout + failed). */
  failedPayouts: FailedPayoutsSummary;
  pendingWithdrawalsCount: number;
  onGoToSection: (section: string) => void;
  loading: boolean;
}

const PERIOD_LABEL: Record<"week" | "month", string> = {
  week: "7 dias",
  month: "30 dias",
};

export default function ConsolidadoTabTeste({
  storeBalances,
  parentStorePlans,
  stores,
  testStoreIds,
  financeTotals,
  financeTotalsOther,
  financeFilter,
  onFinanceFilterChange,
  failedPayouts,
  pendingWithdrawalsCount,
  onGoToSection,
  loading,
}: ConsolidadoTabTesteProps) {
  const testIds = useMemo(() => new Set(testStoreIds || []), [testStoreIds]);

  // Mesmas contas do ConsolidadoTab original — só o visual mudou.
  const data = useMemo(() => {
    // Lojas reais (exclui teste)
    const realStores = (stores || []).filter((s: any) => !s.is_test && !testIds.has(s.id));
    const lojasAtivas = realStores.filter((s: any) => s.status === "ativo").length;

    // A receber dos lojistas: comissao_pendente + repasse_pendente
    // (storeBalances já exclui lojas de teste na query do pai)
    let aReceber = 0;
    let comissaoPendente = 0;
    let repassePendente = 0;
    for (const b of storeBalances || []) {
      const c = Number(b.comissao_pendente || 0);
      const r = Number(b.repasse_pendente || 0);
      comissaoPendente = addMoney(comissaoPendente, c);
      repassePendente = addMoney(repassePendente, r);
      aReceber = addMoney(aReceber, addMoney(c, r));
    }

    // Mensalidades ativas (MRR) — exclui lojas de teste
    const realPlans = (parentStorePlans || []).filter(
      (p: any) => !testIds.has(p.store_id)
    );
    const planosComMensalidade = realPlans.filter((p: any) => Number(p.monthly_fee || 0) > 0);
    const mrr = sumMoney(planosComMensalidade.map((p: any) => Number(p.monthly_fee || 0)));

    // PDV a receber (acumulado nas vendas de balcão)
    let pdvPendente = 0;
    for (const p of realPlans) {
      pdvPendente = addMoney(pdvPendente, Number(p.pdv_commission_pending || 0));
    }

    // Lojas com dívida (para o alerta e para a lista de saldos)
    const lojasComDivida = (storeBalances || []).filter(
      (b: any) => Number(b.comissao_pendente || 0) + Number(b.repasse_pendente || 0) > 0
    ).length;

    return {
      lojasAtivas,
      totalLojas: realStores.length,
      aReceber,
      comissaoPendente,
      repassePendente,
      pdvPendente,
      mrr,
      mensalidadesAtivas: planosComMensalidade.length,
      lojasComDivida,
      receitaMes: financeTotals?.grossProfit || 0,
    };
  }, [storeBalances, parentStorePlans, stores, testIds, financeTotals]);

  const storesWithDebt = useMemo(
    () => getStoresWithDebt(storeBalances || [], stores || []),
    [storeBalances, stores]
  );

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  const otherLabel = financeFilter === "week" ? "30 dias" : "7 dias";
  const aReceberDetail =
    data.comissaoPendente > 0 && data.repassePendente > 0
      ? `Comissão ${formatBRL(data.comissaoPendente)} · Entregas ${formatBRL(data.repassePendente)}. Dar baixa ou gerar cobrança em A Receber.`
      : data.repassePendente > 0
        ? "Tudo em taxa de entrega (R$ 0,99). Dar baixa ou gerar cobrança em A Receber."
        : data.comissaoPendente > 0
          ? "Tudo em comissão %. Dar baixa ou gerar cobrança em A Receber."
          : "Nenhum valor a receber das lojas.";
  const failedDate = failedPayouts.latestDate
    ? new Date(failedPayouts.latestDate).toLocaleDateString("pt-BR")
    : null;
  const failedMonth = failedPayouts.latestDate
    ? new Date(failedPayouts.latestDate).toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      })
    : null;
  const failedDetail =
    failedPayouts.topStore && failedPayouts.topStore.count === failedPayouts.count
      ? `${failedPayouts.topStore.name}, ${failedPayouts.count} ${failedPayouts.count === 1 ? "repasse" : "repasses"} de ${formatBRL(failedPayouts.total / failedPayouts.count)} que ${failedPayouts.count === 1 ? "falhou" : "falharam"} em ${failedMonth}. Ver em Repasses com falha.`
      : `${failedPayouts.storeNames.join(", ")} · ${failedPayouts.count} repasses com falha. Ver em Repasses com falha.`;

  return (
    <div className="space-y-4">
      {/* Filtro de período — novo: hoje o Consolidado não tem filtro visível. */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Período</span>
        <div className="inline-flex items-center gap-1 p-1 bg-muted rounded-xl">
          {(["week", "month"] as const).map((f) => (
            <button
              key={f}
              onClick={() => onFinanceFilterChange(f)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                financeFilter === f
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {PERIOD_LABEL[f]}
            </button>
          ))}
        </div>
      </div>

      {/* Herói — receita da plataforma no período */}
      <div className="bg-card rounded-2xl border border-border p-5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          Receita da plataforma · {PERIOD_LABEL[financeFilter]}
        </p>
        <p className="text-4xl font-black text-primary tabular-nums leading-tight mt-1">
          {formatBRL(financeTotals?.grossProfit || 0)}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Volume: {formatBRL(financeTotals?.totalVolume || 0)} em{" "}
          {financeTotals?.totalOrders || 0} pedidos ·{" "}
          {financeTotals?.storesWithSales || 0}{" "}
          {(financeTotals?.storesWithSales || 0) === 1 ? "loja vendeu" : "lojas venderam"}
        </p>
        {financeTotalsOther && (
          <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border/60">
            Em {otherLabel}: <b className="text-foreground">{formatBRL(financeTotalsOther.grossProfit)}</b>{" "}
            de receita · volume{" "}
            <b className="text-foreground">{formatBRL(financeTotalsOther.totalVolume)}</b> em{" "}
            <b className="text-foreground">{financeTotalsOther.totalOrders} pedidos</b>
          </p>
        )}
      </div>

      {/* Precisa de atenção */}
      <section>
        <h2 className="text-sm font-bold text-foreground mb-3">Precisa de atenção</h2>
        <div className="space-y-3">
          {/* A receber */}
          <div
            className={`flex items-center gap-3 rounded-2xl px-4 py-3 border ${
              data.aReceber > 0
                ? "bg-amber-500/10 border-amber-500/30"
                : "bg-emerald-500/10 border-emerald-500/20"
            }`}
          >
            {data.aReceber > 0 ? (
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-foreground">
                A receber dos lojistas{" "}
                {data.aReceber > 0 ? (
                  <span className="ml-1 text-[11px] font-black rounded-full px-2 py-0.5 bg-primary/10 text-primary whitespace-nowrap">
                    {formatBRL(data.aReceber)} · {data.lojasComDivida} {data.lojasComDivida === 1 ? "loja" : "lojas"}
                  </span>
                ) : (
                  <span className="ml-1 text-[11px] font-black rounded-full px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                    em dia
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">{aReceberDetail}</p>
            </div>
            {data.aReceber > 0 && (
              <button
                onClick={() => onGoToSection("areceber")}
                className="shrink-0 text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-3 py-2 rounded-xl"
              >
                Ver
              </button>
            )}
          </div>

          {/* Repasses com falha */}
          <div
            className={`flex items-center gap-3 rounded-2xl px-4 py-3 border ${
              failedPayouts.count > 0
                ? "bg-muted/50 border-border"
                : "bg-emerald-500/10 border-emerald-500/20"
            }`}
          >
            {failedPayouts.count > 0 ? (
              <AlertTriangle className="h-5 w-5 text-muted-foreground shrink-0" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-foreground">
                Repasses com falha{" "}
                {failedPayouts.count > 0 ? (
                  <span className="ml-1 text-[11px] font-black rounded-full px-2 py-0.5 bg-muted text-muted-foreground whitespace-nowrap">
                    {failedPayouts.count} · {formatBRL(failedPayouts.total)}
                    {failedDate ? ` · ${failedDate}` : ""}
                  </span>
                ) : (
                  <span className="ml-1 text-[11px] font-black rounded-full px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                    nenhum
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {failedPayouts.count > 0
                  ? failedDetail
                  : "Nenhum repasse com falha."}
              </p>
            </div>
            {failedPayouts.count > 0 && (
              <button
                onClick={() => onGoToSection("repasses-falha")}
                className="shrink-0 text-xs font-bold px-3 py-2 rounded-xl bg-muted text-foreground"
              >
                Ver
              </button>
            )}
          </div>

          {/* Saques */}
          <div
            className={`flex items-center gap-3 rounded-2xl px-4 py-3 border ${
              pendingWithdrawalsCount > 0
                ? "bg-amber-500/10 border-amber-500/30"
                : "bg-emerald-500/10 border-emerald-500/20"
            }`}
          >
            {pendingWithdrawalsCount > 0 ? (
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-foreground">
                Saques{" "}
                {pendingWithdrawalsCount > 0 ? (
                  <span className="ml-1 text-[11px] font-black rounded-full px-2 py-0.5 bg-primary/10 text-primary whitespace-nowrap">
                    {pendingWithdrawalsCount} {pendingWithdrawalsCount === 1 ? "pendente" : "pendentes"}
                  </span>
                ) : (
                  <span className="ml-1 text-[11px] font-black rounded-full px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                    nenhum pendente
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {pendingWithdrawalsCount > 0
                  ? `${pendingWithdrawalsCount} ${pendingWithdrawalsCount === 1 ? "solicitação pendente" : "solicitações pendentes"} aguardando aprovação.`
                  : "Nenhum pedido de saque aguardando aprovação."}
              </p>
            </div>
            {pendingWithdrawalsCount > 0 && (
              <button
                onClick={() => onGoToSection("saques")}
                className="shrink-0 text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-3 py-2 rounded-xl"
              >
                Ver
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Resumo — os mesmos cartões de antes, sem a Receita (foi para o herói). */}
      <section>
        <h2 className="text-sm font-bold text-foreground mb-3">
          Resumo
          <span className="block text-xs font-normal text-muted-foreground mt-0.5">
            Os mesmos números de antes — só mais fáceis de ler
          </span>
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <MetricCard
            icon={Wallet}
            label="A receber dos lojistas"
            value={formatBRL(data.aReceber)}
            sublabel={`${data.lojasComDivida} loja(s) com dívida`}
            sublabel2={`Comissão: ${formatBRL(data.comissaoPendente)} · Entregas: ${formatBRL(data.repassePendente)}`}
            highlight={data.aReceber > 0}
          />
          <MetricCard
            icon={Crown}
            label="Mensalidades (MRR)"
            value={formatBRL(data.mrr)}
            sublabel={`${data.mensalidadesAtivas} plano(s) com mensalidade`}
            sublabel2={`PDV a receber: ${formatBRL(data.pdvPendente)}`}
          />
          <MetricCard
            icon={StoreIcon}
            label="Lojas ativas"
            value={String(data.lojasAtivas)}
            sublabel={`${data.totalLojas} loja(s) no total`}
          />
        </div>
      </section>

      {/* Composição do "A receber" */}
      <section>
        <h2 className="text-sm font-bold text-foreground mb-3">
          Composição do &ldquo;A receber&rdquo;
          <span className="block text-xs font-normal text-muted-foreground mt-0.5">
            Valores que os lojistas devem à plataforma
          </span>
        </h2>
        <Card>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">
                  Comissão %
                </p>
                <p className="text-lg font-black">{formatBRL(data.comissaoPendente)}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  % sobre vendas físicas (dinheiro/cartão)
                </p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">
                  Taxa de entrega (R$ 0,99)
                </p>
                <p className="text-lg font-black">{formatBRL(data.repassePendente)}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  R$ 0,99 por entrega em pagamento físico
                </p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">
                  Taxa PDV
                </p>
                <p className="text-lg font-black">{formatBRL(data.pdvPendente)}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Acumulado das vendas de balcão
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Saldos por loja — novo: hoje o Consolidado não lista quem deve. */}
      <section>
        <h2 className="text-sm font-bold text-foreground mb-3">
          Saldos por loja
          <span className="block text-xs font-normal text-muted-foreground mt-0.5">
            {storesWithDebt.length === 0
              ? "Nenhuma loja com valores a receber"
              : `Só as ${storesWithDebt.length} lojas com valores a receber — as outras ${Math.max(data.totalLojas - storesWithDebt.length, 0)} estão em dia`}
          </span>
        </h2>
        <Card>
          <CardContent className="pt-2 pb-2">
            {storesWithDebt.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                Todas as lojas em dia — nenhum valor a receber.
              </p>
            ) : (
              storesWithDebt.map((s, i) => (
                <div
                  key={s.storeId}
                  className="flex items-center gap-3 py-3 border-b border-border/60 last:border-b-0"
                >
                  <span className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-black text-muted-foreground shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.originLabel}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-foreground tabular-nums">
                      {formatBRL(s.total)}
                    </p>
                    <p className="text-[11px] font-semibold text-muted-foreground">a receber</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      {/* Gateway — cartão próprio (saiu do topo do Financeiro). */}
      <section>
        <h2 className="text-sm font-bold text-foreground mb-3">
          Gateway de pagamento
          <span className="block text-xs font-normal text-muted-foreground mt-0.5">
            Quem processa os PIX de mensalidade, comissão e pedidos
          </span>
        </h2>
        <GatewaySelectorTeste />
      </section>

      {/* Ações */}
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          onClick={() => onGoToSection("areceber")}
          className="flex-1 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition-all active:scale-95"
        >
          Cobrar valores em A Receber
        </button>
        <button
          onClick={() => onGoToSection("repasses-falha")}
          className="flex-1 rounded-full border border-border bg-card px-5 py-3 text-sm font-bold text-foreground transition-all active:scale-95"
        >
          Ver repasses com falha
        </button>
      </div>
    </div>
  );
}
