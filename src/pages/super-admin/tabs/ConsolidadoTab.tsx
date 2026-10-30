import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, Wallet, Crown, Store as StoreIcon, AlertTriangle,
} from "lucide-react";
import { MetricCard } from "@/pages/admin/components/FinanceTab";
import { formatBRL, sumMoney, addMoney } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────
 * ConsolidadoTab — visão consolidada das finanças da plataforma.
 *
 * IMPORTANTE: o fluxo de repasse é LOJA → PLATAFORMA.
 * "A receber" = dívidas das lojas com a plataforma
 * (mensalidade + comissão % + R$ 0,99/entrega + taxa PDV).
 * A plataforma NUNCA deve para a loja no fluxo normal.
 * ─────────────────────────────────────────────────────────── */

interface ConsolidadoTabProps {
  storeBalances: any[];
  parentStorePlans: any[];
  stores: any[];
  testStoreIds: string[];
  financeTotals: { totalVolume: number; grossProfit: number; totalDriverFees: number };
  loading: boolean;
}

export default function ConsolidadoTab({
  storeBalances,
  parentStorePlans,
  stores,
  testStoreIds,
  financeTotals,
  loading,
}: ConsolidadoTabProps) {
  const testIds = useMemo(() => new Set(testStoreIds || []), [testStoreIds]);

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

    // Lojas com dívida (para o alerta)
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

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPIs principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          icon={TrendingUp}
          label="Receita da plataforma"
          value={formatBRL(data.receitaMes)}
          sublabel="Comissões no período"
          highlight
        />
        <MetricCard
          icon={Wallet}
          label="A receber dos lojistas"
          value={formatBRL(data.aReceber)}
          sublabel={`${data.lojasComDivida} loja(s) com dívida`}
          sublabel2={`Comissão: ${formatBRL(data.comissaoPendente)} • Entregas: ${formatBRL(data.repassePendente)}`}
          alert={data.aReceber > 0}
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

      {/* Detalhamento do "A receber" */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            Composição do "A receber"
            <span className="text-[11px] font-normal text-muted-foreground">
              — valores que os lojistas devem à plataforma
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
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

      {/* Alerta */}
      {data.lojasComDivida > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold">
                  {data.lojasComDivida} loja(s) com valores a receber
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Total de <strong>{formatBRL(data.aReceber)}</strong> a receber dos lojistas.
                  Use a aba <Badge variant="outline" className="mx-1">A Receber</Badge> para dar baixa manual ou gerar cobrança.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
