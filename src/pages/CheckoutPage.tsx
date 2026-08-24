import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { pushNotifyNewOrder } from "@/lib/notifications";
import { ArrowLeft, MapPin, CreditCard, Banknote, QrCode, Edit3, Loader2, Truck, CheckCircle2, ShoppingBag, Tag, ChevronRight, Clock, AlertTriangle, Star, Wallet, Calendar, Store } from "lucide-react";
import { getStoreOpenStatus, type OpeningHour } from "@/lib/storeStatus";
import confetti from "canvas-confetti";
import AddressModal from "@/components/AddressModal";
import SavedAddressPicker from "@/components/SavedAddressPicker";
import AddressPinPicker from "@/components/AddressPinPicker";
import CouponInput from "@/components/CouponInput";
import { asDeliveryAddress, deliveryQuoteBreakdown, deliveryQuoteFailureMessage, hasUsableCoordinates, isSuccessfulDeliveryQuote, quoteErrorFromUnknown, quoteRequestKey, requestAuthenticatedDeliveryQuote, serializeDeliveryQuote, snapshotFromDeliveryQuote, type DeliveryQuote, type DeliveryQuoteFailure } from "@/lib/deliveryQuote";
import WhyThisCharge from "@/components/fees/WhyThisCharge";
import { addMoney, multiplyMoney, sumMoney, formatBRL } from "@/lib/utils";
import { useStorePlan } from "@/hooks/useStorePlan";
import LoyaltyRedemption from "@/components/LoyaltyRedemption";
import DeliveryTimeEstimate from "@/components/DeliveryTimeEstimate";
import { formatCep, fetchCep, reverseGeocode, readGpsFromGesture, type Coordinates, type ReverseResult } from "@/lib/location";
import { resolveDistance } from "@/lib/location/distance";
import { haversineMeters, isValidCoordinate } from "@/lib/location/distance";
import EmptiesExchange, { type EmptiesExchangeSelection } from "@/components/EmptiesExchange";
import { haptic } from "@/lib/haptics";

const allPaymentMethods = [
  { id: "pix_machine", label: "PIX na Maquininha",   desc: "PIX pela maquininha do lojista", icon: QrCode },
  { id: "pix_direto",  label: "Pix Direto",          desc: "Transferência à loja com comprovante", icon: QrCode },
  { id: "cartao",      label: "Cartão",               desc: "Débito ou crédito",       icon: CreditCard },
  { id: "dinheiro",    label: "Dinheiro",             desc: "Em espécie",              icon: Banknote },
];

