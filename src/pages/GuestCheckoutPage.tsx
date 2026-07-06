// Checkout guest (sem login) — piloto Itatinga.
// Chama a edge function `guest-checkout` no Supabase externo.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";
import { ArrowLeft, MapPin, CreditCard, Banknote, QrCode, Search, Loader2, ShoppingBag, MessageCircle, Truck, Store, CheckCircle2, User } from "lucide-react";
import { formatCep, fetchCep } from "@/lib/location";
import { maskWhatsApp } from "@/lib/whatsapp";
import { formatBRL, addMoney } from "@/lib/utils";
import { calculateStoreOwnDeliveryFee, calculateDeliveryFee, DEFAULT_DELIVERY_FEE_CONFIG, type DeliveryFeeConfig } from "@/lib/deliveryFee";

const PAY_METHODS = [
  { id: "pix_machine", label: "PIX na maquininha", icon: QrCode },
  { id: "cartao",      label: "Cartão na entrega", icon: CreditCard },
  { id: "dinheiro",    label: "Dinheiro",           icon: Banknote },
];

const GuestCheckoutPage = () => {
  const navigate = useNavigate();
  const { items, subtotal, clearCart } = useCart();
  const storeId = items[0]?.store_id;

  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [lookedUp, setLookedUp] = useState(false);
  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [reference, setReference] = useState("");
  const [payment, setPayment] = useState("");
  const [needsChange, setNeedsChange] = useState(false);
  const [changeFor, setChangeFor] = useState("");
  const [loadingCep, setLoadingCep] = useState(false);
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [consent, setConsent] = useState(true);
  const [isPickup, setIsPickup] = useState(false);

  // Guarda: sem itens ou loja não habilitada -> volta
  useEffect(() => {
    if (items.length === 0) navigate("/carrinho", { replace: true });
  }, [items.length, navigate]);

  const { data: store } = useQuery({
    queryKey: ["guest-store", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("stores")
        .select("id, name, address_city, minimum_order_value, own_delivery_fee, delivery_mode, delivery_fee_type, delivery_base_km, delivery_fee_base, delivery_fee_per_km, address_cep, latitude, longitude, free_delivery_threshold, guest_checkout_enabled")
        .eq("id", storeId!).maybeSingle();
      return (data as any) || null;
    },
    enabled: !!storeId,
    staleTime: 1000 * 60 * 5,
  });

  // Loja sem guest habilitado → manda pro fluxo com login
  useEffect(() => {
    if (store && (store as any).guest_checkout_enabled !== true) {
      navigate("/auth", { state: { from: "/checkout" }, replace: true });
    }
  }, [store, navigate]);

  // Split efetivo da plataforma para esta loja (respeita override do plano).
  // Guest (anon) não tem acesso a store_plans/admin_settings via RLS, então
  // usamos uma RPC SECURITY DEFINER dedicada.
  const { data: platformInfo } = useQuery({
    queryKey: ["guest-platform-split", storeId],
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("get_store_platform_split", { _store_id: storeId });
      const row = Array.isArray(data) ? data[0] : data;
      return row as {
        plan_type: string | null;
        platform_delivery_split_override: number | null;
        platform_fee_split: "cliente" | "meio_a_meio" | "lojista" | null;
        delivery_mode: string | null;
      } | null;
    },
    enabled: !!storeId,
    staleTime: 1000 * 60 * 5,
  });

  const [calculatedFee, setCalculatedFee] = useState<number | null>(null);
  const [calculatingFee, setCalculatingFee] = useState(false);

  const isOwnDelivery = ((store as any)?.delivery_mode || "platform") === "own";
  // Anon não tem RLS em admin_settings; usamos default e cobrimos platform_split
  // via RPC get_store_platform_split (respeita override do lojista).
  const config = DEFAULT_DELIVERY_FEE_CONFIG;
  // Split efetivo: override do plano da loja > default (2). Autonomia = 0.
  const isAutonomy = platformInfo?.plan_type === "autonomy";
  const baseSplit = isAutonomy
    ? 0
    : (Number(platformInfo?.platform_delivery_split_override ?? 2));
  const splitMode = (platformInfo?.platform_fee_split || "cliente") as "cliente" | "meio_a_meio" | "lojista";
  const platformCustomerExtra = isOwnDelivery
    ? (splitMode === "lojista"
        ? 0
        : splitMode === "meio_a_meio"
          ? Math.round((baseSplit / 2) * 100) / 100
          : baseSplit)
    : 0;

  // Fee: mesma lógica do checkout normal
  //  - entrega própria (own): calculateStoreOwnDeliveryFee (fixa OU km) + platformCustomerExtra
  //  - entrega da plataforma: calculateDeliveryFee (config global city_fee / rural)
  // Debounce dos inputs de endereço pra não geocodificar/rotear a cada tecla.
  const [debouncedAddr, setDebouncedAddr] = useState({ cep, street, number, neighborhood });
  useEffect(() => {
    const t = setTimeout(() => setDebouncedAddr({ cep, street, number, neighborhood }), 400);
    return () => clearTimeout(t);
  }, [cep, street, number, neighborhood]);

  useEffect(() => {
    const s: any = store;
    if (!s) return;
    if (isPickup) { setCalculatedFee(0); setCalculatingFee(false); return; }
    const customerCep = debouncedAddr.cep.replace(/\D/g, "");
    const storeCep = (s.address_cep || "").replace(/\D/g, "");
    let cancelled = false;
    setCalculatingFee(true);
    const promise = isOwnDelivery
      ? (() => {
          const feeType = (s.delivery_fee_type as "fixed" | "km") || "fixed";
          if (feeType === "km" && (!customerCep || !debouncedAddr.street.trim())) {
            return Promise.resolve<{ fee: number } | null>(null);
          }
          return calculateStoreOwnDeliveryFee(customerCep, storeCep, {
            delivery_fee_type: feeType,
            delivery_base_km: Number(s.delivery_base_km || 0),
            delivery_fee_base: Number(s.delivery_fee_base || 0),
            delivery_fee_per_km: Number(s.delivery_fee_per_km || 0),
            own_delivery_fee: Number(s.own_delivery_fee || 0),
            platform_split: platformCustomerExtra,
            customer_street: debouncedAddr.street || null,
            customer_number: debouncedAddr.number || null,
            customer_neighborhood: debouncedAddr.neighborhood || null,
            store_coords: s.latitude && s.longitude ? { lat: Number(s.latitude), lng: Number(s.longitude) } : null,
          });
        })()
      : (customerCep
          ? calculateDeliveryFee(customerCep, storeCep, config)
          : Promise.resolve<{ fee: number } | null>(null));
    Promise.resolve(promise)
      .then((r) => { if (!cancelled) setCalculatedFee(r ? r.fee : null); })
      .catch(() => { if (!cancelled) setCalculatedFee(null); })
      .finally(() => { if (!cancelled) setCalculatingFee(false); });
    return () => { cancelled = true; };
  }, [store, debouncedAddr, platformCustomerExtra, isOwnDelivery, config, isPickup]);

  // Frete grátis por valor mínimo (loja absorve) — igual checkout normal
  const storeFreeThreshold = Number((store as any)?.free_delivery_threshold || 0);
  const freeDeliveryByThreshold = !isPickup && storeFreeThreshold > 0 && subtotal >= storeFreeThreshold;
  const matchedFee = isPickup ? 0 : (freeDeliveryByThreshold ? 0 : (calculatedFee ?? 0));

  const total = useMemo(() => addMoney(subtotal, matchedFee), [subtotal, matchedFee]);

  const handleCepChange = (v: string) => {
    const formatted = formatCep(v);
    setCep(formatted);
    const digits = v.replace(/\D/g, "");
    if (digits.length === 8) handleCepLookup(digits);
  };

  const handleCepLookup = async (digits?: string) => {
    const d = digits || cep.replace(/\D/g, "");
    if (d.length !== 8) return;
    setLoadingCep(true);
    try {
      const r = await fetchCep(d);
      if (!r) { toast.error("CEP não encontrado."); return; }
      if (r.logradouro) setStreet(r.logradouro);
      if (r.bairro) setNeighborhood(r.bairro);
    } finally { setLoadingCep(false); }
  };

  const handlePhoneBlur = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10 || !storeId) return;
    setLoadingLookup(true);
    try {
      const { data, error } = await supabase.functions.invoke("guest-lookup", {
        body: { phone: digits, store_id: storeId },
      });
      if (error) return;
      if ((data as any)?.found) {
        setLookedUp(true);
        if ((data as any).name && !name) setName((data as any).name);
        const a = (data as any).lastAddress;
        if (a && !street) {
          setCep(a.cep ? formatCep(a.cep) : "");
          setStreet(a.street || "");
          setNumber(a.number || "");
          setComplement(a.complement || "");
          setNeighborhood(a.neighborhood || "");
          setReference(a.reference_point || "");
          toast.success(`Bem-vindo(a) de volta${(data as any).name ? `, ${(data as any).name}` : ""}!`);
        }
      }
    } finally { setLoadingLookup(false); }
  };

  const handleConfirm = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) { toast.error("Informe um WhatsApp válido."); return; }
    if (!name.trim() || name.trim().length < 2) { toast.error("Informe seu nome."); return; }
    if (!isPickup && (!street.trim() || !number.trim() || !neighborhood.trim())) {
      toast.error("Preencha rua, número e bairro."); return;
    }
    if (!payment) { toast.error("Escolha a forma de pagamento."); return; }
    if (!consent) { toast.error("Aceite os termos para continuar."); return; }
    if (payment === "dinheiro" && needsChange && !changeFor) {
      toast.error("Informe o valor do troco."); return;
    }

    setSubmitting(true);
    try {
      const payload = {
        phone: digits,
        name: name.trim(),
        store_id: storeId,
        items: items.map((it) => ({
          product_id: it.id,
          quantity: it.quantity,
          unit_price: it.price,
          addons: it.addons && it.addons.length > 0 ? it.addons : null,
          observations: it.observations || null,
        })),
        subtotal,
        delivery_fee: matchedFee,
        total_price: total,
        commission_rate: 0,
        payment_method: payment,
        neighborhood: isPickup ? "RETIRADA" : neighborhood.trim(),
        address: isPickup ? null : {
          label: "Casa",
          cep: cep.replace(/\D/g, "") || null,
          street: street.trim(),
          number: number.trim(),
          complement: complement.trim() || null,
          reference_point: reference.trim() || null,
        },
        is_pickup: isPickup,
        needs_change: payment === "dinheiro" && needsChange,
        change_for: payment === "dinheiro" && needsChange ? Number(String(changeFor).replace(",", ".")) : 0,
        scheduled_for: null,
        consent: true,
      };
      const { data, error } = await supabase.functions.invoke("guest-checkout", { body: payload });
      if (error) throw error;
      const res = data as any;
      if (!res?.ok) throw new Error(res?.error || "Falha ao criar pedido");
      clearCart();
      // Lazy-load canvas-confetti só no sucesso (economiza ~7 KB gzip no bundle inicial)
      import("canvas-confetti").then(({ default: confetti }) => {
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.7 } });
      }).catch(() => {});
      toast.success("Pedido enviado!");
      navigate(`/p/${res.order_id}?t=${res.phone_last4}`, {
        replace: true,
        state: { delivery_pin: res.delivery_pin || null },
      });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao finalizar pedido.");
    } finally { setSubmitting(false); }
  };

  if (!storeId || !items.length) return null;

  const guestEnabled = (store as any)?.guest_checkout_enabled === true;

  const contactOk = phone.replace(/\D/g, "").length >= 10 && name.trim().length >= 2;
  const addressOk = isPickup || (!!street.trim() && !!number.trim() && !!neighborhood.trim());
  const stepsDone = [contactOk, addressOk, !!payment];
  const stepLabels = ["Contato", isPickup ? "Retirada" : "Endereço", "Pagamento"];

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-40 bg-card border-b border-border h-14 flex items-center px-4 gap-3">
        <button onClick={() => navigate(-1)} className="p-1 -ml-1"><ArrowLeft className="h-5 w-5" /></button>
        <h1 className="text-base font-bold">Finalizar pedido</h1>
      </header>

      {/* Progress steps — igual ao checkout normal */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-1.5">
          {stepLabels.map((step, i) => {
            const done = stepsDone[i];
            const active = !done && stepsDone.slice(0, i).every(Boolean);
            return (
              <div key={step} className="flex-1">
                <div className="flex items-center gap-1.5">
                  <div
                    className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 transition-all ${
                      done
                        ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                        : active
                          ? "bg-primary/15 text-primary ring-2 ring-primary/40"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                  </div>
                  {i < stepLabels.length - 1 && (
                    <div className={`flex-1 h-0.5 rounded-full transition-all ${done ? "bg-primary" : "bg-muted"}`} />
                  )}
                </div>
                <p className={`text-[10px] mt-1.5 font-bold ${done || active ? "text-foreground" : "text-muted-foreground"}`}>{step}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-4 py-2 space-y-4">
        {/* SECTION: Tipo de pedido (Entrega x Retirada) */}
        <section className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/50">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <Truck className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-sm font-bold text-foreground">Tipo de pedido</h2>
          </div>
          <div className="p-4">
            <div className="flex gap-2">
              <button
                onClick={() => setIsPickup(false)}
                className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  !isPickup ? "border-primary bg-primary/5" : "border-transparent bg-muted/50"
                }`}
              >
                <Truck className={`h-6 w-6 ${!isPickup ? "text-primary" : "text-muted-foreground"}`} />
                <div className="text-center">
                  <span className={`text-sm font-bold block ${!isPickup ? "text-primary" : "text-foreground"}`}>Entrega</span>
                  <span className="text-[10px] text-muted-foreground">Receba em casa</span>
                </div>
              </button>
              <button
                onClick={() => setIsPickup(true)}
                className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  isPickup ? "border-primary bg-primary/5" : "border-transparent bg-muted/50"
                }`}
              >
                <Store className={`h-6 w-6 ${isPickup ? "text-primary" : "text-muted-foreground"}`} />
                <div className="text-center">
                  <span className={`text-sm font-bold block ${isPickup ? "text-primary" : "text-foreground"}`}>Retirada</span>
                  <span className="text-[10px] text-muted-foreground">Retire na loja</span>
                </div>
              </button>
            </div>
            {isPickup && (
              <div className="mt-3 bg-primary/5 border border-primary/10 rounded-xl p-3 flex items-start gap-2">
                <Store className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-foreground">Retirada na loja</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Seu pedido ficará pronto para retirada. Sem taxa de entrega! 🎉</p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* SECTION: Contato */}
        <section className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/50">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${contactOk ? "bg-primary/10" : "bg-muted"}`}>
              <MessageCircle className={`h-4 w-4 ${contactOk ? "text-primary" : "text-muted-foreground"}`} />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-bold text-foreground">Seus dados</h2>
            </div>
            {contactOk && <CheckCircle2 className="h-4 w-4 text-primary" />}
          </div>
          <div className="p-4 space-y-3">
          <div className="relative">
            <input
              type="tel" inputMode="tel" autoComplete="tel"
              placeholder="(14) 99999-9999"
              value={phone}
              onChange={(e) => setPhone(maskWhatsApp(e.target.value))}
              onBlur={handlePhoneBlur}
              className="w-full h-12 px-4 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {loadingLookup && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          <input
            type="text" placeholder="Seu nome" value={name}
            onChange={(e) => setName(e.target.value)} autoComplete="name"
            className="w-full h-12 px-4 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {lookedUp && (
            <p className="text-xs text-primary">Reconhecemos seu número — endereço preenchido automaticamente.</p>
          )}
          </div>
        </section>

        {/* SECTION: Endereço (oculto na retirada) */}
        {!isPickup && (
        <section className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/50">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${addressOk ? "bg-primary/10" : "bg-muted"}`}>
              <MapPin className={`h-4 w-4 ${addressOk ? "text-primary" : "text-muted-foreground"}`} />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-bold text-foreground">Endereço de entrega</h2>
            </div>
            {addressOk && <CheckCircle2 className="h-4 w-4 text-primary" />}
          </div>
          <div className="p-4 space-y-3">
          <div className="flex gap-2">
            <input type="text" placeholder="CEP" value={cep}
              onChange={(e) => handleCepChange(e.target.value)}
              inputMode="numeric" maxLength={9}
              className="flex-1 h-11 px-3 rounded-xl border border-border bg-background text-sm" />
            <button onClick={() => handleCepLookup()} disabled={loadingCep}
              className="px-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50">
              {loadingCep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input type="text" placeholder="Rua" value={street} onChange={(e) => setStreet(e.target.value)}
              className="col-span-2 h-11 px-3 rounded-xl border border-border bg-background text-sm" />
            <input type="text" placeholder="Nº" value={number} onChange={(e) => setNumber(e.target.value)} inputMode="numeric"
              className="h-11 px-3 rounded-xl border border-border bg-background text-sm" />
          </div>
          <input type="text" placeholder="Complemento" value={complement} onChange={(e) => setComplement(e.target.value)}
            className="w-full h-11 px-3 rounded-xl border border-border bg-background text-sm" />
          <input type="text" placeholder="Bairro" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)}
            className="w-full h-11 px-3 rounded-xl border border-border bg-background text-sm" />
          <input type="text" placeholder="Ponto de referência" value={reference} onChange={(e) => setReference(e.target.value)}
            className="w-full h-11 px-3 rounded-xl border border-border bg-background text-sm" />
          </div>
        </section>
        )}

        {/* SECTION: Pagamento */}
        <section className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/50">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${payment ? "bg-primary/10" : "bg-muted"}`}>
              <CreditCard className={`h-4 w-4 ${payment ? "text-primary" : "text-muted-foreground"}`} />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-bold text-foreground">Pagamento</h2>
            </div>
            {payment && <CheckCircle2 className="h-4 w-4 text-primary" />}
          </div>
          <div className="p-4 space-y-2">
          {PAY_METHODS.map((m) => {
            const Icon = m.icon;
            const active = payment === m.id;
            return (
              <button key={m.id} onClick={() => setPayment(m.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${active ? "border-primary bg-primary/5" : "border-transparent bg-muted/50"}`}>
                <Icon className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                <span className={`text-sm font-medium ${active ? "text-primary" : "text-foreground"}`}>{m.label}</span>
                {active && <CheckCircle2 className="h-4 w-4 text-primary ml-auto" />}
              </button>
            );
          })}
          {payment === "dinheiro" && (
            <div className="pt-2 space-y-2">
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={needsChange} onChange={(e) => setNeedsChange(e.target.checked)} />
                Preciso de troco
              </label>
              {needsChange && (
                <>
                  <input
                    type="text" inputMode="decimal" placeholder="Troco para R$"
                    value={changeFor}
                    onChange={(e) => setChangeFor(e.target.value.replace(/[^0-9.,]/g, ""))}
                    className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm"
                  />
                  {changeFor && parseFloat(changeFor.replace(",", ".")) >= total && (
                    <p className="text-xs text-muted-foreground">
                      Seu troco: <span className="font-bold text-foreground">{formatBRL(parseFloat(changeFor.replace(",", ".")) - total)}</span>
                    </p>
                  )}
                  {changeFor && parseFloat(changeFor.replace(",", ".")) < total && (
                    <p className="text-xs text-destructive">Valor do troco deve ser maior que o total.</p>
                  )}
                </>
              )}
            </div>
          )}
          </div>
        </section>

        {/* SECTION: Resumo */}
        <section className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/50">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <ShoppingBag className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-sm font-bold text-foreground">Resumo</h2>
          </div>
          <div className="p-4 space-y-2">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="font-medium">{formatBRL(subtotal)}</span></div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5">
                {isPickup ? <><Store className="h-3 w-3" /> Retirada</> : <>Entrega</>}
              </span>
              <span className="font-medium">{isPickup ? "Grátis" : (matchedFee > 0 ? formatBRL(matchedFee) : (calculatingFee ? "..." : "—"))}</span>
            </div>
            <div className="flex justify-between text-base font-bold pt-2 border-t border-border"><span>Total</span><span className="text-primary">{formatBRL(total)}</span></div>
          </div>
        </section>

        <label className="flex items-start gap-2 text-xs text-muted-foreground px-1">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
          <span>Ao finalizar você concorda com os Termos de Uso e a Política de Privacidade da ItaSuper.</span>
        </label>
      </div>

      <div className="fixed bottom-0 inset-x-0 bg-card border-t border-border p-4">
        <button onClick={handleConfirm} disabled={submitting}
          className="w-full h-12 bg-primary text-primary-foreground font-bold rounded-xl active:scale-[0.98] disabled:opacity-50">
          {submitting ? "Enviando..." : `Confirmar pedido — ${formatBRL(total)}`}
        </button>
      </div>
    </div>
  );
};

export default GuestCheckoutPage;