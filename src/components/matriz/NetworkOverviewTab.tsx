/**
 * NetworkOverviewTab — aba "Visão geral" do Painel Matriz Gestor.
 *
 * Desempenho consolidado da rede com seletor de período de verdade
 * (Hoje / 7 dias / 30 dias recalculam vendas, pedidos, ticket, ranking e
 * deltas contra o período anterior equivalente), gráfico de barras dos
 * últimos 7 dias em CSS puro e os pedidos mais recentes de todas as
 * unidades. Tudo de dados reais (orders), nada mockado.
 */
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, ShoppingBag, TrendingDown, TrendingUp } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import type { StoreStatusResult } from "@/lib/storeStatus";
import {
  PERIOD_LABELS,
  PERIOD_PREV_LABELS,
  orderStatusPresentation,
  type GestorPeriod,
} from "@/lib/networkGestor";
import {
  useDailySeries,
  usePeriodStats,
  useRecentOrders,
  type GestorUnitLite,
} from "./useGestorData";

const PERIODS: GestorPeriod[] = ["hoje", "7d", "30d"];
const PERIOD_BUTTON_LABELS: Record<GestorPeriod, string> = {
  hoje: "Hoje",
  "7d": "7 dias",
  "30d": "30 dias",
};

function DeltaLine({ delta, prevLabel }: { delta: number | null; prevLabel: string }) {
  if (delta === null) {
    return <p className="text-[11px] text-muted-foreground mt-1">Sem base de comparação</p>;
  }
  const up = delta >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <p className={`text-[11px] font-bold mt-1 flex items-center gap-1 ${up ? "text-green-600" : "text-red-600"}`}>
      <Icon className="h-3 w-3" />
      {`${up ? "+" : ""}${delta.toFixed(0)}% ${prevLabel}`}
    </p>
  );
}

