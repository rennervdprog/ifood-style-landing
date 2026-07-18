import { useState, useMemo, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStorePlan } from "@/hooks/useStorePlan";
import { useStorePdvAccess, useAddonsFlag } from "@/hooks/useStorePdvAccess";
import PdvUpsellScreen from "@/components/pdv/PdvUpsellScreen";
import { toast } from "sonner";
import { formatBRL, addMoney, sumMoney, subtractMoney } from "@/lib/utils";
import { parseBRL } from "@/hooks/useBRLInput";
import { printPdvReceipt, printMovementReceipt, printZReport } from "@/lib/thermalPrint";
import {
  ArrowLeft, Search, Plus, Minus, Trash2,
  Banknote, CreditCard, Smartphone, Monitor,
  Loader2, CheckCircle2, X, Tag,
  ArrowDownCircle, ArrowUpCircle, Lock, Unlock,
  Receipt, ChevronDown, ChevronRight, RotateCcw,
  Layers, ShoppingCart, ChevronLeft, Calculator, Wallet,
  History, Printer, BarChart3, Split, EyeOff, Eye, Keyboard, BookOpen,
} from "lucide-react";
import { PdvHistorico, PdvSessionsList } from "@/components/pdv/PdvHistorico";
import ProductDetailModal from "@/components/ProductDetailModal";
import type { CartAddon } from "@/contexts/CartContext";
import { fetchProductAddons } from "@/lib/productAddons";
import { hasPizzaCatalog } from "@/types/pizza";

// Builders compartilhados com o app cliente — lazy para não pesar no PDV.
const PizzaHalfHalfModal = lazy(() => import("@/components/PizzaHalfHalfModal"));
const PastelBuilderModal = lazy(() => import("@/components/PastelBuilderModal"));
import { PdvRelatorios } from "@/components/pdv/PdvRelatorios";
import { usePdvShortcuts } from "@/components/pdv/usePdvShortcuts";
import { usePdvBarcodeScanner } from "@/components/pdv/usePdvBarcodeScanner";
import { PdvSplitPayment, type SplitPayment } from "@/components/pdv/PdvSplitPayment";
import { PdvDenominationCount } from "@/components/pdv/PdvDenominationCount";
import PdvDeliveryAlerts from "@/components/pdv/PdvDeliveryAlerts";
import PdvEmptiesCustomerDialog from "@/components/PdvEmptiesCustomerDialog";
import EmptiesReturnDialog from "@/components/EmptiesReturnDialog";

// Refatoração Fase 1: módulos extraídos para src/pages/pdv/
import type {
  Product,
  MenuSection,
  CartItem,
  PdvSession,
  PdvScreen as Screen,
  PdvMobileStep as MobileStep,
  PdvTab as Tab,
} from "@/pages/pdv/types";
import { PDV_METHODS, COLOR_MAP } from "@/pages/pdv/constants";
import { usePdvCatalog } from "@/pages/pdv/state/usePdvCatalog";
import { usePdvSession } from "@/pages/pdv/state/usePdvSession";
import { usePdvCart } from "@/pages/pdv/state/usePdvCart";
import { usePdvCheckout } from "@/pages/pdv/state/usePdvCheckout";
import { usePdvOutbox } from "@/pages/pdv/state/usePdvOutbox";
import { PdvCatalogSection } from "@/pages/pdv/components/PdvCatalogSection";
import { PdvCategoriesRail } from "@/pages/pdv/components/PdvCategoriesRail";
import { PdvCartSection } from "@/pages/pdv/components/PdvCartSection";
import { PdvNowCard } from "@/pages/pdv/components/PdvNowCard";
import { PdvFavoritesBar } from "@/pages/pdv/components/PdvFavoritesBar";
import { PdvAberturaScreen } from "@/pages/pdv/components/PdvAberturaScreen";
import { PdvFechamentoScreen } from "@/pages/pdv/components/PdvFechamentoScreen";
import { usePdvOperator } from "@/hooks/usePdvOperator";
import { PdvOperatorLoginDialog } from "@/components/pdv/PdvOperatorLoginDialog";
import { PdvMovementDialog } from "@/pages/pdv/components/PdvMovementDialog";
import { PdvWeightDialog } from "@/pages/pdv/components/PdvWeightDialog";
import { PdvCreateWeightProductDialog } from "@/pages/pdv/components/PdvCreateWeightProductDialog";
import PdvDeliveryManualDialog from "@/components/pdv/PdvDeliveryManualDialog";
import { PdvShortcutsDialog } from "@/pages/pdv/components/PdvShortcutsDialog";
import { PdvTopbar } from "@/pages/pdv/components/PdvTopbar";
import { PdvTabs } from "@/pages/pdv/components/PdvTabs";
import { PdvStatusBar } from "@/pages/pdv/components/PdvStatusBar";
import { PdvSessionCard } from "@/pages/pdv/components/PdvSessionCard";
import { PdvMesasView } from "@/pages/pdv/components/PdvMesasView";
import StoreSubscription from "@/components/StoreSubscription";

// Detecta se está em tela mobile (< 768px)
const useIsMobile = () => {
  const query = "(max-width: 767px)";
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });
  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    // Forçar leitura imediata para garantir valor correto após mount
    setIsMobile(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return isMobile;
};

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

// (Tipos e constantes movidos para `src/pages/pdv/types.ts` e
//  `src/pages/pdv/constants.ts` na Fase 1 da refatoração do PDV.)

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

const PdvPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  // Quando entra em mobile, voltar sempre para o catálogo
  useEffect(() => {
    if (isMobile) setMobileStep("catalog");
  }, [isMobile]);

  // Mobile: etapas de venda
  const [mobileStep, setMobileStep] = useState<MobileStep>("catalog");

  // Abas da tela de venda
  const [tab, setTab] = useState<Tab>("venda");
  // Turno selecionado para drill-down no relatório (null = geral)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Abre relatório de um turno específico
  const openSessionRelatorio = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setTab("relatorios");
  };

  // Ao voltar para aba turnos, limpar seleção
  const goToTurnos = () => {
    setTab("turnos");
    setSelectedSessionId(null);
  };

  // Abertura
  const [openingAmount, setOpeningAmount] = useState("");
  // Ver relatórios sem abrir o caixa (a partir da tela de abertura)
  const [reportsNoSession, setReportsNoSession] = useState(false);
  const [planNoSession, setPlanNoSession] = useState(false);

  // Venda — estado de carrinho/pagamento agora vive em usePdvCart.
  const [search, setSearch] = useState("");
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Hook do carrinho (extraído na Fase 1 da refatoração).
  const {
    cart, setCart,
    paymentMethod, setPaymentMethod,
    tableId, setTableId,
    selectedTable, setSelectedTable,
    selectedTabId, setSelectedTabId,
    discountType, setDiscountType,
    discountInput, setDiscountInput,
    showDiscount, setShowDiscount,
    cashReceived, setCashReceived,
    orderDone, setOrderDone,
    splitMode, setSplitMode,
    splitPayments, setSplitPayments,
    productModal, setProductModal,
    subtotal, totalItems, discountAmount, finalTotal, cashVal, troco, trocoNegativo,
    getQty,
    openProduct, handleModalAdd, addScannedProduct, decItem, removeItem,
    clearSale: clearSaleCart,
  } = usePdvCart();

  // Fluxo de troca de casquinhas no PDV
  const [emptiesFlow, setEmptiesFlow] = useState<{
    step: "lookup" | "return" | null;
    orderId: string;
    items: { product_id: string; quantity: number }[];
    customerName?: string;
  }>({ step: null, orderId: "", items: [] });

  // Mostrar guia de atalhos
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Modal de venda por peso (produto com sold_by_weight = true)
  const [weightProduct, setWeightProduct] = useState<Product | null>(null);

  // Modal: criar novo produto por peso (exclusivo do PDV)
  const [showCreateWeight, setShowCreateWeight] = useState(false);

  // Modal: pedido delivery manual (lojista cria pedido para cliente que pediu por fora)
  const [showManualDelivery, setShowManualDelivery] = useState(false);

  // Builders Pizza/Pastel (compartilhados com app cliente).
  const [showHalfHalf, setShowHalfHalf] = useState(false);
  const [showPastelBuilder, setShowPastelBuilder] = useState(false);

  // Ref do input de busca para foco com F2
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Modais
  const [movModal, setMovModal] = useState<"sangria" | "suprimento" | null>(null);
  const [movValue, setMovValue] = useState("");
  const [movDesc, setMovDesc] = useState("");
  const [movReason, setMovReason] = useState("");
  // Fase 2 item 8 — alçada de gerente para sangria acima do limite.
  const [managerGateOpen, setManagerGateOpen] = useState(false);
  const pendingSangria = useRef<null | ((mgrId: string) => void)>(null);

  // Fechamento
  const [closingAmount, setClosingAmount] = useState("");
  const [sessionSummary, setSessionSummary] = useState<any>(null);
  // Fechamento cego (não vê esperado até confirmar)
  const [blindClose, setBlindClose] = useState(false);
  const [denominationCounts, setDenominationCounts] = useState<Record<string, number>>({});

  // ── Admin: seletor de loja (super admin opera qualquer loja, ex.: lojas fake) ──
  const { data: isAdmin } = useQuery({
    queryKey: ["pdv-is-admin", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles").select("role")
        .eq("user_id", user!.id).eq("role", "admin").maybeSingle();
      const v = !!data;
      try { localStorage.setItem(`pdv_is_admin_v1:${user!.id}`, v ? "1" : "0"); } catch {}
      return v;
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
    initialData: () => {
      if (!user?.id) return undefined;
      try {
        const raw = localStorage.getItem(`pdv_is_admin_v1:${user.id}`);
        return raw == null ? undefined : raw === "1";
      } catch { return undefined; }
    },
    initialDataUpdatedAt: 0,
  });

  const ADMIN_STORE_KEY = "pdv_admin_selected_store";
  const [adminStoreId, setAdminStoreId] = useState<string | null>(() => {
    try { return localStorage.getItem(ADMIN_STORE_KEY); } catch { return null; }
  });

  // ── Loja ──
  const { data: store, isFetched: storeFetched } = useQuery({
    queryKey: ["pdv-store", user?.id, isAdmin ? adminStoreId : null],
    queryFn: async () => {
      // Super admin com loja escolhida → busca direto por id (qualquer status)
      if (isAdmin && adminStoreId) {
        const { data } = await supabase
          .from("stores").select("id, name, category, categories, settings")
          .eq("id", adminStoreId).maybeSingle();
        try { if (data) localStorage.setItem("pdv_store_v1", JSON.stringify(data)); } catch {}
        return data;
      }
      const { data } = await supabase
        .from("stores").select("id, name, category, categories, settings")
        .eq("owner_id", user!.id).eq("status", "ativo").maybeSingle();
      try { if (data) localStorage.setItem("pdv_store_v1", JSON.stringify(data)); } catch {}
      return data;
    },
    enabled: !!user && (isAdmin !== undefined),
    initialData: () => {
      try {
        const raw = localStorage.getItem("pdv_store_v1");
        return raw ? JSON.parse(raw) : undefined;
      } catch { return undefined; }
    },
    initialDataUpdatedAt: 0,
  });

  // Lista de lojas para o seletor (apenas admin, apenas quando sem loja ativa)
  const { data: adminStores } = useQuery({
    queryKey: ["pdv-admin-stores"],
    queryFn: async () => {
      const { data } = await supabase
        .from("stores").select("id, name, status")
        .order("name", { ascending: true });
      return data || [];
    },
    enabled: !!isAdmin && storeFetched && !store,
    staleTime: 60_000,
  });

  // ── Operador (Fase 4) ──
  const { data: operatorProfile } = useQuery({
    queryKey: ["pdv-operator", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles").select("full_name")
        .eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  });
  const operatorName = (operatorProfile as any)?.full_name || user?.email?.split("@")[0];

  const storePlan = useStorePlan(store?.id);
  const pdvAccess = useStorePdvAccess(store?.id);
  const addonsFlag = useAddonsFlag();
  // Operador logado por PIN (Fase 1) — usado como operator_id nas movimentações.
  const { operator: pdvOperator } = usePdvOperator(store?.id);
  // Limite de sangria sem alçada de gerente (Fase 2 item 8). Default R$ 200.
  const { data: sangriaLimit } = useQuery({
    queryKey: ["pdv-sangria-manager-limit"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("admin_settings")
        .select("value").eq("key", "pdv_sangria_manager_limit").maybeSingle();
      const v = Number((data?.value as any) ?? 200);
      return Number.isFinite(v) && v >= 0 ? v : 200;
    },
  });
  // Bloqueia PDV sempre que a loja NÃO tem acesso (não-legacy, sem add-on, não pdv_only).
  // Sem gate real, qualquer loja abria o caixa mesmo sem contratar.
  const showPdvUpsell =
    !!store?.id && !pdvAccess.isLoading && !pdvAccess.enabled;

  // ── Sessão (extraída na Fase 1 da refatoração) ──
  const {
    screen,
    setScreen,
    currentSession,
    setCurrentSession,
    openSession,
    closeSession,
    loading: sessionLoading,
  } = usePdvSession({ storeId: store?.id, userId: user?.id });

  // Hook de finalização de venda.
  const { handleVenda: runCheckout, checkoutLoading } = usePdvCheckout();
  const {
    count: outboxCount,
    flushing: outboxFlushing,
    flushNow: flushOutbox,
  } = usePdvOutbox(store?.id);

  // ── Catálogo (extraído na Fase 1 da refatoração) ──
  const {
    sections,
    products,
    prodLoading,
    sectionMap,
    filtered,
    grouped,
  } = usePdvCatalog({
    storeId: store?.id,
    search,
    activeSection,
  });

  // ── Movimentações ──
  const { data: movements = [] } = useQuery({
    queryKey: ["pdv-movements", currentSession?.id],
    queryFn: async () => {
      const { data } = await supabase.from("pdv_movements" as any)
        .select("*").eq("session_id", currentSession!.id)
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
    enabled: !!currentSession?.id,
    refetchInterval: 30_000,
  });

  // Cart, derivados e ações foram extraídos para `usePdvCart`.
  // Mantemos só o wrapper `clearSale` para que ele também resete o passo mobile.
  // No PDV, produtos simples (sem addons/tamanhos/pizza) devem ir direto ao
  // carrinho — o modal só aparece quando há real necessidade de customização.
  // Isso mantém o fluxo rápido de balcão (1 clique = 1 item).
  const addItem = async (p: Product) => {
    if (p.sold_by_weight) {
      setWeightProduct(p);
      return;
    }
    const meta: any = (p as any).metadata || {};
    const hasSizes = Array.isArray(meta.sizes) && meta.sizes.length > 0;
    const hasPizza = hasPizzaCatalog(meta);
    const hasPastel = !!meta.pastel_builder || meta.builder_type === "pastel";
    if (hasSizes || hasPizza || hasPastel) {
      openProduct(p);
      return;
    }
    try {
      const { groups } = await fetchProductAddons(p.id);
      if (groups && groups.length > 0) {
        openProduct(p);
      } else {
        addScannedProduct(p);
      }
    } catch {
      // Em caso de falha ao checar addons, abre o modal (comportamento antigo, seguro).
      openProduct(p);
    }
  };
  const clearSale = () => {
    clearSaleCart();
    if (isMobile) setMobileStep("catalog");
  };

  // ── Enviar itens do carrinho para a comanda selecionada (Mesa/Comanda) ──
  const handleSendToTab = async () => {
    if (!selectedTabId || cart.length === 0) return;
    setLoading(true);
    try {
      const { rpcAddTabItem } = await import("@/pages/pdv/state/usePdvTables");
      for (const item of cart) {
        await rpcAddTabItem({
          tabId: selectedTabId,
          productId: item.id,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.price,
          addons: item.addons ?? null,
          observations: item.observations ?? null,
          metadata: item.metadata ?? null,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["pdv-tabs-open", store?.id] });
      queryClient.invalidateQueries({ queryKey: ["pdv-tab-items", selectedTabId] });
      toast.success(`${cart.length} ${cart.length === 1 ? "item enviado" : "itens enviados"} à comanda`);
      // Mantém a comanda selecionada para próximos envios; limpa só os itens.
      setCart([]);
      setPaymentMethod("");
      setCashReceived("");
      setSplitMode(false);
      setSplitPayments([]);
      if (isMobile) setMobileStep("catalog");
    } catch (e: any) {
      toast.error(`Falha ao enviar: ${e?.message ?? "erro"}`);
    } finally {
      setLoading(false);
    }
  };

  // ── Cobrar e fechar comanda selecionada ──
  const handleCloseTab = async () => {
    if (!selectedTabId || !currentSession?.id) return;
    // Se ainda há itens no carrinho, envia-os primeiro para a comanda.
    if (cart.length > 0) {
      await handleSendToTab();
    }
    const payments = splitMode && splitPayments.length > 0
      ? splitPayments.map((p) => ({ method: p.method, amount: Number(p.amount) }))
      : (paymentMethod ? [{ method: paymentMethod, amount: finalTotal }] : []);
    if (payments.length === 0) {
      toast.error("Escolha o método de pagamento para fechar a comanda.");
      return;
    }
    setLoading(true);
    try {
      const { rpcCloseTab } = await import("@/pages/pdv/state/usePdvTables");
      await rpcCloseTab({
        tabId: selectedTabId,
        sessionId: currentSession.id,
        payments,
        pdvDiscount: discountAmount,
        commissionRate: storePlan.pdvCommissionRate ?? 0,
      });
      queryClient.invalidateQueries({ queryKey: ["pdv-tabs-open", store?.id] });
      queryClient.invalidateQueries({ queryKey: ["pdv-tables", store?.id] });
      queryClient.invalidateQueries({ queryKey: ["pdv-now", currentSession?.id] });
      toast.success("Comanda fechada!");
      setOrderDone(true);
      clearSale();
    } catch (e: any) {
      toast.error(`Falha ao fechar comanda: ${e?.message ?? "erro"}`);
    } finally {
      setLoading(false);
    }
  };

  // ── Abrir caixa (delegado a usePdvSession) ──
  const handleAbrirCaixa = async () => {
    await openSession(parseBRL(openingAmount));
  };

  // ── Finalizar venda (delegado a usePdvCheckout) ──
  const handleVenda = async () => {
    // Se há comanda ativa: fecha a comanda em vez de criar venda avulsa.
    if (selectedTabId) {
      await handleCloseTab();
      return;
    }
    await runCheckout({
      store: store ?? null,
      session: currentSession,
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
      pdvCommissionRate: storePlan.pdvCommissionRate ?? 0,
      operatorId: pdvOperator?.id ?? null,
    onSuccess: () => {
      setOrderDone(true);
      // Refresca o dashboard "Agora" após cada venda concluída.
      queryClient.invalidateQueries({ queryKey: ["pdv-now", currentSession?.id] });
    },
      onClearScheduled: clearSale,
      onEmptiesFlowStart: ({ orderId, items }) =>
        setEmptiesFlow({ step: "lookup", orderId, items }),
    });
  };

  // ── Movimentação ──
  const handleMoviment = async (type: "sangria" | "suprimento") => {
    if (!currentSession || !store?.id) return;
    const amount = parseBRL(movValue);
    if (amount <= 0) { toast.error("Valor inválido."); return; }
    if (!movReason) {
      toast.error(`Selecione o motivo do ${type === "sangria" ? "sangria" : "suprimento"}.`); return;
    }

    // Fase 2 item 8 — sangria acima do limite exige PIN de um gerente.
    const limit = Number(sangriaLimit ?? 200);
    if (type === "sangria" && limit > 0 && amount > limit) {
      pendingSangria.current = (managerId: string) => {
        void doInsertMovement(type, amount, managerId);
      };
      setManagerGateOpen(true);
      return;
    }

    await doInsertMovement(type, amount, null);
  };

  const doInsertMovement = async (
    type: "sangria" | "suprimento",
    amount: number,
    authorizedByManagerId: string | null,
  ) => {
    if (!currentSession || !store?.id) return;
    setLoading(true);
    try {
      const fullDesc = [movReason, movDesc].filter(Boolean).join(" — ") ||
        (type === "sangria" ? "Sangria" : "Suprimento");
      await supabase.from("pdv_movements" as any).insert({
        session_id: currentSession.id, store_id: store.id,
        type, amount, description: fullDesc,
        reason_category: movReason || null,
        operator_id: pdvOperator?.id ?? null,
        authorized_by_operator_id: authorizedByManagerId,
      });
      queryClient.invalidateQueries({ queryKey: ["pdv-movements", currentSession.id] });
      toast.success(type === "sangria" ? `Sangria de ${formatBRL(amount)}` : `Suprimento de ${formatBRL(amount)}`);
      // Comprovante impresso — auditoria física ao lado do caixa.
      try {
        const settingsObj = (store as any)?.settings || {};
        printMovementReceipt(
          {
            type,
            amount,
            reason: movReason,
            description: movDesc,
            operator: pdvOperator?.name || user?.email || null,
            sessionOpenedAt: currentSession.opened_at,
          },
          store?.name || "Loja",
          {
            paperWidth: settingsObj.print_paper_width === 58 ? 58 : 80,
            storePhone: (store as any)?.phone || null,
            storeCnpj: (store as any)?.cnpj || null,
          },
        );
      } catch (e) { console.warn("print movement receipt", e); }
      setMovModal(null); setMovValue(""); setMovDesc(""); setMovReason("");
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  // ── Iniciar fechamento ──
  const handleIniciarFechamento = async () => {
    if (!currentSession) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_pdv_session_summary" as any, { _session_id: currentSession.id });
      if (error) throw error;
      setSessionSummary(data);
      setScreen("fechamento");
    } catch { toast.error("Erro ao carregar resumo."); }
    finally { setLoading(false); }
  };

  // ── Fechar caixa (delegado a usePdvSession) ──
  const handleFecharCaixa = async () => {
    if (!currentSession) return;
    // Snapshot dos dados ANTES de fechar (a sessão some do estado após ok).
    const snapshot = {
      sessionId: currentSession.id,
      openedAt: currentSession.opened_at,
      openingAmount: Number(currentSession.opening_amount) || 0,
      totalSales: Number(sessionSummary?.total_sales ?? turnoVendido) || 0,
      totalOrders: Number(sessionSummary?.total_orders ?? turnoVendasCount) || 0,
      byPayment: (sessionSummary?.by_payment as Record<string, number>) || {},
      sangrias: turnoSangrias,
      suprimentos: turnoSuprimentos,
      expectedCash: saldoEsperado,
      countedCash: parseBRL(closingAmount),
      blindClose,
    };
    const ok = await closeSession({
      countedAmount: parseBRL(closingAmount),
      expectedAmount: saldoEsperado,
      blindClose,
      denominationCounts,
    });
    if (ok) {
      // Relatório Z — cupom padrão do mercado. Best-effort (não bloqueia).
      try {
        const settingsObj = (store as any)?.settings || {};
        const paymentLabels = Object.fromEntries(
          PDV_METHODS.map((m: any) => [m.id, m.label]),
        );
        const ticketMedio = snapshot.totalOrders > 0
          ? snapshot.totalSales / snapshot.totalOrders
          : 0;
        printZReport(
          {
            sessionId: snapshot.sessionId,
            openedAt: snapshot.openedAt,
            closedAt: new Date().toISOString(),
            operator: user?.email || null,
            openingAmount: snapshot.openingAmount,
            totalSales: snapshot.totalSales,
            totalOrders: snapshot.totalOrders,
            ticketMedio,
            byPayment: snapshot.byPayment,
            paymentLabels,
            sangrias: snapshot.sangrias,
            suprimentos: snapshot.suprimentos,
            expectedCash: snapshot.expectedCash,
            countedCash: snapshot.countedCash,
            difference: snapshot.countedCash - snapshot.expectedCash,
            blindClose: snapshot.blindClose,
          },
          store?.name || "Loja",
          {
            paperWidth: settingsObj.print_paper_width === 58 ? 58 : 80,
            storePhone: (store as any)?.phone || null,
            storeCnpj: (store as any)?.cnpj || null,
          },
        );
      } catch (e) { console.warn("print Z report", e); }
      setSessionSummary(null);
      clearSale();
      setBlindClose(false);
      setDenominationCounts({});
      setClosingAmount("");
    }
  };

  // ── Totais do turno ──
  const turnoVendido = sumMoney(movements.filter(m => m.type === "sale").map(m => m.amount));
  const turnoDinheiro = sumMoney(movements.filter(m => m.type === "sale" && m.payment_method === "dinheiro").map(m => m.amount));
  const turnoSangrias = sumMoney(movements.filter(m => m.type === "sangria").map(m => m.amount));
  const turnoSuprimentos = sumMoney(movements.filter(m => m.type === "suprimento").map(m => m.amount));
  const saldoEsperado = addMoney((currentSession?.opening_amount ?? 0), turnoDinheiro, turnoSuprimentos, -turnoSangrias);

  // ── Ticket médio do turno ──
  const turnoVendasCount = movements.filter(m => m.type === "sale").length;
  const ticketMedio = turnoVendasCount > 0 ? turnoVendido / turnoVendasCount : 0;

  // ── Atalhos de teclado (PDV profissional) ──
  // Bug P0 corrigido: usa functional updater para não depender de `paymentMethod`
  // no closure — antes o F4 podia ciclar a partir de um valor stale.
  const cyclePayment = useCallback(() => {
    const ids = PDV_METHODS.map(m => m.id);
    setPaymentMethod((prev: string) => {
      if (!prev) return ids[0];
      const idx = ids.indexOf(prev);
      return ids[(idx + 1) % ids.length];
    });
  }, [setPaymentMethod]);

  usePdvShortcuts({
    enabled: screen === "venda" && tab === "venda",
    onSearchFocus: () => searchInputRef.current?.focus(),
    onToggleDiscount: () => setShowDiscount(v => !v),
    onCyclePayment: cyclePayment,
    onFinalize: () => {
      if (cart.length > 0 && !loading && !orderDone) handleVenda();
    },
    onClearSale: () => {
      if (cart.length > 0) {
        if (window.confirm("Limpar venda atual?")) clearSale();
      }
    },
    onHelp: () => setShowShortcuts(true),
    onSangria: () => setMovModal("sangria"),
    onSuprimento: () => setMovModal("suprimento"),
    onCloseSession: () => { if (!loading) handleIniciarFechamento(); },
  });

  // ── Leitor de código de barras (USB HID) ──
  // Busca produto por nome (substring) — fácil de evoluir pra coluna SKU/barcode no futuro
  const handleBarcodeScan = useCallback((code: string) => {
    const found = products.find(p =>
      p.name.toLowerCase().includes(code.toLowerCase()) ||
      p.id.startsWith(code)
    );
    if (found) {
      // Adiciona direto ao carrinho (sem abrir modal de adicionais)
      addScannedProduct(found);
      toast.success(`+ ${found.name}`, { duration: 1200 });
    } else {
      toast.warning(`Código não encontrado: ${code}`);
    }
  }, [products, addScannedProduct]);

  usePdvBarcodeScanner(handleBarcodeScan, screen === "venda" && tab === "venda");

  // ─────────────────────────────────────────────────────────────────────────
  // LOADING
  // ─────────────────────────────────────────────────────────────────────────

  if (screen === "loading") return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      {storeFetched && !store ? (
        isAdmin ? (
          <div className="max-w-sm w-full px-6 py-8">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Layers className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-lg font-black text-foreground mb-1 text-center">Escolher loja</h1>
            <p className="text-xs text-muted-foreground mb-5 text-center">
              Modo super admin — selecione qual loja operar no PDV.
            </p>
            <div className="max-h-[60vh] overflow-y-auto space-y-2">
              {(adminStores || []).map((s: any) => (
                <button
                  key={s.id}
                  onClick={() => {
                    try { localStorage.setItem(ADMIN_STORE_KEY, s.id); } catch {}
                    setAdminStoreId(s.id);
                    queryClient.invalidateQueries({ queryKey: ["pdv-store"] });
                  }}
                  className="w-full text-left bg-card border border-border rounded-xl px-4 py-3 hover:border-primary transition-colors"
                >
                  <div className="font-bold text-sm text-foreground truncate">{s.name}</div>
                  <div className="text-[11px] text-muted-foreground">{s.status}</div>
                </button>
              ))}
              {adminStores && adminStores.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhuma loja cadastrada.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="max-w-sm text-center px-6 py-10">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-500/10 flex items-center justify-center">
              <Lock className="h-8 w-8 text-amber-500" />
            </div>
            <h1 className="text-lg font-black text-foreground mb-1">PDV indisponível</h1>
            <p className="text-sm text-muted-foreground mb-5">
              Nenhuma loja ativa vinculada a este usuário. Faça login com a conta do lojista
              ou entre em contato com o administrador.
            </p>
            <button
              onClick={() => navigate("/admin")}
              className="bg-primary text-primary-foreground font-bold px-5 py-2.5 rounded-xl text-sm"
            >
              Voltar ao painel
            </button>
          </div>
        )
      ) : (
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      )}
    </div>
  );

  if (showPdvUpsell) {
    return (
      <PdvUpsellScreen
        storeId={store!.id}
        monthlyPrice={pdvAccess.monthlyPrice}
        onBack={() => navigate("/admin")}
      />
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TELA 1 — ABERTURA
  // ─────────────────────────────────────────────────────────────────────────

  if (screen === "abertura") return (
    reportsNoSession && store?.id ? (
      <div className="pdv-shell min-h-screen bg-background flex flex-col">
        <header className="h-14 border-b border-border flex items-center px-4 gap-3 bg-card shrink-0">
          <button onClick={() => setReportsNoSession(false)} className="p-1.5 rounded-xl hover:bg-muted transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <BarChart3 className="h-5 w-5 text-primary" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{store?.name}</p>
            <p className="text-[10px] text-muted-foreground">Relatórios · Caixa fechado</p>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">
          <PdvRelatorios storeId={store.id} />
        </div>
      </div>
    ) : (
      <PdvAberturaScreen
        storeName={store?.name}
        storeId={store?.id}
        openingAmount={openingAmount}
        setOpeningAmount={setOpeningAmount}
        onOpen={handleAbrirCaixa}
        loading={sessionLoading || loading}
        onViewReports={() => setReportsNoSession(true)}
      />
    )
  );

  // ─────────────────────────────────────────────────────────────────────────
  // TELA 3 — FECHAMENTO
  // ─────────────────────────────────────────────────────────────────────────

  if (screen === "fechamento") return (
    <PdvFechamentoScreen
      currentSession={currentSession}
      sessionSummary={sessionSummary}
      closingAmount={closingAmount}
      setClosingAmount={setClosingAmount}
      saldoEsperado={saldoEsperado}
      turnoSangrias={turnoSangrias}
      turnoSuprimentos={turnoSuprimentos}
      blindClose={blindClose}
      setBlindClose={setBlindClose}
      setDenominationCounts={setDenominationCounts}
      onBack={() => setScreen("venda")}
      onConfirm={handleFecharCaixa}
      loading={sessionLoading || loading}
    />
  );

  // ─────────────────────────────────────────────────────────────────────────
  // TELA 2 — VENDA (layout PDV profissional)
  // ─────────────────────────────────────────────────────────────────────────

  const selectedMethod = PDV_METHODS.find(m => m.id === paymentMethod);

  // ── Builders Pizza/Pastel: detecta categoria + settings da loja ──
  const storeSettings = ((store as any)?.settings || {}) as Record<string, any>;
  // Fase 3 — flags de hardware (opt-in por loja).
  const drawerEnabled = storeSettings.pdv_drawer_enabled === true;
  // Set inline (não pode ser useEffect aqui pois este ponto fica após early-returns).
  if (typeof window !== "undefined") {
    (window as any).__pdvScaleEnabled = storeSettings.pdv_scale_enabled === true;
  }
  const storeCats: string[] = [
    (store as any)?.category,
    ...(((store as any)?.categories || []) as string[]),
  ].filter(Boolean);
  const isPizzaria = (store as any)?.category === "pizzas";
  const isPastelaria = storeCats.includes("pasteis");
  const pizzaHalfEnabled = isPizzaria && !!storeSettings.pizza_half_enabled && products.length >= 2;
  const pastelHalfEnabled =
    isPastelaria && storeSettings.pastel_half_enabled !== false && products.length >= 2;

  const builderActions = (
    <div className="px-3 pt-2.5 flex flex-col gap-1.5">
      {pizzaHalfEnabled && (
        <button
          type="button"
          onClick={() => setShowHalfHalf(true)}
          className="w-full bg-gradient-to-r from-primary/15 to-primary/5 border border-primary/30 rounded-xl px-3 py-2 flex items-center gap-2 text-left active:scale-[0.98] transition-all"
        >
          <span className="text-lg">🍕</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-foreground leading-tight">Monte a Pizza</p>
            <p className="text-[10px] text-muted-foreground leading-tight">Meio a meio · bordas</p>
          </div>
          <ChevronRight className="h-4 w-4 text-primary shrink-0" />
        </button>
      )}
      {pastelHalfEnabled && (
        <button
          type="button"
          onClick={() => setShowPastelBuilder(true)}
          className="w-full bg-gradient-to-r from-primary/15 to-primary/5 border border-primary/30 rounded-xl px-3 py-2 flex items-center gap-2 text-left active:scale-[0.98] transition-all"
        >
          <span className="text-lg">🥟</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-foreground leading-tight">Monte o Pastel</p>
            <p className="text-[10px] text-muted-foreground leading-tight">Sabores · adicionais</p>
          </div>
          <ChevronRight className="h-4 w-4 text-primary shrink-0" />
        </button>
      )}
      <button
        type="button"
        onClick={() => setShowCreateWeight(true)}
        className="w-full bg-muted/40 hover:bg-muted/60 border border-dashed border-border rounded-xl px-3 py-2 flex items-center gap-2 text-left active:scale-[0.98] transition-all"
      >
        <span className="text-lg">⚖️</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-foreground leading-tight">Novo produto por peso</p>
          <p className="text-[10px] text-muted-foreground leading-tight">Exclusivo do PDV · não vai pro cardápio</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>
      {pdvAccess.source !== "pdv_only" && (
      <button
        type="button"
        onClick={() => setShowManualDelivery(true)}
        className="w-full bg-gradient-to-r from-success/15 to-success/5 border border-success/30 rounded-xl px-3 py-2 flex items-center gap-2 text-left active:scale-[0.98] transition-all"
      >
        <span className="text-lg">🛵</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-foreground leading-tight">Pedido Delivery Manual</p>
          <p className="text-[10px] text-muted-foreground leading-tight">
            Cliente pediu pelo WhatsApp
          </p>
        </div>
        <ChevronRight className="h-4 w-4 text-success shrink-0" />
      </button>
      )}
    </div>
  );

  return (
    <div className="pdv-shell h-screen bg-background flex flex-col overflow-hidden">

      {store?.id && <PdvDeliveryAlerts storeId={store.id} />}

      <PdvTopbar
        storeName={store?.name}
        operatorName={operatorName}
        turnoVendasCount={turnoVendasCount}
        turnoVendido={turnoVendido}
        ticketMedio={ticketMedio}
        loading={loading}
        onShowShortcuts={() => setShowShortcuts(true)}
        onSuprimento={() => setMovModal("suprimento")}
        onSangria={() => setMovModal("sangria")}
        onFechar={handleIniciarFechamento}
        outboxCount={outboxCount}
        outboxFlushing={outboxFlushing}
        onSyncOutbox={() => flushOutbox(false)}
        isPdvOnly={pdvAccess.source === "pdv_only"}
      />

      <PdvTabs
        tab={tab}
        onChange={(t) => {
          if (t === "relatorios") setSelectedSessionId(null);
          setTab(t);
        }}
        showMeuPlano={pdvAccess.source === "pdv_only"}
      />

      {/* ── HISTÓRICO ── */}
      {tab === "historico" && (
        <div className="flex-1 overflow-y-auto p-3">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Movimentações do turno atual</p>
          <PdvHistorico sessionId={currentSession?.id} />
        </div>
      )}

      {/* ── MESAS / COMANDAS (Fase B) ── */}
      {tab === "mesas" && store?.id && (
        <PdvMesasView
          storeId={store.id}
          session={currentSession ?? null}
          products={products as any}
        />
      )}

      {/* ── TURNOS ANTERIORES ── */}
      {tab === "turnos" && (
        <div className="flex-1 overflow-y-auto p-3">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Turnos anteriores</p>
          {store?.id && (
            <PdvSessionsList
              storeId={store.id}
              onViewRelatorio={openSessionRelatorio}
            />
          )}
        </div>
      )}

      {tab === "relatorios" && (
        <div className="flex-1 overflow-y-auto flex flex-col">
          {/* Breadcrumb quando vindo de um turno específico */}
          {selectedSessionId && (
            <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border-b border-primary/10 shrink-0">
              <button
                onClick={goToTurnos}
                className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Voltar aos turnos
              </button>
              <span className="text-[10px] text-muted-foreground">·</span>
              <span className="text-[10px] text-muted-foreground font-semibold">Relatório deste turno</span>
            </div>
          )}
          {store?.id && (
            <PdvRelatorios
              storeId={store.id}
              sessionId={selectedSessionId || undefined}
            />
          )}
        </div>
      )}

      {/* ── MEU PLANO (PDV Only) ── */}
      {tab === "meu_plano" && store?.id && (
        <div className="flex-1 overflow-y-auto">
          <StoreSubscription storeId={store.id} storeName={store.name || ""} />
        </div>
      )}

      {/* ── VENDA ── */}
      {tab === "venda" && (
        <>
          {/* DESKTOP — 2 colunas lado a lado */}
          {!isMobile && (
            <div className="flex flex-1 overflow-hidden">
              {/* Sidebar de categorias (3ª coluna à esquerda) */}
              <PdvCategoriesRail
                sections={sections}
                activeSection={activeSection}
                setActiveSection={setActiveSection}
              />
              {/* Catálogo */}
              <div className="flex flex-col flex-1 min-w-0 overflow-hidden border-r border-border">
                <PdvNowCard
                  sessionId={currentSession?.id}
                  vendasTotal={turnoVendido}
                  vendasCount={turnoVendasCount}
                  ticketMedio={ticketMedio}
                />
                <PdvCatalogSection
                  search={search} setSearch={setSearch}
                  sections={sections} activeSection={activeSection} setActiveSection={setActiveSection}
                  grouped={grouped} prodLoading={prodLoading}
                  getQty={getQty} addItem={addItem} decItem={decItem}
                  searchInputRef={searchInputRef}
                  hideSectionTabs
                  allProducts={products}
                  topSlot={
                    <>
                      <PdvFavoritesBar
                        storeId={store?.id}
                        products={products}
                        addItem={addItem}
                        getQty={getQty}
                      />
                      {builderActions}
                    </>
                  }
                />
              </div>
              {/* Caixa */}
              <aside className="w-72 lg:w-80 xl:w-96 flex flex-col bg-card shrink-0 overflow-hidden">
                <PdvSessionCard
                  openingAmount={currentSession?.opening_amount ?? 0}
                  vendasTotal={turnoVendido}
                  vendasCount={turnoVendasCount}
                  dinheiro={turnoDinheiro}
                  sangrias={turnoSangrias}
                  suprimentos={turnoSuprimentos}
                  saldoEsperado={saldoEsperado}
                  drawerEnabled={drawerEnabled}
                />
                <PdvCartSection
                  cart={cart} storeId={store?.id}
                  tableId={tableId} setTableId={setTableId}
                  selectedTable={selectedTable} setSelectedTable={setSelectedTable}
                  selectedTabId={selectedTabId} setSelectedTabId={setSelectedTabId}
                  onSendToTab={handleSendToTab}
                  totalItems={totalItems} clearSale={clearSale}
                  subtotal={subtotal} discountAmount={discountAmount} finalTotal={finalTotal}
                  showDiscount={showDiscount} setShowDiscount={setShowDiscount}
                  discountType={discountType} setDiscountType={setDiscountType}
                  discountInput={discountInput} setDiscountInput={setDiscountInput}
                  paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod}
                  setCashReceived={setCashReceived} cashReceived={cashReceived}
                  troco={troco} trocoNegativo={trocoNegativo} finalTotal_={finalTotal}
                  removeItem={removeItem} onFinalize={handleVenda}
                  loading={loading || checkoutLoading} orderDone={orderDone}
                  splitMode={splitMode} setSplitMode={setSplitMode}
                  splitPayments={splitPayments} setSplitPayments={setSplitPayments}
                />
              </aside>
            </div>
          )}

          {/* MOBILE — etapas */}
          {isMobile && (
            <div className="flex flex-1 flex-col overflow-hidden">
              {/* Etapa: catálogo */}
              {mobileStep === "catalog" && (
                <>
                  <PdvNowCard
                    sessionId={currentSession?.id}
                    vendasTotal={turnoVendido}
                    vendasCount={turnoVendasCount}
                    ticketMedio={ticketMedio}
                  />
                  <div className="flex-1 overflow-hidden flex flex-col">
                    <PdvCatalogSection
                      search={search} setSearch={setSearch}
                      sections={sections} activeSection={activeSection} setActiveSection={setActiveSection}
                      grouped={grouped} prodLoading={prodLoading}
                      getQty={getQty} addItem={addItem} decItem={decItem}
                      searchInputRef={searchInputRef}
                      allProducts={products}
                      topSlot={
                        <>
                          <PdvFavoritesBar
                            storeId={store?.id}
                            products={products}
                            addItem={addItem}
                            getQty={getQty}
                          />
                          {builderActions}
                        </>
                      }
                    />
                  </div>
                  {/* Bottom bar — ir ao carrinho */}
                  {cart.length > 0 && (
                    <div className="border-t border-border bg-card px-3 py-2.5 shrink-0">
                      <button
                        onClick={() => setMobileStep("cart")}
                        className="w-full h-12 bg-primary text-primary-foreground font-black text-sm rounded-2xl flex items-center justify-between px-4 active:scale-[0.98] transition-all shadow-lg shadow-primary/25"
                      >
                        <span className="flex items-center gap-2">
                          <span className="bg-white/20 rounded-lg w-7 h-7 flex items-center justify-center text-xs font-black">{totalItems}</span>
                          Ver carrinho
                        </span>
                        <span className="flex items-center gap-1">{formatBRL(subtotal)} <ChevronRight className="h-4 w-4" /></span>
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Etapa: carrinho + pagamento */}
              {mobileStep === "cart" && (
                <>
                  {/* Total fixo no topo (PDV de mão — Fase 5) */}
                  <div className="border-b border-border bg-primary/5 px-3 py-2 flex items-center justify-between shrink-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Total · {totalItems} {totalItems === 1 ? "item" : "itens"}
                    </span>
                    <span className="text-xl font-black text-primary pdv-mono">{formatBRL(finalTotal)}</span>
                  </div>
                  <div className="flex-1 overflow-hidden flex flex-col">
                    <PdvCartSection
                      cart={cart} storeId={store?.id}
                      tableId={tableId} setTableId={setTableId}
                      selectedTable={selectedTable} setSelectedTable={setSelectedTable}
                      selectedTabId={selectedTabId} setSelectedTabId={setSelectedTabId}
                      onSendToTab={handleSendToTab}
                      totalItems={totalItems} clearSale={clearSale}
                      subtotal={subtotal} discountAmount={discountAmount} finalTotal={finalTotal}
                      showDiscount={showDiscount} setShowDiscount={setShowDiscount}
                      discountType={discountType} setDiscountType={setDiscountType}
                      discountInput={discountInput} setDiscountInput={setDiscountInput}
                      paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod}
                      setCashReceived={setCashReceived} cashReceived={cashReceived}
                      troco={troco} trocoNegativo={trocoNegativo} finalTotal_={finalTotal}
                      removeItem={removeItem} onFinalize={handleVenda}
                      loading={loading || checkoutLoading} orderDone={orderDone}
                      splitMode={splitMode} setSplitMode={setSplitMode}
                      splitPayments={splitPayments} setSplitPayments={setSplitPayments}
                    />
                  </div>
                  {/* Barra de voltar ao catálogo */}
                  <div className="border-t border-border bg-card px-3 py-2 flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setMobileStep("catalog")}
                      className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold bg-muted/60 hover:bg-muted text-foreground transition-colors"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" /> Adicionar mais
                    </button>
                    <p className="text-[10px] text-muted-foreground ml-auto">{totalItems} itens · {formatBRL(subtotal)}</p>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* ── MODAL DE PRODUTO (adicionais, bordas, observações) ── */}
      <ProductDetailModal
        product={productModal}
        storeName={store?.name || ""}
        open={!!productModal}
        onClose={() => setProductModal(null)}
        onAdd={handleModalAdd}
      />

      {/* ── MODAL VENDA POR PESO ── */}
      <PdvWeightDialog
        product={weightProduct}
        open={!!weightProduct}
        onClose={() => setWeightProduct(null)}
        onAdd={handleModalAdd}
      />

      {/* ── MODAL CRIAR PRODUTO POR PESO (PDV-only) ── */}
      {store?.id && (
        <PdvCreateWeightProductDialog
          open={showCreateWeight}
          onClose={() => setShowCreateWeight(false)}
          storeId={store.id}
          onCreated={() => queryClient.invalidateQueries({ queryKey: ["pdv-products", store.id] })}
        />
      )}

      {/* ── MODAL PEDIDO DELIVERY MANUAL ── */}
      {store?.id && (
        <PdvDeliveryManualDialog
          open={showManualDelivery}
          onClose={() => setShowManualDelivery(false)}
          storeId={store.id}
          storeName={store?.name}
          storeSettings={(store as any)?.settings || null}
          cart={cart}
          subtotal={subtotal}
          discountAmount={discountAmount}
          onSuccess={() => { clearSaleCart(); }}
        />
      )}

      {/* ── MONTE A PIZZA (meio a meio + bordas) ── */}
      {pizzaHalfEnabled && showHalfHalf && store?.id && (
        <Suspense fallback={null}>
          <PizzaHalfHalfModal
            open={showHalfHalf}
            onClose={() => setShowHalfHalf(false)}
            storeName={store?.name || ""}
            storeId={store.id}
            products={products as any}
            sections={sections}
            priceMode={storeSettings.pizza_price_mode || "maior"}
            maxFlavors={(storeSettings.pizza_config?.max_flavors as 2 | 3 | 4) || 4}
            singleSize={!!storeSettings.pizza_single_size}
            onAdd={handleModalAdd}
          />
        </Suspense>
      )}

      {/* ── MONTE O PASTEL ── */}
      {pastelHalfEnabled && showPastelBuilder && store?.id && (
        <Suspense fallback={null}>
          <PastelBuilderModal
            open={showPastelBuilder}
            onClose={() => setShowPastelBuilder(false)}
            storeName={store?.name || ""}
            storeId={store.id}
            products={products as any}
            sections={sections}
            priceMode={storeSettings.pastel_price_mode || "maior"}
            maxFlavors={(storeSettings.pastel_config?.max_flavors as 2 | 3 | 4) || 4}
            maxComplements={Number(storeSettings.pastel_config?.max_complements) || 3}
            singleSize={!!storeSettings.pastel_single_size}
            onAdd={handleModalAdd}
          />
        </Suspense>
      )}

      {/* ── BARRA DE ATALHOS (rodapé estilo keycap, só desktop) ── */}
      {screen === "venda" && tab === "venda" && <PdvStatusBar />}

      {/* ── MODAL SANGRIA / SUPRIMENTO ── */}
      {movModal && (
        <PdvMovementDialog
          type={movModal}
          movValue={movValue} setMovValue={setMovValue}
          movDesc={movDesc} setMovDesc={setMovDesc}
          movReason={movReason} setMovReason={setMovReason}
          loading={loading}
          onCancel={() => { setMovModal(null); setMovValue(""); setMovDesc(""); setMovReason(""); }}
          onConfirm={() => handleMoviment(movModal)}
        />
      )}

      {/* Fase 2 item 8 — autorização de gerente para sangria acima do limite. */}
      {managerGateOpen && store?.id && (
        <PdvOperatorLoginDialog
          open
          storeId={store.id}
          requiredRole="gerente"
          title="Autorização de gerente"
          onClose={() => { setManagerGateOpen(false); pendingSangria.current = null; }}
          onLogin={(mgr) => {
            setManagerGateOpen(false);
            const fn = pendingSangria.current;
            pendingSangria.current = null;
            if (fn) fn(mgr.id);
          }}
        />
      )}

      {/* ── MODAL ATALHOS DE TECLADO ── */}
      {showShortcuts && <PdvShortcutsDialog onClose={() => setShowShortcuts(false)} />}

      {/* Fluxo de troca de casquinhas no PDV */}
      {emptiesFlow.step === "lookup" && (
        <PdvEmptiesCustomerDialog
          open
          orderId={emptiesFlow.orderId}
          onClose={() => setEmptiesFlow({ step: null, orderId: "", items: [] })}
          onFound={(_id, name) => setEmptiesFlow((p) => ({ ...p, step: "return", customerName: name }))}
        />
      )}
      {emptiesFlow.step === "return" && store?.id && (
        <EmptiesReturnDialog
          open
          orderId={emptiesFlow.orderId}
          storeId={store.id}
          items={emptiesFlow.items}
          onClose={() => setEmptiesFlow({ step: null, orderId: "", items: [] })}
        />
      )}

      {/* FAB — gerenciar cardápio (principalmente pra lojas pdv_only, que não têm painel) */}
      <button
        type="button"
        onClick={() => navigate("/admin/cardapio")}
        title="Gerenciar cardápio"
        aria-label="Gerenciar cardápio"
        className="fixed bottom-4 right-4 z-40 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center border-2 border-background"
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
};


export default PdvPage;
