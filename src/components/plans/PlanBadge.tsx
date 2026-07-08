import { Badge } from "@/components/ui/badge";
import { planLabel } from "@/lib/plansInfo";

/**
 * Badge padronizado do plano — nunca use strings soltas
 * ("Fixo Mensal", "Só Comissão"…) fora deste componente.
 */
export function PlanBadge({
  planType,
  className = "",
}: {
  planType?: string | null;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={`text-[10px] font-bold ${className}`}>
      {planLabel(planType)}
    </Badge>
  );
}