export default function NetworkOverviewTab({
  sublojas,
  openStatus,
}: {
  sublojas: GestorUnitLite[];
  openStatus?: Map<string, StoreStatusResult>;
}) {
  const [period, setPeriod] = useState<GestorPeriod>("hoje");
  const sublojaIds = sublojas.map((u) => u.id);
  const nameById = new Map(sublojas.map((u) => [u.id, u.name]));

  const { data: stats, isLoading } = usePeriodStats(sublojaIds, period);
  const { data: daily } = useDailySeries(sublojaIds);
  const { data: recentOrders } = useRecentOrders(sublojaIds);

  const published = sublojas.filter((u) => !u.is_draft);
  const openCount = published.filter((u) => openStatus?.get(u.id)?.isOpen).length;
  const firstClosed = published.find((u) => openStatus && !openStatus.get(u.id)?.isOpen);

  const ranking = [...(stats?.perStore.values() || [])].sort((a, b) => b.sales - a.sales);
  const maxDaily = Math.max(1, ...(daily || []).map((d) => d.sales));
  const bestDay = (daily || []).reduce((best, d) => (d.sales > (best?.sales || 0) ? d : best), (daily || [])[0]);

  if (sublojas.length === 0) {
    return (
      <div className="text-center py-12">
        <ShoppingBag className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-sm font-bold text-muted-foreground">Nenhuma subloja ainda</p>
        <p className="text-xs text-muted-foreground mt-1">Crie e publique sublojas na aba Unidades para ver o desempenho da rede aqui.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Seletor de período */}
      <div className="flex bg-muted rounded-full p-1 gap-1">
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`flex-1 rounded-full py-2 text-[13px] font-bold transition-colors ${
              period === p ? "bg-card shadow text-foreground" : "text-muted-foreground"
            }`}
          >
            {PERIOD_BUTTON_LABELS[p]}
          </button>
        ))}
      </div>

      {/* KPIs */}
      {isLoading || !stats ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-[11px] font-bold text-muted-foreground uppercase">Vendas da rede</p>
            <p className="text-xl font-black text-primary mt-1">{formatBRL(stats.sales)}</p>
            <DeltaLine delta={stats.salesDelta} prevLabel={PERIOD_PREV_LABELS[period]} />
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-[11px] font-bold text-muted-foreground uppercase">Pedidos</p>
            <p className="text-xl font-black mt-1">{stats.orders}</p>
            <DeltaLine delta={stats.ordersDelta} prevLabel={PERIOD_PREV_LABELS[period]} />
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-[11px] font-bold text-muted-foreground uppercase">Ticket médio</p>
            <p className="text-xl font-black mt-1">{formatBRL(stats.ticket)}</p>
            <p className="text-[11px] text-muted-foreground mt-1">Por pedido, todas as unidades</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-[11px] font-bold text-muted-foreground uppercase">Unidades abertas</p>
            <p className="text-xl font-black mt-1">
              {openCount}
              <span className="text-sm text-muted-foreground"> / {published.length}</span>
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {firstClosed ? `${firstClosed.name} fechada no momento` : "Todas as publicadas abertas agora"}
            </p>
          </div>
        </div>
      )}

      {/* Gráfico últimos 7 dias */}
      {daily && (
        <>
          <p className="text-xs font-black text-muted-foreground uppercase pt-2">Vendas · últimos 7 dias</p>
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-end gap-2 h-[110px]">
              {daily.map((d) => (
                <div key={d.key} className="flex-1 flex flex-col items-center justify-end gap-1.5 h-full">
                  <div
                    className={`w-full max-w-[30px] rounded-t-md rounded-b-sm ${d.isToday ? "bg-primary" : "bg-primary/25"}`}
                    style={{ height: `${Math.max(4, (d.sales / maxDaily) * 100)}%` }}
                    title={formatBRL(d.sales)}
                  />
                  <span className="text-[10px] font-semibold text-muted-foreground">{d.label}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              {bestDay && bestDay.sales > 0 ? (
                <>Melhor dia: <b className="text-foreground">{bestDay.label}</b> com <b className="text-foreground">{formatBRL(bestDay.sales)}</b> em vendas.</>
              ) : (
                <>Sem vendas nos últimos 7 dias.</>
              )}
            </p>
          </div>
        </>
      )}

      {/* Ranking */}
      <p className="text-xs font-black text-muted-foreground uppercase pt-2">
        Ranking das unidades · {PERIOD_LABELS[period]}
      </p>
      <div className="bg-card border border-border rounded-2xl p-4">
        {ranking.length === 0 && (
          <p className="text-sm text-muted-foreground">Sem dados no período.</p>
        )}
        {ranking.map((r, i) => (
          <div key={r.storeId} className={`flex items-center gap-3 py-3 ${i > 0 ? "border-t border-border" : "pt-0"} ${i === ranking.length - 1 ? "pb-0" : ""}`}>
            <div className="w-[26px] h-[26px] rounded-full bg-primary/10 text-primary text-xs font-black flex items-center justify-center shrink-0">
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{nameById.get(r.storeId) || "Unidade"}</p>
              <p className="text-[11px] text-muted-foreground">
                {r.orders} {r.orders === 1 ? "pedido" : "pedidos"} · ticket {formatBRL(r.ticket)}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-black">{formatBRL(r.sales)}</p>
              {r.salesDelta !== null && (
                <p className={`text-[11px] font-bold flex items-center justify-end gap-0.5 ${r.salesDelta >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {r.salesDelta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {`${r.salesDelta >= 0 ? "+" : ""}${r.salesDelta.toFixed(0)}%`}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Pedidos recentes */}
      <p className="text-xs font-black text-muted-foreground uppercase pt-2">Pedidos recentes da rede</p>
      <div className="bg-card border border-border rounded-2xl p-4">
        {(!recentOrders || recentOrders.length === 0) && (
          <p className="text-sm text-muted-foreground">Nenhum pedido ainda nas unidades da rede.</p>
        )}
        {(recentOrders || []).map((o, i) => {
          const pres = orderStatusPresentation(o.status);
          return (
            <div key={o.id} className={`flex items-start gap-3 py-2.5 ${i > 0 ? "border-t border-border" : "pt-0"} ${i === (recentOrders || []).length - 1 ? "pb-0" : ""}`}>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold truncate">{o.itemsSummary}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <span className="bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded-full uppercase text-[10px]">
                    {nameById.get(o.storeId) || "Unidade"}
                  </span>
                  {formatDistanceToNow(new Date(o.createdAt), { locale: ptBR, addSuffix: true })}
                </p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase shrink-0 ${pres.badgeClass}`}>
                {pres.label}
              </span>
              <p className="text-[13px] font-black shrink-0">{formatBRL(o.totalPrice)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
