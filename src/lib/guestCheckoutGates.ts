// Travas do checkout guest — Fase 4 do plano guest/bot (P1-1).
// Mesmas regras e mensagens do checkout logado (CheckoutPage.tsx):
// a loja "fechada" só trava o submit quando não está aceitando pré-pedido,
// e o pedido mínimo bloqueia o submit. O servidor (RPC
// create_order_with_items) continua sendo o trava final — isto é só o aviso
// antecipado no front, para o guest não preencher o pedido inteiro à toa.
import { formatBRL } from "@/lib/utils";
import type { StoreStatusResult } from "@/lib/storeStatus";

export interface GuestCheckoutGates {
  /** Loja fechada e sem janela de pré-pedido ativa. */
  isStoreClosed: boolean;
  /** Loja ainda não abriu, mas aceita pré-pedido (o pedido vira agendado). */
  isPreorder: boolean;
  /** Subtotal abaixo do pedido mínimo da loja. */
  belowMinimum: boolean;
  /** Quanto falta para o mínimo (0 quando não está abaixo). */
  minimumMissing: number;
  /** Erro do submit — a mesma mensagem do checkout logado — ou null. */
  submitError: string | null;
  /** Rótulo do botão de confirmar quando travado pelo mínimo. */
  minimumButtonLabel: string | null;
  /** Rótulo do botão quando a loja está fechada. */
  closedButtonLabel: string;
}

export function computeGuestCheckoutGates(args: {
  subtotal: number;
  minimumOrderValue: number;
  storeStatus: StoreStatusResult | null;
}): GuestCheckoutGates {
  const minimumOrderValue = Number(args.minimumOrderValue || 0);
  const isPreorder = !!(args.storeStatus?.acceptingPreorder && args.storeStatus.releaseAt);
  const isStoreClosed = args.storeStatus ? !args.storeStatus.isOpen && !isPreorder : false;
  const belowMinimum = minimumOrderValue > 0 && args.subtotal < minimumOrderValue;
  const minimumMissing = belowMinimum ? minimumOrderValue - args.subtotal : 0;

  let submitError: string | null = null;
  if (isStoreClosed) {
    submitError = `Loja fechada. ${args.storeStatus?.reason || ""}`;
  } else if (belowMinimum) {
    submitError = `Pedido mínimo desta loja: ${formatBRL(minimumOrderValue)}. Adicione mais ${formatBRL(minimumMissing)}.`;
  }

  return {
    isStoreClosed,
    isPreorder,
    belowMinimum,
    minimumMissing,
    submitError,
    minimumButtonLabel: belowMinimum ? `Faltam ${formatBRL(minimumMissing)} para o mínimo` : null,
    closedButtonLabel:
      args.storeStatus?.nextOpenDay && args.storeStatus?.nextOpenTime
        ? `${args.storeStatus.nextOpenDay === "Hoje" ? "Abre" : `Abre ${args.storeStatus.nextOpenDay}`} às ${args.storeStatus.nextOpenTime}`
        : "Loja fechada",
  };
}
