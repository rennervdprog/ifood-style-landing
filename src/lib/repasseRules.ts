/**
 * Regras de repasse — fonte única de verdade para prazos, limiares e labels.
 * Qualquer texto/número sobre suspensão, bloqueio ou cobrança automática deve vir daqui.
 */
export const REPASSE_RULES = {
  /** Prazo desde a cobrança pendente mais antiga para bloqueio por não-pagamento. */
  SUSPENSION_DAYS: 30,
  /** Saldo (BRL) que bloqueia novos pedidos imediatamente até quitar. */
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
    taxaOperacional: "Taxa operacional",
    pdv: "PDV",
    splitEntrega: "Split de entrega",
  },
} as const;

/**
 * Texto único da regra de cobrança — reutilizar em tooltips/explicativos.
 */
export function repasseRulesSummary(): string {
  return `O sistema gera uma cobrança PIX toda segunda-feira quando o saldo do ciclo atinge R$ ${
    REPASSE_RULES.MIN_AUTO_CHARGE_BRL
  }. Cobranças de ciclos diferentes ficam separadas — não são somadas. Saldo total acima de R$ ${
    REPASSE_RULES.BLOCK_THRESHOLD_BRL
  } bloqueia novos pedidos até a quitação. A cobrança pendente mais antiga bloqueia a loja após ${
    REPASSE_RULES.SUSPENSION_DAYS
  } dias. Após a quitação integral, a loja é reativada automaticamente.`;
}