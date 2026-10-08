import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Receipt, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { startOfMonth, endOfMonth } from "date-fns";
import QueryErrorState from "@/components/QueryErrorState";

const TYPE_LABELS: Record<string, string> = {
  sale: "Venda",
  sangria: "Sangria",
  suprimento: "Suprimento",
  refund: "Reembolso",
};

const PAYMENT_LABELS: Record<string, string> = {
  dinheiro: "Dinheiro",
  maquininha_credito: "Crédito",
  maquininha_debito: "Débito",
  maquininha_pix: "PIX maquininha",
};

/** Tipos que representam entrada de caixa (verde). */
const INFLOW_TYPES = new Set(["sale", "suprimento"]);

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * Extrato do caixa (PDV) — mês corrente.
 * Lista as movimentações de caixa (vendas, sangrias, suprimentos)
 * a partir de pdv_movements, ordenadas da mais recente para a mais antiga.
 */
export default function PdvExtratoCaixaCard({ storeId }: { storeId: string }) {
  const { data, isLoading, isSuccess, refetch } = useQuery({
    queryKey: ["pdv-financeiro-extrato-mes", storeId],
    queryFn: async () => {
      const start = startOfMonth(new Date()).toISOString();
      const end = endOfMonth(new Date()).toISOString();
      const { data, error } = await supabase
        .from("pdv_movements")
        .select("id, type, amount, payment_method, description, created_at")
        .eq("store_id", storeId)
        .in("type", ["sale", "sangria", "suprimento", "refund"])
        .gte("created_at", start)
        .lte("created_at", end)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Card className="rounded-none border-0 border-l-4 border-l-violet-500 bg-card shadow-none">
      <CardContent className="space-y-2 px-4 pb-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
            Extrato do caixa (PDV)
          </div>
          <Receipt className="h-4 w-4 text-violet-500" />
        </div>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-3/4" />
          </div>
        ) : isSuccess ? (
          (data?.length ?? 0) === 0 ? (
            <div className="text-[12px] text-muted-foreground py-2">
              Nenhuma movimentação de caixa neste mês.
            </div>
          ) : (
            <ul className="divide-y divide-border/50 max-h-72 overflow-y-auto">
              {data!.map((m: any) => {
                const inflow = INFLOW_TYPES.has(m.type as string);
                const Icon = inflow ? ArrowDownLeft : ArrowUpRight;
                return (
                  <li key={m.id} className="flex items-center justify-between gap-2 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon
                        className={`h-4 w-4 shrink-0 ${
                          inflow ? "text-emerald-500" : "text-red-500"
                        }`}
                      />
                      <div className="min-w-0">
                        <div className="text-[12px] font-semibold truncate">
                          {TYPE_LABELS[m.type as string] ?? m.type}
                          {m.payment_method && (
                            <span className="font-normal text-muted-foreground">
                              {" · "}
                              {PAYMENT_LABELS[m.payment_method as string] ?? m.payment_method}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground tabular-nums">
                          {formatDateTime(m.created_at as string)}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`text-[13px] font-bold tabular-nums shrink-0 ${
                        inflow
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-500"
                      }`}
                    >
                      {inflow ? "+" : "−"}
                      {formatBRL(Number(m.amount ?? 0))}
                    </span>
                  </li>
                );
              })}
            </ul>
          )
        ) : (
          <QueryErrorState
            title="Não foi possível carregar o extrato do caixa"
            onRetry={() => refetch()}
          />
        )}
      </CardContent>
    </Card>
  );
}
