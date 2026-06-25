import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sumMoney } from "@/lib/utils";
import { parseBRL } from "@/hooks/useBRLInput";
import { printPdvReceipt } from "@/lib/thermalPrint";
import type { CartItem, PdvSession } from "../types";
import type { SplitPayment } from "@/components/pdv/PdvSplitPayment";

/**
 * Finalização da venda do PDV — extraído na Fase 1 da refatoração.
 *
 * Responsabilidades:
 *  - validar carrinho/pagamento (split ou simples)
 *  - criar order + order_items
 *  - registrar movimentações (uma por forma de pagamento, suporta split)
 *  - invalidar cache de movimentações do turno
 *  - detectar produtos retornáveis (garrafas) e abrir o fluxo de empties
 *  - imprimir o cupom térmico (best-effort, não bloqueia)
 *
 * Estado externo continua de fora (cart, payment, flags) — esse hook só
 * recebe os dados e age. Mantemos a assinatura ampla porque a finalização
 * envolve várias áreas; a alternativa (passar tudo via props/contexto) é
 * mais pesada que ganho.
 */
export interface CheckoutContext {
  store: { id: string; name?: string | null } | null | undefined;
  session: PdvSession | null;
  cart: CartItem[];
  splitMode: boolean;
  splitPayments: SplitPayment[];
  paymentMethod: string;
  cashReceived: string;
  cashVal: number;
  subtotal: number;
  finalTotal: number;
  discountAmount: number;
  troco: number;
  tableId: string;
  /** Comissão da loja (0–100) — geralmente vem de useStorePlan. */
  pdvCommissionRate: number;
  /** Callbacks de UI após sucesso. */
  onSuccess: () => void;
  onClearScheduled: () => void;
  onEmptiesFlowStart: (args: {
    orderId: string;
    items: { product_id: string; quantity: number }[];
  }) => void;
}

export function usePdvCheckout() {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const handleVenda = useCallback(
    async (ctx: CheckoutContext) => {
      const {
        store,
        session,
        cart,
        splitMode,
        splitPayments,
        paymentMethod,
        cashReceived,
        cashVal,
        subtotal,
        finalTotal,
        discountAmount,
        troco,
        tableId,
        pdvCommissionRate,
        onSuccess,
        onClearScheduled,
        onEmptiesFlowStart,
      } = ctx;

      if (!store?.id || !session) return;
      if (cart.length === 0) {
        toast.error("Carrinho vazio.");
        return;
      }

      // ── Validação de pagamento ──
      if (splitMode) {
        const splitTotal = sumMoney(splitPayments.map((p) => p.amount));
        if (Math.abs(splitTotal - finalTotal) > 0.01) {
          toast.error("Pagamentos não fecham o total.");
          return;
        }
      } else {
        if (!paymentMethod) {
          toast.error("Selecione o pagamento.");
          return;
        }
        if (paymentMethod === "dinheiro" && cashReceived && cashVal < finalTotal) {
          toast.error("Valor recebido menor que o total.");
          return;
        }
      }

      setLoading(true);
      try {
        const primaryMethod = splitMode
          ? splitPayments[0]?.method || "dinheiro"
          : paymentMethod;
        const paymentsPayload = splitMode
          ? splitPayments
          : [{ method: paymentMethod, amount: finalTotal }];

        // 1) Order
        const { data: order, error: oe } = await supabase
          .from("orders")
          .insert({
            store_id: store.id,
            client_id: null,
            order_source: "pdv",
            pdv_session_id: session.id,
            table_identifier: tableId || null,
            subtotal,
            delivery_fee: 0,
            pdv_discount: discountAmount,
            commission_rate: pdvCommissionRate ?? 0,
            total_price: finalTotal,
            app_fee: 0,
            payment_method: primaryMethod,
            payments: paymentsPayload,
            neighborhood: "Balcão",
            address_details: tableId ? `${tableId} — Presencial` : "Pedido presencial",
            status: "finalizado",
          } as any)
          .select("id")
          .single();
        if (oe) throw oe;

        // 2) Items
        await supabase.from("order_items").insert(
          cart.map((item) => ({
            order_id: order.id,
            product_id: item.id,
            quantity: item.quantity,
            unit_price: item.price,
            addons:
              item.addons && item.addons.length > 0
                ? JSON.stringify(item.addons)
                : null,
            observations: item.observations || null,
          })),
        );

        // 3) Movements (uma por forma de pagamento)
        await supabase.from("pdv_movements" as any).insert(
          paymentsPayload.map((p) => ({
            session_id: session.id,
            store_id: store.id,
            type: "sale",
            amount: p.amount,
            payment_method: p.method,
            description: tableId || "Venda balcão",
            order_id: order.id,
          })),
        );

        queryClient.invalidateQueries({
          queryKey: ["pdv-movements", session.id],
        });
        onSuccess();
        toast.success("✅ Venda finalizada!");

        // 4) Empties (garrafas retornáveis) — best-effort
        try {
          const { data: prods } = await supabase
            .from("products")
            .select("id, metadata")
            .in("id", cart.map((i) => i.id));
          const hasReturnable = (prods || []).some(
            (p: any) => p?.metadata?.returnable_bottle,
          );
          if (hasReturnable) {
            onEmptiesFlowStart({
              orderId: order.id,
              items: cart.map((i) => ({ product_id: i.id, quantity: i.quantity })),
            });
          }
        } catch (e) {
          console.warn("Empties detection skipped:", e);
        }

        // 5) Impressão térmica — best-effort
        try {
          printPdvReceipt(
            {
              id: order.id,
              created_at: new Date().toISOString(),
              subtotal,
              pdv_discount: discountAmount,
              total_price: finalTotal,
              payment_method: primaryMethod,
              cash_received:
                !splitMode && paymentMethod === "dinheiro" && cashReceived
                  ? parseBRL(cashReceived)
                  : undefined,
              troco:
                !splitMode && paymentMethod === "dinheiro" && cashReceived
                  ? troco
                  : undefined,
              table_identifier: tableId || null,
              payments: paymentsPayload,
              order_items: cart.map((item) => ({
                quantity: item.quantity,
                unit_price: item.price,
                products: { name: item.name },
              })),
            },
            store?.name || "Loja",
          );
        } catch (e) {
          console.warn("Erro ao imprimir:", e);
        }

        // 6) Limpar venda após pequeno delay (deixa toast visível)
        setTimeout(onClearScheduled, 2000);
      } catch (e: any) {
        toast.error(e.message || "Erro ao finalizar.");
      } finally {
        setLoading(false);
      }
    },
    [queryClient],
  );

  return { handleVenda, checkoutLoading: loading };
}