import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowLeft, Mail, Lock, Eye, EyeOff, Store, FileText, CheckCircle, MapPin, Search, Loader2, Key, Phone, Shield, ChevronRight, User } from "lucide-react";
import { Constants } from "@/integrations/supabase/types";
import { formatCep, fetchCep } from "@/lib/cepLookup";

const storeCategories = Constants.public.Enums.store_category;

const categoryLabels: Record<string, string> = {
  lanches: "🍔 Lanches", pizzas: "🍕 Pizzas", adegas: "🍷 Adegas",
  japonesa: "🍣 Japonesa", saudavel: "🥗 Saudável", sobremesas: "🍰 Sobremesas",
  cafeteria: "☕ Cafeteria", churrasco: "🥩 Churrasco",
  farmacias: "💊 Farmácia", docerias: "🍰 Doceria",
};

const pixTypeLabels: Record<string, string> = {
  cpf: "CPF", cnpj: "CNPJ", email: "E-mail", phone: "Telefone", random: "Chave Aleatória",
};

const PLATFORM_CITIES = ["itatinga"];

const schema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  confirmEmail: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").max(100),
  storeName: z.string().trim().min(3, "Nome da loja deve ter pelo menos 3 caracteres").max(100),
  document: z.string().trim().min(11, "CPF/CNPJ inválido").max(18),
  birthDate: z.string().min(10, "Data de nascimento obrigatória").max(10),
  whatsapp: z.string().trim().min(10, "WhatsApp inválido (ex: 14 99999-9999)").max(20),
  pixType: z.enum(["cpf", "cnpj", "email", "phone", "random"] as const, { errorMap: () => ({ message: "Selecione o tipo da chave PIX" }) }),
  pixKey: z.string().trim().min(1, "Chave PIX obrigatória").max(100),
  storeCategory: z.enum(storeCategories as unknown as [string, ...string[]], { errorMap: () => ({ message: "Selecione uma categoria" }) }),
  cep: z.string().min(8, "CEP inválido"),
  city: z.string().min(1, "Busque o CEP para identificar a cidade"),
}).refine((data) => data.email === data.confirmEmail, {
  message: "Os e-mails não coincidem",
  path: ["confirmEmail"],
});

const STEPS = [
  { label: "Conta", icon: Mail },
  { label: "Loja", icon: Store },
  { label: "Dados", icon: User },
];

