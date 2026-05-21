import { compressImage } from "@/lib/compressImage";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, Upload, Save, Store, Phone, Tag, MapPin, Link, Copy, Wallet, Search, Loader2, Bell, CreditCard, QrCode, Banknote, CheckCircle2, XCircle, Truck, Bike, MessageSquare, Eye, EyeOff, ExternalLink } from "lucide-react";
import { requestPushPermissionAndRegister } from "@/lib/firebase";
import { isGoNative, registerGoNativePlayer } from "@/lib/gonative";
import { isCapacitorNative, registerCapacitorPush } from "@/lib/capacitorNative";
import { maskWhatsApp } from "@/lib/whatsapp";
import { formatCep, fetchCep } from "@/lib/cepLookup";
import { formatBRL } from "@/lib/utils";
import { useStorePlan } from "@/hooks/useStorePlan";
import { formatPixKeyDisplay, sanitizePixKeyForAsaas, validatePixKey, PIX_PLACEHOLDERS } from "@/lib/pixFormat";

const PIX_TYPE_OPTIONS = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone" },
  { value: "random", label: "Chave Aleatória" },
];

const CATEGORY_OPTIONS = [
  { value: "lanches", label: "Lanches" },
  { value: "pizzas", label: "Pizzas" },
  { value: "adegas", label: "Adegas" },
  { value: "japonesa", label: "Japonesa" },
  { value: "saudavel", label: "Saudável" },
  { value: "sobremesas", label: "Sobremesas" },
  { value: "cafeteria", label: "Cafeteria" },
  { value: "churrasco", label: "Churrasco" },
  { value: "farmacias", label: "Farmácias" },
  { value: "docerias", label: "Docerias" },
  { value: "restaurante", label: "Restaurante" },
  { value: "esfihas", label: "Esfihas" },
];

