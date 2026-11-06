import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Minus, Plus, Search, ShoppingCart, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import PdvDeliveryManualDialog from "@/components/pdv/PdvDeliveryManualDialog";
import type { CartItem } from "@/pages/pdv/types";

interface Props {
  open: boolean;
  onClose: () => void;
  storeId: string;
  storeName?: string | null;
  storeSettings?: Record<string, any> | null;
  onCreated?: () => void;
}

interface PickerProduct {
  id: string;
  name: string;
  price: number;
  image_url?: string | null;
}

interface SelectedItem {
  product: PickerProduct;
  quantity: number;
  observations: string;
}

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/**
 * Pedido delivery manual FORA do PDV (tela de Pedidos).
 * Passo 1 (este componente): monta o carrinho com os produtos do cardápio.
 * Passo 2: reaproveita o PdvDeliveryManualDialog (cliente, endereço, taxa,
 * pagamento, PIN e criação do pedido — mesmo fluxo provado do PDV).
 */
export default function ManualOrderFlow({ open, onClose, storeId, storeName, storeSettings, onCreated }: Props) {
  const [step, setStep] = useState<"picker" | "form">("picker");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SelectedItem[]>([]);

  useEffect(() => {
    if (open) {
      setStep("picker");
      setSearch("");
      setSelected([]);
    }
  }, [open ]);

  const { data: products, isLoading } = useQuery({
    queryKey: ["manual-order-products", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, promo_price, promo_active, image_url, metadata, sold_by_weight")
        .eq("store_id", storeId)
        .eq("is_available", true)
        .order("name");
      if (error) throw error;
      return (data || [])
        .filter((p: any) => {
          const m = p.metadata || {};
          if (m.pdv_only || m.hidden || m.is_ingredient) return false;
          if (p.sold_by_weight) return false;
          return true;
        })
        .map((p: any) => ({
          id: p.id,
          name: p.name,
          price: p.promo_active && p.promo_price ? Number(p.promo_price) : Number(p.price),
          image_url: p.image_url,
        })) as PickerProduct[];
    },
    enabled: open && !!storeId,
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    const list = products || [];
    const q = normalize(search.trim());
    if (!q) return list;
    return list.filter((p) => normalize(p.name).includes(q));
  }, [products, search]);

  const qtyOf = (id: string) => selected.find((s) => s.product.id === id)?.quantity || 0;

  const setQty = (product: PickerProduct, qty: number) => {
    setSelected((prev) => {
      const existing = prev.find((s) => s.product.id === product.id);
      if (qty <= 0) return prev.filter((s) => s.product.id !== product.id);
      if (existing) return prev.map((s) => (s.product.id === product.id ? { ...s, quantity: qty } : s));
      return [...prev, { product, quantity: qty, observations: "" }];
    });
  };

  const setObs = (id: string, observations: string) => {
    setSelected((prev) => prev.map((s) => (s.product.id === id ? { ...s, observations } : s)));
  };

  const subtotal = useMemo(
    () => selected.reduce((acc, s) => acc + s.product.price * s.quantity, 0),
    [selected]
  );

  const cart: CartItem[] = useMemo(
    () =>
      selected.map((s) => ({
        id: s.product.id,
        name: s.product.name,
        price: s.product.price,
        basePrice: s.product.price,
        quantity: s.quantity,
        observations: s.observations.trim() || undefined,
        image_url: s.product.image_url ?? null,
      })),
    [selected]
  );

  if (step === "form") {
    return (
      <PdvDeliveryManualDialog
        open={open}
        onClose={onClose}
        storeId={storeId}
        storeName={storeName}
        storeSettings={storeSettings || null}
        cart={cart}
        subtotal={subtotal}
        discountAmount={0}
        onSuccess={() => onCreated?.()}
        fullscreen
        wizardSteps
        onBackToItems={() => setStep("picker")}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[100dvh] w-[100vw] max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 p-0">
        <div className="border-b border-border px-4 py-3">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              Pedido manual
            </DialogTitle>
            <p className="text-xs text-muted-foreground">Para pedidos que chegam pelo WhatsApp ou telefone</p>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-4">
          {/* Stepper — 3 passos do pedido manual */}
          <div className="flex items-start justify-center gap-2">
            <span className="flex w-24 flex-col items-center gap-1 text-center">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
              <span className="text-[11px] font-bold leading-tight text-primary">O que o cliente pediu</span>
            </span>
            <span className="mt-3 h-px w-6 shrink-0 bg-border" />
            <span className="flex w-24 flex-col items-center gap-1 text-center">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">2</span>
              <span className="text-[11px] font-semibold leading-tight text-muted-foreground">Quem vai receber</span>
            </span>
            <span className="mt-3 h-px w-6 shrink-0 bg-border" />
            <span className="flex w-24 flex-col items-center gap-1 text-center">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">3</span>
              <span className="text-[11px] font-semibold leading-tight text-muted-foreground">Entrega e pagamento</span>
            </span>
          </div>

          <div>
            <h2 className="text-base font-black text-foreground">1. O que o cliente pediu?</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Toque no + para adicionar. Se o cliente pediu algum detalhe (“sem cebola”, “bem passado”), escreva na observação do item.
            </p>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar no cardápio…"
              className="pl-9"
            />
          </div>

          {selected.length > 0 && (
            <div className="space-y-2">
              {selected.map((s) => (
                <div key={s.product.id} className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-foreground min-w-0 truncate">{s.product.name}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setQty(s.product, s.quantity - 1)}
                        className="h-7 w-7 rounded-lg border border-border bg-background flex items-center justify-center active:scale-95"
                        aria-label="Diminuir"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="text-sm font-black w-5 text-center">{s.quantity}</span>
                      <button
                        type="button"
                        onClick={() => setQty(s.product, s.quantity + 1)}
                        className="h-7 w-7 rounded-lg border border-border bg-background flex items-center justify-center active:scale-95"
                        aria-label="Aumentar"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <span className="text-sm font-bold w-20 text-right">{formatBRL(s.product.price * s.quantity)}</span>
                    </div>
                  </div>
                  <Input
                    value={s.observations}
                    onChange={(e) => setObs(s.product.id, e.target.value)}
                    placeholder="Observação (ex.: sem cebola)"
                    className="mt-2 h-8 text-xs bg-background"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="divide-y divide-border/60">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando cardápio…
              </div>
            ) : filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhum produto encontrado.
              </p>
            ) : (
              filtered.slice(0, 40).map((p) => {
                const qty = qtyOf(p.id);
                return (
                  <div key={p.id} className="flex items-center justify-between gap-2 py-2.5">
                    <p className="text-sm text-foreground min-w-0 truncate">{p.name}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-bold text-muted-foreground">{formatBRL(p.price)}</span>
                      {qty === 0 ? (
                        <button
                          type="button"
                          onClick={() => setQty(p, 1)}
                          className="h-8 w-8 rounded-lg border border-primary text-primary flex items-center justify-center active:scale-95"
                          aria-label={`Adicionar ${p.name}`}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-xs font-black text-primary">
                          <ShoppingCart className="h-3.5 w-3.5" /> {qty} no pedido
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {!isLoading && filtered.length > 40 && (
            <p className="text-center text-[11px] text-muted-foreground">
              Mostrando os 40 primeiros — use a busca para achar o produto.
            </p>
          )}

        </div>
        </div>

        <div className="border-t border-border bg-background px-4 py-3">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Total até agora: <span className="text-base font-black text-foreground">{formatBRL(subtotal)}</span>
            </p>
            <Button onClick={() => setStep("form")} disabled={selected.length === 0}>
              Continuar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
