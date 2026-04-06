import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, Upload, Save, Store, Phone, Tag, MapPin, Link, Copy, Wallet, Search, Loader2, Bell, CheckCircle2, XCircle, Truck, Bike } from "lucide-react";
import { requestPushPermissionAndRegister } from "@/lib/firebase";
import { isGoNative, registerGoNativePlayer } from "@/lib/gonative";
import { maskWhatsApp } from "@/lib/whatsapp";
import { formatCep, fetchCep } from "@/lib/cepLookup";

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
];

interface StoreSettingsProps {
  storeId: string;
  storeName: string;
  storeCategory: string;
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
}

const StoreSettings = ({ storeId, storeName, storeCategory, storeImageUrl, storeIsOpen, forceClosed, storeSlug, storeAddressStreet, storeAddressNumber, storeAddressComplement, storeAddressNeighborhood, storeAddressReference, storeAddressCity, storeAddressState, storeAddressCep, storeDeliveryMode }: StoreSettingsProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [name, setName] = useState(storeName);
  const [category, setCategory] = useState(storeCategory);
  const [slug, setSlug] = useState(storeSlug || "");
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

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo 2MB.");
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop();
    // Path: userId/logo_timestamp.ext (matches RLS policy)
    const filePath = `${user.id}/logo_${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("store-assets")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      toast.error("Erro ao subir imagem. Verifique sua conexão ou tente um arquivo menor (até 2MB).");
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("store-assets")
      .getPublicUrl(filePath);

    setImageUrl(urlData.publicUrl);
    setUploading(false);
    toast.success("Imagem carregada!");
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
    const { error: storeError } = await supabase
      .from("stores")
      .update({
        name: name.trim(),
        category: category as any,
        image_url: imageUrl || null,
        slug: cleanSlug || null,
        delivery_mode: deliveryMode,
        address_street: addressStreet.trim() || null,
        address_number: addressNumber.trim() || null,
        address_complement: addressComplement.trim() || null,
        address_neighborhood: addressNeighborhood.trim() || null,
        address_reference: addressReference.trim() || null,
        address_city: addressCity.trim() || "Itatinga",
        address_state: addressState.trim() || "SP",
        address_cep: addressCep.replace(/\D/g, "") || null,
      } as any)
      .eq("id", storeId);

    if (storeError) {
      toast.error("Erro ao salvar dados da loja.");
      setSaving(false);
      return;
    }

    // Update whatsapp + pix on profile
    if (user) {
      const cleanWhatsapp = whatsapp.replace(/\D/g, "");
      await supabase
        .from("profiles")
        .update({
          whatsapp_number: cleanWhatsapp || null,
          pix_key: pixKey.trim() || null,
          pix_type: (pixType as any) || null,
        })
        .eq("user_id", user.id);
    }

    queryClient.invalidateQueries({ queryKey: ["my-store"] });
    toast.success("✅ Configurações salvas com sucesso!");
    setSaving(false);
  };

const NotificationSection = () => {
  const [notifStatus, setNotifStatus] = useState<"checking" | "granted" | "denied" | "default" | "unsupported">("checking");
  const [enabling, setEnabling] = useState(false);
  const native = isGoNative();

  useEffect(() => {
    if (native) {
      // In GoNative, notifications are always available via OneSignal
      setNotifStatus("granted");
      return;
    }
    if (!("Notification" in window)) {
      setNotifStatus("unsupported");
      return;
    }
    setNotifStatus(Notification.permission as any);
  }, [native]);

  const handleEnable = async () => {
    setEnabling(true);
    try {
      if (native) {
        await registerGoNativePlayer();
        toast.success("Notificações nativas ativadas!");
        setNotifStatus("granted");
      } else {
        const result = await Notification.requestPermission();
        setNotifStatus(result as any);
        if (result === "granted") {
          await requestPushPermissionAndRegister();
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
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
          <div>
            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Notificações ativas</p>
            <p className="text-[10px] text-muted-foreground">Você receberá alertas de novos pedidos.</p>
          </div>
        </div>
      ) : notifStatus === "denied" ? (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
          <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
          <div>
            <p className="text-xs font-bold text-red-600 dark:text-red-400">Notificações bloqueadas</p>
            <p className="text-[10px] text-muted-foreground">Acesse as configurações do navegador/app para desbloquear.</p>
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
              <img src={imageUrl} alt="Logo" className="w-full h-full object-cover" />
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
          Categoria
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary appearance-none"
        >
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* WhatsApp */}
      <div className="space-y-2">
        <label className="text-sm font-bold text-foreground/80 flex items-center gap-2">
          <Phone className="h-4 w-4 text-primary" />
          WhatsApp de Atendimento
        </label>
        <input
          type="tel"
          inputMode="numeric"
          value={maskWhatsApp(whatsapp)}
          onChange={(e) => setWhatsapp(e.target.value.replace(/\D/g, "").slice(0, 11))}
          placeholder="+55 14 99999-9999"
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
            <span className="text-xs text-muted-foreground/70 pl-3 whitespace-nowrap">foodita.app/</span>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
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
              {window.location.origin}/{slug}
            </span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/${slug}`);
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
          value={pixKey}
          onChange={(e) => setPixKey(e.target.value)}
          placeholder={pixType === "cpf" ? "000.000.000-00" : pixType === "cnpj" ? "00.000.000/0000-00" : pixType === "email" ? "email@exemplo.com" : pixType === "phone" ? "+55 14 99999-9999" : "Chave aleatória"}
          maxLength={256}
          className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
        />
        {pixKey && (
          <div className="bg-primary/10 border border-green-500/20 rounded-xl p-3 flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-primary font-bold">Chave Pix cadastrada</p>
              <p className="text-xs text-foreground/80 truncate">{pixKey}</p>
              <p className="text-[10px] text-muted-foreground/70">Tipo: {PIX_TYPE_OPTIONS.find(o => o.value === pixType)?.label}</p>
            </div>
          </div>
        )}
      </div>

      {/* Notifications Section */}
      <NotificationSection />

      {/* Store Status Info */}
      <div className="bg-muted/50 border border-border rounded-2xl p-4 space-y-2">
        <p className="text-sm font-bold text-foreground/80">Status Atual</p>
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${storeIsOpen && !forceClosed ? "bg-primary animate-pulse" : "bg-red-400"}`} />
          <span className={`text-sm font-bold ${storeIsOpen && !forceClosed ? "text-primary" : "text-red-400"}`}>
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
