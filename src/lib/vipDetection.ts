/**
 * Identificação de condição VIP por DIVERGÊNCIA DE VALOR — Fase 4b
 * (decisões do Renner, 28/10/2026).
 *
 * Regra central: VIP é valor salvo DIFERENTE do template do plano, nunca
 * mera não-nulidade. Um override igual ao default NÃO é VIP — isso limpa
 * os falsos-VIPs que a regra antiga (override != null) gerava nos
 * relatórios e selos.
 *
 * Espelhos desta regra (manter alinhados; cada um vive no seu runtime):
 *  - RPC `calculate_network_monthly_fee` (migration 20261028230000):
 *    selo VIP da rede por divergência do `monthly_fee_override`.
 *  - Edge `monthly-billing`: cópia inline desta lógica (edges são
 *    self-contained — não importam `src/lib` no deploy).
 *  - `AdminPlanManager.tsx`: usa estas funções direto (salvar valores
 *    e trocar de plano).
 *
 * Padrões operacionais (NÃO estão em `plan_templates` — são os defaults
 * que o próprio editor VIP já usava):
 *  - Taxa PIX padrão: R$ 1,99 por transação.
 *  - Taxa de entrega padrão: R$ 2,00 por entrega.
 *  - Taxa fixa PDV padrão: R$ 1,00 para fixed/autonomy, R$ 0 nos demais.
 */

export const DEFAULT_PIX_FEE = 1.99;
export const DEFAULT_DELIVERY_SPLIT = 2.0;

/** Taxa fixa PDV padrão por tipo de plano (mesma tabela do editor VIP). */
export function defaultPdvFixedFee(planType: string): number {
  return planType === "fixed" || planType === "autonomy" ? 1 : 0;
}

export type PlanValueSet = {
  monthly_fee: number | null | undefined;
  commission_rate: number | null | undefined;
  /** Override de taxa PIX (null = padrão). */
  pix_operational_fee_override?: number | null | undefined;
  /** Override de taxa de entrega (null = padrão). */
  platform_delivery_split_override?: number | null | undefined;
  /** Taxa fixa por venda PDV (null = padrão do plano). */
  pdv_fixed_fee_per_sale?: number | null | undefined;
};

export type PlanTemplateValues = {
  monthly_fee: number | null | undefined;
  commission_rate: number | null | undefined;
};

export type VipDivergence = {
  /** Há pelo menos um campo divergente do template/padrão? */
  isVip: boolean;
  /** Campos que divergem (nomes de coluna, para o log). */
  divergedFields: string[];
};

/**
 * Detecta VIP por divergência de valor entre os valores salvos e o
 * template/padrões do plano. Comparação numérica (Number) para não
 * tratar "89.90" (string do banco) como divergente de 89.9.
 */
export function detectVipDivergence(
  values: PlanValueSet,
  template: PlanTemplateValues,
  pdvFixedDefault: number,
): VipDivergence {
  const divergedFields: string[] = [];
  const differs = (a: number | null | undefined, b: number | null | undefined) =>
    Number(a ?? 0) !== Number(b ?? 0);

  if (differs(values.monthly_fee, template.monthly_fee)) {
    divergedFields.push("monthly_fee");
  }
  if (differs(values.commission_rate, template.commission_rate)) {
    divergedFields.push("commission_rate");
  }
  // Override só é VIP quando o VALOR diverge do padrão operacional.
  // pix_override = 1,99 (igual ao padrão) NÃO é VIP.
  if (
    values.pix_operational_fee_override != null &&
    differs(values.pix_operational_fee_override, DEFAULT_PIX_FEE)
  ) {
    divergedFields.push("pix_operational_fee_override");
  }
  if (
    values.platform_delivery_split_override != null &&
    differs(values.platform_delivery_split_override, DEFAULT_DELIVERY_SPLIT)
  ) {
    divergedFields.push("platform_delivery_split_override");
  }
  if (
    values.pdv_fixed_fee_per_sale != null &&
    differs(values.pdv_fixed_fee_per_sale, pdvFixedDefault)
  ) {
    divergedFields.push("pdv_fixed_fee_per_sale");
  }

  return { isVip: divergedFields.length > 0, divergedFields };
}

export type VipKind = "granted" | "systemic" | "none";

/**
 * Distingue VIP concedido de VIP sistêmico:
 *  - "granted": divergência negociada de valor (tem — ou deve ter —
 *    registro em admin_logs com motivo).
 *  - "systemic": valor zerado/grátis por REGRA do sistema, não por
 *    negociação — ex.: base zerada de rede só-PDV (P1) ou mensalidade
 *    da subloja zerada porque a rede a cobra (a edge já não a rotula
 *    VIP nesses casos; este é o rótulo explícito para relatórios).
 *  - "none": sem divergência e sem gratuidade sistêmica.
 */
export function classifyVipKind(args: {
  diverges: boolean;
  /** O valor zero/grátis veio de regra do sistema, não de negociação. */
  isSystemicFree: boolean;
}): VipKind {
  if (args.isSystemicFree) return "systemic";
  if (args.diverges) return "granted";
  return "none";
}

export function vipKindLabel(kind: VipKind): string | null {
  if (kind === "granted") return "VIP concedido";
  if (kind === "systemic") return "VIP sistêmico";
  return null;
}

/** Motivo a gravar no log quando o admin não informou nenhum. */
export const VIP_NO_REASON = "sem motivo informado";

/** Resolve o motivo do log: input do admin, ou o padrão quando vazio. */
export function resolveVipReason(input: string | null | undefined): string {
  const trimmed = (input ?? "").trim();
  return trimmed.length > 0 ? trimmed : VIP_NO_REASON;
}

// ── VIP de rede (P2 + selo, mesma regra de divergência) ────────────────

export type NetworkFeeInput = {
  /** Valor guardado em store_networks.monthly_fee (fallback). */
  storedFee: number | null | undefined;
  /** Preço do plano em plan_templates (null = sem template ativo). */
  templateFee: number | null | undefined;
  /** Override negociado (null = sem negociação). */
  overrideFee: number | null | undefined;
};

/**
 * Precedência da base da rede (P2): override (não-nulo) > template >
 * valor guardado. Override igual ao template NÃO muda a base — mas
 * continua registrado no breakdown (é o que limpa os falso-VIPs).
 */
export function resolveNetworkBaseFee(input: NetworkFeeInput): number {
  if (input.overrideFee != null) return Number(input.overrideFee);
  if (input.templateFee != null) return Number(input.templateFee);
  return Number(input.storedFee ?? 0);
}

/**
 * Selo VIP da rede por divergência de valor: override presente E
 * diferente do preço de referência (template quando há, guardado quando
 * não há). Override == template NÃO é VIP.
 */
export function isNetworkVip(input: NetworkFeeInput): boolean {
  if (input.overrideFee == null) return false;
  const reference = input.templateFee ?? input.storedFee;
  // Sem referência (sem template e sem valor guardado), qualquer
  // override presente é divergência — espelha a RPC (IS DISTINCT FROM).
  if (reference == null) return true;
  return Number(input.overrideFee) !== Number(reference);
}
