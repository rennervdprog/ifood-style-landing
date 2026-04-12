import { formatBRL } from "@/lib/utils";
import { useState } from "react";
import { formatBRL } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tag, X, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface CouponInputProps {
  subtotal: number;
  storeId?: string;
  onApply: (discount: number, couponId: string, couponCode: string, discountType: string) => void;
  onRemove: () => void;
  appliedCode: string | null;
  appliedDiscount: number;
}

const CouponInput = ({ subtotal, storeId, onApply, onRemove, appliedCode, appliedDiscount }: CouponInputProps) => {
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCode(val.toUpperCase());
  };

  const validateCoupon = async () => {
    if (!code.trim() || !user) return;
    setLoading(true);

    try {
      const { data: coupon, error } = await supabase
        .from("coupons" as any)
        .select("*")
        .eq("code", code.trim().toUpperCase())
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      if (!coupon) {
        toast.error("Cupom inválido ou expirado.");
        return;
      }

      const c = coupon as any;

      // Check expiration
      if (c.expires_at && new Date(c.expires_at) < new Date()) {
        toast.error("Este cupom expirou.");
        return;
      }

      // Check max uses
      if (c.max_uses && c.used_count >= c.max_uses) {
        toast.error("Este cupom atingiu o limite de usos.");
        return;
      }

      // Check min order value
      if (subtotal < c.min_order_value) {
        toast.error(`Pedido mínimo de R$ ${Number(c.min_order_value).toFixed(2)} para este cupom.`);
        return;
      }

      // Check store-specific
      if (c.store_id && c.store_id !== storeId) {
        toast.error("Este cupom não é válido para esta loja.");
        return;
      }

      // Check if already used by user
      const { data: usage } = await supabase
        .from("coupon_uses" as any)
        .select("id")
        .eq("coupon_id", c.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (usage) {
        toast.error("Você já usou este cupom.");
        return;
      }

      // Check first order only
      if (c.first_order_only) {
        const { count } = await supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("client_id", user.id)
          .neq("status", "cancelado" as any);
        if ((count || 0) > 0) {
          toast.error("Este cupom é válido apenas para o primeiro pedido.");
          return;
        }
      }

      // Calculate discount
      let discount = 0;
      let discountLabel = "";
      if (c.discount_type === "percentage") {
        discount = Math.round(subtotal * (Number(c.discount_value) / 100) * 100) / 100;
        discountLabel = `${Number(c.discount_value)}%`;
      } else if (c.discount_type === "fixed") {
        discount = Math.min(Number(c.discount_value), subtotal);
        discountLabel = `R$ ${Number(c.discount_value).toFixed(2)}`;
      } else if (c.discount_type === "free_shipping") {
        discount = 0;
        discountLabel = "Frete grátis";
      }

      onApply(discount, c.id, c.code, c.discount_type);
      
      if (c.discount_type === "free_shipping") {
        toast.success(`Cupom "${c.code}" aplicado! Frete grátis!`);
      } else {
        toast.success(`Cupom "${c.code}" aplicado! Desconto de ${discountLabel} = -R$ ${discount.toFixed(2)}`);
      }
    } catch (err: any) {
      toast.error("Erro ao validar cupom.");
    } finally {
      setLoading(false);
    }
  };

  if (appliedCode) {
    return (
      <div className="flex items-center justify-between bg-green-500/10 border border-green-500/30 rounded-xl px-3 py-2.5">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <div>
            <span className="text-xs font-bold text-green-600">{appliedCode}</span>
            <p className="text-[10px] text-green-600/70">-{formatBRL(R$ {appliedDiscount.toFixed(2)})}</p>
          </div>
        </div>
        <button onClick={onRemove} className="text-muted-foreground hover:text-destructive">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={code}
          onChange={handleCodeChange}
          placeholder="Código do cupom"
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
      <button
        onClick={validateCoupon}
        disabled={!code.trim() || loading}
        className="bg-primary text-primary-foreground font-bold px-4 rounded-xl text-sm disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aplicar"}
      </button>
    </div>
  );
};

export default CouponInput;
