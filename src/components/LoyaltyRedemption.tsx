import { formatBRL } from "@/lib/utils";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Star, Gift, Minus, Plus, LogIn } from "lucide-react";

interface LoyaltyRedemptionProps {
  storeId: string;
  subtotal: number;
  onApply: (discount: number, pointsUsed: number) => void;
  onRemove: () => void;
  appliedPoints: number;
  onAvailabilityChange?: (available: boolean) => void;
}

const LoyaltyRedemption = ({ storeId, subtotal, onApply, onRemove, appliedPoints, onAvailabilityChange }: LoyaltyRedemptionProps) => {
  const { user } = useAuth();
  const [pointsToUse, setPointsToUse] = useState(0);

  const { data: config } = useQuery({
    queryKey: ["loyalty-config", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("loyalty_config")
        .select("*")
        .eq("store_id", storeId)
        .eq("is_enabled", true)
        .maybeSingle();
      return data;
    },
    enabled: !!storeId,
  });

  const { data: myPoints, isLoading: pointsLoading } = useQuery({
    queryKey: ["my-loyalty-points", storeId, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("loyalty_points")
        .select("points")
        .eq("store_id", storeId)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user && !!storeId && !!config,
  });

  useEffect(() => {
    onAvailabilityChange?.(!!config);
  }, [config, onAvailabilityChange]);

  if (!config) return null;

  const minRedeem = config.min_points_redeem || 50;
  const discountPerPoint = config.discount_per_point || 0.10;
  const maxDiscountPercent = config.max_discount_percent || 20;
  const pointsPerReal = config.points_per_real || 1;

  // Estado: sem login
  if (!user) {
    return (
      <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-3 flex items-center gap-2">
        <LogIn className="h-4 w-4 text-amber-500 shrink-0" />
        <p className="text-xs text-foreground">
          Faça login para acumular e usar pontos. Ganhe <b>{pointsPerReal} ponto{pointsPerReal > 1 ? "s" : ""}</b> a cada R$ 1,00.
        </p>
      </div>
    );
  }

  const availablePoints = myPoints?.points || 0;

  // Estado: ainda não tem pontos suficientes
  if (availablePoints < minRedeem) {
    const faltam = minRedeem - availablePoints;
    const progress = Math.min(100, (availablePoints / minRedeem) * 100);
    return (
      <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
          <p className="text-sm font-bold text-foreground">
            Você tem {availablePoints} ponto{availablePoints === 1 ? "" : "s"} nesta loja
          </p>
        </div>
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-amber-500 rounded-full" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Faltam <b>{faltam}</b> pontos para resgatar. Este pedido vai te dar aproximadamente <b>{Math.floor(subtotal * pointsPerReal)} pontos</b>.
        </p>
      </div>
    );
  }

  const maxDiscountByPercent = subtotal * (maxDiscountPercent / 100);
  const maxDiscountByPoints = availablePoints * discountPerPoint;
  const maxDiscount = Math.min(maxDiscountByPercent, maxDiscountByPoints, subtotal);
  const maxPointsUsable = Math.floor(maxDiscount / discountPerPoint);

  if (appliedPoints > 0) {
    const discount = appliedPoints * discountPerPoint;
    return (
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
            <div>
              <p className="text-sm font-bold text-foreground">{appliedPoints} pontos aplicados</p>
              <p className="text-xs text-amber-600 font-semibold">-{formatBRL(discount)} de desconto</p>
            </div>
          </div>
          <button onClick={onRemove} className="text-xs text-destructive font-bold">
            Remover
          </button>
        </div>
      </div>
    );
  }

  const discount = pointsToUse * discountPerPoint;

  return (
    <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
        <div className="flex-1">
          <p className="text-sm font-bold text-foreground">Usar pontos de fidelidade</p>
          <p className="text-[10px] text-muted-foreground">Você tem {availablePoints} pontos disponíveis</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => setPointsToUse(Math.max(minRedeem, pointsToUse - 10))}
          disabled={pointsToUse <= minRedeem}
          className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center disabled:opacity-30"
        >
          <Minus className="h-4 w-4" />
        </button>

        <div className="flex-1 text-center">
          <input
            type="range"
            min={minRedeem}
            max={maxPointsUsable}
            step={10}
            value={pointsToUse || minRedeem}
            onChange={(e) => setPointsToUse(parseInt(e.target.value))}
            className="w-full accent-amber-500"
          />
          <p className="text-sm font-black text-foreground mt-1">{pointsToUse || minRedeem} pontos</p>
          <p className="text-xs text-amber-600 font-semibold">
            = {formatBRL(((pointsToUse || minRedeem) * discountPerPoint))} de desconto
          </p>
        </div>

        <button
          onClick={() => setPointsToUse(Math.min(maxPointsUsable, (pointsToUse || minRedeem) + 10))}
          disabled={(pointsToUse || minRedeem) >= maxPointsUsable}
          className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center disabled:opacity-30"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <button
        onClick={() => {
          const pts = pointsToUse || minRedeem;
          const disc = pts * discountPerPoint;
          onApply(disc, pts);
        }}
        className="w-full bg-amber-500 text-white font-bold py-2.5 rounded-xl text-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
      >
        <Gift className="h-4 w-4" />
        Aplicar {pointsToUse || minRedeem} pontos (-{formatBRL(((pointsToUse || minRedeem) * discountPerPoint))})
      </button>
    </div>
  );
};

export default LoyaltyRedemption;
