import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowLeft, Mail, Lock, Eye, EyeOff, Store, FileText, CheckCircle } from "lucide-react";
import { Constants } from "@/integrations/supabase/types";

const storeCategories = Constants.public.Enums.store_category;

const categoryLabels: Record<string, string> = {
  lanches: "🍔 Lanches", pizzas: "🍕 Pizzas", adegas: "🍷 Adegas",
  japonesa: "🍣 Japonesa", saudavel: "🥗 Saudável", sobremesas: "🍰 Sobremesas",
  cafeteria: "☕ Cafeteria", churrasco: "🥩 Churrasco",
  farmacias: "💊 Farmácia", docerias: "🍰 Doceria",
};

const schema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").max(100),
  storeName: z.string().trim().min(3, "Nome da loja deve ter pelo menos 3 caracteres").max(100),
  document: z.string().trim().min(11, "CPF/CNPJ inválido").max(18),
  storeCategory: z.enum(storeCategories as unknown as [string, ...string[]], { errorMap: () => ({ message: "Selecione uma categoria" }) }),
});

const CadastroLojista = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [storeName, setStoreName] = useState("");
  const [document, setDocument] = useState("");
  const [storeCategory, setStoreCategory] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = schema.safeParse({ email, password, storeName, document, storeCategory });
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
      // 1. Create auth account
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (signUpError) throw signUpError;

      const userId = signUpData.user?.id;
      if (!userId) throw new Error("Erro ao criar conta.");

      // 2. Register as lojista via RPC
      const { error: rpcError } = await supabase.rpc("register_as_lojista", {
        _full_name: storeName.trim(),
        _document: document.trim(),
        _store_name: storeName.trim(),
        _store_category: storeCategory,
      } as any);
      if (rpcError) throw rpcError;

      // 3. Sync to external Supabase
      try {
        await supabase.functions.invoke("sync-to-external", {
          body: { action: "sync_stores" },
        });
      } catch {
        // Non-blocking
      }

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
              Cadastre sua loja no FoodIta
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
