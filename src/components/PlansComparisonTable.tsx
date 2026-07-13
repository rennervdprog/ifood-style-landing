import { Check, X } from "lucide-react";
import { PLANS, PLANS_ORDER, DELIVERY_FEE_NOTE, PIX_FEE_NOTE } from "@/lib/plansInfo";
import type { StorePlanType } from "@/hooks/useStorePlan";

interface Row {
  label: string;
  values: Record<StorePlanType, string | boolean>;
}

const ROWS: Row[] = [
  {
    label: "Mensalidade",
    values: {
      commission_only: "R$ 0",
      fixed: "R$ 90*",
      supporter: "R$ 75",
      autonomy: "R$ 239,90",
    } as Record<StorePlanType, string>,
  },
  {
    label: "Comissão por pedido",
    values: {
      commission_only: "6%",
      fixed: "0%",
      supporter: "0%",
      autonomy: "0%",
    } as Record<StorePlanType, string>,
  },
  {
    label: "Taxa por PIX (lojista)",
    values: {
      commission_only: "Grátis",
      fixed: "R$ 1,99",
      supporter: "R$ 1,99",
      autonomy: "R$ 1,99",
    } as Record<StorePlanType, string>,
  },
  {
    label: "Taxa da plataforma na entrega (somada à sua taxa, paga pelo cliente)",
    values: {
      commission_only: "+ R$ 2,00",
      fixed: "+ R$ 2,00",
      supporter: "+ R$ 2,00",
      autonomy: "Não cobra",
    } as Record<StorePlanType, string>,
  },
  {
    label: "Cardápio digital",
    values: { commission_only: true, fixed: true, supporter: true, autonomy: true } as Record<StorePlanType, boolean>,
  },
  {
    label: "Relatórios completos",
    values: { commission_only: false, fixed: true, supporter: true, autonomy: true } as Record<StorePlanType, boolean>,
  },
  {
    label: "Banners e destaque",
    values: { commission_only: false, fixed: true, supporter: true, autonomy: true } as Record<StorePlanType, boolean>,
  },
  {
    label: "Motoboy integrado",
    values: { commission_only: false, fixed: true, supporter: true, autonomy: true } as Record<StorePlanType, boolean>,
  },
  {
    label: "Suporte VIP",
    values: { commission_only: false, fixed: true, supporter: true, autonomy: true } as Record<StorePlanType, boolean>,
  },
  {
    label: "PDV (módulo opcional)",
    values: {
      commission_only: "+ R$ 49/mês",
      fixed: "+ R$ 49/mês",
      supporter: "+ R$ 49/mês",
      autonomy: "+ R$ 49/mês",
    } as Record<StorePlanType, string>,
  },
];

interface Props {
  /** Quais planos mostrar (padrão: todos exceto Apoiador). */
  plans?: StorePlanType[];
  className?: string;
}

export default function PlansComparisonTable({
  plans = ["commission_only", "fixed", "autonomy"],
  className = "",
}: Props) {
  const cols = plans.map((id) => PLANS[id]);

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left p-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
                Recurso
              </th>
              {cols.map((p) => (
                <th
                  key={p.id}
                  className={`p-3 text-center font-bold text-xs ${
                    p.highlight ? "text-primary" : "text-foreground"
                  }`}
                >
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, i) => (
              <tr
                key={row.label}
                className={`border-b border-border last:border-0 ${i < 4 ? "bg-muted/20" : ""}`}
              >
                <td className="p-3 text-foreground text-xs md:text-sm">{row.label}</td>
                {cols.map((p) => {
                  const v = row.values[p.id];
                  return (
                    <td
                      key={p.id}
                      className={`p-3 text-center text-xs md:text-sm ${
                        p.highlight ? "font-semibold" : ""
                      }`}
                    >
                      {typeof v === "boolean" ? (
                        v ? (
                          <Check className="h-4 w-4 text-primary mx-auto" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                        )
                      ) : (
                        v
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-1 text-[11px] text-muted-foreground px-1">
        <p>💡 {DELIVERY_FEE_NOTE}</p>
        <p>💡 {PIX_FEE_NOTE}</p>
        <p>💡 PDV é um módulo opcional: novas lojas contratam por R$ 49/mês. Lojas antigas mantêm a regra atual de R$ 1 por venda.</p>
      </div>
    </div>
  );
}
