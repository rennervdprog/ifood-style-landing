import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, Calendar, Percent, Truck, ShoppingCart } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props { storeId: string }

const PLAN_LABEL: Record<string, string> = {
  fixed: "Essencial (mensalidade fixa)",
  commission_only: "Comissão (sem mensalidade)",
  autonomy: "Autonomia (sem taxa por entrega)",
  supporter: "Apoiador",
};

export default function PlanSummaryCard({ storeId }: Props) {
  const { data: plan } = useQuery({
    queryKey: ["plan-summary-card", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_plans")
        .select("plan_type, monthly_fee, commission_rate, pdv_enabled, pdv_fixed_fee_per_sale, next_billing_date, platform_delivery_split_override")
        .eq("store_id", storeId)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: globalSplit } = useQuery({
    queryKey: ["global-delivery-split"],
    queryFn: async () => {
      const { data } = await supabase.from("admin_settings").select("value").eq("key", "delivery_fee_config").maybeSingle();
      const v: any = data?.value;
      return Number(v?.platform_split ?? 2);
    },
  });

  if (!plan) return null;

  const deliverySplit = plan.platform_delivery_split_override ?? globalSplit ?? 2;
  const showDelivery = plan.plan_type !== "autonomy";

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="pt-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            <span className="font-bold">{PLAN_LABEL[plan.plan_type] ?? plan.plan_type}</span>
          </div>
          <Badge variant="outline" className="text-[10px]">Plano ativo</Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <Row icon={<Calendar className="h-3.5 w-3.5" />} label="Mensalidade" value={Number(plan.monthly_fee) > 0 ? `${formatBRL(Number(plan.monthly_fee))}/mês` : "Grátis"} />
          {Number(plan.commission_rate) > 0 && (
            <Row icon={<Percent className="h-3.5 w-3.5" />} label="Comissão" value={`${Number(plan.commission_rate)}% por pedido`} />
          )}
          {showDelivery && (
            <Row icon={<Truck className="h-3.5 w-3.5" />} label="Taxa por entrega" value={`${formatBRL(Number(deliverySplit))}`} />
          )}
          {plan.pdv_enabled && Number(plan.pdv_fixed_fee_per_sale) > 0 && (
            <Row icon={<ShoppingCart className="h-3.5 w-3.5" />} label="Taxa PDV" value={`${formatBRL(Number(plan.pdv_fixed_fee_per_sale))}/venda`} />
          )}
        </div>

        {plan.next_billing_date && Number(plan.monthly_fee) > 0 && (
          <div className="text-[11px] text-muted-foreground border-t pt-2">
            Próximo vencimento: <strong className="text-foreground">{format(new Date(plan.next_billing_date), "dd 'de' MMMM", { locale: ptBR })}</strong>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{icon}{label}</div>
      <div className="font-bold text-foreground">{value}</div>
    </div>
  );
}