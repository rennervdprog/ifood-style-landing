/**
 * useAvisosCount — calcula quantos avisos/pendências o lojista tem em aberto.
 * Espelha exatamente os cards renderizados em AvisosSection.
 */
interface Params {
  store: any;
  storePlan: any;
  allHoursClosed: boolean;
  isOwnDelivery: boolean;
  hasLinkedDrivers: boolean;
  driversLoading: boolean;
}

export function useAvisosCount({
  store,
  storePlan,
  allHoursClosed,
  isOwnDelivery,
  hasLinkedDrivers,
  driversLoading,
}: Params): number {
  if (!store) return 0;

  let count = 0;

  if (!store.asaas_wallet_id) count++;
  if (allHoursClosed) count++;
  if (isOwnDelivery && !driversLoading && !hasLinkedDrivers) count++;

  return count;
}