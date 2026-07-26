import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Download, Truck, Wallet, AlertTriangle, Receipt } from "lucide-react";
import { exportCSV, brl } from "./financeExport";
import { ConfirmActionDialog } from "./ConfirmActionDialog";
import { toast } from "sonner";
import { planLabel } from "@/lib/plansInfo";

const ComissoesPanel = () => {
  const qc = useQueryClient();
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["finance-comissoes"],
    queryFn: async () => {
      const [balRes, storesRes, plansRes] = await Promise.all([
        supabase.from("store_balances").select("store_id, repasse_pendente, comissao_pendente"),
        supabase.from("stores").select("id, name, is_test, delivery_mode"),
        supabase.from("store_plans").select("store_id, plan_type, commission_rate, monthly_fee").eq("is_active", true),
      ]);
      if (balRes.error) throw balRes.error;
      const balances = balRes.data || [];
      const stores = storesRes.data || [];
      const plans = plansRes.data || [];
      return balances
        .map((b: any) => {
          const s = stores.find((x: any) => x.id === b.store_id);
          if (!s || s.is_test) return null;
          const p = plans.find((x: any) => x.store_id === b.store_id);
          return {
            store_id: b.store_id,
            name: s.name as string,
            delivery_mode: s.delivery_mode as string,
            plan_type: (p?.plan_type as string) || "—",
            commission_rate: Number(p?.commission_rate || 0),
            comissao: Number(b.comissao_pendente || 0),
            repasse: Number(b.repasse_pendente || 0),
          };
        })
        .filter(Boolean) as any[];
    },
    staleTime: 30_000,
  });

  const rows = data || [];
  const totals = useMemo(
    () => ({
      comissao: rows.reduce((s, r) => s + r.comissao, 0),
      repasse: rows.reduce((s, r) => s + r.repasse, 0),
    }),
    [rows],
  );
  const risco = totals.repasse > totals.comissao;

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  const runCharge = async () => {
    if (!target) return;
    const { error } = await supabase.functions.invoke("generate-commission-charge", {
      body: { store_id: target.id },
    });
    if (error) {
      toast.error("Falha ao gerar cobrança", { description: error.message });
      return;
    }
    toast.success(`Cobrança de comissão gerada para ${target.name}`);
    qc.invalidateQueries({ queryKey: ["finance-comissoes"] });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Wallet className="w-4 h-4" /> Comissão a Receber
            </div>
            <p className="text-2xl font-bold">{brl(totals.comissao)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Truck className="w-4 h-4" /> R$2/Entrega a Pagar
            </div>
            <p className="text-2xl font-bold text-amber-500">{brl(totals.repasse)}</p>
          </CardContent>
        </Card>
        <Card className={risco ? "border-destructive bg-destructive/5" : "border-primary bg-primary/5"}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              {risco ? <AlertTriangle className="w-4 h-4 text-destructive" /> : <Wallet className="w-4 h-4" />}
              Net Plataforma
            </div>
            <p className={`text-2xl font-bold ${risco ? "text-destructive" : "text-primary"}`}>
              {brl(totals.comissao - totals.repasse)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Comissões & Repasses por Loja</CardTitle>
          <Button size="sm" variant="outline" onClick={() => exportCSV("comissoes-repasses", rows)} disabled={!rows.length}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma loja com saldo.</p>
          )}
          {rows
            .sort((a, b) => b.comissao + b.repasse - (a.comissao + a.repasse))
            .map((r) => (
              <div key={r.store_id} className="border rounded-lg p-3 bg-muted/30">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{r.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {planLabel(r.plan_type)}
                      {r.commission_rate > 0 ? ` · ${(r.commission_rate * 100).toFixed(1)}%` : ""}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {r.delivery_mode === "own" ? "🛵 Própria" : "🚚 Plataforma"}
                    </Badge>
                  </div>
                  {r.comissao > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setTarget({ id: r.store_id, name: r.name })}
                    >
                      <Receipt className="h-3.5 w-3.5 mr-1" /> Cobrar
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-background rounded px-2 py-1.5">
                    <div className="text-muted-foreground">Comissão devida</div>
                    <div className="font-bold">{brl(r.comissao)}</div>
                  </div>
                  <div className="bg-background rounded px-2 py-1.5">
                    <div className="text-muted-foreground">R$2/entrega acumulado</div>
                    <div className="font-bold text-amber-500">{brl(r.repasse)}</div>
                  </div>
                </div>
              </div>
            ))}
        </CardContent>
      </Card>

      <ConfirmActionDialog
        open={!!target}
        onOpenChange={(v) => !v && setTarget(null)}
        title="Gerar cobrança de comissão"
        description={
          target
            ? `Será emitida uma cobrança PIX da comissão pendente para "${target.name}". Esta ação é registrada em auditoria.`
            : ""
        }
        confirmWord={target?.name || ""}
        onConfirm={runCharge}
      />
    </div>
  );
};

export default ComissoesPanel;