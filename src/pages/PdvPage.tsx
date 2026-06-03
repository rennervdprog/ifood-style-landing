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

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  section_id: string | null;
  is_available: boolean;
}

interface MenuSection {
  id: string;
  name: string;
  sort_order: number;
}

interface CartItem {
  id: string;
  name: string;
  price: number;         // preço unitário total (base + addons)
  basePrice: number;     // preço base sem adicionais
  quantity: number;
  addons?: CartAddon[];
  observations?: string;
  image_url?: string | null;
}

interface PdvSession {
  id: string;
  store_id: string;
  opened_at: string;
  opening_amount: number;
  status: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────

const PDV_METHODS = [
  { id: "dinheiro",           label: "Dinheiro",    icon: Banknote,   color: "emerald", needsChange: true  },
  { id: "maquininha_credito", label: "Crédito",     icon: CreditCard, color: "blue",    needsChange: false },
  { id: "maquininha_debito",  label: "Débito",      icon: CreditCard, color: "indigo",  needsChange: false },
  { id: "maquininha_pix",     label: "PIX",         icon: Smartphone, color: "orange",  needsChange: false },
];

const COLOR_MAP: Record<string, string> = {
  emerald: "bg-emerald-500/10 text-emerald-600 border-emerald-500/25 data-[sel=true]:bg-emerald-500 data-[sel=true]:text-white data-[sel=true]:border-emerald-500",
  blue:    "bg-blue-500/10 text-blue-600 border-blue-500/25 data-[sel=true]:bg-blue-500 data-[sel=true]:text-white data-[sel=true]:border-blue-500",
  indigo:  "bg-indigo-500/10 text-indigo-600 border-indigo-500/25 data-[sel=true]:bg-indigo-500 data-[sel=true]:text-white data-[sel=true]:border-indigo-500",
  orange:  "bg-primary/10 text-primary border-primary/25 data-[sel=true]:bg-primary data-[sel=true]:text-white data-[sel=true]:border-primary",
};

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

  type Screen = "loading" | "abertura" | "venda" | "fechamento";
  const [screen, setScreen] = useState<Screen>("loading");
  const [currentSession, setCurrentSession] = useState<PdvSession | null>(null);

  // Mobile: etapas de venda
  type MobileStep = "catalog" | "cart";
  const [mobileStep, setMobileStep] = useState<MobileStep>("catalog");

  // Abas da tela de venda
  type Tab = "venda" | "historico" | "turnos" | "relatorios";
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

  // Venda
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [tableId, setTableId] = useState("");
  const [discountType, setDiscountType] = useState<"R$" | "%">("R$");
  const [discountInput, setDiscountInput] = useState("");
  const [showDiscount, setShowDiscount] = useState(false);
  const [cashReceived, setCashReceived] = useState(""); // valor entregue pelo cliente
  const [search, setSearch] = useState("");
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [orderDone, setOrderDone] = useState(false);

  // Multi-pagamento (split)
  const [splitMode, setSplitMode] = useState(false);
  const [splitPayments, setSplitPayments] = useState<SplitPayment[]>([]);

  // Mostrar guia de atalhos
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Ref do input de busca para foco com F2
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Modal de produto (adicionais, bordas, observações)
  const [productModal, setProductModal] = useState<any | null>(null);

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

  // ── Sessão ──
  const checkSession = useCallback(async () => {
    if (!store?.id) return;
    const { data } = await supabase
      .from("pdv_sessions" as any)
      .select("*").eq("store_id", store.id).eq("status", "open")
      .order("opened_at", { ascending: false }).limit(1).maybeSingle();
     if (data) { setCurrentSession(data as any as PdvSession); setScreen("venda"); }
    else setScreen("abertura");
  }, [store?.id]);

  useEffect(() => { if (store?.id) checkSession(); }, [store?.id, checkSession]);

  // ── Catálogo ──
  const { data: sections = [] } = useQuery({
    queryKey: ["pdv-sections", store?.id],
    queryFn: async () => {
      const { data } = await supabase.from("menu_sections")
        .select("id, name, sort_order").eq("store_id", store!.id).order("sort_order");
      return (data || []) as MenuSection[];
    },
    enabled: !!store?.id,
  });

