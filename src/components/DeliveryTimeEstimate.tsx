import { Clock } from "lucide-react";

interface DeliveryTimeEstimateProps {
  status: string;
  createdAt: string;
  confirmedAt?: string | null;
  pendingOrdersCount?: number;
  distanceKm?: number;
}

const getEstimateMinutes = (
  status: string,
  pendingCount: number = 0,
  distanceKm: number = 0
): { min: number; max: number } | null => {
  // Base times per status
  let base: { min: number; max: number } | null = null;
  
  switch (status) {
    case "pendente": base = { min: 30, max: 50 }; break;
    case "preparando": base = { min: 20, max: 40 }; break;
    case "pronto_para_entrega": base = { min: 10, max: 25 }; break;
    case "em_transito":
    case "saiu_entrega": base = { min: 5, max: 15 }; break;
    default: return null;
  }

  if (!base) return null;

  // Dynamic adjustment: +5 min per pending order ahead
  const queueDelay = Math.min(pendingCount * 5, 30);
  
  // Dynamic adjustment: +2 min per km for delivery status
  const distanceDelay = (status === "em_transito" || status === "saiu_entrega")
    ? Math.round(distanceKm * 2)
    : 0;

  return {
    min: base.min + queueDelay + distanceDelay,
    max: base.max + queueDelay + distanceDelay,
  };
};

const DeliveryTimeEstimate = ({
  status,
  createdAt,
  confirmedAt,
  pendingOrdersCount = 0,
  distanceKm = 0,
}: DeliveryTimeEstimateProps) => {
  const estimate = getEstimateMinutes(status, pendingOrdersCount, distanceKm);
  if (!estimate) return null;

  const baseTime = confirmedAt || createdAt;
  const elapsed = Math.floor((Date.now() - new Date(baseTime).getTime()) / 60000);
  const remaining = Math.max(0, estimate.max - elapsed);

  if (remaining === 0 && status !== "pendente") return null;

  return (
    <div className="flex items-center gap-1.5 bg-primary/5 border border-primary/20 rounded-lg px-2.5 py-1.5">
      <Clock className="h-3.5 w-3.5 text-primary" />
      <span className="text-[10px] font-bold text-primary">
        {remaining > 0
          ? `≈ ${Math.max(estimate.min - elapsed, 5)}–${remaining} min`
          : `≈ ${estimate.min}–${estimate.max} min`
        }
      </span>
    </div>
  );
};

export default DeliveryTimeEstimate;