const CadastroLojista = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState("");
  const [storeName, setStoreName] = useState("");
  const [document, setDocument] = useState("");
  const [storeCategory, setStoreCategory] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [pixType, setPixType] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [cep, setCep] = useState("");
  const [city, setCity] = useState("");
  const [street, setStreet] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleCepChange = (value: string) => {
    const formatted = formatCep(value);
    setCep(formatted);
    const digits = value.replace(/\D/g, "");
    if (digits.length === 8) {
      handleCepLookup(digits);
    }
  };

  const handleCepLookup = async (digits?: string) => {
    const cepDigits = digits || cep.replace(/\D/g, "");
    if (cepDigits.length !== 8) {
      toast.error("Digite um CEP válido com 8 dígitos.");
      return;
    }
    setLoadingCep(true);
    try {
      const result = await fetchCep(cepDigits);
      if (!result) {
        toast.error("CEP não encontrado.");
        return;
      }
      setStreet(result.logradouro || "");
      setNeighborhood(result.bairro || "");
      const detectedCity = result.localidade || "";
      setCity(detectedCity);
      toast.success(`Cidade identificada: ${detectedCity} - ${result.uf}`);
    } catch {
      toast.error("Erro ao buscar CEP.");
    } finally {
      setLoadingCep(false);
    }
  };

  const normalizedCity = city.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_");
  const isPlatformCity = PLATFORM_CITIES.includes(normalizedCity);

  const validateStep = (stepIndex: number): boolean => {
    setErrors({});
    if (stepIndex === 0) {
      const fieldErrors: Record<string, string> = {};
      if (!email.trim()) fieldErrors.email = "E-mail obrigatório";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) fieldErrors.email = "E-mail inválido";
      if (!confirmEmail.trim()) fieldErrors.confirmEmail = "Confirme seu e-mail";
      else if (email.trim() !== confirmEmail.trim()) fieldErrors.confirmEmail = "Os e-mails não coincidem";
      if (!password) fieldErrors.password = "Senha obrigatória";
      else if (password.length < 6) fieldErrors.password = "Senha deve ter pelo menos 6 caracteres";
      if (Object.keys(fieldErrors).length > 0) { setErrors(fieldErrors); return false; }
    }
    if (stepIndex === 1) {
      const fieldErrors: Record<string, string> = {};
      if (storeName.trim().length < 3) fieldErrors.storeName = "Nome da loja deve ter pelo menos 3 caracteres";
      if (!storeCategory) fieldErrors.storeCategory = "Selecione uma categoria";
      if (cep.replace(/\D/g, "").length < 8) fieldErrors.cep = "CEP inválido";
      if (!city) fieldErrors.city = "Busque o CEP para identificar a cidade";
      if (Object.keys(fieldErrors).length > 0) { setErrors(fieldErrors); return false; }
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep(step)) setStep(prev => Math.min(prev + 1, 2));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = schema.safeParse({ email, confirmEmail, password, storeName, document, birthDate, whatsapp, pixType, pixKey, storeCategory, cep, city });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    if (!acceptedTerms) {
      toast.error("Você precisa aceitar os Termos de Uso e Política de Privacidade.");
      return;
    }

    setLoading(true);
    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            full_name: storeName.trim(),
            role: "lojista",
            document: document.trim(),
            birth_date: birthDate,
            whatsapp: whatsapp.trim(),
            phone: whatsapp.trim(),
            pix_type: pixType,
            pix_key: pixKey.trim(),
            store_name: storeName.trim(),
            store_category: storeCategory,
            city: normalizedCity,
            cep: cep.replace(/\D/g, ""),
            street: street,
            neighborhood: neighborhood,
          },
        },
      });
      if (signUpError) throw signUpError;

      if (signUpData?.user?.id) {
        await supabase.from("terms_acceptance").insert({
          user_id: signUpData.user.id,
          terms_version: "1.0",
          privacy_version: "1.0",
          user_agent: navigator.userAgent,
        });
        await supabase.from("profiles").update({
          terms_accepted_at: new Date().toISOString(),
        }).eq("user_id", signUpData.user.id);
      }

      toast.success("Cadastro realizado com sucesso!");
      navigate("/admin", { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Erro ao cadastrar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-xl border-b border-border flex items-center h-14 px-4 gap-3">
        <button onClick={() => step > 0 ? setStep(step - 1) : navigate(-1)} className="w-9 h-9 rounded-xl bg-muted/50 flex items-center justify-center">
          <ArrowLeft className="h-4 w-4 text-foreground" />
        </button>
        <div className="flex items-center gap-2">
          <Store className="h-5 w-5 text-primary" />
          <h1 className="font-bold text-foreground text-sm">Cadastro Lojista</h1>
        </div>
      </header>

      {/* Stepper */}
      <div className="px-6 pt-5 pb-2">
        <div className="flex items-center justify-between gap-2">
          {STEPS.map((s, i) => {
            const isActive = i === step;
            const isDone = i < step;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
                  isDone ? "bg-green-500/10" : isActive ? "bg-primary/10" : "bg-muted/50"
                }`}>
                  {isDone ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <s.icon className={`h-5 w-5 ${isActive ? "text-primary" : "text-muted-foreground/50"}`} />
                  )}
                </div>
                <span className={`text-[10px] font-bold ${isDone ? "text-green-500" : isActive ? "text-primary" : "text-muted-foreground/50"}`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center px-6 py-4 overflow-y-auto">
        <div className="w-full max-w-sm">
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* ═══ Step 0: Conta ═══ */}
            {step === 0 && (
              <div className="space-y-4">
                <div className="text-center mb-2">
                  <h2 className="text-lg font-black text-foreground">Crie sua conta</h2>
                  <p className="text-xs text-muted-foreground mt-1">Dados de acesso à plataforma</p>
                </div>

                <FieldInput icon={Mail} type="email" placeholder="Seu e-mail" value={email} onChange={setEmail} error={errors.email} autoComplete="email" />
                <FieldInput icon={Mail} type="email" placeholder="Confirme seu e-mail" value={confirmEmail} onChange={setConfirmEmail} error={errors.confirmEmail} autoComplete="email" />
                <p className="text-[10px] text-muted-foreground -mt-2 px-1 flex items-center gap-1">
                  <Shield className="h-3 w-3 text-primary flex-shrink-0" />
                  Garanta que o e-mail esteja correto. Será usado para notificações e repasses financeiros.
                </p>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Sua senha (min. 6 caracteres)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-12 pl-10 pr-12 rounded-2xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1">
                    {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </button>
                  {errors.password && <p className="text-xs text-destructive mt-1">{errors.password}</p>}
                </div>

                <button
                  type="button"
                  onClick={nextStep}
                  className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  Próximo <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* ═══ Step 1: Loja ═══ */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="text-center mb-2">
                  <h2 className="text-lg font-black text-foreground">Sobre sua loja</h2>
                  <p className="text-xs text-muted-foreground mt-1">Nome, categoria e localização</p>
                </div>

                <FieldInput icon={Store} placeholder="Nome da Loja" value={storeName} onChange={setStoreName} error={errors.storeName} />

                <div>
                  <div className="relative">
                    <Store className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <select
                      value={storeCategory}
                      onChange={(e) => setStoreCategory(e.target.value)}
                      className="w-full h-12 pl-10 pr-4 rounded-2xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm appearance-none"
                    >
                      <option value="">Selecione a categoria</option>
                      {storeCategories.map((cat) => (
                        <option key={cat} value={cat}>{categoryLabels[cat] || cat}</option>
                      ))}
                    </select>
                  </div>
                  {errors.storeCategory && <p className="text-xs text-destructive mt-1 px-1">{errors.storeCategory}</p>}
                </div>

                {/* CEP */}
                <div>
                  <label className="text-xs font-bold text-muted-foreground mb-1.5 block px-1">Localização da Loja</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="CEP (ex: 18690-000)"
                        value={cep}
                        onChange={(e) => handleCepChange(e.target.value)}
                        inputMode="numeric"
                        maxLength={9}
                        className="w-full h-12 pl-10 pr-4 rounded-2xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCepLookup()}
                      disabled={loadingCep}
                      className="px-4 h-12 rounded-2xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50 flex items-center gap-1"
                    >
                      {loadingCep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.cep && <p className="text-xs text-destructive mt-1 px-1">{errors.cep}</p>}
                  {errors.city && <p className="text-xs text-destructive mt-1 px-1">{errors.city}</p>}

                  {city && (
                    <div className="mt-2 p-3 rounded-2xl border border-border bg-muted/50">
                      <p className="text-sm font-bold text-foreground flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        {city}
                        {isPlatformCity ? (
                          <span className="text-xs bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full">✅ Plataforma Completa</span>
                        ) : (
                          <span className="text-xs bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full">📱 Cardápio Digital</span>
                        )}
                      </p>
                      {street && <p className="text-xs text-muted-foreground mt-1">{street}{neighborhood ? ` - ${neighborhood}` : ""}</p>}
                      {!isPlatformCity && (
                        <p className="text-xs text-amber-600 mt-1">
                          Motoboys da plataforma ainda não disponíveis. Sua loja funcionará como cardápio digital com motoboy próprio.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={nextStep}
                  className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  Próximo <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* ═══ Step 2: Dados Pessoais & Financeiro ═══ */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="text-center mb-2">
                  <h2 className="text-lg font-black text-foreground">Dados pessoais</h2>
                  <p className="text-xs text-muted-foreground mt-1">Documento, contato e dados de pagamento</p>
                </div>

                <FieldInput icon={FileText} placeholder="CPF ou CNPJ" value={document} onChange={setDocument} error={errors.document} inputMode="numeric" />

                <div>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="date"
                      placeholder="Data de Nascimento"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="w-full h-12 pl-10 pr-4 rounded-2xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 px-1">Data de nascimento do responsável</p>
                  {errors.birthDate && <p className="text-xs text-destructive mt-1 px-1">{errors.birthDate}</p>}
                </div>

                <div>
                  <FieldInput icon={Phone} placeholder="WhatsApp (DDD + número)" value={whatsapp} onChange={setWhatsapp} error={errors.whatsapp} inputMode="tel" />
                  <p className="text-[10px] text-muted-foreground mt-1 px-1">Ex: 14 99999-9999. Usado para contato e Asaas.</p>
                </div>

                {/* PIX */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground px-1 block">Chave PIX para recebimento</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <select
                      value={pixType}
                      onChange={(e) => setPixType(e.target.value)}
                      className="w-full h-12 pl-10 pr-4 rounded-2xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm appearance-none"
                    >
                      <option value="">Tipo da chave PIX</option>
                      {Object.entries(pixTypeLabels).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </div>
                  {errors.pixType && <p className="text-xs text-destructive mt-1 px-1">{errors.pixType}</p>}
                  <FieldInput icon={Key} placeholder={pixType === "email" ? "seu@email.com" : pixType === "phone" ? "(11) 99999-9999" : "Sua chave PIX"} value={pixKey} onChange={setPixKey} error={errors.pixKey} />
                  <p className="text-[10px] text-muted-foreground px-1">Chave PIX onde você receberá os pagamentos</p>
                </div>

                {/* Terms */}
                <label className="flex items-start gap-3 cursor-pointer select-none bg-muted/50 rounded-2xl p-3.5">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="w-5 h-5 rounded-lg border-border accent-primary mt-0.5 shrink-0"
                  />
                  <span className="text-xs text-muted-foreground leading-relaxed">
                    Li e aceito os{" "}
                    <Link to="/termos-de-uso" target="_blank" className="text-primary font-bold underline">Termos de Uso</Link>{" "}
                    e a{" "}
                    <Link to="/politica-de-privacidade" target="_blank" className="text-primary font-bold underline">Política de Privacidade</Link>{" "}
                    do ItaSuper.
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      Cadastrando...
                    </span>
                  ) : "Cadastrar Minha Loja"}
                </button>
              </div>
            )}
          </form>

          <p className="text-center text-xs text-muted-foreground mt-5 mb-8">
            Já tem conta?{" "}
            <button onClick={() => navigate("/auth")} className="text-primary font-bold">
              Faça login
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

const FieldInput = ({ icon: Icon, placeholder, value, onChange, error, type = "text", autoComplete, inputMode, maxLength }: {
  icon: React.ElementType; placeholder: string; value: string; onChange: (v: string) => void; error?: string; type?: string; autoComplete?: string; inputMode?: string; maxLength?: number;
}) => (
  <div>
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <input
        type={type}
        inputMode={inputMode as any}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-12 pl-10 pr-4 rounded-2xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
        autoComplete={autoComplete}
        maxLength={maxLength}
      />
    </div>
    {error && <p className="text-xs text-destructive mt-1 px-1">{error}</p>}
  </div>
);

export default CadastroLojista;
