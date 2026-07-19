import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sumMoney } from "@/lib/utils";
import { parseBRL } from "@/hooks/useBRLInput";
import { printPdvReceipt } from "@/lib/thermalPrint";
import type { CartItem, PdvSession } from "../types";
import type { SplitPayment } from "@/components/pdv/PdvSplitPayment";
import { enqueue as outboxEnqueue, isOfflineQueueEnabled } from "./pdvOutbox";

/** Timeout de rede para a RPC (Fase 3). */
const RPC_TIMEOUT_MS = 1500;
const AUTH_TIMEOUT_MS = 800;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("rpc_timeout")), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

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
  store:
    | {
        id: string;
        name?: string | null;
        settings?: Record<string, any> | any | null;
      }
    | null
    | undefined;
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
  /** Operador PIN logado (Fase 2) — grava em pdv_movements.operator_id. */
  operatorId?: string | null;
  /** Callbacks de UI após sucesso. Recebe o `orderId` gerado (ou placeholder offline). */
  onSuccess: (info: { orderId: string | null }) => void;
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
        operatorId,
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
        const browserOffline =
          typeof navigator !== "undefined" && navigator.onLine === false;

        // Auditoria de operador (Fase 2 P1): quem registrou a venda.
        // Nunca deixa o PDV travado offline por causa da checagem de auth.
        let createdBy: string | null = null;
        try {
          const authPromise: Promise<any> = browserOffline
            ? supabase.auth.getSession()
            : supabase.auth.getUser();
          const { data: authData } = (await withTimeout(
            authPromise,
            AUTH_TIMEOUT_MS,
          )) as any;
          createdBy = authData?.user?.id ?? authData?.session?.user?.id ?? null;
        } catch (authError) {
          console.warn("[PDV] Auth audit skipped:", authError);
        }

        const primaryMethod = splitMode
          ? splitPayments[0]?.method || "dinheiro"
          : paymentMethod;
        const paymentsPayload = splitMode
          ? splitPayments
          : [{ method: paymentMethod, amount: finalTotal }];

        // 1) Order — tenta RPC atômica primeiro (Fase 1 P0: 3 inserts não
        //    atômicos podiam deixar pedido sem itens / sem movimento).
        //    Se a RPC ainda não foi aplicada no banco externo, cai no fluxo
        //    antigo de 3 inserts (backward-compat).
        let orderId: string | null = null;
        // Fase 3: client_uuid garante idempotência no banco quando a fila
        // offline reenviar o mesmo payload.
        const clientUuid =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const rpcPayload = {
          client_uuid: clientUuid,
          store_id: store.id,
          session_id: session.id,
          table_identifier: tableId || null,
          subtotal,
          pdv_discount: discountAmount,
          commission_rate: pdvCommissionRate ?? 0,
          total_price: finalTotal,
          payment_method: primaryMethod,
          payments: paymentsPayload,
          created_by: createdBy,
          operator_id: operatorId ?? null,
          items: cart.map((item) => ({
            product_id: item.id,
            quantity: item.quantity,
            unit_price: item.price,
            addons:
              item.addons && item.addons.length > 0 ? item.addons : null,
            observations: item.observations || null,
            metadata:
              item.metadata && Object.keys(item.metadata).length > 0
                ? item.metadata
                : null,
          })),
        };
        let shouldQueueOffline = browserOffline;
        let offlineQueued = false;

        if (!shouldQueueOffline) {
          try {
            const rpcPromise = (async () =>
              supabase.rpc("pdv_finalize_sale" as any, { _payload: rpcPayload } as any))();
            const { data: rpcRes, error: rpcErr } = (await withTimeout(
              rpcPromise,
              RPC_TIMEOUT_MS,
            )) as any;
            if (!rpcErr && rpcRes) {
              orderId =
                typeof rpcRes === "string"
                  ? rpcRes
                  : (rpcRes as any)?.order_id ?? (rpcRes as any)?.id ?? null;
            } else if (rpcErr) {
              const message = String(rpcErr.message ?? rpcErr);
              shouldQueueOffline = /fetch|network|timeout|failed to fetch/i.test(message);
              if (!shouldQueueOffline) {
                console.warn("[PDV] RPC pdv_finalize_sale falhou:", rpcErr);
              }
            }
          } catch (rpcCatch) {
            shouldQueueOffline = true;
            console.warn("[PDV] RPC pdv_finalize_sale falhou:", rpcCatch);
          }
        }

        // Fase 3: se a RPC não voltou (timeout / offline) e a feature flag
        // está ativa, enfileira e trata como sucesso — o cupom é impresso e
        // o operador entrega o produto. A fila reenvia depois.
        if (!orderId && shouldQueueOffline && isOfflineQueueEnabled()) {
          const enqueued = outboxEnqueue({
            client_uuid: clientUuid,
            store_id: store.id,
            payload: rpcPayload,
          });
          if (enqueued) {
            try {
              window.dispatchEvent(new Event("pdv-outbox-changed"));
            } catch {}
            orderId = clientUuid; // placeholder para o cupom / fluxos seguintes
            offlineQueued = true;
            toast.warning("Venda salva offline — sincroniza quando voltar.");
          } else {
            toast.error("Fila offline cheia (200). Verifique a conexão.");
          }
        }

        if (!orderId) {
          // Fallback (fluxo antigo, não atômico) — mantido até a RPC estar aplicada.
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
          orderId = order.id;

        // 2) Items
        await supabase.from("order_items").insert(
          cart.map((item) => ({
            order_id: orderId!,
            product_id: item.id,
            quantity: item.quantity,
            unit_price: item.price,
            addons:
              item.addons && item.addons.length > 0
                ? JSON.stringify(item.addons)
                : null,
            observations: item.observations || null,
            metadata: item.metadata && Object.keys(item.metadata).length > 0
              ? item.metadata
              : null,
          })) as any,
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
            order_id: orderId!,
            created_by: createdBy,
            operator_id: operatorId ?? null,
          })),
        );
        }

        queryClient.invalidateQueries({
          queryKey: ["pdv-movements", session.id],
        });
        onSuccess({ orderId });
        if (!offlineQueued) toast.success("✅ Venda finalizada!");

        // 4) Empties (garrafas retornáveis) — best-effort
        if (!offlineQueued && !browserOffline) {
          try {
            const { data: prods } = await withTimeout(
              (async () =>
                supabase
                  .from("products")
                  .select("id, metadata")
                  .in("id", cart.map((i) => i.id)))(),
              RPC_TIMEOUT_MS,
            ) as any;
            const hasReturnable = (prods || []).some(
              (p: any) => p?.metadata?.returnable_bottle,
            );
            if (hasReturnable) {
              onEmptiesFlowStart({
                orderId: orderId!,
                items: cart.map((i) => ({ product_id: i.id, quantity: i.quantity })),
              });
            }
          } catch (e) {
            console.warn("Empties detection skipped:", e);
          }
        }

        // 5) Impressão térmica — best-effort
        try {
          // Bug P1: quando `settings` é null/undefined, `?.auto_print_pdv`
          // vira undefined e `!== false` era true — imprimia sempre. Agora
          // exigimos que a configuração exista e seja diferente de false.
          const settingsObj = (store?.settings as any) || {};
          const autoPrint = settingsObj.auto_print_pdv !== false;
          // Payload único do recibo (dedup — item 19 do relatório).
          const buildReceiptPayload = () => ({
            id: orderId!,
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
              metadata: item.metadata || null,
            })),
          });
          const printOpts = {
            copies: settingsObj.print_copies === 1 ? 1 : 2,
            paperWidth: settingsObj.print_paper_width === 58 ? 58 : 80,
          } as const;
          if (!autoPrint) {
            // Lojista optou por imprimir manualmente — deixamos o CTA no toast.
            toast("Cupom pronto — clique para imprimir", {
              action: {
                label: "Imprimir",
                onClick: () => {
                  try {
                    printPdvReceipt(buildReceiptPayload(), store?.name || "Loja", printOpts);
                  } catch (e) { console.warn("print error", e); }
                },
              },
              duration: 8000,
            });
          } else {
            printPdvReceipt(buildReceiptPayload(), store?.name || "Loja", printOpts);
          }
        } catch (e) {
          console.warn("Erro ao imprimir:", e);
        }

        // 6) Limpar venda após pequeno delay (deixa toast visível)
        // Fase 3 item 10 — abre gaveta ESC/POS quando venda em dinheiro (opt-in).
        try {
          const settingsObj = (store?.settings as any) || {};
          const drawerEnabled = settingsObj.pdv_drawer_enabled === true;
          const hasCash =
            primaryMethod === "dinheiro" ||
            paymentsPayload.some((p: any) => p?.method === "dinheiro");
          if (drawerEnabled && hasCash && !offlineQueued) {
            const { openCashDrawer } = await import("@/lib/cashDrawer");
            void openCashDrawer();
          }
        } catch (e) { console.warn("[PDV] cash drawer skipped:", e); }

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