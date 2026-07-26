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
      const [ordersRes, planRes, cfgRes] = await Promise.all([
        supabase
          .from("orders")
          .select("subtotal, delivery_fee, payment_method, status")
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
      ]);
      if (ordersRes.error) throw ordersRes.error;
      const orders = ordersRes.data ?? [];
      const plan: any = planRes.data;
      const globalSplit = Number((cfgRes.data?.value as any)?.platform_split ?? 2);
      const split = Number(plan?.platform_delivery_split_override ?? globalSplit);
      const isFixed = ["fixed", "supporter", "autonomy"].includes(plan?.plan_type);
      const commissionRate = Number(plan?.commission_rate ?? 0) / 100;
      const pixFee = isFixed ? 1.99 : 0;

      let liquido = 0;
      for (const o of orders) {
        const sub = Number(o.subtotal ?? 0);
        const hasDelivery = Number(o.delivery_fee ?? 0) > 0;
        const isPix = o.payment_method === "pix";
        const platformSplit = hasDelivery ? split : 0;
        const pix = isPix ? pixFee : 0;
        const commission = sub * commissionRate;
        liquido += sub - platformSplit - pix - commission;
      }
      return { total: liquido, count: orders.length };
    },
  });

  return (
    <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent">
      <CardContent className="pt-5 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">Recebido líquido no mês</div>
          <TrendingUp className="h-4 w-4 text-emerald-500" />
        </div>
        <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{formatBRL(data?.total ?? 0)}</div>
        <div className="text-[11px] text-muted-foreground">
          {data?.count ?? 0} pedidos entregues · já descontadas taxas
        </div>
      </CardContent>
    </Card>
  );
}