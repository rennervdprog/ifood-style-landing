import { Clock } from "lucide-react";

interface DeliveryTimeEstimateProps {
  status: string;
  createdAt: string;
  confirmedAt?: string | null;
}

const getEstimateMinutes = (status: string): { min: number; max: number } | null => {
  switch (status) {
    case "pendente": return { min: 30, max: 50 };
    case "preparando": return { min: 20, max: 40 };
    case "pronto_para_entrega": return { min: 10, max: 25 };
    case "em_transito":
    case "saiu_entrega": return { min: 5, max: 15 };
    default: return null;
  }
};

const DeliveryTimeEstimate = ({ status, createdAt, confirmedAt }: DeliveryTimeEstimateProps) => {
  const estimate = getEstimateMinutes(status);
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
