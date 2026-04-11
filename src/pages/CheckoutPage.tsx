import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, MapPin, CreditCard, Banknote, QrCode, Edit3, Loader2, Truck, CheckCircle2, ShoppingBag, Tag, ChevronRight, Clock, AlertTriangle, Star } from "lucide-react";
import { getStoreOpenStatus, type OpeningHour } from "@/lib/storeStatus";
import confetti from "canvas-confetti";
import AddressModal from "@/components/AddressModal";
import SavedAddressPicker from "@/components/SavedAddressPicker";
import CouponInput from "@/components/CouponInput";
import { calculateDeliveryFee, DEFAULT_DELIVERY_FEE_CONFIG, type DeliveryFeeConfig } from "@/lib/deliveryFee";
import { formatCep, fetchCep } from "@/lib/cepLookup";
import { addMoney, multiplyMoney, sumMoney } from "@/lib/utils";
import { useStorePlan } from "@/hooks/useStorePlan";
import LoyaltyRedemption from "@/components/LoyaltyRedemption";

const allPaymentMethods = [
  { id: "pix", label: "PIX Online", desc: "Pagamento instantâneo", icon: QrCode },
  { id: "cartao", label: "Cartão na Entrega", desc: "Débito ou crédito", icon: CreditCard },
  { id: "dinheiro", label: "Dinheiro", desc: "Pague na entrega", icon: Banknote },
];

