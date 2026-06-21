import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_DELIVERY_FEE_CONFIG, type DeliveryFeeConfig } from "@/lib/deliveryFee";

 export type StorePlanType = "fixed" | "hybrid" | "commission_only" | "supporter";

export interface StorePlanFeatures {
  planType: StorePlanType;
  monthlyFee: number;
  commissionRate: number;
  /** PIX online payment allowed */
  allowPix: boolean;
  /** Platform delivery (motoboys) allowed */
  allowPlatformDelivery: boolean;
  /** Loyalty points program */
  allowLoyalty: boolean;
  /** Promotional banners */
  allowBanners: boolean;
  /** Order scheduling */
  allowScheduling: boolean;
  /** Full financial reports with charts */
  allowFullReports: boolean;
  /** Commission system (charge/pay commission) */
  hasCommission: boolean;
  /** Max active coupons (null = unlimited) */
  maxCoupons: number | null;
  /** Trial end date (null = no trial) */
  trialEndsAt: string | null;
  /** Whether the store is currently in trial */
  isInTrial: boolean;
  /** Days remaining in trial */
  trialDaysLeft: number;
  /** Next billing date */
  nextBillingDate: string | null;
  /** Last billed date */
  lastBilledAt: string | null;
  /** Plan start date */
  startedAt: string | null;
  /** Whether the store has fixed plan (all fixed plans get full features) */
  isFixedPlan: boolean;
  /** @deprecated Use isFixedPlan instead */
  isItatingaFixed: boolean;
  /** Platform fee per PIX order (R$1 operational tax) */
  pixOperationalFee: number;
  /** Platform split from delivery fee */
  platformDeliverySplit: number;
  /** Driver split from delivery fee */
  driverDeliverySplit: number;
  /** Modo de divisão da taxa R$2 da plataforma (entrega própria): cliente | meio_a_meio | lojista */
  platformFeeSplit: "cliente" | "meio_a_meio" | "lojista";
  /** Quanto a LOJA absorve por pedido (acumula em repasse_pendente) */
  platformFeeStoreAbsorb: number;
  /** Quanto aparece a MAIS pro cliente no checkout (em cima da taxa de entrega da loja) */
  platformFeeCustomerExtra: number;
  /** PDV (Ponto de Venda) ativo para esta loja */
  pdvEnabled: boolean;
  /** Taxa de comissão PDV (menor que delivery) */
  pdvCommissionRate: number;
  isLoading: boolean;
}

// All fixed plans get full features (PIX with operational fee, all tools)
const FIXED_PLAN_FEATURES = {
  allowPix: true,
  allowPlatformDelivery: true,
  allowLoyalty: true,
  allowBanners: true,
  allowScheduling: true,
  allowFullReports: true,
  hasCommission: false,
  maxCoupons: null as number | null,
};

 const PLAN_FEATURES: Record<string, typeof FIXED_PLAN_FEATURES> = {
  commission_only: {
    allowPix: true,
    allowPlatformDelivery: true,
    allowLoyalty: true,
    allowBanners: true,
    allowScheduling: true,
    allowFullReports: true,
    hasCommission: true,
    maxCoupons: null,
  },
  hybrid: {
    allowPix: true,
    allowPlatformDelivery: true,
    allowLoyalty: true,
    allowBanners: true,
    allowScheduling: true,
    allowFullReports: true,
    hasCommission: true,
    maxCoupons: null,
  },
  fixed: FIXED_PLAN_FEATURES,
};
// Apoiador = mesmos benefícios do Essencial (sem comissão, todas as ferramentas)
PLAN_FEATURES.supporter = FIXED_PLAN_FEATURES;

