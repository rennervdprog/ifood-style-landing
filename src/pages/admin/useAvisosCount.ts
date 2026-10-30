/**
 * useAvisosCount — calcula quantos avisos/pendências o lojista tem em aberto.
 * Espelha exatamente os cards renderizados em AvisosSection (1 por categoria).
 *
 * Pedidos entram na conta: antes a aba só enxergava configuração (horários e
 * motoboy) e dizia "Tudo em ordem" com pedidos aguardando aceite/atrasados
 * na Visão Geral.
 */
interface Params {
  store: any;
  storePlan: any;
  allHoursClosed: boolean;
  isOwnDelivery: boolean;
  hasLinkedDrivers: boolean;
  driversLoading: boolean;
  /** Pedidos com status "pendente" (aguardando aceite). */
  pendingOrdersCount?: number;
  /** Pedidos pendente/preparando há mais de 20 min (mesma regra da Visão Geral). */
  delayedOrdersCount?: number;
}

export function useAvisosCount({
  store,
  storePlan,
  allHoursClosed,
  isOwnDelivery,
  hasLinkedDrivers,
  driversLoading,
  pendingOrdersCount = 0,
  delayedOrdersCount = 0,
}: Params): number {
  if (!store) return 0;

  let count = 0;

  if (allHoursClosed) count++;
  if (isOwnDelivery && !driversLoading && !hasLinkedDrivers) count++;
  if (pendingOrdersCount > 0) count++;
  if (delayedOrdersCount > 0) count++;

  return count;
}
