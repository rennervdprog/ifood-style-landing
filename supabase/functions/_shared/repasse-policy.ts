/**
 * Política operacional única para cobrança de repasse e bloqueio financeiro.
 *
 * Interface web: src/lib/repasseRules.ts deve espelhar estes valores.
 * Não use prazos alternativos em novos crons ou funções financeiras.
 */
export const REPASSE_POLICY = {
  MIN_AUTO_CHARGE_BRL: 150,
  BLOCK_THRESHOLD_BRL: 500,
  SUSPENSION_DAYS: 30,
  WEEKLY_CHARGE_WEEKDAY: 1, // segunda-feira; o agendador deve respeitar este dia.
} as const;

export function ageInDays(fromIso: string, now = new Date()): number {
  const from = new Date(fromIso).getTime();
  if (Number.isNaN(from)) return 0;
  return (now.getTime() - from) / (1000 * 60 * 60 * 24);
}
