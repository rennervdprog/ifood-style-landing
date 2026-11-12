import { toast } from "sonner";
import type { CartItem, SaleSnapshot } from "@/pages/pdv/types";

/**
 * Duração do toast "Venda limpa" (F2, 2c): 10 s. O "Desfazer" vive só nesse
 * toast — 5 s era curto demais para localizar e clicar o botão da ação
 * (o clique no corpo do toast dispensa sem restaurar).
 */
export const CLEARED_SALE_TOAST_DURATION_MS = 10000;

export interface ClearSaleWithUndoArgs {
  cart: CartItem[];
  tableId: string;
  selectedTable: { id: string; label: string } | null;
  selectedTabId: string | null;
  discountType: "R$" | "%";
  discountInput: string;
  /** N2 Opção A — cancela a comanda vazia; nunca lança exceção. */
  cancelEmptyTab: (tabId: string | null) => Promise<boolean>;
  /** Limpa a venda (no PdvPage, o wrapper que também reseta o passo mobile). */
  clearSale: () => void;
  /** Restaura o snapshot; ausente = toast sem ação Desfazer. */
  restoreCart?: (snapshot: SaleSnapshot) => void;
}

/**
 * F1 (2c) — gesto "Limpar venda" compartilhado entre o botão do carrinho e
 * o ESC: cancela a comanda vazia (N2), monta o snapshot do "Desfazer",
 * limpa a venda e mostra o toast. Semântica do snapshot (guarda 2 do N2):
 * se a comanda foi cancelada, o snapshot volta SEM destino (Balcão) — o
 * Desfazer restaura os itens sem ressuscitar o id da tab morta; se a
 * comanda foi preservada (tem itens enviados), o destino original é mantido.
 * Seguro com carrinho vazio (2a): o snapshot fica com 0 itens e o
 * cancelamento é decidido pela contagem no banco dentro de `cancelEmptyTab`.
 */
export async function clearSaleWithUndo(args: ClearSaleWithUndoArgs): Promise<void> {
  const {
    cart, tableId, selectedTable, selectedTabId,
    discountType, discountInput,
    cancelEmptyTab, clearSale, restoreCart,
  } = args;
  const tabGone = await cancelEmptyTab(selectedTabId);
  // Snapshot da venda para o "Desfazer" (campos de pagamento preenchidos vazios —
  // o pagamento agora acontece na tela própria).
  const snapshot: SaleSnapshot = {
    items: [...cart],
    paymentMethod: "",
    tableId: tabGone ? "" : tableId,
    selectedTable: tabGone ? null : selectedTable,
    selectedTabId: tabGone ? null : selectedTabId,
    discountType,
    discountInput,
    cashReceived: "",
    splitMode: false,
    splitPayments: [],
  };
  clearSale();
  toast.warning("Venda limpa", {
    action: restoreCart ? {
      label: "Desfazer",
      onClick: () => restoreCart(snapshot),
    } : undefined,
    duration: CLEARED_SALE_TOAST_DURATION_MS,
  });
}
