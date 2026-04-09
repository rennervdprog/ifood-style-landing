import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  isLoading: boolean;
}

const PLAN_FEATURES: Record<StorePlanType, Omit<StorePlanFeatures, "planType" | "monthlyFee" | "commissionRate" | "isLoading" | "trialEndsAt" | "isInTrial" | "trialDaysLeft">> = {
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

export function useStorePlan(storeId: string | undefined | null): StorePlanFeatures {
  const { data, isLoading } = useQuery({
    queryKey: ["store-plan", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_plans")
        .select("plan_type, monthly_fee, commission_rate, trial_ends_at, next_billing_date, last_billed_at, started_at")
        .eq("store_id", storeId!)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!storeId,
    staleTime: 1000 * 60 * 5,
  });

  const planType: StorePlanType = (data?.plan_type as StorePlanType) || "commission_only";
  const features = PLAN_FEATURES[planType];

  const trialEndsAt = (data as any)?.trial_ends_at ?? null;
  const now = new Date();
  const trialEnd = trialEndsAt ? new Date(trialEndsAt) : null;
  const isInTrial = trialEnd ? trialEnd > now : false;
  const trialDaysLeft = trialEnd && isInTrial
    ? Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return {
    planType,
    monthlyFee: data?.monthly_fee ?? 0,
    commissionRate: data?.commission_rate ?? 15,
    ...features,
    trialEndsAt,
    isInTrial,
    trialDaysLeft,
    nextBillingDate: (data as any)?.next_billing_date ?? null,
    lastBilledAt: (data as any)?.last_billed_at ?? null,
    startedAt: (data as any)?.started_at ?? null,
    isLoading,
  };
}
