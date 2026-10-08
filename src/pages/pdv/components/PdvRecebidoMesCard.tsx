import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingBag } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { startOfMonth, endOfMonth } from "date-fns";
import QueryErrorState from "@/components/QueryErrorState";

const PAYMENT_LABELS: Record<string, string> = {
  dinheiro: "Dinheiro",
  maquininha_credito: "Crédito",
  maquininha_debito: "Débito",
  maquininha_pix: "PIX maquininha",
};

/**
 * Recebido no mês (PDV) — soma das vendas do balcão no mês corrente.
 * Nativo do PDV: usa orders com order_source='pdv' (não inclui delivery),
 * ao contrário do RecebidoNoMesCard do dashboard, que conta só delivery.
 */
export default function PdvRecebidoMesCard({ storeId }: { storeId: string }) {
  const { data, isLoading, isSuccess, refetch } = useQuery({
    queryKey: ["pdv-financeiro-recebido-mes", storeId],
    queryFn: async () => {
      const start = startOfMonth(new Date()).toISOString();
      const end = endOfMonth(new Date()).toISOString();
      const { data, error } = await supabase
        .from("orders")
        .select("total_price, payment_method")
        .eq("store_id", storeId)
        .eq("order_source", "pdv")
        .eq("status", "finalizado")
        .gte("created_at", start)
        .lte("created_at", end);
      if (error) throw error;
      const orders = data ?? [];
      const total = orders.reduce((s, o) => s + Number(o.total_price ?? 0), 0);
      const byPayment: Record<string, number> = {};
      orders.forEach((o) => {
        const k = (o.payment_method as string | null) || "outros";
        byPayment[k] = (byPayment[k] ?? 0) + Number(o.total_price ?? 0);
      });
      const top = Object.entries(byPayment)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
      return { total, count: orders.length, top };
    },
  });

  return (
    <Card className="rounded-none border-0 border-l-4 border-l-emerald-500 bg-card shadow-none">
      <CardContent className="space-y-2 px-4 pb-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
            Recebido no mês (PDV)
          </div>
          <ShoppingBag className="h-4 w-4 text-emerald-500" />
        </div>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-3.5 w-56" />
          </div>
        ) : isSuccess ? (
          <>
            <div className="text-3xl font-black tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatBRL(data?.total ?? 0)}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {data?.count ?? 0} vendas no balcão · valores brutos
            </div>
            {(data?.top?.length ?? 0) > 0 && (
              <div className="pt-1 space-y-1 border-t border-border/50">
                {data!.top.map(([method, value]) => (
                  <div key={method} className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">
                      {PAYMENT_LABELS[method] ?? method}
                    </span>
                    <span className="font-bold tabular-nums text-foreground">
                      {formatBRL(value)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <QueryErrorState
            title="Não foi possível carregar o recebido do mês"
            onRetry={() => refetch()}
          />
        )}
      </CardContent>
    </Card>
  );
}
