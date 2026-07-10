import { Crown } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

export interface VipDiffs {
  fee?: boolean;
  commission?: boolean;
  pix?: boolean;
  delivery?: boolean;
}

/**
 * Badge "VIP" — mostrar SEMPRE que houver override personalizado
 * em relação ao template do plano. Nunca esconder linha por ser zero:
 * mostre o R$ 0,00 + este badge.
 */
export function VipBadge({ diffs, className = "" }: { diffs?: VipDiffs; className?: string }) {
  const items: string[] = [];
  if (diffs?.fee) items.push("mensalidade");
  if (diffs?.commission) items.push("comissão");
  if (diffs?.pix) items.push("taxa PIX");
  if (diffs?.delivery) items.push("taxa entrega");
  const label = items.length ? `Personalizado: ${items.join(", ")}` : "Condição personalizada";
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center gap-0.5 text-[9px] font-black bg-amber-500/15 text-amber-600 border border-amber-500/25 px-1.5 py-0.5 rounded-full ${className}`}
          >
            <Crown className="h-2.5 w-2.5" />
            VIP
          </span>
        </TooltipTrigger>
        <TooltipContent className="text-xs">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}