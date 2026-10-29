/**
 * Formatação única de tempo decorrido (minutos) para todo o painel.
 * É a regra que a Visão Geral do Início já usava — os cards de pedido
 * mostravam "6840min" cru enquanto o Início mostrava "4d 18h".
 * < 60 → "12 min" · < 1440 → "2h 5min" (ou "2h") · senão → "4d 18h" (ou "4d").
 */
export function formatElapsedMinutes(totalMinutes: number): string {
  const m = Math.max(0, Math.floor(totalMinutes));
  if (m < 60) return `${m} min`;
  if (m < 1440) {
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r ? `${h}h ${r}min` : `${h}h`;
  }
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  return h ? `${d}d ${h}h` : `${d}d`;
}
