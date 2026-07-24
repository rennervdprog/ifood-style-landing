import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type ResellerData = {
  registered: boolean;
  reseller?: {
    id: string; code: string; status: "pending" | "approved" | "blocked";
    commission_rate: number; bounty_amount_cents: number; gmv_bonus_rate: number;
    pix_key: string | null; pix_key_type: string | null;
  };
  stats?: {
    total_referrals: number; active_referrals: number; pending_referrals: number;
    balance_pending_cents: number; balance_paid_cents: number;
    earnings_this_month_cents: number; withdrawn_cents: number; pending_withdrawal_cents: number;
  };
  stores?: Array<{
    store_id: string; name: string; city: string | null; plan_type: string | null;
    status: string; referral_status: string; activated_at: string | null;
    gmv_60d_cents: number; commissions_total_cents: number;
  }>;
  commissions?: Array<{
    id: string; kind: string; amount_cents: number; status: string;
    reference_month: string | null; created_at: string;
  }>;
  withdrawals?: Array<{
    id: string; amount_cents: number; status: string; pix_key: string;
    created_at: string; paid_at: string | null;
  }>;
};

export const brl = (cents: number) =>
  ((cents || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function useResellerDashboard(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["reseller-dashboard", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("reseller_get_dashboard");
      if (error) throw error;
      return data as ResellerData;
    },
    enabled: !!user?.id && enabled,
    staleTime: 1000 * 60,
  });
}