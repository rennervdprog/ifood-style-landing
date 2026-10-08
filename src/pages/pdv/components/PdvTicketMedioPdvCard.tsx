import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Receipt } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { startOfMonth, endOfMonth } from "date-fns";
import QueryErrorState from "@/components/QueryErrorState";

/**
 * Ticket médio (PDV) — mês corrente, só vendas do balcão.
 */
export default function PdvTicketMedioPdvCard({ storeId }: { storeId: string }) {
  const { data, isLoading, isSuccess, refetch } = useQuery({
    queryKey: ["pdv-financeiro-ticket-mes", storeId],
    queryFn: async () => {
      const start = startOfMonth(new Date()).toISOString();
      const end = endOfMonth(new Date()).toISOString();
      const { data, error } = await supabase
        .from("orders")
        .select("total_price")
        .eq("store_id", storeId)
        .eq("order_source", "pdv")
        .eq("status", "finalizado")
        .gte("created_at", start)
        .lte("created_at", end);
      if (error) throw error;
      const orders = data ?? [];
      const total = orders.reduce((s, o) => s + Number(o.total_price ?? 0), 0);
      return { avg: orders.length > 0 ? total / orders.length : 0, count: orders.length };
    },
  });

  return (
    <Card className="rounded-none border-0 border-l-4 border-l-violet-500 bg-card shadow-none">
      <CardContent className="space-y-2 px-4 pb-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
            Ticket médio (PDV)
          </div>
          <Receipt className="h-4 w-4 text-violet-500" />
        </div>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-3.5 w-56" />
          </div>
        ) : isSuccess ? (
          <>
            <div className="text-3xl font-black tabular-nums text-violet-600 dark:text-violet-400">
              {formatBRL(data?.avg ?? 0)}
            </div>
            <div className="text-[11px] text-muted-foreground">
              por venda no balcão · {data?.count ?? 0} vendas no mês
            </div>
          </>
        ) : (
          <QueryErrorState
            title="Não foi possível carregar o ticket médio"
            onRetry={() => refetch()}
          />
        )}
      </CardContent>
    </Card>
  );
}
