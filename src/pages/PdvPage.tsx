import { useState, useMemo, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStorePlan } from "@/hooks/useStorePlan";
import { toast } from "sonner";
import { formatBRL, addMoney, sumMoney, subtractMoney } from "@/lib/utils";
import { parseBRL } from "@/hooks/useBRLInput";
import { printPdvReceipt } from "@/lib/thermalPrint";
import {
  ArrowLeft, Search, Plus, Minus, Trash2,
  Banknote, CreditCard, Smartphone, Monitor,
  Loader2, CheckCircle2, X, Tag,
  ArrowDownCircle, ArrowUpCircle, Lock, Unlock,
  Receipt, ChevronDown, ChevronRight, RotateCcw,
  Layers, ShoppingCart, ChevronLeft, Calculator, Wallet,
  History, Printer, BarChart3, Split, EyeOff, Eye, Keyboard,
} from "lucide-react";
import { PdvHistorico, PdvSessionsList } from "@/components/pdv/PdvHistorico";
import ProductDetailModal from "@/components/ProductDetailModal";
import type { CartAddon } from "@/contexts/CartContext";

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
import { PdvCatalogSection } from "@/pages/pdv/components/PdvCatalogSection";
import { PdvCartSection } from "@/pages/pdv/components/PdvCartSection";
import { PdvAberturaScreen } from "@/pages/pdv/components/PdvAberturaScreen";
import { PdvFechamentoScreen } from "@/pages/pdv/components/PdvFechamentoScreen";
import { PdvMovementDialog } from "@/pages/pdv/components/PdvMovementDialog";
import { PdvShortcutsDialog } from "@/pages/pdv/components/PdvShortcutsDialog";
import { PdvTopbar } from "@/pages/pdv/components/PdvTopbar";
import { PdvTabs } from "@/pages/pdv/components/PdvTabs";
import { PdvStatusBar } from "@/pages/pdv/components/PdvStatusBar";
import { PdvSessionCard } from "@/pages/pdv/components/PdvSessionCard";

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
  const [openingAmount, setOpeningAmount] = useState("0");

  // Venda — estado de carrinho/pagamento agora vive em usePdvCart.
  const [search, setSearch] = useState("");
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Hook do carrinho (extraído na Fase 1 da refatoração).
  const {
    cart, setCart,
    paymentMethod, setPaymentMethod,
    tableId, setTableId,
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

  // Ref do input de busca para foco com F2
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Modais
  const [movModal, setMovModal] = useState<"sangria" | "suprimento" | null>(null);
  const [movValue, setMovValue] = useState("");
  const [movDesc, setMovDesc] = useState("");
  const [movReason, setMovReason] = useState("");

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
      return !!data;
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
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
        return data;
      }
      const { data } = await supabase
        .from("stores").select("id, name, category, categories, settings")
        .eq("owner_id", user!.id).eq("status", "ativo").maybeSingle();
      return data;
    },
    enabled: !!user && (isAdmin !== undefined),
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
  const addItem = (p: Product) => openProduct(p);
  const clearSale = () => {
    clearSaleCart();
    if (isMobile) setMobileStep("catalog");
  };

  // ── Abrir caixa (delegado a usePdvSession) ──
  const handleAbrirCaixa = async () => {
    await openSession(parseBRL(openingAmount));
  };

  // ── Finalizar venda (delegado a usePdvCheckout) ──
  const handleVenda = async () => {
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
      onSuccess: () => setOrderDone(true),
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
    if (type === "sangria" && !movReason) {
      toast.error("Selecione o motivo da sangria."); return;
    }
    setLoading(true);
    try {
      const fullDesc = [movReason, movDesc].filter(Boolean).join(" — ") ||
        (type === "sangria" ? "Sangria" : "Suprimento");
      await supabase.from("pdv_movements" as any).insert({
        session_id: currentSession.id, store_id: store.id,
        type, amount, description: fullDesc,
      });
      queryClient.invalidateQueries({ queryKey: ["pdv-movements", currentSession.id] });
      toast.success(type === "sangria" ? `Sangria de ${formatBRL(amount)}` : `Suprimento de ${formatBRL(amount)}`);
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
    const ok = await closeSession({
      countedAmount: parseBRL(closingAmount),
      expectedAmount: saldoEsperado,
      blindClose,
      denominationCounts,
    });
    if (ok) {
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
  const cyclePayment = useCallback(() => {
    const ids = PDV_METHODS.map(m => m.id);
    if (!paymentMethod) { setPaymentMethod(ids[0]); return; }
    const idx = ids.indexOf(paymentMethod);
    setPaymentMethod(ids[(idx + 1) % ids.length]);
  }, [paymentMethod]);

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

  // ─────────────────────────────────────────────────────────────────────────
  // TELA 1 — ABERTURA
  // ─────────────────────────────────────────────────────────────────────────

  if (screen === "abertura") return (
    <PdvAberturaScreen
      storeName={store?.name}
      openingAmount={openingAmount}
      setOpeningAmount={setOpeningAmount}
      onOpen={handleAbrirCaixa}
      loading={sessionLoading || loading}
    />
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
      />

      <PdvTabs
        tab={tab}
        onChange={(t) => {
          if (t === "relatorios") setSelectedSessionId(null);
          setTab(t);
        }}
      />

      {/* ── HISTÓRICO ── */}
      {tab === "historico" && (
        <div className="flex-1 overflow-y-auto p-3">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Movimentações do turno atual</p>
          <PdvHistorico sessionId={currentSession?.id} />
        </div>
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

      {/* ── VENDA ── */}
      {tab === "venda" && (
        <>
          {/* DESKTOP — 2 colunas lado a lado */}
          {!isMobile && (
            <div className="flex flex-1 overflow-hidden">
              {/* Catálogo */}
              <div className="flex flex-col flex-1 min-w-0 overflow-hidden border-r border-border">
                <PdvCatalogSection
                  search={search} setSearch={setSearch}
                  sections={sections} activeSection={activeSection} setActiveSection={setActiveSection}
                  grouped={grouped} prodLoading={prodLoading}
                  getQty={getQty} addItem={addItem} decItem={decItem}
                  searchInputRef={searchInputRef}
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
                />
                <PdvCartSection
                  cart={cart} tableId={tableId} setTableId={setTableId}
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
                  <div className="flex-1 overflow-hidden flex flex-col">
                    <PdvCatalogSection
                      search={search} setSearch={setSearch}
                      sections={sections} activeSection={activeSection} setActiveSection={setActiveSection}
                      grouped={grouped} prodLoading={prodLoading}
                      getQty={getQty} addItem={addItem} decItem={decItem}
                      searchInputRef={searchInputRef}
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
                      cart={cart} tableId={tableId} setTableId={setTableId}
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
    </div>
  );
};


export default PdvPage;
