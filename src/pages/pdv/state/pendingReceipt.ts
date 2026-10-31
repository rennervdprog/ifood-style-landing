import { printPdvReceipt, type PrintOptions } from "@/lib/thermalPrint";

/**
 * Cupom de venda com impressão automática ADIADA (item 12, diagnóstico
 * reaberto em 2026-10-31).
 *
 * O checkout (usePdvCheckout) NÃO chama mais `window.print()` durante a
 * conclusão da venda quando a página fornece `onAutoPrintReady`: ele
 * entrega o job pronto e a página o guarda aqui (sessionStorage). A
 * página dispara a impressão DEPOIS que o operador sai da tela de
 * sucesso ("Nova venda", troca de aba ou remontagem após reload).
 *
 * Motivo: `window.print()` abre o preview de impressão do navegador,
 * que é MODAL — enquanto ele está aberto, nenhum clique chega à página.
 * Imprimir durante a tela de sucesso prendia o operador nela: o botão
 * "Nova venda" (a única saída) parecia morto até o preview ser
 * impresso/cancelado ou a página recarregar. Guardar o job em
 * sessionStorage garante que nenhum cupom se perde se a página
 * recarregar entre a conclusão e a saída da tela de sucesso: a
 * remontagem do PDV dispara o que estiver pendente.
 */
export interface PendingReceiptJob {
  order: Parameters<typeof printPdvReceipt>[0];
  storeName: string;
  options: PrintOptions;
}

const KEY = "pdv_pending_receipt_v1";

/** Guarda o job do cupom para impressão após a saída da tela de sucesso. */
export function stashPendingReceipt(job: PendingReceiptJob): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(job));
  } catch {
    // Sem sessionStorage (modo restrito), o cupom pendente se perde —
    // mesmo comportamento de um reload sem o adiamento; nunca trava a venda.
  }
}

/** Há um cupom aguardando impressão? */
export function hasPendingReceipt(): boolean {
  try {
    return sessionStorage.getItem(KEY) != null;
  } catch {
    return false;
  }
}

/**
 * Dispara a impressão do cupom pendente (se houver) e o consome.
 * Retorna true se havia um job. Nunca lança: falha de impressão é
 * best-effort e o cupom pode ser reimpresso pelo Histórico.
 */
export function flushPendingReceipt(): boolean {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(KEY);
    if (raw != null) sessionStorage.removeItem(KEY);
  } catch {
    return false;
  }
  if (!raw) return false;
  try {
    const job = JSON.parse(raw) as PendingReceiptJob;
    printPdvReceipt(job.order, job.storeName, job.options);
    return true;
  } catch (e) {
    console.warn("[PDV] Falha ao imprimir cupom adiado:", e);
    return false;
  }
}
