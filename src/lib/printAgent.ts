/**
 * Agente de impressão ItaSuper — helpers compartilhados entre o painel
 * (pareamento/status) e as varreduras de impressão.
 */

/**
 * Status que a varredura de impressão automática cobre: o pedido novo
 * ('pendente') e o já aceito ('preparando') que ainda não imprimiu — com o
 * aceite automático, o pedido pode sair de 'pendente' antes de qualquer
 * painel abrir, e a notinha não pode se perder por isso. A trava de
 * reivindicação no servidor (printed_at) impede duplicidade.
 */
export const AUTO_PRINT_SWEEP_STATUSES = ["pendente", "preparando"] as const;

/** Código de pareamento do agente: 6 dígitos, uso único, 30 min de validade. */
export function generatePairingCode(): string {
  const g = globalThis as { crypto?: Crypto };
  if (g.crypto?.getRandomValues) {
    const buf = new Uint32Array(1);
    g.crypto.getRandomValues(buf);
    return String(buf[0] % 1_000_000).padStart(6, "0");
  }
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
}

/** Instante de expiração de um código gerado agora (+30 min), em ISO. */
export function pairingExpiryISO(from: Date = new Date()): string {
  return new Date(from.getTime() + 30 * 60 * 1000).toISOString();
}

export type PrintAgentStatus = "aguardando" | "conectado" | "offline" | "revogado";

export interface PrintAgentRowLike {
  pairing_code?: string | null;
  token_hash?: string | null;
  last_seen_at?: string | null;
  revoked_at?: string | null;
}

/**
 * Estado de um agente para exibição no painel:
 * - revogado: o lojista desconectou o agente;
 * - aguardando: código gerado, agente ainda não pareou;
 * - conectado: pareado e visto há menos de 2 minutos (o poll é ~7s);
 * - offline: pareado, mas sem contato recente.
 */
export function printAgentStatus(row: PrintAgentRowLike, now: number = Date.now()): PrintAgentStatus {
  if (row.revoked_at) return "revogado";
  if (!row.token_hash) return "aguardando";
  if (row.last_seen_at) {
    const seen = new Date(row.last_seen_at).getTime();
    if (!Number.isNaN(seen) && now - seen < 2 * 60 * 1000) return "conectado";
  }
  return "offline";
}
