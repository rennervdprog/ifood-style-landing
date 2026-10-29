/**
 * Regras da cobrança da rede — Fase 4 (plano 28/10/2026, seção 4.4).
 *
 * Funções PURAS que espelham as regras aplicadas pela migration
 * 20261028220000 (RPC `calculate_network_monthly_fee`) e pela edge
 * `monthly-billing`. A fonte da verdade é o banco + a edge; estas funções
 * existem para os testes unitários e para o app decidir o que mostrar —
 * nunca para autorizar cobrança sozinhas.
 *
 * Regras (não mudar sem a palavra do Renner):
 *  - Decisão 1: 1 mensalidade por rede cobre até 3 sublojas grátis; a
 *    partir da 4ª subloja de delivery, R$ 39,90 por subloja adicional.
 *    A base é o preço do plano da rede (plan_templates).
 *  - Decisão 2: GMV 60d das sublojas <= R$ 5.000 → a rede não paga nada.
 *  - Decisão 6: subloja só-PDV não conta nos 3 grátis, não paga os
 *    R$ 39,90, e continua pagando os seus R$ 120/mês no próprio plano.
 *  - Guia-matriz: não tem plano próprio — com a cobrança da rede ligada,
 *    a mensalidade da guia é zerada na edge (ela não vende).
 *  - Flag: tudo isso SÓ vale para redes com billing_enabled ligado. Com
 *    a flag desligada, a cobrança segue exatamente como hoje.
 *  - Fase 4b (decisões do Renner, 28/10/2026):
 *    P1: rede composta SÓ de unidades só-PDV tem base 0 (REGRA, não
 *    override) — ver `calcNetworkFeeDetailed` (base_reason
 *    "pdv_only_network"). Rede mista inalterada.
 *    P2: precedência da base override > template > guardado — ver
 *    `resolveNetworkBaseFee` / `isNetworkVip` (espelhos de
 *    `src/lib/vipDetection.ts`, que é a fonte da regra de divergência).
 */

export type NetworkUnitLike = {
  is_matriz?: boolean | null;
  status?: string | null;
  /** Plano da loja (stores.plan_type ou plano ativo). */
  plan_type?: string | null;
};

export function isPdvOnlyUnit(unit: NetworkUnitLike): boolean {
  return unit.plan_type === "pdv_only";
}

/** É subloja publicada (conta para os extras)? Rascunho não conta. */
export function isPublishedUnit(unit: NetworkUnitLike): boolean {
  return !unit.is_matriz && unit.status === "ativo";
}

/**
 * Quantas sublojas de delivery contam para os extras? Publicadas,
 * não-matriz e NÃO só-PDV (decisão 6). A matriz nunca entra.
 */
export function countDeliveryUnits(units: readonly NetworkUnitLike[]): number {
  return units.filter((u) => isPublishedUnit(u) && !isPdvOnlyUnit(u)).length;
}

/** Quantas sublojas só-PDV publicadas (pagam o próprio plano, fora da conta). */
export function countPdvOnlyUnits(units: readonly NetworkUnitLike[]): number {
  return units.filter((u) => isPublishedUnit(u) && isPdvOnlyUnit(u)).length;
}

export type UnitPlanBillingInput = {
  /** A loja pertence a uma rede (network_id preenchido)? */
  inNetwork: boolean;
  /** A rede tem billing_enabled ligado? */
  networkBillingEnabled: boolean;
  /** Tipo do plano da loja (store_plans.plan_type). */
  planType: string;
  /** Mensalidade guardada no plano da loja. */
  monthlyFee: number;
};

/**
 * Mensalidade do plano de UMA loja dentro da cobrança mensal.
 * - Rede com flag ligada + loja da rede (subloja ou guia) + plano que
 *   NÃO é só-PDV → 0 (a mensalidade passa a ser a da rede, 1 vez só).
 * - Subloja só-PDV → paga o próprio plano (R$ 120) sempre.
 * - Flag desligada, ou loja fora de rede → valor de hoje, inalterado.
 */
export function resolveUnitPlanMonthlyFee(input: UnitPlanBillingInput): number {
  const { inNetwork, networkBillingEnabled, planType, monthlyFee } = input;
  if (inNetwork && networkBillingEnabled && planType !== "pdv_only") {
    return 0;
  }
  return monthlyFee;
}

export type UnitPlanSkipInput = UnitPlanBillingInput & {
  /** Comissão PDV pendente somada na fatura da loja. */
  pdvPending: number;
  /** Total de add-ons ativos somado na fatura da loja. */
  addonsTotal: number;
  /** Crédito acumulado no plano da loja (centavos). */
  billingCreditCents: number;
};

/**
 * A fatura da loja deve ser pulada (sem transação, sem PIX)?
 * Só quando a mensalidade foi zerada pela rede E não sobrou nada para
 * cobrar (sem comissão PDV, sem add-on, sem crédito para consumir).
 * Com add-on (ex.: PDV R$ 49 numa subloja de delivery), a fatura sai
 * só com o add-on — a loja não some da cobrança.
 */
