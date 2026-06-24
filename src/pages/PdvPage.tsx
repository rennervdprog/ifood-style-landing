import { useState, useMemo, useEffect, useCallback, useRef } from "react";
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

  // ── Loja ──
  const { data: store } = useQuery({
    queryKey: ["pdv-store", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("stores").select("id, name")
        .eq("owner_id", user!.id).eq("status", "ativo").maybeSingle();
      return data;
    },
    enabled: !!user,
  });

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
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
    <div className="h-screen bg-background flex flex-col overflow-hidden">

      {store?.id && <PdvDeliveryAlerts storeId={store.id} />}

      {/* ── TOPBAR ── */}
      <header className="h-12 border-b border-border bg-card flex items-center px-3 gap-2 shrink-0">
        <button onClick={() => navigate("/admin")} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="w-px h-5 bg-border" />
        <Monitor className="h-4 w-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-xs font-bold text-foreground truncate">{store?.name}</span>
          <span className="text-[10px] text-emerald-500 font-semibold ml-2 hidden sm:inline">
            ● {turnoVendasCount} vendas · {formatBRL(turnoVendido)}
            {ticketMedio > 0 && <span className="text-muted-foreground ml-1.5">· tkt {formatBRL(ticketMedio)}</span>}
          </span>
        </div>

        {/* Controles do turno */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowShortcuts(true)}
            title="Atalhos de teclado"
            className="hidden md:flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-muted-foreground bg-muted/50 hover:bg-muted transition-colors border border-border"
          >
            <Keyboard className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setMovModal("suprimento")}
            title="Suprimento"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-blue-600 bg-blue-500/8 hover:bg-blue-500/15 transition-colors border border-blue-500/20"
          >
            <ArrowUpCircle className="h-3.5 w-3.5" />
            <span className="hidden sm:block">Suprimento</span>
          </button>
          <button
            onClick={() => setMovModal("sangria")}
            title="Sangria"
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-red-600 bg-red-500/8 hover:bg-red-500/15 transition-colors border border-red-500/20"
          >
            <ArrowDownCircle className="h-3.5 w-3.5" />
            <span className="hidden sm:block">Sangria</span>
          </button>
          <button
            onClick={handleIniciarFechamento} disabled={loading}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-muted-foreground bg-muted hover:bg-muted/80 transition-colors border border-border"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
            <span className="hidden sm:block">Fechar</span>
          </button>
        </div>
      </header>

      {/* ── TABS — venda / histórico / turnos ── */}
      <div className="flex border-b border-border bg-card shrink-0">
        <button onClick={() => setTab("venda")}
          className={`flex-1 sm:flex-initial px-4 py-2 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-colors ${tab === "venda" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          <ShoppingCart className="h-3.5 w-3.5" /> Vender
        </button>
        <button onClick={() => setTab("historico")}
          className={`flex-1 sm:flex-initial px-4 py-2 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-colors ${tab === "historico" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          <History className="h-3.5 w-3.5" /> Histórico
        </button>
        <button onClick={() => setTab("turnos")}
          className={`flex-1 sm:flex-initial px-4 py-2 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-colors ${tab === "turnos" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          <Receipt className="h-3.5 w-3.5" /> Turnos
        </button>
        <button onClick={() => { setTab("relatorios"); setSelectedSessionId(null); }}
          className={`flex-1 sm:flex-initial px-4 py-2 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-colors ${tab === "relatorios" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          <BarChart3 className="h-3.5 w-3.5" /> Relatórios
        </button>
      </div>

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

// ─────────────────────────────────────────────────────────────────────────────
// CATÁLOGO — reutilizado no desktop e no mobile
// ─────────────────────────────────────────────────────────────────────────────

const CatalogSection = ({
  search, setSearch, sections, activeSection, setActiveSection,
  grouped, prodLoading, getQty, addItem, decItem, searchInputRef,
}: any) => (
  <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
    {/* Busca */}
    <div className="px-3 pt-2.5 pb-2 shrink-0">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          ref={searchInputRef}
          type="text" placeholder="Buscar produto..."
          value={search} onChange={(e: any) => setSearch(e.target.value)}
          className="w-full pl-8 pr-8 py-2.5 bg-muted/40 rounded-xl text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 border border-border/50"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>
    </div>

    {/* Abas de seção */}
    {sections.length > 0 && !search && (
      <div className="flex gap-1.5 px-3 pb-2 overflow-x-auto no-scrollbar shrink-0">
        <button
          onClick={() => setActiveSection(null)}
          className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-colors border ${!activeSection ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-muted-foreground border-border"}`}>
          Todos
        </button>
        {sections.map((s: any) => (
          <button key={s.id}
            onClick={() => setActiveSection(activeSection === s.id ? null : s.id)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-colors border ${activeSection === s.id ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-muted-foreground border-border"}`}>
            {s.name}
          </button>
        ))}
      </div>
    )}

    {/* Produtos */}
    <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-3">
      {prodLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="h-8 w-8 mx-auto mb-2 opacity-20" />
          <p className="text-sm">Nenhum produto encontrado</p>
        </div>
      ) : (
        Object.entries(grouped as Record<string, any[]>).map(([section, items]) => (
          <div key={section}>
            {Object.keys(grouped).length > 1 && (
              <div className="flex items-center gap-2 px-1 mb-1.5 mt-2">
                <Layers className="h-3 w-3 text-muted-foreground" />
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{section}</p>
                <div className="flex-1 h-px bg-border/50" />
              </div>
            )}
            <div className="grid grid-cols-1 gap-1">
              {items.map((product: any) => {
                const qty = getQty(product.id);
                return (
                  <div key={product.id}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer ${qty > 0 ? "bg-primary/5 border-primary/25 shadow-sm" : "bg-card border-border/60 hover:bg-muted/20"}`}
                    onClick={() => addItem(product)}>
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-11 h-11 rounded-lg object-cover shrink-0 border border-border/30" />
                    ) : (
                      <div className="w-11 h-11 rounded-lg bg-muted/60 flex items-center justify-center shrink-0 border border-border/30">
                        <span className="text-base font-bold text-muted-foreground">{product.name[0]}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground leading-tight truncate">{product.name}</p>
                      <p className={`text-sm font-black mt-0.5 ${qty > 0 ? "text-primary" : "text-muted-foreground"}`}>{formatBRL(Number(product.price))}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {qty > 0 && (
                        <>
                          <button onClick={() => decItem(product.id)} className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center active:scale-90">
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="w-6 text-center text-sm font-black">{qty}</span>
                        </>
                      )}
                      <button onClick={() => addItem(product)} className={`w-8 h-8 rounded-lg flex items-center justify-center active:scale-90 shadow-sm ${qty > 0 ? "bg-primary shadow-primary/30" : "bg-primary/80 hover:bg-primary shadow-primary/20"}`}>
                        <Plus className="h-4 w-4 text-primary-foreground" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// CARRINHO + PAGAMENTO — reutilizado no desktop e no mobile
// ─────────────────────────────────────────────────────────────────────────────

const CartSection = ({
  cart, tableId, setTableId, totalItems, clearSale,
  subtotal, discountAmount, finalTotal,
  showDiscount, setShowDiscount, discountType, setDiscountType,
  discountInput, setDiscountInput,
  paymentMethod, setPaymentMethod, setCashReceived, cashReceived,
  troco, trocoNegativo, finalTotal_,
  removeItem, onFinalize, loading, orderDone,
  splitMode, setSplitMode, splitPayments, setSplitPayments,
}: any) => (
  <div className="flex flex-col h-full min-h-0 overflow-hidden">
    {/* Cabeçalho */}
    <div className="px-3 pt-2.5 pb-2 border-b border-border shrink-0">
      <div className="flex items-center justify-between">
        <input type="text" placeholder="Mesa / Comanda"
          value={tableId} onChange={(e: any) => setTableId(e.target.value)}
          className="text-xs bg-muted/40 rounded-lg px-2.5 py-1.5 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 border border-border/50 w-32" />
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">{totalItems} itens</span>
          {cart.length > 0 && (
            <button onClick={clearSale} className="p-1 rounded-lg hover:bg-muted transition-colors">
              <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>
    </div>

    {/* Itens */}
    <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
      {cart.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-2 py-8">
          <div className="w-14 h-14 rounded-2xl bg-muted/40 flex items-center justify-center">
            <ShoppingCart className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <p className="text-xs text-muted-foreground">Selecione os produtos</p>
        </div>
      ) : cart.map((item: any) => (
        <div key={`${item.id}__${(item.addons||[]).map(a=>a.name).join(",")}`} className="px-2.5 py-2 rounded-xl hover:bg-muted/30 group transition-colors">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-[11px] font-black text-primary">{item.quantity}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{item.name}</p>
              {item.addons && item.addons.length > 0 && (
                <p className="text-[10px] text-muted-foreground truncate">
                  {item.addons.map(a => a.name).join(", ")}
                </p>
              )}
              {item.observations && (
                <p className="text-[10px] text-amber-600 italic truncate">"{item.observations}"</p>
              )}
            </div>
            <p className="text-xs font-black text-foreground shrink-0">{formatBRL(item.price * item.quantity)}</p>
            <button onClick={() => removeItem(item.id)} className="p-0.5 text-muted-foreground hover:text-destructive transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>

    {/* Pagamento */}
    <div className="border-t border-border shrink-0 bg-card">
      {/* Desconto */}
      <div className="px-3 pt-2.5">
        <button onClick={() => setShowDiscount(!showDiscount)}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors w-full">
          <Tag className="h-3 w-3" />
          {discountAmount > 0
            ? <span className="text-emerald-500 font-bold">Desconto: −{formatBRL(discountAmount)}</span>
            : <span>Desconto</span>}
          <ChevronDown className={`h-3 w-3 ml-auto transition-transform ${showDiscount ? "rotate-180" : ""}`} />
        </button>
        {showDiscount && (
          <div className="mt-2 flex items-center gap-1.5">
            <div className="flex rounded-lg overflow-hidden border border-border shrink-0">
              <button onClick={() => setDiscountType("R$")} className={`px-2.5 py-1.5 text-[11px] font-bold transition-colors ${discountType === "R$" ? "bg-primary text-white" : "bg-muted/50 text-muted-foreground"}`}>R$</button>
              <button onClick={() => setDiscountType("%")} className={`px-2.5 py-1.5 text-[11px] font-bold transition-colors ${discountType === "%" ? "bg-primary text-white" : "bg-muted/50 text-muted-foreground"}`}>%</button>
            </div>
            <input type="text" inputMode="decimal"
              placeholder={discountType === "%" ? "10" : "5,00"}
              value={discountInput} onChange={(e: any) => setDiscountInput(e.target.value.replace(/[^0-9.,]/g, ""))}
              className="flex-1 px-2.5 py-1.5 bg-muted/40 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary/30 border border-border/50" />
          </div>
        )}
      </div>

      {/* Totais */}
      <div className="px-3 pt-2 pb-1 space-y-0.5">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-semibold">{formatBRL(subtotal)}</span>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-emerald-500">Desconto</span>
            <span className="font-bold text-emerald-500">−{formatBRL(discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-between items-baseline pt-1 border-t border-border/40">
          <span className="text-sm font-black">Total</span>
          <span className="text-2xl font-black text-primary">{formatBRL(finalTotal)}</span>
        </div>
      </div>

      {/* Toggle Split */}
      {finalTotal > 0 && (
        <div className="px-3 pt-1 pb-1.5 flex items-center justify-between">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Pagamento
          </span>
          <button
            onClick={() => {
              setSplitMode(!splitMode);
              setSplitPayments([]);
              setPaymentMethod("");
              setCashReceived("");
            }}
            className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border transition-colors ${
              splitMode
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
            }`}
          >
            <Split className="h-3 w-3" />
            {splitMode ? "Pagamento único" : "Dividir pagamento"}
          </button>
        </div>
      )}

      {/* Métodos OU Split */}
      {splitMode ? (
        <div className="px-3 pb-2">
          <PdvSplitPayment
            total={finalTotal}
            payments={splitPayments}
            onChange={setSplitPayments}
          />
        </div>
      ) : (
        <div className="px-3 pt-1 pb-2 grid grid-cols-2 gap-1.5">
          {PDV_METHODS.map(pm => {
            const Icon = pm.icon;
            const sel = paymentMethod === pm.id;
            return (
              <button key={pm.id}
                onClick={() => { setPaymentMethod(pm.id); setCashReceived(""); }}
                data-sel={sel}
                className={`flex items-center gap-1.5 px-2.5 py-2.5 rounded-xl border text-left transition-all active:scale-[0.97] ${COLOR_MAP[pm.color]}`}>
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="text-[11px] font-bold truncate">{pm.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Troco */}
      {!splitMode && paymentMethod === "dinheiro" && (
        <div className="mx-3 mb-2 bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 space-y-2">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Calculator className="h-3 w-3" /> Valor recebido
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">R$</span>
            <input type="text" inputMode="decimal"
              placeholder={finalTotal_.toFixed(2).replace(".", ",")}
              value={cashReceived}
              onChange={(e: any) => setCashReceived(e.target.value.replace(/[^0-9.,]/g, ""))}
              className={`w-full pl-8 pr-3 py-2.5 rounded-xl text-xl font-black text-center focus:outline-none focus:ring-2 transition-colors ${trocoNegativo ? "bg-red-500/10 text-red-500 border border-red-500/30" : "bg-white dark:bg-muted/50 border border-border/50 focus:ring-primary/30"}`}
            />
          </div>
          {/* Sugestões de cédulas */}
          {finalTotal_ > 0 && !cashReceived && (
            <div className="flex gap-1.5 flex-wrap">
              {[
                Math.ceil(finalTotal_ / 5) * 5,
                Math.ceil(finalTotal_ / 10) * 10,
                Math.ceil(finalTotal_ / 20) * 20,
                Math.ceil(finalTotal_ / 50) * 50,
              ].filter((v, i, a) => v >= finalTotal_ && a.indexOf(v) === i).slice(0, 4).map(v => (
                <button key={v} onClick={() => setCashReceived(v.toFixed(2).replace(".", ","))}
                  className="text-[11px] font-bold bg-muted/60 hover:bg-muted px-2.5 py-1 rounded-lg transition-colors">
                  R$ {v.toFixed(0)}
                </button>
              ))}
            </div>
          )}
          {cashReceived && (
            <div className={`flex justify-between items-center rounded-xl px-3 py-2.5 ${trocoNegativo ? "bg-red-500/10" : "bg-emerald-500/15"}`}>
              <span className={`text-xs font-bold ${trocoNegativo ? "text-red-500" : "text-emerald-700 dark:text-emerald-400"} flex items-center gap-1`}>
                {trocoNegativo ? "⚠️ Falta" : <><Wallet className="h-3.5 w-3.5" /> Troco</>}
              </span>
              <span className={`text-xl font-black ${trocoNegativo ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"}`}>
                {trocoNegativo ? formatBRL(finalTotal_ - (parseBRL(cashReceived))) : formatBRL(troco)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Finalizar */}
      <div className="px-3 pb-3">
        {(() => {
          const splitTotal = (splitPayments || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
          const splitComplete = splitMode && Math.abs(splitTotal - finalTotal) < 0.01;
          const canFinalize =
            !loading && !orderDone && cart.length > 0 &&
            (splitMode ? splitComplete : (!!paymentMethod && !trocoNegativo));
          return (
            <button onClick={onFinalize}
              disabled={!canFinalize}
              className="w-full h-12 bg-primary text-primary-foreground font-black text-sm rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg shadow-primary/25 disabled:opacity-50">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Registrando...</>
                : orderDone ? <><CheckCircle2 className="h-4 w-4" /> Venda registrada!</>
                : <>Finalizar {formatBRL(finalTotal)} <ChevronRight className="h-4 w-4" /></>}
            </button>
          );
        })()}
      </div>
    </div>
  </div>
);

export default PdvPage;
