import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { startOfMonth, endOfMonth } from "date-fns";
import QueryErrorState from "@/components/QueryErrorState";

/**
 * Fluxo de caixa (PDV) — mês corrente.
 * Entradas = vendas do balcão + suprimentos · Saídas = sangrias.
 * Fonte: pdv_movements por tipo.
 */
export default function PdvFluxoCaixaCard({ storeId }: { storeId: string }) {
  const { data, isLoading, isSuccess, refetch } = useQuery({
    queryKey: ["pdv-financeiro-fluxo-mes", storeId],
    queryFn: async () => {
      const start = startOfMonth(new Date()).toISOString();
      const end = endOfMonth(new Date()).toISOString();
      const { data, error } = await supabase
        .from("pdv_movements")
        .select("amount, type")
        .eq("store_id", storeId)
        .in("type", ["sale", "sangria", "suprimento"])
        .gte("created_at", start)
        .lte("created_at", end);
      if (error) throw error;
      let vendas = 0;
      let sangrias = 0;
      let suprimentos = 0;
      (data ?? []).forEach((m) => {
        const v = Number(m.amount ?? 0);
        if (m.type === "sale") vendas += v;
        else if (m.type === "sangria") sangrias += v;
        else if (m.type === "suprimento") suprimentos += v;
      });
      const entradas = vendas + suprimentos;
      const saidas = sangrias;
      return { vendas, sangrias, suprimentos, entradas, saidas, saldo: entradas - saidas };
    },
  });

  return (
    <Card className="rounded-none border-0 border-l-4 border-l-blue-500 bg-card shadow-none">
      <CardContent className="space-y-2 px-4 pb-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
            Fluxo de caixa (PDV)
          </div>
          <Wallet className="h-4 w-4 text-blue-500" />
        </div>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-3.5 w-56" />
          </div>
        ) : isSuccess ? (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] text-muted-foreground">Saldo do mês</span>
              <span
                className={`text-3xl font-black tabular-nums ${
                  (data?.saldo ?? 0) >= 0
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-red-500"
                }`}
              >
                {formatBRL(data?.saldo ?? 0)}
              </span>
            </div>
            <div className="pt-1 space-y-1.5 border-t border-border/50">
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <ArrowDownLeft className="h-3 w-3 text-emerald-500" />
                  Entradas
                  <span className="text-muted-foreground/70">(vendas + suprimentos)</span>
                </span>
                <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatBRL(data?.entradas ?? 0)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <ArrowUpRight className="h-3 w-3 text-red-500" />
                  Saídas
                  <span className="text-muted-foreground/70">(sangrias)</span>
                </span>
                <span className="font-bold tabular-nums text-red-500">
                  {formatBRL(data?.saidas ?? 0)}
                </span>
              </div>
            </div>
          </>
        ) : (
          <QueryErrorState
            title="Não foi possível carregar o fluxo de caixa"
            onRetry={() => refetch()}
          />
        )}
      </CardContent>
    </Card>
  );
}
