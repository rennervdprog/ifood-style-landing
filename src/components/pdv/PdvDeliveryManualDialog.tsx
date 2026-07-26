import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, MapPin, Search, Truck, User, Phone, Lock, ShoppingCart, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, addMoney } from "@/lib/utils";
import { fetchCep, formatCep } from "@/lib/location";
import { calculateStoreOwnDeliveryFee, DEFAULT_DELIVERY_FEE_CONFIG } from "@/lib/deliveryFee";
import { useStorePlan } from "@/hooks/useStorePlan";
import { printPdvReceipt } from "@/lib/thermalPrint";
import type { CartItem } from "@/pages/pdv/types";

interface Props {
  open: boolean;
  onClose: () => void;
  storeId: string;
  storeName?: string | null;
  storeSettings?: Record<string, any> | null;
  cart: CartItem[];
  subtotal: number;
  discountAmount: number;
  onSuccess: () => void;
}

function genPin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function formatPhoneBR(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function PdvDeliveryManualDialog({
  open, onClose, storeId, storeName, storeSettings, cart, subtotal, discountAmount, onSuccess,
}: Props) {
  const queryClient = useQueryClient();
  const storePlan = useStorePlan(storeId);

  // ── Form ──
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState(genPin());
  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [complement, setComplement] = useState("");
  const [reference, setReference] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("dinheiro");
  const [changeFor, setChangeFor] = useState("");

  const [loadingCep, setLoadingCep] = useState(false);
  const [fee, setFee] = useState<number | null>(null);
  const [feeBreakdown, setFeeBreakdown] = useState<string | null>(null);
  const [calcFee, setCalcFee] = useState(false);
  const [manualFee, setManualFee] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Reset ao abrir
  useEffect(() => {
    if (open) {
      setName(""); setPhone(""); setPin(genPin());
      setCep(""); setStreet(""); setNumber(""); setNeighborhood("");
      setComplement(""); setReference("");
      setPaymentMethod("dinheiro"); setChangeFor("");
      setFee(null); setFeeBreakdown(null); setManualFee("");
    }
  }, [open]);

  // Busca dados da loja (config de entrega)
  const { data: storeFull } = useQuery({
    queryKey: ["pdv-manual-store", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("stores")
        .select("id, name, address_cep, latitude, longitude, delivery_mode, own_delivery_fee, delivery_fee_type, delivery_base_km, delivery_fee_base, delivery_fee_per_km, settings")
        .eq("id", storeId)
        .maybeSingle();
      return data;
    },
    enabled: open && !!storeId,
    staleTime: 60_000,
  });

  const handleCepChange = (v: string) => {
    const formatted = formatCep(v);
    setCep(formatted);
    const digits = v.replace(/\D/g, "");
    if (digits.length === 8) handleCepLookup(digits);
  };

  const handleCepLookup = async (digits?: string) => {
    const d = digits || cep.replace(/\D/g, "");
    if (d.length !== 8) {
      toast.error("CEP inválido."); return;
    }
    setLoadingCep(true);
    try {
      const r = await fetchCep(d);
      if (!r) { toast.error("CEP não encontrado."); return; }
      if (r.logradouro) setStreet(r.logradouro);
      if (r.bairro) setNeighborhood(r.bairro);
      if (r.complemento && !complement) setComplement(r.complemento);
    } catch {
      toast.error("Erro ao buscar CEP.");
    } finally {
      setLoadingCep(false);
    }
  };

  // Recalcula a taxa quando temos CEP e dados da loja
  useEffect(() => {
    const customerCep = cep.replace(/\D/g, "");
    if (!open || !storeFull) {
      return;
    }
    const s: any = storeFull;
    const isOwn = s.delivery_mode === "own";
    const storeCep = (s.address_cep || "").replace(/\D/g, "");

    // Fallback: loja sem CEP, ou cliente sem CEP, ou modo fixo → usa own_delivery_fee diretamente
    const isFixedMode = (s.delivery_fee_type || "fixed") === "fixed";
    if (!storeCep || customerCep.length !== 8 || (isOwn && isFixedMode)) {
      if (isOwn) {
        const fixed = Number(s.own_delivery_fee || 0);
        setFee(fixed);
        setFeeBreakdown(
          fixed > 0
            ? `Taxa fixa da loja: ${formatBRL(fixed)}`
            : "Loja sem taxa configurada — defina manualmente abaixo.",
        );
      } else {
        const cfg = DEFAULT_DELIVERY_FEE_CONFIG;
        setFee(cfg.city_fee || 0);
        setFeeBreakdown(`Entrega plataforma: ${formatBRL(cfg.city_fee || 0)}`);
      }
      setCalcFee(false);
      return;
    }

    let cancelled = false;
    setCalcFee(true);

    // Opção C: cobra apenas a taxa de entrega (com platform split).
    // Para lojas no plano fixo (sem comissão), platformDeliverySplit pode ser 0,
    // mas garantimos pelo menos o split do customerExtra padrão.
    const platformSplit = isOwn
      ? (storePlan.platformFeeCustomerExtra ?? (storePlan.platformDeliverySplit > 0 ? storePlan.platformDeliverySplit : 2))
      : (storePlan.platformDeliverySplit ?? 2);

    if (isOwn) {
      const ownConfig = {
        delivery_fee_type: (s.delivery_fee_type || "fixed") as "fixed" | "km",
        delivery_base_km: Number(s.delivery_base_km || 0),
        delivery_fee_base: Number(s.delivery_fee_base || 0),
        delivery_fee_per_km: Number(s.delivery_fee_per_km || 0),
        own_delivery_fee: Number(s.own_delivery_fee || 0),
        platform_split: platformSplit,
        customer_street: street,
        customer_number: number,
        customer_neighborhood: neighborhood,
        customer_coords: null,
        store_coords: s.latitude && s.longitude ? { lat: Number(s.latitude), lng: Number(s.longitude) } : null,
      };
      calculateStoreOwnDeliveryFee(customerCep, storeCep, ownConfig)
        .then((r) => { if (!cancelled) { setFee(r.fee); setFeeBreakdown(r.breakdown); } })
        .catch(() => { if (!cancelled) { setFee(null); setFeeBreakdown("Erro ao calcular taxa."); } })
        .finally(() => { if (!cancelled) setCalcFee(false); });
    } else {
      // Loja usa plataforma: usamos fee city padrão. Lojista pode ajustar manual.
      const cfg = DEFAULT_DELIVERY_FEE_CONFIG;
      setFee(cfg.city_fee || 0);
      setFeeBreakdown(`Entrega plataforma: ${formatBRL(cfg.city_fee || 0)}`);
      setCalcFee(false);
    }

    return () => { cancelled = true; };
  }, [cep, street, number, neighborhood, storeFull, open, storePlan.platformFeeCustomerExtra, storePlan.platformDeliverySplit]);

  // Permite override manual da taxa (lojista pode digitar)
  const manualFeeNum = manualFee.trim() ? Number(manualFee.replace(",", ".")) : null;
  const deliveryFee = manualFeeNum !== null && !Number.isNaN(manualFeeNum) ? manualFeeNum : (fee ?? 0);
  const finalTotal = Math.max(0, addMoney(subtotal, deliveryFee, -discountAmount));

  const canSave = useMemo(() => {
    return (
      cart.length > 0 &&
      name.trim().length >= 2 &&
      street.trim().length > 0 &&
      number.trim().length > 0 &&
      pin.length === 4
    );
  }, [cart.length, name, street, number, pin]);

  const handleConfirm = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const addressParts = [street, number];
      if (complement) addressParts.push(complement);
      if (reference) addressParts.push(`Ref: ${reference}`);
      const address = addressParts.join(", ");
      const needsChange = paymentMethod === "dinheiro" && changeFor.trim().length > 0;
      const changeValue = needsChange ? Number(changeFor.replace(",", ".")) : 0;

      const { data: order, error: oe } = await supabase
        .from("orders")
        .insert({
          store_id: storeId,
          client_id: null,
          order_source: "manual",
          subtotal,
          delivery_fee: deliveryFee,
          pdv_discount: discountAmount,
          commission_rate: 0, // Opção C: sem comissão em pedidos manuais
          total_price: finalTotal,
          app_fee: 0,
          payment_method: paymentMethod,
          neighborhood,
          address_details: address,
          needs_change: needsChange,
          change_for: changeValue,
          status: "preparando",
          delivery_pin: pin,
          metadata: {
            manual_customer: {
              name: name.trim(),
              phone: phone.trim() || null,
              pin,
            },
          },
        } as any)
        .select("id")
        .single();
      if (oe) throw oe;

      await supabase.from("order_items").insert(
        cart.map((item) => ({
          order_id: order.id,
          product_id: item.id,
          quantity: item.quantity,
          unit_price: item.price,
          addons: item.addons && item.addons.length > 0 ? JSON.stringify(item.addons) : null,
          observations: item.observations || null,
          metadata: item.metadata && Object.keys(item.metadata).length > 0 ? item.metadata : null,
        })) as any,
      );

      queryClient.invalidateQueries({ queryKey: ["store-orders", storeId] });

      // Impressão térmica — best-effort
      try {
        printPdvReceipt(
          {
            id: order.id,
            created_at: new Date().toISOString(),
            subtotal,
            pdv_discount: discountAmount,
            total_price: finalTotal,
            payment_method: paymentMethod,
            table_identifier: `DELIVERY MANUAL · PIN ${pin}`,
            address_details: `${name}${phone ? ` (${phone})` : ""} — ${address} · ${neighborhood}`,
            order_items: cart.map((item) => ({
              quantity: item.quantity,
              unit_price: item.price,
              products: { name: item.name },
              metadata: item.metadata || null,
            })),
          } as any,
          storeName || "Loja",
          {
            copies: (storeSettings as any)?.print_copies === 1 ? 1 : 2,
            paperWidth: (storeSettings as any)?.print_paper_width === 58 ? 58 : 80,
          },
        );
      } catch (e) {
        console.warn("Erro ao imprimir:", e);
      }

      toast.success(`✅ Pedido manual criado! PIN: ${pin}`);
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erro ao criar pedido manual.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            Pedido Delivery Manual
          </DialogTitle>
        </DialogHeader>

        {cart.length === 0 ? (
          <div className="py-6 space-y-4">
            {/* Stepper */}
            <div className="flex items-center justify-center gap-2 text-xs font-semibold">
              <span className="flex items-center gap-1 text-primary">
                <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">1</span>
                Selecionar itens
              </span>
              <span className="h-px w-8 bg-border" />
              <span className="flex items-center gap-1 text-muted-foreground">
                <span className="h-6 w-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center">2</span>
                Dados do cliente
              </span>
            </div>
            <div className="rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-5 text-center space-y-3">
              <ShoppingCart className="h-10 w-10 text-primary mx-auto" />
              <div>
                <p className="text-sm font-bold text-foreground">Passo 1 · Adicione os produtos</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Feche este aviso, toque nos produtos que o cliente pediu e depois volte aqui para preencher nome, endereço e PIN.
                </p>
              </div>
              <Button onClick={onClose} className="w-full">
                Selecionar itens no PDV
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Stepper */}
            <div className="flex items-center justify-center gap-2 text-xs font-semibold">
              <span className="flex items-center gap-1 text-success">
                <CheckCircle2 className="h-4 w-4" />
                {cart.length} {cart.length === 1 ? "item" : "itens"}
              </span>
              <span className="h-px w-8 bg-border" />
              <span className="flex items-center gap-1 text-primary">
                <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">2</span>
                Dados do cliente
              </span>
            </div>
          </div>
        )}
        {cart.length > 0 && (
          <div className="space-y-5">
            {/* Cliente */}
            <section className="space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <User className="h-4 w-4" /> Dados do cliente
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Nome *</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Dona Maria" />
                </div>
                <div>
                  <Label className="flex items-center gap-1"><Phone className="h-3 w-3" /> WhatsApp</Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(formatPhoneBR(e.target.value))}
                    placeholder="(14) 99999-9999"
                    inputMode="tel"
                    maxLength={16}
                  />
                </div>
                <div>
                  <Label className="flex items-center gap-1"><Lock className="h-3 w-3" /> PIN do cliente *</Label>
                  <div className="flex gap-2">
                    <Input
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      maxLength={4}
                      className="font-mono text-center text-lg tracking-widest"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={() => setPin(genPin())}>
                      Gerar
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Informe este PIN ao cliente — o motoboy vai confirmar na entrega.
                  </p>
                </div>
              </div>
            </section>

            {/* Endereço */}
            <section className="space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Endereço de entrega
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <Label>CEP <span className="text-muted-foreground text-[10px]">(opcional)</span></Label>
                  <div className="flex gap-2">
                    <Input
                      value={cep}
                      onChange={(e) => handleCepChange(e.target.value)}
                      placeholder="00000-000"
                      maxLength={9}
                    />
                    <Button type="button" variant="outline" size="icon" onClick={() => handleCepLookup()} disabled={loadingCep}>
                      {loadingCep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <Label>Rua *</Label>
                  <Input value={street} onChange={(e) => setStreet(e.target.value)} />
                </div>
                <div>
                  <Label>Número *</Label>
                  <Input value={number} onChange={(e) => setNumber(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Bairro</Label>
                  <Input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} />
                </div>
                <div className="sm:col-span-1">
                  <Label>Complemento</Label>
                  <Input value={complement} onChange={(e) => setComplement(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Ponto de referência</Label>
                  <Input value={reference} onChange={(e) => setReference(e.target.value)} />
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Taxa de entrega calculada</span>
                  <span className="font-bold">
                    {calcFee ? <Loader2 className="h-4 w-4 animate-spin inline" /> : fee !== null ? formatBRL(fee) : "—"}
                  </span>
                </div>
                {feeBreakdown && (
                  <p className="text-[11px] text-muted-foreground mt-1">{feeBreakdown}</p>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <Label className="text-[11px] text-muted-foreground whitespace-nowrap">Ajustar taxa (R$)</Label>
                  <Input
                    value={manualFee}
                    onChange={(e) => setManualFee(e.target.value)}
                    placeholder={fee !== null ? fee.toFixed(2) : "0.00"}
                    inputMode="decimal"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </section>

            {/* Pagamento */}
            <section className="space-y-3">
              <h3 className="text-sm font-bold">Pagamento na entrega</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: "dinheiro", label: "Dinheiro" },
                  { id: "cartao_credito", label: "Crédito" },
                  { id: "cartao_debito", label: "Débito" },
                  { id: "pix_machine", label: "PIX maquininha" },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id)}
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                      paymentMethod === m.id
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card border-border hover:bg-muted"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              {paymentMethod === "dinheiro" && (
                <div>
                  <Label>Troco para (opcional)</Label>
                  <Input
                    value={changeFor}
                    onChange={(e) => setChangeFor(e.target.value)}
                    placeholder="Ex.: 50.00"
                    inputMode="decimal"
                  />
                </div>
              )}
            </section>

            {/* Resumo */}
            <section className="rounded-xl border border-border bg-card p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal ({cart.length} {cart.length === 1 ? "item" : "itens"})</span>
                <span>{formatBRL(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-success">
                  <span>Desconto</span>
                  <span>− {formatBRL(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Entrega</span>
                <span>{formatBRL(deliveryFee)}</span>
              </div>
              <div className="flex justify-between font-bold text-base pt-1 border-t border-border">
                <span>Total</span>
                <span>{formatBRL(finalTotal)}</span>
              </div>
            </section>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={onClose} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={handleConfirm} disabled={!canSave || saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Truck className="h-4 w-4 mr-2" />}
                Criar pedido manual
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default PdvDeliveryManualDialog;