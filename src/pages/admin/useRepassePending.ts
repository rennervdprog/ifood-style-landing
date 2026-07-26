import { usePendingRepasse } from "@/hooks/usePendingRepasse";

/**
 * useRepassePending — total pendente (delivery + comissão + PDV) para pulsar a sub-aba "Repasse".
 * Wrapper sobre `usePendingRepasse` para manter a assinatura antiga (número).
 */
export function useRepassePending(storeId?: string): number {
  return usePendingRepasse(storeId).total;
}