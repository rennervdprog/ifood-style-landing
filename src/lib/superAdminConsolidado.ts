// Helpers puros do Consolidado redesenhado (Fase 4, super-admin-teste).
//
// O Consolidado soma `subtotal` só de pedidos finalizados/entregues
// (settlement) — é o cálculo de hoje, mantido por decisão do Renner
// (protótipo aprovado "como está", 27/10 ~22:50). Ele NÃO bate com o herói
// da Visão Geral (total_price de todos os faturáveis); isso é conhecido
// e aceito, não um bug a corrigir aqui.

import { addMoney, multiplyMoney, subtractMoney, sumMoney } from "@/lib/utils";

/** Taxa oficial de entrega: R$ 0,99 por entrega em pagamento físico. */
export const DELIVERY_FEE = 0.99;

/**
 * Nº de entregas de um repasse — SÓ quando o saldo é múltiplo exato de
 * R$ 0,99 (diferença de no máximo R$ 0,01, para absorver o ruído de
 * ponto flutuante). Quando o saldo é residual (ex.: Pastelão, R$ 6,00 —
 * sobra de cobrança parcial; 6 × R$ 0,99 = R$ 5,94 ≠ R$ 6,00), a
 * contagem NÃO pode ser derivada e volta null. Corrigido na Fase 5:
 * a Fase 4 arredondava (Math.round) e mostrava "6 entregas" errado.
 */
export function exactDeliveryCount(repasse: number): number | null {
  if (repasse <= 0) return null;
  const n = Math.round(repasse / DELIVERY_FEE);
  return Math.abs(repasse - n * DELIVERY_FEE) <= 0.01 ? n : null;
}

// ── Saldos por loja ────────────────────────────────────────────────

export interface StoreDebt {
  storeId: string;
  name: string;
  /** Dívida que entra no "A receber": comissão + taxa de entrega. */
  total: number;
  comissao: number;
  repasse: number;
  /**
   * Nº de entregas que geraram o repasse — só quando o saldo é múltiplo
   * exato de R$ 0,99; 0 quando o saldo é residual (contagem desconhecida).
   */
  deliveries: number;
  /** Origem legível, ex.: "Taxa de entrega · 30 entregas a R$ 0,99" (ou só "Taxa de entrega" quando residual). */
  originLabel: string;
}

export interface StoreBalanceRow {
  store_id: string;
  comissao_pendente?: number | string | null;
  repasse_pendente?: number | string | null;
}

export interface StoreRef {
  id: string;
  name: string;
}

/**
 * Lojas com valores a receber (comissão + taxa de entrega), da maior
 * dívida para a menor. Lojas em dia (total 0) não entram na lista —
 * é o que o protótipo mostra em "Saldos por loja".
 * A taxa PDV (pdv_commission_pending) NÃO entra aqui: ela fica fora do
 * total "A receber" (mostrada no cartão de MRR e na Composição), igual
 * ao Consolidado de hoje.
 */
export function getStoresWithDebt(
  storeBalances: StoreBalanceRow[],
  stores: StoreRef[]
): StoreDebt[] {
  const list: StoreDebt[] = [];
  for (const b of storeBalances || []) {
    const comissao = Number(b.comissao_pendente || 0);
    const repasse = Number(b.repasse_pendente || 0);
    const total = sumMoney([comissao, repasse]);
    if (total <= 0) continue;
    // Contagem só quando exata: saldo residual (ex.: Pastelão, R$ 6,00)
    // não tem nº de entregas derivável — mostrar a contagem arredondada
    // seria mentir (6 × R$ 0,99 = R$ 5,94 ≠ R$ 6,00).
    const exactDeliveries = exactDeliveryCount(repasse);
    const deliveries = exactDeliveries ?? 0;
    const originLabel =
      comissao > 0 && repasse > 0
        ? "Comissão + taxa de entrega"
        : repasse > 0
          ? exactDeliveries !== null
            ? `Taxa de entrega · ${deliveries} ${deliveries === 1 ? "entrega" : "entregas"} a R$ 0,99`
            : "Taxa de entrega"
          : "Comissão %";
    list.push({
      storeId: b.store_id,
      name: stores.find((s) => s.id === b.store_id)?.name || "Loja",
      total,
      comissao,
      repasse,
      deliveries,
      originLabel,
    });
  }
  return list.sort((a, b) => b.total - a.total);
}

// ── Repasses com falha ─────────────────────────────────────────────

export interface FailedPayoutRow {
  store_id: string;
  amount: number | string;
  created_at: string;
}

export interface FailedPayoutsSummary {
  count: number;
  total: number;
  /** Data do repasse com falha mais recente (ISO) ou null quando não há nenhum. */
  latestDate: string | null;
  /** Nomes das lojas com falha, da mais recente para a mais antiga, sem repetir. */
  storeNames: string[];
  /** Loja com mais falhas (para o detalhe "Pastelão Carioca, 2 repasses..."). */
  topStore: { name: string; count: number; total: number } | null;
}

/**
 * Resume os repasses com falha de `financial_transactions`
 * (transaction_kind = "store_payout", status = "failed") — a mesma
 * fonte dos 2 repasses do Pastelão (R$ 39,00 cada, 01/07/2026).
 * Não confundir com o dead-letter de pedidos (orders.store_payout_error),
 * que hoje está vazio.
 */