type PizzaPriceMode = "maior" | "media" | "soma";

 interface StoreSettingsProps {
   storeId: string;
   storeName: string;
   storeCategory: string;
   storeCategories?: string[] | null;
   storeImageUrl: string | null;
   storeIsOpen: boolean;
   forceClosed: boolean;
   storeSlug?: string | null;
   storeAddressStreet?: string | null;
   storeAddressNumber?: string | null;
   storeAddressComplement?: string | null;
   storeAddressNeighborhood?: string | null;
   storeAddressReference?: string | null;
   storeAddressCity?: string | null;
   storeAddressState?: string | null;
   storeAddressCep?: string | null;
   storeDeliveryMode?: string | null;
   storeOwnDeliveryFee?: number | null;
   storeDeliveryFeeType?: string | null;
   storeDeliveryBaseKm?: number | null;
   storeDeliveryFeeBase?: number | null;
   storeDeliveryFeePerKm?: number | null;
   storeSettings?: Record<string, any> | null;
 }
 
 const StoreSettings = ({
   storeId, storeName, storeCategory, storeCategories, storeImageUrl, storeIsOpen, forceClosed,
   storeSlug, storeAddressStreet, storeAddressNumber, storeAddressComplement, storeAddressNeighborhood,
   storeAddressReference, storeAddressCity, storeAddressState, storeAddressCep, storeDeliveryMode,
   storeOwnDeliveryFee, storeDeliveryFeeType, storeDeliveryBaseKm, storeDeliveryFeeBase,
   storeDeliveryFeePerKm, storeSettings
 }: StoreSettingsProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [name, setName] = useState(storeName);
  const [category, setCategory] = useState(storeCategory);
  const [categories, setCategories] = useState<string[]>(() => {
    const initial = (storeCategories && storeCategories.length > 0) ? storeCategories : [storeCategory];
    return Array.from(new Set(initial.filter(Boolean)));
  });
  const [slug, setSlug] = useState(storeSlug || storeName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
  const [whatsapp, setWhatsapp] = useState("");
  const [imageUrl, setImageUrl] = useState(storeImageUrl || "");
  const [pixKey, setPixKey] = useState("");
  const [pixType, setPixType] = useState("cpf");
  const [addressStreet, setAddressStreet] = useState(storeAddressStreet || "");
  const [addressNumber, setAddressNumber] = useState(storeAddressNumber || "");
  const [addressComplement, setAddressComplement] = useState(storeAddressComplement || "");
  const [addressNeighborhood, setAddressNeighborhood] = useState(storeAddressNeighborhood || "");
  const [addressReference, setAddressReference] = useState(storeAddressReference || "");
  const [addressCity, setAddressCity] = useState(storeAddressCity || "Itatinga");
  const [addressState, setAddressState] = useState(storeAddressState || "SP");
  const [addressCep, setAddressCep] = useState(storeAddressCep || "");
  const [loadingCep, setLoadingCep] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
   const [deliveryMode, setDeliveryMode] = useState(storeDeliveryMode || "platform");
   const [ownDeliveryFee, setOwnDeliveryFee] = useState(storeOwnDeliveryFee?.toString() || "0");
   const [deliveryFeeType, setDeliveryFeeType] = useState(storeDeliveryFeeType || "fixed");
   const [deliveryBaseKm, setDeliveryBaseKm] = useState(storeDeliveryBaseKm?.toString() || "0");
   const [deliveryFeeBase, setDeliveryFeeBase] = useState(storeDeliveryFeeBase?.toString() || "0");
   const [deliveryFeePerKm, setDeliveryFeePerKm] = useState(storeDeliveryFeePerKm?.toString() || "0");
  const storePlan = useStorePlan(storeId);

  // Verificar se conta Asaas está 100% aprovada para liberar PIX Online
  const { data: asaasStatusData } = useQuery({
    queryKey: ["asaas-activation-status", storeId],
    queryFn: async () => {
      const { data: storeData } = await supabase
        .from("stores")
        .select("asaas_wallet_id, asaas_activation_status")
        .eq("id", storeId)
        .maybeSingle();
      if (!storeData?.asaas_wallet_id) return null;
      return storeData?.asaas_activation_status as any;
    },
    enabled: !!storeId,
    staleTime: 30_000,
  });

  const isAsaasFullyApproved =
    asaasStatusData?.commercialInfo === "APPROVED" &&
    asaasStatusData?.bankAccount    === "APPROVED" &&
    asaasStatusData?.document       === "APPROVED";

  const hasAsaasAccount = !!asaasStatusData;

  const [pizzaHalfEnabled, setPizzaHalfEnabled] = useState<boolean>(storeSettings?.pizza_half_enabled || false);
  const [pizzaPriceMode, setPizzaPriceMode] = useState<PizzaPriceMode>(storeSettings?.pizza_price_mode || "maior");

  // Métodos de pagamento aceitos — inicializados direto do storeSettings
  const [acceptPixOnline,  setAcceptPixOnline]  = useState<boolean>(storeSettings?.accept_pix_online  !== false);
  const [acceptPixMachine, setAcceptPixMachine] = useState<boolean>(storeSettings?.accept_pix_machine === true);
  const [acceptCard,       setAcceptCard]       = useState<boolean>(storeSettings?.accept_card        !== false);
  const [acceptCash,       setAcceptCash]       = useState<boolean>(storeSettings?.accept_cash        !== false);

  // Load Z-API secrets from store_secrets table
  useEffect(() => {
    if (!storeId) return;
    supabase
      .from("store_secrets")
      .select("zapi_enabled, zapi_instance_id, zapi_token, zapi_client_token")
      .eq("store_id", storeId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setZapiEnabled(data.zapi_enabled || false);
          setZapiInstanceId(data.zapi_instance_id || "");
          setZapiToken(data.zapi_token || "");
          setZapiClientToken(data.zapi_client_token || "");
        }
      });
  }, [storeId]);

  // Load whatsapp + pix from profile
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("whatsapp_number, pix_key, pix_type")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.whatsapp_number) setWhatsapp(data.whatsapp_number);
        if (data?.pix_key) setPixKey(data.pix_key);
        if (data?.pix_type) setPixType(data.pix_type);
      });
  }, [user]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Formato inválido. Use JPG, PNG ou WebP.");
      return;
    }

    setUploading(true);
    const compressed = await compressImage(file, { maxDim: 800, quality: 0.8, forceWebp: true }).catch(() => file);
    
    const ext = compressed.type === "image/webp" ? "webp" : (compressed.type === "image/png" ? "png" : "jpg");
    const filePath = `${user.id}/logo_${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("store-assets")
      .upload(filePath, compressed, { upsert: true });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      toast.error("Erro ao subir imagem. Verifique sua conexão ou tente um arquivo menor (até 2MB).");
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("store-assets")
      .getPublicUrl(filePath);

    const newImageUrl = urlData.publicUrl;
    setImageUrl(newImageUrl);
    
    // Auto-save the image to the database
    try {
      const { error: updateError } = await supabase
        .from("stores")
        .update({ image_url: newImageUrl })
        .eq("id", storeId);

      if (updateError) throw updateError;
      
      queryClient.invalidateQueries({ queryKey: ["my-store"] });
      toast.success("Logo atualizada automaticamente!");
    } catch (err) {
      console.error("Error auto-saving logo:", err);
      toast.error("Erro ao salvar logo automaticamente.");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Nome do estabelecimento é obrigatório.");
      return;
    }
    if (whatsapp && whatsapp.replace(/\D/g, "").length < 10) {
      toast.error("WhatsApp inválido. Mínimo 10 dígitos.");
      return;
    }

    setSaving(true);

    // Update store
    const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/--+/g, "-");
    // Ensure primary category is always present in the list, and primary equals first selected
    const finalCategories = Array.from(new Set([category, ...categories].filter(Boolean)));
    const primaryCategory = finalCategories[0] || category;
    const updateData = {
      name: name.trim(),
      category: primaryCategory as any,
      categories: finalCategories as any,
      image_url: imageUrl || null,
      slug: cleanSlug || null,
      settings: {
        ...(storeSettings || {}),
        pizza_half_enabled: pizzaHalfEnabled,
        pizza_price_mode: pizzaPriceMode,
        delivery_fee_type: deliveryFeeType,
        delivery_base_km: parseFloat(deliveryBaseKm.toString().replace(",", ".")) || 0,
        delivery_fee_base: parseFloat(deliveryFeeBase.toString().replace(",", ".")) || 0,
        delivery_fee_per_km: parseFloat(deliveryFeePerKm.toString().replace(",", ".")) || 0,
        // Métodos de pagamento aceitos
        accept_pix_online:  acceptPixOnline && isAsaasFullyApproved,
        accept_pix_machine: acceptPixMachine,
        accept_card:        acceptCard,
        accept_cash:        acceptCash,
      },
      delivery_mode: deliveryMode,
      own_delivery_fee: parseFloat(ownDeliveryFee.toString().replace(",", ".")) || 0,
      delivery_fee_type: deliveryFeeType,
      delivery_base_km: parseFloat(deliveryBaseKm.toString().replace(",", ".")) || 0,
      delivery_fee_base: parseFloat(deliveryFeeBase.toString().replace(",", ".")) || 0,
      delivery_fee_per_km: parseFloat(deliveryFeePerKm.toString().replace(",", ".")) || 0,
      address_street: addressStreet.trim() || null,
      address_number: addressNumber.trim() || null,
      address_complement: addressComplement.trim() || null,
      address_neighborhood: addressNeighborhood.trim() || null,
      address_reference: addressReference.trim() || null,
      address_city: addressCity.trim() || "Itatinga",
      address_state: addressState.trim() || "SP",
      address_cep: addressCep.replace(/\D/g, "") || null,
    };

    console.log("[DEBUG] Salvando configurações da loja:", { storeId, updateData });

    const { error: storeError } = await supabase
      .from("stores")
      .update(updateData as any)
      .eq("id", storeId);

    if (storeError) {
      console.error("[DEBUG] Erro ao salvar dados da loja no Supabase:", storeError);
      toast.error(`Erro ao salvar: ${storeError.message || "Verifique os dados"}`);
      setSaving(false);
      return;
    }

    if (storeError) {
      toast.error("Erro ao salvar dados da loja.");
      setSaving(false);
      return;
    }

    // WhatsApp configurado via WhatsAppSetup component (Evolution API)

    // Update whatsapp + pix on profile
    if (user) {
      const cleanWhatsapp = whatsapp.replace(/\D/g, "");
      let cleanPix: string | null = null;
      if (pixKey.trim() && pixType) {
        const err = validatePixKey(pixKey, pixType);
        if (err) {
          toast.error(`PIX inválido: ${err}`);
          setSaving(false);
          return;
        }
        cleanPix = sanitizePixKeyForAsaas(pixKey, pixType);
      }
      await supabase
        .from("profiles")
        .update({
          whatsapp_number: cleanWhatsapp || null,
          pix_key: cleanPix,
          pix_type: (pixType as any) || null,
        })
        .eq("user_id", user.id);
      if (cleanPix) setPixKey(cleanPix);
    }

    queryClient.invalidateQueries({ queryKey: ["my-store"] });
    toast.success("✅ Configurações salvas com sucesso!");
    setSaving(false);
  };

const NotificationSection = () => {
  const [notifStatus, setNotifStatus] = useState<"checking" | "granted" | "denied" | "default" | "unsupported">("checking");
  const [enabling, setEnabling] = useState(false);
  const native = isGoNative();
  const capacitorNative = isCapacitorNative();

  useEffect(() => {
    if (native) {
      // In GoNative, notifications are always available via OneSignal
      setNotifStatus("granted");
      return;
    }
    if (capacitorNative) {
      import("@capacitor/push-notifications").then(({ PushNotifications }) => {
        PushNotifications.checkPermissions().then((result) => {
          if (result.receive === "prompt" || result.receive === "prompt-with-rationale") {
            setNotifStatus("default");
            return;
          }
          setNotifStatus(result.receive === "granted" ? "granted" : "denied");
        }).catch(() => setNotifStatus("default"));
      }).catch(() => setNotifStatus("default"));
      return;
    }
    if (!("Notification" in window)) {
      setNotifStatus("unsupported");
      return;
    }
    setNotifStatus(Notification.permission as any);
  }, [native, capacitorNative]);

  const handleEnable = async () => {
    setEnabling(true);
    try {
      if (native) {
        await registerGoNativePlayer();
        toast.success("Notificações nativas ativadas!");
        setNotifStatus("granted");
      } else if (capacitorNative) {
        const token = await registerCapacitorPush();
        if (token) {
          toast.success("Notificações ativadas!");
          setNotifStatus("granted");
        } else {
          setNotifStatus("denied");
          toast.error("Permissão negada. Ative nas configurações do app.");
        }
      } else {
        const token = await requestPushPermissionAndRegister();
        const result = Notification.permission;
        setNotifStatus(result as any);
        if (result === "granted" && token) {
          toast.success("Notificações ativadas!");
        } else {
          toast.error("Permissão negada. Ative nas configurações do navegador.");
        }
      }
    } catch (e) {
      console.error("Notification enable error:", e);
      toast.error("Erro ao ativar notificações.");
    }
    setEnabling(false);
  };

  return (
    <div className="bg-muted/50 border border-border rounded-2xl p-4 space-y-3">
      <label className="text-sm font-bold text-foreground/80 flex items-center gap-2">
        <Bell className="h-4 w-4 text-primary" />
        Notificações
      </label>

      {notifStatus === "granted" ? (
        <div className="flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-xl p-3">
          <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
          <div>
            <p className="text-xs font-bold text-primary">Notificações ativas</p>
          <p className="text-[10px] text-muted-foreground">Você receberá alertas de novos pedidos.</p>
          </div>
        </div>
      ) : notifStatus === "denied" ? (
        <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-xl p-3">
          <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
          <div>
            <p className="text-xs font-bold text-destructive">Notificações bloqueadas</p>
            <p className="text-[10px] text-muted-foreground">Acesse as configurações do navegador ou do app para desbloquear.</p>
          </div>
        </div>
      ) : notifStatus === "unsupported" ? (
        <p className="text-xs text-muted-foreground">Notificações não suportadas neste navegador.</p>
      ) : notifStatus === "checking" ? (
        <p className="text-xs text-muted-foreground">Verificando...</p>
      ) : (
        <button
          onClick={handleEnable}
          disabled={enabling}
          className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          <Bell className="h-4 w-4" />
          {enabling ? "Ativando..." : "Ativar Notificações"}
        </button>
      )}
    </div>
  );
};

  return (
    <div className="space-y-6 pb-32">
      {/* Logo Upload */}
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-28 h-28 rounded-full bg-muted border-4 border-border overflow-hidden flex items-center justify-center">
            {imageUrl ? (
              <img loading="lazy" decoding="async" src={imageUrl} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <Store className="h-10 w-10 text-muted-foreground/70" />
            )}
          </div>
          <label className="absolute bottom-0 right-0 bg-primary text-primary-foreground w-9 h-9 rounded-full flex items-center justify-center cursor-pointer shadow-lg active:scale-95 transition-transform">
            <Camera className="h-4 w-4" />
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          {uploading ? "Enviando..." : "Toque no ícone para alterar a logo"}
        </p>
      </div>

      {/* Store Name */}
      <div className="space-y-2">
        <label className="text-sm font-bold text-foreground/80 flex items-center gap-2">
          <Store className="h-4 w-4 text-primary" />
          Nome do Estabelecimento
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Nata Lanches"
          maxLength={100}
          className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
        />
      </div>

      {/* Category */}
      <div className="space-y-2">
        <label className="text-sm font-bold text-foreground/80 flex items-center gap-2">
          <Tag className="h-4 w-4 text-primary" />
          Categorias da Loja
        </label>
        <p className="text-[11px] text-muted-foreground">
          Selecione todas as categorias que sua loja atende. A <strong>categoria principal</strong> é usada como destaque.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {CATEGORY_OPTIONS.map((opt) => {
            const checked = categories.includes(opt.value);
            const isPrimary = category === opt.value;
            return (
              <button
                type="button"
                key={opt.value}
                onClick={() => {
                  if (checked) {
                    // Don't allow removing the last category
                    if (categories.length === 1) {
                      toast.error("Selecione pelo menos uma categoria.");
                      return;
                    }
                    const next = categories.filter((c) => c !== opt.value);
                    setCategories(next);
                    if (isPrimary) setCategory(next[0]);
                  } else {
                    setCategories([...categories, opt.value]);
                    if (categories.length === 0) setCategory(opt.value);
                  }
                }}
                className={`relative flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-xs font-bold transition-all active:scale-95 ${
                  checked
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-secondary text-muted-foreground hover:border-primary/40"
                }`}
              >
                <span className={`w-4 h-4 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${checked ? "bg-primary border-primary" : "border-muted-foreground/40"}`}>
                  {checked && <span className="text-primary-foreground text-[10px] leading-none">✓</span>}
                </span>
                <span className="truncate">{opt.label}</span>
                {isPrimary && checked && (
                  <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-wide">
                    Principal
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {categories.length > 1 && (
          <div className="space-y-1.5 pt-2">
            <label className="text-[11px] font-bold text-foreground/70">Categoria principal (destaque):</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary appearance-none"
            >
              {categories.map((c) => {
                const opt = CATEGORY_OPTIONS.find((o) => o.value === c);
                return (
                  <option key={c} value={c}>{opt?.label || c}</option>
                );
              })}
            </select>
          </div>
        )}
      </div>

      {/* WhatsApp */}
      <div className="space-y-2">
        <label className="text-sm font-bold text-foreground/80 flex items-center gap-2">
          <Phone className="h-4 w-4 text-primary" />
          WhatsApp de Atendimento
        </label>
        <input 
          type="tel" 
          inputMode="tel" 
          value={whatsapp} 
          onChange={(e) => setWhatsapp(maskWhatsApp(e.target.value))} 
          placeholder="(14) 99999-9999" 
          className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary" 
        />
        <p className="text-[10px] text-muted-foreground/70">Será exibido para clientes e entregadores.</p>
      </div>

      {/* Store Link (Slug) */}
      <div className="space-y-2">
        <label className="text-sm font-bold text-foreground/80 flex items-center gap-2">
          <Link className="h-4 w-4 text-primary" />
          Link Exclusivo da Loja
        </label>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center bg-secondary border border-border rounded-xl overflow-hidden">
            <span className="text-xs text-muted-foreground/70 pl-3 whitespace-nowrap">itasuper.com.br/</span>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9-]/g, "").replace(/--+/g, "-"))}
              placeholder="nome-da-loja"
              maxLength={50}
              className="flex-1 bg-transparent px-1 py-3 text-foreground text-sm focus:outline-none"
            />
          </div>
        </div>
        {slug && (
          <div className="flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-xl p-3">
            <Link className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-xs text-primary font-bold truncate">
              itasuper.com.br/{slug}
            </span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`https://itasuper.com.br/${slug}`);
                toast.success("Link copiado!");
              }}
              className="ml-auto flex items-center gap-1 bg-primary/20 text-primary font-bold px-2.5 py-1.5 rounded-lg text-xs active:scale-95 transition-transform"
            >
              <Copy className="h-3 w-3" />
              Copiar
            </button>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground/70">Compartilhe esse link para clientes acessarem direto seu cardápio.</p>
      </div>

      {/* Store Address */}
      <div className="space-y-3">
        <label className="text-sm font-bold text-muted-foreground flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          Endereço da Loja
        </label>
        <p className="text-[10px] text-muted-foreground -mt-1">
          Endereço físico para entregadores navegarem até sua loja. O CEP é usado para calcular a taxa de entrega.
        </p>
        {/* CEP field */}
        <div className="flex gap-2">
          <input
            type="text"
            value={formatCep(addressCep)}
            onChange={(e) => {
              const formatted = formatCep(e.target.value);
              setAddressCep(formatted);
              const digits = e.target.value.replace(/\D/g, "");
              if (digits.length === 8) {
                setLoadingCep(true);
                fetchCep(digits).then((result) => {
                  if (result) {
                    setAddressStreet(result.logradouro || "");
                    setAddressNeighborhood(result.bairro || "");
                    setAddressCity(result.localidade || "Itatinga");
                    setAddressState(result.uf || "SP");
                    if (result.complemento) setAddressComplement(result.complemento);
                    toast.success("Endereço preenchido pelo CEP!");
                  } else {
                    toast.error("CEP não encontrado.");
                  }
                  setLoadingCep(false);
                }).catch(() => setLoadingCep(false));
              }
            }}
            inputMode="numeric"
            maxLength={9}
            placeholder="CEP (ex: 18690-000)"
            className="flex-1 bg-card border border-border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary placeholder:text-muted-foreground"
          />
          <button
            onClick={() => {
              const digits = addressCep.replace(/\D/g, "");
              if (digits.length !== 8) { toast.error("CEP inválido."); return; }
              setLoadingCep(true);
              fetchCep(digits).then((result) => {
                if (result) {
                  setAddressStreet(result.logradouro || "");
                  setAddressNeighborhood(result.bairro || "");
                  setAddressCity(result.localidade || "Itatinga");
                  setAddressState(result.uf || "SP");
                  toast.success("Endereço preenchido!");
                } else { toast.error("CEP não encontrado."); }
                setLoadingCep(false);
              }).catch(() => setLoadingCep(false));
            }}
            disabled={loadingCep}
            className="px-3 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50"
          >
            {loadingCep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <input
              type="text"
              value={addressStreet}
              onChange={(e) => setAddressStreet(e.target.value)}
              placeholder="Rua / Avenida"
              maxLength={200}
              className="w-full bg-card border border-border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary placeholder:text-muted-foreground"
            />
          </div>
          <input
            type="text"
            value={addressNumber}
            onChange={(e) => setAddressNumber(e.target.value)}
            placeholder="Nº"
            inputMode="numeric"
            maxLength={10}
            className="w-full bg-card border border-border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary placeholder:text-muted-foreground"
          />
        </div>
        <input
          type="text"
          value={addressComplement}
          onChange={(e) => setAddressComplement(e.target.value)}
          placeholder="Complemento (opcional)"
          maxLength={100}
          className="w-full bg-card border border-border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary placeholder:text-muted-foreground"
        />
        <input
          type="text"
          value={addressNeighborhood}
          onChange={(e) => setAddressNeighborhood(e.target.value)}
          placeholder="Bairro"
          maxLength={100}
          className="w-full bg-card border border-border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary placeholder:text-muted-foreground"
        />
        <input
          type="text"
          value={addressReference}
          onChange={(e) => setAddressReference(e.target.value)}
          placeholder="Ponto de referência (opcional)"
          maxLength={200}
          className="w-full bg-card border border-border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary placeholder:text-muted-foreground"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={addressCity}
            onChange={(e) => setAddressCity(e.target.value)}
            placeholder="Cidade"
            maxLength={100}
            className="w-full bg-card border border-border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary placeholder:text-muted-foreground"
          />
          <input
            type="text"
            value={addressState}
            onChange={(e) => setAddressState(e.target.value.toUpperCase().slice(0, 2))}
            placeholder="UF"
            maxLength={2}
            className="w-full bg-card border border-border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary placeholder:text-muted-foreground"
          />
        </div>
        {addressStreet && addressNumber && (
          <div className="bg-primary/10 border border-primary/30 rounded-xl p-3 flex items-start gap-2">
            <MapPin className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-primary font-bold">Endereço cadastrado</p>
              <p className="text-xs text-muted-foreground">
                {addressStreet}, {addressNumber}{addressComplement ? ` - ${addressComplement}` : ""} — {addressNeighborhood || "Sem bairro"}, {addressCity}/{addressState}
              </p>
            </div>
          </div>
        )}
      </div>


      <div className="space-y-3">
        <label className="text-sm font-bold text-foreground/80 flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          Dados para Recebimento (Pix)
        </label>
        <p className="text-[10px] text-muted-foreground/70 -mt-1">
          Cadastre sua chave Pix para receber os repasses das vendas via App.
        </p>
        {!pixKey && (
          <div className="bg-destructive/10 border-2 border-destructive/40 rounded-xl p-3 space-y-1">
            <p className="text-xs font-bold text-destructive">⚠️ Sua chave Pix NÃO está cadastrada</p>
            <p className="text-[11px] text-foreground/80 leading-snug">
              Sem chave Pix, todo o valor das vendas em PIX fica retido na plataforma — você não recebe o repasse automático. Cadastre agora.
            </p>
          </div>
        )}
        <select
          value={pixType}
          onChange={(e) => setPixType(e.target.value)}
          className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary appearance-none"
        >
          {PIX_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <input
          type="text"
          value={pixType ? formatPixKeyDisplay(pixKey, pixType) : pixKey}
          onChange={(e) => setPixKey(e.target.value)}
          placeholder={PIX_PLACEHOLDERS[pixType] || "Sua chave PIX"}
          maxLength={256}
          className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
        />
        {pixKey && (
          <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-primary font-bold">Chave Pix cadastrada</p>
              <p className="text-xs text-foreground/80 truncate">{pixKey}</p>
              <p className="text-[10px] text-muted-foreground/70">Tipo: {PIX_TYPE_OPTIONS.find(o => o.value === pixType)?.label}</p>
            </div>
          </div>
        )}
      </div>

      {/* Delivery Mode — motoboy da plataforma oculto, forçar "own" */}
      <div className="bg-muted/50 border border-border rounded-2xl p-4 space-y-3">
        <label className="text-sm font-bold text-foreground/80 flex items-center gap-2">
          <Truck className="h-4 w-4 text-primary" />
          Modo de Entrega
        </label>
        <p className="text-[10px] text-muted-foreground/70">
          Configure seu entregador próprio para realizar as entregas.
        </p>
         <div className="grid grid-cols-1 gap-2">
           <div
             className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-primary bg-primary/10"
           >
             <Truck className="h-6 w-6 text-primary" />
             <span className="text-xs font-bold text-primary">
               Sistema Integrado Ativo
             </span>
             <span className="text-[10px] text-muted-foreground text-center">Gestão de entregas e motoboys unificada</span>
           </div>
         </div>
        {deliveryMode === "own" && (
          <div className="space-y-3">
            <div className="bg-muted border border-border rounded-xl p-3 flex items-start gap-2">
              <Truck className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-[10px] text-muted-foreground">
                Com motoboy próprio, você terá um botão "Saiu para Entrega" direto no painel. Não será necessário aguardar aceite de entregador.
              </p>
            </div>
             <div className="flex flex-col gap-2">
               <label className="text-xs font-bold text-foreground/80">Modelo de Cobrança</label>
               <div className="grid grid-cols-2 gap-2">
                 <button
                   onClick={() => setDeliveryFeeType("fixed")}
                   className={`py-2 px-3 rounded-lg text-xs font-bold border-2 transition-all ${deliveryFeeType === "fixed" ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"}`}
                 >
                   Taxa Fixa
                 </button>
                 <button
                   onClick={() => setDeliveryFeeType("km")}
                   className={`py-2 px-3 rounded-lg text-xs font-bold border-2 transition-all ${deliveryFeeType === "km" ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"}`}
                 >
                   Por KM
                 </button>
               </div>
             </div>
 
             {deliveryFeeType === "fixed" ? (
               <div>
                 <label className="text-xs font-bold text-foreground/80 mb-1 block">Taxa de entrega fixa (R$)</label>
                 <input
                   type="text"
                   inputMode="decimal"
                   value={ownDeliveryFee}
                   onChange={(e) => setOwnDeliveryFee(e.target.value.replace(/[^0-9.,]/g, ""))}
                   placeholder="Ex: 5.00"
                   className="w-full bg-card border border-border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                 />
                 <p className="text-[10px] text-muted-foreground mt-1">Este valor é o que <strong>você</strong> recebe pela entrega.</p>
               </div>
             ) : (
               <div className="space-y-3 p-3 bg-secondary/50 rounded-xl border border-border">
                 <div className="grid grid-cols-2 gap-3">
                   <div>
                     <label className="text-[10px] font-bold text-foreground/80 mb-1 block uppercase">Taxa Base (R$)</label>
                     <input
                       type="text"
                       inputMode="decimal"
                       value={deliveryFeeBase}
                        onChange={(e) => setDeliveryFeeBase(e.target.value.replace(/[^0-9.,]/g, ""))}
                       className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm"
                     />
                   </div>
                   <div>
                     <label className="text-[10px] font-bold text-foreground/80 mb-1 block uppercase">Até quantos KM?</label>
                     <input
                       type="text"
                       inputMode="numeric"
                       value={deliveryBaseKm}
                        onChange={(e) => setDeliveryBaseKm(e.target.value.replace(/[^0-9.,]/g, ""))}
                       className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm"
                     />
                   </div>
                 </div>
                 <div>
                   <label className="text-[10px] font-bold text-foreground/80 mb-1 block uppercase">Valor por KM Adicional (R$)</label>
                   <input
                     type="text"
                     inputMode="decimal"
                     value={deliveryFeePerKm}
                      onChange={(e) => setDeliveryFeePerKm(e.target.value.replace(/[^0-9.,]/g, ""))}
                       className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm"
                   />
                   <p className="text-[10px] text-muted-foreground mt-1">Ex: {formatBRL(parseFloat(deliveryFeeBase.replace(",", ".")) || 0)} até {deliveryBaseKm}km, depois +{formatBRL(parseFloat(deliveryFeePerKm.replace(",", ".")) || 0)} p/ cada km extra.</p>
                 </div>
               </div>
             )}

             {/* Preview: como vai aparecer pro cliente */}
             {(() => {
               let lojistaFee = 0;
               let previewLabel = "Sua taxa de entrega:";
               
               if (deliveryFeeType === "fixed") {
                 lojistaFee = parseFloat(ownDeliveryFee.replace(",", ".")) || 0;
               } else {
                 lojistaFee = parseFloat(deliveryFeeBase.replace(",", ".")) || 0;
                 previewLabel = `Sua taxa base (até ${deliveryBaseKm}km):`;
               }
 
               const platformFee = storePlan.platformDeliverySplit || 0;
               const totalCliente = lojistaFee + platformFee;
               
               return (
                 <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-2">
                   <p className="text-xs font-bold text-primary flex items-center gap-1.5">
                     👁️ Como o cliente vai ver
                   </p>
                   <div className="space-y-1 text-xs">
                     <div className="flex justify-between text-muted-foreground">
                       <span>{previewLabel}</span>
                       <span className="font-bold text-foreground">{formatBRL(lojistaFee)}</span>
                     </div>
                     {deliveryFeeType === "km" && (
                       <div className="flex justify-between text-muted-foreground italic opacity-70">
                         <span>Km adicional:</span>
                         <span>+{formatBRL(parseFloat(deliveryFeePerKm.replace(",", ".")) || 0)}/km</span>
                       </div>
                     )}
                     {platformFee > 0 && (
                       <div className="flex justify-between text-muted-foreground">
                         <span>+ Taxa da plataforma:</span>
                         <span className="font-bold text-foreground">{formatBRL(platformFee)}</span>
                       </div>
                     )}
                     <div className="flex justify-between pt-2 border-t border-primary/20">
                       <span className="font-bold text-foreground">Total cobrado do cliente:</span>
                       <span className="font-bold text-primary text-sm">
                         {formatBRL(totalCliente)}
                         {deliveryFeeType === "km" && " + km extra"}
                       </span>
                     </div>
                   </div>
                   {platformFee > 0 ? (
                     <p className="text-[10px] text-muted-foreground/80 leading-relaxed">
                       ℹ️ A plataforma adiciona automaticamente <strong>{formatBRL(platformFee)}</strong> em cima da sua taxa para custear a operação. Você recebe os <strong>{formatBRL(lojistaFee)}</strong> integrais.
                     </p>
                   ) : (
                     <p className="text-[10px] text-muted-foreground/80 leading-relaxed">
                       ℹ️ Você recebe a taxa integral. Sem split de plataforma no seu plano.
                     </p>
                   )}
                 </div>
               );
             })()}
          </div>
        )}
      </div>

      {/* Pizza Half-and-Half Settings */}
      {category === "pizzas" && (
        <div className="bg-muted/50 border border-border rounded-2xl p-4 space-y-4">
          <label className="text-sm font-bold text-foreground/80 flex items-center gap-2">
            🍕 Configurações de Pizza
          </label>

          {/* Toggle: allow half-and-half */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-foreground">Permitir meio a meio</p>
              <p className="text-[10px] text-muted-foreground">Clientes poderão montar pizza com sabores diferentes</p>
            </div>
            <button
              onClick={() => setPizzaHalfEnabled(!pizzaHalfEnabled)}
              className={`w-12 h-6 rounded-full transition-colors relative ${pizzaHalfEnabled ? "bg-primary" : "bg-muted-foreground/30"}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${pizzaHalfEnabled ? "translate-x-6" : "translate-x-0.5"}`} />
            </button>
          </div>

          {/* Price calculation mode */}
          {pizzaHalfEnabled && (
            <div className="space-y-3 pl-1">
              <p className="text-xs font-bold text-foreground/70">Como calcular o valor da pizza meio a meio?</p>

              {/* Option 1: Maior valor */}
              <button
                onClick={() => setPizzaPriceMode("maior")}
                className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                  pizzaPriceMode === "maior" ? "border-primary bg-primary/10" : "border-border bg-card"
                }`}
              >
                <p className={`text-sm font-bold ${pizzaPriceMode === "maior" ? "text-primary" : "text-foreground"}`}>
                  💰 Maior valor
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Cobra o preço do sabor mais caro. Ex: Calabresa R$40 + Mussarela R$35 = <strong>R$40</strong>
                </p>
              </button>

              {/* Option 2: Média */}
              <button
                onClick={() => setPizzaPriceMode("media")}
                className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                  pizzaPriceMode === "media" ? "border-primary bg-primary/10" : "border-border bg-card"
                }`}
              >
                <p className={`text-sm font-bold ${pizzaPriceMode === "media" ? "text-primary" : "text-foreground"}`}>
                  📊 Média dos valores
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Cobra a média dos sabores. Ex: Calabresa R$40 + Mussarela R$35 = <strong>R$37,50</strong>
                </p>
              </button>

              {/* Option 3: Soma dividida */}
              <button
                onClick={() => setPizzaPriceMode("soma")}
                className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                  pizzaPriceMode === "soma" ? "border-primary bg-primary/10" : "border-border bg-card"
                }`}
              >
                <p className={`text-sm font-bold ${pizzaPriceMode === "soma" ? "text-primary" : "text-foreground"}`}>
                  ➗ Soma dividida
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Cobra metade de cada sabor. Ex: Calabresa R$40/2 + Mussarela R$35/2 = <strong>R$37,50</strong>
                </p>
              </button>
            </div>
          )}
        </div>
      )}


      {/* WhatsApp — Em breve */}
      <div className="bg-muted/50 border border-border rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-black text-foreground">WhatsApp Automático</h3>
          <span className="ml-auto text-[10px] font-black bg-primary/10 text-primary px-2 py-0.5 rounded-full">Em breve</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Em breve você poderá conectar seu WhatsApp e enviar notificações automáticas para seus clientes — pedido aceito, saiu para entrega, entregue e muito mais. Tudo pelo painel, sem complicação.
        </p>
        <div className="flex flex-col gap-1.5">
          {["✅ Notificar cliente quando aceitar o pedido","🛵 Notificar quando sair para entrega","📦 Notificar quando for entregue","💬 Responder automaticamente com o link do cardápio"].map(f => (
            <div key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{f}</span>
            </div>
          ))}
        </div>
      </div>



      {/* ─── Métodos de Pagamento ──────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div>
          <h3 className="text-sm font-black text-foreground flex items-center gap-2">
            <QrCode className="h-4 w-4 text-primary" />
            Métodos de Pagamento
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Ative ou desative como seus clientes podem pagar. Apenas os métodos ativos aparecem no checkout.
          </p>
        </div>

        {/* Box informativo sobre repasse */}
        <div className="bg-muted border border-border rounded-xl p-3 space-y-1.5">
          <p className="text-[11px] font-bold text-foreground">Como funciona o repasse</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            <strong className="text-foreground">PIX Online:</strong> a taxa da plataforma (R$1,99 + R$2,00/entrega) é descontada automaticamente pelo Asaas. Você recebe o restante direto na sua conta.
          </p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Dinheiro, Cartão e PIX Maquininha:</strong> o cliente paga direto a você. A taxa de R$2,00 por entrega acumula no painel e é cobrada toda <strong className="text-foreground">segunda-feira</strong> quando atingir R$30.
          </p>
        </div>

        {/* PIX Online (Asaas) — só ativo se conta Asaas 100% aprovada */}
        <div className={`rounded-xl border p-3.5 space-y-2 ${
          !hasAsaasAccount
            ? "border-muted/50 bg-muted/10 opacity-70"
            : !isAsaasFullyApproved
              ? "border-amber-500/30 bg-amber-500/5"
              : acceptPixOnline
                ? "border-primary/30 bg-primary/5"
                : "border-border bg-muted/20"
        }`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <QrCode className="h-4 w-4 text-primary shrink-0" />
              <div>
                <p className="text-sm font-bold text-foreground">PIX Online</p>
                {!hasAsaasAccount && (
                  <p className="text-[10px] text-muted-foreground">Requer conta Asaas configurada</p>
                )}
                {hasAsaasAccount && !isAsaasFullyApproved && (
                  <p className="text-[10px] text-amber-600 font-semibold">⏳ Conta em análise — aguarde aprovação</p>
                )}
                {hasAsaasAccount && isAsaasFullyApproved && (
                  <p className="text-[10px] text-emerald-600 font-semibold">✅ Conta aprovada</p>
                )}
                <p className="text-[11px] text-muted-foreground">Pagamento instantâneo via Asaas. Requer subconta configurada.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!hasAsaasAccount) {
                  toast.error("Configure sua conta Asaas antes de ativar o PIX Online.", {
                    description: "Vá em Meu Plano → Configurar conta de recebimento.",
                    duration: 6000,
                  });
                  return;
                }
                if (!isAsaasFullyApproved) {
                  toast.error("Sua conta Asaas ainda está em análise.", {
                    description: "Aguarde a aprovação de todos os documentos para ativar o PIX Online.",
                    duration: 6000,
                  });
                  return;
                }
                setAcceptPixOnline(!acceptPixOnline);
              }}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                !hasAsaasAccount || !isAsaasFullyApproved
                  ? "bg-muted-foreground/20 cursor-not-allowed"
                  : acceptPixOnline ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${acceptPixOnline ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>
          {acceptPixOnline && !pixKey && (
            <div className="flex items-start gap-2 bg-muted border border-border rounded-lg px-3 py-2">
              <span className="text-muted-foreground text-xs">!</span>
              <p className="text-[11px] text-muted-foreground">
                Você ativou o PIX Online mas não tem chave PIX cadastrada. Vá em <strong>Meu Plano → Configurar conta</strong> para configurar.
              </p>
            </div>
          )}
        </div>

        {/* PIX Maquininha */}
        <div className={`rounded-xl border p-3.5 ${acceptPixMachine ? "border-primary/30 bg-primary/5" : "border-border bg-muted/20"}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <QrCode className="h-4 w-4 text-primary shrink-0" />
              <div>
                <p className="text-sm font-bold text-foreground">PIX na Maquininha</p>
                <p className="text-[11px] text-muted-foreground">Cliente paga via PIX pela maquininha do lojista na entrega. Sem integração com Asaas.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAcceptPixMachine(!acceptPixMachine)}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${acceptPixMachine ? "bg-primary" : "bg-muted-foreground/30"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${acceptPixMachine ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>
        </div>

        {/* Cartão */}
        <div className={`rounded-xl border p-3.5 ${acceptCard ? "border-primary/30 bg-primary/5" : "border-border bg-muted/20"}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <CreditCard className="h-4 w-4 text-primary shrink-0" />
              <div>
                <p className="text-sm font-bold text-foreground">Cartão na Entrega</p>
                <p className="text-[11px] text-muted-foreground">Débito ou crédito pela maquininha na entrega.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAcceptCard(!acceptCard)}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${acceptCard ? "bg-primary" : "bg-muted-foreground/30"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${acceptCard ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>
        </div>

        {/* Dinheiro */}
        <div className={`rounded-xl border p-3.5 ${acceptCash ? "border-primary/30 bg-primary/5" : "border-border bg-muted/20"}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Banknote className="h-4 w-4 text-primary shrink-0" />
              <div>
                <p className="text-sm font-bold text-foreground">Dinheiro</p>
                <p className="text-[11px] text-muted-foreground">Pagamento em espécie na entrega.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAcceptCash(!acceptCash)}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${acceptCash ? "bg-primary" : "bg-muted-foreground/30"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${acceptCash ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>
        </div>

        {/* Aviso mínimo */}
        {!acceptPixOnline && !acceptPixMachine && !acceptCard && !acceptCash && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2.5">
            <p className="text-xs font-bold text-destructive">⚠️ Nenhum método ativo — os clientes não conseguirão finalizar pedidos.</p>
          </div>
        )}
      </div>

      {/* Notifications Section */}
      <NotificationSection />

      {/* Store Status Info */}
      <div className="bg-muted/50 border border-border rounded-2xl p-4 space-y-2">
        <p className="text-sm font-bold text-foreground/80">Status Atual</p>
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${storeIsOpen && !forceClosed ? "bg-primary animate-pulse" : "bg-muted-foreground"}`} />
          <span className={`text-sm font-bold ${storeIsOpen && !forceClosed ? "text-primary" : "text-muted-foreground"}`}>
            {storeIsOpen && !forceClosed ? "Loja Aberta" : "Loja Fechada"}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground/70">
          Use o botão "Pausar/Reabrir" no topo do painel para abrir ou fechar a loja manualmente.
        </p>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving || uploading}
        className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-2xl text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
      >
        <Save className="h-5 w-5" />
        {saving ? "Salvando..." : "Salvar Alterações"}
      </button>
    </div>
  );
};

export default StoreSettings;
