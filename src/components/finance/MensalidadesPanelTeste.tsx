import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Crown, AlertTriangle, CheckCircle2, Clock, TrendingDown, Download } from "lucide-react";
import { exportCSV, brl } from "./financeExport";
import { planLabel } from "@/lib/plansInfo";
import {
  MENSALIDADES_PLAN_TYPES,
  buildMensalidadeRow,
  sortMensalidadeRows,
  computeMensalidadesStats,
  upcomingCharges,
  formatShortDate,
  type MensalidadeRow,
  type MensalidadeStatus,
} from "@/lib/superAdminMensalidades";

type Status = MensalidadeStatus;

const statusInfo: Record<Status, { label: string; color: string; icon: any }> = {
  em_dia: { label: "Em dia", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30", icon: CheckCircle2 },
  atrasado: { label: "Atrasado", color: "bg-destructive/10 text-destructive border-destructive/30", icon: AlertTriangle },
  trial: { label: "Trial", color: "bg-blue-500/10 text-blue-600 border-blue-500/30", icon: Clock },
  inativo: { label: "Inativo", color: "bg-muted text-muted-foreground", icon: TrendingDown },
};

/**
 * MensalidadesPanelTeste — redesenho da Fase 6 (só /super-admin-teste).
 * Mesma fonte de dados e mesma lógica do original, com duas diferenças:
 * (1) visual novo do protótipo (herói MRR, "Precisa de atenção", vencimento
 * por linha); (2) decisão do Renner (28/10 ~06:58): inclui os planos
 * Somente PDV — o MRR vira R$ 1.071,50 (igual ao Consolidado) e a Silvia
 * aparece na lista. O original mantém a query antiga (sem pdv_only).
 */
const MensalidadesPanelTeste = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["finance-mensalidades-teste"],
    queryFn: async () => {
      const [plansRes, storesRes] = await Promise.all([
        supabase
          .from("store_plans")
          .select("store_id, plan_type, monthly_fee, next_billing_date, last_billed_at, trial_ends_at, started_at, is_active")
          // "pdv_only" existe no banco ao vivo, mas o types.ts gerado não
          // inclui esse valor no enum — o cast é só na cópia Teste.
          .in("plan_type", [...MENSALIDADES_PLAN_TYPES] as any),
        supabase.from("stores").select("id, name, is_test, status"),
      ]);
      const plans = plansRes.data || [];
      const stores = storesRes.data || [];
      const now = new Date();
      return plans
        .map((p: any) =>
          buildMensalidadeRow(p, stores.find((x: any) => x.id === p.store_id), now),
        )
        .filter(Boolean) as MensalidadeRow[];
    },
    staleTime: 30_000,
  });

  const rows = data || [];
  const sorted = useMemo(() => sortMensalidadeRows(rows), [rows]);
  const stats = useMemo(() => computeMensalidadesStats(rows), [rows]);
  const upcoming = useMemo(() => upcomingCharges(rows, new Date()), [rows]);
  const overdue = useMemo(() => rows.filter((r) => r.status === "atrasado"), [rows]);

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  const upcomingContext =
    upcoming.count > 0
      ? `Próximos 7 dias: ${brl(upcoming.total)} em ${upcoming.count} ${upcoming.count === 1 ? "cobrança" : "cobranças"}${upcoming.dateLabel ? ` · vencem ${upcoming.dateLabel}` : ""}`
      : "Próximos 7 dias: nenhuma cobrança";
  const inadContext =
    stats.inadCount > 0
      ? `Inadimplência: ${brl(stats.inadAmt)} — ${stats.inadCount} ${stats.inadCount === 1 ? "vencida" : "vencidas"}`
      : `Inadimplência: ${brl(stats.inadAmt)} — nenhuma vencida`;

  // CSV com o mesmo conteúdo de hoje (as chaves do painel original, na
  // mesma ordem — trialEnds é só exibição e não entra no arquivo).
  const csvRows = sorted.map((r) => ({
    store_id: r.store_id,
    name: r.name,
    store_status: r.store_status,
    plan_type: r.plan_type,
    monthly: r.monthly,
    status: r.status,
    daysLate: r.daysLate,
    nextBilling: r.nextBilling,
    lastBilled: r.lastBilled,
    monthsActive: r.monthsActive,
    ltv: r.ltv,
  }));

  return (
    <div className="space-y-4">
      {/* Herói — MRR */}
      <div className="bg-card rounded-2xl border border-border p-5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          MRR · Receita mensal recorrente
        </p>
        <p className="text-4xl font-black text-primary tabular-nums leading-tight mt-1">
          {brl(stats.mrr)}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {stats.ativos} lojas ativas · {stats.paying} com mensalidade acima de R$ 0,00
        </p>
        <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border/60">
          {upcomingContext} · {inadContext}
        </p>
      </div>

      {/* Precisa de atenção */}
      <section>
        <h2 className="text-sm font-bold text-foreground mb-3">Precisa de atenção</h2>
        <div className="space-y-3">
          <div
            className={`flex items-center gap-3 rounded-2xl px-4 py-3 border ${
              stats.inadCount > 0
                ? "bg-amber-500/10 border-amber-500/30"
                : "bg-emerald-500/10 border-emerald-500/20"
            }`}
          >
            {stats.inadCount > 0 ? (
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-foreground">
                {stats.inadCount > 0 ? (
                  <>
                    {stats.inadCount} {stats.inadCount === 1 ? "mensalidade vencida" : "mensalidades vencidas"}{" "}
                    <span className="ml-1 text-[11px] font-black rounded-full px-2 py-0.5 bg-primary/10 text-primary whitespace-nowrap">
                      {brl(stats.inadAmt)}
                    </span>
                  </>
                ) : (
                  <>
                    Nenhuma mensalidade vencida{" "}
                    <span className="ml-1 text-[11px] font-black rounded-full px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      em dia
                    </span>
                  </>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {stats.inadCount > 0
                  ? overdue.map((r) => r.name).join(", ")
                  : "Nenhuma loja com vencimento passado e mensalidade acima de R$ 0,00."}
              </p>
            </div>
          </div>

          <div
            className={`flex items-center gap-3 rounded-2xl px-4 py-3 border ${
              upcoming.count > 0
                ? "bg-amber-500/10 border-amber-500/30"
                : "bg-emerald-500/10 border-emerald-500/20"
            }`}
          >
            {upcoming.count > 0 ? (
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-foreground">
                {upcoming.count > 0 ? (
                  <>
                    {upcoming.count} {upcoming.count === 1 ? "cobrança vence" : "cobranças vencem"}
                    {upcoming.dateLabel ? ` em ${upcoming.dateLabel}` : ""}{" "}
                    <span className="ml-1 text-[11px] font-black rounded-full px-2 py-0.5 bg-primary/10 text-primary whitespace-nowrap">
                      {brl(upcoming.total)}
                    </span>
                  </>
                ) : (
                  <>
                    Nenhuma cobrança nos próximos 7 dias{" "}
                    <span className="ml-1 text-[11px] font-black rounded-full px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      em dia
                    </span>
                  </>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {upcoming.count > 0
                  ? upcoming.names.join(", ")
                  : "Nenhuma mensalidade vence nos próximos 7 dias."}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Resumo — os mesmos 4 cartões de antes */}
      <section>
        <h2 className="text-sm font-bold text-foreground mb-3">
          Resumo{" "}
          <span className="block text-xs font-normal text-muted-foreground mt-0.5">
            Os mesmos números de antes — só mais fáceis de ler
          </span>
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Crown className="w-4 h-4" /> MRR
              </div>
              <p className="text-2xl font-bold">{brl(stats.mrr)}</p>
              <p className="text-[10px] text-muted-foreground">{stats.ativos} lojas ativas</p>
            </CardContent>
          </Card>
          <Card className={stats.inadCount ? "border-destructive bg-destructive/5" : ""}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4 text-destructive" /> Inadimplência
              </div>
              <p className="text-2xl font-bold text-destructive">{brl(stats.inadAmt)}</p>
              <p className="text-[10px] text-muted-foreground">
                {stats.inadCount} lojas · {stats.inadPct.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">LTV médio</div>
              <p className="text-2xl font-bold">{brl(stats.avgLtv)}</p>
              <p className="text-[10px] text-muted-foreground">vida média {stats.avgMonths.toFixed(1)} m</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Churn (proxy)</div>
              <p className="text-2xl font-bold">{stats.avgMonths > 0 ? (100 / stats.avgMonths).toFixed(1) : "0"}%</p>
              <p className="text-[10px] text-muted-foreground">1 / vida média</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Status de mensalidades por loja</CardTitle>
          <Button size="sm" variant="outline" onClick={() => exportCSV("mensalidades", csvRows)} disabled={!rows.length}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Sem planos com mensalidade ativa.</p>
          )}
          {sorted.map((r) => {
            const info = statusInfo[r.status as Status];
            const Icon = info.icon;
            const detailParts = [
              r.nextBilling ? `Próx. cobrança ${formatShortDate(r.nextBilling)}` : "Sem vencimento",
              `LTV ${brl(r.ltv)}`,
            ];
            if (r.lastBilled) detailParts.push(`última cobrança ${formatShortDate(r.lastBilled)}`);
            if (r.status === "trial" && r.trialEnds) detailParts.push(`trial até ${formatShortDate(r.trialEnds)}`);
            return (
              <div key={r.store_id} className="border rounded-lg p-3 bg-muted/30 flex items-center justify-between flex-wrap gap-2">
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="font-semibold truncate">{r.name}</span>
                    <Badge variant="outline" className="text-[10px]">{planLabel(r.plan_type)}</Badge>
                    <Badge variant="outline" className={`text-[10px] ${info.color}`}>
                      <Icon className="w-3 h-3 mr-1" /> {info.label}
                    </Badge>
                    {r.status === "atrasado" && (
                      <Badge variant="destructive" className="text-[10px]">{r.daysLate}d atraso</Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{detailParts.join(" · ")}</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-bold">{brl(r.monthly)}/mês</span>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};

export default MensalidadesPanelTeste;
