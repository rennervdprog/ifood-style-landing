// Checkout guest (sem login) — piloto Itatinga.
// Chama a edge function `guest-checkout` no Supabase externo.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";
import { ArrowLeft, MapPin, CreditCard, Banknote, QrCode, Search, Loader2, ShoppingBag, MessageCircle } from "lucide-react";
import { formatCep, fetchCep } from "@/lib/location";
import { maskWhatsApp } from "@/lib/whatsapp";
import { formatBRL, addMoney } from "@/lib/utils";
import { calculateStoreOwnDeliveryFee } from "@/lib/deliveryFee";
import confetti from "canvas-confetti";

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

  // Guarda: sem itens ou loja não habilitada -> volta
  useEffect(() => {
    if (items.length === 0) navigate("/carrinho", { replace: true });
  }, [items.length, navigate]);

  const { data: store } = useQuery({
    queryKey: ["guest-store", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("stores")
        .select("id, name, address_city, minimum_order_value, own_delivery_fee, delivery_mode, delivery_fee_type, delivery_base_km, delivery_fee_base, delivery_fee_per_km, address_cep, latitude, longitude")
        .eq("id", storeId!).maybeSingle();
      // guest_checkout_enabled não está em stores_public; consultamos direto
      const { data: gc } = await (supabase as any)
        .from("stores")
        .select("guest_checkout_enabled")
        .eq("id", storeId!).maybeSingle();
      return { ...(data || {}), guest_checkout_enabled: gc?.guest_checkout_enabled ?? false };
    },
    enabled: !!storeId,
  });

  const { data: fees } = useQuery({
    queryKey: ["nb-fees"],
    queryFn: async () => {
      const { data } = await supabase.from("neighborhood_fees").select("*").order("name");
      return data || [];
    },
  });

  const PLATFORM_FEE = 2;
  const [calculatedFee, setCalculatedFee] = useState<number | null>(null);
  const [calculatingFee, setCalculatingFee] = useState(false);

  // 1) legado Itatinga: tabela neighborhood_fees por bairro
  const legacyFee = useMemo(() => {
    if (!neighborhood || !fees || (fees as any[]).length === 0) return null;
    const norm = (s: string) =>
      s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
    const target = norm(neighborhood);
    const list = fees as any[];
    const m =
      list.find((f) => norm(f.name) === target) ||
      list.find((f) => norm(f.name).includes(target) || target.includes(norm(f.name)));
    return m ? Number(m.fee || 0) : null;
  }, [neighborhood, fees]);

  // 2) lógica do lojista (fixa OU por km) — mesma do checkout normal
  useEffect(() => {
    if (legacyFee != null) { setCalculatedFee(legacyFee); return; }
    const s: any = store;
    if (!s) return;
    const customerCep = cep.replace(/\D/g, "");
    const storeCep = (s.address_cep || "").replace(/\D/g, "");
    const feeType = (s.delivery_fee_type as "fixed" | "km") || "fixed";
    // fixa: dá pra calcular sem CEP; km: precisa CEP + rua
    if (feeType === "km" && (!customerCep || !street.trim())) {
      setCalculatedFee(null); return;
    }
    let cancelled = false;
    setCalculatingFee(true);
    calculateStoreOwnDeliveryFee(customerCep, storeCep, {
      delivery_fee_type: feeType,
      delivery_base_km: Number(s.delivery_base_km || 0),
      delivery_fee_base: Number(s.delivery_fee_base || 0),
      delivery_fee_per_km: Number(s.delivery_fee_per_km || 0),
      own_delivery_fee: Number(s.own_delivery_fee || 0),
      platform_split: PLATFORM_FEE,
      customer_street: street || null,
      customer_number: number || null,
      customer_neighborhood: neighborhood || null,
      store_coords: s.latitude && s.longitude ? { lat: Number(s.latitude), lng: Number(s.longitude) } : null,
    }).then((r) => { if (!cancelled) setCalculatedFee(r.fee); })
      .catch(() => { if (!cancelled) setCalculatedFee(null); })
      .finally(() => { if (!cancelled) setCalculatingFee(false); });
    return () => { cancelled = true; };
  }, [store, legacyFee, cep, street, number, neighborhood]);

  const matchedFee = calculatedFee ?? 0;

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
    if (!street.trim() || !number.trim() || !neighborhood.trim()) {
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
        neighborhood: neighborhood.trim(),
        address: {
          label: "Casa",
          cep: cep.replace(/\D/g, "") || null,
          street: street.trim(),
          number: number.trim(),
          complement: complement.trim() || null,
          reference_point: reference.trim() || null,
        },
        is_pickup: false,
        needs_change: payment === "dinheiro" && needsChange,
        change_for: payment === "dinheiro" && needsChange ? Number(changeFor) : 0,
        scheduled_for: null,
        consent: true,
      };
      const { data, error } = await supabase.functions.invoke("guest-checkout", { body: payload });
      if (error) throw error;
      const res = data as any;
      if (!res?.ok) throw new Error(res?.error || "Falha ao criar pedido");
      clearCart();
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.7 } });
      toast.success("Pedido enviado!");
      navigate(`/p/${res.order_id}?t=${res.phone_last4}`, { replace: true });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao finalizar pedido.");
    } finally { setSubmitting(false); }
  };

  if (!storeId || !items.length) return null;

  const guestEnabled = (store as any)?.guest_checkout_enabled === true;
  if (store && !guestEnabled) {
    // Loja não habilitada para guest → manda pro fluxo normal (login)
    navigate("/auth", { state: { from: "/checkout" }, replace: true });
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-40 bg-card border-b border-border h-14 flex items-center px-4 gap-3">
        <button onClick={() => navigate(-1)} className="p-1 -ml-1"><ArrowLeft className="h-5 w-5" /></button>
        <h1 className="text-base font-bold">Finalizar pedido</h1>
      </header>

      <div className="p-4 space-y-4">
        {/* WhatsApp */}
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <h2 className="text-sm font-bold flex items-center gap-2"><MessageCircle className="h-4 w-4 text-primary" /> Seu WhatsApp</h2>
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

        {/* Endereço */}
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <h2 className="text-sm font-bold flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> Endereço de entrega</h2>
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

        {/* Pagamento */}
        <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
          <h2 className="text-sm font-bold">Pagamento</h2>
          {PAY_METHODS.map((m) => {
            const Icon = m.icon;
            const active = payment === m.id;
            return (
              <button key={m.id} onClick={() => setPayment(m.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${active ? "border-primary bg-primary/5" : "border-border"}`}>
                <Icon className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-sm font-medium">{m.label}</span>
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
                <input type="number" placeholder="Troco para R$" value={changeFor} onChange={(e) => setChangeFor(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm" />
              )}
            </div>
          )}
        </div>

        {/* Resumo */}
        <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
          <h2 className="text-sm font-bold flex items-center gap-2"><ShoppingBag className="h-4 w-4 text-primary" /> Resumo</h2>
          <div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatBRL(subtotal)}</span></div>
          <div className="flex justify-between text-sm"><span>Entrega</span><span>{matchedFee > 0 ? formatBRL(matchedFee) : "—"}</span></div>
          <div className="flex justify-between text-base font-bold pt-2 border-t border-border"><span>Total</span><span>{formatBRL(total)}</span></div>
        </div>

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