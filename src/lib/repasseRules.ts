/**
 * Regras de repasse — fonte única de verdade para prazos, limiares e labels.
 * Qualquer texto/número sobre suspensão, bloqueio ou cobrança automática deve vir daqui.
 */
export const REPASSE_RULES = {
  /** Prazo em dias para suspensão automática por não-pagamento. */
  SUSPENSION_DAYS: 30,
  /** Saldo (BRL) que trava o painel imediatamente até quitar. */
  BLOCK_THRESHOLD_BRL: 500,
  /** Saldo mínimo (BRL) para geração automática de PIX na segunda-feira. */
  MIN_AUTO_CHARGE_BRL: 30,
  /** Dia da semana da cobrança automática (0=Dom .. 1=Seg). */
  WEEKLY_CHARGE_WEEKDAY: 1,
} as const;

export const REPASSE_LABELS = {
  title: "Repasse",
  pendingTitle: "Repasse pendente",
  pixTitle: "Repasse — pagamento via PIX",
  breakdown: {
    comissao: "Comissão do plano",
    taxaOperacional: "Taxa operacional",
    pdv: "PDV",
    splitEntrega: "Split de entrega",
  },
} as const;

/**
 * Texto único da regra de cobrança — reutilizar em tooltips/explicativos.
 */
export function repasseRulesSummary(): string {
  return `O sistema gera uma cobrança PIX toda segunda-feira quando o saldo atinge ${
    REPASSE_RULES.MIN_AUTO_CHARGE_BRL
  } reais. Saldo acima de R$ ${REPASSE_RULES.BLOCK_THRESHOLD_BRL} trava o painel imediatamente. Sem pagamento em ${
    REPASSE_RULES.SUSPENSION_DAYS
  } dias, a loja é suspensa.`;
}