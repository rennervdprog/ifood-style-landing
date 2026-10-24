/**
 * TELA 4 — CÓPIA DE TESTE (/admin-teste) de src/components/finance/PlanSummaryCard.tsx.
 * Idêntica ao original, EXCETO:
 * 1. Wrappers canônicos da Tela 1 (AdminCardTeste / AdminMoneyTeste /
 *    AdminBadgeTeste) em vez de Card/Badge hand-rolled com 10px/11px.
 * 2. CORREÇÃO DE TEXTO LEGADO: a linha legada de taxa PIX por pedido virou
 *    "Pix direto — Sem taxa do ItaSuper". O modelo atual é Pix direto na
 *    conta da loja, sem taxa do ItaSuper; essa taxa não existe mais.
 * 3. A taxa de plataforma por entrega já era 0,99 no original e segue 0,99.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Percent, Truck, ShoppingCart, Smartphone } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AdminBadgeTeste,
  AdminCardTeste,
  AdminMoneyTeste,
} from "./AdminBaseTeste";

interface Props { storeId: string }

const PLAN_LABEL: Record<string, string> = {
  fixed: "Essencial (mensalidade fixa)",
  commission_only: "Comissão (sem mensalidade)",
  autonomy: "Autonomia (sem taxa por entrega)",
  supporter: "Apoiador",
  pdv_only: "Somente PDV",
};

export default function PlanSummaryCardTeste({ storeId }: Props) {
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
      return Number(v?.platform_split ?? 0.99);
    },
  });

  if (!plan) return null;

  const deliverySplit = plan.platform_delivery_split_override ?? globalSplit ?? 0.99;
  const showDelivery = plan.plan_type !== "autonomy" && (plan.plan_type as string) !== "pdv_only";
  const isFixedPlan = ["fixed", "supporter", "autonomy"].includes(plan.plan_type);

  return (
    <AdminCardTeste className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-foreground">
          {PLAN_LABEL[plan.plan_type] ?? plan.plan_type}
        </span>
        <AdminBadgeTeste variant="neutro">Plano ativo</AdminBadgeTeste>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <Row icon={<Calendar className="h-4 w-4" />} label="Mensalidade" value={Number(plan.monthly_fee) > 0 ? `${formatBRL(Number(plan.monthly_fee))}/mês` : "Grátis"} />
        {Number(plan.commission_rate) > 0 && (
          <Row icon={<Percent className="h-4 w-4" />} label="Comissão" value={`${Number(plan.commission_rate)}% por pedido`} />
        )}
        {showDelivery && (
          <Row icon={<Truck className="h-4 w-4" />} label="Taxa de plataforma / entrega" value={formatBRL(Number(deliverySplit))} />
        )}
        {isFixedPlan && (
          <Row icon={<Smartphone className="h-4 w-4" />} label="Pix direto" value="Sem taxa do ItaSuper" />
        )}
        {plan.pdv_enabled && Number(plan.pdv_fixed_fee_per_sale) > 0 && (
          <Row icon={<ShoppingCart className="h-4 w-4" />} label="Taxa PDV" value={`${formatBRL(Number(plan.pdv_fixed_fee_per_sale))}/venda`} />
        )}
      </div>

      {plan.next_billing_date && Number(plan.monthly_fee) > 0 && (
        <div className="border-t border-border pt-2 text-xs text-muted-foreground">
          Próximo vencimento: <strong className="text-foreground">{format(new Date(plan.next_billing_date), "dd 'de' MMMM", { locale: ptBR })}</strong>
        </div>
      )}
    </AdminCardTeste>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{icon}{label}</div>
      <div className="text-sm font-bold text-foreground">{value}</div>
    </div>
  );
}