export function useStorePlan(storeId: string | undefined | null): StorePlanFeatures {
  const { data, isLoading } = useQuery({
    queryKey: ["store-plan", storeId],
    queryFn: async () => {
      const [planResult, storeResult, configResult] = await Promise.all([
        supabase
          .from("store_plans")
          .select("plan_type, monthly_fee, commission_rate, trial_ends_at, next_billing_date, last_billed_at, started_at, pix_operational_fee_override, platform_delivery_split_override, pdv_enabled, pdv_commission_rate")
          .eq("store_id", storeId!)
          .eq("is_active", true)
          .maybeSingle(),
        supabase
          .from("stores_public")
          .select("address_city, delivery_mode, platform_fee_split")
          .eq("id", storeId!)
          .maybeSingle(),
        supabase
          .from("admin_settings")
          .select("value")
          .eq("key", "delivery_fee_config")
          .maybeSingle(),
      ]);
      if (planResult.error) throw planResult.error;
      const feeConfig = configResult.data?.value as unknown as DeliveryFeeConfig | null;
      return {
        plan: planResult.data,
        city: (storeResult.data as any)?.address_city || "itatinga",
        deliveryMode: (storeResult.data as any)?.delivery_mode || "platform",
        platformFeeSplit: ((storeResult.data as any)?.platform_fee_split || "cliente") as "cliente" | "meio_a_meio" | "lojista",
        feeConfig,
      };
    },
    enabled: !!storeId,
    staleTime: 1000 * 60 * 5,
  });

  const planType: StorePlanType = (data?.plan?.plan_type as StorePlanType) || "commission_only";
  // "fixed" = Essencial | "supporter" = Apoiador — ambos pagam PIX R$1,99 e 0% comissão
  const isFixedPlan = planType === "fixed" || planType === "supporter";
  const features = PLAN_FEATURES[planType];

  // Base do split da plataforma (R$ por pedido em entrega própria)
  const _isOwn = data?.deliveryMode === "own";
  const _override = (data?.plan as any)?.platform_delivery_split_override;
  const _baseSplit = _isOwn
    ? (_override ?? 2.0)
    : (data?.feeConfig?.platform_split ?? 2.0);
  const _splitMode = (data?.platformFeeSplit || "cliente") as "cliente" | "meio_a_meio" | "lojista";
  const _storeAbsorb = _isOwn
    ? (_splitMode === "lojista" ? _baseSplit : _splitMode === "meio_a_meio" ? Math.round((_baseSplit / 2) * 100) / 100 : 0)
    : 0;
  const _customerExtra = _isOwn ? Math.max(0, Math.round((_baseSplit - _storeAbsorb) * 100) / 100) : 0;

  const trialEndsAt = (data?.plan as any)?.trial_ends_at ?? null;
  const now = new Date();
  const trialEnd = trialEndsAt ? new Date(trialEndsAt) : null;
  const isInTrial = trialEnd ? trialEnd > now : false;
  const trialDaysLeft = trialEnd && isInTrial
    ? Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return {
    planType,
    monthlyFee: data?.plan?.monthly_fee ?? 0,
    commissionRate: data?.plan?.commission_rate ?? 6,
    ...features,
    trialEndsAt,
    isInTrial,
    trialDaysLeft,
    nextBillingDate: (data?.plan as any)?.next_billing_date ?? null,
    lastBilledAt: (data?.plan as any)?.last_billed_at ?? null,
    startedAt: (data?.plan as any)?.started_at ?? null,
    isFixedPlan,
    isItatingaFixed: isFixedPlan, // backward compat
    pixOperationalFee: isFixedPlan
      ? ((data?.plan as any)?.pix_operational_fee_override ?? 1.99)
      : 0,
    // 🔒 R$2 plataforma se aplica a TODOS os planos (regra de negócio global)
    // own delivery: somado em cima da taxa do lojista no CheckoutPage
    // platform delivery: incluso no cálculo via deliveryFee.ts config.platform_split
    platformDeliverySplit: data?.deliveryMode === "own"
      ? ((data?.plan as any)?.platform_delivery_split_override ?? 2.00)
      : (data?.feeConfig?.platform_split ?? 2.00),
    // Driver split: todos os planos que usam plataforma de entrega têm split pro motoboy
    driverDeliverySplit: data?.feeConfig?.driver_split ?? DEFAULT_DELIVERY_FEE_CONFIG.driver_split,
    platformFeeSplit: _splitMode,
    platformFeeStoreAbsorb: _storeAbsorb,
    platformFeeCustomerExtra: _customerExtra,
    // PDV
    pdvEnabled: (data?.plan as any)?.pdv_enabled ?? false,
    pdvCommissionRate: (data?.plan as any)?.pdv_commission_rate ?? 0,
    isLoading,
  };
}
