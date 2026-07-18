import { useCallback, useMemo, useState } from "react";
import { sumMoney, subtractMoney } from "@/lib/utils";
import { parseBRL } from "@/hooks/useBRLInput";
import type { CartAddon } from "@/contexts/CartContext";
import type { CartItem, Product } from "../types";
import type { SplitPayment } from "@/components/pdv/PdvSplitPayment";

/** Chave de agrupamento de carrinho por addons normalizada. */
function addonKeyOf(addons?: CartAddon[]): string {
  if (!addons || addons.length === 0) return "";
  return addons.map((a) => a.name).sort().join(",");
}

/**
 * Estado do carrinho do PDV (itens, desconto, pagamento, troco, split).
 *
 * Não toca em banco — só calcula e expõe ações puras. A finalização da
 * venda (insert em orders/order_items/movements + impressão) fica no
 * hook `usePdvCheckout` (próximo sub-turno da refatoração).
 */
export function usePdvCart() {
  // ── Estado bruto ──
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [tableId, setTableId] = useState("");
  // Seleção real de mesa/comanda (v1.20.12 — integração com pdv_tables/pdv_tabs)
  const [selectedTable, setSelectedTable] = useState<{ id: string; label: string } | null>(null);
  const [selectedTabId, setSelectedTabId] = useState<string | null>(null);
  const [discountType, setDiscountType] = useState<"R$" | "%">("R$");
  const [discountInput, setDiscountInput] = useState("");
  const [showDiscount, setShowDiscount] = useState(false);
  const [cashReceived, setCashReceived] = useState("");
  const [orderDone, setOrderDone] = useState(false);
  const [splitMode, setSplitMode] = useState(false);
  const [splitPayments, setSplitPayments] = useState<SplitPayment[]>([]);
  const [productModal, setProductModal] = useState<any | null>(null);

  // ── Cálculos derivados (memoizados — Fase 6 perf) ──
  const subtotal = useMemo(
    () => sumMoney(cart.map((i) => i.price * i.quantity)),
    [cart],
  );
  const totalItems = useMemo(
    () => cart.reduce((a, i) => a + i.quantity, 0),
    [cart],
  );

  const discountAmount = useMemo(() => {
    const v = parseBRL(discountInput);
    if (discountType === "%") return Math.min(subtotal, subtotal * (v / 100));
    return Math.min(subtotal, v);
  }, [discountInput, discountType, subtotal]);

  const finalTotal = useMemo(
    () => subtractMoney(subtotal, discountAmount),
    [subtotal, discountAmount],
  );

  const cashVal = useMemo(() => parseBRL(cashReceived), [cashReceived]);
  const troco = useMemo(
    () => (cashReceived ? Math.max(0, cashVal - finalTotal) : 0),
    [cashReceived, cashVal, finalTotal],
  );
  const trocoNegativo = !!cashReceived && cashVal < finalTotal;

  const getQty = useCallback(
    (id: string) => cart.find((i) => i.id === id)?.quantity ?? 0,
    [cart],
  );

  // ── Mutações ──
  const openProduct = useCallback((p: Product) => setProductModal(p), []);

  /** Adiciona/agrega item após configuração no modal (com addons/observações). */
  const handleModalAdd = useCallback(
    (
      product: any,
      addons: CartAddon[],
      observations: string,
      quantity: number,
      totalUnitPrice: number,
      metadata?: Record<string, any>,
    ) => {
      const newKey = addonKeyOf(addons);
      const isWeightItem = !!metadata?.weight_grams;
      setCart((prev) => {
        // Itens vendidos por peso nunca agregam: cada pesagem é uma linha nova.
        if (isWeightItem) {
          return [
            ...prev,
            {
              id: product.id,
              name: product.name,
              basePrice: Number(product.price),
              price: totalUnitPrice,
              quantity: 1,
              addons: addons.length > 0 ? addons : undefined,
              observations: observations || undefined,
              image_url: product.image_url,
              metadata,
            },
          ];
        }
        const existing = prev.find(
          (i) =>
            i.id === product.id &&
            addonKeyOf(i.addons) === newKey &&
            (i.observations || "") === observations,
        );
        if (existing) {
          // Bug P0 corrigido: o `map` também precisa checar `observations`,
          // senão duas linhas com mesmo produto+addons mas obs diferentes
          // eram somadas erroneamente na primeira que casasse.
          return prev.map((i) =>
            i.id === product.id &&
            addonKeyOf(i.addons) === newKey &&
            (i.observations || "") === observations
              ? { ...i, quantity: i.quantity + quantity }
              : i,
          );
        }
        return [
          ...prev,
          {
            id: product.id,
            name: product.name,
            basePrice: Number(product.price),
            price: totalUnitPrice,
            quantity,
            addons: addons.length > 0 ? addons : undefined,
            observations: observations || undefined,
            image_url: product.image_url,
            metadata,
          },
        ];
      });
      setProductModal(null);
    },
    [],
  );

  /** Adiciona produto simples via leitor de código de barras (sem modal). */
  const addScannedProduct = useCallback((product: Product) => {
    setCart((prev) => {
      const existing = prev.find(
        (i) => i.id === product.id && !i.addons && !i.observations,
      );
      if (existing) {
        return prev.map((i) =>
          i.id === product.id && !i.addons && !i.observations
            ? { ...i, quantity: i.quantity + 1 }
            : i,
        );
      }
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          basePrice: Number(product.price),
          price: Number(product.price),
          quantity: 1,
          image_url: product.image_url,
        },
      ];
    });
  }, []);

  const decItem = useCallback((id: string) => {
    setCart((prev) => {
      const it = prev.find((i) => i.id === id);
      if (!it) return prev;
      if (it.quantity === 1) return prev.filter((i) => i.id !== id);
      return prev.map((i) => (i.id === id ? { ...i, quantity: i.quantity - 1 } : i));
    });
  }, []);

  /**
   * Remove UMA linha do carrinho pelo índice. Antes recebia `id`, o que
   * apagava TODAS as linhas do mesmo produto (mesmo com addons/obs
   * diferentes). Bug P0 do relatório PDV.
   */
  const removeItem = useCallback((index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  }, []);

  /** Zera o estado de venda (chamado após finalizar ou ao cancelar). */
  const clearSale = useCallback(() => {
    setCart([]);
    setPaymentMethod("");
    setTableId("");
    setSelectedTable(null);
    setSelectedTabId(null);
    setDiscountType("R$");
    setDiscountInput("");
    setShowDiscount(false);
    setCashReceived("");
    setOrderDone(false);
    setSplitMode(false);
    setSplitPayments([]);
  }, []);

  return {
    // estado
    cart,
    setCart,
    paymentMethod,
    setPaymentMethod,
    tableId,
    setTableId,
    selectedTable,
    setSelectedTable,
    selectedTabId,
    setSelectedTabId,
    discountType,
    setDiscountType,
    discountInput,
    setDiscountInput,
    showDiscount,
    setShowDiscount,
    cashReceived,
    setCashReceived,
    orderDone,
    setOrderDone,
    splitMode,
    setSplitMode,
    splitPayments,
    setSplitPayments,
    productModal,
    setProductModal,
    // derivados
    subtotal,
    totalItems,
    discountAmount,
    finalTotal,
    cashVal,
    troco,
    trocoNegativo,
    getQty,
    // ações
    openProduct,
    handleModalAdd,
    addScannedProduct,
    decItem,
    removeItem,
    clearSale,
  };
}