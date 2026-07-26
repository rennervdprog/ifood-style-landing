import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/kpi-card";
import { ShieldAlert, ShieldCheck, AlertTriangle, Ban, Loader2, RefreshCw, RotateCcw } from "lucide-react";
import { toast } from "sonner";

type Report = {
  summary: { blocked_resellers_count: number; blocked_referrals_count: number; last_run_alerts: number };
  runs: Array<{ id: string; created_at: string; dry_run: boolean; processed: number; blocked: number; alerts_count: number }>;
  last_alerts: Array<any>;
  blocked_resellers: Array<{ id: string; code: string; email: string | null; notes: string | null; updated_at: string; total_referrals: number }>;
  blocked_referrals: Array<{ id: string; reseller_code: string; store_name: string | null; store_id: string; updated_at: string }>;
};

const fmt = (d: string) => new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

const reasonLabel = (r: string) => {
  if (r === "ghost_ratio") return { label: "Lojas fantasma", cls: "bg-red-100 text-red-800 border-red-300" };
  if (r === "self_referral") return { label: "Auto-indicação", cls: "bg-orange-100 text-orange-800 border-orange-300" };
  return { label: r, cls: "bg-muted text-foreground" };
};

export default function AntiFraudPanel() {
  const qc = useQueryClient();
  const q = useQuery<Report>({
    queryKey: ["admin-reseller-fraud-report"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_reseller_fraud_report" as any, { _limit: 20 });
      if (error) throw error;
      return data as Report;
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-reseller-fraud-report"] });

  const runNow = async (dry: boolean) => {
    const { data, error } = await supabase.rpc("admin_reseller_run_fraud_cron" as any, { _dry_run: dry });
    if (error) return toast.error(error.message);
    const alerts = (data as any)?.alerts?.length ?? 0;
    toast.success(`${dry ? "Simulação" : "Anti-fraude"}: ${alerts} alertas · ${(data as any)?.blocked_resellers ?? 0} bloqueados`);
    refresh();
  };

  const unblock = async (id: string, code: string) => {
    if (!confirm(`Desbloquear revendedor ${code}?`)) return;
    const reason = prompt("Motivo (opcional):") || null;
    const { error } = await supabase.rpc("admin_reseller_unblock" as any, { _reseller_id: id, _reason: reason });
    if (error) return toast.error(error.message);
    toast.success("Revendedor desbloqueado");
    refresh();
    qc.invalidateQueries({ queryKey: ["admin-reseller-list"] });
  };

  if (q.isLoading) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground p-6"><Loader2 className="h-4 w-4 animate-spin" /> Carregando painel anti-fraude…</div>;
  }
  if (q.error) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-red-600">
          Erro ao carregar painel: {(q.error as any)?.message ?? "desconhecido"}
          <Button size="sm" variant="outline" onClick={refresh} className="ml-3">Tentar novamente</Button>
        </CardContent>
      </Card>
    );
  }

  const r = q.data!;
  const lastRun = r.runs[0];

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={Ban}          label="Revendedores bloqueados" value={String(r.summary.blocked_resellers_count)} sub="status = blocked" highlight={r.summary.blocked_resellers_count > 0} />
        <KpiCard icon={AlertTriangle}label="Indicações bloqueadas"   value={String(r.summary.blocked_referrals_count)} sub="auto-indicação" />
        <KpiCard icon={ShieldAlert}  label="Alertas na última run"   value={String(r.summary.last_run_alerts)} sub={lastRun ? fmt(lastRun.created_at) : "—"} />
        <KpiCard icon={ShieldCheck}  label="Cron"                    value="Semanal" sub="dom 05:00 UTC" />
      </div>

      {/* Ações */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Ações</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => runNow(true)}>
            <ShieldCheck className="h-3 w-3 mr-1" /> Simular (dry-run)
          </Button>
          <Button size="sm" onClick={() => runNow(false)}>
            <ShieldAlert className="h-3 w-3 mr-1" /> Rodar agora
          </Button>
          <Button size="sm" variant="ghost" onClick={refresh}>
            <RefreshCw className="h-3 w-3 mr-1" /> Atualizar
          </Button>
          <p className="text-xs text-muted-foreground w-full pt-1">
            Regras: bloqueia revendedor com &gt; 30% de lojas sem pedidos em 90 dias (mín. 5 indicações) e bloqueia indicações onde o dono da loja é o próprio revendedor.
          </p>
        </CardContent>
      </Card>

      {/* Últimos alertas */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Alertas da última execução real</CardTitle></CardHeader>
        <CardContent>
          {r.last_alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum alerta na última execução. ✅</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr className="text-left">
                    <th className="py-2 pr-3">Revendedor</th>
                    <th className="pr-3">Motivo</th>
                    <th className="pr-3">Detalhes</th>
                  </tr>
                </thead>
                <tbody>
                  {r.last_alerts.map((a: any, i: number) => {
                    const rl = reasonLabel(a.reason);
                    return (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 pr-3 font-mono text-xs">{a.code}</td>
                        <td className="pr-3"><Badge variant="outline" className={rl.cls}>{rl.label}</Badge></td>
                        <td className="pr-3 text-xs text-muted-foreground">
                          {a.reason === "ghost_ratio"
                            ? `${a.ghost_refs}/${a.total_refs} fantasmas (${Math.round((a.ratio ?? 0) * 100)}%)`
                            : `store ${String(a.store_id).slice(0, 8)}…`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revendedores bloqueados */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Revendedores bloqueados ({r.blocked_resellers.length})</CardTitle></CardHeader>
        <CardContent>
          {r.blocked_resellers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum revendedor bloqueado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr className="text-left">
                    <th className="py-2 pr-3">Código</th>
                    <th className="pr-3">Email</th>
                    <th className="pr-3">Indicações</th>
                    <th className="pr-3">Bloqueado em</th>
                    <th className="pr-3">Motivo (notas)</th>
                    <th className="pr-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {r.blocked_resellers.map(b => (
                    <tr key={b.id} className="border-b last:border-0 align-top">
                      <td className="py-2 pr-3 font-mono text-xs">{b.code}</td>
                      <td className="pr-3 text-xs">{b.email ?? "—"}</td>
                      <td className="pr-3">{b.total_referrals}</td>
                      <td className="pr-3 text-xs text-muted-foreground">{fmt(b.updated_at)}</td>
                      <td className="pr-3 text-xs text-muted-foreground max-w-md whitespace-pre-wrap">{(b.notes ?? "—").split("\n").slice(-3).join("\n")}</td>
                      <td className="pr-3">
                        <Button size="sm" variant="outline" onClick={() => unblock(b.id, b.code)}>
                          <RotateCcw className="h-3 w-3 mr-1" /> Desbloquear
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Indicações bloqueadas */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Indicações bloqueadas ({r.blocked_referrals.length})</CardTitle></CardHeader>
        <CardContent>
          {r.blocked_referrals.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma indicação bloqueada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr className="text-left">
                    <th className="py-2 pr-3">Revendedor</th>
                    <th className="pr-3">Loja</th>
                    <th className="pr-3">Bloqueada em</th>
                  </tr>
                </thead>
                <tbody>
                  {r.blocked_referrals.map(b => (
                    <tr key={b.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-mono text-xs">{b.reseller_code}</td>
                      <td className="pr-3">{b.store_name ?? <span className="text-muted-foreground text-xs">store {b.store_id.slice(0,8)}…</span>}</td>
                      <td className="pr-3 text-xs text-muted-foreground">{fmt(b.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Histórico de execuções ({r.runs.length})</CardTitle></CardHeader>
        <CardContent>
          {r.runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem execuções registradas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr className="text-left">
                    <th className="py-2 pr-3">Data</th>
                    <th className="pr-3">Tipo</th>
                    <th className="pr-3">Alertas</th>
                    <th className="pr-3">Bloqueados</th>
                  </tr>
                </thead>
                <tbody>
                  {r.runs.map(run => (
                    <tr key={run.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 text-xs">{fmt(run.created_at)}</td>
                      <td className="pr-3">
                        <Badge variant="outline" className={run.dry_run ? "bg-blue-100 text-blue-800 border-blue-300" : "bg-emerald-100 text-emerald-800 border-emerald-300"}>
                          {run.dry_run ? "Dry-run" : "Real"}
                        </Badge>
                      </td>
                      <td className="pr-3">{run.alerts_count}</td>
                      <td className="pr-3">{run.blocked}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}