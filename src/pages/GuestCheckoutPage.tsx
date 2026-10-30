// Checkout guest (sem login) — piloto Itatinga.
// Chama a edge function `guest-checkout` no Supabase externo.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";
import { ArrowLeft, MapPin, CreditCard, Banknote, QrCode, Search, Loader2, ShoppingBag, MessageCircle, Truck, Store, CheckCircle2, User, Clock, AlertTriangle, Calendar } from "lucide-react";
import { formatCep, fetchCep } from "@/lib/location";
import { maskWhatsApp } from "@/lib/whatsapp";
import { formatBRL, addMoney } from "@/lib/utils";
import { getStoreOpenStatus, type OpeningHour } from "@/lib/storeStatus";
import { isPixDiretoAvailable } from "@/lib/pixDiretoAvailability";
import { computeGuestCheckoutGates } from "@/lib/guestCheckoutGates";
import { clearGuestIdempotencyKey, getGuestIdempotencyKey } from "@/lib/guestIdempotency";
import { asDeliveryAddress, deliveryQuoteBreakdown, deliveryQuoteFailureMessage, isSuccessfulDeliveryQuote, quoteErrorFromUnknown, quoteRequestKey, type DeliveryQuote, type DeliveryQuoteFailure } from "@/lib/deliveryQuote";

const BASE_PAY_METHODS = [
  { id: "pix_machine", label: "PIX na maquininha", icon: QrCode },
  { id: "cartao",      label: "Cartão na entrega", icon: CreditCard },
  { id: "dinheiro",    label: "Dinheiro",           icon: Banknote },
];

