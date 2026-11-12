import { toast } from "sonner";
import { hasSilentPrintBridge, printPdvReceipt, type PrintOptions } from "@/lib/thermalPrint";

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
 *
 * P9 (2026-11-12): o adiamento só moveu o problema — o preview modal
 * passou a prender a tela SEGUINTE ao "Nova venda" (4 repros ao vivo;
 * o experimento liga/desliga fechou a causa). Por isso o flush NÃO
 * dispara mais `window.print()` automaticamente no navegador: mostra o
 * mesmo toast do ramo manual do checkout ("Cupom pronto — clique para
 * imprimir", com CTA Imprimir) e o cupom só sai por gesto do operador.
 * No app Windows (Electron), onde a ponte de impressão silenciosa
 * existe (`hasSilentPrintBridge`), o flush mantém a impressão
 * automática — lá `window.print()` não abre o preview modal.
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
 * Dispara o cupom pendente (se houver) e o consome.
 * Retorna true se havia um job. Nunca lança: falha de impressão é
 * best-effort e o cupom pode ser reimpresso pelo Histórico.
 *
 * No navegador, "disparar" = mostrar o toast com CTA Imprimir — nunca
 * `window.print()` automático (P9). No app Windows (Electron), com a
 * ponte de impressão silenciosa, imprime automaticamente como antes.
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
    if (hasSilentPrintBridge()) {
      // App Windows (Electron): impressão silenciosa via preload —
      // window.print() não abre o preview modal. Mantém o automático.
      printPdvReceipt(job.order, job.storeName, job.options);
    } else {
      // Navegador: nunca disparar window.print() automaticamente — o
      // preview modal sequestra os cliques da próxima tela (P9).
      // Mesmo toast do ramo manual do checkout (texto, CTA e duração
      // idênticos); o CTA imprime pelo caminho existente.
      toast("Cupom pronto — clique para imprimir", {
        action: {
          label: "Imprimir",
          onClick: () => {
            try {
              printPdvReceipt(job.order, job.storeName, job.options);
            } catch (e) { console.warn("print error", e); }
          },
        },
        duration: 8000,
      });
    }
    return true;
  } catch (e) {
    console.warn("[PDV] Falha ao imprimir cupom adiado:", e);
    return false;
  }
}
