import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Loader2, Minus, Pencil, Plus, Search, ShoppingCart, Trash2, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, sumMoney } from "@/lib/utils";
import type { ProductAddonGroup, ProductAddonItem } from "@/lib/productAddons";
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

/** Adicional escolhido de um item (antes de virar CartAddon[] no carrinho). */
interface SelectedAddon {
  itemId: string;
  groupId: string;
  groupName: string;
  name: string;
  /** Preço unitário do adicional. */
  price: number;
  qty: number;
  /** Grupo obrigatório (min_select > 0) — mesmo critério do checkout. */
  required: boolean;
  /** Grupo cujo preço substitui o preço base (sabores). */
  replacesBase: boolean;
}

interface SelectedItem {
  /** product.id p/ item simples; product.id|assinatura p/ item com adicionais. */
  lineKey: string;
  product: PickerProduct;
  quantity: number;
  observations: string;
  addons: SelectedAddon[];
  /** Preço unitário final (base ou substituta + adicionais) — igual ao checkout. */
  unitPrice: number;
}

interface ProductAddonsEntry {
  groups: ProductAddonGroup[];
  items: ProductAddonItem[];
}

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const addonSignature = (addons: SelectedAddon[]) =>
  [...addons]
    .sort((a, b) => a.itemId.localeCompare(b.itemId))
    .map((a) => `${a.itemId}x${a.qty}`)
    .join(",");

/**
 * Preço unitário com adicionais, com a MESMA conta do ProductDetailModal
 * (checkout/PDV): base + Σ(adicional × qtd); grupo price_replaces_base troca
 * a base pela soma dos escolhidos — ou pelo MAIOR de cada grupo quando a
 * loja usa pizza_price_mode = "maior".
 */
