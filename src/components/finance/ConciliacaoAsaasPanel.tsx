import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, AlertTriangle, RefreshCw, Download, Zap } from "lucide-react";
import { exportCSV, brl } from "./financeExport";
import { toast } from "sonner";
import { useState } from "react";
import { ConfirmActionDialog } from "./ConfirmActionDialog";

const ConciliacaoAsaasPanel = () => {
  const [forceOpen, setForceOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<any[] | null>(null);
  const [snapLoading, setSnapLoading] = useState(false);

  const subaccounts = useQuery({
    queryKey: ["finance-asaas-subaccounts"],
    queryFn: async () => {
      const [storesRes, balancesRes] = await Promise.all([
        supabase
          .from("stores")
          .select("id, name, asaas_wallet_id, is_test")
          .not("asaas_wallet_id", "is", null),
        supabase.from("store_balances").select("store_id, comissao_pendente, repasse_pendente"),
      ]);
      const balances = balancesRes.data || [];
      return (storesRes.data || [])
        .filter((s: any) => !s.is_test)
        .map((s: any) => {
          const b = balances.find((x: any) => x.store_id === s.id);
          return {
            id: s.id,
            name: s.name as string,
            wallet: s.asaas_wallet_id as string,
            status: s.asaas_activation_status as string,
            interno: Number(b?.comissao_pendente || 0) - Number(b?.repasse_pendente || 0),
          };
        });
    },
    staleTime: 60_000,
  });

  const reviewQueue = useQuery({
    queryKey: ["finance-asaas-review"],
    queryFn: async () => {
      const { data } = await supabase
        .from("asaas_transfer_review_queue")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    staleTime: 30_000,
  });

  const webhookErrors = useQuery({
    queryKey: ["finance-asaas-webhook-errors"],
    queryFn: async () => {
      const { data } = await supabase
        .from("asaas_webhook_events")
        .select("id, event_type, created_at, processed, error")
        .or("processed.eq.false,error.not.is.null")
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    staleTime: 30_000,
  });

  const recRows = subaccounts.data || [];
  const queue = reviewQueue.data || [];
  const errors = webhookErrors.data || [];

  const runReconcile = async () => {
    const { error } = await supabase.functions.invoke("reconcile-payments", { body: {} });
    if (error) {
      toast.error("Falha na reconciliação", { description: error.message });
      return;
    }
    toast.success("Reconciliação iniciada");
    subaccounts.refetch();
    reviewQueue.refetch();
    webhookErrors.refetch();
  };

  const runSnapshot = async () => {
    setSnapLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("finance-reconcile-snapshot", { body: {} });
      if (error) throw error;
      setSnapshot((data as any)?.items || []);
      toast.success("Snapshot Asaas atualizado");
    } catch (e: any) {
      toast.error("Falha ao gerar snapshot", { description: e?.message });
    } finally {
      setSnapLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <ShieldCheck className="w-4 h-4 text-emerald-500" /> Subcontas Ativas
            </div>
            <p className="text-2xl font-bold">{recRows.length}</p>
          </CardContent>
        </Card>
        <Card className={queue.length ? "border-amber-500 bg-amber-500/5" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> Fila de Revisão
            </div>
            <p className="text-2xl font-bold text-amber-500">{queue.length}</p>
          </CardContent>
        </Card>
        <Card className={errors.length ? "border-destructive bg-destructive/5" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <AlertTriangle className="w-4 h-4 text-destructive" /> Webhooks com Erro
            </div>
            <p className="text-2xl font-bold text-destructive">{errors.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Saldo Interno por Subconta</CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                subaccounts.refetch();
                reviewQueue.refetch();
                webhookErrors.refetch();
                toast.success("Conciliação atualizada");
              }}
            >
              <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setForceOpen(true)}>
              <Zap className="h-4 w-4 mr-1" /> Forçar
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportCSV("conciliacao-asaas", recRows)}>
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {subaccounts.isLoading && <Skeleton className="h-32 w-full" />}
          {!subaccounts.isLoading && recRows.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma subconta ativa.</p>
          )}
          {recRows.map((r) => (
            <div key={r.id} className="border rounded-lg p-3 bg-muted/30 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold">{r.name}</span>
                <Badge variant="outline" className="text-[10px] font-mono">{String(r.wallet).slice(0, 8)}…</Badge>
                <Badge variant={r.status === "APPROVED" ? "default" : "secondary"} className="text-xs">
                  {r.status || "—"}
                </Badge>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-muted-foreground">Saldo interno (net)</div>
                <div className={`font-bold ${r.interno >= 0 ? "" : "text-destructive"}`}>{brl(r.interno)}</div>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2">
            <p className="text-[10px] text-muted-foreground">
              Compare saldo interno vs saldo real Asaas (chamada às subcontas).
            </p>
            <Button size="sm" onClick={runSnapshot} disabled={snapLoading}>
              {snapLoading ? "Coletando…" : "Snapshot Asaas"}
            </Button>
          </div>
          {snapshot && (
            <div className="mt-2 space-y-1">
              {snapshot.map((it: any) => {
                const dangerous = it.diff !== null && Math.abs(it.diff) > 0.5;
                return (
                  <div
                    key={it.store_id}
                    className={`flex items-center justify-between text-xs border rounded px-2 py-1.5 ${
                      dangerous ? "border-destructive bg-destructive/5" : "bg-background"
                    }`}
                  >
                    <span className="font-medium truncate">{it.name}</span>
                    <span className="flex gap-3">
                      <span>Asaas: <strong>{it.asaas_balance == null ? "—" : brl(it.asaas_balance)}</strong></span>
                      <span>Interno: <strong>{brl(it.internal_balance)}</strong></span>
                      <span className={dangerous ? "text-destructive font-bold" : "text-muted-foreground"}>
                        Δ {it.diff == null ? "—" : brl(it.diff)}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {errors.length > 0 && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Webhooks Asaas com Erro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {errors.map((e: any) => (
              <div key={e.id} className="border rounded-lg p-2 bg-destructive/5">
                <div className="flex items-center justify-between">
                  <span className="font-mono">{e.event_type}</span>
                  <span className="text-muted-foreground">
                    {new Date(e.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
                {e.error && <div className="text-destructive mt-1">{e.error}</div>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <ConfirmActionDialog
        open={forceOpen}
        onOpenChange={setForceOpen}
        title="Forçar reconciliação Asaas"
        description="Vai reprocessar pagamentos pendentes contra o Asaas e atualizar saldos internos. Pode levar alguns minutos."
        confirmWord="RECONCILIAR"
        destructive
        onConfirm={runReconcile}
      />
    </div>
  );
};

export default ConciliacaoAsaasPanel;