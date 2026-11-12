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
 *
 * Follow-up P9 (2026-11-12, palavra do Renner): a configuração da loja
 * volta a mandar. O job carrega a decisão da venda (`autoPrint`,
 * calculada no checkout a partir de `settings.auto_print_pdv`): no
 * navegador, com a configuração LIGADA, o flush imprime
 * automaticamente pelo caminho existente — o preview modal é esperado
 * nesse ramo, é a opção que o lojista escolheu, e o operador humano
 * o dispensa (imprime/cancela) e segue; com a configuração DESLIGADA,
 * o flush mostra o toast. Jobs legados em sessionStorage, sem a flag
 * (guardados por build anterior), caem no toast — o ramo seguro. No
 * app Windows a ponte silenciosa imprime automaticamente em qualquer
 * dos casos.
 */
export interface PendingReceiptJob {
  order: Parameters<typeof printPdvReceipt>[0];
  storeName: string;
  options: PrintOptions;
  /**
   * Decisão da venda, calculada no checkout a partir de
   * `settings.auto_print_pdv` (default ligado). Opcional só para
   * compatibilidade com jobs legados em sessionStorage (build
   * anterior à flag): sem ela, o flush cai no ramo seguro (toast).
   */
  autoPrint?: boolean;
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
 * A decisão segue a configuração da loja, carregada no job
 * (`autoPrint`): no app Windows (Electron), com a ponte de impressão
 * silenciosa, imprime automaticamente em qualquer dos casos. No
 * navegador, com a configuração ligada, imprime automaticamente pelo
 * caminho existente (o preview modal é esperado — opção do lojista);
 * com a configuração desligada, ou job legado sem a flag, mostra o
 * toast com CTA Imprimir e o cupom só sai por gesto do operador.
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
      // window.print() não abre o preview modal. Automático sempre.
      printPdvReceipt(job.order, job.storeName, job.options);
    } else if (job.autoPrint === true) {
      // Navegador + configuração ligada: o lojista escolheu a
      // automática. O preview modal do navegador é esperado aqui —
      // o operador humano o dispensa (imprime/cancela) e segue; a
      // travada da P9 existia porque o modal disparava sem escolha.
      // (Follow-up P9, palavra do Renner 2026-11-12.)
      printPdvReceipt(job.order, job.storeName, job.options);
    } else {
      // Navegador + configuração desligada, ou job legado sem a flag
      // (guardado por build anterior): ramo seguro — mesmo toast do
      // ramo manual do checkout (texto, CTA e duração idênticos); o
      // CTA imprime pelo caminho existente.
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