// Fase 6B (P2-5/P2-7): lê o corpo JSON de um FunctionsHttpError da edge
// guest-checkout — `supabase.functions.invoke` devolve o erro com a Response
// em `context` (mesmo padrão de `requestAuthenticatedDeliveryQuote` em
// deliveryQuote.ts). Sem ele, só sobra a mensagem genérica do erro HTTP.
async function guestCheckoutErrorBody(error: unknown): Promise<Record<string, unknown> | null> {
  const ctx = (error as { context?: Response })?.context;
  if (!ctx || typeof ctx.text !== "function") return null;
  try {
    const raw = await ctx.text();
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const GuestCheckoutPage = () => {
  const navigate = useNavigate();
  const { items, subtotal, clearCart } = useCart();
  const storeId = items[0]?.store_id;

  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [lookedUp, setLookedUp] = useState(false);
  const lastLookupRef = useRef<string>("");
  // Fase 6B (P2-3): a chave de idempotência vive no sessionStorage por loja
  // (src/lib/guestIdempotency.ts) — sobrevive à remontagem da página e é
  // reutilizada no retry do mesmo submit; limpa no sucesso.
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
        .from("stores_public")
        .select("id, name, address_city, minimum_order_value, own_delivery_fee, delivery_mode, delivery_fee_type, delivery_base_km, delivery_fee_base, delivery_fee_per_km, address_cep, latitude, longitude, free_delivery_threshold, guest_checkout_enabled, pix_direto_enabled, pix_direto_key_configured, is_open, force_closed, preorder_enabled, preorder_minutes_before")
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

  // Disponibilidade de entrega (mesma fonte canônica da página da loja):
  // loja com entrega própria e nenhum motoboy disponível = só retirada.
  const isOwnDeliveryStore = (store as any)?.delivery_mode === "own";
  const { data: deliveryAvailability, isSuccess: availabilityChecked } = useQuery({
    queryKey: ["store-delivery-availability", storeId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc(
        "store_delivery_availability",
        { _store_id: storeId! }
      ).maybeSingle();
      if (error) throw error;
      return data as {
        can_accept_delivery_orders: boolean;
        available_drivers_count: number;
        reason_code: string;
        reason_message: string;
        checked_at: string;
      } | null;
    },
    enabled: !!storeId && isOwnDeliveryStore,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
  const deliveryUnavailable = isOwnDeliveryStore
    && availabilityChecked
    && deliveryAvailability?.can_accept_delivery_orders === false;

  // Entrega indisponível → força retirada (não pede endereço de entrega).
  useEffect(() => {
    if (deliveryUnavailable) setIsPickup(true);
  }, [deliveryUnavailable]);

  // Fase 4: mesmo padrão do checkout logado — busca o horário da loja e usa
  // getStoreOpenStatus para travar loja fechada e pedido mínimo no front.
  // O servidor (RPC create_order_with_items) continua sendo o trava final.
  const { data: storeHours } = useQuery({
    queryKey: ["guest-store-hours", storeId],
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

  const storeStatus = store && storeHours
    ? getStoreOpenStatus(
        storeHours,
        (store as any).force_closed ?? false,
        (store as any).is_open ?? true,
        {
          enabled: !!(store as any).preorder_enabled,
          minutesBefore: Number((store as any).preorder_minutes_before ?? 0),
        },
      )
    : null;
  const storeMinimumOrderValue = Number((store as any)?.minimum_order_value || 0);
  const { isStoreClosed, isPreorder, belowMinimum, minimumMissing, submitError, minimumButtonLabel, closedButtonLabel } =
    computeGuestCheckoutGates({ subtotal, minimumOrderValue: storeMinimumOrderValue, storeStatus });

  const [deliveryQuote, setDeliveryQuote] = useState<DeliveryQuote | null>(null);
  const [deliveryQuoteFailure, setDeliveryQuoteFailure] = useState<DeliveryQuoteFailure | null>(null);
  const [calculatingFee, setCalculatingFee] = useState(false);

  const deliveryAddress = useMemo(() => asDeliveryAddress({
    street,
    number,
    complement,
    neighborhood,
    cep,
  }), [street, number, complement, neighborhood, cep]);
  const deliveryQuoteInputKey = useMemo(
    () => quoteRequestKey(storeId, subtotal, deliveryAddress),
    [storeId, subtotal, deliveryAddress],
  );

  useEffect(() => {
    const digits = phone.replace(/\D/g, "");
    if (isPickup) {
      setDeliveryQuote(null);
      setDeliveryQuoteFailure(null);
      setCalculatingFee(false);
      return;
    }
    if (!storeId || !deliveryAddress || digits.length < 10 || name.trim().length < 2 || !consent || items.length === 0) {
      setDeliveryQuote(null);
      setDeliveryQuoteFailure(null);
      setCalculatingFee(false);
      return;
    }

    let cancelled = false;
    setCalculatingFee(true);
    setDeliveryQuote(null);
    setDeliveryQuoteFailure(null);

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("guest-checkout", {
          body: {
            quote_only: true,
            phone: digits,
            name: name.trim(),
            store_id: storeId,
            items: items.map((it) => ({ product_id: it.id, quantity: it.quantity, unit_price: it.price })),
            subtotal,
            delivery_fee: 0,
            total_price: subtotal,
            payment_method: "preview",
            neighborhood: deliveryAddress.neighborhood,
            address: {
              label: "Casa",
              cep: deliveryAddress.cep,
              street: deliveryAddress.street,
              number: deliveryAddress.number,
              complement: deliveryAddress.complement || null,
              reference_point: reference.trim() || null,
              city: deliveryAddress.city || null,
              state: deliveryAddress.state || null,
            },
            is_pickup: false,
            consent: true,
          },
        });
        if (cancelled) return;
        if (error || !isSuccessfulDeliveryQuote(data as any)) {
          setDeliveryQuote(null);
          setDeliveryQuoteFailure((data && typeof data === "object" ? data : quoteErrorFromUnknown(error)) as DeliveryQuoteFailure);
          return;
        }
        setDeliveryQuote(data as DeliveryQuote);
        setDeliveryQuoteFailure(null);
      } catch (error) {
        if (!cancelled) {
          setDeliveryQuote(null);
          setDeliveryQuoteFailure(quoteErrorFromUnknown(error));
        }
      } finally {
        if (!cancelled) setCalculatingFee(false);
      }
    })();

    return () => { cancelled = true; };
  }, [deliveryQuoteInputKey, storeId, subtotal, deliveryAddress, phone, name, consent, items, isPickup, reference]);

  const matchedFee = isPickup ? 0 : Number(deliveryQuote?.pricing.delivery_fee || 0);
  const total = useMemo(() => addMoney(subtotal, matchedFee), [subtotal, matchedFee]);
  const quoteReady = isPickup || isSuccessfulDeliveryQuote(deliveryQuote);
  const quoteNeedsAddress = !isPickup && !deliveryAddress;
  const quoteFailureMessage = deliveryQuoteFailure ? deliveryQuoteFailureMessage(deliveryQuoteFailure) : null;
  const quoteBreakdown = deliveryQuoteBreakdown(deliveryQuote);

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
    if (lastLookupRef.current === digits) return;
    lastLookupRef.current = digits;
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

  // Auto-lookup enquanto digita: dispara quando atinge 10 ou 11 dígitos (debounce 300ms).
  // Evita esperar o blur/confirmar — busca já ao terminar de digitar.
  useEffect(() => {
    const digits = phone.replace(/\D/g, "");
    if (!storeId) return;
    if (digits.length < 10 || digits.length > 11) return;
    if (lastLookupRef.current === digits) return;
    const t = setTimeout(() => { handlePhoneBlur(); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone, storeId]);

  // Fase 6B (P2-5): o pedido já existe — leva ao acompanhamento em vez de
  // mostrar erro genérico. A chave de idempotência é limpa: o pedido confirmou.
  const handleCreatedOrder = (orderId: string, last4: string, deliveryPin: string | null, pixDireto: boolean) => {
    clearGuestIdempotencyKey(storeId);
    clearCart();
    toast.success("Pedido criado!", {
      description: "Seu pedido foi registrado. Acompanhe o status por aqui.",
    });
    const suffix = pixDireto ? "&pix=1" : "";
    navigate(`/p/${orderId}?t=${last4}${suffix}`, {
      replace: true,
      state: { delivery_pin: deliveryPin },
    });
  };

  const handleConfirm = async () => {
    // Fase 4: mesmas travas do checkout logado — loja fechada e pedido
    // mínimo recusam antes de chamar a edge.
    if (submitError) { toast.error(submitError); return; }
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) { toast.error("Informe um WhatsApp válido."); return; }
    if (!name.trim() || name.trim().length < 2) { toast.error("Informe seu nome."); return; }
    if (!isPickup && (!street.trim() || !number.trim() || !neighborhood.trim())) {
      toast.error("Preencha rua, número e bairro."); return;
    }
    if (!payment) { toast.error("Escolha a forma de pagamento."); return; }
    if (!isPickup && (calculatingFee || !isSuccessfulDeliveryQuote(deliveryQuote))) {
      toast.error("Não foi possível confirmar a entrega", { description: deliveryQuoteFailureMessage(deliveryQuoteFailure) });
      return;
    }
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
        // Fase 6B (P2-3): mesma chave por loja até o pedido confirmar.
        idempotency_key: getGuestIdempotencyKey(storeId),
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
      if (error) {
        const body = await guestCheckoutErrorBody(error);
        // Fase 6B (P2-5): guest_link_failed com order_id = pedido já criado
        // (o vínculo do guest falhou depois da RPC) — mostrar "pedido criado"
        // com o acompanhamento, em vez do erro genérico.
        if (body?.error === "guest_link_failed" && typeof body.order_id === "string" && body.order_id) {
          handleCreatedOrder(
            body.order_id,
            (typeof body.phone_last4 === "string" && body.phone_last4) || digits.slice(-4),
            null,
            false,
          );
          return;
        }
        // Fase 6B (P2-7): a cotação não resolveu o endereço — orientar o CEP
        // em vez do erro genérico. Só quando o motivo é de endereço: a edge
        // devolve `delivery_quote_failed` para qualquer falha de cotação
        // (ex.: sem entregador), e o motivo vem em `reason` — sem ele, a
        // mensagem de CEP seria enganosa (ex.: loja sem motoboy).
        const quoteReason = typeof body?.reason === "string" ? body.reason : "";
        const isAddressFailure =
          body?.error === "address_not_resolved" ||
          quoteReason === "address_not_resolved" ||
          quoteReason === "address_unavailable" ||
          quoteReason === "delivery_quote_failed" ||
          quoteReason === "delivery_quote_unavailable";
        if (isAddressFailure) {
          toast.error("Não conseguimos localizar o endereço", {
            description: deliveryQuoteFailureMessage({ ok: false, reason: "address_not_resolved" }),
          });
          return;
        }
        throw error;
      }
      const res = data as any;
      if (!res?.ok) {
        // Mesmo tratamento do P2-5 caso a edge devolva o erro com 200.
        if (res?.error === "guest_link_failed" && res?.order_id) {
          handleCreatedOrder(res.order_id, res.phone_last4 || digits.slice(-4), null, false);
          return;
        }
        throw new Error(res?.error || "Falha ao criar pedido");
      }
      // Fase 6B (P2-3): pedido confirmou — a chave sai do sessionStorage.
      clearGuestIdempotencyKey(storeId);
      clearCart();
      // Lazy-load canvas-confetti só no sucesso (economiza ~7 KB gzip no bundle inicial)
      import("canvas-confetti").then(({ default: confetti }) => {
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.7 } });
      }).catch(() => {});
      toast.success("Pedido enviado!");
      const suffix = res.pix_direto ? "&pix=1" : "";
      navigate(`/p/${res.order_id}?t=${res.phone_last4}${suffix}`, {
        replace: true,
        state: { delivery_pin: res.delivery_pin || null },
      });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao finalizar pedido.");
    } finally { setSubmitting(false); }
  };

  if (!storeId || !items.length) return null;

  const guestEnabled = (store as any)?.guest_checkout_enabled === true;
  // PIX Direto: a loja pode mostrar a opção sem revelar a chave — o que
  // chega aqui é só o booleano pix_direto_key_configured (Fase 5).
  const pixDiretoAvailable = isPixDiretoAvailable(store as any);
  const payMethods = pixDiretoAvailable
    ? [...BASE_PAY_METHODS, { id: "pix_direto", label: "Pix Direto (chave do lojista)", icon: QrCode }]
    : BASE_PAY_METHODS;

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

      {/* Fase 4: loja fechada — mesmo aviso do checkout logado */}
      {isStoreClosed && storeStatus && (
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

      {/* Pré-pedido (loja ainda não abriu, mas aceita agendamento) */}
      {!isStoreClosed && isPreorder && storeStatus?.releaseAt && (
        <div className="mx-4 mt-4 bg-primary/10 border border-primary/30 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
            <Calendar className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-primary">Pré-pedido aceito</h3>
            <p className="text-xs text-foreground/80 mt-0.5">
              A loja ainda não abriu, mas você já pode finalizar.
              Seu pedido será enviado para a cozinha automaticamente às{" "}
              <strong>
                {new Date(storeStatus.releaseAt).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "America/Sao_Paulo",
                })}
              </strong>.
            </p>
          </div>
        </div>
      )}

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
                disabled={deliveryUnavailable}
                className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  !isPickup ? "border-primary bg-primary/5" : "border-transparent bg-muted/50"
                }`}
              >
                <Truck className={`h-6 w-6 ${!isPickup ? "text-primary" : "text-muted-foreground"}`} />
                <div className="text-center">
                  <span className={`text-sm font-bold block ${!isPickup ? "text-primary" : "text-foreground"}`}>Entrega</span>
                  <span className="text-[10px] text-muted-foreground">{deliveryUnavailable ? "Indisponível no momento" : "Receba em casa"}</span>
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
            {deliveryUnavailable && (
              <div className="mt-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-3 flex items-start gap-2">
                <Truck className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-foreground">Entrega indisponível no momento</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {deliveryAvailability?.reason_message || "Nenhum motoboy disponível agora."} Por enquanto, apenas retirada na loja.
                  </p>
                </div>
              </div>
            )}
            {isPickup && !deliveryUnavailable && (
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
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs text-primary font-medium">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Buscando…</span>
              </div>
            )}
            {!loadingLookup && lookedUp && (
              <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-primary" />
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
            <input type="text" placeholder="CEP (opcional)" value={cep}
              onChange={(e) => handleCepChange(e.target.value)}
              inputMode="numeric" maxLength={9}
              className="flex-1 h-11 px-3 rounded-xl border border-border bg-background text-sm" />
            <button onClick={() => handleCepLookup()} disabled={loadingCep}
              className="px-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50">
              {loadingCep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground -mt-1">Não sabe o CEP? Pode deixar em branco.</p>
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
          {payMethods.map((m) => {
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
            {/* Fase 4: pedido mínimo — mesmo cartão do checkout logado */}
            {belowMinimum && (
              <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
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
                <p className="text-[11px] text-amber-700/90 dark:text-amber-400/90 leading-snug">
                  Adicione mais itens ao carrinho para atingir o valor mínimo desta loja.
                </p>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5">
                {isPickup ? <><Store className="h-3 w-3" /> Retirada</> : <>Entrega</>}
              </span>
              <span className="font-medium">{isPickup ? "Grátis" : (calculatingFee ? "Calculando..." : (quoteNeedsAddress ? "Informe o endereço" : (quoteFailureMessage ? "Indisponível" : (quoteReady ? formatBRL(matchedFee) : "A calcular"))))}</span>
            </div>
            {!isPickup && isSuccessfulDeliveryQuote(deliveryQuote) && (
              <div className="text-[11px] text-primary flex items-center gap-1"><MapPin className="h-3 w-3" /> Endereço confirmado · {deliveryQuote.distance.km.toFixed(1)} km da loja</div>
            )}
            {!isPickup && quoteBreakdown && <p className="text-[11px] text-muted-foreground">{quoteBreakdown}</p>}
            {!isPickup && quoteFailureMessage && <p className="text-[11px] text-destructive">{quoteFailureMessage}</p>}
            <div className="flex justify-between text-base font-bold pt-2 border-t border-border"><span>Total</span><span className="text-primary">{formatBRL(total)}</span></div>
          </div>
        </section>

        <label className="flex items-start gap-2 text-xs text-muted-foreground px-1">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
          <span>Ao finalizar você concorda com os Termos de Uso e a Política de Privacidade da ItaSuper.</span>
        </label>
      </div>

      <div className="native-hide-while-keyboard fixed bottom-0 inset-x-0 bg-card border-t border-border p-4">
        {isStoreClosed ? (
          <button
            disabled
            className="w-full h-12 bg-muted text-muted-foreground font-bold rounded-xl flex items-center justify-center gap-2 cursor-not-allowed"
          >
            <Clock className="h-5 w-5" />
            {closedButtonLabel}
          </button>
        ) : (
          <button onClick={handleConfirm} disabled={submitting || belowMinimum || (!isPickup && (calculatingFee || !isSuccessfulDeliveryQuote(deliveryQuote)))}
            className="w-full h-12 bg-primary text-primary-foreground font-bold rounded-xl active:scale-[0.98] disabled:opacity-50">
            {submitting ? "Enviando..." : belowMinimum ? minimumButtonLabel : !isPickup && calculatingFee ? "Calculando entrega..." : !isPickup && !quoteReady ? (quoteNeedsAddress ? "Informe o endereço" : "Revise o endereço") : `Confirmar pedido — ${formatBRL(total)}`}
          </button>
        )}
      </div>
    </div>
  );
};

export default GuestCheckoutPage;