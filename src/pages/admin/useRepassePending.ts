import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * useRepassePending — soma repasse (delivery) + comissão + PDV pendente da loja.
 * Usado para pulsar a sub-aba "Repasse" quando houver valor acumulado.
 */
export function useRepassePending(storeId?: string): number {
  const { data: balance } = useQuery({
    queryKey: ["store-balance-repasse-badge", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("store_balances")
        .select("repasse_pendente, comissao_pendente")
        .eq("store_id", storeId!)
        .maybeSingle();
      return data;
    },
    enabled: !!storeId,
    refetchInterval: 60_000,
  });

  const { data: pdv } = useQuery({
    queryKey: ["store-pdv-pending-badge", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("store_plans")
        .select("pdv_commission_pending")
        .eq("store_id", storeId!)
        .eq("is_active", true)
        .maybeSingle();
      return Number(data?.pdv_commission_pending || 0);
    },
    enabled: !!storeId,
    refetchInterval: 60_000,
  });

  const repasse = Number(balance?.repasse_pendente || 0);
  const comissao = Number(balance?.comissao_pendente || 0);
  return repasse + comissao + Number(pdv || 0);
}