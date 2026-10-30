/**
 * NetworkFinanceTab — aba "Financeiro" do Painel Matriz Gestor.
 *
 * - Mensalidade da rede destrinchada: base, unidades extras (R$ 39,90),
 *   add-ons de PDV por loja e total — pela RPC calculate_network_monthly_fee
 *   (via wrapper get_network_monthly_fee, com checagem de dono) ou, enquanto
 *   a migration do wrapper não é aplicada, pelo espelho local da mesma regra.
 * - Barra de gratuidade (GMV 60d vs. R$ 5.000).
 * - Repasse por unidade (store_balances, mesmo dado do painel atual).
 * - Histórico de cobranças da rede (financial_transactions com
 *   charge_family='network_monthly_subscription'); sem nenhuma, mostra as
 *   cobranças da loja-guia rotuladas como o modelo atual por loja.
 * - Exportar CSV de vendas por unidade (client-side, dados reais).
 */
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import {
  SALES_STATUSES,
  aggregatePeriodOrders,
  buildSalesCsv,
  type OrderRowLite,
} from "@/lib/networkGestor";
import {
  useBillingHistory,
  useFeeBreakdown,
  usePdvAddons,
  type GestorUnitLite,
} from "./useGestorData";

interface FinancialsProp {
  pendingPayout: number;
  gmv60d: number;
  repasseByStore: { store_id: string; repasse: number }[];
}

type ExportPeriod = "7d" | "30d" | "mes";

const TX_STATUS: Record<string, { label: string; cls: string }> = {
  paid: { label: "Paga", cls: "bg-green-500/10 text-green-600" },
  pending: { label: "Pendente", cls: "bg-amber-500/10 text-amber-600" },
  failed: { label: "Falhou", cls: "bg-red-500/10 text-red-600" },
  cancelled: { label: "Cancelada", cls: "bg-slate-500/10 text-slate-600" },
};

