import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_DELIVERY_FEE_CONFIG, type DeliveryFeeConfig } from "@/lib/deliveryFee";

export type StorePlanType = "fixed" | "hybrid" | "commission_only";

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
  /** Whether the store is in Itatinga (platform city) with fixed plan benefits */
  isItatingaFixed: boolean;
  /** Platform fee per PIX order (R$1 operational tax) */
  pixOperationalFee: number;
  /** Platform split from delivery fee */
  platformDeliverySplit: number;
  /** Driver split from delivery fee */
  driverDeliverySplit: number;
  isLoading: boolean;
}

const PLAN_FEATURES_DEFAULT: Record<StorePlanType, Omit<StorePlanFeatures, "planType" | "monthlyFee" | "commissionRate" | "isLoading" | "trialEndsAt" | "isInTrial" | "trialDaysLeft" | "nextBillingDate" | "lastBilledAt" | "startedAt" | "isItatingaFixed" | "pixOperationalFee" | "platformDeliverySplit" | "driverDeliverySplit">> = {
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
  fixed: {
    allowPix: false,
    allowPlatformDelivery: false,
    allowLoyalty: false,
    allowBanners: false,
    allowScheduling: false,
    allowFullReports: false,
    hasCommission: false,
    maxCoupons: 3,
  },
};

// Itatinga fixed plan overrides — unlocks all features
const ITATINGA_FIXED_OVERRIDES = {
  allowPix: true,
  allowPlatformDelivery: true,
  allowLoyalty: true,
  allowBanners: true,
  allowScheduling: true,
  allowFullReports: true,
  hasCommission: false, // No commission on fixed plan
  maxCoupons: null as number | null,
};

const PLATFORM_CITIES = ["itatinga"];

export function useStorePlan(storeId: string | undefined | null): StorePlanFeatures {
  const { data, isLoading } = useQuery({
    queryKey: ["store-plan", storeId],
    queryFn: async () => {
      // Fetch plan + store city in parallel
      const [planResult, storeResult] = await Promise.all([
        supabase
          .from("store_plans")
          .select("plan_type, monthly_fee, commission_rate, trial_ends_at, next_billing_date, last_billed_at, started_at")
          .eq("store_id", storeId!)
          .eq("is_active", true)
          .maybeSingle(),
        supabase
          .from("stores_public")
          .select("address_city, delivery_mode")
          .eq("id", storeId!)
          .maybeSingle(),
      ]);
      if (planResult.error) throw planResult.error;
      return {
        plan: planResult.data,
        city: (storeResult.data as any)?.address_city || "itatinga",
        deliveryMode: (storeResult.data as any)?.delivery_mode || "platform",
      };
    },
    enabled: !!storeId,
    staleTime: 1000 * 60 * 5,
  });

  const planType: StorePlanType = (data?.plan?.plan_type as StorePlanType) || "commission_only";
  const normalizedCity = (data?.city || "itatinga").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_");
  const isPlatformCity = PLATFORM_CITIES.includes(normalizedCity);
  const isItatingaFixed = planType === "fixed" && isPlatformCity;

  // Apply features: if Itatinga + fixed, override with unlocked features
  const features = isItatingaFixed
    ? { ...PLAN_FEATURES_DEFAULT[planType], ...ITATINGA_FIXED_OVERRIDES }
    : PLAN_FEATURES_DEFAULT[planType];

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
    commissionRate: data?.plan?.commission_rate ?? 15,
    ...features,
    trialEndsAt,
    isInTrial,
    trialDaysLeft,
    nextBillingDate: (data?.plan as any)?.next_billing_date ?? null,
    lastBilledAt: (data?.plan as any)?.last_billed_at ?? null,
    startedAt: (data?.plan as any)?.started_at ?? null,
    isItatingaFixed,
    pixOperationalFee: isItatingaFixed ? 1 : 0,
    platformDeliverySplit: isItatingaFixed ? 2 : 0,
    driverDeliverySplit: isItatingaFixed ? 4 : 0,
    isLoading,
  };
}
