import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PendingRepasseBreakdown {
  /** Comissão do plano sobre vendas (dinheiro/cartão/PIX manual). */
  comissao: number;
  /** Taxa operacional / split por entrega (delivery). */
  splitEntrega: number;
  /** Taxa fixa por venda no PDV. */
  pdv: number;
}

export interface PendingRepasseResult {
  total: number;
  breakdown: PendingRepasseBreakdown;
  hasPendingCharge: boolean;
  isLoading: boolean;
}

/**
 * Fonte única do valor pendente de repasse do lojista.
 * Substitui as queries duplicadas em CommissionAlert / PlatformSplitAlert /
 * ValorAPagarCard / useRepassePending — todas devem consumir este hook.
 */
export function usePendingRepasse(storeId?: string): PendingRepasseResult {
  const enabled = !!storeId;

  const { data: balance, isLoading: loadingBalance } = useQuery({
    queryKey: ["repasse-balance", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("store_balances")
        .select("repasse_pendente, comissao_pendente")
        .eq("store_id", storeId!)
        .maybeSingle();
      return data;
    },
    enabled,
    refetchInterval: 30_000,
  });

  const { data: pdv, isLoading: loadingPdv } = useQuery({
    queryKey: ["repasse-pdv-pending", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("store_plans")
        .select("pdv_commission_pending")
        .eq("store_id", storeId!)
        .eq("is_active", true)
        .maybeSingle();
      return Number(data?.pdv_commission_pending || 0);
    },
    enabled,
    refetchInterval: 30_000,
  });

  const { data: charge, isLoading: loadingCharge } = useQuery({
    queryKey: ["repasse-has-pending-charge", storeId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("financial_transactions")
        .select("id")
        .eq("store_id", storeId!)
        .eq("transaction_kind", "commission_charge")
        .eq("status", "pending")
        .limit(1)
        .maybeSingle();
      return !!data;
    },
    enabled,
    refetchInterval: 30_000,
  });

  const splitEntrega = Number(balance?.repasse_pendente || 0);
  const comissao = Number(balance?.comissao_pendente || 0);
  const pdvPend = Number(pdv || 0);

  return {
    total: splitEntrega + comissao + pdvPend,
    breakdown: { comissao, splitEntrega, pdv: pdvPend },
    hasPendingCharge: !!charge,
    isLoading: loadingBalance || loadingPdv || loadingCharge,
  };
}