const CheckoutPage = () => {
  const { items, neighborhood, neighborhoodFee, subtotal, total, clearCart, setNeighborhood } = useCart();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [paymentMethod, setPaymentMethod] = useState("");
  const [isPickup, setIsPickup] = useState(false);
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
  const [deliveryQuote, setDeliveryQuote] = useState<DeliveryQuote | null>(null);
  const [deliveryQuoteFailure, setDeliveryQuoteFailure] = useState<DeliveryQuoteFailure | null>(null);
  const [clientCoords, setClientCoords] = useState<Coordinates | null>(null);
   const [isLocationRequested, setIsLocationRequested] = useState(false);
   const [requestingLocation, setRequestingLocation] = useState(false);
   const [gpsAddress, setGpsAddress] = useState<ReverseResult | null>(null);
   const [coordsSource, setCoordsSource] = useState<"gps" | "address" | null>(null);
  const [showPinPicker, setShowPinPicker] = useState(false);
  const [showNumberPrompt, setShowNumberPrompt] = useState(false);
  const [numberInput, setNumberInput] = useState("");
  const [streetInput, setStreetInput] = useState("");
  const [neighborhoodInput, setNeighborhoodInput] = useState("");
  const [calculatingFee, setCalculatingFee] = useState(false);
  const [divergenceKm, setDivergenceKm] = useState<number | null>(null);
  const [loyaltyDiscount, setLoyaltyDiscount] = useState(0);
  const [loyaltyPointsUsed, setLoyaltyPointsUsed] = useState(0);
  const [loyaltyAvailable, setLoyaltyAvailable] = useState(false);
  const [useWallet, setUseWallet] = useState(false);
  const [scheduledFor, setScheduledFor] = useState<string>("");
  const [showSchedule, setShowSchedule] = useState(false);

  const { data: walletData } = useQuery({
    queryKey: ["user-wallet-checkout", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_wallet")
        .select("balance")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: 30_000,
  });
  const walletBalance = Number(walletData?.balance || 0);

  const { data: userProfile, refetch: refetchProfile } = useQuery({
    queryKey: ["my-profile-checkout", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("street, number, complement, neighborhood, reference_point, phone, whatsapp_number, cep, city")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const storeId = items[0]?.store_id;
  const storePlan = useStorePlan(storeId);
  const lastPaymentKey = user && storeId ? `last_payment_method:${user.id}:${storeId}` : null;


  // Filtrar métodos — storePaymentSettings declarado abaixo após storeData
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
         // 🔒 Inclui campos de km para cálculo correto da taxa de entrega
           .select("name, address_cep, address_city, latitude, longitude, delivery_mode, own_delivery_fee, settings, is_open, force_closed, delivery_fee_type, delivery_base_km, delivery_fee_base, delivery_fee_per_km, minimum_order_value, free_delivery_threshold, preorder_enabled, preorder_minutes_before, pix_direto_enabled, pix_direto_key")
         .eq("id", storeId!)
        .maybeSingle();
      return data;
    },
    enabled: !!storeId,
    staleTime: 1000 * 60 * 3,
  });

  // Ler quais métodos a loja aceita via settings — DEVE ficar após storeData
  const storePaymentSettings = useMemo(() => {
    const s = (storeData as any)?.settings || {};
    return {
      accept_pix_online:  s.accept_pix_online  !== false,
      accept_pix_machine: s.accept_pix_machine === true,
      accept_card:        s.accept_card        !== false,
      accept_cash:        s.accept_cash        !== false,
    };
  }, [storeData]);

  // Re-declarar paymentMethods usando storePaymentSettings (agora declarado na ordem certa)
  const filteredPaymentMethods = useMemo(() => {
    return allPaymentMethods.filter(pm => {
      if (pm.id === "pix_machine") return storePaymentSettings.accept_pix_machine;
      if (pm.id === "pix_direto")  return !!(storeData as any)?.pix_direto_enabled && !!(storeData as any)?.pix_direto_key;
      if (pm.id === "cartao")      return storePaymentSettings.accept_card;
      if (pm.id === "dinheiro")    return storePaymentSettings.accept_cash;
      return true;
    });
  }, [storePlan.allowPix, storePaymentSettings, storeData]);

  // Smart default: lembra a última forma de pagamento usada pelo usuário nesta loja
  useEffect(() => {
    if (!lastPaymentKey || paymentMethod) return;
    try {
      const saved = localStorage.getItem(lastPaymentKey);
      if (saved && filteredPaymentMethods.some((pm) => pm.id === saved)) {
        setPaymentMethod(saved);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastPaymentKey, filteredPaymentMethods.length]);

  // Tracking: visita ao checkout (etapa de funil)
  useEffect(() => {
    import("@/lib/pageView").then((m) => m.trackPageView("checkout", { storeId: storeId || null }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

   const storeStatus = storeData && storeHours && !('error' in storeData)
     ? getStoreOpenStatus(
         storeHours,
         (storeData as any).force_closed ?? false,
         (storeData as any).is_open ?? true,
         {
           enabled: !!(storeData as any).preorder_enabled,
           minutesBefore: Number((storeData as any).preorder_minutes_before ?? 0),
         },
       )
     : null;
  const isPreorder = !!(storeStatus?.acceptingPreorder && storeStatus.releaseAt);
  // Loja "fechada" para o checkout só se realmente não puder receber pedidos
  // (ou seja: fechada e SEM janela de pré-pedido ativa).
  const isStoreClosed = storeStatus ? (!storeStatus.isOpen && !isPreorder) : false;

  const profileNeighborhood = (userProfile as any)?.neighborhood;
  const profileStreet = (userProfile as any)?.street;
  const profileNumber = (userProfile as any)?.number;
  const profileComplement = (userProfile as any)?.complement;
  const profileReference = (userProfile as any)?.reference_point;
  const profileCep = (userProfile as any)?.cep;
  const hasAddress = !!profileStreet && !!profileNumber && !!profileNeighborhood;
  const storeCep = (storeData as any)?.address_cep;
  const storeMinimumOrderValue = Number((storeData as any)?.minimum_order_value || 0);
  const belowMinimum = storeMinimumOrderValue > 0 && subtotal < storeMinimumOrderValue;
  const minimumMissing = belowMinimum ? storeMinimumOrderValue - subtotal : 0;
  // A taxa exibida e gravada vem exclusivamente de quote-delivery.
  const activeDeliveryFee = isPickup ? 0 : Number(deliveryQuote?.pricing.delivery_fee || 0);
  const freeDeliveryByThreshold = !isPickup && Boolean(deliveryQuote?.pricing.free_delivery_applied);
  const storeAbsorbedDeliveryFee = isPickup ? 0 : Number(deliveryQuote?.pricing.platform_fee_store_absorbed || 0);
  const couponDeliveryCredit = couponType === "free_shipping" && !isPickup ? activeDeliveryFee : 0;
  const effectiveDeliveryFee = isPickup || freeDeliveryByThreshold ? 0 : activeDeliveryFee;
  const effectiveCouponDiscount = couponDiscount + couponDeliveryCredit;
  const walletDiscount = useWallet ? Math.min(walletBalance, Math.max(0, addMoney(subtotal, effectiveDeliveryFee, -effectiveCouponDiscount, -loyaltyDiscount))) : 0;
  const [emptiesSelections, setEmptiesSelections] = useState<EmptiesExchangeSelection[]>([]);
  const [emptiesDiscount, setEmptiesDiscount] = useState(0);
  const handleEmptiesChange = useCallback((sel: EmptiesExchangeSelection[], disc: number) => {
    setEmptiesSelections(sel);
    setEmptiesDiscount(disc);
  }, []);
  const finalTotal = Math.max(0, addMoney(subtotal, effectiveDeliveryFee, -effectiveCouponDiscount, -loyaltyDiscount, -walletDiscount, -emptiesDiscount));
  const quoteBreakdown = deliveryQuoteBreakdown(deliveryQuote);

  // Coordenadas de endereço salvo são apenas informativas. A cotação oficial
  // resolve endereço, distância e taxa sem reutilizar coordenadas ausentes/legadas.
  useEffect(() => {
    if (coordsSource === "gps" || !selectedSavedAddressId || !savedAddressData) return;
    if (hasUsableCoordinates(savedAddressData.latitude, savedAddressData.longitude)) {
      setClientCoords({ lat: Number(savedAddressData.latitude), lng: Number(savedAddressData.longitude) });
      if (coordsSource !== "address") setCoordsSource("address");
    } else {
      setClientCoords(null);
    }
  }, [selectedSavedAddressId, savedAddressData, coordsSource]);

   const handleRequestLocation = () => {
     // IMPORTANTE: chamar SÍNCRONO no clique — sem await antes — pra
     // preservar o "user gesture" que o browser exige pro prompt de GPS.
     const gpsPromise = readGpsFromGesture();
     setRequestingLocation(true);
      gpsPromise.then(async (gpsRead) => {
       try {
       const gps = gpsRead.coords;
      if (gps) {
        setClientCoords(gps);
         setIsLocationRequested(true);
         setCoordsSource("gps");
         // Reverse geocode para mostrar o endereço real do GPS
          const res = await reverseGeocode(gps);
          if (res) setGpsAddress(res);
          if (!res?.street || !(res.neighborhood || res.city)) {
            toast.warning("GPS encontrado, mas não identifiquei a rua. Complete o endereço antes de finalizar.");
            // Abre o mapa para o cliente arrastar o pino até a rua exata.
            setShowPinPicker(true);
          } else {
            toast.success("Localização atual ativada para esta entrega.");
          }
        } else {
          toast.error(gpsRead.error || "Não foi possível obter sua localização exata. Verifique se o GPS está ativado.");
       }
     } catch (e) {
       console.error("Error requesting location:", e);
     } finally {
       setRequestingLocation(false);
     }
     });
   };

  const deliveryAddressInput = useMemo(() => {
    const useGpsAddress = coordsSource === "gps" && isLocationRequested && !!clientCoords;
    if (useGpsAddress) {
      return asDeliveryAddress({
        street: gpsAddress?.street,
        number: gpsAddress?.number,
        neighborhood: gpsAddress?.neighborhood || gpsAddress?.city,
        city: gpsAddress?.city,
        state: gpsAddress?.state,
        cep: gpsAddress?.postalcode,
      });
    }
    if (selectedSavedAddressId && savedAddressData) {
      return asDeliveryAddress({
        street: savedAddressData.street,
        number: savedAddressData.number,
        complement: savedAddressData.complement,
        neighborhood: savedAddressData.neighborhood,
        city: savedAddressData.city,
        state: savedAddressData.state,
        cep: savedAddressData.cep,
      });
    }
    return asDeliveryAddress({
      street: profileStreet,
      number: profileNumber,
      complement: profileComplement,
      neighborhood: profileNeighborhood,
      city: (userProfile as any)?.city,
      state: (userProfile as any)?.state,
      cep: profileCep,
    });
  }, [coordsSource, isLocationRequested, clientCoords, gpsAddress, selectedSavedAddressId, savedAddressData, profileStreet, profileNumber, profileComplement, profileNeighborhood, profileCep, userProfile]);

  const deliveryQuoteInputKey = useMemo(
    () => quoteRequestKey(storeId, subtotal, deliveryAddressInput),
    [storeId, subtotal, deliveryAddressInput],
  );
  const quoteReady = isPickup || isSuccessfulDeliveryQuote(deliveryQuote);
  const quoteNeedsAddress = !isPickup && !deliveryAddressInput;
  const quoteFailureMessage = deliveryQuoteFailure ? deliveryQuoteFailureMessage(deliveryQuoteFailure) : null;

  useEffect(() => {
    if (isPickup) {
      setDeliveryQuote(null);
      setDeliveryQuoteFailure(null);
      setCalculatingFee(false);
      return;
    }
    if (!storeId || !user || !deliveryAddressInput) {
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
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("missing_authenticated_session");
        const quote = await requestAuthenticatedDeliveryQuote({
          accessToken: session.access_token,
          storeId,
          subtotal,
          address: deliveryAddressInput,
        });
        if (cancelled) return;
        if (!isSuccessfulDeliveryQuote(quote)) {
          setDeliveryQuote(null);
          setDeliveryQuoteFailure(quote);
          return;
        }
        setDeliveryQuote(quote);
        setDeliveryQuoteFailure(null);
        setNeighborhood(quote.destination?.neighborhood || deliveryAddressInput.neighborhood, Number(quote.pricing.delivery_fee || 0));
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
  }, [deliveryQuoteInputKey, deliveryAddressInput, isPickup, storeId, subtotal, user, setNeighborhood]);

  // Detecta divergência GPS x CEP do endereço salvo (Fase 4 do plano de GPS).
  useEffect(() => {
    if (isPickup) { setDivergenceKm(null); return; }
    const storeLat = Number((storeData as any)?.latitude);
    const storeLng = Number((storeData as any)?.longitude);
    if (!Number.isFinite(storeLat) || !Number.isFinite(storeLng)) { setDivergenceKm(null); return; }
    if (!clientCoords || !savedAddressData?.cep) { setDivergenceKm(null); return; }
    let cancelled = false;
    (async () => {
      const res = await resolveDistance({
        store: { lat: storeLat, lng: storeLng, cep: storeCep },
        customer: {
          lat: clientCoords.lat,
          lng: clientCoords.lng,
          cep: savedAddressData.cep,
          street: savedAddressData.street,
          number: savedAddressData.number,
          neighborhood: savedAddressData.neighborhood,
        },
      });
      if (cancelled) return;
      const warn = res?.warning || "";
      const m = /gps_cep_diverge_([\d.]+)km/.exec(warn);
      setDivergenceKm(m ? Number(m[1]) : null);
    })();
    return () => { cancelled = true; };
  }, [isPickup, clientCoords, savedAddressData, storeData, storeCep]);

  const buildAddressString = () => {
    if (!hasAddress) return "";
    const parts = [profileStreet, profileNumber];
    if (profileComplement) parts.push(profileComplement);
    if (profileReference) parts.push(`Ref: ${profileReference}`);
    return parts.join(", ");
  };

  const addressString = buildAddressString();
  const usingGpsDelivery = !isPickup && coordsSource === "gps" && isLocationRequested && !!clientCoords;
  const gpsAddressIsDeliverable = usingGpsDelivery && !!gpsAddress?.street && !!(gpsAddress.neighborhood || gpsAddress.city);

  // A distância apresentada ao cliente é a mesma distância validada pelo servidor.
  const quotedDistanceKm = !isPickup && deliveryQuote
    ? Number(deliveryQuote.distance.km)
    : null;

  // Distância direta (haversine) entre coords do GPS e coords do endereço cadastrado.
  const gpsVsSavedKm = useMemo(() => {
    if (!usingGpsDelivery || !clientCoords) return null;
    const rawLat = selectedSavedAddressId && savedAddressData ? savedAddressData.latitude : null;
    const rawLng = selectedSavedAddressId && savedAddressData ? savedAddressData.longitude : null;
    if (!hasUsableCoordinates(rawLat, rawLng)) return null;
    const cLat = Number(rawLat);
    const cLng = Number(rawLng);
    return haversineMeters(clientCoords, { lat: cLat, lng: cLng }) / 1000;
  }, [usingGpsDelivery, clientCoords, selectedSavedAddressId, savedAddressData]);

  const addressMatchState: "match" | "diverge" | null = useMemo(() => {
    if (gpsVsSavedKm == null) return null;
    return gpsVsSavedKm <= 0.3 ? "match" : "diverge";
  }, [gpsVsSavedKm]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (items.length > 0) {
        e.preventDefault();
        e.returnValue = "Você tem itens no carrinho. Deseja realmente sair?";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [items.length]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth", { state: { from: "/checkout" }, replace: true });
    } else if (items.length === 0) {
      navigate("/carrinho", { replace: true });
    }
  }, [authLoading, user, items.length, navigate]);

  if (authLoading || !user || items.length === 0) {
    return <div className="min-h-screen bg-background" />;
  }

   const handleConfirm = async () => {
    if (isStoreClosed) {
      toast.error(`Loja fechada. ${storeStatus?.reason || ""}`);
      return;
    }
    if (belowMinimum) {
      toast.error(`Pedido mínimo desta loja: ${formatBRL(storeMinimumOrderValue)}. Adicione mais ${formatBRL(minimumMissing)}.`);
      return;
    }
    let confirmedGpsAddress = gpsAddress;
    if (usingGpsDelivery && !confirmedGpsAddress && clientCoords) {
      confirmedGpsAddress = await reverseGeocode(clientCoords);
      if (confirmedGpsAddress) setGpsAddress(confirmedGpsAddress);
    }
    if (usingGpsDelivery && (!confirmedGpsAddress?.street || !(confirmedGpsAddress.neighborhood || confirmedGpsAddress.city))) {
      toast.error("Não consegui confirmar a rua da sua localização atual. Cadastre ou ajuste o endereço antes de finalizar.");
      setShowAddressModal(true);
      return;
    }

    const useSavedAddr = !usingGpsDelivery && selectedSavedAddressId && savedAddressData;
    const selectedAddressLat = useSavedAddr ? Number(savedAddressData.latitude) : NaN;
    const selectedAddressLng = useSavedAddr ? Number(savedAddressData.longitude) : NaN;
    const finalCoords = isPickup
      ? null
      : usingGpsDelivery && clientCoords
        ? clientCoords
        : Number.isFinite(selectedAddressLat) && Number.isFinite(selectedAddressLng)
          ? { lat: selectedAddressLat, lng: selectedAddressLng }
          : clientCoords;
    const finalHasAddress = isPickup || (usingGpsDelivery ? !!confirmedGpsAddress?.street : useSavedAddr || hasAddress);
    const finalNeighborhood = isPickup
      ? "RETIRADA"
      : usingGpsDelivery
        ? (confirmedGpsAddress?.neighborhood || confirmedGpsAddress?.city || "GPS")
        : (useSavedAddr ? savedAddressData.neighborhood : (profileNeighborhood || neighborhood));
    const finalAddress = isPickup
      ? "Retirada na loja"
      : usingGpsDelivery
        ? [
            confirmedGpsAddress?.street ? [confirmedGpsAddress.street, confirmedGpsAddress.number].filter(Boolean).join(", ") : null,
            confirmedGpsAddress?.neighborhood,
            confirmedGpsAddress?.city,
            "Localização atual por GPS",
          ].filter(Boolean).join(" - ")
        : (useSavedAddr
        ? [savedAddressData.street, savedAddressData.number, savedAddressData.complement, savedAddressData.reference_point ? `Ref: ${savedAddressData.reference_point}` : ""].filter(Boolean).join(", ")
        : addressString);

    if (!isPickup && !finalHasAddress) {
      setShowAddressModal(true);
      return;
    }
    if (!isPickup && !finalNeighborhood) {
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
     if (!userProfile?.whatsapp_number?.replace(/\D/g, "")) {
       toast.error("O WhatsApp é obrigatório para finalizar o pedido. Por favor, cadastre em seu perfil.");
       navigate("/perfil");
       return;
     }

    const restrictedPharmacyItem = items.find((item) => {
      const metadata = (item.metadata || {}) as Record<string, any>;
      return Boolean(
        metadata.requires_prescription ||
        metadata.controlled ||
        (metadata.sale_mode && metadata.sale_mode !== "platform_checkout")
      );
    });
    if (restrictedPharmacyItem) {
      toast.error("Este produto exige validação da farmácia", {
        description: "Remova o item do carrinho para continuar pelo checkout comum do ItaSuper.",
        duration: 7000,
      });
      return;
    }

    setLoading(true);
    try {
      // ===== Fase 3a: snapshot geográfico obrigatório para DELIVERY =====
      // O pedido só é criado depois que o endereço confirmado pelo cliente
      // é resolvido em coordenadas. Nada de UPDATE assíncrono depois.
      let deliverySnapshot: {
        address_details: string;
        neighborhood: string;
        delivery_cep: string;
        delivery_city: string;
        delivery_state: string;
        client_lat: number;
        client_lng: number;
      } | null = null;
      let quotedDeliveryFee = isPickup ? 0 : effectiveDeliveryFee;
      let quotedStoreAbsorbedFee = isPickup ? 0 : storeAbsorbedDeliveryFee;
      let deliveryQuoteSnapshot: Record<string, unknown> | null = null;

      if (!isPickup) {
        if (calculatingFee || !isSuccessfulDeliveryQuote(deliveryQuote)) {
          toast.error("Não foi possível confirmar a entrega", {
            description: deliveryQuoteFailureMessage(deliveryQuoteFailure),
            duration: 8000,
          });
          setLoading(false);
          return;
        }

        deliverySnapshot = snapshotFromDeliveryQuote(deliveryQuote);
        if (!deliverySnapshot.neighborhood || !deliverySnapshot.delivery_city || !/^[A-Z]{2}$/.test(deliverySnapshot.delivery_state)) {
          toast.error("Não foi possível confirmar o endereço de entrega", {
            description: "Complete corretamente rua, número, bairro, cidade/UF e CEP.",
            duration: 8000,
          });
          setLoading(false);
          return;
        }

        quotedDeliveryFee = Number(deliveryQuote.pricing.delivery_fee || 0);
        quotedStoreAbsorbedFee = Number(deliveryQuote.pricing.platform_fee_store_absorbed || 0);
        deliveryQuoteSnapshot = serializeDeliveryQuote(deliveryQuote);
      }

      const storeGroups = items.reduce((acc, item) => {
        if (!acc[item.store_id]) acc[item.store_id] = [];
        acc[item.store_id].push(item);
        return acc;
      }, {} as Record<string, typeof items>);

      const createdOrders: Array<{ storeId: string; orderId: string }> = [];

      for (const [storeId, storeItems] of Object.entries(storeGroups)) {
        const storeSubtotal = sumMoney(storeItems.map((item) => item.price * item.quantity));
        const appFee = 0; // Calculated by DB trigger using store's commission_rate
        const storeEmpties = emptiesSelections.filter(s =>
          storeItems.some(it => (it.metadata as any)?.returnable_group === s.group)
        );
        const storeEmptiesDiscount = storeEmpties.reduce((sum, s) => sum + s.qty * s.unit_price, 0);
        const storeTotalPrice = Math.max(0, addMoney(storeSubtotal, quotedDeliveryFee, -effectiveCouponDiscount, -loyaltyDiscount, -storeEmptiesDiscount));

        const changeValue = paymentMethod === "dinheiro" && needsChange ? addMoney(parseFloat(changeFor)) : 0;
        // Pré-pedido: se a loja ainda não abriu mas aceita pedidos agendados,
        // grava com status `scheduled` e `release_at`. O cron
        // `release_scheduled_orders()` migra para `pendente` no horário.
        const orderStatus = paymentMethod === "pix"
          ? "aguardando_pagamento"
          : paymentMethod === "pix_direto"
            ? "aguardando_comprovante"
            : (isPreorder ? "scheduled" : "pendente");
        const releaseAt = isPreorder && paymentMethod !== "pix" ? storeStatus?.releaseAt : null;
        // pix_machine = físico (igual cartão/dinheiro) — não aguarda confirmação Asaas
        const { data: order, error: orderError } = await supabase
          .from("orders")
          .insert({
            client_id: user.id,
            store_id: storeId,
            subtotal: storeSubtotal,
            delivery_fee: quotedDeliveryFee,
            delivery_fee_absorbed_by_store: quotedStoreAbsorbedFee,
            commission_rate: storePlan.commissionRate ?? 0,
            total_price: storeTotalPrice,
            wallet_discount: walletDiscount,
            app_fee: appFee,
            payment_method: paymentMethod,
            neighborhood: deliverySnapshot?.neighborhood ?? finalNeighborhood,
            address_details: deliverySnapshot?.address_details ?? finalAddress,
            delivery_cep: deliverySnapshot?.delivery_cep ?? null,
            delivery_city: deliverySnapshot?.delivery_city ?? null,
            delivery_state: deliverySnapshot?.delivery_state ?? null,
            client_lat: deliverySnapshot?.client_lat ?? null,
            client_lng: deliverySnapshot?.client_lng ?? null,
            needs_change: paymentMethod === "dinheiro" && needsChange,
            change_for: changeValue,
            status: orderStatus,
            scheduled_for: scheduledFor ? new Date(scheduledFor).toISOString() : null,
            release_at: releaseAt,
            metadata: deliveryQuoteSnapshot || storeEmpties.length > 0
              ? {
                  ...(deliveryQuoteSnapshot ? { delivery_quote: deliveryQuoteSnapshot } : {}),
                  ...(storeEmpties.length > 0 ? { empties_exchange: storeEmpties } : {}),
                }
              : null,
          } as any)
          .select("id")
          .single();

        if (orderError) throw orderError;

        createdOrders.push({ storeId, orderId: order.id });

        // Resgatar pontos de fidelidade se foram aplicados
        if (loyaltyPointsUsed > 0 && loyaltyDiscount > 0) {
          const { error: loyaltyErr } = await (supabase as any).rpc("redeem_loyalty_points", {
            _order_id: order.id,
            _store_id: storeId,
            _points_to_use: loyaltyPointsUsed,
          });
          if (loyaltyErr) {
            console.warn("[loyalty] Erro ao resgatar pontos:", loyaltyErr.message);
            // Não bloqueia o pedido — pontos podem ser ajustados manualmente
          }
        }

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

        // FIX: Debitar wallet se cliente usou crédito
        if (walletDiscount > 0 && user) {
          const { error: walletErr } = await supabase.rpc("apply_wallet_discount" as any, {
            _order_id: order.id,
            _user_id: user.id,
            _discount_amount: walletDiscount,
          });
          if (walletErr) {
            // Não bloquear o pedido — logar e seguir
            console.error("[checkout] wallet debit error:", walletErr.message);
          }
        }

        if (couponId && user) {
          // Fire-and-forget: don't block UI on coupon registration
          supabase.rpc("use_coupon" as any, {
            _coupon_id: couponId,
            _user_id: user.id,
            _order_id: order.id,
          }).then(({ error: couponError }) => {
            if (couponError) console.warn("Coupon usage error:", couponError.message);
          });
        }
      }

      // Clear cart + navigate IMMEDIATELY — push notifications and geocoding patching happen in background
      clearCart();
      if (paymentMethod === "pix") {
        toast.success("Pedido criado! Acesse 'Meus Pedidos' para pagar com PIX.", { duration: 5000 });
        navigate("/pedidos?new_order=1");
      } else if (paymentMethod === "pix_direto") {
        const first = createdOrders[0];
        toast.success("Pedido criado! Envie o comprovante do PIX.");
        navigate(first ? `/pix-direto/${first.orderId}` : "/pedidos?new_order=1", { replace: true });
      } else if (paymentMethod === "pix_machine") {
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.7 } });
        toast.success("Pedido enviado! Pague via PIX na maquininha na entrega.");
        navigate("/pedidos?new_order=1", { replace: true });
      } else {
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.7 } });
        toast.success("Pedido enviado com sucesso! Acompanhe pelo chat.");
        navigate("/pedidos?new_order=1", { replace: true });
      }

      // Background tasks (non-blocking): notify store owners
      (async () => {
        if (paymentMethod !== "pix") { // pix_machine e cartão/dinheiro notificam o lojista
          for (const { storeId, orderId } of createdOrders) {
            try {
              const { data: storeData } = await supabase
                .from("stores_public")
                .select("owner_id")
                .eq("id", storeId)
                .single();
              if (storeData?.owner_id) {
                pushNotifyNewOrder([storeData.owner_id], orderId).catch(console.error);
              }
            } catch (e) {
              console.warn("notify store owner error:", e);
            }
          }
        }
      })();

    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar pedido.");
    } finally {
      setLoading(false);
    }
  };

  const hasValidAddress = isPickup || (usingGpsDelivery ? gpsAddressIsDeliverable : (selectedSavedAddressId ? !!savedAddressData : hasAddress));
  const stepsDone = [isPickup || hasValidAddress, !!paymentMethod];

  return (
    <div className="min-h-screen bg-background pb-56 overflow-y-auto">
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

      {/* Progress steps — profissional, com checkmarks */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-1.5">
          {[isPickup ? "Retirada" : "Endereço", "Pagamento", "Confirmar"].map((step, i) => {
            const done = i < stepsDone.filter(Boolean).length;
            const active = i === stepsDone.filter(Boolean).length;
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
                  {i < 2 && (
                    <div
                      className={`flex-1 h-0.5 rounded-full transition-all ${
                        done ? "bg-primary" : "bg-muted"
                      }`}
                    />
                  )}
                </div>
                <p
                  className={`text-[10px] mt-1.5 font-bold ${
                    done || active ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {step}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-4 py-2 space-y-4">
        {/* SECTION: Delivery Mode Toggle */}
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
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Seu pedido ficará pronto para retirada. Sem taxa de entrega! 🎉
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* SECTION: Address (hidden for pickup) */}
        {!isPickup && (
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
                setGpsAddress(null);
                setIsLocationRequested(false);
                setCoordsSource("address");
                setDeliveryQuote(null);
                setDeliveryQuoteFailure(null);
                if (hasUsableCoordinates((addr as any).latitude, (addr as any).longitude)) {
                  setClientCoords({ lat: Number((addr as any).latitude), lng: Number((addr as any).longitude) });
                } else {
                  setClientCoords(null);
                }
              }}
            />

            {divergenceKm != null && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-500/10 p-3">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                    Sua localização atual está a {divergenceKm.toFixed(1)} km do endereço salvo
                  </p>
                  <p className="text-[11px] text-amber-700/90 dark:text-amber-200/80 mt-0.5">
                    Confirme se o endereço de entrega abaixo está correto antes de finalizar o pedido.
                  </p>
                </div>
              </div>
            )}

            {/* CARD 1: Endereço cadastrado (saved address ou profile) */}
            {(selectedSavedAddressId && savedAddressData) || (!selectedSavedAddressId && hasAddress) ? (
              <div className={`rounded-xl p-3.5 space-y-1.5 border ${usingGpsDelivery ? "bg-muted/30 border-border/50 opacity-70" : "bg-primary/5 border-primary/20"}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-foreground bg-muted px-1.5 py-0.5 rounded">📮 CADASTRADO</span>
                    {!usingGpsDelivery && <span className="text-[10px] text-primary font-semibold">Em uso</span>}
                  </div>
                  {quotedDistanceKm != null && (
                    <span className="text-[10px] font-semibold text-muted-foreground">≈ {quotedDistanceKm.toFixed(1)} km da loja</span>
                  )}
                </div>
                {selectedSavedAddressId && savedAddressData ? (
                  <>
                    <p className="text-sm font-bold text-foreground">
                      {savedAddressData.street}, {savedAddressData.number}
                      {savedAddressData.complement ? ` - ${savedAddressData.complement}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">{savedAddressData.neighborhood}</p>
                    {savedAddressData.reference_point && (
                      <p className="text-xs text-muted-foreground">📍 {savedAddressData.reference_point}</p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-sm font-bold text-foreground">
                      {profileStreet}, {profileNumber}
                      {profileComplement ? ` - ${profileComplement}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">{profileNeighborhood}</p>
                    {profileReference && (
                      <p className="text-xs text-muted-foreground">📍 {profileReference}</p>
                    )}
                  </>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-border/30">
                  {calculatingFee ? (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> Calculando taxa...
                    </span>
                  ) : !usingGpsDelivery ? (
                    <div className="flex items-center gap-1.5">
                      <Truck className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-bold text-primary">{formatBRL(activeDeliveryFee)}</span>
                    </div>
                  ) : <span />}
                  {selectedSavedAddressId ? (
                    <button
                      onClick={() => { setSelectedSavedAddressId(null); setSavedAddressData(null); setGpsAddress(null); setIsLocationRequested(false); setCoordsSource(null); setClientCoords(null); setDeliveryQuote(null); setDeliveryQuoteFailure(null); }}
                      className="text-xs text-primary font-semibold"
                    >
                      Alterar
                    </button>
                  ) : (
                    <button onClick={() => navigate("/perfil")} className="text-xs text-primary font-semibold flex items-center gap-1">
                      <Edit3 className="h-3 w-3" /> Alterar
                    </button>
                  )}
                </div>
              </div>
            ) : null}

            {/* CARD 2: Localização atual (GPS) — sempre separado */}
            {(hasAddress || (selectedSavedAddressId && savedAddressData) || usingGpsDelivery) && (
              <div className={`rounded-xl p-3.5 space-y-2 border-2 ${usingGpsDelivery ? "bg-primary/5 border-primary/40 border-solid" : "border-dashed border-primary/25"}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground leading-tight">Usar minha localização atual</p>
                      <p className="text-[10px] text-muted-foreground">GPS do celular — mais preciso</p>
                    </div>
                  </div>
                  {usingGpsDelivery ? (
                    <span className="text-[10px] font-bold text-primary bg-primary/15 px-2 py-1 rounded">ATIVO</span>
                  ) : (
                    <button
                      onClick={handleRequestLocation}
                      disabled={requestingLocation}
                      className="text-xs font-bold text-primary-foreground bg-primary px-3 py-1.5 rounded-lg flex items-center gap-1 disabled:opacity-50"
                    >
                      {requestingLocation ? <Loader2 className="h-3 w-3 animate-spin" /> : "Ativar"}
                    </button>
                  )}
                </div>

                {usingGpsDelivery && gpsAddress && (
                  <div className="pt-1 border-t border-border/30 space-y-1.5">
                    <p className="text-sm font-bold text-foreground">{gpsAddress.display}</p>
                    {addressMatchState === "match" && (
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" /> Localização confere com o endereço cadastrado
                      </div>
                    )}
                    {addressMatchState === "diverge" && gpsVsSavedKm != null && (
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="h-3 w-3" /> {gpsVsSavedKm.toFixed(1)} km do endereço cadastrado
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1">
                      {calculatingFee ? (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" /> Calculando taxa...
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <Truck className="h-3.5 w-3.5 text-primary" />
                          <span className="text-xs font-bold text-primary">{formatBRL(activeDeliveryFee)}</span>
                        </div>
                      )}
                      <button
                        onClick={() => { setGpsAddress(null); setIsLocationRequested(false); setCoordsSource(selectedSavedAddressId ? "address" : null); setClientCoords(selectedSavedAddressId && hasUsableCoordinates(savedAddressData?.latitude, savedAddressData?.longitude) ? { lat: Number(savedAddressData.latitude), lng: Number(savedAddressData.longitude) } : null); }}
                        className="text-xs text-muted-foreground font-semibold"
                      >
                        Voltar ao cadastrado
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!selectedSavedAddressId && !hasAddress && !usingGpsDelivery && (
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
        )}

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
            {filteredPaymentMethods.map((pm) => (
              <button
                key={pm.id}
                onClick={() => {
                  setPaymentMethod(pm.id);
                  haptic.light();
                  if (lastPaymentKey) {
                    try { localStorage.setItem(lastPaymentKey, pm.id); } catch {}
                  }
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
                        Seu troco: <span className="font-bold text-foreground">{formatBRL((parseFloat(changeFor) - finalTotal))}</span>
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
        <section className={`bg-card rounded-2xl border border-border overflow-hidden ${loyaltyAvailable ? "" : "hidden"}`}>
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
              onAvailabilityChange={setLoyaltyAvailable}
            />
          </div>
        </section>

        {/* SECTION: Wallet Credit */}
        {walletBalance > 0 && (
          <section className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/50">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Wallet className="h-4 w-4 text-emerald-500" />
              </div>
              <h2 className="text-sm font-bold text-foreground flex-1">Crédito na plataforma</h2>
              <span className="text-xs font-bold text-emerald-600">{formatBRL(walletBalance)}</span>
            </div>
            <div className="p-4">
              <button
                onClick={() => setUseWallet(!useWallet)}
                className={`w-full flex items-center justify-between p-3.5 rounded-xl border-2 transition-all ${
                  useWallet ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30" : "border-transparent bg-muted/50"
                }`}
              >
                <span className="text-sm font-medium text-foreground">
                  {useWallet ? `Usando ${formatBRL(walletDiscount)} de crédito` : "Usar crédito neste pedido"}
                </span>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  useWallet ? "border-emerald-500 bg-emerald-500" : "border-muted-foreground"
                }`}>
                  {useWallet && <CheckCircle2 className="h-3 w-3 text-white" />}
                </div>
              </button>
            </div>
          </section>
        )}

        {/* SECTION: Schedule */}
        <section className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/50">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Calendar className="h-4 w-4 text-blue-500" />
            </div>
            <h2 className="text-sm font-bold text-foreground flex-1">{isPickup ? "Agendar retirada" : "Agendar entrega"}</h2>
            {scheduledFor && <CheckCircle2 className="h-4 w-4 text-primary" />}
          </div>
          <div className="p-4 space-y-3">
            <div className="flex gap-2">
              <button
                onClick={() => { setShowSchedule(false); setScheduledFor(""); }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border-2 ${
                  !showSchedule ? "border-primary bg-primary/5 text-primary" : "border-transparent bg-muted/50 text-foreground"
                }`}
              >
                🚀 Agora
              </button>
              <button
                onClick={() => setShowSchedule(true)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border-2 ${
                  showSchedule ? "border-primary bg-primary/5 text-primary" : "border-transparent bg-muted/50 text-foreground"
                }`}
              >
                📅 Agendar
              </button>
            </div>
            {showSchedule && (
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground font-medium">Data e horário da entrega</label>
                <input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  min={new Date(Date.now() + 30 * 60000).toISOString().slice(0, 16)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                {scheduledFor && (
                  <p className="text-xs text-primary font-medium flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Agendado para {new Date(scheduledFor).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                  </p>
                )}
              </div>
            )}
            {!showSchedule && !isStoreClosed && (
              <div className="flex items-center gap-2">
                <DeliveryTimeEstimate status="pendente" createdAt={new Date().toISOString()} />
                <span className="text-xs text-muted-foreground">{isPickup ? "Estimativa de retirada" : "Estimativa de entrega"}</span>
              </div>
            )}
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
                  {formatBRL((item.price * item.quantity))}
                </span>
              </div>
            ))}

            {items[0] && (
              <EmptiesExchange
                storeId={items[0].store_id}
                items={items}
                onChange={handleEmptiesChange}
              />
            )}

            <div className="border-t border-border/50 pt-3 mt-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-semibold text-foreground">{formatBRL(subtotal)}</span>
              </div>

              {emptiesDiscount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-emerald-600 flex items-center gap-1">
                    ♻️ Troca de casquinhas
                  </span>
                  <span className="font-bold text-emerald-600">-{formatBRL(emptiesDiscount)}</span>
                </div>
              )}

              {couponDiscount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-green-600 flex items-center gap-1">
                    <Tag className="h-3 w-3" /> {couponCode}
                  </span>
                  <span className="font-bold text-green-600">-{formatBRL(couponDiscount)}</span>
                </div>
              )}

              {loyaltyDiscount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-amber-600 flex items-center gap-1">
                    <Star className="h-3 w-3 fill-amber-500" /> {loyaltyPointsUsed} pontos
                  </span>
                  <span className="font-bold text-amber-600">-{formatBRL(loyaltyDiscount)}</span>
                </div>
              )}

              {walletDiscount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-emerald-600 flex items-center gap-1">
                    <Wallet className="h-3 w-3" /> Crédito
                  </span>
                  <span className="font-bold text-emerald-600">-{formatBRL(walletDiscount)}</span>
                </div>
              )}

              {!isPickup && (
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Truck className="h-3 w-3" /> Taxa de entrega
                      <WhyThisCharge title="Como é calculada a taxa de entrega">
                        <p>A taxa segue a configuração da loja: valor fixo ou por quilômetro, além da parcela operacional conforme a opção escolhida pelo lojista.</p>
                        <p className="mt-2">A parcela operacional pode ser paga pelo cliente, dividida com a loja ou absorvida integralmente pela loja. Em retirada, não há taxa de entrega.</p>
                      </WhyThisCharge>
                    </span>
                    <span className={`font-semibold ${(couponType === "free_shipping" || freeDeliveryByThreshold) ? "text-green-600 line-through" : "text-foreground"}`}>
                      {calculatingFee ? (
                        <span className="inline-flex items-center gap-1 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Calculando</span>
                      ) : quoteNeedsAddress ? (
                        <span className="text-muted-foreground">Informe o endereço</span>
                      ) : quoteFailureMessage ? (
                        <span className="text-destructive">Indisponível</span>
                      ) : isSuccessfulDeliveryQuote(deliveryQuote) ? (
                        formatBRL(activeDeliveryFee)
                      ) : (
                        <span className="text-muted-foreground">A calcular</span>
                      )}
                    </span>
                  </div>
                  {quoteFailureMessage && <p className="text-[11px] text-destructive pl-4">{quoteFailureMessage}</p>}
                </div>
              )}

              {!isPickup && freeDeliveryByThreshold && (
                <div className="flex justify-between text-sm">
                  <span className="text-green-600 font-medium">🚚 Frete grátis (cortesia da loja)</span>
                  <span className="font-bold text-green-600">R$ 0,00</span>
                </div>
              )}

              {!isPickup && quoteBreakdown && couponType !== "free_shipping" && (
                <p className="-mt-1 pl-4 text-[11px] text-muted-foreground/80">{quoteBreakdown}</p>
              )}

              {!isPickup && couponType === "free_shipping" && (
                <div className="flex justify-between text-sm">
                  <span className="text-green-600 font-medium">Frete grátis 🎉</span>
                  <span className="font-bold text-green-600">R$ 0,00</span>
                </div>
              )}

              {isPickup && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Store className="h-3 w-3" /> Retirada
                  </span>
                  <span className="font-bold text-green-600">Grátis ✨</span>
                </div>
              )}
            </div>

            <div className="border-t-2 border-border pt-3">
              <div className="flex justify-between items-center">
                <span className="text-base font-bold text-foreground">Total</span>
                <span className="text-xl font-black text-primary">{formatBRL(finalTotal)}</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* CTA — barra fixa no rodapé, estilo app profissional */}
      <div role="region" aria-label="Resumo e finalização do pedido" className="native-hide-while-keyboard fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border shadow-[0_-4px_20px_-8px_rgba(0,0,0,0.15)] px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)] space-y-2.5">
        {/* Total */}
        <div className="flex items-center justify-between py-1" aria-live="polite" aria-atomic="true">
          <span className="text-base font-bold text-foreground">Total</span>
          <span className="text-2xl font-black text-primary" aria-label={quoteReady ? `Total ${formatBRL(finalTotal)}` : "Total será calculado após validar a entrega"}>{quoteReady ? formatBRL(finalTotal) : "A calcular"}</span>
        </div>

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

        {/* Botão */}
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
        ) : !isPickup && !hasValidAddress ? (
          <button
            onClick={usingGpsDelivery ? () => setShowAddressModal(true) : handleRequestLocation}
            disabled={requestingLocation}
            className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-2xl active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-primary/25 text-base flex items-center justify-center gap-2"
          >
            {requestingLocation ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Buscando GPS...
              </>
            ) : (
              <>
                <MapPin className="h-5 w-5" />
                {usingGpsDelivery ? "Completar endereço" : "Ativar Localização"}
              </>
            )}
          </button>
        ) : !isPickup && calculatingFee ? (
          <button disabled className="w-full bg-muted text-muted-foreground font-bold py-4 rounded-2xl text-base flex items-center justify-center gap-2 cursor-not-allowed">
            <Loader2 className="w-5 h-5 animate-spin" /> Calculando entrega...
          </button>
        ) : !isPickup && !quoteReady ? (
          <button onClick={() => setShowAddressModal(true)} className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-2xl active:scale-[0.98] transition-all shadow-lg shadow-primary/25 text-base flex items-center justify-center gap-2">
            <MapPin className="w-5 h-5" /> Revisar endereço de entrega
          </button>
        ) : (
          <button
            onClick={handleConfirm}
            disabled={loading || belowMinimum}
            className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-2xl active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-primary/25 text-base"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Enviando pedido...
              </span>
            ) : belowMinimum ? (
              <span className="flex items-center justify-center gap-2">
                Faltam {formatBRL(minimumMissing)} para o mínimo
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                Confirmar Pedido
                <ChevronRight className="h-5 w-5" />
              </span>
            )}
          </button>
        )}

        {/* Motivo inline quando o CTA não pode finalizar — evita toast e dá feedback claro */}
        {!isStoreClosed && !belowMinimum && !loading && (
          (!isPickup && !hasValidAddress) ? (
            <p className="text-[11px] text-center text-muted-foreground">
              Informe um endereço de entrega para continuar
            </p>
          ) : !paymentMethod ? (
            <p className="text-[11px] text-center text-muted-foreground">
              Escolha a forma de pagamento para continuar
            </p>
          ) : null
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

      {showPinPicker && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-background w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl p-4 space-y-3 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold">Confirme sua rua no mapa</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Arraste o pino até a porta da sua casa e toque em <b>Confirmar</b>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPinPicker(false)}
                className="text-muted-foreground text-xs font-bold px-2 py-1"
                aria-label="Fechar"
              >
                Fechar
              </button>
            </div>
            <AddressPinPicker
              initialLat={clientCoords?.lat ?? null}
              initialLng={clientCoords?.lng ?? null}
              height={360}
              onCancel={() => setShowPinPicker(false)}
              onConfirm={(coords, rev) => {
                setClientCoords(coords);
                setCoordsSource("gps");
                setIsLocationRequested(true);
                setGpsAddress((prev) => ({
                  ...(prev || {} as any),
                  ...(rev || {}),
                  display:
                    [rev?.street, rev?.neighborhood].filter(Boolean).join(" - ") ||
                    (prev as any)?.display ||
                    "",
                } as ReverseResult));
                setShowPinPicker(false);
                if (rev?.street) {
                  toast.success("Rua confirmada. Agora informe o número.");
                } else {
                  toast.warning("Não consegui a rua nesse ponto — confirme o número mesmo assim.");
                }
                setNumberInput(rev?.number || "");
                setStreetInput(rev?.street || "");
                setNeighborhoodInput(rev?.neighborhood || "");
                setShowNumberPrompt(true);
              }}
            />
          </div>
        </div>
      )}

      {showNumberPrompt && (
        <div className="fixed inset-0 z-[110] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-background w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl p-4 space-y-3">
            <div>
              <h3 className="text-base font-bold">Confirme o endereço</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {gpsAddress?.street
                  ? "O GPS não sabe o número exato. Informe pra entrega chegar certo."
                  : "Não identifiquei a rua pelo GPS — preencha manualmente."}
              </p>
            </div>
            {!gpsAddress?.street && (
              <>
                <input
                  type="text"
                  autoFocus
                  value={streetInput}
                  onChange={(e) => setStreetInput(e.target.value)}
                  placeholder="Rua / Avenida"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-medium"
                />
                <input
                  type="text"
                  value={neighborhoodInput}
                  onChange={(e) => setNeighborhoodInput(e.target.value)}
                  placeholder="Bairro"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-medium"
                />
              </>
            )}
            <input
              type="text"
              inputMode="numeric"
              autoFocus={!!gpsAddress?.street}
              value={numberInput}
              onChange={(e) => setNumberInput(e.target.value)}
              placeholder="Ex: 524"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-medium"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowNumberPrompt(false)}
                className="flex-1 py-2 rounded-lg bg-muted text-muted-foreground text-xs font-bold"
              >
                Depois
              </button>
              <button
                type="button"
                onClick={() => {
                  const num = numberInput.trim();
                  if (!num) {
                    toast.error("Informe o número.");
                    return;
                  }
                  const hadStreet = !!gpsAddress?.street;
                  const manualStreet = streetInput.trim();
                  const manualNeighborhood = neighborhoodInput.trim();
                  if (!hadStreet && !manualStreet) {
                    toast.error("Informe o nome da rua.");
                    return;
                  }
                  setGpsAddress((prev) => {
                    const base = (prev || {}) as ReverseResult;
                    const finalStreet = base.street || manualStreet || null;
                    const finalNeighborhood = base.neighborhood || manualNeighborhood || null;
                    const display = [finalStreet ? `${finalStreet}, ${num}` : null, finalNeighborhood]
                      .filter(Boolean)
                      .join(" - ") || base.display || "";
                    return { ...base, street: finalStreet, neighborhood: finalNeighborhood, number: num, display } as ReverseResult;
                  });
                  setShowNumberPrompt(false);
                  toast.success("Endereço confirmado.");
                }}
                className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckoutPage;
