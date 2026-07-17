import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PdvAccess {
  /** true = pode usar PDV (legacy, add-on ativo ou VIP) */
  enabled: boolean;
  /** origem da liberação */
  source: "legacy" | "addon" | "vip" | "pdv_only" | "none";
  /** R$ cobrado por venda no PDV (legacy = 1, addon = 0) */
  pricePerOrder: number;
  /** Preço mensal cobrado (0 quando legacy/vip) */
  monthlyPrice: number;
  /** Se o cancelamento foi solicitado, quando termina o acesso */
  cancelsAt: string | null;
  /** true quando há cancelamento agendado que pode ser desfeito */
  canReactivate: boolean;
  isLoading: boolean;
}

/**
 * Regras:
 *  - legacy_pdv = true  → PDV liberado, R$1/venda, sem mensalidade
 *  - store_addons(enabled=true, code='pdv') → PDV liberado, mensalidade
 *      (price_override=0 = VIP grátis)
 *  - caso contrário → bloqueado (mostra upsell)
 */
export function useStorePdvAccess(storeId: string | undefined | null): PdvAccess {
  const { data, isLoading } = useQuery({
    queryKey: ["store-pdv-access", storeId],
    enabled: !!storeId,
    staleTime: 60_000,
    queryFn: async () => {
      const [storeRes, addonRes, catalogRes] = await Promise.all([
        supabase
          .from("stores" as any)
          .select("legacy_pdv, plan_type")
          .eq("id", storeId!)
          .maybeSingle(),
        supabase
          .from("store_addons" as any)
          .select("enabled, price_override, cancels_at")
          .eq("store_id", storeId!)
          .eq("addon_code", "pdv")
          .maybeSingle(),
        supabase
          .from("plan_addons" as any)
          .select("monthly_price")
          .eq("code", "pdv")
          .maybeSingle(),
      ]);
      return {
        legacy: !!(storeRes.data as any)?.legacy_pdv,
        planType: (storeRes.data as any)?.plan_type as string | undefined,
        addon: addonRes.data as any,
        catalogPrice: Number((catalogRes.data as any)?.monthly_price ?? 49),
      };
    },
  });

  const legacy = !!data?.legacy;
  const addon = data?.addon as any;
  const catalogPrice = data?.catalogPrice ?? 49;
  const isPdvOnly = data?.planType === "pdv_only";

  // Plano "Somente PDV": PDV já embutido no preço do plano (R$ 69/mês)
  if (isPdvOnly) {
    return {
      enabled: true,
      source: "pdv_only",
      pricePerOrder: 0,
      monthlyPrice: 0, // já cobrado como plano, não como add-on
      cancelsAt: null,
      canReactivate: false,
      isLoading,
    };
  }

  if (legacy) {
    return {
      enabled: true,
      source: "legacy",
      pricePerOrder: 1,
      monthlyPrice: 0,
      cancelsAt: null,
      canReactivate: false,
      isLoading,
    };
  }

  if (addon?.enabled) {
    const override = addon.price_override;
    const isVip = override != null && Number(override) === 0;
    const monthly = override != null ? Number(override) : catalogPrice;
    return {
      enabled: true,
      source: isVip ? "vip" : "addon",
      pricePerOrder: 0,
      monthlyPrice: monthly,
      cancelsAt: addon.cancels_at ?? null,
      canReactivate: !!addon.cancels_at,
      isLoading,
    };
  }

  return {
    enabled: false,
    source: "none",
    pricePerOrder: 0,
    monthlyPrice: catalogPrice,
    cancelsAt: null,
    canReactivate: false,
    isLoading,
  };
}

/** Feature flag global — enquanto false, esconde toda UI de add-ons/upsell. */
export function useAddonsFlag() {
  const { data } = useQuery({
    queryKey: ["addons-module-enabled"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_settings")
        .select("value")
        .eq("key", "addons_module_enabled")
        .maybeSingle();
      return (data?.value as any) === true;
    },
  });
  return !!data;
}