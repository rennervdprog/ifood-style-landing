import { Check, X } from "lucide-react";
import { PLANS, PLANS_ORDER, DELIVERY_FEE_NOTE } from "@/lib/plansInfo";
import type { StorePlanType } from "@/hooks/useStorePlan";

interface Row {
  label: string;
  values: Partial<Record<StorePlanType, string | boolean>>;
}

/** Comparativo das ofertas disponíveis para novas lojas. */
const ROWS: Row[] = [
  {
    label: "Mensalidade",
    values: { fixed: "R$ 89,90*", pdv_only: "R$ 69/mês" },
  },
  {
    label: "Comissão por pedido",
    values: { fixed: "0%", pdv_only: "Não se aplica" },
  },
  {
    label: "Pix Direto do Cliente",
    values: { fixed: "Comprovante", pdv_only: "Não se aplica" },
  },
  {
    label: "Taxa da plataforma na entrega",
    values: { fixed: "+ R$ 0,99", pdv_only: "Sem delivery" },
  },
  {
    label: "Cardápio e pedidos online",
    values: { fixed: true, pdv_only: false },
  },
  {
    label: "Vitrine e entregas",
    values: { fixed: true, pdv_only: false },
  },
  {
    label: "Relatórios da operação",
    values: { fixed: true, pdv_only: true },
  },
  {
    label: "Motoboy integrado",
    values: { fixed: true, pdv_only: false },
  },
  {
    label: "PDV de balcão",
    values: { fixed: "+ R$ 49/mês", pdv_only: "Incluído" },
  },
];

interface Props {
  /** Planos a exibir. Por padrão, somente as ofertas disponíveis para novas lojas. */
  plans?: StorePlanType[];
  className?: string;
}

export default function PlansComparisonTable({
  plans = PLANS_ORDER,
  className = "",
}: Props) {
  const cols = plans.map((id) => PLANS[id]);

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="p-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Recurso
              </th>
              {cols.map((plan) => (
                <th
                  key={plan.id}
                  className={`p-3 text-center text-xs font-bold ${
                    plan.highlight ? "text-primary" : "text-foreground"
                  }`}
                >
                  {plan.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, index) => (
              <tr
                key={row.label}
                className={`border-b border-border last:border-0 ${index < 4 ? "bg-muted/20" : ""}`}
              >
                <td className="p-3 text-xs text-foreground md:text-sm">{row.label}</td>
                {cols.map((plan) => {
                  const value = row.values[plan.id] ?? "—";
                  return (
                    <td
                      key={plan.id}
                      className={`p-3 text-center text-xs md:text-sm ${plan.highlight ? "font-semibold" : ""}`}
                    >
                      {typeof value === "boolean" ? (
                        value ? (
                          <Check className="mx-auto h-4 w-4 text-primary" />
                        ) : (
                          <X className="mx-auto h-4 w-4 text-muted-foreground/40" />
                        )
                      ) : (
                        value
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-1 px-1 text-[11px] text-muted-foreground">
        <p>💡 * O Essencial começa em R$ 0,00 enquanto o faturamento acumulado no período de análise de 60 dias permanecer até R$ 5.000,00. Depois, a mensalidade de R$ 89,90 pode ser ativada com aviso prévio de 30 dias.</p>
        <p>💡 {DELIVERY_FEE_NOTE}</p>
        <p>💡 No checkout, o Cliente não usa PIX online: quando disponível, utiliza Pix Direto com envio de comprovante, além de cartão ou dinheiro. PIX online fica reservado à relação financeira entre Lojista e ItaSuper.</p>
        <p>💡 O Somente PDV é voltado ao balcão: não possui vitrine, pedidos online nem entregas.</p>
      </div>
    </div>
  );
}
