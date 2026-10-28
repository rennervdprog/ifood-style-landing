// Pedido faturável: entra nas vendas, no ticket médio e nos gráficos da
// Visão Geral do super-admin. Cancelado e aguardando pagamento não faturam.
// Definição única — herói, gráficos e contexto de 7 dias usam a mesma, para
// os três falarem a mesma língua (Fase 3, alinhamento).
export const NON_BILLABLE_STATUSES: string[] = ["cancelado", "aguardando_pagamento"];

export function isBillableOrder(order: { status?: string | null }): boolean {
  return !NON_BILLABLE_STATUSES.includes(order.status ?? "");
}

export function filterBillableOrders<T extends { status?: string | null }>(orders: T[]): T[] {
  return orders.filter(isBillableOrder);
}
