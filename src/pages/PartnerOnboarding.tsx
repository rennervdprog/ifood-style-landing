import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { z } from "zod";
import {
  Store, Bike, ArrowLeft, ArrowRight, Camera, Upload,
  User, FileText, Truck, ChefHat, MessageCircle
} from "lucide-react";
import { Constants } from "@/integrations/supabase/types";
import { maskWhatsApp, isValidWhatsApp, formatWhatsAppNumber } from "@/lib/whatsapp";

type PartnerType = "lojista" | "motoboy" | null;

const storeCategories = Constants.public.Enums.store_category;

const lojistSchema = z.object({
  fullName: z.string().trim().min(3, "Nome deve ter pelo menos 3 caracteres").max(100),
  document: z.string().trim().min(11, "CPF/CNPJ inválido").max(18),
  storeName: z.string().trim().min(3, "Nome da loja deve ter pelo menos 3 caracteres").max(100),
  storeCategory: z.enum(storeCategories as unknown as [string, ...string[]], { errorMap: () => ({ message: "Selecione uma categoria" }) }),
  whatsapp: z.string().refine(isValidWhatsApp, "WhatsApp inválido. Digite com DDD (ex: 15 99999-9999)"),
});

const motoboySchema = z.object({
  fullName: z.string().trim().min(3, "Nome deve ter pelo menos 3 caracteres").max(100),
  document: z.string().trim().min(11, "CPF inválido").max(14),
  vehicle: z.string().trim().min(3, "Informe o modelo do veículo").max(100),
  whatsapp: z.string().refine(isValidWhatsApp, "WhatsApp inválido. Digite com DDD (ex: 15 99999-9999)"),
});

const categoryLabels: Record<string, string> = {
  lanches: "🍔 Lanches",
  pizzas: "🍕 Pizzas",
  adegas: "🍷 Adegas",
  japonesa: "🍣 Japonesa",
  saudavel: "🥗 Saudável",
  sobremesas: "🍰 Sobremesas",
  cafeteria: "☕ Cafeteria",
  churrasco: "🥩 Churrasco",
  farmacias: "💊 Farmácia / Drogaria",
  docerias: "🍰 Doceria / Confeitaria / Açaí",
};

