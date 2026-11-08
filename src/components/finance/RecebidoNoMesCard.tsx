import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";

const MONTHS_PT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
import QueryErrorState from "@/components/QueryErrorState";

export default function RecebidoNoMesCard({ storeId }: { storeId: string }) {
  const { data, isLoading, isSuccess, refetch } = useQuery({
    queryKey: ["recebido-mes", storeId],
    queryFn: async () => {
      const now = new Date();
      // Dois meses de uma vez: o atual (o card) e o anterior (o comparativo).
      const start = startOfMonth(subMonths(now, 1)).toISOString();
      const end = endOfMonth(now).toISOString();
      const [ordersRes, planRes, cfgRes, pubRes] = await Promise.all([
        supabase
          .from("orders")
          .select("subtotal, delivery_fee, payment_method, status, created_at")
          .eq("store_id", storeId)
          .in("status", ["entregue", "finalizado"])
          .gte("created_at", start)
          .lte("created_at", end),
        supabase
          .from("store_plans")
          .select("plan_type, commission_rate, platform_delivery_split_override")
          .eq("store_id", storeId)
          .eq("is_active", true)
          .maybeSingle(),
        supabase.from("admin_settings").select("value").eq("key", "delivery_fee_config").maybeSingle(),
        (supabase as any).from("stores_public").select("platform_split_effective").eq("id", storeId).maybeSingle(),
      ]);
      if (ordersRes.error) throw ordersRes.error;
      const orders = ordersRes.data ?? [];
      const plan: any = planRes.data;
      // Taxa oficial da plataforma: a efetiva da loja (stores_public) e, na
      // falta dela, a config global; o último recurso é o valor oficial
      // R$ 0,99 — nunca um número inventado (o fallback antigo era R$ 2).
      const effectiveSplit = Number((pubRes.data as any)?.platform_split_effective);
      const configSplit = Number((cfgRes.data?.value as any)?.platform_split);
      const globalSplit = Number.isFinite(effectiveSplit) && effectiveSplit >= 0
        ? effectiveSplit
        : Number.isFinite(configSplit)
          ? configSplit
          : 0.99;
      const split = Number(plan?.platform_delivery_split_override ?? globalSplit);
      const isFixed = ["fixed", "supporter", "autonomy"].includes(plan?.plan_type);
      const commissionRate = Number(plan?.commission_rate ?? 0) / 100;
      const pixFee = isFixed ? 1.99 : 0;

      const net = (o: any) => {
        const sub = Number(o.subtotal ?? 0);
        const hasDelivery = Number(o.delivery_fee ?? 0) > 0;
        // A taxa operacional do Pix vale pro Pix comum E pro Pix direto.
        const isPix = o.payment_method === "pix" || o.payment_method === "pix_direto";
        const platformSplit = hasDelivery ? split : 0;
        const pix = isPix ? pixFee : 0;
        const commission = sub * commissionRate;
        return sub - platformSplit - pix - commission;
      };

      let liquido = 0;
      let count = 0;
      let prevLiquido = 0;
      for (const o of orders) {
        const d = new Date((o as any).created_at);
        const isCurrent = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        if (isCurrent) {
          liquido += net(o);
          count += 1;
        } else {
          prevLiquido += net(o);
        }
      }
      return { total: liquido, count, prevTotal: prevLiquido };
    },
  });

  const prevMonthName = MONTHS_PT[subMonths(new Date(), 1).getMonth()];
  const momDelta = data && data.prevTotal > 0 ? ((data.total - data.prevTotal) / data.prevTotal) * 100 : 0;

  return (
    <Card className="rounded-none border-0 border-l-4 border-l-emerald-500 bg-card shadow-none">
      <CardContent className="space-y-2 px-4 pb-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">Recebido líquido no mês</div>
          <TrendingUp className="h-4 w-4 text-emerald-500" />
        </div>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-3.5 w-56" />
          </div>
        ) : isSuccess ? (
          <>
            <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{formatBRL(data?.total ?? 0)}</div>
            <div className="text-[11px] text-muted-foreground">
              {data?.count ?? 0} pedidos entregues · já descontadas taxas
            </div>
            {(data?.prevTotal ?? 0) > 0 ? (
              <div className={`flex items-center gap-1 text-[11px] font-bold ${momDelta >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                {momDelta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {momDelta >= 0 ? "+" : ""}{momDelta.toFixed(1).replace(".", ",")}% vs {prevMonthName} ({formatBRL(data?.prevTotal ?? 0)})
              </div>
            ) : (data?.total ?? 0) > 0 ? (
              <div className="text-[11px] text-muted-foreground">Sem vendas em {prevMonthName} pra comparar</div>
            ) : null}
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
