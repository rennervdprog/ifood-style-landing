import { PLANS, netPerOrder } from "@/lib/plansInfo";
import type { StorePlanType } from "@/hooks/useStorePlan";

interface Props {
  planId: StorePlanType;
  orderValue?: number;
  viaPix?: boolean;
  className?: string;
  /** Overrides VIP — quando presentes, substituem os valores padrão do plano. */
  monthlyFeeOverride?: number;
  commissionRateOverride?: number;
  pixFeeOverride?: number;
  isVip?: boolean;
}

/** Mostra um exemplo numérico: "Pedido R$X via PIX no plano Y → você recebe R$Z" */
export default function PlanFeeBreakdown({
  planId,
  orderValue = 50,
  viaPix = true,
  className = "",
  monthlyFeeOverride,
  commissionRateOverride,
  pixFeeOverride,
  isVip = false,
}: Props) {
  const base = PLANS[planId];
  if (!base) return null;
  const commissionRate = commissionRateOverride ?? base.commissionRate;
  const pixFee = viaPix ? (pixFeeOverride ?? base.pixFee) : 0;
  const commission = (orderValue * commissionRate) / 100;
  const net = Math.max(0, orderValue - commission - pixFee);

  const fmt = (n: number) =>
    `R$ ${n.toFixed(2).replace(".", ",")}`;

  return (
    <div
      className={`rounded-xl border border-border bg-card p-3 text-sm ${className}`}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Exemplo no plano {base.name}
        </p>
        {isVip && (
          <span className="text-[9px] font-black bg-amber-500/15 text-amber-600 border border-amber-500/25 px-1.5 py-0.5 rounded-full">
            Condições VIP
          </span>
        )}
      </div>
      <div className="space-y-1 text-foreground">
        <Row label={`Pedido${viaPix ? " via PIX" : ""}`} value={fmt(orderValue)} />
        {commissionRate > 0 && (
          <Row
            label={`Comissão (${commissionRate}%)`}
            value={`− ${fmt(commission)}`}
            muted
          />
        )}
        {viaPix && pixFee > 0 && (
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