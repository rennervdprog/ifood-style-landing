import { REPASSE_RULES } from "@/lib/repasseRules";

/**
 * Vocabulário e textos reutilizáveis do financeiro do lojista.
 * “Repasse” fica reservado a valores recebidos; valores devidos à plataforma
 * são apresentados como taxas e comissões em aberto.
 */
export const FINANCE_COPY = {
  outstandingTitle: "Taxas e comissões em aberto",
  outstandingShortTitle: "A pagar à plataforma",
  weeklyChargeTitle: "Cobrança semanal de taxas",
  physicalSalesLabel: "Taxas de vendas pagas fora do PIX online",
  cycleLabel: "Total deste ciclo",
  paymentSuccess: "Após a confirmação do PIX, a situação da loja é reavaliada automaticamente.",
} as const;

export function weeklyChargeRuleText() {
  return `Quando o saldo de um ciclo atingir R$ ${REPASSE_RULES.MIN_AUTO_CHARGE_BRL.toFixed(2).replace(".", ",")}, uma cobrança PIX poderá ser criada na segunda-feira. Cada ciclo é cobrado separadamente.`;
}

export function blockingRuleText() {
  return `Uma cobrança pendente por ${REPASSE_RULES.SUSPENSION_DAYS} dias pode bloquear novos pedidos. Saldo de R$ ${REPASSE_RULES.BLOCK_THRESHOLD_BRL.toFixed(2).replace(".", ",")} ou mais também pode bloquear a loja até a regularização.`;
}