const PartnerOnboarding = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1);
  const [partnerType, setPartnerType] = useState<PartnerType>(null);
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form fields
  const [fullName, setFullName] = useState("");
  const [document, setDocument] = useState("");
  const [storeName, setStoreName] = useState("");
  const [storeCategory, setStoreCategory] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  // Check if user already has a profile with a role
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // Redirect if already registered
  if (profile && (profile as any).role === "lojista") {
    navigate("/admin", { replace: true });
    return null;
  }
  if (profile && (profile as any).role === "motoboy") {
    navigate("/entregador", { replace: true });
    return null;
  }

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    navigate("/auth", { state: { from: "/parceiro" }, replace: true });
    return null;
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem deve ter no máximo 5MB.");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile || !user) return null;
    const ext = imageFile.name.split(".").pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("partner-images")
      .upload(path, imageFile, { upsert: true });
    if (error) {
      console.error("Upload error:", error);
      return null;
    }
    const { data: urlData } = supabase.storage.from("partner-images").getPublicUrl(path);
    return urlData.publicUrl;
  };

  const handleSubmit = async () => {
    setErrors({});

    if (partnerType === "lojista") {
      const result = lojistSchema.safeParse({ fullName, document, storeName, storeCategory, whatsapp });
      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        result.error.errors.forEach(e => { fieldErrors[e.path[0] as string] = e.message; });
        setErrors(fieldErrors);
        return;
      }
    } else {
      const result = motoboySchema.safeParse({ fullName, document, vehicle, whatsapp });
      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        result.error.errors.forEach(e => { fieldErrors[e.path[0] as string] = e.message; });
        setErrors(fieldErrors);
        return;
      }
    }

    setLoading(true);
    try {
      const avatarUrl = await uploadImage();
      const formattedWhatsapp = formatWhatsAppNumber(whatsapp);

      if (partnerType === "lojista") {
        const { error } = await supabase.rpc("register_as_lojista", {
          _full_name: fullName.trim(),
          _document: document.trim(),
          _store_name: storeName.trim(),
          _store_category: storeCategory,
          _avatar_url: avatarUrl,
          _whatsapp: formattedWhatsapp,
        } as any);
        if (error) throw error;
        toast.success("Cadastro realizado com sucesso! Bem-vindo ao FoodIta. 🎉");
        navigate("/admin", { replace: true });
      } else {
        const { error } = await supabase.rpc("register_as_motoboy", {
          _full_name: fullName.trim(),
          _document: document.trim(),
          _vehicle: vehicle.trim(),
          _avatar_url: avatarUrl,
          _whatsapp: formattedWhatsapp,
        } as any);
        if (error) throw error;
        toast.success("Cadastro realizado com sucesso! Bem-vindo ao FoodIta. 🎉");
        navigate("/entregador", { replace: true });
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao cadastrar.");
    } finally {
      setLoading(false);
    }
  };

  const totalSteps = 2;
  const progressPercent = (step / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => step > 1 ? setStep(step - 1) : navigate(-1)}>
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-sm text-foreground">Seja um Parceiro</h1>
            <p className="text-xs text-muted-foreground">Passo {step} de {totalSteps}</p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </header>

      <div className="px-4 py-6">
        {/* Step 1: Choose role */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-black text-foreground">Como quer participar?</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Escolha como você quer fazer parte do FoodIta
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => { setPartnerType("lojista"); setStep(2); }}
                className={`w-full p-6 rounded-2xl border-2 transition-all text-left ${
                  partnerType === "lojista"
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-primary/50"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Store className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">🏠 Quero Vender</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Abra sua loja e venda pelo FoodIta
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => { setPartnerType("motoboy"); setStep(2); }}
                className={`w-full p-6 rounded-2xl border-2 transition-all text-left ${
                  partnerType === "motoboy"
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-primary/50"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                    <Bike className="h-7 w-7 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">🏍️ Quero Entregar</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Faça entregas e ganhe dinheiro no FoodIta
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Form */}
        {step === 2 && partnerType && (
          <div className="space-y-5">
            <div className="text-center">
              <h2 className="text-xl font-black text-foreground">
                {partnerType === "lojista" ? "Dados da sua Loja" : "Dados do Entregador"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Preencha os dados para começar
              </p>
            </div>

            {/* Avatar upload */}
            <div className="flex justify-center">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="relative w-24 h-24 rounded-2xl bg-muted border-2 border-dashed border-border hover:border-primary/50 transition-colors flex items-center justify-center overflow-hidden"
              >
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <Camera className="h-6 w-6 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">Foto</span>
                  </div>
                )}
                <div className="absolute bottom-1 right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                  <Upload className="h-3 w-3 text-primary-foreground" />
                </div>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
              />
            </div>

            {/* Common fields */}
            <div className="space-y-4">
              <InputField
                icon={User}
                label="Nome Completo"
                placeholder="Seu nome completo"
                value={fullName}
                onChange={setFullName}
                error={errors.fullName}
              />
              <InputField
                icon={FileText}
                label="CPF / CNPJ"
                placeholder={partnerType === "lojista" ? "CPF ou CNPJ" : "Seu CPF"}
                value={document}
                onChange={setDocument}
                error={errors.document}
                inputMode="numeric"
              />

              {/* WhatsApp field */}
              <div>
                <label className="text-sm font-bold text-foreground mb-1.5 flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-green-500" />
                  {partnerType === "lojista" ? "WhatsApp do Estabelecimento" : "Seu WhatsApp para Contato"}
                </label>
                <p className="text-xs text-muted-foreground mb-2">Digite o número com DDD (ex: 15 99999-9999)</p>
                <input
                  type="tel"
                  inputMode="tel"
                  placeholder="+55 14 99999-9999"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(maskWhatsApp(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl border border-green-500/30 bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                />
                {errors.whatsapp && <p className="text-xs text-destructive mt-1">{errors.whatsapp}</p>}
              </div>

              {/* Lojista-specific */}
              {partnerType === "lojista" && (
                <>
                  <InputField
                    icon={Store}
                    label="Nome da Loja"
                    placeholder="Ex: Pizzaria do João"
                    value={storeName}
                    onChange={setStoreName}
                    error={errors.storeName}
                  />
                  <div>
                    <label className="text-sm font-bold text-foreground mb-1.5 flex items-center gap-2">
                      <ChefHat className="h-4 w-4 text-muted-foreground" />
                      Categoria
                    </label>
                    <select
                      value={storeCategory}
                      onChange={(e) => setStoreCategory(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm appearance-none"
                    >
                      <option value="">Selecione a categoria</option>
                      {storeCategories.map(cat => (
                        <option key={cat} value={cat}>{categoryLabels[cat] || cat}</option>
                      ))}
                    </select>
                    {errors.storeCategory && (
                      <p className="text-xs text-destructive mt-1">{errors.storeCategory}</p>
                    )}
                  </div>
                </>
              )}

              {/* Motoboy-specific */}
              {partnerType === "motoboy" && (
                <InputField
                  icon={Truck}
                  label="Modelo do Veículo"
                  placeholder="Ex: Honda Fan 150"
                  value={vehicle}
                  onChange={setVehicle}
                  error={errors.vehicle}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Fixed bottom button */}
      {step === 2 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-card border-t border-border">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-secondary text-secondary-foreground font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-secondary-foreground/30 border-t-secondary-foreground rounded-full animate-spin" />
                Cadastrando...
              </span>
            ) : partnerType === "lojista" ? (
              <>Abrir Minha Loja <ArrowRight className="h-4 w-4" /></>
            ) : (
              <>Começar a Entregar <ArrowRight className="h-4 w-4" /></>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

// Reusable input component
const InputField = ({ icon: Icon, label, placeholder, value, onChange, error, inputMode }: {
  icon: React.ElementType;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  inputMode?: "text" | "numeric";
}) => (
  <div>
    <label className="text-sm font-bold text-foreground mb-1.5 flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground" />
      {label}
    </label>
    <input
      type="text"
      inputMode={inputMode}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-4 py-3 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
    />
    {error && <p className="text-xs text-destructive mt-1">{error}</p>}
  </div>
);

export default PartnerOnboarding;
