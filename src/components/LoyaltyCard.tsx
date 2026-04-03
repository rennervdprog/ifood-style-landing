import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Gift, Star } from "lucide-react";

interface LoyaltyCardProps {
  storeId: string;
  storeName: string;
}

const LoyaltyCard = ({ storeId, storeName }: LoyaltyCardProps) => {
  const { user } = useAuth();

  const { data: loyaltyConfig } = useQuery({
    queryKey: ["loyalty-config"],
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_settings")
        .select("value")
        .eq("key", "loyalty_config")
        .maybeSingle();
      return (data?.value as any) || { points_per_order: 1, reward_threshold: 10, reward_discount_percent: 10 };
    },
  });

  const { data: loyalty } = useQuery({
    queryKey: ["loyalty-points", user?.id, storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("loyalty_points" as any)
        .select("*")
        .eq("user_id", user!.id)
        .eq("store_id", storeId)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  if (!user || !loyaltyConfig) return null;

  const points = (loyalty as any)?.points || 0;
  const threshold = loyaltyConfig.reward_threshold || 10;
  const discount = loyaltyConfig.reward_discount_percent || 10;
  const progress = Math.min(points / threshold, 1);
  const remaining = Math.max(threshold - points, 0);

  return (
    <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Gift className="h-5 w-5 text-primary" />
        <div>
          <h3 className="text-sm font-bold text-foreground">Programa Fidelidade</h3>
          <p className="text-[10px] text-muted-foreground">{storeName}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-2">
        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
          <span>{points}/{threshold} pedidos</span>
          <span>{discount}% de desconto</span>
        </div>
        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>

      {/* Stamps */}
      <div className="flex gap-1 flex-wrap">
        {Array.from({ length: threshold }).map((_, i) => (
          <div
            key={i}
            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
              i < points
                ? "border-primary bg-primary text-primary-foreground"
                : "border-muted-foreground/20 bg-muted/30"
            }`}
          >
            {i < points && <Star className="h-3 w-3 fill-current" />}
          </div>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground mt-2 text-center">
        {remaining > 0
          ? `Faltam ${remaining} pedido${remaining > 1 ? "s" : ""} para ganhar ${discount}% de desconto!`
          : `🎉 Parabéns! Você ganhou ${discount}% de desconto no próximo pedido!`}
      </p>
    </div>
  );
};

export default LoyaltyCard;
