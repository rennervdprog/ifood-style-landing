import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { startOfMonth, endOfMonth } from "date-fns";

export default function RecebidoNoMesCard({ storeId }: { storeId: string }) {
  const { data } = useQuery({
    queryKey: ["recebido-mes", storeId],
    queryFn: async () => {
      const start = startOfMonth(new Date()).toISOString();
      const end = endOfMonth(new Date()).toISOString();
      const { data, error } = await supabase
        .from("orders")
        .select("total_price, status")
        .eq("store_id", storeId)
        .in("status", ["entregue", "finalizado"])
        .gte("created_at", start)
        .lte("created_at", end);
      if (error) throw error;
      const total = (data ?? []).reduce((s, o) => s + Number(o.total_price ?? 0), 0);
      return { total, count: data?.length ?? 0 };
    },
  });

  return (
    <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent">
      <CardContent className="pt-5 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">Recebido no mês</div>
          <TrendingUp className="h-4 w-4 text-emerald-500" />
        </div>
        <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{formatBRL(data?.total ?? 0)}</div>
        <div className="text-[11px] text-muted-foreground">{data?.count ?? 0} pedidos entregues</div>
      </CardContent>
    </Card>
  );
}