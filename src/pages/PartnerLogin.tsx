import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ArrowLeft, Mail, Lock, Eye, EyeOff, Bike, Store, Shield } from "lucide-react";

const PartnerLogin = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [partnerType, setPartnerType] = useState<"lojista" | "motoboy" | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);

  // Auto-redirect if already logged in
  useEffect(() => {
    if (authLoading || !user) return;
    redirectByRole(user.id);
  }, [user, authLoading]);

  const redirectByRole = async (userId: string) => {
    setChecking(true);
    try {
      // Check admin first
      const { data: adminRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      if (adminRole) {
        navigate("/super-admin", { replace: true });
        return;
      }

      // Check profile role
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, is_approved")
        .eq("user_id", userId)
        .maybeSingle();

      if (!profile || (profile as any).role === "cliente") {
        // No partner profile → go to onboarding
        navigate("/parceiro", { replace: true });
        return;
      }

      const role = (profile as any).role as string;
      if (role === "lojista") {
        navigate("/admin", { replace: true });
      } else if (role === "motoboy") {
        navigate("/entregador", { replace: true });
      } else {
        navigate("/parceiro", { replace: true });
      }
    } catch {
      navigate("/parceiro", { replace: true });
    } finally {
      setChecking(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Preencha todos os campos.");
      return;
    }
    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (mode === "signup" && !partnerType) {
      toast.error("Escolha se você quer vender ou entregar.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        toast.success("Login realizado!");
        if (data.user) await redirectByRole(data.user.id);
      } else {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/portal-parceiro`,
            data: { role: partnerType },
          },
        });
        if (error) throw error;
        toast.success("Conta criada! Verifique seu e-mail para confirmar.");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao autenticar.");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || checking) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Verificando acesso...</p>
      </div>
    );
  }

  if (user) return null; // Will redirect via useEffect

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-card border-b border-border flex items-center h-14 px-4 gap-3">
        <button onClick={() => navigate("/")}>
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="font-bold text-foreground">Portal do Parceiro</h1>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Header icons */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Store className="h-7 w-7 text-primary" />
              </div>
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                <Bike className="h-7 w-7 text-blue-500" />
              </div>
            </div>
            <h2 className="text-xl font-black text-foreground">
              {mode === "login" ? "Acesso Parceiro" : "Criar Conta Parceiro"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "login"
                ? "Entre com sua conta de lojista ou entregador"
                : "Crie sua conta para se cadastrar como parceiro"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Partner type selector - only on signup */}
            {mode === "signup" && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-muted-foreground text-center">Eu quero:</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPartnerType("lojista")}
                    className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1.5 ${
                      partnerType === "lojista"
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-primary/50"
                    }`}
                  >
                    <Store className="h-5 w-5 text-primary" />
                    <span className="text-xs font-bold text-foreground">Vender</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPartnerType("motoboy")}
                    className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1.5 ${
                      partnerType === "motoboy"
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-primary/50"
                    }`}
                  >
                    <Bike className="h-5 w-5 text-primary" />
                    <span className="text-xs font-bold text-foreground">Entregar</span>
                  </button>
                </div>
              </div>
            )}

            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="email"
                placeholder="Seu e-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-12 pl-10 pr-4 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                autoComplete="email"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 pl-10 pr-12 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-primary text-primary-foreground font-bold rounded-xl active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Aguarde...
                </span>
              ) : mode === "login" ? "Entrar" : "Criar Conta"}
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {mode === "login" ? "Não tem conta? " : "Já tem conta? "}
            <button
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="text-primary font-bold"
            >
              {mode === "login" ? "Cadastre-se" : "Faça login"}
            </button>
          </p>

          {/* Security badge */}
          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5" />
            <span>Área exclusiva para parceiros FoodIta</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PartnerLogin;
