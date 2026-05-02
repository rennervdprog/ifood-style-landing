import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStorePlan } from "@/hooks/useStorePlan";
import { toast } from "sonner";
import { formatBRL, addMoney, sumMoney, subtractMoney } from "@/lib/utils";
import {
  ArrowLeft, Search, Plus, Minus, Trash2, ShoppingCart,
  Banknote, CreditCard, Smartphone, Monitor, ChevronRight,
  Loader2, CheckCircle2, X, Tag, AlertTriangle,
  ArrowDownCircle, ArrowUpCircle, Lock, Unlock,
  Receipt, ChevronDown, RefreshCw, Percent,
} from "lucide-react";

// ─── Tipos ───────────────────────────────────────────────────────────────────

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
  price: number;
  quantity: number;
  sectionName?: string;
}

interface PdvSession {
  id: string;
  store_id: string;
  opened_at: string;
  opening_amount: number;
  status: string;
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const PDV_PAYMENT_METHODS = [
  { id: "dinheiro",           label: "Dinheiro",       icon: Banknote,   color: "text-emerald-500" },
  { id: "maquininha_credito", label: "Crédito",        icon: CreditCard, color: "text-blue-500" },
  { id: "maquininha_debito",  label: "Débito",         icon: CreditCard, color: "text-indigo-500" },
  { id: "maquininha_pix",     label: "PIX Maquininha", icon: Smartphone, color: "text-primary" },
];

// ─── Componente principal ────────────────────────────────────────────────────

const PdvPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ── Estado da tela ──
  type Screen = "loading" | "abertura" | "venda" | "fechamento";
  const [screen, setScreen] = useState<Screen>("loading");

  // ── Sessão ──
  const [currentSession, setCurrentSession] = useState<PdvSession | null>(null);
  const [openingAmount, setOpeningAmount] = useState("0");

  // ── Carrinho ──
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [tableIdentifier, setTableIdentifier] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "value">("value");
  const [discountInput, setDiscountInput] = useState("");
  const [showDiscountPanel, setShowDiscountPanel] = useState(false);

  // ── UI ──
  const [search, setSearch] = useState("");
  const [showCart, setShowCart] = useState(false);
  const [loading, setLoading] = useState(false);
  const [orderDone, setOrderDone] = useState(false);

  // ── Modais ──
  const [movimentModal, setMovimentModal] = useState<"sangria" | "suprimento" | null>(null);
  const [movimentValue, setMovimentValue] = useState("");
  const [movimentDesc, setMovimentDesc] = useState("");

  // ── Fechamento ──
  const [closingAmount, setClosingAmount] = useState("");
  const [sessionSummary, setSessionSummary] = useState<any>(null);

  // ─── Loja ───────────────────────────────────────────────────────────────────

  const { data: store } = useQuery({
    queryKey: ["pdv-store", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("stores")
        .select("id, name, status")
        .eq("owner_id", user!.id)
        .eq("status", "ativo")
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const storePlan = useStorePlan(store?.id);

  // ─── Sessão aberta ──────────────────────────────────────────────────────────

  const checkOpenSession = useCallback(async () => {
    if (!store?.id) return;
    const { data } = await supabase
      .from("pdv_sessions" as any)
      .select("*")
      .eq("store_id", store.id)
      .eq("status", "open")
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setCurrentSession(data as PdvSession);
      setScreen("venda");
    } else {
      setScreen("abertura");
    }
  }, [store?.id]);

  useEffect(() => {
    if (store?.id) checkOpenSession();
  }, [store?.id, checkOpenSession]);

  // ─── Catálogo ───────────────────────────────────────────────────────────────

  const { data: sections = [] } = useQuery({
    queryKey: ["pdv-sections", store?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("menu_sections")
        .select("id, name, sort_order")
        .eq("store_id", store!.id)
        .order("sort_order");
      return (data || []) as MenuSection[];
    },
    enabled: !!store?.id,
  });

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["pdv-products", store?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, price, image_url, section_id, is_available")
        .eq("store_id", store!.id)
        .eq("is_available", true)
        .order("name");
      return (data || []) as Product[];
    },
    enabled: !!store?.id,
    staleTime: 60_000,
  });

  // ─── Carrinho ───────────────────────────────────────────────────────────────