  const { data: products = [], isLoading: prodLoading } = useQuery({
    queryKey: ["pdv-products", store?.id],
    queryFn: async () => {
      const { data } = await supabase.from("products")
        .select("id, name, price, image_url, section_id, is_available")
        .eq("store_id", store!.id).eq("is_available", true).order("name");
      return (data || []) as Product[];
    },
    enabled: !!store?.id,
    staleTime: 60_000,
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

  // ── Cálculos do carrinho ──
  const subtotal = sumMoney(cart.map(i => i.price * i.quantity));
  // Nota: i.price já inclui o valor dos adicionais (totalUnitPrice do modal)
  const totalItems = cart.reduce((a, i) => a + i.quantity, 0);

  const discountAmount = useMemo(() => {
    const v = parseBRL(discountInput);
    if (discountType === "%") return Math.min(subtotal, subtotal * (v / 100));
    return Math.min(subtotal, v);
  }, [discountInput, discountType, subtotal]);

  const finalTotal = subtractMoney(subtotal, discountAmount);

  const cashVal = parseBRL(cashReceived);
  const troco = cashReceived ? Math.max(0, cashVal - finalTotal) : 0;
  const trocoNegativo = cashReceived && cashVal < finalTotal;

  // ── Catálogo filtrado ──
  const sectionMap = useMemo(() => new Map(sections.map(s => [s.id, s.name])), [sections]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = q ? products.filter(p => p.name.toLowerCase().includes(q)) : products;
    if (activeSection && !q) list = list.filter(p => p.section_id === activeSection);
    return list;
  }, [products, search, activeSection]);

  const grouped = useMemo(() => {
    const result: Record<string, Product[]> = {};
    filtered.forEach(p => {
      const s = p.section_id ? (sectionMap.get(p.section_id) || "Outros") : "Sem categoria";
      if (!result[s]) result[s] = [];
      result[s].push(p);
    });
    return result;
  }, [filtered, sectionMap]);

  const getQty = (id: string) => cart.find(i => i.id === id)?.quantity ?? 0;

  // ── Ações carrinho ──
  // Abre o modal de produto para configurar adicionais
  // Se o produto não tem adicionais (verificado depois do modal), adiciona direto
  const openProduct = (p: Product) => setProductModal(p);

  // Adicionar ao carrinho após configurar no modal
  const handleModalAdd = (
    product: any,
    addons: CartAddon[],
    observations: string,
    quantity: number,
    totalUnitPrice: number
  ) => {
    // Gera uma chave única incluindo adicionais (permite mesmo produto com configurações diferentes)
    const addonKey = addons.map(a => a.name).sort().join(",");
    const cartKey = `${product.id}__${addonKey}__${observations}`;
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id && (i.addons?.map(a=>a.name).sort().join(",") || "") === addonKey && (i.observations||"") === observations);
      if (existing) {
        return prev.map(i =>
          i.id === product.id && (i.addons?.map(a=>a.name).sort().join(",") || "") === addonKey
            ? { ...i, quantity: i.quantity + quantity }
            : i
        );
      }
      return [...prev, {
        id: product.id,
        name: product.name,
        basePrice: Number(product.price),
        price: totalUnitPrice,
        quantity,
        addons: addons.length > 0 ? addons : undefined,
        observations: observations || undefined,
        image_url: product.image_url,
      }];
    });
    setProductModal(null);
  };

  // addItem simples (sem adicionais) — mantido para compatibilidade com +/- no carrinho
  const addItem = (p: Product) => openProduct(p);

  const decItem = (id: string) => setCart(prev => {
    const it = prev.find(i => i.id === id);
    if (!it) return prev;
    if (it.quantity === 1) return prev.filter(i => i.id !== id);
    return prev.map(i => i.id === id ? { ...i, quantity: i.quantity - 1 } : i);
  });

  const removeItem = (id: string) => setCart(prev => prev.filter(i => i.id !== id));

  const clearSale = () => {
    setCart([]); setPaymentMethod(""); setTableId("");
    setDiscountInput(""); setShowDiscount(false);
    setCashReceived(""); setOrderDone(false);
    setSplitMode(false); setSplitPayments([]);
    if (isMobile) setMobileStep("catalog");
  };

  // ── Abrir caixa ──
  const handleAbrirCaixa = async () => {
    if (!store?.id || !user?.id) return;
    const amount = parseBRL(openingAmount);
    setLoading(true);
    try {
      const { data, error } = await supabase.from("pdv_sessions" as any)
        .insert({ store_id: store.id, opened_by: user.id, opening_amount: amount, status: "open" })
        .select().single();
      if (error) throw error;
       setCurrentSession(data as any as PdvSession);
      setScreen("venda");
      toast.success(`Caixa aberto! Troco inicial: ${formatBRL(amount)}`);
    } catch (e: any) { toast.error(e.message || "Erro ao abrir caixa."); }
    finally { setLoading(false); }
  };

  // ── Finalizar venda ──
  const handleVenda = async () => {
    if (!store?.id || !currentSession) return;
    if (cart.length === 0) { toast.error("Carrinho vazio."); return; }

    // Modo split: validar que pagamentos somam o total
    if (splitMode) {
      const splitTotal = sumMoney(splitPayments.map((p) => p.amount));
      if (Math.abs(splitTotal - finalTotal) > 0.01) {
        toast.error("Pagamentos não fecham o total."); return;
      }
    } else {
      if (!paymentMethod) { toast.error("Selecione o pagamento."); return; }
      if (paymentMethod === "dinheiro" && cashReceived && cashVal < finalTotal) {
        toast.error("Valor recebido menor que o total."); return;
      }
    }

    setLoading(true);
    try {
      // Forma de pagamento principal: a 1ª do split, ou a única selecionada
      const primaryMethod = splitMode ? (splitPayments[0]?.method || "dinheiro") : paymentMethod;
      const paymentsPayload = splitMode
        ? splitPayments
        : [{ method: paymentMethod, amount: finalTotal }];

      const { data: order, error: oe } = await supabase.from("orders")
        .insert({
          store_id: store.id, client_id: null, order_source: "pdv",
          pdv_session_id: currentSession.id,
          table_identifier: tableId || null,
          subtotal, delivery_fee: 0,
          pdv_discount: discountAmount,
          commission_rate: storePlan.pdvCommissionRate ?? 0,
          total_price: finalTotal, app_fee: 0,
          payment_method: primaryMethod,
          payments: paymentsPayload,
          neighborhood: "Balcão",
          address_details: tableId ? `${tableId} — Presencial` : "Pedido presencial",
          status: "finalizado",
        } as any).select("id").single();
      if (oe) throw oe;

      await supabase.from("order_items").insert(
        cart.map(item => ({
          order_id: order.id,
          product_id: item.id,
          quantity: item.quantity,
          unit_price: item.price,
          addons: item.addons && item.addons.length > 0 ? JSON.stringify(item.addons) : null,
          observations: item.observations || null,
        }))
      );

      // Insere uma movimentação por forma de pagamento (suporta split)
      await supabase.from("pdv_movements" as any).insert(
        paymentsPayload.map((p) => ({
          session_id: currentSession.id,
          store_id: store.id,
          type: "sale",
          amount: p.amount,
          payment_method: p.method,
          description: tableId || "Venda balcão",
          order_id: order.id,
        }))
      );

      queryClient.invalidateQueries({ queryKey: ["pdv-movements", currentSession.id] });
      setOrderDone(true);
      toast.success("✅ Venda finalizada!");

      // Imprimir nota PDV automaticamente
      try {
        printPdvReceipt({
          id: order.id,
          created_at: new Date().toISOString(),
          subtotal,
          pdv_discount: discountAmount,
          total_price: finalTotal,
          payment_method: primaryMethod,
          cash_received: !splitMode && paymentMethod === "dinheiro" && cashReceived ? parseBRL(cashReceived) : undefined,
          troco: !splitMode && paymentMethod === "dinheiro" && cashReceived ? troco : undefined,
          table_identifier: tableId || null,
          order_items: cart.map(item => ({
            quantity: item.quantity,
            unit_price: item.price,
            products: { name: item.name },
          })),
        }, store?.name || "Loja");
      } catch (e) {
        console.warn("Erro ao imprimir:", e);
      }

      setTimeout(clearSale, 2000);
    } catch (e: any) { toast.error(e.message || "Erro ao finalizar."); }
    finally { setLoading(false); }
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

  // ── Fechar caixa ──
  const handleFecharCaixa = async () => {
    if (!currentSession) return;
    setLoading(true);
    try {
      const counted = parseBRL(closingAmount);
      // Calcula esperado aqui (não dá pra confiar em saldoEsperado se for blind close)
      const expected = saldoEsperado;
      const diff = counted - expected;
      await supabase.from("pdv_sessions" as any)
        .update({
          status: "closed",
          closed_at: new Date().toISOString(),
          closing_amount: counted,
          closing_difference: diff,
          closing_method: blindClose ? "blind" : "open",
          denomination_count: Object.keys(denominationCounts).length > 0 ? denominationCounts : null,
        })
        .eq("id", currentSession.id);
      toast.success("Caixa fechado.");
      setCurrentSession(null); setSessionSummary(null); setScreen("abertura"); clearSale();
      setBlindClose(false); setDenominationCounts({}); setClosingAmount("");
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
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
      setCart(prev => {
        const existing = prev.find(i => i.id === found.id && !i.addons && !i.observations);
        if (existing) {
          return prev.map(i => i.id === found.id && !i.addons && !i.observations
            ? { ...i, quantity: i.quantity + 1 }
            : i);
        }
        return [...prev, {
          id: found.id,
          name: found.name,
          basePrice: Number(found.price),
          price: Number(found.price),
          quantity: 1,
          image_url: found.image_url,
        }];
      });
      toast.success(`+ ${found.name}`, { duration: 1200 });
    } else {
      toast.warning(`Código não encontrado: ${code}`);
    }
  }, [products]);

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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="h-14 border-b border-border flex items-center px-4 gap-3 bg-card">
        <button onClick={() => navigate("/admin")} className="p-1.5 rounded-xl hover:bg-muted transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Monitor className="h-5 w-5 text-primary" />
        <div className="flex-1">
          <p className="text-sm font-bold">{store?.name}</p>
          <p className="text-[10px] text-muted-foreground">PDV · Caixa fechado</p>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-xs space-y-6">
          {/* Ícone */}
          <div className="text-center space-y-3">
            <div className="w-20 h-20 rounded-3xl bg-primary/10 border-2 border-primary/20 flex items-center justify-center mx-auto">
              <Unlock className="h-9 w-9 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-foreground">Abrir Caixa</h2>
              <p className="text-sm text-muted-foreground mt-1">Informe o troco disponível para começar</p>
            </div>
          </div>

          {/* Input */}
          <div className="bg-card rounded-2xl border border-border p-5 space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Dinheiro inicial (troco)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">R$</span>
                <input
                  type="text" inputMode="decimal"
                  value={openingAmount}
                  onChange={e => setOpeningAmount(e.target.value.replace(/[^0-9.,]/g, ""))}
                  placeholder="0,00"
                  className="w-full pl-10 pr-4 py-4 bg-muted/40 rounded-xl text-2xl font-black text-center text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <p className="text-[11px] text-muted-foreground text-center">Deixe 0,00 se não tiver troco inicial</p>
            </div>

            <button
              onClick={handleAbrirCaixa} disabled={loading}
              className="w-full h-14 bg-primary text-primary-foreground font-black text-base rounded-2xl flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all shadow-lg shadow-primary/30 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Unlock className="h-5 w-5" />}
              Abrir Caixa
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // TELA 3 — FECHAMENTO
  // ─────────────────────────────────────────────────────────────────────────

  if (screen === "fechamento") {
    const byPayment: Record<string, number> = sessionSummary?.by_payment || {};
    const diffAmount = parseBRL(closingAmount) - saldoEsperado;
    const isOk = closingAmount && Math.abs(diffAmount) < 0.05;

    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="h-14 border-b border-border flex items-center px-4 gap-3 bg-card">
          <button onClick={() => setScreen("venda")} className="p-1.5 rounded-xl hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <Lock className="h-5 w-5 text-destructive" />
          <div className="flex-1">
            <p className="text-sm font-bold">Fechamento de Caixa</p>
            <p className="text-[10px] text-muted-foreground">
              Aberto às {currentSession && new Date(currentSession.opened_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-28">
          {/* Resumo do turno */}
          <div className="bg-card rounded-2xl border border-border p-4 space-y-4">
            <h3 className="text-sm font-black flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" /> Resumo do Turno
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-500/8 border border-emerald-500/15 rounded-xl p-3 space-y-0.5">
                <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Total Vendido</p>
                <p className="text-xl font-black text-emerald-500">{formatBRL(sessionSummary?.total_sales ?? 0)}</p>
                <p className="text-[10px] text-muted-foreground">{sessionSummary?.total_orders ?? 0} vendas</p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3 space-y-0.5">
                <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Abertura</p>
                <p className="text-xl font-black text-foreground">{formatBRL(currentSession?.opening_amount ?? 0)}</p>
                <p className="text-[10px] text-muted-foreground">troco inicial</p>
              </div>
              {turnoSangrias > 0 && (
                <div className="bg-red-500/8 border border-red-500/15 rounded-xl p-3">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Sangrias</p>
                  <p className="text-lg font-black text-red-500">−{formatBRL(turnoSangrias)}</p>
                </div>
              )}
              {turnoSuprimentos > 0 && (
                <div className="bg-blue-500/8 border border-blue-500/15 rounded-xl p-3">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Suprimentos</p>
                  <p className="text-lg font-black text-blue-500">+{formatBRL(turnoSuprimentos)}</p>
                </div>
              )}
            </div>

            {/* Por forma de pagamento */}
            {Object.keys(byPayment).length > 0 && (
              <div className="border-t border-border/40 pt-3 space-y-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Por pagamento</p>
                {Object.entries(byPayment).map(([m, v]) => {
                  const pm = PDV_METHODS.find(p => p.id === m);
                  return (
                    <div key={m} className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{pm?.label || m}</span>
                      <span className="text-sm font-bold">{formatBRL(Number(v))}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Saldo esperado — esconder se for fechamento cego e ainda não tiver contado */}
            {!blindClose ? (
              <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-amber-700 dark:text-amber-400">Dinheiro esperado no caixa</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Abertura + vendas − sangrias + suprimentos</p>
                </div>
                <p className="text-xl font-black text-amber-500">{formatBRL(saldoEsperado)}</p>
              </div>
            ) : (
              <div className="bg-purple-500/8 border border-purple-500/30 rounded-xl p-3.5 flex items-center gap-3">
                <EyeOff className="h-5 w-5 text-purple-500 shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-purple-700 dark:text-purple-300">Fechamento cego ativo</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    O valor esperado fica oculto até você confirmar o fechamento. Padrão antifraude.
                  </p>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setBlindClose(v => !v)}
              className="w-full text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5"
            >
              {blindClose ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              {blindClose ? "Mostrar valor esperado" : "Ativar fechamento cego (anti-fraude)"}
            </button>
          </div>

          {/* Conferência */}
          <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
            <h3 className="text-sm font-black">Conferência</h3>
            <div>
              <label className="text-xs font-bold text-muted-foreground">Dinheiro contado no caixa</label>
              <div className="relative mt-2">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">R$</span>
                <input
                  type="text" inputMode="decimal" placeholder="0,00"
                  value={closingAmount}
                  onChange={e => setClosingAmount(e.target.value.replace(/[^0-9.,]/g, ""))}
                  className="w-full pl-10 pr-4 py-3.5 bg-muted/40 rounded-xl text-xl font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>

            {/* Conferência por cédula (auto-soma) */}
            <PdvDenominationCount
              onChange={(total, counts) => {
                setDenominationCounts(counts);
                if (total > 0) setClosingAmount(total.toFixed(2).replace(".", ","));
              }}
            />

            {/* Diferença — só revelada quando não é blind ou já confirmou */}
            {closingAmount && !blindClose && (
              <div className={`rounded-xl p-3 flex justify-between items-center border ${isOk ? "bg-emerald-500/8 border-emerald-500/20" : "bg-red-500/8 border-red-500/20"}`}>
                <p className={`text-sm font-bold ${isOk ? "text-emerald-600" : "text-red-500"}`}>
                  {isOk ? "✅ Caixa conferido" : diffAmount > 0 ? "⚠️ Sobra" : "⚠️ Falta"}
                </p>
                <p className={`text-lg font-black ${isOk ? "text-emerald-500" : "text-red-500"}`}>
                  {isOk ? "—" : formatBRL(Math.abs(diffAmount))}
                </p>
              </div>
            )}
            {closingAmount && blindClose && (
              <div className="rounded-xl p-3 bg-purple-500/8 border border-purple-500/20">
                <p className="text-xs text-purple-600 dark:text-purple-400 font-bold flex items-center gap-1.5">
                  <EyeOff className="h-3.5 w-3.5" /> A diferença será calculada após confirmar
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-card/95 backdrop-blur-sm border-t border-border">
          <button
            onClick={handleFecharCaixa} disabled={loading}
            className="w-full h-14 bg-destructive text-destructive-foreground font-black text-base rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Lock className="h-5 w-5" />}
            Confirmar Fechamento
          </button>
        </div>
      </div>
    );
  }

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
                <CatalogSection
                  search={search} setSearch={setSearch}
                  sections={sections} activeSection={activeSection} setActiveSection={setActiveSection}
                  grouped={grouped} prodLoading={prodLoading}
                  getQty={getQty} addItem={addItem} decItem={decItem}
                  searchInputRef={searchInputRef}
                />
              </div>
              {/* Caixa */}
              <aside className="w-72 lg:w-80 xl:w-96 flex flex-col bg-card shrink-0 overflow-hidden">
                <CartSection
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
                  loading={loading} orderDone={orderDone}
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
                    <CatalogSection
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
                    <CartSection
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
                      loading={loading} orderDone={orderDone}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card rounded-2xl border border-border w-full max-w-xs p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              {movModal === "sangria"
                ? <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center"><ArrowDownCircle className="h-5 w-5 text-red-500" /></div>
                : <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center"><ArrowUpCircle className="h-5 w-5 text-blue-500" /></div>
              }
              <div>
                <h3 className="font-black text-base capitalize">{movModal}</h3>
                <p className="text-[11px] text-muted-foreground">
                  {movModal === "sangria" ? "Retirada de dinheiro do caixa" : "Entrada de dinheiro no caixa"}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-muted-foreground">Valor (R$)</label>
                <div className="relative mt-1.5">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">R$</span>
                  <input
                    type="text" inputMode="decimal" placeholder="0,00"
                    value={movValue} onChange={e => setMovValue(e.target.value.replace(/[^0-9.,]/g, ""))}
                    className="w-full pl-9 pr-3 py-3 bg-muted/40 rounded-xl text-xl font-black text-center focus:outline-none focus:ring-2 focus:ring-primary/30 border border-border/50"
                  />
                </div>
              </div>

              {/* Motivos preset (só sangria) */}
              {movModal === "sangria" && (
                <div>
                  <label className="text-xs font-bold text-muted-foreground">Motivo *</label>
                  <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                    {["Cofre", "Despesa", "Pagto fornecedor", "Outro"].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setMovReason(r)}
                        className={`px-2 py-1.5 rounded-lg text-[11px] font-bold transition-colors border ${
                          movReason === r
                            ? "bg-red-500 text-white border-red-500"
                            : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-muted-foreground">
                  Observação {movModal === "sangria" ? "(opcional)" : ""}
                </label>
                <input
                  type="text"
                  placeholder={movModal === "sangria" ? "Ex: Enviado ao cofre" : "Ex: Reforço de troco"}
                  value={movDesc} onChange={e => setMovDesc(e.target.value)}
                  className="w-full mt-1.5 px-3 py-2.5 bg-muted/40 rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 border border-border/50"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { setMovModal(null); setMovValue(""); setMovDesc(""); setMovReason(""); }}
                className="flex-1 h-11 rounded-xl bg-muted font-bold text-sm"
              >Cancelar</button>
              <button
                onClick={() => handleMoviment(movModal)}
                disabled={loading}
                className={`flex-1 h-11 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-1.5 ${
                  movModal === "sangria" ? "bg-red-500 hover:bg-red-600" : "bg-blue-500 hover:bg-blue-600"
                } transition-colors`}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL ATALHOS DE TECLADO ── */}
      {showShortcuts && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="bg-card rounded-2xl border border-border w-full max-w-sm p-5 space-y-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Keyboard className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-black text-base">Atalhos de teclado</h3>
                <p className="text-[11px] text-muted-foreground">Acelere o atendimento</p>
              </div>
            </div>
            <div className="space-y-2">
              {[
                ["F2", "Focar busca de produtos"],
                ["F3", "Abrir/fechar desconto"],
                ["F4", "Trocar forma de pagamento"],
                ["F8", "Finalizar venda"],
                ["ESC", "Limpar venda atual"],
                ["Scanner", "Leitor USB adiciona ao carrinho"],
              ].map(([k, desc]) => (
                <div key={k} className="flex items-center justify-between bg-muted/30 px-3 py-2 rounded-lg">
                  <span className="text-xs text-muted-foreground">{desc}</span>
                  <kbd className="px-2 py-0.5 rounded-md bg-background border border-border text-[11px] font-black text-foreground">
                    {k}
                  </kbd>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowShortcuts(false)}
              className="w-full h-10 rounded-xl bg-primary text-primary-foreground font-bold text-sm"
            >
              Entendi
            </button>
          </div>
        </div>
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
