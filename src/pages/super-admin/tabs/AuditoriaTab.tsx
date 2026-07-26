import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ShieldCheck, Webhook, Activity, RefreshCw, ScrollText, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type View = "audit" | "webhooks" | "compliance";

type ComplianceCheck = { id: string; clause: string; title: string; status: "pass" | "warn" | "fail"; detail: string };

export default function AuditoriaTab() {
  const [view, setView] = useState<View>("audit");
  const [reconciling, setReconciling] = useState(false);
  const [compliance, setCompliance] = useState<{ summary: any; checks: ComplianceCheck[]; checked_at: string } | null>(null);
  const [complianceLoading, setComplianceLoading] = useState(false);

  const runCompliance = async () => {
    setComplianceLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("terms-compliance-check");
      if (error) throw error;
      setCompliance(data as any);
      const s = (data as any).summary;
      toast.success(`Auditoria concluída: ${s.pass} ok · ${s.warn} avisos · ${s.fail} falhas`);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao rodar auditoria de compliance.");
    } finally {
      setComplianceLoading(false);
    }
  };

  const { data: audit, isLoading: auditLoading, refetch: refetchAudit } = useQuery({
    queryKey: ["financial-audit-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_audit_log" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: view === "audit",
  });

  const { data: webhooks, isLoading: whLoading, refetch: refetchWh } = useQuery({
    queryKey: ["asaas-webhook-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asaas_webhook_events" as any)
        .select("*")
        .order("processed_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: view === "webhooks",
  });

  const runReconcile = async () => {
    setReconciling(true);
    try {
      const { data, error } = await supabase.functions.invoke("reconcile-payments");
      if (error) throw error;
      toast.success(`Reconciliação: ${(data as any)?.reconciled ?? 0} regularizadas, ${(data as any)?.checked ?? 0} verificadas.`);
      refetchAudit();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao reconciliar.");
    } finally {
      setReconciling(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={view === "audit" ? "default" : "outline"}
            onClick={() => setView("audit")}
          >
            <ShieldCheck className="h-4 w-4 mr-1" /> Audit Log
          </Button>
          <Button
            size="sm"
            variant={view === "webhooks" ? "default" : "outline"}
            onClick={() => setView("webhooks")}
          >
            <Webhook className="h-4 w-4 mr-1" /> Webhooks Asaas
          </Button>
          <Button
            size="sm"
            variant={view === "compliance" ? "default" : "outline"}
            onClick={() => setView("compliance")}
          >
            <ScrollText className="h-4 w-4 mr-1" /> Compliance Termos
          </Button>
        </div>
        <div className="flex gap-2">
          {view === "compliance" ? (
            <Button size="sm" onClick={runCompliance} disabled={complianceLoading}>
              {complianceLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ScrollText className="h-4 w-4 mr-1" />}
              Rodar auditoria
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={() => view === "audit" ? refetchAudit() : refetchWh()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button size="sm" onClick={runReconcile} disabled={reconciling}>
                {reconciling ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Activity className="h-4 w-4 mr-1" />}
                Reconciliar agora
              </Button>
            </>
          )}
        </div>
      </div>

      {view === "audit" && (
        <div className="rounded-xl border bg-card overflow-hidden">
          {auditLoading ? (
            <div className="p-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : !audit || audit.length === 0 ? (
            <div className="p-10 flex flex-col items-center gap-2 text-muted-foreground">
              <ShieldCheck className="h-8 w-8 opacity-40" />
              <p className="text-sm font-bold text-foreground">Nenhum evento registrado</p>
              <p className="text-xs">Eventos financeiros aparecerão aqui em tempo real.</p>
            </div>
          ) : (
            <div className="divide-y divide-border tabular-nums">
              {audit.map((a: any, i: number) => (
                <div key={a.id} className={`p-3 text-xs flex flex-wrap gap-2 items-center ${i % 2 ? "bg-muted/20" : ""}`}>
                  <span className="font-mono text-muted-foreground">{new Date(a.created_at).toLocaleString("pt-BR", { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' ·')}</span>
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold uppercase text-[10px] tracking-wider">{a.action}</span>
                  <span className="text-muted-foreground">{a.entity_type}</span>
                  <span className="font-mono truncate max-w-[200px]">{a.entity_id}</span>
                  {a.amount && <span className="font-bold">R$ {Number(a.amount).toFixed(2)}</span>}
                  <span className="text-muted-foreground ml-auto">{a.actor_type}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === "webhooks" && (
        <div className="rounded-xl border bg-card overflow-hidden">
          {whLoading ? (
            <div className="p-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : !webhooks || webhooks.length === 0 ? (
            <div className="p-10 flex flex-col items-center gap-2 text-muted-foreground">
              <Webhook className="h-8 w-8 opacity-40" />
              <p className="text-sm font-bold text-foreground">Nenhum webhook recebido</p>
              <p className="text-xs">Webhooks do Asaas aparecerão aqui.</p>
            </div>
          ) : (
            <div className="divide-y divide-border tabular-nums">
              {webhooks.map((w: any, i: number) => (
                <div key={w.id} className={`p-3 text-xs flex flex-wrap gap-2 items-center ${i % 2 ? "bg-muted/20" : ""}`}>
                  <span className="font-mono text-muted-foreground">{new Date(w.processed_at).toLocaleString("pt-BR", { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' ·')}</span>
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold uppercase text-[10px] tracking-wider">{w.event_type}</span>
                  <span className="font-mono truncate max-w-[180px]">{w.payment_id || "—"}</span>
                  <span className="text-muted-foreground ml-auto">{w.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === "compliance" && (
        <div className="space-y-3">
          {compliance && (
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div className="rounded-lg border bg-card p-3">
                <div className="text-muted-foreground">Total</div>
                <div className="text-lg font-bold">{compliance.summary.total}</div>
              </div>
              <div className="rounded-lg border bg-emerald-500/10 p-3">
                <div className="text-emerald-600 dark:text-emerald-400">OK</div>
                <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{compliance.summary.pass}</div>
              </div>
              <div className="rounded-lg border bg-amber-500/10 p-3">
                <div className="text-amber-600 dark:text-amber-400">Avisos</div>
                <div className="text-lg font-bold text-amber-600 dark:text-amber-400">{compliance.summary.warn}</div>
              </div>
              <div className="rounded-lg border bg-red-500/10 p-3">
                <div className="text-red-600 dark:text-red-400">Falhas</div>
                <div className="text-lg font-bold text-red-600 dark:text-red-400">{compliance.summary.fail}</div>
              </div>
            </div>
          )}

          <div className="rounded-xl border bg-card overflow-hidden">
            {!compliance ? (
              <div className="p-10 flex flex-col items-center gap-2 text-muted-foreground">
                <ScrollText className="h-8 w-8 opacity-40" />
                <p className="text-sm font-bold text-foreground">Auditoria Termos × Código</p>
                <p className="text-xs text-center max-w-md">
                  Valida se o backend implementa fielmente as cláusulas dos Termos de Uso
                  (VIP vitalícia, grace period, restrição parcial, add-ons, saques, estornos, etc.).
                </p>
                <Button size="sm" className="mt-2" onClick={runCompliance} disabled={complianceLoading}>
                  {complianceLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ScrollText className="h-4 w-4 mr-1" />}
                  Rodar agora
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {compliance.checks.map((c) => {
                  const Icon = c.status === "pass" ? CheckCircle2 : c.status === "warn" ? AlertTriangle : XCircle;
                  const color = c.status === "pass" ? "text-emerald-600 dark:text-emerald-400" : c.status === "warn" ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
                  return (
                    <div key={c.id} className="p-3 flex gap-3 items-start">
                      <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Cl. {c.clause}</span>
                          <span className="text-sm font-bold">{c.title}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{c.detail}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {compliance && (
            <p className="text-[11px] text-muted-foreground text-center">
              Última verificação: {new Date(compliance.checked_at).toLocaleString("pt-BR")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}