import { formatBRL } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { formatBRL } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Star, Gift } from "lucide-react";

interface LoyaltyBannerProps {
  storeId: string;
  storeName: string;
}

const LoyaltyBanner = ({ storeId, storeName }: LoyaltyBannerProps) => {
  const { user } = useAuth();

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

  const { data: myPoints } = useQuery({
    queryKey: ["my-loyalty-points", storeId, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("loyalty_points")
        .select("points, total_orders")
        .eq("store_id", storeId)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user && !!storeId && !!config,
  });

  if (!config) return null;

  const points = myPoints?.points || 0;
  const totalOrders = myPoints?.total_orders || 0;
  const minRedeem = config.min_points_redeem || 50;
  const discountPerPoint = config.discount_per_point || 0.10;
  const progress = Math.min(100, (points / minRedeem) * 100);
  const canRedeem = points >= minRedeem;
  const maxDiscount = canRedeem ? formatBRL(points * discountPerPoint) : "R$ 0,00";

  return (
    <div className="mt-3 pt-3 border-t border-border">
      <div className="flex items-center gap-1.5 mb-2">
        <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
        <span className="text-xs font-bold text-foreground">Programa de Fidelidade</span>
      </div>

      {user ? (
        <div className="bg-gradient-to-r from-amber-500/10 to-primary/5 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-black text-foreground">{points} pontos</p>
              <p className="text-[10px] text-muted-foreground">{totalOrders} {totalOrders === 1 ? "pedido" : "pedidos"} nesta loja</p>
            </div>
            {canRedeem && (
              <div className="flex items-center gap-1 bg-amber-500 text-white px-2.5 py-1 rounded-full">
                <Gift className="h-3 w-3" />
                <span className="text-[10px] font-bold">Resgate disponível!</span>
              </div>
            )}
          </div>
          
          <div className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-muted-foreground">{points}/{minRedeem} para resgate</span>
              {canRedeem && <span className="font-bold text-amber-600">Até R$ {maxDiscount} de desconto</span>}
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground">
            Ganhe {config.points_per_real} ponto{config.points_per_real > 1 ? "s" : ""} a cada R$ 1,00 gasto. 
            Resgate no checkout com {minRedeem}+ pontos.
          </p>
        </div>
      ) : (
        <div className="bg-muted/50 rounded-xl p-3">
          <p className="text-xs text-muted-foreground">
            Faça login para acumular pontos e ganhar descontos nesta loja!
          </p>
        </div>
      )}
    </div>
  );
};

export default LoyaltyBanner;
