import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Crown, AlertTriangle, CheckCircle2, Clock, TrendingDown, Download } from "lucide-react";
import { exportCSV, brl } from "./financeExport";
import PlanosTab from "@/components/PlanosTab";

type Status = "em_dia" | "atrasado" | "trial" | "inativo";

const statusInfo: Record<Status, { label: string; color: string; icon: any }> = {
  em_dia: { label: "Em dia", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30", icon: CheckCircle2 },
  atrasado: { label: "Atrasado", color: "bg-destructive/10 text-destructive border-destructive/30", icon: AlertTriangle },
  trial: { label: "Trial", color: "bg-blue-500/10 text-blue-600 border-blue-500/30", icon: Clock },
  inativo: { label: "Inativo", color: "bg-muted text-muted-foreground", icon: TrendingDown },
};

const MensalidadesPanel = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["finance-mensalidades"],
    queryFn: async () => {
      const [plansRes, storesRes] = await Promise.all([
        supabase
          .from("store_plans")
          .select("store_id, plan_type, monthly_fee, next_billing_date, last_billed_at, trial_ends_at, started_at, is_active")
          .eq("plan_type", "fixed"),
        supabase.from("stores").select("id, name, is_test, status"),
      ]);
      const plans = plansRes.data || [];
      const stores = storesRes.data || [];
      const now = new Date();
      return plans
        .map((p: any) => {
          const s = stores.find((x: any) => x.id === p.store_id);
          if (!s || s.is_test) return null;
          const trialActive = p.trial_ends_at && new Date(p.trial_ends_at) > now;
          const nextBilling = p.next_billing_date ? new Date(p.next_billing_date) : null;
          const daysLate = nextBilling ? Math.floor((now.getTime() - nextBilling.getTime()) / 86400000) : 0;
          let status: Status = "em_dia";
          if (!p.is_active) status = "inativo";
          else if (trialActive) status = "trial";
          else if (daysLate > 0) status = "atrasado";
          const startedAt = p.started_at ? new Date(p.started_at) : null;
          const monthsActive = startedAt
            ? Math.max(1, Math.floor((now.getTime() - startedAt.getTime()) / (86400000 * 30)))
            : 1;
          return {
            store_id: p.store_id,
            name: s.name as string,
            store_status: s.status as string,
            monthly: Number(p.monthly_fee || 0),
            status,
            daysLate: Math.max(0, daysLate),
            nextBilling: p.next_billing_date,
            lastBilled: p.last_billed_at,
            monthsActive,
            ltv: Number(p.monthly_fee || 0) * monthsActive,
          };
        })
        .filter(Boolean) as any[];
    },
    staleTime: 30_000,
  });

  const rows = data || [];

  const stats = useMemo(() => {
    const active = rows.filter((r) => r.status !== "inativo");
    const mrr = active.reduce((s, r) => s + r.monthly, 0);
    const inad = rows.filter((r) => r.status === "atrasado");
    const inadAmt = inad.reduce((s, r) => s + r.monthly, 0);
    const inadPct = active.length ? (inad.length / active.length) * 100 : 0;
    const avgMonths = active.length ? active.reduce((s, r) => s + r.monthsActive, 0) / active.length : 0;
    const avgLtv = active.length ? active.reduce((s, r) => s + r.ltv, 0) / active.length : 0;
    return { mrr, inadAmt, inadPct, ativos: active.length, avgMonths, avgLtv, inadCount: inad.length };
  }, [rows]);

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4">
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Status de Mensalidades por Loja</CardTitle>
          <Button size="sm" variant="outline" onClick={() => exportCSV("mensalidades", rows)} disabled={!rows.length}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Sem planos fixos ativos.</p>
          )}
          {rows
            .sort((a, b) => b.daysLate - a.daysLate || b.monthly - a.monthly)
            .map((r) => {
              const info = statusInfo[r.status as Status];
              const Icon = info.icon;
              return (
                <div key={r.store_id} className="border rounded-lg p-3 bg-muted/30 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="font-semibold truncate">{r.name}</span>
                    <Badge variant="outline" className={`text-[10px] ${info.color}`}>
                      <Icon className="w-3 h-3 mr-1" /> {info.label}
                    </Badge>
                    {r.status === "atrasado" && (
                      <Badge variant="destructive" className="text-[10px]">{r.daysLate}d atraso</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-muted-foreground">LTV {brl(r.ltv)}</span>
                    <span className="font-bold">{brl(r.monthly)}/mês</span>
                  </div>
                </div>
              );
            })}
        </CardContent>
      </Card>

      <details className="bg-muted/30 rounded-lg p-3">
        <summary className="cursor-pointer text-sm font-semibold">Gestão completa de planos (avançado)</summary>
        <div className="mt-3">
          <PlanosTab />
        </div>
      </details>
    </div>
  );
};

export default MensalidadesPanel;