export function shouldSkipUnitPlanBill(input: UnitPlanSkipInput): boolean {
  const monthly = resolveUnitPlanMonthlyFee(input);
  if (monthly !== 0) return false;
  if (!input.inNetwork || !input.networkBillingEnabled) return false;
  if (input.planType === "pdv_only") return false;
  return (
    input.pdvPending <= 0 &&
    input.addonsTotal <= 0 &&
    input.billingCreditCents <= 0
  );
}

export type NetworkFeeBreakdownInput = {
  /** Valor guardado em store_networks.monthly_fee (fallback). */
  storedFee: number;
  /** Preço do plano em plan_templates (null = sem template ativo). */
  templateFee: number | null;
  /** Override negociado da rede (null = sem negociação). */
  overrideFee: number | null;
  deliveryUnitCount: number;
  pdvOnlyUnitCount: number;
  gmv60d: number;
};

export type NetworkFeeBreakdown = {
  baseMonthlyFee: number;
  /** "override" | "template" | "stored_fallback" | "pdv_only_network". */
  baseReason: string;
  isVip: boolean;
  /** "granted" (override divergente) | "systemic" (base zerada por regra) | "none". */
  vipKind: "granted" | "systemic" | "none";
  extraUnitCount: number;
  extraFee: number;
  freeByGmv: boolean;
  totalMonthlyFee: number;
};

/**
 * Precedência da base da rede (P2): override (não-nulo) > template >
 * guardado. Espelha `resolveNetworkBaseFee` de `vipDetection.ts`.
 */
export function resolveNetworkBaseFee(input: {
  storedFee: number | null | undefined;
  templateFee: number | null | undefined;
  overrideFee: number | null | undefined;
}): number {
  if (input.overrideFee != null) return Number(input.overrideFee);
  if (input.templateFee != null) return Number(input.templateFee);
  return Number(input.storedFee ?? 0);
}

/**
 * Selo VIP da rede por divergência de valor (P2): override presente E
 * diferente da referência (template, ou guardado sem template).
 * Override igual ao template NÃO é VIP. Espelha `isNetworkVip`.
 */
export function isNetworkVip(input: {
  storedFee: number | null | undefined;
  templateFee: number | null | undefined;
  overrideFee: number | null | undefined;
}): boolean {
  if (input.overrideFee == null) return false;
  const reference = input.templateFee ?? input.storedFee;
  if (reference == null) return true;
  return Number(input.overrideFee) !== Number(reference);
}

/**
 * Cálculo completo da mensalidade da rede (espelho puro da RPC
 * `calculate_network_monthly_fee` pós-4b).
 * P1: 0 sublojas de delivery + >= 1 só-PDV → base 0, base_reason
 * "pdv_only_network" (vence o override: as unidades já pagam o próprio
 * plano; cobrar base em cima seria dupla cobrança). Rede mista: base
 * cheia + R$ 39,90 por delivery além de 3. Gratuidade GMV <= 5000 zera
 * o total em qualquer caso.
 */
export function calcNetworkFeeDetailed(
  input: NetworkFeeBreakdownInput,
): NetworkFeeBreakdown {
  const { deliveryUnitCount, pdvOnlyUnitCount, gmv60d } = input;
  let baseMonthlyFee: number;
  let baseReason: string;
  let isVip: boolean;
  if (deliveryUnitCount === 0 && pdvOnlyUnitCount > 0) {
    baseMonthlyFee = 0;
    baseReason = "pdv_only_network";
    isVip = false;
  } else if (input.overrideFee != null) {
    baseMonthlyFee = Number(input.overrideFee);
    baseReason = "override";
    isVip = isNetworkVip(input);
  } else if (input.templateFee != null) {
    baseMonthlyFee = Number(input.templateFee);
    baseReason = "template";
    isVip = false;
  } else {
    baseMonthlyFee = Number(input.storedFee ?? 0);
    baseReason = "stored_fallback";
    isVip = false;
  }
  const extraUnitCount = Math.max(0, deliveryUnitCount - 3);
  const extraFee = extraUnitCount * 39.9;
  const freeByGmv = gmv60d <= 5000;
  const vipKind =
    baseReason === "pdv_only_network" ? "systemic" : isVip ? "granted" : "none";
  return {
    baseMonthlyFee,
    baseReason,
    isVip,
    vipKind,
    extraUnitCount,
    extraFee,
    freeByGmv,
    totalMonthlyFee: freeByGmv ? 0 : baseMonthlyFee + extraFee,
  };
}

/**
 * Descrição curta da cobrança da rede para o PIX (limite de 140 chars
 * da Woovi — a edge corta de qualquer forma).
 */
export function buildNetworkChargeDescription(args: {
  networkName: string;
  baseMonthlyFee: number;
  extraFee: number;
  referenceCode: string;
}): string {
  const { networkName, baseMonthlyFee, extraFee, referenceCode } = args;
  const fmt = (v: number) => `R$${v.toFixed(2)}`;
  const extras = extraFee > 0 ? ` + extras ${fmt(extraFee)}` : "";
  return `Mensalidade rede ${networkName} (${fmt(baseMonthlyFee)}${extras}) - ${referenceCode}`;
}
