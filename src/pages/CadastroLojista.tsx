import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowLeft, Mail, Lock, Eye, EyeOff, Store, FileText, CheckCircle, MapPin, Search, Loader2, Key } from "lucide-react";
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

// Cities with full platform support (motoboys available)
const PLATFORM_CITIES = ["itatinga"];

const schema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").max(100),
  storeName: z.string().trim().min(3, "Nome da loja deve ter pelo menos 3 caracteres").max(100),
  document: z.string().trim().min(11, "CPF/CNPJ inválido").max(18),
  birthDate: z.string().min(10, "Data de nascimento obrigatória").max(10),
  pixType: z.enum(["cpf", "cnpj", "email", "phone", "random"] as const, { errorMap: () => ({ message: "Selecione o tipo da chave PIX" }) }),
  pixKey: z.string().trim().min(1, "Chave PIX obrigatória").max(100),
  storeCategory: z.enum(storeCategories as unknown as [string, ...string[]], { errorMap: () => ({ message: "Selecione uma categoria" }) }),
  cep: z.string().min(8, "CEP inválido"),
  city: z.string().min(1, "Busque o CEP para identificar a cidade"),
});

const CadastroLojista = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [storeName, setStoreName] = useState("");
  const [document, setDocument] = useState("");
  const [storeCategory, setStoreCategory] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [pixType, setPixType] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [cep, setCep] = useState("");
  const [city, setCity] = useState("");
  const [street, setStreet] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [success, setSuccess] = useState(false);
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
      // Normalize city name for storage
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = schema.safeParse({ email, password, storeName, document, birthDate, pixType, pixKey, storeCategory, cep, city });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            full_name: storeName.trim(),
            role: "lojista",
            document: document.trim(),
            birth_date: birthDate,
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

      setSuccess(true);
    } catch (err: any) {
      toast.error(err.message || "Erro ao cadastrar.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        <div className="text-center space-y-4 max-w-sm">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
          <h2 className="text-xl font-black text-foreground">Cadastro Enviado! 🎉</h2>
          <p className="text-sm text-muted-foreground">
            Seu cadastro foi enviado e está em análise. Você receberá um aviso quando for aprovado.
          </p>
          <p className="text-xs text-muted-foreground">
            Verifique seu e-mail para confirmar sua conta.
          </p>
          <button
            onClick={() => navigate("/")}
            className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl mt-4"
          >
            Voltar ao Início
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-card border-b border-border flex items-center h-14 px-4 gap-3">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="flex items-center gap-2">
          <Store className="h-5 w-5 text-primary" />
          <h1 className="font-bold text-foreground">Cadastro Lojista</h1>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <span className="text-4xl mb-3 block">🏠</span>
            <h2 className="text-xl font-black text-foreground">Quero Vender</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Cadastre sua loja no ItaSuper
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <FieldInput icon={Mail} type="email" placeholder="Seu e-mail" value={email} onChange={setEmail} error={errors.email} autoComplete="email" />
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Sua senha (min. 6 caracteres)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 pl-10 pr-12 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                autoComplete="new-password"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2">
                {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
              </button>
              {errors.password && <p className="text-xs text-destructive mt-1">{errors.password}</p>}
            </div>
            <FieldInput icon={Store} placeholder="Nome da Loja" value={storeName} onChange={setStoreName} error={errors.storeName} />
            <FieldInput icon={FileText} placeholder="CPF ou CNPJ" value={document} onChange={setDocument} error={errors.document} inputMode="numeric" />
            <div>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="date"
                  placeholder="Data de Nascimento"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full h-12 pl-10 pr-4 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Data de nascimento do responsável</p>
              {errors.birthDate && <p className="text-xs text-destructive mt-1">{errors.birthDate}</p>}
            </div>

            <div>
              <select
                value={storeCategory}
                onChange={(e) => setStoreCategory(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm appearance-none"
              >
                <option value="">Selecione a categoria</option>
                {storeCategories.map((cat) => (
                  <option key={cat} value={cat}>{categoryLabels[cat] || cat}</option>
                ))}
              </select>
              {errors.storeCategory && <p className="text-xs text-destructive mt-1">{errors.storeCategory}</p>}
            </div>

            {/* CEP field for city detection */}
            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">Localização da Loja</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="CEP da loja (ex: 18690-000)"
                    value={cep}
                    onChange={(e) => handleCepChange(e.target.value)}
                    inputMode="numeric"
                    maxLength={9}
                    className="w-full h-12 pl-10 pr-4 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleCepLookup()}
                  disabled={loadingCep}
                  className="px-4 h-12 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50 flex items-center gap-1"
                >
                  {loadingCep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </button>
              </div>
              {errors.cep && <p className="text-xs text-destructive mt-1">{errors.cep}</p>}
              {errors.city && <p className="text-xs text-destructive mt-1">{errors.city}</p>}

              {city && (
                <div className="mt-2 p-3 rounded-xl border border-border bg-muted/50">
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
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-primary text-primary-foreground font-bold rounded-xl active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Cadastrando...
                </span>
              ) : "Cadastrar Minha Loja"}
            </button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-4">
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

const FieldInput = ({ icon: Icon, placeholder, value, onChange, error, type = "text", autoComplete, inputMode }: {
  icon: React.ElementType; placeholder: string; value: string; onChange: (v: string) => void; error?: string; type?: string; autoComplete?: string; inputMode?: string;
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
        className="w-full h-12 pl-10 pr-4 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
        autoComplete={autoComplete}
      />
    </div>
    {error && <p className="text-xs text-destructive mt-1">{error}</p>}
  </div>
);

export default CadastroLojista;