const CheckoutPage = () => {
  const { items, neighborhood, neighborhoodFee, subtotal, total, clearCart, setNeighborhood } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [paymentMethod, setPaymentMethod] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [needsChange, setNeedsChange] = useState(false);
  const [changeFor, setChangeFor] = useState("");
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState<string | null>(null);
  const [savedAddressData, setSavedAddressData] = useState<any>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponId, setCouponId] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [couponType, setCouponType] = useState<string | null>(null);
  const [calculatedDeliveryFee, setCalculatedDeliveryFee] = useState<number | null>(null);
  const [calculatingFee, setCalculatingFee] = useState(false);
  const [feeBreakdown, setFeeBreakdown] = useState<string | null>(null);
  const [loyaltyDiscount, setLoyaltyDiscount] = useState(0);
  const [loyaltyPointsUsed, setLoyaltyPointsUsed] = useState(0);

  const { data: userProfile, refetch: refetchProfile } = useQuery({
    queryKey: ["my-profile-checkout", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("street, number, complement, neighborhood, reference_point, phone, whatsapp_number, cep")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: deliveryFeeConfig } = useQuery({
    queryKey: ["delivery-fee-config-checkout"],
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_settings")
        .select("value")
        .eq("key", "delivery_fee_config")
        .maybeSingle();
      return data?.value as unknown as DeliveryFeeConfig | null;
    },
  });

  const storeId = items[0]?.store_id;
  const storePlan = useStorePlan(storeId);

  // Filter payment methods based on store plan
  const paymentMethods = useMemo(() => {
    if (!storePlan.allowPix) {
      return allPaymentMethods.filter(pm => pm.id !== "pix");
    }
    return allPaymentMethods;
  }, [storePlan.allowPix]);

  const { data: storeData } = useQuery({
    queryKey: ["store-checkout", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("stores_public")
        .select("address_cep, delivery_mode, own_delivery_fee, is_open, force_closed")
        .eq("id", storeId!)
        .maybeSingle();
      return data;
    },
    enabled: !!storeId,
  });

  const { data: storeHours } = useQuery({
    queryKey: ["store-hours-checkout", storeId],
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

  const storeStatus = storeData && storeHours
    ? getStoreOpenStatus(storeHours, storeData.force_closed ?? false, storeData.is_open ?? true)
    : null;
  const isStoreClosed = storeStatus ? !storeStatus.isOpen : false;

  const profileNeighborhood = (userProfile as any)?.neighborhood;
  const profileStreet = (userProfile as any)?.street;
  const profileNumber = (userProfile as any)?.number;
  const profileComplement = (userProfile as any)?.complement;
  const profileReference = (userProfile as any)?.reference_point;
  const profileCep = (userProfile as any)?.cep;
  const hasAddress = !!profileStreet && !!profileNumber && !!profileNeighborhood;
  const storeCep = (storeData as any)?.address_cep;
  const storeDeliveryMode = (storeData as any)?.delivery_mode || "platform";
  const storeOwnFee = (storeData as any)?.own_delivery_fee || 0;
  const isOwnDelivery = storeDeliveryMode === "own";
  const config = deliveryFeeConfig || DEFAULT_DELIVERY_FEE_CONFIG;
  // For own delivery stores: always add platform split (R$2) on top of store's own fee
  const ownDeliveryFeeWithSplit = isOwnDelivery && storePlan.platformDeliverySplit > 0
    ? storeOwnFee + storePlan.platformDeliverySplit
    : storeOwnFee;
  const activeDeliveryFee = isOwnDelivery ? ownDeliveryFeeWithSplit : (calculatedDeliveryFee !== null ? calculatedDeliveryFee : config.city_fee);
  const effectiveDeliveryFee = couponType === "free_shipping" ? 0 : activeDeliveryFee;
  const finalTotal = Math.max(0, addMoney(subtotal, effectiveDeliveryFee, -couponDiscount, -loyaltyDiscount));

  useEffect(() => {
    const customerCep = selectedSavedAddressId && savedAddressData?.cep ? savedAddressData.cep : profileCep;
    const activeNeighborhood = selectedSavedAddressId && savedAddressData?.neighborhood ? savedAddressData.neighborhood : profileNeighborhood;

    if (isOwnDelivery) {
      setCalculatedDeliveryFee(null);
      const totalOwnFee = ownDeliveryFeeWithSplit;
      if (storePlan.isItatingaFixed && storePlan.platformDeliverySplit > 0) {
        setFeeBreakdown(`Entrega loja: R$ ${storeOwnFee.toFixed(2)} + Taxa plataforma: R$ ${storePlan.platformDeliverySplit.toFixed(2)}`);
      } else {
        setFeeBreakdown(`Taxa fixa da loja: R$ ${storeOwnFee.toFixed(2)}`);
      }
      if (activeNeighborhood) setNeighborhood(activeNeighborhood, totalOwnFee);
      return;
    }

    if (!customerCep || !storeCep) {
      setCalculatedDeliveryFee(null);
      setFeeBreakdown(null);
      return;
    }

    let cancelled = false;
    setCalculatingFee(true);

    calculateDeliveryFee(customerCep, storeCep, config).then((result) => {
      if (cancelled) return;
      setCalculatedDeliveryFee(result.fee);
      setFeeBreakdown(result.breakdown);
      setNeighborhood(activeNeighborhood || neighborhood || "", result.fee);
      setCalculatingFee(false);
    }).catch(() => {
      if (cancelled) return;
      setCalculatingFee(false);
    });

    return () => { cancelled = true; };
  }, [profileCep, storeCep, config, savedAddressData, selectedSavedAddressId, profileNeighborhood, isOwnDelivery, storeOwnFee, ownDeliveryFeeWithSplit, storePlan.isItatingaFixed, storePlan.platformDeliverySplit]);

  const buildAddressString = () => {
    if (!hasAddress) return "";
    const parts = [profileStreet, profileNumber];
    if (profileComplement) parts.push(profileComplement);
    if (profileReference) parts.push(`Ref: ${profileReference}`);
    return parts.join(", ");
  };

  const addressString = buildAddressString();

  if (!user) {
    navigate("/auth", { state: { from: "/checkout" }, replace: true });
    return null;
  }

  if (items.length === 0) {
    navigate("/carrinho", { replace: true });
    return null;
  }

  const handleConfirm = async () => {
    if (isStoreClosed) {
      toast.error(`Loja fechada. ${storeStatus?.reason || ""}`);
      return;
    }
    const useSavedAddr = selectedSavedAddressId && savedAddressData;
    const finalHasAddress = useSavedAddr || hasAddress;
    const finalNeighborhood = useSavedAddr ? savedAddressData.neighborhood : (profileNeighborhood || neighborhood);
    const finalAddress = useSavedAddr
      ? [savedAddressData.street, savedAddressData.number, savedAddressData.complement, savedAddressData.reference_point ? `Ref: ${savedAddressData.reference_point}` : ""].filter(Boolean).join(", ")
      : addressString;

    if (!finalHasAddress) {
      setShowAddressModal(true);
      return;
    }
    if (!finalNeighborhood) {
      toast.error("Selecione um bairro antes de finalizar.");
      return;
    }
    if (!paymentMethod) {
      toast.error("Selecione a forma de pagamento.");
      return;
    }
    if (paymentMethod === "dinheiro" && needsChange) {
      const changeValue = addMoney(parseFloat(changeFor));
      if (!changeValue || changeValue < finalTotal) {
        toast.error("O valor do troco deve ser maior que o total do pedido.");
        return;
      }
    }

    setLoading(true);
    try {
      const storeGroups = items.reduce((acc, item) => {
        if (!acc[item.store_id]) acc[item.store_id] = [];
        acc[item.store_id].push(item);
        return acc;
      }, {} as Record<string, typeof items>);

      for (const [storeId, storeItems] of Object.entries(storeGroups)) {
        const storeSubtotal = sumMoney(storeItems.map((item) => item.price * item.quantity));
        const appFee = 0; // Calculated by DB trigger using store's commission_rate
        const storeTotalPrice = Math.max(0, addMoney(storeSubtotal, effectiveDeliveryFee, -couponDiscount, -loyaltyDiscount));

        const changeValue = paymentMethod === "dinheiro" && needsChange ? addMoney(parseFloat(changeFor)) : 0;
        const orderStatus = paymentMethod === "pix" ? "aguardando_pagamento" : "pendente";
        const { data: order, error: orderError } = await supabase
          .from("orders")
          .insert({
            client_id: user.id,
            store_id: storeId,
            subtotal: storeSubtotal,
            delivery_fee: effectiveDeliveryFee,
            total_price: storeTotalPrice,
            app_fee: appFee,
            payment_method: paymentMethod,
            neighborhood: finalNeighborhood,
            address_details: finalAddress,
            needs_change: paymentMethod === "dinheiro" && needsChange,
            change_for: changeValue,
            status: orderStatus,
          } as any)
          .select("id")
          .single();

        if (orderError) throw orderError;

        const orderItems = storeItems.map((item) => ({
          order_id: order.id,
          product_id: item.id,
          quantity: item.quantity,
          unit_price: item.price,
          addons: item.addons && item.addons.length > 0 ? JSON.stringify(item.addons) : null,
          observations: item.observations || null,
        }));

        const { error: itemsError } = await supabase
          .from("order_items")
          .insert(orderItems);

        if (itemsError) throw itemsError;

        if (couponId && user) {
          const { error: couponError } = await supabase.rpc("use_coupon", {
            _coupon_id: couponId,
            _user_id: user.id,
            _order_id: order.id,
          });
          if (couponError) {
            console.warn("Coupon usage error:", couponError.message);
          }
        }
      }

      if (paymentMethod === "pix") {
        clearCart();
        toast.success("Pedido criado! Acesse 'Meus Pedidos' para pagar com PIX.", { duration: 5000 });
        navigate("/pedidos?new_order=1");
        return;
      }

      clearCart();
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.7 } });
      toast.success("Pedido enviado com sucesso! Acompanhe pelo chat.");
      navigate("/pedidos?new_order=1", { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar pedido.");
    } finally {
      setLoading(false);
    }
  };

  const hasValidAddress = selectedSavedAddressId ? !!savedAddressData : hasAddress;
  const stepsDone = [hasValidAddress, !!paymentMethod];

  return (
    <div className="min-h-screen bg-background pb-36 overflow-y-auto">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border flex items-center h-14 px-4 gap-3">
        <button onClick={() => navigate(-1)} className="p-1 -ml-1">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="font-bold text-foreground flex-1">Finalizar Pedido</h1>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
          {items.length} {items.length === 1 ? "item" : "itens"}
        </span>
      </header>

      {/* Store Closed Alert */}
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

      {/* Progress steps */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          {["Endereço", "Pagamento", "Confirmar"].map((step, i) => (
            <div key={step} className="flex-1 flex items-center gap-2">
              <div className="flex-1">
                <div className={`h-1.5 rounded-full transition-all ${
                  i < stepsDone.filter(Boolean).length ? "bg-primary" :
                  i === stepsDone.filter(Boolean).length ? "bg-primary/30" : "bg-muted"
                }`} />
                <p className={`text-[10px] mt-1 text-center font-medium ${
                  i < stepsDone.filter(Boolean).length ? "text-primary" : "text-muted-foreground"
                }`}>{step}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 py-2 space-y-4">
        {/* SECTION: Address */}
        <section className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/50">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${hasValidAddress ? "bg-primary/10" : "bg-muted"}`}>
              <MapPin className={`h-4 w-4 ${hasValidAddress ? "text-primary" : "text-muted-foreground"}`} />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-bold text-foreground">Endereço de entrega</h2>
            </div>
            {hasValidAddress && <CheckCircle2 className="h-4 w-4 text-primary" />}
          </div>

          <div className="p-4 space-y-3">
            <SavedAddressPicker
              selectedId={selectedSavedAddressId || undefined}
              onSelect={(addr) => {
                setSelectedSavedAddressId(addr.id);
                setSavedAddressData(addr);
              }}
            />

            {selectedSavedAddressId && savedAddressData && (
              <div className="bg-primary/5 rounded-xl p-3.5 space-y-1.5">
                <p className="text-sm font-bold text-foreground">
                  {savedAddressData.street}, {savedAddressData.number}
                  {savedAddressData.complement ? ` - ${savedAddressData.complement}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">{savedAddressData.neighborhood}</p>
                {savedAddressData.reference_point && (
                  <p className="text-xs text-muted-foreground">📍 {savedAddressData.reference_point}</p>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-border/30">
                  {calculatingFee ? (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> Calculando taxa...
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Truck className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-bold text-primary">
                        R$ {activeDeliveryFee.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <button
                    onClick={() => { setSelectedSavedAddressId(null); setSavedAddressData(null); }}
                    className="text-xs text-primary font-semibold"
                  >
                    Alterar
                  </button>
                </div>
              </div>
            )}

            {!selectedSavedAddressId && hasAddress && (
              <div className="bg-primary/5 rounded-xl p-3.5 space-y-1.5">
                <p className="text-sm font-bold text-foreground">
                  {profileStreet}, {profileNumber}
                  {profileComplement ? ` - ${profileComplement}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">{profileNeighborhood}</p>
                {profileReference && (
                  <p className="text-xs text-muted-foreground">📍 {profileReference}</p>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-border/30">
                  {calculatingFee ? (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> Calculando taxa...
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Truck className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-bold text-primary">
                        R$ {activeDeliveryFee.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <button onClick={() => navigate("/perfil")} className="text-xs text-primary font-semibold flex items-center gap-1">
                    <Edit3 className="h-3 w-3" /> Alterar
                  </button>
                </div>
              </div>
            )}

            {!selectedSavedAddressId && !hasAddress && (
              <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 text-center space-y-3">
                <MapPin className="h-8 w-8 text-destructive/60 mx-auto" />
                <div>
                  <p className="text-sm font-bold text-foreground">Endereço necessário</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Cadastre seu endereço para receber a entrega
                  </p>
                </div>
                <button
                  onClick={() => setShowAddressModal(true)}
                  className="bg-primary text-primary-foreground font-bold px-6 py-2.5 rounded-xl text-sm active:scale-[0.98] transition-transform"
                >
                  Cadastrar Endereço
                </button>
              </div>
            )}
          </div>
        </section>

        {/* SECTION: Payment */}
        <section className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/50">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${paymentMethod ? "bg-primary/10" : "bg-muted"}`}>
              <CreditCard className={`h-4 w-4 ${paymentMethod ? "text-primary" : "text-muted-foreground"}`} />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-bold text-foreground">Forma de pagamento</h2>
            </div>
            {paymentMethod && <CheckCircle2 className="h-4 w-4 text-primary" />}
          </div>

          <div className="p-4 space-y-2">
            {paymentMethods.map((pm) => (
              <button
                key={pm.id}
                onClick={() => {
                  setPaymentMethod(pm.id);
                  if (pm.id !== "dinheiro") {
                    setNeedsChange(false);
                    setChangeFor("");
                  }
                }}
                className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all ${
                  paymentMethod === pm.id
                    ? "border-primary bg-primary/5"
                    : "border-transparent bg-muted/50 hover:bg-muted"
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  paymentMethod === pm.id ? "bg-primary/10" : "bg-background"
                }`}>
                  <pm.icon className={`h-5 w-5 ${paymentMethod === pm.id ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <div className="flex-1 text-left">
                  <span className={`text-sm font-bold block ${paymentMethod === pm.id ? "text-primary" : "text-foreground"}`}>
                    {pm.label}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{pm.desc}</span>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  paymentMethod === pm.id ? "border-primary" : "border-muted-foreground/30"
                }`}>
                  {paymentMethod === pm.id && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                </div>
              </button>
            ))}

            {paymentMethod === "dinheiro" && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 mt-1 space-y-3">
                <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold">
                  💰 Prepare o valor exato ou informe o troco
                </p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={needsChange}
                    onChange={(e) => setNeedsChange(e.target.checked)}
                    className="rounded border-border accent-primary"
                  />
                  <span className="text-sm text-foreground">Preciso de troco</span>
                </label>
                {needsChange && (
                  <div>
                    <label className="text-xs text-muted-foreground font-medium">Troco para quanto?</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Ex: 50, 100"
                      value={changeFor}
                      onChange={(e) => setChangeFor(e.target.value.replace(/[^0-9.,]/g, ""))}
                      className="w-full mt-1.5 px-3 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    {changeFor && parseFloat(changeFor) >= finalTotal && (
                      <p className="text-xs text-muted-foreground mt-1.5">
                        Seu troco: <span className="font-bold text-foreground">R$ {(parseFloat(changeFor) - finalTotal).toFixed(2)}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* SECTION: Coupon */}
        <section className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/50">
            <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center">
              <Tag className="h-4 w-4 text-muted-foreground" />
            </div>
            <h2 className="text-sm font-bold text-foreground">Cupom de desconto</h2>
          </div>
          <div className="p-4">
            <CouponInput
              subtotal={subtotal}
              storeId={items[0]?.store_id}
              onApply={(discount, id, code, type) => {
                setCouponDiscount(discount);
                setCouponId(id);
                setCouponCode(code);
                setCouponType(type);
              }}
              onRemove={() => {
                setCouponDiscount(0);
                setCouponId(null);
                setCouponCode(null);
                setCouponType(null);
              }}
              appliedCode={couponCode}
              appliedDiscount={couponDiscount}
            />
          </div>
        </section>

        {/* SECTION: Loyalty Points */}
        <section className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/50">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Star className="h-4 w-4 text-amber-500" />
            </div>
            <h2 className="text-sm font-bold text-foreground">Pontos de fidelidade</h2>
          </div>
          <div className="p-4">
            <LoyaltyRedemption
              storeId={storeId}
              subtotal={subtotal}
              onApply={(discount, points) => {
                setLoyaltyDiscount(discount);
                setLoyaltyPointsUsed(points);
              }}
              onRemove={() => {
                setLoyaltyDiscount(0);
                setLoyaltyPointsUsed(0);
              }}
              appliedPoints={loyaltyPointsUsed}
            />
          </div>
        </section>

        {/* SECTION: Summary */}
        <section className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/50">
            <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center">
              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
            </div>
            <h2 className="text-sm font-bold text-foreground">Resumo do pedido</h2>
            <span className="text-[11px] text-muted-foreground ml-auto">{items.length} {items.length === 1 ? "item" : "itens"}</span>
          </div>

          <div className="p-4 space-y-2.5">
            {items.map((item) => (
              <div key={item.cartKey || item.id} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-xs font-bold text-primary bg-primary/10 w-6 h-6 rounded-lg flex items-center justify-center shrink-0">
                    {item.quantity}
                  </span>
                  <span className="text-sm text-foreground truncate">{item.name}</span>
                </div>
                <span className="text-sm font-bold text-foreground shrink-0">
                  R$ {(item.price * item.quantity).toFixed(2)}
                </span>
              </div>
            ))}

            <div className="border-t border-border/50 pt-3 mt-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-semibold text-foreground">R$ {subtotal.toFixed(2)}</span>
              </div>

              {couponDiscount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-green-600 flex items-center gap-1">
                    <Tag className="h-3 w-3" /> {couponCode}
                  </span>
                  <span className="font-bold text-green-600">-R$ {couponDiscount.toFixed(2)}</span>
                </div>
              )}

              {loyaltyDiscount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-amber-600 flex items-center gap-1">
                    <Star className="h-3 w-3 fill-amber-500" /> {loyaltyPointsUsed} pontos
                  </span>
                  <span className="font-bold text-amber-600">-R$ {loyaltyDiscount.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Truck className="h-3 w-3" /> Entrega
                </span>
                <span className={`font-semibold ${couponType === "free_shipping" ? "text-green-600 line-through" : "text-foreground"}`}>
                  {calculatingFee ? "..." : `R$ ${activeDeliveryFee.toFixed(2)}`}
                </span>
              </div>

              {couponType === "free_shipping" && (
                <div className="flex justify-between text-sm">
                  <span className="text-green-600 font-medium">Frete grátis 🎉</span>
                  <span className="font-bold text-green-600">R$ 0,00</span>
                </div>
              )}
            </div>

            <div className="border-t-2 border-border pt-3">
              <div className="flex justify-between items-center">
                <span className="text-base font-bold text-foreground">Total</span>
                <span className="text-xl font-black text-primary">R$ {finalTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Fixed bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border p-4 space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-lg font-black text-primary">R$ {finalTotal.toFixed(2)}</span>
        </div>
        {isStoreClosed ? (
          <button
            disabled
            className="w-full bg-muted text-muted-foreground font-bold py-4 rounded-2xl text-base flex items-center justify-center gap-2 cursor-not-allowed"
          >
            <Clock className="h-5 w-5" />
            {storeStatus?.nextOpenDay && storeStatus?.nextOpenTime
              ? `${storeStatus.nextOpenDay === "Hoje" ? "Abre" : `Abre ${storeStatus.nextOpenDay}`} às ${storeStatus.nextOpenTime}`
              : "Loja fechada"}
          </button>
        ) : (
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-2xl active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-primary/25 text-base"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Enviando pedido...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                Confirmar Pedido
                <ChevronRight className="h-5 w-5" />
              </span>
            )}
          </button>
        )}
      </div>

      {showAddressModal && (
        <AddressModal
          onClose={() => setShowAddressModal(false)}
          onSaved={() => {
            setShowAddressModal(false);
            refetchProfile();
          }}
        />
      )}
    </div>
  );
};

export default CheckoutPage;
