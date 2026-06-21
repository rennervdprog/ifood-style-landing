import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AsaasBadgeBar } from "@/components/AsaasBadge";
import { toast } from "sonner";
import { pushNotifyNewOrder } from "@/lib/notifications";
import { ArrowLeft, MapPin, CreditCard, Banknote, QrCode, Edit3, Loader2, Truck, CheckCircle2, ShoppingBag, Tag, ChevronRight, Clock, AlertTriangle, Star, Wallet, Calendar, Store } from "lucide-react";
import { getStoreOpenStatus, type OpeningHour } from "@/lib/storeStatus";
import confetti from "canvas-confetti";
import AddressModal from "@/components/AddressModal";
import SavedAddressPicker from "@/components/SavedAddressPicker";
import CouponInput from "@/components/CouponInput";
 import { calculateDeliveryFee, calculateStoreOwnDeliveryFee, DEFAULT_DELIVERY_FEE_CONFIG, type DeliveryFeeConfig } from "@/lib/deliveryFee";
import WhyThisCharge from "@/components/fees/WhyThisCharge";
import { formatCep, fetchCep } from "@/lib/cepLookup";
import { addMoney, multiplyMoney, sumMoney, formatBRL } from "@/lib/utils";
import { useStorePlan } from "@/hooks/useStorePlan";
import LoyaltyRedemption from "@/components/LoyaltyRedemption";
import DeliveryTimeEstimate from "@/components/DeliveryTimeEstimate";
import { resolveAddressContext, reverseGeocode, type Coordinates, type ReverseGeocodeResult } from "@/lib/addressGeocoding";
import { getBestClientCoordinates, getDeviceGPS } from "@/lib/deviceLocation";
import { checkStoreAccess, MAX_DISTANCE_KM } from "@/lib/fraudCheck";
import EmptiesExchange, { type EmptiesExchangeSelection } from "@/components/EmptiesExchange";
import { haptic } from "@/lib/haptics";

const allPaymentMethods = [
  { id: "pix",         label: "PIX Online",         desc: "Pagamento instantâneo",   icon: QrCode },
  { id: "pix_machine", label: "PIX na Maquininha",   desc: "PIX pela maquininha do lojista", icon: QrCode },
  { id: "cartao",      label: "Cartão",               desc: "Débito ou crédito",       icon: CreditCard },
  { id: "dinheiro",    label: "Dinheiro",             desc: "Em espécie",              icon: Banknote },
];

