import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, CheckCircle2, Crown, Truck, Percent, ShoppingCart } from "lucide-react";
import { brl, exportCSV } from "@/components/finance/financeExport";

const KIND_LABEL: Record<string, { label: string; icon: typeof Crown; color: string }> = {
  mensalidade: { label: "Mensalidade", icon: Crown, color: "text-primary" },
  comissao: { label: "Comissão", icon: Percent, color: "text-primary" },
  entrega_fee: { label: "Taxa/entrega", icon: Truck, color: "text-amber-500" },
  pdv_fee: { label: "PDV", icon: ShoppingCart, color: "text-emerald-500" },
  repasse: { label: "Repasse", icon: CheckCircle2, color: "text-emerald-500" },
};

type Period = "7d" | "30d" | "90d" | "all";

const HistoricoRepassesTab = () => {
  const [period, setPeriod] = useState<Period>("30d");
  const [kindFilter, setKindFilter] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["historico-repasses", period],
    queryFn: async () => {
      let q = supabase
        .from("payout_history")
        .select("*")
        .eq("entity_type", "store")
        .order("created_at", { ascending: false })
        .limit(500);
      if (period !== "all") {
        const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
        const since = new Date(Date.now() - days * 86400000).toISOString();
        q = q.gte("created_at", since);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 30_000,
  });

  const rows = data || [];
  const filtered = useMemo(
    () => (kindFilter === "all" ? rows : rows.filter((r) => (r.kind || "repasse") === kindFilter)),
    [rows, kindFilter],
  );
  const total = useMemo(() => filtered.reduce((s, r) => s + Number(r.amount || 0), 0), [filtered]);

  return (
    <div className="space-y-4">
      <Card className="border-emerald-500/40 bg-emerald-500/5">
        <CardContent className="p-5">
          <p className="text-xs text-muted-foreground mb-1">Total recebido no período</p>
          <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{brl(total)}</p>
          <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">{filtered.length} registro(s)</p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        {(["7d", "30d", "90d", "all"] as Period[]).map((p) => (
          <Button
            key={p}
            size="sm"
            variant={period === p ? "default" : "outline"}
            onClick={() => setPeriod(p)}
          >
            {p === "7d" ? "7 dias" : p === "30d" ? "30 dias" : p === "90d" ? "90 dias" : "Tudo"}
          </Button>
        ))}
        <select
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value)}
          className="bg-card border border-border rounded-md text-xs px-2 py-1.5"
        >
          <option value="all">Todos os tipos</option>
          <option value="mensalidade">Mensalidade</option>
          <option value="comissao">Comissão</option>
          <option value="entrega_fee">Taxa/entrega</option>
          <option value="pdv_fee">PDV</option>
          <option value="repasse">Repasse genérico</option>
        </select>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            exportCSV(
              `historico-repasses-${period}`,
              filtered.map((r) => ({
                data: new Date(r.created_at).toLocaleString("pt-BR"),
                loja: r.entity_name,
                tipo: KIND_LABEL[r.kind || "repasse"]?.label || r.kind,
                valor: Number(r.amount).toFixed(2),
                observacao: r.notes || "",
              })),
            )
          }
          disabled={!filtered.length}
        >
          <Download className="w-4 h-4 mr-1" /> CSV
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nenhum repasse registrado no período.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const meta = KIND_LABEL[r.kind || "repasse"] || KIND_LABEL.repasse;
            const Icon = meta.icon;
            return (
              <Card key={r.id}>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg bg-muted flex items-center justify-center ${meta.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm truncate">{r.entity_name}</span>
                      <Badge variant="outline" className="text-[10px]">{meta.label}</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {new Date(r.created_at).toLocaleString("pt-BR")}
                      {r.notes ? ` · ${r.notes}` : ""}
                    </p>
                  </div>
                  <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {brl(Number(r.amount))}
                  </span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HistoricoRepassesTab;