/**
 * Regras de repasse — fonte única de verdade para prazos, limiares e labels.
 * Qualquer texto/número sobre suspensão, bloqueio ou cobrança automática deve vir daqui.
 */
export const REPASSE_RULES = {
  /** Prazo desde a cobrança pendente mais antiga para bloqueio por não-pagamento. */
  SUSPENSION_DAYS: 30,
  /** Teto (BRL): saldo >= teto na rodada de segunda bloqueia a loja até quitar. */
  BLOCK_THRESHOLD_BRL: 500,
  /** Saldo mínimo (BRL) para geração automática de PIX na segunda-feira. */
  MIN_AUTO_CHARGE_BRL: 150,
  /** Dia da semana da cobrança automática (0=Dom .. 1=Seg). */
  WEEKLY_CHARGE_WEEKDAY: 1,
} as const;

export const REPASSE_LABELS = {
  title: "Repasse",
  pendingTitle: "Repasse pendente",
  pixTitle: "Repasse — pagamento via PIX",
  breakdown: {
    comissao: "Comissão do plano",
    taxaOperacional: "Pedidos pagos em PIX",
    pdv: "Taxa do PDV",
    splitEntrega: "Taxa das entregas",
  },
} as const;

/**
 * Texto único da regra de cobrança — reutilizar em tooltips/explicativos.
 */
export function repasseRulesSummary(): string {
  return `Durante a semana, tudo que você vende fica com você — só junta a parte do ItaSuper (R$ 0,99 por entrega + R$ 1,99 por pedido em PIX). Toda segunda-feira, se o acumulado passou de R$ ${REPASSE_RULES.MIN_AUTO_CHARGE_BRL}, geramos o PIX pra você quitar. Se a segunda chegar com o saldo acima de R$ ${REPASSE_RULES.BLOCK_THRESHOLD_BRL} e ele não for quitado, as vendas pausam até o pagamento. Cobrança sem pagar por ${REPASSE_RULES.SUSPENSION_DAYS} dias também pausa. Pagou, volta na hora.`;
}