export function summarizeFailedPayouts(
  rows: FailedPayoutRow[],
  stores: StoreRef[]
): FailedPayoutsSummary {
  const list = rows || [];
  const total = sumMoney(list.map((r) => r.amount));
  const sorted = [...list].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const storeNames: string[] = [];
  for (const r of sorted) {
    const name = stores.find((s) => s.id === r.store_id)?.name || "Loja";
    if (!storeNames.includes(name)) storeNames.push(name);
  }
  const perStore = new Map<string, { count: number; total: number }>();
  for (const r of list) {
    const name = stores.find((s) => s.id === r.store_id)?.name || "Loja";
    const cur = perStore.get(name) || { count: 0, total: 0 };
    cur.count += 1;
    cur.total = sumMoney([cur.total, r.amount]);
    perStore.set(name, cur);
  }
  let topStore: FailedPayoutsSummary["topStore"] = null;
  for (const [name, v] of perStore) {
    if (!topStore || v.count > topStore.count) topStore = { name, ...v };
  }
  return {
    count: list.length,
    total,
    latestDate: sorted.length > 0 ? sorted[0].created_at : null,
    storeNames,
    topStore,
  };
}

// ── Liquidação por loja (settlement) ───────────────────────────────

export interface SettlementEntry {
  name: string;
  storeId: string;
  physicalSales: number;
  appSales: number;
  totalSales: number;
  commissionDue: number;
  netTransfer: number;
  finalBalance: number;
  orderCount: number;
  deliveryFees: number;
  pdvSales: number;
  pdvOrders: number;
  pdvCommission: number;
}

export interface StorePlanRef {
  store_id: string;
  plan_type?: string | null;
  commission_rate?: number | string | null;
}

export interface SettlementOrder {
  store_id: string;
  subtotal: number | string;
  delivery_fee?: number | string | null;
  payment_method?: string | null;
  order_source?: string | null;
  commission_rate?: number | string | null;
}

/**
 * Liquidação por loja a partir de um conjunto de pedidos — o MESMO
 * cálculo que o Financeiro já fazia (movido para cá na Fase 4 para
 * rodar para os dois períodos do herói: ativo e contexto).
 * totalSales soma `subtotal` (não total_price); só entram pedidos
 * finalizados/entregues, porque é o que `financeOrders` já traz.
 */
export function computeStoreSettlement(
  ordersArg: SettlementOrder[] | undefined,
  stores: Array<{ id: string; name: string; is_test?: boolean }>,
  selectedStore: string,
  parentStorePlans: StorePlanRef[] | undefined | null,
  getStoreRate: (storeId: string) => number
): SettlementEntry[] {
  if (!ordersArg || !stores) return [];
  const testIds = new Set((stores || []).filter((s: any) => s.is_test).map((s: any) => s.id));
  const map = new Map<string, SettlementEntry>();
  stores.filter((s: any) => !s.is_test).forEach((s) =>
    map.set(s.id, {
      name: s.name,
      storeId: s.id,
      physicalSales: 0,
      appSales: 0,
      totalSales: 0,
      commissionDue: 0,
      netTransfer: 0,
      finalBalance: 0,
      orderCount: 0,
      deliveryFees: 0,
      pdvSales: 0,
      pdvOrders: 0,
      pdvCommission: 0,
    })
  );
  const filtered = (selectedStore === "all"
    ? ordersArg
    : ordersArg.filter((o) => o.store_id === selectedStore)
  ).filter((o) => !testIds.has(o.store_id));
  filtered.forEach((o) => {
    const entry = map.get(o.store_id);
    if (!entry) return;
    const subtotal = o.subtotal;
    const deliveryFee = o.delivery_fee;
    const isPdv = (o as any).order_source === "pdv";

    if (isPdv) {
      // PDV: canal separado
      entry.pdvSales = addMoney(entry.pdvSales, subtotal);
      entry.pdvOrders += 1;
      // Comissão PDV = commission_rate do pedido (taxa PDV, menor que delivery)
      const pdvRate = Number((o as any).commission_rate || 0) / 100;
      entry.pdvCommission = addMoney(entry.pdvCommission, multiplyMoney(subtotal, pdvRate));
    } else {
      // Delivery: lógica original
      const isPhysical = o.payment_method === "dinheiro" || o.payment_method === "cartao";
      if (isPhysical) entry.physicalSales = addMoney(entry.physicalSales, subtotal);
      else entry.appSales = addMoney(entry.appSales, subtotal);
    }

    entry.totalSales = addMoney(entry.totalSales, subtotal);
    entry.deliveryFees = addMoney(entry.deliveryFees, deliveryFee);
    entry.orderCount += 1;
  });
  map.forEach((entry, storeId) => {
    const rate = getStoreRate(storeId);
    entry.commissionDue = multiplyMoney(entry.physicalSales, rate);
    entry.netTransfer = subtractMoney(entry.appSales, multiplyMoney(entry.appSales, rate));
    entry.finalBalance = subtractMoney(entry.netTransfer, entry.commissionDue);
  });
  return Array.from(map.values())
    .filter((e) => e.orderCount > 0)
    .sort((a, b) => b.totalSales - a.totalSales);
}

export interface SettlementTotals {
  totalVolume: number;
  grossProfit: number;
  totalOrders: number;
  storesWithSales: number;
}

/** Totais do herói do Consolidado a partir de uma liquidação. */
export function summarizeSettlement(settlement: SettlementEntry[]): SettlementTotals {
  const totalVolume = sumMoney(settlement.map((entry) => entry.totalSales));
  const grossProfit = sumMoney(
    settlement.map((entry) =>
      addMoney(
        entry.commissionDue, // comissão delivery físico
        subtractMoney(entry.appSales, entry.netTransfer), // comissão delivery PIX
        entry.pdvCommission // comissão PDV
      )
    )
  );
  const totalOrders = settlement.reduce((acc, e) => acc + e.orderCount, 0);
  return { totalVolume, grossProfit, totalOrders, storesWithSales: settlement.length };
}