  const addToCart = (product: Product, sectionName?: string) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { id: product.id, name: product.name, price: Number(product.price), quantity: 1, sectionName }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => {
      const item = prev.find(i => i.id === id);
      if (!item) return prev;
      if (item.quantity === 1) return prev.filter(i => i.id !== id);
      return prev.map(i => i.id === id ? { ...i, quantity: i.quantity - 1 } : i);
    });
  };

  const deleteFromCart = (id: string) => setCart(prev => prev.filter(i => i.id !== id));

  const clearSale = () => {
    setCart([]);
    setPaymentMethod("");
    setTableIdentifier("");
    setDiscountInput("");
    setShowDiscountPanel(false);
    setOrderDone(false);
  };

  const getQty = (id: string) => cart.find(i => i.id === id)?.quantity ?? 0;

  const subtotal = sumMoney(cart.map(i => i.price * i.quantity));
  const totalItems = cart.reduce((acc, i) => acc + i.quantity, 0);

  const discountAmount = useMemo(() => {
    const val = parseFloat(discountInput.replace(",", ".")) || 0;
    if (discountType === "percent") return Math.min(subtotal, subtotal * (val / 100));
    return Math.min(subtotal, val);
  }, [discountInput, discountType, subtotal]);

  const finalTotal = subtractMoney(subtotal, discountAmount);

  // ─── Catálogo filtrado e agrupado ────────────────────────────────────────────

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(q));
  }, [products, search]);

  const grouped = useMemo(() => {
    const sectionMap = new Map(sections.map(s => [s.id, s.name]));
    const result: Record<string, { product: Product; sectionName: string }[]> = {};
    filtered.forEach(p => {
      const sectionName = p.section_id ? (sectionMap.get(p.section_id) || "Outros") : "Sem categoria";
      if (!result[sectionName]) result[sectionName] = [];
      result[sectionName].push({ product: p, sectionName });
    });
    return result;
  }, [filtered, sections]);

  // ─── Ações do caixa ─────────────────────────────────────────────────────────

  const handleAbrirCaixa = async () => {
    if (!store?.id || !user?.id) return;
    const amount = parseFloat(openingAmount.replace(",", ".")) || 0;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("pdv_sessions" as any)
        .insert({
          store_id: store.id,
          opened_by: user.id,
          opening_amount: amount,
          status: "open",
        })
        .select()
        .single();
      if (error) throw error;
      setCurrentSession(data as PdvSession);
      setScreen("venda");
      toast.success(`Caixa aberto com R$ ${amount.toFixed(2)} de troco inicial.`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao abrir caixa.");
    } finally {
      setLoading(false);
    }
  };

  const handleFinalizarVenda = async () => {
    if (!store?.id || !currentSession) return;
    if (cart.length === 0) { toast.error("Carrinho vazio."); return; }
    if (!paymentMethod) { toast.error("Selecione o pagamento."); return; }

    setLoading(true);
    try {
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          store_id: store.id,
          client_id: null,
          order_source: "pdv",
          pdv_session_id: currentSession.id,
          table_identifier: tableIdentifier || null,
          subtotal,
          delivery_fee: 0,
          pdv_discount: discountAmount,
          commission_rate: storePlan.pdvCommissionRate ?? 0,
          total_price: finalTotal,
          app_fee: 0,
          payment_method: paymentMethod,
          neighborhood: "Balcão",
          address_details: tableIdentifier ? `${tableIdentifier} — Presencial` : "Pedido presencial",
          status: "finalizado", // PDV: já finalizado na hora
        } as any)
        .select("id")
        .single();
      if (orderError) throw orderError;

      // Itens do pedido
      await supabase.from("order_items").insert(
        cart.map(item => ({
          order_id: order.id,
          product_id: item.id,
          quantity: item.quantity,
          unit_price: item.price,
        }))
      );

      // Movimentação de caixa
      await supabase.from("pdv_movements" as any).insert({
        session_id: currentSession.id,
        store_id: store.id,
        type: "sale",
        amount: finalTotal,
        payment_method: paymentMethod,
        description: tableIdentifier || "Venda balcão",
        order_id: order.id,
      });

      queryClient.invalidateQueries({ queryKey: ["pdv-movements", currentSession.id] });
      setOrderDone(true);
      toast.success("✅ Venda registrada!");
      setTimeout(() => { clearSale(); }, 1800);
    } catch (err: any) {
      toast.error(err.message || "Erro ao finalizar venda.");
    } finally {
      setLoading(false);
    }
  };

  const handleMoviment = async (type: "sangria" | "suprimento") => {
    if (!currentSession || !store?.id) return;
    const amount = parseFloat(movimentValue.replace(",", ".")) || 0;
    if (amount <= 0) { toast.error("Informe um valor válido."); return; }

    setLoading(true);
    try {
      await supabase.from("pdv_movements" as any).insert({
        session_id: currentSession.id,
        store_id: store.id,
        type,
        amount,
        description: movimentDesc || (type === "sangria" ? "Sangria de caixa" : "Suprimento de caixa"),
      });
      queryClient.invalidateQueries({ queryKey: ["pdv-movements", currentSession.id] });
      toast.success(type === "sangria" ? `Sangria de ${formatBRL(amount)} registrada.` : `Suprimento de ${formatBRL(amount)} registrado.`);
      setMovimentModal(null);
      setMovimentValue("");
      setMovimentDesc("");
    } catch (err: any) {
      toast.error(err.message || "Erro ao registrar movimentação.");
    } finally {
      setLoading(false);
    }
  };

  const handleIniciarFechamento = async () => {
    if (!currentSession) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_pdv_session_summary" as any, {
        _session_id: currentSession.id,
      });
      if (error) throw error;
      setSessionSummary(data);
      setScreen("fechamento");
    } catch (err: any) {
      toast.error("Erro ao carregar resumo do turno.");
    } finally {
      setLoading(false);
    }
  };

  const handleFecharCaixa = async () => {
    if (!currentSession) return;
    const closing = parseFloat(closingAmount.replace(",", ".")) || 0;
    setLoading(true);
    try {
      await supabase
        .from("pdv_sessions" as any)
        .update({ status: "closed", closed_at: new Date().toISOString(), closing_amount: closing })
        .eq("id", currentSession.id);
      toast.success("Caixa fechado com sucesso.");
      setCurrentSession(null);
      setSessionSummary(null);
      setScreen("abertura");
      clearSale();
    } catch (err: any) {
      toast.error(err.message || "Erro ao fechar caixa.");
    } finally {
      setLoading(false);
    }
  };

  // ─── Movimentações do turno ─────────────────────────────────────────────────

  const { data: movements = [] } = useQuery({
    queryKey: ["pdv-movements", currentSession?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("pdv_movements" as any)
        .select("*")
        .eq("session_id", currentSession!.id)
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
    enabled: !!currentSession?.id,
    refetchInterval: 30_000,
  });

  const movSales = movements.filter(m => m.type === "sale");
  const movSangrias = movements.filter(m => m.type === "sangria");
  const movSuprimentos = movements.filter(m => m.type === "suprimento");
  const totalVendido = sumMoney(movSales.map(m => m.amount));
  const totalSangrias = sumMoney(movSangrias.map(m => m.amount));
  const totalSuprimentos = sumMoney(movSuprimentos.map(m => m.amount));
  const saldoEsperado = addMoney(
    (currentSession?.opening_amount ?? 0) + totalSuprimentos,
    sumMoney(movSales.filter(m => m.payment_method === "dinheiro").map(m => m.amount)),
    -totalSangrias
  );

  if (screen === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ╔══════════════════════════════════════════════════════════╗
  // ║  TELA 1 — ABERTURA DE CAIXA                             ║
  // ╚══════════════════════════════════════════════════════════╝

  if (screen === "abertura") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-sm border-b border-border flex items-center h-14 px-4 gap-3">
          <button onClick={() => navigate("/admin")} className="p-1 -ml-1">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <Monitor className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <h1 className="font-bold text-foreground text-sm">PDV — Abrir Caixa</h1>
            <p className="text-[10px] text-muted-foreground">{store?.name}</p>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <Unlock className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-black text-foreground">Abrir Caixa</h2>
              <p className="text-sm text-muted-foreground">
                Informe o valor inicial em dinheiro disponível para troco
              </p>
            </div>

            <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Valor inicial em caixa (R$)
                </label>
                <div className="relative mt-2">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">R$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={openingAmount}
                    onChange={e => setOpeningAmount(e.target.value.replace(/[^0-9.,]/g, ""))}
                    className="w-full pl-10 pr-4 py-3.5 bg-muted/50 rounded-xl text-2xl font-black text-foreground text-center focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
                  Se não tiver troco inicial, deixe em R$ 0,00
                </p>
              </div>

              <button
                onClick={handleAbrirCaixa}
                disabled={loading}
                className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-2xl text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg shadow-primary/25"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Unlock className="h-5 w-5" />}
                Abrir Caixa
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ╔══════════════════════════════════════════════════════════╗
  // ║  TELA 3 — FECHAMENTO DE CAIXA                           ║
  // ╚══════════════════════════════════════════════════════════╝

  if (screen === "fechamento") {
    const byPayment = sessionSummary?.by_payment || {};
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-sm border-b border-border flex items-center h-14 px-4 gap-3">
          <button onClick={() => setScreen("venda")} className="p-1 -ml-1">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <Lock className="h-5 w-5 text-destructive" />
          <div className="flex-1">
            <h1 className="font-bold text-foreground text-sm">Fechar Caixa</h1>
            <p className="text-[10px] text-muted-foreground">
              Aberto às {new Date(currentSession!.opened_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">
          {/* Resumo do turno */}
          <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" /> Resumo do Turno
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Total vendido</p>
                <p className="text-lg font-black text-emerald-500 mt-0.5">
                  {formatBRL(sessionSummary?.total_sales ?? 0)}
                </p>
                <p className="text-[10px] text-muted-foreground">{sessionSummary?.total_orders ?? 0} pedidos</p>
              </div>
              <div className="bg-muted/30 rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Abertura</p>
                <p className="text-lg font-black text-foreground mt-0.5">
                  {formatBRL(currentSession?.opening_amount ?? 0)}
                </p>
                <p className="text-[10px] text-muted-foreground">troco inicial</p>
              </div>
              {totalSangrias > 0 && (
                <div className="bg-red-500/5 border border-red-500/15 rounded-xl p-3">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Sangrias</p>
                  <p className="text-lg font-black text-red-500 mt-0.5">-{formatBRL(totalSangrias)}</p>
                </div>
              )}
              {totalSuprimentos > 0 && (
                <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-3">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Suprimentos</p>
                  <p className="text-lg font-black text-blue-500 mt-0.5">+{formatBRL(totalSuprimentos)}</p>
                </div>
              )}
            </div>

            {/* Por método de pagamento */}
            {Object.keys(byPayment).length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-border/30">
                <p className="text-[10px] text-muted-foreground font-bold uppercase">Por forma de pagamento</p>
                {Object.entries(byPayment).map(([method, amount]) => {
                  const pm = PDV_PAYMENT_METHODS.find(p => p.id === method);
                  return (
                    <div key={method} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{pm?.label || method}</span>
                      <span className="font-bold text-foreground">{formatBRL(Number(amount))}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Saldo esperado em dinheiro */}
            <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-3 flex justify-between items-center">
              <div>
                <p className="text-xs font-bold text-amber-600">Dinheiro esperado no caixa</p>
                <p className="text-[10px] text-muted-foreground">
                  Abertura + vendas dinheiro − sangrias + suprimentos
                </p>
              </div>
              <p className="text-xl font-black text-amber-500">{formatBRL(saldoEsperado)}</p>
            </div>
          </div>

          {/* Conferência */}
          <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
            <h2 className="text-sm font-bold text-foreground">Conferência de Caixa</h2>
            <div>
              <label className="text-xs font-bold text-muted-foreground">
                Valor contado em dinheiro (R$)
              </label>
              <div className="relative mt-2">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">R$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={closingAmount}
                  onChange={e => setClosingAmount(e.target.value.replace(/[^0-9.,]/g, ""))}
                  className="w-full pl-10 pr-4 py-3 bg-muted/50 rounded-xl text-lg font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>

            {closingAmount && (
              <div className={`rounded-xl p-3 flex justify-between items-center ${
                Math.abs(parseFloat(closingAmount.replace(",", ".")) - saldoEsperado) < 0.05
                  ? "bg-emerald-500/5 border border-emerald-500/15"
                  : "bg-red-500/5 border border-red-500/15"
              }`}>
                <p className="text-xs font-bold">Diferença</p>
                <p className={`text-base font-black ${
                  Math.abs(parseFloat(closingAmount.replace(",", ".")) - saldoEsperado) < 0.05
                    ? "text-emerald-500" : "text-red-500"
                }`}>
                  {formatBRL(parseFloat(closingAmount.replace(",", ".")) - saldoEsperado)}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-card/95 backdrop-blur-sm border-t border-border">
          <button
            onClick={handleFecharCaixa}
            disabled={loading}
            className="w-full bg-destructive text-destructive-foreground font-bold py-4 rounded-2xl text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Lock className="h-5 w-5" />}
            Confirmar Fechamento
          </button>
        </div>
      </div>
    );
  }

  // ╔══════════════════════════════════════════════════════════╗
  // ║  TELA 2 — VENDA (caixa aberto)                         ║
  // ╚══════════════════════════════════════════════════════════╝

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Header */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center h-14 px-3 gap-2">
          <button onClick={() => navigate("/admin")} className="p-1">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <Monitor className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-foreground truncate">{store?.name}</p>
            <p className="text-[10px] text-emerald-500 font-semibold">
              ● Caixa aberto · {formatBRL(totalVendido)} vendidos
            </p>
          </div>

          {/* Ações do caixa */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setMovimentModal("suprimento")}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-500/10 text-blue-600 rounded-lg text-[11px] font-bold"
            >
              <ArrowUpCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:block">Suprimento</span>
            </button>
            <button
              onClick={() => setMovimentModal("sangria")}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-red-500/10 text-red-600 rounded-lg text-[11px] font-bold"
            >
              <ArrowDownCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:block">Sangria</span>
            </button>
            <button
              onClick={handleIniciarFechamento}
              disabled={loading}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-destructive/10 text-destructive rounded-lg text-[11px] font-bold"
            >
              <Lock className="h-3.5 w-3.5" />
              <span className="hidden sm:block">Fechar</span>
            </button>
            {/* Carrinho mobile */}
            <button
              onClick={() => setShowCart(true)}
              className="relative p-2 bg-primary/10 rounded-xl ml-1"
            >
              <ShoppingCart className="h-5 w-5 text-primary" />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Busca */}
        <div className="px-3 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar produto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-muted/50 rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* CATÁLOGO */}
        <div className="flex-1 overflow-y-auto">
          {productsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : Object.keys(grouped).length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
              Nenhum produto encontrado
            </div>
          ) : (
            <div className="p-3 space-y-5">
              {Object.entries(grouped).map(([sectionName, items]) => (
                <div key={sectionName}>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1 sticky top-0 bg-background py-1">
                    {sectionName}
                  </p>
                  <div className="grid grid-cols-1 gap-1.5">
                    {items.map(({ product }) => {
                      const qty = getQty(product.id);
                      return (
                        <div
                          key={product.id}
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                            qty > 0 ? "bg-primary/5 border-primary/20" : "bg-card border-border/40"
                          }`}
                        >
                          {product.image_url && (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="w-12 h-12 rounded-xl object-cover shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground leading-tight">{product.name}</p>
                            <p className="text-sm font-black text-primary mt-0.5">{formatBRL(Number(product.price))}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {qty > 0 && (
                              <>
                                <button
                                  onClick={() => removeFromCart(product.id)}
                                  className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center active:scale-90 transition-transform"
                                >
                                  <Minus className="h-4 w-4 text-foreground" />
                                </button>
                                <span className="w-7 text-center text-sm font-black text-foreground">{qty}</span>
                              </>
                            )}
                            <button
                              onClick={() => addToCart(product, sectionName)}
                              className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center active:scale-90 transition-transform shadow-sm shadow-primary/30"
                            >
                              <Plus className="h-4 w-4 text-primary-foreground" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CARRINHO DESKTOP */}
        <aside className="hidden md:flex w-88 flex-col border-l border-border bg-card">
          <CartSide
            cart={cart}
            subtotal={subtotal}
            discountAmount={discountAmount}
            finalTotal={finalTotal}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            tableIdentifier={tableIdentifier}
            setTableIdentifier={setTableIdentifier}
            discountType={discountType}
            setDiscountType={setDiscountType}
            discountInput={discountInput}
            setDiscountInput={setDiscountInput}
            showDiscountPanel={showDiscountPanel}
            setShowDiscountPanel={setShowDiscountPanel}
            onDelete={deleteFromCart}
            onClear={clearSale}
            onFinalize={handleFinalizarVenda}
            loading={loading}
            orderDone={orderDone}
          />
        </aside>
      </div>

      {/* CARRINHO MOBILE — bottom sheet */}
      {showCart && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowCart(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
              <h2 className="font-bold text-foreground">Carrinho · {totalItems} itens</h2>
              <button onClick={() => setShowCart(false)}>
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <CartSide
                cart={cart}
                subtotal={subtotal}
                discountAmount={discountAmount}
                finalTotal={finalTotal}
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethod}
                tableIdentifier={tableIdentifier}
                setTableIdentifier={setTableIdentifier}
                discountType={discountType}
                setDiscountType={setDiscountType}
                discountInput={discountInput}
                setDiscountInput={setDiscountInput}
                showDiscountPanel={showDiscountPanel}
                setShowDiscountPanel={setShowDiscountPanel}
                onDelete={deleteFromCart}
                onClear={clearSale}
                onFinalize={() => { handleFinalizarVenda(); setShowCart(false); }}
                loading={loading}
                orderDone={orderDone}
              />
            </div>
          </div>
        </div>
      )}

      {/* MODAL SANGRIA / SUPRIMENTO */}
      {movimentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-card rounded-2xl border border-border w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center gap-3">
              {movimentModal === "sangria"
                ? <ArrowDownCircle className="h-6 w-6 text-red-500" />
                : <ArrowUpCircle className="h-6 w-6 text-blue-500" />
              }
              <h3 className="font-bold text-foreground text-base capitalize">{movimentModal}</h3>
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground">Valor (R$)</label>
              <input
                type="text" inputMode="decimal"
                placeholder="0,00"
                value={movimentValue}
                onChange={e => setMovimentValue(e.target.value.replace(/[^0-9.,]/g, ""))}
                className="w-full mt-1.5 px-3 py-3 bg-muted/50 rounded-xl text-lg font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground">Descrição (opcional)</label>
              <input
                type="text"
                placeholder={movimentModal === "sangria" ? "Ex: Enviado ao cofre" : "Ex: Reforço de troco"}
                value={movimentDesc}
                onChange={e => setMovimentDesc(e.target.value)}
                className="w-full mt-1.5 px-3 py-2.5 bg-muted/50 rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { setMovimentModal(null); setMovimentValue(""); setMovimentDesc(""); }}
                className="flex-1 py-3 rounded-xl bg-muted font-bold text-sm"
              >Cancelar</button>
              <button
                onClick={() => handleMoviment(movimentModal)}
                disabled={loading}
                className={`flex-1 py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-1.5 ${
                  movimentModal === "sangria" ? "bg-red-500" : "bg-blue-500"
                }`}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

// ─── CartSide: carrinho lateral/bottom ──────────────────────────────────────

interface CartSideProps {
  cart: CartItem[];
  subtotal: number;
  discountAmount: number;
  finalTotal: number;
  paymentMethod: string;
  setPaymentMethod: (v: string) => void;
  tableIdentifier: string;
  setTableIdentifier: (v: string) => void;
  discountType: "percent" | "value";
  setDiscountType: (v: "percent" | "value") => void;
  discountInput: string;
  setDiscountInput: (v: string) => void;
  showDiscountPanel: boolean;
  setShowDiscountPanel: (v: boolean) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  onFinalize: () => void;
  loading: boolean;
  orderDone: boolean;
}

const CartSide = ({
  cart, subtotal, discountAmount, finalTotal,
  paymentMethod, setPaymentMethod,
  tableIdentifier, setTableIdentifier,
  discountType, setDiscountType,
  discountInput, setDiscountInput,
  showDiscountPanel, setShowDiscountPanel,
  onDelete, onClear, onFinalize, loading, orderDone,
}: CartSideProps) => (
  <div className="flex flex-col h-full min-h-0">
    {/* Itens */}
    <div className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-0">
      {cart.length === 0 ? (
        <div className="text-center py-12">
          <ShoppingCart className="h-10 w-10 text-muted-foreground/20 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Carrinho vazio</p>
        </div>
      ) : cart.map(item => (
        <div key={item.id} className="flex items-center gap-2 bg-muted/30 rounded-xl p-2.5">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">{item.name}</p>
            <p className="text-[10px] text-muted-foreground">{item.quantity}x {formatBRL(item.price)}</p>
          </div>
          <p className="text-xs font-black text-foreground shrink-0">{formatBRL(item.price * item.quantity)}</p>
          <button onClick={() => onDelete(item.id)} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>

    {cart.length > 0 && (
      <div className="p-3 border-t border-border space-y-3 shrink-0">
        {/* Mesa */}
        <input
          type="text"
          placeholder="Mesa / Comanda (opcional)"
          value={tableIdentifier}
          onChange={e => setTableIdentifier(e.target.value)}
          className="w-full px-3 py-2 bg-muted/50 rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />

        {/* Desconto */}
        <div>
          <button
            onClick={() => setShowDiscountPanel(!showDiscountPanel)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            <Tag className="h-3.5 w-3.5" />
            <span>{discountAmount > 0 ? `Desconto: -${formatBRL(discountAmount)}` : "Adicionar desconto"}</span>
            <ChevronDown className={`h-3 w-3 ml-auto transition-transform ${showDiscountPanel ? "rotate-180" : ""}`} />
          </button>
          {showDiscountPanel && (
            <div className="mt-2 space-y-2">
              <div className="flex rounded-xl overflow-hidden border border-border">
                <button
                  onClick={() => setDiscountType("value")}
                  className={`flex-1 py-1.5 text-xs font-bold transition-colors ${discountType === "value" ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground"}`}
                >R$</button>
                <button
                  onClick={() => setDiscountType("percent")}
                  className={`flex-1 py-1.5 text-xs font-bold transition-colors ${discountType === "percent" ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground"}`}
                >%</button>
              </div>
              <input
                type="text" inputMode="decimal"
                placeholder={discountType === "percent" ? "Ex: 10" : "Ex: 5,00"}
                value={discountInput}
                onChange={e => setDiscountInput(e.target.value.replace(/[^0-9.,]/g, ""))}
                className="w-full px-3 py-2 bg-muted/50 rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          )}
        </div>

        {/* Totais */}
        <div className="space-y-1 py-2 border-t border-border/30">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-semibold">{formatBRL(subtotal)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-emerald-500">Desconto</span>
              <span className="font-bold text-emerald-500">-{formatBRL(discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-sm font-bold text-foreground">Total</span>
            <span className="text-lg font-black text-primary">{formatBRL(finalTotal)}</span>
          </div>
        </div>

        {/* Pagamento */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Pagamento</p>
          <div className="grid grid-cols-2 gap-1.5">
            {PDV_PAYMENT_METHODS.map(pm => {
              const Icon = pm.icon;
              const selected = paymentMethod === pm.id;
              return (
                <button
                  key={pm.id}
                  onClick={() => setPaymentMethod(pm.id)}
                  className={`flex items-center gap-1.5 p-2.5 rounded-xl border-2 transition-all text-left ${
                    selected ? "border-primary bg-primary/5" : "border-transparent bg-muted/50"
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${selected ? "text-primary" : pm.color}`} />
                  <span className={`text-[11px] font-semibold truncate ${selected ? "text-primary" : "text-foreground"}`}>
                    {pm.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Finalizar */}
        <div className="space-y-2">
          <button
            onClick={onFinalize}
            disabled={loading || !paymentMethod || orderDone || cart.length === 0}
            className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-primary/25"
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Registrando...</>
            ) : orderDone ? (
              <><CheckCircle2 className="h-4 w-4" /> Venda registrada!</>
            ) : (
              <>Finalizar Venda <ChevronRight className="h-4 w-4" /></>
            )}
          </button>
          <button
            onClick={onClear}
            className="w-full text-xs text-muted-foreground py-1 hover:text-destructive transition-colors"
          >
            Cancelar venda
          </button>
        </div>
      </div>
    )}
  </div>
);

export default PdvPage;
