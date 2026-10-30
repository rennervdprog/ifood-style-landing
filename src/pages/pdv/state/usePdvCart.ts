import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sumMoney, subtractMoney } from "@/lib/utils";
import { parseBRL } from "@/hooks/useBRLInput";
import type { CartAddon } from "@/contexts/CartContext";
import type { CartItem, Product, SaleSnapshot } from "../types";
import type { SplitPayment } from "@/components/pdv/PdvSplitPayment";

/** Chave de agrupamento de carrinho por addons normalizada. */
function addonKeyOf(addons?: CartAddon[]): string {
  if (!addons || addons.length === 0) return "";
  return addons.map((a) => a.name).sort().join(",");
}

/** Chave do rascunho da venda em andamento (persistido por loja+turno). */
const DRAFT_KEY = (scope: string) => `pdv_cart_draft_v1:${scope}`;
/** Rascunho mais velho que isso é ignorado (venda abandonada de outro dia). */
const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

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
    (id: string) => cart.filter((i) => i.id === id).reduce((sum, i) => sum + i.quantity, 0),
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
              printer_target: (product as any)?.printer_target ?? null,
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
            printer_target: (product as any)?.printer_target ?? null,
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
          printer_target: (product as any)?.printer_target ?? null,
        },
      ];
    });
  }, []);

  const decItem = useCallback((id: string) => {
    setCart((prev) => {
      // Decrementa UMA linha por vez (a mais recente com esse produto).
      // Antes usava find + filter por id, o que apagava TODAS as linhas
      // do mesmo produto quando a quantidade chegava a 1.
      const idx = prev.map((i) => i.id).lastIndexOf(id);
      if (idx === -1) return prev;
      const it = prev[idx];
      if (it.quantity === 1) return prev.filter((_, i) => i !== idx);
      return prev.map((i, index) => (index === idx ? { ...i, quantity: i.quantity - 1 } : i));
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

  /** Restaura a venda completa (para desfazer "limpar venda"). */
  const restoreCart = useCallback((snapshot: SaleSnapshot) => {
    setCart(snapshot.items);
    setPaymentMethod(snapshot.paymentMethod);
    setTableId(snapshot.tableId);
    setSelectedTable(snapshot.selectedTable);
    setSelectedTabId(snapshot.selectedTabId);
    setDiscountType(snapshot.discountType);
    setDiscountInput(snapshot.discountInput);
    setShowDiscount(!!snapshot.discountInput);
    setCashReceived(snapshot.cashReceived);
    setSplitMode(snapshot.splitMode);
    setSplitPayments(snapshot.splitPayments);
    setOrderDone(false);
  }, []);

  // Ref síncrona do carrinho — permite decidir sem depender de closure stale.
  const cartRef = useRef<CartItem[]>([]);
  cartRef.current = cart;

  /**
   * Limpa a venda somente se o carrinho não mudou desde `expected`
   * (snapshot do carrinho no momento da finalização).
   * Evita que o timeout pós-venda apague uma nova venda iniciada no intervalo.
   */
  const clearSaleIfUnchanged = useCallback((expected: CartItem[]) => {
    const current = cartRef.current;
    const same =
      current.length === expected.length &&
      current.every(
        (it, idx) => it.id === expected[idx]?.id && it.quantity === expected[idx]?.quantity
      );
    if (same) clearSale();
    return same;
  }, [clearSale]);

  // ── Persistência do rascunho (venda à prova de reload) ──
  // A venda em andamento é salva no navegador a cada mudança e restaurada
  // se a página recarregar (deploy, queda de luz, navegador travando).
  // Escopo = "lojaId:turnoId" informado pelo PdvPage via setCartScope —
  // rascunho de um turno nunca vaza para outro.
  const [cartScope, setCartScopeState] = useState<string | null>(null);
  const hydratedScopeRef = useRef<string | null>(null);

  const setCartScope = useCallback((scope: string | null) => {
    setCartScopeState(scope);
  }, []);

  // Hidrata 1x por escopo, só com o carrinho ainda vazio (nunca sobrescreve
  // uma venda que o operador já começou nesta montagem).
  useEffect(() => {
    if (!cartScope || hydratedScopeRef.current === cartScope) return;
    hydratedScopeRef.current = cartScope;
    try {
      const raw = localStorage.getItem(DRAFT_KEY(cartScope));
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const d = parsed?.data as SaleSnapshot | undefined;
      if (!d || !Array.isArray(d.items) || d.items.length === 0) return;
      if (Date.now() - Number(parsed?.savedAt || 0) > DRAFT_MAX_AGE_MS) {
        localStorage.removeItem(DRAFT_KEY(cartScope));
        return;
      }
      if (cartRef.current.length > 0) return;
      restoreCart({
        items: d.items,
        paymentMethod: d.paymentMethod ?? "",
        tableId: d.tableId ?? "",
        selectedTable: d.selectedTable ?? null,
        selectedTabId: d.selectedTabId ?? null,
        discountType: d.discountType === "%" ? "%" : "R$",
        discountInput: d.discountInput ?? "",
        cashReceived: d.cashReceived ?? "",
        splitMode: !!d.splitMode,
        splitPayments: Array.isArray(d.splitPayments) ? d.splitPayments : [],
      });
    } catch {}
  }, [cartScope, restoreCart]);

  // Salva a cada mudança (após hidratar). Carrinho vazio = apaga o rascunho
  // — é o que limpa o rascunho ao finalizar/cancelar (clearSale zera tudo).
  useEffect(() => {
    if (!cartScope || hydratedScopeRef.current !== cartScope) return;
    try {
      const hasContent =
        cart.length > 0 ||
        !!paymentMethod ||
        !!discountInput ||
        !!cashReceived ||
        splitPayments.length > 0 ||
        !!selectedTabId;
      if (!hasContent) {
        localStorage.removeItem(DRAFT_KEY(cartScope));
        return;
      }
      const data: SaleSnapshot = {
        items: cart,
        paymentMethod,
        tableId,
        selectedTable,
        selectedTabId,
        discountType,
        discountInput,
        cashReceived,
        splitMode,
        splitPayments,
      };
      localStorage.setItem(
        DRAFT_KEY(cartScope),
        JSON.stringify({ v: 1, savedAt: Date.now(), data }),
      );
    } catch {}
  }, [
    cartScope, cart, paymentMethod, tableId, selectedTable, selectedTabId,
    discountType, discountInput, cashReceived, splitMode, splitPayments,
  ]);

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
    restoreCart,
    clearSaleIfUnchanged,
    setCartScope,
  };
}