const CheckoutPage = () => {
  const { items, neighborhood, neighborhoodFee, subtotal, total, clearCart, setNeighborhood } = useCart();
  const { user } = useAuth();
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
   const [calculatedDeliveryFee, setCalculatedDeliveryFee] = useState<number | null>(null);
   const [clientCoords, setClientCoords] = useState<Coordinates | null>(null);
   const [isLocationRequested, setIsLocationRequested] = useState(false);
   const [requestingLocation, setRequestingLocation] = useState(false);
   const [gpsAddress, setGpsAddress] = useState<ReverseGeocodeResult | null>(null);
   const [coordsSource, setCoordsSource] = useState<"gps" | "address" | null>(null);
  const [calculatingFee, setCalculatingFee] = useState(false);
  const [feeBreakdown, setFeeBreakdown] = useState<string | null>(null);
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
        .select("street, number, complement, neighborhood, reference_point, phone, whatsapp_number, cep")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
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
    staleTime: 1000 * 60 * 10, // config rarely changes
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
           .select("name, address_cep, address_city, latitude, longitude, delivery_mode, own_delivery_fee, settings, is_open, force_closed, delivery_fee_type, delivery_base_km, delivery_fee_base, delivery_fee_per_km, minimum_order_value, free_delivery_threshold")
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
      if (pm.id === "pix")         return storePlan.allowPix && storePaymentSettings.accept_pix_online;
      if (pm.id === "pix_machine") return storePaymentSettings.accept_pix_machine;
      if (pm.id === "cartao")      return storePaymentSettings.accept_card;
      if (pm.id === "dinheiro")    return storePaymentSettings.accept_cash;
      return true;
    });
  }, [storePlan.allowPix, storePaymentSettings]);

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
     ? getStoreOpenStatus(storeHours, (storeData as any).force_closed ?? false, (storeData as any).is_open ?? true)
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
  const storeSettings = ((storeData as any)?.settings || {}) as Record<string, any>;
  const storeDeliveryFeeType = ((storeData as any)?.delivery_fee_type || storeSettings.delivery_fee_type || "fixed") as "fixed" | "km";
  const storeDeliveryBaseKm = Number((storeData as any)?.delivery_base_km ?? storeSettings.delivery_base_km ?? 0);
  const storeDeliveryFeeBase = Number((storeData as any)?.delivery_fee_base ?? storeSettings.delivery_fee_base ?? 0);
  const storeDeliveryFeePerKm = Number((storeData as any)?.delivery_fee_per_km ?? storeSettings.delivery_fee_per_km ?? 0);
  const storeMinimumOrderValue = Number((storeData as any)?.minimum_order_value || 0);
  const belowMinimum = storeMinimumOrderValue > 0 && subtotal < storeMinimumOrderValue;
  const minimumMissing = belowMinimum ? storeMinimumOrderValue - subtotal : 0;
  const isKmOwnDelivery = isOwnDelivery && storeDeliveryFeeType === "km";
  // For own delivery stores on FIXED plan: always add platform split on top of store's own fee.
  // Fallback to admin_settings.platform_split (default R$2) if useStorePlan is still loading
  // or hasn't computed the split yet, so the customer always sees the correct total.
  const platformSplitFallback = config.platform_split ?? DEFAULT_DELIVERY_FEE_CONFIG.platform_split;
  const effectivePlatformSplit = isOwnDelivery
    ? (storePlan.platformDeliverySplit > 0 ? storePlan.platformDeliverySplit : platformSplitFallback)
    : 0;
  const ownDeliveryFallbackFee = isKmOwnDelivery
    ? addMoney(storeDeliveryFeeBase, effectivePlatformSplit)
    : addMoney(storeOwnFee, effectivePlatformSplit);
  const activeDeliveryFee = isPickup
    ? 0
    : (calculatedDeliveryFee !== null ? calculatedDeliveryFee : (isOwnDelivery ? ownDeliveryFallbackFee : config.city_fee));
  // Cupom "frete grátis": cliente paga R$ 0 de entrega, mas a loja absorve a taxa
  // de R$ 2,00 da plataforma (modelo iFood/Rappi). Registramos delivery_fee = R$ 2
  // no pedido (rota normalmente para a plataforma via split) e neutralizamos no
  // cálculo do total para o cliente somando R$ 2 ao desconto do cupom.
  const freeShipPlatformAbsorb = (couponType === "free_shipping" && !isPickup)
    ? (storePlan.platformDeliverySplit > 0 ? storePlan.platformDeliverySplit : platformSplitFallback)
    : 0;
  // Frete grátis por valor mínimo (configurado pela loja).
  // Diferente do cupom: a LOJA absorve a taxa cheia da entrega (motoboy + plataforma),
  // não só a parte da plataforma. Para o cliente, frete = R$ 0,00.
  const storeFreeThreshold = Number((storeData as any)?.free_delivery_threshold || 0);
  const freeDeliveryByThreshold = !isPickup && storeFreeThreshold > 0 && subtotal >= storeFreeThreshold;
  const thresholdMissing = !isPickup && storeFreeThreshold > 0 && subtotal < storeFreeThreshold
    ? storeFreeThreshold - subtotal
    : 0;
  const storeAbsorbedDeliveryFee = freeDeliveryByThreshold ? activeDeliveryFee : 0;
  const effectiveDeliveryFee = isPickup
    ? 0
    : freeDeliveryByThreshold
      ? 0
      : (couponType === "free_shipping" ? freeShipPlatformAbsorb : activeDeliveryFee);
  const effectiveCouponDiscount = couponDiscount + (freeDeliveryByThreshold ? 0 : freeShipPlatformAbsorb);
  const walletDiscount = useWallet ? Math.min(walletBalance, Math.max(0, addMoney(subtotal, effectiveDeliveryFee, -effectiveCouponDiscount, -loyaltyDiscount))) : 0;
  const [emptiesSelections, setEmptiesSelections] = useState<EmptiesExchangeSelection[]>([]);
  const [emptiesDiscount, setEmptiesDiscount] = useState(0);
  const handleEmptiesChange = useCallback((sel: EmptiesExchangeSelection[], disc: number) => {
    setEmptiesSelections(sel);
    setEmptiesDiscount(disc);
  }, []);
  const finalTotal = Math.max(0, addMoney(subtotal, effectiveDeliveryFee, -effectiveCouponDiscount, -loyaltyDiscount, -walletDiscount, -emptiesDiscount));

   // Background geocoding from address (initial estimate)
   useEffect(() => {
     if ((hasAddress || selectedSavedAddressId) && !clientCoords) {
       const geoCep = selectedSavedAddressId && savedAddressData?.cep ? savedAddressData.cep : profileCep;
       const geoStreet = selectedSavedAddressId && savedAddressData
         ? [savedAddressData.street, savedAddressData.number].filter(Boolean).join(" ")
         : [profileStreet, profileNumber].filter(Boolean).join(" ");
       const geoNeighborhood = selectedSavedAddressId && savedAddressData?.neighborhood ? savedAddressData.neighborhood : profileNeighborhood;
 
       resolveAddressContext({
         street: geoStreet,
         neighborhood: geoNeighborhood,
         postalcode: geoCep,
       }).then(context => {
         getBestClientCoordinates(context).then(coords => {
           if (coords && !clientCoords) {
             console.log("[Checkout] Address geocoding fallback set:", coords);
             setClientCoords(coords);
           }
         });
       });
     }
   }, [hasAddress, selectedSavedAddressId, savedAddressData, profileCep, profileStreet, profileNumber, profileNeighborhood, clientCoords]);
 
   const handleRequestLocation = async () => {
     setRequestingLocation(true);
     try {
       const gps = await getDeviceGPS();
       if (gps) {
         setClientCoords(gps);
         setIsLocationRequested(true);
         setCoordsSource("gps");
         // Reverse geocode para mostrar o endereço real do GPS
         reverseGeocode(gps).then((res) => {
           if (res) setGpsAddress(res);
         });
         toast.success("Localização ativada com sucesso!");
       } else {
         toast.error("Não foi possível obter sua localização exata. Verifique se o GPS está ativado.");
       }
     } catch (e) {
       console.error("Error requesting location:", e);
     } finally {
       setRequestingLocation(false);
     }
   };

   // Auto-tentar GPS no mount se permissão já estiver concedida (sem prompt)
   useEffect(() => {
     let cancelled = false;
     const tryAutoLocate = async () => {
       try {
         if (typeof navigator === "undefined" || !navigator.geolocation) return;
         // Em web: só dispara se permissão já está "granted" (não pede prompt)
         if (navigator.permissions?.query) {
           try {
             const status = await navigator.permissions.query({ name: "geolocation" as PermissionName });
             if (status.state !== "granted") return;
           } catch {
             return;
           }
         }
         const gps = await getDeviceGPS();
         if (cancelled || !gps) return;
         setClientCoords(gps);
         setIsLocationRequested(true);
         setCoordsSource("gps");
         const res = await reverseGeocode(gps);
         if (!cancelled && res) setGpsAddress(res);
       } catch (e) {
         console.warn("[Checkout] Auto-locate falhou:", e);
       }
     };
     tryAutoLocate();
     return () => { cancelled = true; };
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);
 
   useEffect(() => {
     const customerCep = selectedSavedAddressId && savedAddressData?.cep ? savedAddressData.cep : profileCep;
     const activeNeighborhood = selectedSavedAddressId && savedAddressData?.neighborhood ? savedAddressData.neighborhood : profileNeighborhood;
 
      if (isOwnDelivery) {
        if (!customerCep || !storeCep) {
          setCalculatedDeliveryFee(null);
          setFeeBreakdown(null);
          return;
        }
  
        let cancelled = false;
        setCalculatingFee(true);
  
        const ownConfig = {
          delivery_fee_type: storeDeliveryFeeType,
          delivery_base_km: storeDeliveryBaseKm,
          delivery_fee_base: storeDeliveryFeeBase,
          delivery_fee_per_km: storeDeliveryFeePerKm,
          own_delivery_fee: storeOwnFee,
          customer_street: selectedSavedAddressId && savedAddressData ? savedAddressData.street : profileStreet,
          customer_number: selectedSavedAddressId && savedAddressData ? savedAddressData.number : profileNumber,
          customer_coords: clientCoords,
          customer_neighborhood: selectedSavedAddressId && savedAddressData?.neighborhood ? savedAddressData.neighborhood : profileNeighborhood,
          customer_city: selectedSavedAddressId && savedAddressData ? (savedAddressData as any).city : (userProfile as any)?.city,
          customer_state: selectedSavedAddressId && savedAddressData ? (savedAddressData as any).state : (userProfile as any)?.state,
          store_coords:
            (storeData as any)?.latitude && (storeData as any)?.longitude
              ? { lat: Number((storeData as any).latitude), lng: Number((storeData as any).longitude) }
              : null,
        };
  
        calculateStoreOwnDeliveryFee(customerCep, storeCep, ownConfig).then((result) => {
          if (cancelled) return;
          setCalculatedDeliveryFee(result.fee);
          setFeeBreakdown(result.breakdown);
          if (activeNeighborhood) setNeighborhood(activeNeighborhood, result.fee);
          setCalculatingFee(false);
        }).catch(() => {
          if (cancelled) return;
          setCalculatingFee(false);
        });
  
        return () => { cancelled = true; };
      }
 
     if (!customerCep || !storeCep) {
       setCalculatedDeliveryFee(null);
       setFeeBreakdown(null);
       return;
     }
 
     let cancelled = false;
     setCalculatingFee(true);
 
      const deliveryConfigWithPlatform: any = {
        ...config,
        // Ensure we use the latest platform split from the store plan or admin settings
        platform_split: storePlan.platformDeliverySplit ?? config.platform_split ?? 2.0
      };

      calculateDeliveryFee(customerCep, storeCep, deliveryConfigWithPlatform, clientCoords).then((result) => {
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
    }, [profileCep, storeCep, config, savedAddressData, selectedSavedAddressId, profileNeighborhood, isOwnDelivery, storeDeliveryFeeType, storeDeliveryBaseKm, storeDeliveryFeeBase, storeDeliveryFeePerKm, storeOwnFee, storePlan.isFixedPlan, storePlan.platformDeliverySplit, effectivePlatformSplit, clientCoords]);

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

   const handleConfirm = async () => {
    if (isStoreClosed) {
      toast.error(`Loja fechada. ${storeStatus?.reason || ""}`);
      return;
    }
    if (belowMinimum) {
      toast.error(`Pedido mínimo desta loja: ${formatBRL(storeMinimumOrderValue)}. Adicione mais ${formatBRL(minimumMissing)}.`);
      return;
    }
    const useSavedAddr = selectedSavedAddressId && savedAddressData;
    const finalHasAddress = isPickup || useSavedAddr || hasAddress;
    const finalNeighborhood = isPickup ? "RETIRADA" : (useSavedAddr ? savedAddressData.neighborhood : (profileNeighborhood || neighborhood));
    const finalAddress = isPickup
      ? "Retirada na loja"
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

    // ===== ANTIFRAUDE: bloqueia se cliente está muito longe da loja =====
    if (!isPickup && storeData && (storeData as any).latitude && (storeData as any).longitude) {
      const fraud = await checkStoreAccess({
        storeId: storeId!,
        storeName: (storeData as any).name ?? null,
        storeCity: (storeData as any).address_city ?? null,
        storeLat: (storeData as any).latitude,
        storeLng: (storeData as any).longitude,
        deliveryCity: useSavedAddr ? savedAddressData?.city : (userProfile as any)?.city,
        // Passa coordenadas do endereço de entrega (geocodificadas pelo CEP)
        // Isso garante que o bloqueio funciona mesmo sem GPS do dispositivo
        deliveryCoords: clientCoords ?? undefined,
      });
      if (!fraud.allowed) {
        toast.error("Pedido bloqueado por segurança", {
          description: `Você está a ${fraud.distanceKm?.toFixed(1)} km desta loja. Limite de ${MAX_DISTANCE_KM} km para entrega.`,
          duration: 8000,
        });
        return;
      }
    }

    setLoading(true);
    try {
      // Geocode in PARALLEL — don't block order creation. We'll patch coords later.
      const geocodePromise: Promise<{ lat: number; lng: number } | null> = (async () => {
        try {
          const geoCep = useSavedAddr ? savedAddressData?.cep : profileCep;
          const geoStreet = useSavedAddr
            ? [savedAddressData.street, savedAddressData.number].filter(Boolean).join(" ")
            : [profileStreet, profileNumber].filter(Boolean).join(" ");
          const geoNeighborhood = useSavedAddr ? savedAddressData?.neighborhood : profileNeighborhood;

          const context = await resolveAddressContext({
            street: geoStreet,
            neighborhood: geoNeighborhood,
            city: undefined,
            state: undefined,
            postalcode: geoCep,
          });
          const preciseGeo = await getBestClientCoordinates(context);
          return preciseGeo ? { lat: preciseGeo.lat, lng: preciseGeo.lng } : null;
        } catch {
          return null;
        }
      })();

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
        const storeTotalPrice = Math.max(0, addMoney(storeSubtotal, effectiveDeliveryFee, -effectiveCouponDiscount, -loyaltyDiscount, -storeEmptiesDiscount));

        const changeValue = paymentMethod === "dinheiro" && needsChange ? addMoney(parseFloat(changeFor)) : 0;
        const orderStatus = paymentMethod === "pix" ? "aguardando_pagamento" : "pendente";
        // pix_machine = físico (igual cartão/dinheiro) — não aguarda confirmação Asaas
        const { data: order, error: orderError } = await supabase
          .from("orders")
          .insert({
            client_id: user.id,
            store_id: storeId,
            subtotal: storeSubtotal,
            delivery_fee: effectiveDeliveryFee,
            delivery_fee_absorbed_by_store: storeAbsorbedDeliveryFee,
            commission_rate: storePlan.commissionRate ?? 0,
            total_price: storeTotalPrice,
            wallet_discount: walletDiscount,
            app_fee: appFee,
            payment_method: paymentMethod,
            neighborhood: finalNeighborhood,
            address_details: finalAddress,
            needs_change: paymentMethod === "dinheiro" && needsChange,
            change_for: changeValue,
            status: orderStatus,
            scheduled_for: scheduledFor ? new Date(scheduledFor).toISOString() : null,
            metadata: storeEmpties.length > 0 ? { empties_exchange: storeEmpties } : null,
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
      } else if (paymentMethod === "pix_machine") {
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.7 } });
        toast.success("Pedido enviado! Pague via PIX na maquininha na entrega.");
        navigate("/pedidos?new_order=1", { replace: true });
      } else {
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.7 } });
        toast.success("Pedido enviado com sucesso! Acompanhe pelo chat.");
        navigate("/pedidos?new_order=1", { replace: true });
      }

      // Background tasks (non-blocking): patch coords + notify store owners
      (async () => {
        try {
          const coords = await geocodePromise;
          if (coords) {
            for (const { orderId } of createdOrders) {
              supabase.from("orders")
                .update({ client_lat: coords.lat, client_lng: coords.lng } as any)
                .eq("id", orderId)
                .then(() => {});
            }
          }
        } catch {}

        if (paymentMethod !== "pix") { // pix_machine e cartão/dinheiro notificam o lojista
          for (const { storeId, orderId } of createdOrders) {
            try {
              const { data: storeData } = await supabase
                .from("stores")
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

  const hasValidAddress = isPickup || (selectedSavedAddressId ? !!savedAddressData : hasAddress);
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
              }}
            />

            {selectedSavedAddressId && savedAddressData && (
              <div className="bg-primary/5 rounded-xl p-3.5 space-y-1.5">
                {gpsAddress ? (
                  <>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">📍 GPS</span>
                      <span className="text-[10px] text-muted-foreground">Localização atual</span>
                    </div>
                    <p className="text-sm font-bold text-foreground">{gpsAddress.display}</p>
                    <p className="text-[10px] text-muted-foreground italic">Cadastrado: {savedAddressData.street}, {savedAddressData.number} - {savedAddressData.neighborhood}</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-bold text-foreground">
                      {savedAddressData.street}, {savedAddressData.number}
                      {savedAddressData.complement ? ` - ${savedAddressData.complement}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">{savedAddressData.neighborhood}</p>
                  </>
                )}
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
                        {formatBRL(activeDeliveryFee)}
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
                {gpsAddress ? (
                  <>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">📍 GPS</span>
                      <span className="text-[10px] text-muted-foreground">Localização atual</span>
                    </div>
                    <p className="text-sm font-bold text-foreground">{gpsAddress.display}</p>
                    <p className="text-[10px] text-muted-foreground italic">Cadastrado: {profileStreet}, {profileNumber} - {profileNeighborhood}</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-bold text-foreground">
                      {profileStreet}, {profileNumber}
                      {profileComplement ? ` - ${profileComplement}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">{profileNeighborhood}</p>
                  </>
                )}
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
                        {formatBRL(activeDeliveryFee)}
                      </span>
                    </div>
                  )}
                  <button onClick={() => navigate("/perfil")} className="text-xs text-primary font-semibold flex items-center gap-1">
                    <Edit3 className="h-3 w-3" /> Alterar
                  </button>
                </div>
                {!gpsAddress && (
                  <button
                    onClick={handleRequestLocation}
                    disabled={requestingLocation}
                    className="w-full mt-2 text-xs font-bold text-primary border border-primary/30 rounded-lg py-2 flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {requestingLocation ? <Loader2 className="h-3 w-3 animate-spin" /> : <MapPin className="h-3 w-3" />}
                    Usar minha localização atual (mais preciso)
                  </button>
                )}
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
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Truck className="h-3 w-3" /> Taxa de entrega
                  <WhyThisCharge title="Como é calculada a taxa de entrega">
                    <p>A taxa de entrega cobre o trabalho do entregador (distância e tempo) e inclui <strong>R$ 2,00 da plataforma ItaSuper</strong> por pedido entregue, usados para manter o app, suporte e rastreio em tempo real.</p>
                    <p className="mt-2">Em pedidos para retirada na loja, não há taxa de entrega.</p>
                  </WhyThisCharge>
                </span>
                <span className={`font-semibold ${(couponType === "free_shipping" || freeDeliveryByThreshold) ? "text-green-600 line-through" : "text-foreground"}`}>
                  {calculatingFee ? (
                    <span className="inline-block h-3.5 w-16 rounded bg-muted animate-pulse align-middle" />
                  ) : (
                    formatBRL(activeDeliveryFee)
                  )}
                </span>
              </div>
              )}

              {!isPickup && freeDeliveryByThreshold && (
                <div className="flex justify-between text-sm">
                  <span className="text-green-600 font-medium">🚚 Frete grátis (cortesia da loja)</span>
                  <span className="font-bold text-green-600">R$ 0,00</span>
                </div>
              )}

              {!isPickup && !freeDeliveryByThreshold && thresholdMissing > 0 && (
                <div className="mt-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                  <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                    Adicione mais <strong>{formatBRL(thresholdMissing)}</strong> e ganhe <strong>frete grátis</strong>!
                  </p>
                  <div className="mt-1.5 h-1.5 w-full rounded-full bg-emerald-500/20 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all"
                      style={{ width: `${Math.min(100, (subtotal / storeFreeThreshold) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {!isPickup && feeBreakdown && couponType !== "free_shipping" && (
                <p className="text-[11px] text-muted-foreground/80 -mt-1 pl-4">
                  {feeBreakdown}
                </p>
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
      <div role="region" aria-label="Resumo e finalização do pedido" className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border shadow-[0_-4px_20px_-8px_rgba(0,0,0,0.15)] px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)] space-y-2.5">
        {/* Total */}
        <div className="flex items-center justify-between py-1" aria-live="polite" aria-atomic="true">
          <span className="text-base font-bold text-foreground">Total</span>
          <span className="text-2xl font-black text-primary" aria-label={`Total ${formatBRL(finalTotal)}`}>{formatBRL(finalTotal)}</span>
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
        ) : !isPickup && !hasValidAddress && !isLocationRequested && !clientCoords ? (
          <button
            onClick={handleRequestLocation}
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
                Ativar Localização
              </>
            )}
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

        {/* Asaas — selo discreto (Resolução Conjunta nº 16/2025) */}
        <div className="flex items-center justify-center gap-2 pt-0.5">
          <AsaasBadgeBar />
        </div>
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
