import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Gift, Copy } from "lucide-react";
import { toast } from "sonner";

const FirstOrderBanner = () => {
  const { user } = useAuth();

  const { data: config } = useQuery({
    queryKey: ["first-order-coupon-config"],
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_settings")
        .select("value")
        .eq("key", "first_order_coupon")
        .maybeSingle();
      return (data?.value as any) || null;
    },
  });

  // Check if user has any orders
  const { data: hasOrders } = useQuery({
    queryKey: ["user-has-orders", user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("client_id", user!.id);
      return (count || 0) > 0;
    },
    enabled: !!user,
  });

  if (!config?.enabled || !user || hasOrders) return null;

  const copyCode = () => {
    navigator.clipboard.writeText(config.code);
    toast.success(`Cupom ${config.code} copiado!`);
  };

  return (
    <div className="px-4 pt-3">
      <div className="bg-gradient-to-r from-emerald-500/15 to-primary/10 border border-emerald-500/20 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <Gift className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-black text-foreground">🎉 Primeira compra!</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ganhe {config.discount_value}{config.discount_type === "percentage" ? "%" : " reais"} de desconto no seu primeiro pedido
            </p>
            <button
              onClick={copyCode}
              className="mt-2 flex items-center gap-1.5 bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg active:scale-[0.97] transition-transform"
            >
              <Copy className="h-3 w-3" />
              {config.code}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FirstOrderBanner;
