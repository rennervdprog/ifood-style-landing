import { PLANS, netPerOrder } from "@/lib/plansInfo";
import type { StorePlanType } from "@/hooks/useStorePlan";

interface Props {
  planId: StorePlanType;
  orderValue?: number;
  viaPix?: boolean;
  className?: string;
}

/** Mostra um exemplo numérico: "Pedido R$X via PIX no plano Y → você recebe R$Z" */
export default function PlanFeeBreakdown({
  planId,
  orderValue = 50,
  viaPix = true,
  className = "",
}: Props) {
  const plan = PLANS[planId];
  if (!plan) return null;
  const commission = (orderValue * plan.commissionRate) / 100;
  const pixFee = viaPix ? plan.pixFee : 0;
  const net = netPerOrder(plan, orderValue, viaPix);

  const fmt = (n: number) =>
    `R$ ${n.toFixed(2).replace(".", ",")}`;

  return (
    <div
      className={`rounded-xl border border-border bg-card p-3 text-sm ${className}`}
    >
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        Exemplo no plano {plan.name}
      </p>
      <div className="space-y-1 text-foreground">
        <Row label={`Pedido${viaPix ? " via PIX" : ""}`} value={fmt(orderValue)} />
        {plan.commissionRate > 0 && (
          <Row
            label={`Comissão (${plan.commissionRate}%)`}
            value={`− ${fmt(commission)}`}
            muted
          />
        )}
        {viaPix && plan.pixFee > 0 && (
          <Row label="Taxa PIX" value={`− ${fmt(pixFee)}`} muted />
        )}
        <div className="h-px bg-border my-1" />
        <Row label="Você recebe" value={fmt(net)} highlight />
      </div>
      <p className="text-[11px] text-muted-foreground mt-2">
        Custo do produto, embalagem e taxa de entrega não entram nesta conta.
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  highlight,
}: {
  label: string;
  value: string;
  muted?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between text-xs md:text-sm ${
        muted ? "text-muted-foreground" : ""
      } ${highlight ? "font-bold text-primary text-base" : ""}`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}