export default function NetworkFinanceTab({
  network,
  sublojas,
  financials,
  guideStoreId,
}: {
  network: { id: string; plan_type: string; monthly_fee: number; next_billing_date?: string | null };
  sublojas: GestorUnitLite[];
  financials?: FinancialsProp | null;
  guideStoreId: string | null;
}) {
  const sublojaIds = sublojas.map((u) => u.id);
  const nameById = new Map(sublojas.map((u) => [u.id, u.name]));
  const gmv60d = financials?.gmv60d || 0;

  const { data: fee, isLoading: feeLoading } = useFeeBreakdown(network, sublojas, gmv60d);
  const { data: pdvAddons = [] } = usePdvAddons(sublojaIds);
  const { data: history } = useBillingHistory(guideStoreId, network.id);

  const [exportPeriod, setExportPeriod] = useState<ExportPeriod>("30d");
  const [exporting, setExporting] = useState(false);

  const breakdown = fee?.breakdown;
  const pdvTotal = pdvAddons.reduce((s, a) => s + (a.price || 0), 0);
  const networkTotal = breakdown?.totalMonthlyFee || 0;
  const grandTotal = networkTotal + pdvTotal;
  const gmvPct = breakdown
    ? Math.min(100, (gmv60d / breakdown.freeGmvThreshold) * 100)
    : 0;
  const monthLabel = format(new Date(), "MMMM", { locale: ptBR });

  const repasseRows = sublojas
    .map((u) => ({
      unit: u,
      repasse: financials?.repasseByStore.find((r) => r.store_id === u.id)?.repasse || 0,
    }))
    .sort((a, b) => b.repasse - a.repasse);

  const handleExport = async () => {
    setExporting(true);
    try {
      const now = new Date();
      let start: Date;
      if (exportPeriod === "mes") {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
      } else {
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() - (exportPeriod === "7d" ? 6 : 29));
      }
      const { data, error } = await supabase
        .from("orders")
        .select("store_id, total_price, created_at")
        .in("store_id", sublojaIds)
        .in("status", [...SALES_STATUSES] as any)
        .gte("created_at", start.toISOString());
      if (error) throw error;
      const agg = aggregatePeriodOrders(
        (data || []) as OrderRowLite[],
        { currentStart: start, previousStart: start, previousEnd: start },
        sublojaIds,
      );
      const rows = sublojas.map((u) => {
        const st = agg.perStore.get(u.id);
        return {
          unitName: u.name,
          orders: st?.orders || 0,
          sales: st?.sales || 0,
          ticket: st?.ticket || 0,
        };
      });
      const csv = buildSalesCsv(rows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vendas-rede-${exportPeriod}-${format(now, "yyyy-MM-dd")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Relatório gerado — confira seus downloads.");
    } catch {
      toast.error("Não deu para gerar o relatório agora. Tente de novo.");
    } finally {
      setExporting(false);
    }
  };

  const renderTxRows = (txs: { id: string; amount: number; status: string; createdAt: string }[]) =>
    txs.map((t) => {
      const st = TX_STATUS[t.status] || { label: t.status, cls: "bg-slate-500/10 text-slate-600" };
      return (
        <div key={t.id} className="flex items-center justify-between gap-2 py-2.5 border-t border-border first:border-t-0 first:pt-0 last:pb-0 text-sm">
          <span className="text-muted-foreground capitalize">
            {format(new Date(t.createdAt), "MMMM · dd/MM", { locale: ptBR })}
          </span>
          <span className="font-bold">{formatBRL(t.amount)}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${st.cls}`}>{st.label}</span>
        </div>
      );
    });

  return (
    <div className="space-y-3">
      {/* Mensalidade da rede */}
      <p className="text-xs font-black text-muted-foreground uppercase">Mensalidade da rede · {monthLabel}</p>
      <div className="bg-card border border-border rounded-2xl p-4">
        {feeLoading || !breakdown ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Calculando a mensalidade da rede…
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between text-sm py-1.5">
              <span className="text-muted-foreground">Plano base da rede (até {breakdown.freeUnitsIncluded} unidades)</span>
              <span className="font-bold">{formatBRL(breakdown.baseMonthlyFee)}</span>
            </div>
            <div className="flex items-center justify-between text-sm py-1.5 border-t border-dashed border-border">
              <span className="text-muted-foreground">
                Unidades extras · {breakdown.extraUnitCount} × {formatBRL(breakdown.extraUnitFee)}
              </span>
              <span className="font-bold">{formatBRL(breakdown.extraFee)}</span>
            </div>
            {pdvAddons.map((a) => (
              <div key={a.storeId} className="flex items-center justify-between text-sm py-1.5 border-t border-dashed border-border">
                <span className="text-muted-foreground truncate">PDV · {nameById.get(a.storeId) || "Unidade"}</span>
                <span className="font-bold">{a.price !== null ? formatBRL(a.price) : "ativo"}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-3 mt-1.5 border-t-2 border-foreground">
              <span className="text-sm font-black">Total do mês</span>
              <span className="text-xl font-black text-primary">{formatBRL(grandTotal)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2.5 leading-relaxed">
              {breakdown.freeByGmv ? (
                <>A rede está em <b className="text-foreground">gratuidade</b> (GMV 60d até {formatBRL(breakdown.freeGmvThreshold)}): a mensalidade da rede é R$ 0 neste ciclo{pdvTotal > 0 ? " — o total acima é só o PDV das lojas" : ""}.</>
              ) : (
                <>Uma cobrança só para a rede inteira. O PDV, quando existe, entra no plano de cada loja.</>
              )}
              {breakdown.baseReason === "pdv_only_network" && (
                <> Rede só de PDV: sem base de rede — cada loja paga o seu plano.</>
              )}
              {breakdown.isVip && <> Condição especial (VIP) aplicada à rede.</>}
              {network.next_billing_date && (
                <> Próxima cobrança: <b className="text-foreground">{format(new Date(network.next_billing_date), "dd/MM/yyyy")}</b>.</>
              )}
            </p>
          </>
        )}
      </div>

      {/* Gratuidade */}
      <p className="text-xs font-black text-muted-foreground uppercase pt-2">Gratuidade · vendas dos últimos 60 dias</p>
      <div className="bg-card border border-border rounded-2xl p-4">
        <p className="text-sm font-bold">
          {breakdown?.freeByGmv ? "Rede em gratuidade" : "Rede em cobrança normal"}
        </p>
        <div className="h-2.5 bg-muted rounded-full overflow-hidden mt-3">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${gmvPct}%` }} />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
          <span>GMV 60 dias: <b className="text-foreground">{formatBRL(gmv60d)}</b></span>
          <span>limite: {formatBRL(breakdown?.freeGmvThreshold || 5000)}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
          {breakdown?.freeByGmv
            ? "Enquanto o GMV de 60 dias ficar até o limite, a rede não paga mensalidade."
            : "A rede superou o limite de gratuidade — a mensalidade acima está ativa. Redes novas não pagam nada até passar do limite em 60 dias."}
        </p>
      </div>

      {/* Repasse por unidade */}
      <p className="text-xs font-black text-muted-foreground uppercase pt-2">Repasse por unidade · R$ 0,99 por entrega</p>
      <div className="bg-card border border-border rounded-2xl p-4">
        {repasseRows.map((r, i) => (
          <div key={r.unit.id} className={`flex items-center justify-between py-2.5 ${i > 0 ? "border-t border-border" : "pt-0"} ${i === repasseRows.length - 1 ? "pb-0" : ""}`}>
            <span className="text-sm font-bold truncate">{r.unit.name}</span>
            <span className="text-sm font-black">{formatBRL(r.repasse)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between pt-3 mt-1.5 border-t-2 border-foreground">
          <span className="text-sm font-black">Total a repassar</span>
          <span className="text-xl font-black text-primary">{formatBRL(financials?.pendingPayout || 0)}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-2.5">
          Cada unidade paga o seu repasse, toda segunda-feira. Aqui você acompanha a soma e quem está pendente.
        </p>
      </div>

      {/* Histórico */}
      <p className="text-xs font-black text-muted-foreground uppercase pt-2">Histórico de cobranças da rede</p>
      <div className="bg-card border border-border rounded-2xl p-4">
        {history && history.networkTx.length > 0 ? (
          renderTxRows(history.networkTx)
        ) : history && history.guideTx.length > 0 ? (
          <>
            <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
              A rede ainda não tem cobranças próprias — por enquanto, quem é cobrado é a loja-guia, no modelo por loja:
            </p>
            {renderTxRows(history.guideTx)}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma cobrança registrada ainda para esta rede.</p>
        )}
      </div>

      {/* Relatórios */}
      <p className="text-xs font-black text-muted-foreground uppercase pt-2">Relatórios</p>
      <div className="bg-card border border-border rounded-2xl p-4">
        <p className="text-[13px] text-muted-foreground leading-relaxed mb-3">
          Baixe as vendas da rede por unidade, prontas pra conferir ou mandar pro contador.
        </p>
        <div className="flex gap-2">
          <select
            value={exportPeriod}
            onChange={(e) => setExportPeriod(e.target.value as ExportPeriod)}
            className="flex-1 bg-muted/40 border border-border rounded-xl px-3 py-2.5 text-sm"
          >
            <option value="30d">Últimos 30 dias</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="mes">Este mês</option>
          </select>
          <button
            onClick={handleExport}
            disabled={exporting || sublojaIds.length === 0}
            className="bg-foreground text-background rounded-xl px-4 py-2.5 font-bold text-sm flex items-center gap-2 disabled:opacity-50"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Exportar CSV
          </button>
        </div>
      </div>
    </div>
  );
}
