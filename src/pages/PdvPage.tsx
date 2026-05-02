import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStorePlan } from "@/hooks/useStorePlan";
import { toast } from "sonner";
import { formatBRL, addMoney, sumMoney } from "@/lib/utils";
import {
  ArrowLeft, Search, Plus, Minus, Trash2, ShoppingCart,
  Banknote, CreditCard, Smartphone, Monitor, ChevronRight,
  Loader2, Tag, CheckCircle2, X, Store,
} from "lucide-react";

// Métodos de pagamento exclusivos do PDV (nunca no checkout do cliente)
const PDV_PAYMENT_METHODS = [
  { id: "dinheiro",            label: "Dinheiro",        icon: Banknote,    color: "text-emerald-500" },
  { id: "maquininha_credito",  label: "Crédito",         icon: CreditCard,  color: "text-blue-500" },
  { id: "maquininha_debito",   label: "Débito",          icon: CreditCard,  color: "text-indigo-500" },
  { id: "maquininha_pix",      label: "PIX Maquininha",  icon: Smartphone,  color: "text-primary" },
  // PIX Online (Asaas) NÃO está aqui — sem taxa R$1,99 no presencial
];

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category?: string;
}

const PdvPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [tableIdentifier, setTableIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [orderDone, setOrderDone] = useState(false);
  const [showCart, setShowCart] = useState(false);

  // Buscar loja do lojista logado
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

  // Redirecionar se PDV não está ativo para esta loja
  useEffect(() => {
    if (!storePlan.isLoading && !storePlan.pdvEnabled) {
      toast.error("O módulo PDV não está ativo para sua loja.");
      navigate("/admin");
    }
  }, [storePlan.isLoading, storePlan.pdvEnabled, navigate]);

  // Buscar produtos da loja
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["pdv-products", store?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, price, category, is_available")
        .eq("store_id", store!.id)
        .eq("is_available", true)
        .order("category")
        .order("name");
      return data || [];
    },
    enabled: !!store?.id,
  });

  // Filtrar produtos pela busca
  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.category || "").toLowerCase().includes(q)
    );
  }, [products, search]);

  // Agrupar por categoria
  const grouped = useMemo(() => {
    return filtered.reduce((acc, p) => {
      const cat = p.category || "Sem categoria";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(p);
      return acc;
    }, {} as Record<string, typeof filtered>);
  }, [filtered]);

  // Carrinho
  const addToCart = (product: typeof products[0]) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) {
        return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { id: product.id, name: product.name, price: Number(product.price), quantity: 1, category: product.category || undefined }];
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
  const clearCart = () => { setCart([]); setPaymentMethod(""); setTableIdentifier(""); };

  const subtotal = sumMoney(cart.map(i => i.price * i.quantity));
  const totalItems = cart.reduce((acc, i) => acc + i.quantity, 0);

  const getQty = (id: string) => cart.find(i => i.id === id)?.quantity ?? 0;

  const handleFinalize = async () => {
    if (!store?.id) return;
    if (cart.length === 0) { toast.error("Adicione produtos ao carrinho."); return; }
    if (!paymentMethod) { toast.error("Selecione a forma de pagamento."); return; }

    setLoading(true);
    try {
      // Inserir pedido PDV
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          store_id: store.id,
          client_id: null,              // PDV: sem cliente cadastrado
          order_source: "pdv",
          table_identifier: tableIdentifier || null,
          subtotal,
          delivery_fee: 0,              // sem entrega
          commission_rate: storePlan.pdvCommissionRate ?? 0,
          total_price: subtotal,
          app_fee: 0,
          payment_method: paymentMethod,
          neighborhood: "Balcão",
          address_details: tableIdentifier ? `${tableIdentifier} — Pedido presencial` : "Pedido presencial",
          status: "pendente",
        } as any)
        .select("id")
        .single();

      if (orderError) throw orderError;

      // Inserir itens
      const items = cart.map(item => ({
        order_id: order.id,
        product_id: item.id,
        quantity: item.quantity,
        unit_price: item.price,
      }));

      const { error: itemsError } = await supabase.from("order_items").insert(items);
      if (itemsError) throw itemsError;

      // Invalidar queries do admin para novo pedido aparecer
      queryClient.invalidateQueries({ queryKey: ["admin-all-orders"] });

      setOrderDone(true);
      toast.success("Pedido registrado! A cozinha já foi notificada.");
      clearCart();
      setTimeout(() => setOrderDone(false), 3000);

    } catch (err: any) {
      toast.error(err.message || "Erro ao finalizar pedido.");
    } finally {
      setLoading(false);
    }
  };

  if (storePlan.isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-sm border-b border-border flex items-center h-14 px-4 gap-3">
        <button onClick={() => navigate("/admin")} className="p-1 -ml-1">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <Monitor className="h-5 w-5 text-primary" />
        <div className="flex-1">
          <h1 className="font-bold text-foreground text-sm leading-tight">PDV — Caixa</h1>
          <p className="text-[10px] text-muted-foreground">{store?.name}</p>
        </div>
        {/* Carrinho mobile */}
        <button
          onClick={() => setShowCart(true)}
          className="relative p-2 bg-primary/10 rounded-xl"
        >
          <ShoppingCart className="h-5 w-5 text-primary" />
          {totalItems > 0 && (
            <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">
              {totalItems}
            </span>
          )}
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* LADO ESQUERDO — Catálogo */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Busca + Mesa */}
          <div className="p-3 space-y-2 border-b border-border/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar produto..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-muted/50 rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="flex items-center gap-2">
              <Store className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder="Mesa / Comanda (opcional)"
                value={tableIdentifier}
                onChange={e => setTableIdentifier(e.target.value)}
                className="flex-1 px-3 py-2 bg-muted/50 rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          {/* Lista de produtos */}
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {productsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : Object.keys(grouped).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Nenhum produto encontrado
              </div>
            ) : (
              Object.entries(grouped).map(([category, items]) => (
                <div key={category}>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                    {category}
                  </p>
                  <div className="space-y-1.5">
                    {items.map(product => {
                      const qty = getQty(product.id);
                      return (
                        <div
                          key={product.id}
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                            qty > 0 ? "bg-primary/5 border-primary/20" : "bg-card border-border/40"
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{product.name}</p>
                            <p className="text-xs font-bold text-primary">{formatBRL(Number(product.price))}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {qty > 0 && (
                              <>
                                <button
                                  onClick={() => removeFromCart(product.id)}
                                  className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center active:scale-95"
                                >
                                  <Minus className="h-3.5 w-3.5 text-foreground" />
                                </button>
                                <span className="w-6 text-center text-sm font-bold text-foreground">{qty}</span>
                              </>
                            )}
                            <button
                              onClick={() => addToCart(product)}
                              className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center active:scale-95"
                            >
                              <Plus className="h-3.5 w-3.5 text-primary-foreground" />
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

        {/* LADO DIREITO — Carrinho (desktop) */}
        <div className="hidden md:flex w-80 flex-col border-l border-border bg-card">
          <CartPanel
            cart={cart}
            subtotal={subtotal}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            onDelete={deleteFromCart}
            onClear={clearCart}
            onFinalize={handleFinalize}
            loading={loading}
            orderDone={orderDone}
          />
        </div>
      </div>

      {/* Carrinho mobile — bottom sheet */}
      {showCart && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowCart(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="font-bold text-foreground">Carrinho</h2>
              <button onClick={() => setShowCart(false)}>
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <CartPanel
                cart={cart}
                subtotal={subtotal}
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethod}
                onDelete={deleteFromCart}
                onClear={clearCart}
                onFinalize={() => { handleFinalize(); setShowCart(false); }}
                loading={loading}
                orderDone={orderDone}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Componente reutilizável do carrinho (desktop + mobile)
const CartPanel = ({
  cart, subtotal, paymentMethod, setPaymentMethod,
  onDelete, onClear, onFinalize, loading, orderDone,
}: {
  cart: CartItem[];
  subtotal: number;
  paymentMethod: string;
  setPaymentMethod: (v: string) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  onFinalize: () => void;
  loading: boolean;
  orderDone: boolean;
}) => (
  <div className="flex flex-col h-full">
    {/* Itens */}
    <div className="flex-1 overflow-y-auto p-3 space-y-2">
      {cart.length === 0 ? (
        <div className="text-center py-10">
          <ShoppingCart className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Carrinho vazio</p>
          <p className="text-xs text-muted-foreground/60">Adicione produtos ao lado</p>
        </div>
      ) : (
        cart.map(item => (
          <div key={item.id} className="flex items-center gap-2 bg-muted/30 rounded-xl p-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{item.name}</p>
              <p className="text-[10px] text-muted-foreground">
                {item.quantity}x {formatBRL(item.price)}
              </p>
            </div>
            <p className="text-xs font-bold text-foreground shrink-0">
              {formatBRL(item.price * item.quantity)}
            </p>
            <button onClick={() => onDelete(item.id)} className="p-1 text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))
      )}
    </div>

    {/* Total */}
    {cart.length > 0 && (
      <div className="p-3 border-t border-border space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm font-bold text-foreground">Total</span>
          <span className="text-lg font-black text-primary">{formatBRL(subtotal)}</span>
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
                  className={`flex items-center gap-1.5 p-2.5 rounded-xl border-2 text-left transition-all ${
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

        {/* Botões */}
        <div className="space-y-2">
          <button
            onClick={onFinalize}
            disabled={loading || !paymentMethod || orderDone}
            className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-2xl text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-primary/25"
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Registrando...</>
            ) : orderDone ? (
              <><CheckCircle2 className="h-4 w-4" /> Pedido enviado!</>
            ) : (
              <>Finalizar <ChevronRight className="h-4 w-4" /></>
            )}
          </button>
          {cart.length > 0 && (
            <button
              onClick={onClear}
              className="w-full text-xs text-muted-foreground py-1 hover:text-destructive transition-colors"
            >
              Limpar carrinho
            </button>
          )}
        </div>
      </div>
    )}
  </div>
);

export default PdvPage;
