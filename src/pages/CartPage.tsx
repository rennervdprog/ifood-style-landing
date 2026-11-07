import { formatBRL } from "@/lib/utils";
import { useCart } from "@/contexts/CartContext";
import { ArrowLeft, Minus, Plus, Trash2, MapPin, ShoppingBag, ChevronRight, Truck, Store, Clock, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getStoreOpenStatus, type OpeningHour, type StoreHoliday } from "@/lib/storeStatus";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

const CartPage = () => {
  const { items, neighborhood, neighborhoodFee, subtotal, total, updateQuantity, removeItem, clearCart, addItem } = useCart();
  const navigate = useNavigate();
  const { user } = useAuth();

  const storeId = items[0]?.store_id;
  const isNative = Capacitor.isNativePlatform?.() === true;

  // Pré-carrega o chunk da próxima tela (auth/checkout/guest)
  useEffect(() => {
    if (user) import("./CheckoutPage");
    else if (!isNative) import("./GuestCheckoutPage");
  }, [user, isNative]);

  // Guest checkout habilitado por loja (piloto Itatinga)
  const { data: guestFlag } = useQuery({
    queryKey: ["store-guest-flag", storeId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("stores_public")
        .select("guest_checkout_enabled")
        .eq("id", storeId!).maybeSingle();
      return !!data?.guest_checkout_enabled;
    },
    enabled: !!storeId,
    staleTime: 60_000,
  });

  const handleFinalize = () => {
    if (user) {
      navigate("/checkout");
    } else if (guestFlag && !isNative) {
      // No app Capacitor cliente priorizamos criar conta padrão — nunca guest.
      navigate("/checkout-rapido");
    } else {
      navigate("/auth", { state: { from: "/checkout" } });
    }
  };

  // Duas queries independentes: a barra de pedido mínimo só precisa da loja
  // (não pode esperar os horários, que chegam depois e faziam a barra
  // "surgir com atraso" na tela do carrinho).
  const { data: cartStore } = useQuery({
    queryKey: ["cart-store-minimum", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("stores_public")
        .select("is_open, force_closed, minimum_order_value, delivery_fee_type, delivery_fee, delivery_fee_base, delivery_fee_per_km, platform_split_effective, free_delivery_threshold")
        .eq("id", storeId!)
        .maybeSingle() as { data: any };
      return data;
    },
    enabled: !!storeId,
    staleTime: 60_000,
  });
  const { data: cartHours } = useQuery({
    queryKey: ["cart-store-hours", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("opening_hours")
        .select("day_of_week, open_time, close_time, is_closed_all_day")
        .eq("store_id", storeId!);
      return (data || []) as OpeningHour[];
    },
    enabled: !!storeId,
    refetchInterval: 60_000,
  });

  const { data: cartHolidays } = useQuery({
    queryKey: ["cart-store-holidays", storeId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("store_holidays")
        .select("date, reason")
        .eq("store_id", storeId!);
      return (data || []) as StoreHoliday[];
    },
    enabled: !!storeId,
    refetchInterval: 60_000,
  });

  // "Complete seu pedido" (2026-11-07): sugestões de clique rápido da PRÓPRIA
  // loja — complementos (bebida/porção/sobremesa) com foto, ordenados pelo que
  // mais sai em pedidos reais. Só entram produtos SIMPLES (sem grupos de
  // adicionais): quem tem opção continua no cardápio, pra o "+" ser 1 toque
  // de verdade, sem abrir tela nenhuma.
  const { data: suggestionPool } = useQuery({
    queryKey: ["cart-suggestions", storeId],
    queryFn: async () => {
      const { data: sections } = await supabase
        .from("menu_sections")
        .select("id, name")
        .eq("store_id", storeId!);
      const comp = (sections || []).filter((s: any) =>
        /bebida|porç|porc|sobremesa|doce|acompanhamento|batata/i.test(String(s.name || "")),
      );
      if (!comp.length) return [] as any[];
      const { data: prods } = await supabase
        .from("products")
        .select("id, name, price, image_url, section_id")
        .eq("store_id", storeId!)
        .eq("is_available", true)
        .in("section_id", comp.map((s: any) => s.id));
      const list = (prods || []).filter((p: any) => p.image_url);
      if (!list.length) return [] as any[];
      const ids = list.map((p: any) => p.id);
      const [{ data: links }, { data: sold }] = await Promise.all([
        (supabase as any).from("product_addon_groups").select("product_id").in("product_id", ids),
        (supabase as any).from("order_items").select("product_id").in("product_id", ids).limit(1000),
      ]);
      const withAddons = new Set((links || []).map((l: any) => l.product_id));
      const freq = new Map<string, number>();
      (sold || []).forEach((r: any) => freq.set(r.product_id, (freq.get(r.product_id) || 0) + 1));
      const secName = new Map((sections || []).map((s: any) => [s.id, String(s.name || "")]));
      const groupOf = (name: string) => (/bebida/i.test(name) ? 0 : /sobremesa|doce/i.test(name) ? 2 : 1);
      return list
        .filter((p: any) => !withAddons.has(p.id))
        .map((p: any) => ({ ...p, _freq: freq.get(p.id) || 0, _group: groupOf(secName.get(p.section_id) || "") }))
        .sort((a: any, b: any) => b._freq - a._freq);
    },
    enabled: !!storeId,
    staleTime: 300_000,
  });

  const storeStatus = cartStore
    ? getStoreOpenStatus(cartHours || [], cartStore.force_closed ?? false, cartStore.is_open ?? true, undefined, cartHolidays || [])
    : null;
  const isClosed = storeStatus ? !storeStatus.isOpen : false;
  const storeMinimumOrderValue = Number(cartStore?.minimum_order_value || 0);
  const belowMinimum = storeMinimumOrderValue > 0 && subtotal < storeMinimumOrderValue;
  const minimumMissing = belowMinimum ? storeMinimumOrderValue - subtotal : 0;

  // Sugestões finais: fora o que já está no carrinho; 1 por grupo
  // (bebida → acompanhamento → sobremesa), completando até 3 pelos mais pedidos.
  const inCartIds = new Set(items.map((i) => i.id));
  const suggestions = (() => {
    const pool = (suggestionPool || []).filter((p: any) => !inCartIds.has(p.id));
    const picked: any[] = [];
    for (const g of [0, 1, 2]) {
      const cand = pool.find((p: any) => p._group === g && !picked.includes(p));
      if (cand) picked.push(cand);
    }
    for (const p of pool) {
      if (picked.length >= 3) break;
      if (!picked.includes(p)) picked.push(p);
    }
    return picked.slice(0, 3);
  })();

  // Entrega "a partir de": taxa inicial real da loja (base no km, ou a taxa
  // fixa) + a taxa da plataforma vigente pra loja — o valor final continua
  // sendo o da cotação pelo endereço no checkout.
  const feePlatform = Number((cartStore as any)?.platform_split_effective ?? 0.99);
  const feeIsKm = (cartStore as any)?.delivery_fee_type === "km";
  const feeConfigured = feeIsKm
    ? (cartStore as any)?.delivery_fee_base != null || (cartStore as any)?.delivery_fee_per_km != null
    : (cartStore as any)?.delivery_fee != null;
  const startingFee = cartStore && feeConfigured
    ? Math.max(0, Number(feeIsKm ? (cartStore as any)?.delivery_fee_base || 0 : (cartStore as any)?.delivery_fee || 0) + feePlatform)
    : null;
  const freeThreshold = Number((cartStore as any)?.free_delivery_threshold || 0);

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background pb-32 overflow-y-auto">
        <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border flex items-center h-14 px-4 gap-3">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <h1 className="font-bold text-foreground">Carrinho</h1>
        </header>
        <div className="flex flex-col items-center justify-center py-24 text-center px-6">
          <div className="w-20 h-20 bg-muted rounded-3xl flex items-center justify-center mb-5">
            <ShoppingBag className="h-10 w-10 text-muted-foreground/50" />
          </div>
          <h2 className="text-lg font-bold text-foreground mb-1">Seu carrinho está vazio</h2>
          <p className="text-sm text-muted-foreground max-w-[240px]">
            Explore as lojas e adicione itens deliciosos ao seu pedido
          </p>
          <button
            onClick={() => navigate("/inicio")}
            className="mt-6 bg-primary text-primary-foreground font-bold px-8 py-3 rounded-xl text-sm active:scale-[0.98] transition-transform"
          >
            Ver lojas
          </button>
        </div>
        <BottomNav />
      </div>
    );
  }

  // Group items by store
  const storeGroups = items.reduce((acc, item) => {
    if (!acc[item.store_id]) acc[item.store_id] = { name: item.store_name, items: [] };
    acc[item.store_id].items.push(item);
    return acc;
  }, {} as Record<string, { name: string; items: typeof items }>);

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="min-h-screen bg-background overflow-y-auto" style={{ paddingBottom: "calc(15rem + env(safe-area-inset-bottom))" }}>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border flex items-center justify-between h-14 px-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <h1 className="font-bold text-foreground">Carrinho</h1>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {itemCount} {itemCount === 1 ? "item" : "itens"}
          </span>
        </div>
        <button onClick={clearCart} className="text-xs text-destructive font-bold flex items-center gap-1">
          <Trash2 className="h-3 w-3" />
          Limpar
        </button>
      </header>

      {/* Store Closed Alert */}
      {isClosed && storeStatus && (
        <div className="mx-4 mt-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-amber-700 dark:text-amber-300">Loja fechada no momento</h3>
            <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-0.5">
              Seu pedido não pode ser finalizado agora.
            </p>
            <div className="flex items-center gap-1.5 mt-2 bg-amber-500/10 rounded-lg px-3 py-1.5 w-fit">
              <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
              <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
                {storeStatus.reason}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 py-4 space-y-4">
        {/* Items grouped by store */}
        {Object.entries(storeGroups).map(([storeId, group]) => (
          <section key={storeId} className="bg-card rounded-2xl border border-border overflow-hidden">
            {/* Store header */}
            <div className="flex items-center gap-2.5 px-4 py-2.5 bg-muted/30 border-b border-border/50">
              <Store className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold text-foreground">{group.name}</span>
              <span className="text-[10px] text-muted-foreground ml-auto">
                {group.items.length} {group.items.length === 1 ? "item" : "itens"}
              </span>
            </div>

            <div className="divide-y divide-border/50">
              {group.items.map((item) => (
                <div key={item.cartKey} className="flex items-center gap-3 p-4">
                  {/* Item info */}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <h3 className="font-bold text-sm text-foreground leading-tight line-clamp-2">{item.name}</h3>
                    {item.addons && item.addons.length > 0 && (
                      <p className="text-[11px] text-muted-foreground truncate">
                        + {item.addons.map(a => a.name).join(", ")}
                      </p>
                    )}
                    {item.observations && (
                      <p className="text-[11px] text-muted-foreground/70 italic truncate">
                        "{item.observations}"
                      </p>
                    )}
                    <span className="text-sm font-black text-primary block pt-0.5">
                      {formatBRL((item.price * item.quantity))}
                    </span>
                  </div>

                  {/* Quantity controls */}
                  <div className="flex items-center gap-1.5 bg-muted/50 rounded-xl p-1">
                    <button
                      onClick={() => updateQuantity(item.cartKey, item.quantity - 1)}
                      className="w-8 h-8 rounded-lg bg-card border border-border/50 flex items-center justify-center active:scale-95 transition-transform"
                    >
                      {item.quantity === 1 ? (
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      ) : (
                        <Minus className="h-3.5 w-3.5 text-foreground" />
                      )}
                    </button>
                    <span className="text-sm font-bold w-7 text-center text-foreground">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.cartKey, item.quantity + 1)}
                      className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center active:scale-95 transition-transform"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Complete seu pedido — clique rápido (só na loja do carrinho) */}
            {suggestions.length > 0 && storeId === items[0]?.store_id && (
              <div className="border-t border-border/50 px-4 py-3.5 bg-primary/[0.03]">
                <h4 className="text-[13px] font-bold text-foreground">Complete seu pedido</h4>
                <p className="text-[11px] text-muted-foreground mb-2.5">Combina com o que você pegou · 1 toque e já entra no pedido</p>
                <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1">
                  {suggestions.map((p: any) => (
                    <div key={p.id} className="w-[104px] shrink-0 bg-card border border-border rounded-xl overflow-hidden">
                      <img src={p.image_url} alt={p.name} className="w-full h-16 object-cover" loading="lazy" />
                      <div className="p-2">
                        <p className="text-[11px] font-semibold leading-tight line-clamp-2 min-h-[26px] text-foreground">{p.name}</p>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-xs font-black text-primary">{formatBRL(Number(p.price))}</span>
                          <button
                            aria-label={`Adicionar ${p.name}`}
                            onClick={() => addItem({ id: p.id, store_id: items[0].store_id, store_name: items[0].store_name, name: p.name, price: Number(p.price), basePrice: Number(p.price), image_url: p.image_url })}
                            className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center active:scale-95 transition-transform"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        ))}
      </div>

      {/* Fixed bottom summary + CTA — senta ACIMA da BottomNav (h-16) MAIS a
          safe-area do aparelho: a barra de abas cresce com env(safe-area-inset-bottom)
          (iPhone/gestos), e com bottom-16 fixo ela cobria o rodapé desta barra e o
          botão "Finalizar pedido" nesses aparelhos. */}
      <div className="fixed left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border z-40" style={{ bottom: "calc(4rem + env(safe-area-inset-bottom))" }}>
        <div className="px-4 pt-3 pb-1 space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-semibold text-foreground">{formatBRL(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <Truck className="h-3 w-3" /> Entrega
            </span>
            <span className="font-semibold text-foreground text-right">
              {neighborhood
                ? `${formatBRL(neighborhoodFee)}`
                : startingFee === null
                  ? "Calculado no checkout"
                  : startingFee <= 0 || (freeThreshold > 0 && subtotal >= freeThreshold)
                    ? "Grátis"
                    : (
                      <>
                        a partir de {formatBRL(startingFee)}
                        <span className="block text-[11px] font-normal text-muted-foreground">
                          {freeThreshold > 0 ? `grátis acima de ${formatBRL(freeThreshold)} · ` : ""}calculada pelo seu endereço
                        </span>
                      </>
                    )}
            </span>
          </div>
          <div className="flex justify-between items-center pt-1.5 border-t border-border/50">
            <span className="text-base font-bold text-foreground">Total</span>
            <span className="text-xl font-black text-primary">{formatBRL(total)}</span>
          </div>
        </div>
        <div className="px-4 pb-4 pt-2">
          {belowMinimum && !isClosed && (
            <div className="mb-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-amber-700 dark:text-amber-400">Pedido mínimo: {formatBRL(storeMinimumOrderValue)}</span>
                <span className="font-black text-amber-700 dark:text-amber-400">Faltam {formatBRL(minimumMissing)}</span>
              </div>
              <div className="h-1.5 w-full bg-amber-500/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all"
                  style={{ width: `${Math.min(100, (subtotal / storeMinimumOrderValue) * 100)}%` }}
                />
              </div>
            </div>
          )}
          {isClosed ? (
            <button
              disabled
              className="w-full bg-muted text-muted-foreground font-bold py-4 rounded-2xl text-base flex items-center justify-center gap-2 cursor-not-allowed"
            >
              <Clock className="h-5 w-5" />
              {storeStatus?.nextOpenDay && storeStatus?.nextOpenTime
                ? `${storeStatus.nextOpenDay === "Hoje" ? "Abre" : `Abre ${storeStatus.nextOpenDay}`} às ${storeStatus.nextOpenTime}`
                : "Loja fechada"}
            </button>
          ) : belowMinimum ? (
            <button
              disabled
              className="w-full bg-muted text-muted-foreground font-bold py-4 rounded-2xl text-base flex items-center justify-center gap-2 cursor-not-allowed"
            >
              <AlertTriangle className="h-5 w-5" />
              Faltam {formatBRL(minimumMissing)} para o mínimo
            </button>
          ) : (
            <button
              onClick={handleFinalize}
              className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-2xl active:scale-[0.98] transition-all shadow-lg shadow-primary/25 text-base flex items-center justify-center gap-2"
            >
              Finalizar pedido
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default CartPage;
