/**
 * useAvisosCount — calcula quantos avisos/pendências o lojista tem em aberto.
 * Espelha exatamente os cards renderizados em AvisosSection.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Params {
  store: any;
  storePlan: any;
  allHoursClosed: boolean;
  isOwnDelivery: boolean;
  hasLinkedDrivers: boolean;
  driversLoading: boolean;
}

const MIN_FEE_PENDING = 30; // mesmo threshold do PlatformSplitAlert

export function useAvisosCount({
  store,
  storePlan,
  allHoursClosed,
  isOwnDelivery,
  hasLinkedDrivers,
  driversLoading,
}: Params): number {
  const { data: balance } = useQuery({
    queryKey: ["store-balance-avisos", store?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("store_balances")
        .select("repasse_pendente, comissao_pendente")
        .eq("store_id", store!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!store?.id,
    refetchInterval: 60_000,
  });

  if (!store) return 0;

  let count = 0;

  if (!store.asaas_wallet_id) count++;
  if (allHoursClosed) count++;
  if (isOwnDelivery && !driversLoading && !hasLinkedDrivers) count++;

  const comissao = Number(balance?.comissao_pendente || 0);
  const repasse = Number(balance?.repasse_pendente || 0);

  if (storePlan?.hasCommission && comissao > 0) count++;
  if (
    !storePlan?.hasCommission &&
    storePlan?.isItatingaFixed &&
    repasse + comissao >= MIN_FEE_PENDING
  ) count++;

  return count;
}