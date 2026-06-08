import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ShieldCheck, Webhook, Activity, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type View = "audit" | "webhooks";

export default function AuditoriaTab() {
  const [view, setView] = useState<View>("audit");
  const [reconciling, setReconciling] = useState(false);

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
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => view === "audit" ? refetchAudit() : refetchWh()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={runReconcile} disabled={reconciling}>
            {reconciling ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Activity className="h-4 w-4 mr-1" />}
            Reconciliar agora
          </Button>
        </div>
      </div>

      {view === "audit" && (
        <div className="rounded-xl border bg-card">
          {auditLoading ? (
            <div className="p-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : !audit || audit.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhum evento registrado ainda.</p>
          ) : (
            <div className="divide-y">
              {audit.map((a: any) => (
                <div key={a.id} className="p-3 text-xs flex flex-wrap gap-2 items-center">
                  <span className="font-mono text-muted-foreground">{new Date(a.created_at).toLocaleString("pt-BR")}</span>
                  <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold">{a.action}</span>
                  <span className="text-muted-foreground">{a.entity_type}</span>
                  <span className="font-mono truncate max-w-[200px]">{a.entity_id}</span>
                  {a.amount && <span className="font-semibold">R$ {Number(a.amount).toFixed(2)}</span>}
                  <span className="text-muted-foreground ml-auto">{a.actor_type}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === "webhooks" && (
        <div className="rounded-xl border bg-card">
          {whLoading ? (
            <div className="p-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : !webhooks || webhooks.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhum webhook registrado.</p>
          ) : (
            <div className="divide-y">
              {webhooks.map((w: any) => (
                <div key={w.id} className="p-3 text-xs flex flex-wrap gap-2 items-center">
                  <span className="font-mono text-muted-foreground">{new Date(w.processed_at).toLocaleString("pt-BR")}</span>
                  <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-700 font-semibold">{w.event_type}</span>
                  <span className="font-mono truncate max-w-[180px]">{w.payment_id || "—"}</span>
                  <span className="text-muted-foreground ml-auto">{w.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}