function computeUnitPrice(
  product: PickerProduct,
  entry: ProductAddonsEntry | undefined,
  addons: SelectedAddon[],
  highestFlavor: boolean,
): number {
  const hasReplacingGroup = !!entry?.groups.some((g) => g.price_replaces_base);
  const replacing = addons.filter((a) => a.replacesBase);
  const normalTotal = sumMoney(
    addons.filter((a) => !a.replacesBase).map((a) => a.price * a.qty),
  );
  if (!hasReplacingGroup) return sumMoney([product.price, normalTotal]);
  if (replacing.length === 0) return normalTotal;
  if (highestFlavor) {
    const byGroup = new Map<string, number>();
    replacing.forEach((r) => {
      byGroup.set(r.groupId, Math.max(byGroup.get(r.groupId) ?? 0, r.price));
    });
    return sumMoney([...byGroup.values(), normalTotal]);
  }
  return sumMoney([sumMoney(replacing.map((r) => r.price * r.qty)), normalTotal]);
}

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
  // Editor de adicionais de UM item (novo ou edição de linha já escolhida)
  const [addonEditor, setAddonEditor] = useState<{
    product: PickerProduct;
    entry: ProductAddonsEntry;
    editingKey: string | null;
    sel: Record<string, number>;
    quantity: number;
    observations: string;
  } | null>(null);

  const highestFlavor = (storeSettings as any)?.pizza_price_mode === "maior";

  useEffect(() => {
    if (open) {
      setStep("picker");
      setSearch("");
      setSelected([]);
      setAddonEditor(null);
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

  // Grupos de adicionais por produto (vínculos + grupos diretos), uma
  // consulta só para o cardápio inteiro — mesma fonte do PDV/checkout.
  const { data: addonsByProduct } = useQuery({
    queryKey: ["manual-order-addons", storeId],
    queryFn: async () => {
      const map = new Map<string, ProductAddonsEntry>();
      const productIds = (products || []).map((p) => p.id);
      if (productIds.length === 0) return map;
      const [linksRes, directRes] = await Promise.all([
        (supabase as any)
          .from("product_addon_groups")
          .select("product_id, addon_group_id")
          .in("product_id", productIds),
        (supabase as any)
          .from("addon_groups")
          .select("id, product_id")
          .in("product_id", productIds),
      ]);
      const groupIds = new Set<string>();
      const productGroups = new Map<string, Set<string>>();
      const attach = (pid: string, gid: string) => {
        groupIds.add(gid);
        if (!productGroups.has(pid)) productGroups.set(pid, new Set());
        productGroups.get(pid)!.add(gid);
      };
      (linksRes.data || []).forEach((r: any) => attach(r.product_id, r.addon_group_id));
      (directRes.data || []).forEach((r: any) => attach(r.product_id, r.id));
      if (groupIds.size === 0) return map;
      const [groupsRes, itemsRes] = await Promise.all([
        supabase
          .from("addon_groups")
          .select("id, name, min_select, max_select, sort_order, price_replaces_base")
          .in("id", [...groupIds]),
        supabase
          .from("addon_items")
          .select("id, group_id, name, price, sort_order")
          .in("group_id", [...groupIds]),
      ]);
      const groupById = new Map(
        ((groupsRes.data || []) as ProductAddonGroup[]).map((g) => [
          g.id,
          { ...g, min_select: Number(g.min_select || 0), max_select: Number(g.max_select || 0) },
        ]),
      );
      const allItems = ((itemsRes.data || []) as ProductAddonItem[]).map((i) => ({
        ...i,
        price: Number(i.price || 0),
      }));
      productGroups.forEach((gids, pid) => {
        const groups = [...gids]
          .map((id) => groupById.get(id))
          .filter(Boolean)
          .sort((a, b) => (a!.sort_order || 0) - (b!.sort_order || 0)) as ProductAddonGroup[];
        if (groups.length === 0) return;
        const items = allItems
          .filter((i) => gids.has(i.group_id))
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        map.set(pid, { groups, items });
      });
      return map;
    },
    enabled: open && !!storeId && !!products && products.length > 0,
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    const list = products || [];
    const q = normalize(search.trim());
    if (!q) return list;
    return list.filter((p) => normalize(p.name).includes(q));
  }, [products, search]);

  const hasAddons = (id: string) => !!addonsByProduct?.get(id);

  /** Quantidade total de um produto somando todas as linhas (com/sem adicionais). */
  const qtyOf = (id: string) =>
    selected.filter((s) => s.product.id === id).reduce((acc, s) => acc + s.quantity, 0);

  /** Quantidade da linha simples (sem adicionais) de um produto. */
  const plainQtyOf = (id: string) =>
    selected.find((s) => s.lineKey === id)?.quantity || 0;

  const setLineQty = (lineKey: string, qty: number) => {
    setSelected((prev) =>
      qty <= 0
        ? prev.filter((s) => s.lineKey !== lineKey)
        : prev.map((s) => (s.lineKey === lineKey ? { ...s, quantity: qty } : s)),
    );
  };

  /** Adiciona 1 na linha simples do produto (produto sem adicionais). */
  const addPlain = (product: PickerProduct) => {
    setSelected((prev) => {
      const existing = prev.find((s) => s.lineKey === product.id);
      if (existing) {
        return prev.map((s) =>
          s.lineKey === product.id ? { ...s, quantity: s.quantity + 1 } : s,
        );
      }
      return [
        ...prev,
        { lineKey: product.id, product, quantity: 1, observations: "", addons: [], unitPrice: product.price },
      ];
    });
  };

  /** Insere uma linha (com adicionais); linha idêntica soma a quantidade. */
  const upsertLine = (line: SelectedItem, replaceKey?: string) => {
    setSelected((prev) => {
      const base = replaceKey ? prev.filter((s) => s.lineKey !== replaceKey) : prev;
      const existing = base.find((s) => s.lineKey === line.lineKey);
      if (existing) {
        return base.map((s) =>
          s.lineKey === line.lineKey ? { ...s, quantity: s.quantity + line.quantity } : s,
        );
      }
      return [...base, line];
    });
  };

  const setObs = (lineKey: string, observations: string) => {
    setSelected((prev) => prev.map((s) => (s.lineKey === lineKey ? { ...s, observations } : s)));
  };

  const openAddonEditor = (product: PickerProduct, line?: SelectedItem) => {
    const entry = addonsByProduct?.get(product.id);
    if (!entry) return;
    if (line) {
      const sel: Record<string, number> = {};
      line.addons.forEach((a) => { sel[a.itemId] = a.qty; });
      setAddonEditor({
        product, entry, editingKey: line.lineKey, sel,
        quantity: line.quantity, observations: line.observations,
      });
    } else {
      setAddonEditor({ product, entry, editingKey: null, sel: {}, quantity: 1, observations: "" });
    }
  };

  const subtotal = useMemo(
    () => sumMoney(selected.map((s) => s.unitPrice * s.quantity)),
    [selected]
  );

  const totalQty = useMemo(
    () => selected.reduce((acc, s) => acc + s.quantity, 0),
    [selected]
  );

  const cart: CartItem[] = useMemo(
    () =>
      selected.map((s) => ({
        id: s.product.id,
        name: s.product.name,
        price: s.unitPrice,
        basePrice: s.product.price,
        quantity: s.quantity,
        observations: s.observations.trim() || undefined,
        image_url: s.product.image_url ?? null,
        // Mesmo formato do checkout: uma entrada por unidade de adicional
        addons:
          s.addons.length > 0
            ? s.addons.flatMap((a) =>
                Array.from({ length: a.qty }, () => ({
                  name: a.name,
                  price: a.price,
                  required: a.required,
                  groupName: a.groupName,
                })),
              )
            : undefined,
      })),
    [selected]
  );

  // ── Editor de adicionais: derivações (mesmas regras do checkout) ──
  const editorAddons: SelectedAddon[] = useMemo(() => {
    if (!addonEditor) return [];
    const out: SelectedAddon[] = [];
    addonEditor.entry.groups.forEach((g) => {
      addonEditor.entry.items
        .filter((i) => i.group_id === g.id)
        .forEach((i) => {
          const qty = addonEditor.sel[i.id] || 0;
          if (qty > 0) {
            out.push({
              itemId: i.id,
              groupId: g.id,
              groupName: g.name,
              name: i.name,
              price: Number(i.price || 0),
              qty,
              required: g.min_select > 0,
              replacesBase: !!g.price_replaces_base,
            });
          }
        });
    });
    return out;
  }, [addonEditor]);

  const editorGroupTotal = (groupId: string) =>
    addonEditor
      ? addonEditor.entry.items
          .filter((i) => i.group_id === groupId)
          .reduce((acc, i) => acc + (addonEditor.sel[i.id] || 0), 0)
      : 0;

  const editorAllMinMet = addonEditor
    ? addonEditor.entry.groups.every(
        (g) => g.min_select <= 0 || editorGroupTotal(g.id) >= g.min_select,
      )
    : false;

  const editorUnitPrice = addonEditor
    ? computeUnitPrice(addonEditor.product, addonEditor.entry, editorAddons, highestFlavor)
    : 0;

  const setEditorAddonQty = (itemId: string, qty: number) => {
    setAddonEditor((prev) => {
      if (!prev) return prev;
      const sel = { ...prev.sel };
      if (qty <= 0) delete sel[itemId];
      else sel[itemId] = qty;
      return { ...prev, sel };
    });
  };

  const bumpEditorAddon = (group: ProductAddonGroup, itemId: string, delta: number) => {
    if (!addonEditor) return;
    const current = addonEditor.sel[itemId] || 0;
    if (delta > 0 && group.max_select === 1) {
      // Seleção única: marcar este item desmarca os outros do grupo
      setAddonEditor((prev) => {
        if (!prev) return prev;
        const sel = { ...prev.sel };
        prev.entry.items
          .filter((i) => i.group_id === group.id)
          .forEach((i) => { delete sel[i.id]; });
        sel[itemId] = 1;
        return { ...prev, sel };
      });
      return;
    }
    if (delta > 0) {
      const cap = group.max_select && group.max_select > 0 ? group.max_select : Infinity;
      if (editorGroupTotal(group.id) >= cap) return;
    }
    setEditorAddonQty(itemId, current + delta);
  };

  const confirmAddonEditor = () => {
    if (!addonEditor || !editorAllMinMet || editorUnitPrice <= 0) return;
    const line: SelectedItem = {
      lineKey:
        addonEditor.product.id +
        (editorAddons.length > 0 ? `|${addonSignature(editorAddons)}` : "|"),
      product: addonEditor.product,
      quantity: addonEditor.quantity,
      observations: addonEditor.observations,
      addons: editorAddons,
      unitPrice: editorUnitPrice,
    };
    upsertLine(line, addonEditor.editingKey || undefined);
    setAddonEditor(null);
  };

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
    <>
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
              Toque no + para adicionar. Se o produto tiver adicionais (bacon extra, borda, ponto da carne…), o + abre a escolha deles. Detalhe pedido pelo cliente vai na observação do item.
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
            <div className="sticky top-0 z-10 -mx-1 bg-background px-1 pb-1">
              <div className="space-y-2 rounded-2xl border-2 border-primary/40 bg-primary/5 p-3">
                <p className="flex items-center gap-2 text-sm font-black text-foreground">
                  <ShoppingCart className="h-4 w-4 text-primary" />
                  Itens do pedido
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-black text-primary-foreground">
                    {totalQty} {totalQty === 1 ? "item" : "itens"} no pedido
                  </span>
                </p>
                {selected.map((s) => (
                  <div key={s.lineKey} className="rounded-xl border border-primary/30 bg-background px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-foreground min-w-0 truncate">{s.product.name}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setLineQty(s.lineKey, s.quantity - 1)}
                          className="h-7 w-7 rounded-lg border border-border bg-background flex items-center justify-center active:scale-95"
                          aria-label="Diminuir"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="text-sm font-black w-5 text-center">{s.quantity}</span>
                        <button
                          type="button"
                          onClick={() => setLineQty(s.lineKey, s.quantity + 1)}
                          className="h-7 w-7 rounded-lg border border-border bg-background flex items-center justify-center active:scale-95"
                          aria-label="Aumentar"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <span className="text-sm font-bold w-20 text-right">{formatBRL(s.unitPrice * s.quantity)}</span>
                        {hasAddons(s.product.id) && (
                          <button
                            type="button"
                            onClick={() => openAddonEditor(s.product, s)}
                            className="h-7 w-7 rounded-lg border border-border bg-background text-primary flex items-center justify-center active:scale-95"
                            aria-label={`Editar adicionais de ${s.product.name}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setLineQty(s.lineKey, 0)}
                          className="h-7 w-7 rounded-lg border border-border bg-background text-muted-foreground flex items-center justify-center active:scale-95"
                          aria-label={`Remover ${s.product.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    {s.addons.length > 0 && (
                      <div className="mt-1.5 space-y-0.5">
                        {s.addons.map((a) => (
                          <p key={a.itemId} className="text-[11px] leading-snug text-muted-foreground">
                            + {a.qty > 1 ? `${a.qty}× ` : ""}{a.name}{" "}
                            <span className="text-muted-foreground/70">({a.groupName})</span>
                            {a.price > 0 && <> — {formatBRL(a.price * a.qty)}</>}
                          </p>
                        ))}
                        <p className="text-[11px] text-muted-foreground">
                          {formatBRL(s.unitPrice)} por unidade com adicionais
                        </p>
                      </div>
                    )}
                    <Input
                      value={s.observations}
                      onChange={(e) => setObs(s.lineKey, e.target.value)}
                      placeholder="Observação (ex.: sem cebola)"
                      className="mt-2 h-8 text-xs bg-background"
                    />
                  </div>
                ))}
              </div>
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
                const grouped = hasAddons(p.id);
                const qty = qtyOf(p.id);
                const plainQty = plainQtyOf(p.id);
                return (
                  <div key={p.id} className="flex items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{p.name}</p>
                      {grouped && (
                        <p className="text-[11px] font-semibold text-primary">tem adicionais — toque no + para escolher</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-bold text-muted-foreground">{formatBRL(p.price)}</span>
                      {grouped ? (
                        <>
                          {qty > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-xs font-black text-primary">
                              <ShoppingCart className="h-3.5 w-3.5" /> {qty}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => openAddonEditor(p)}
                            className="h-8 w-8 rounded-lg border border-primary text-primary flex items-center justify-center active:scale-95"
                            aria-label={`Adicionar ${p.name} com adicionais`}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </>
                      ) : plainQty === 0 ? (
                        <button
                          type="button"
                          onClick={() => addPlain(p)}
                          className="h-8 w-8 rounded-lg border border-primary text-primary flex items-center justify-center active:scale-95"
                          aria-label={`Adicionar ${p.name}`}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setLineQty(p.id, plainQty - 1)}
                            className="h-8 w-8 rounded-lg border border-border bg-background flex items-center justify-center active:scale-95"
                            aria-label={`Diminuir ${p.name}`}
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="w-5 text-center text-sm font-black text-primary">{plainQty}</span>
                          <button
                            type="button"
                            onClick={() => addPlain(p)}
                            className="h-8 w-8 rounded-lg border border-primary text-primary flex items-center justify-center active:scale-95"
                            aria-label={`Aumentar ${p.name}`}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
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
            <div>
              <p className="text-xs font-bold text-primary">
                {totalQty > 0 ? `${totalQty} ${totalQty === 1 ? "item" : "itens"} no pedido` : "Nenhum item escolhido ainda"}
              </p>
              <p className="text-sm text-muted-foreground">
                Total até agora: <span className="text-base font-black text-foreground">{formatBRL(subtotal)}</span>
              </p>
            </div>
            <Button onClick={() => setStep("form")} disabled={selected.length === 0}>
              Continuar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* ── Seletor de adicionais do item (grupos vinculados ao produto) ── */}
    {addonEditor && (
      <Dialog open={!!addonEditor} onOpenChange={(o) => !o && setAddonEditor(null)}>
        <DialogContent className="flex max-h-[92dvh] w-[94vw] max-w-lg flex-col gap-0 overflow-hidden rounded-2xl p-0">
          <div className="border-b border-border px-4 py-3">
            <DialogHeader>
              <DialogTitle className="text-base">{addonEditor.product.name}</DialogTitle>
              <p className="text-xs text-muted-foreground">Escolha os adicionais deste item</p>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3">
            <div className="space-y-5">
              {addonEditor.entry.groups.map((g) => {
                const total = editorGroupTotal(g.id);
                const met = g.min_select <= 0 || total >= g.min_select;
                const cap = g.max_select && g.max_select > 0 ? g.max_select : Infinity;
                return (
                  <section key={g.id} className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-bold text-foreground">{g.name}</h4>
                      {g.min_select > 0 ? (
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${met ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                          {met ? "Selecionado" : `Escolha ${g.min_select}`}
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                          Opcional{g.max_select > 1 ? ` · máximo ${g.max_select}` : ""}
                        </span>
                      )}
                    </div>
                    {g.price_replaces_base && (
                      <p className="text-[11px] text-muted-foreground">
                        O preço da opção escolhida substitui o preço base do produto.
                      </p>
                    )}
                    <div className="divide-y divide-border/60">
                      {addonEditor.entry.items
                        .filter((i) => i.group_id === g.id)
                        .map((item) => {
                          const qty = addonEditor.sel[item.id] || 0;
                          return (
                            <div key={item.id} className="flex items-center justify-between gap-2 py-2">
                              <p className="text-sm text-foreground min-w-0 truncate">{item.name}</p>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs font-bold text-muted-foreground">
                                  {g.price_replaces_base
                                    ? formatBRL(item.price)
                                    : item.price > 0
                                      ? `+ ${formatBRL(item.price)}`
                                      : "sem custo"}
                                </span>
                                {g.max_select === 1 ? (
                                  <button
                                    type="button"
                                    onClick={() => (qty > 0 ? setEditorAddonQty(item.id, 0) : bumpEditorAddon(g, item.id, 1))}
                                    className={`h-7 w-7 rounded-lg border flex items-center justify-center active:scale-95 ${qty > 0 ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-transparent"}`}
                                    aria-label={`Selecionar ${item.name}`}
                                  >
                                    <Check className="h-4 w-4" />
                                  </button>
                                ) : qty === 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => bumpEditorAddon(g, item.id, 1)}
                                    disabled={total >= cap}
                                    className="h-7 w-7 rounded-lg border border-primary text-primary flex items-center justify-center active:scale-95 disabled:opacity-40"
                                    aria-label={`Adicionar ${item.name}`}
                                  >
                                    <Plus className="h-4 w-4" />
                                  </button>
                                ) : (
                                  <span className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => bumpEditorAddon(g, item.id, -1)}
                                      className="h-7 w-7 rounded-lg border border-border bg-background flex items-center justify-center active:scale-95"
                                      aria-label={`Diminuir ${item.name}`}
                                    >
                                      <Minus className="h-3.5 w-3.5" />
                                    </button>
                                    <span className="w-4 text-center text-sm font-black text-primary">{qty}</span>
                                    <button
                                      type="button"
                                      onClick={() => bumpEditorAddon(g, item.id, 1)}
                                      disabled={total >= cap}
                                      className="h-7 w-7 rounded-lg border border-primary text-primary flex items-center justify-center active:scale-95 disabled:opacity-40"
                                      aria-label={`Aumentar ${item.name}`}
                                    >
                                      <Plus className="h-3.5 w-3.5" />
                                    </button>
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </section>
                );
              })}

              <div>
                <p className="mb-1 text-xs font-bold text-foreground">Observação do item</p>
                <Input
                  value={addonEditor.observations}
                  onChange={(e) =>
                    setAddonEditor((prev) => (prev ? { ...prev, observations: e.target.value } : prev))
                  }
                  placeholder="Ex.: sem cebola"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-border bg-background px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    setAddonEditor((prev) => (prev ? { ...prev, quantity: Math.max(1, prev.quantity - 1) } : prev))
                  }
                  className="h-8 w-8 rounded-lg border border-border bg-background flex items-center justify-center active:scale-95"
                  aria-label="Diminuir quantidade"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-5 text-center text-sm font-black">{addonEditor.quantity}</span>
                <button
                  type="button"
                  onClick={() =>
                    setAddonEditor((prev) => (prev ? { ...prev, quantity: prev.quantity + 1 } : prev))
                  }
                  className="h-8 w-8 rounded-lg border border-primary text-primary flex items-center justify-center active:scale-95"
                  aria-label="Aumentar quantidade"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </span>
              <p className="text-xs text-muted-foreground text-right">
                Total do item
                <span className="block text-base font-black text-foreground">
                  {formatBRL(editorUnitPrice * addonEditor.quantity)}
                </span>
              </p>
              <Button onClick={confirmAddonEditor} disabled={!editorAllMinMet || editorUnitPrice <= 0} className="shrink-0">
                {addonEditor.editingKey ? "Salvar alterações" : "Adicionar ao pedido"}
              </Button>
            </div>
            {!editorAllMinMet && (
              <p className="mt-2 text-center text-[11px] font-semibold text-destructive">
                Falta escolher os itens obrigatórios marcados acima.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    )}
    </>
  );
}
