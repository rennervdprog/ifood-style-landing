import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowDownRight, ArrowUpRight, Download, Wallet } from "lucide-react";
import { exportCSV, brl } from "./financeExport";

type Period = "7" | "30" | "90";

const FluxoCaixaPanel = () => {
  const [period, setPeriod] = useState<Period>("30");

  const { data, isLoading } = useQuery({
    queryKey: ["finance-fluxo-caixa", period],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - Number(period));
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("id, amount, type, created_at, description")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });

  const byDay = useMemo(() => {
    const map = new Map<string, { date: string; in: number; out: number }>();
    (data || []).forEach((t: any) => {
      const day = String(t.created_at).slice(0, 10);
      const v = Number(t.amount || 0);
      const isIn = ["credit", "deposit", "payment_received", "income"].includes(String(t.type || "").toLowerCase()) || v > 0;
      const cur = map.get(day) || { date: day, in: 0, out: 0 };
      if (isIn) cur.in += Math.abs(v);
      else cur.out += Math.abs(v);
      map.set(day, cur);
    });
    const arr = Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
    let acc = 0;
    return arr.map((r) => {
      const saldo = r.in - r.out;
      acc += saldo;
      return { ...r, saldo, acumulado: acc };
    });
  }, [data]);

  const totalIn = byDay.reduce((s, r) => s + r.in, 0);
  const totalOut = byDay.reduce((s, r) => s + r.out, 0);
  const saldo = totalIn - totalOut;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2">
          {(["7", "30", "90"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                period === p ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {p} dias
            </button>
          ))}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => exportCSV(`fluxo-caixa-${period}d`, byDay)}
          disabled={!byDay.length}
        >
          <Download className="h-4 w-4 mr-1" /> CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <ArrowUpRight className="w-4 h-4 text-emerald-500" /> Entradas
            </div>
            <p className="text-2xl font-bold text-emerald-500">{brl(totalIn)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <ArrowDownRight className="w-4 h-4 text-destructive" /> Saídas
            </div>
            <p className="text-2xl font-bold text-destructive">{brl(totalOut)}</p>
          </CardContent>
        </Card>
        <Card className="border-primary bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Wallet className="w-4 h-4" /> Saldo do Período
            </div>
            <p className={`text-2xl font-bold ${saldo >= 0 ? "text-primary" : "text-destructive"}`}>{brl(saldo)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fluxo Diário</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <Skeleton className="h-48 w-full" />}
          {!isLoading && byDay.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma movimentação no período.
            </p>
          )}
          {!isLoading && byDay.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground border-b">
                  <tr>
                    <th className="text-left py-2 px-2">Data</th>
                    <th className="text-right py-2 px-2">Entradas</th>
                    <th className="text-right py-2 px-2">Saídas</th>
                    <th className="text-right py-2 px-2">Saldo dia</th>
                    <th className="text-right py-2 px-2">Acumulado</th>
                  </tr>
                </thead>
                <tbody>
                  {byDay.map((r) => (
                    <tr key={r.date} className="border-b last:border-0">
                      <td className="py-2 px-2 font-medium">
                        {new Date(r.date).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="py-2 px-2 text-right text-emerald-500">{brl(r.in)}</td>
                      <td className="py-2 px-2 text-right text-destructive">{brl(r.out)}</td>
                      <td className={`py-2 px-2 text-right font-semibold ${r.saldo >= 0 ? "" : "text-destructive"}`}>
                        {brl(r.saldo)}
                      </td>
                      <td className="py-2 px-2 text-right font-bold">{brl(r.acumulado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Badge variant="outline" className="text-[10px]">
        Fonte: financial_transactions · período: últimos {period} dias
      </Badge>
    </div>
  );
};

export default FluxoCaixaPanel;