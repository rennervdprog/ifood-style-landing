import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { isCapacitorNative, hasPendingPushNavigation } from "@/lib/capacitorNative";
import { persistCapacitorAppMode } from "@/lib/capacitorAppMode";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Mail, Lock, Eye, EyeOff, Store, Shield, Bike } from "lucide-react";
import { resolvePartnerDashboard } from "@/lib/partnerDashboard";
import BiometricLoginButton from "@/components/BiometricLoginButton";
import {
  isBiometricAvailable,
  isBiometricEnabled,
  enableBiometricLogin,
  wasBiometricPromptDismissed,
  markBiometricPromptDismissed,
} from "@/lib/biometricAuth";

const PartnerLogin = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "choose">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
     if (authLoading) return;
     
     if (user) {
       if (hasPendingPushNavigation()) return;
       redirectByRole(user.id);
     } else if (isCapacitorNative()) {
       // Força modo parceiro ao carregar esta página no nativo
       persistCapacitorAppMode("partner");
     }
   }, [user, authLoading]);

  const redirectByRole = async (userId: string) => {
    // If we are on the partner login page, we should ensure the app mode is 'partner'
    if (isCapacitorNative()) {
      persistCapacitorAppMode("partner");
    }
    setChecking(true);
    try {
      const dashboardPath = await resolvePartnerDashboard(userId);
      if (dashboardPath === "/portal-parceiro") {
        // On Capacitor, show choose mode instead of navigating to onboarding landing
        if (isCapacitorNative()) {
          setMode("choose");
          setChecking(false);
          return;
        }
        navigate("/parceiro", { replace: true });
        return;
      }
      navigate(dashboardPath, { replace: true });
    } catch {
      if (isCapacitorNative()) {
        setMode("choose");
        setChecking(false);
        return;
      }
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

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      toast.success("Login realizado!");

      // Offer biometric login (Capacitor only)
      if (
        isCapacitorNative() &&
        !isBiometricEnabled() &&
        !wasBiometricPromptDismissed()
      ) {
        try {
          const available = await isBiometricAvailable();
          if (available) {
            const accept = window.confirm(
              "Deseja ativar login por biometria?\n\nDa próxima vez, basta usar sua digital ou Face ID."
            );
            if (accept) {
              const ok = await enableBiometricLogin(email.trim(), password);
              if (ok) toast.success("Biometria ativada!");
            } else {
              markBiometricPromptDismissed();
            }
          }
        } catch (e) {
          console.warn("[PartnerLogin] biometric enable prompt failed:", e);
        }
      }

      if (data.user) await redirectByRole(data.user.id);
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

  if (user) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-card border-b border-border flex items-center justify-center h-14 px-4">
        <h1 className="font-bold text-foreground">Portal do Parceiro</h1>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <img loading="lazy" decoding="async" src="/itasuper-logo-parceiro.jpg" alt="ItaSuper Parceiro" className="w-14 h-14 rounded-2xl" />
            </div>
            <h2 className="text-xl font-black text-foreground">
              {mode === "login" ? "Acesso Parceiro" : "Como deseja se cadastrar?"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "login"
                ? "Entre com sua conta de lojista"
                : "Cadastre sua loja na plataforma"}
            </p>
          </div>

          {mode === "login" ? (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <BiometricLoginButton />
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
                    autoComplete="current-password"
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

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => navigate("/auth?mode=forgot")}
                    className="text-xs text-primary font-medium hover:underline"
                  >
                    Esqueceu a senha?
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
                  ) : (
                    "Entrar"
                  )}
                </button>
              </form>

              <p className="text-center text-sm text-muted-foreground mt-6">
                Não tem conta?{" "}
                <button
                  onClick={() => setMode("choose")}
                  className="text-primary font-bold"
                >
                  Cadastre-se
                </button>
              </p>
            </>
          ) : (
            <>
              <div className="space-y-3">
                <button
                  onClick={() => navigate("/cadastro-lojista")}
                  className="w-full p-5 rounded-xl border-2 border-border bg-card hover:border-primary/50 transition-all flex items-center gap-4 active:scale-[0.98]"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Store className="h-6 w-6 text-primary" />
                  </div>
                  <div className="text-left">
                    <span className="text-base font-bold text-foreground block">Cadastrar Loja</span>
                    <span className="text-xs text-muted-foreground">Quero vender meus produtos</span>
                  </div>
                </button>

                <button
                  onClick={() => navigate("/cadastro-motoboy-loja")}
                  className="w-full p-5 rounded-xl border-2 border-border bg-card hover:border-primary/50 transition-all flex items-center gap-4 active:scale-[0.98]"
                >
                  <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0">
                    <Bike className="h-6 w-6 text-green-500" />
                  </div>
                  <div className="text-left">
                    <span className="text-base font-bold text-foreground block">Cadastrar Motoboy</span>
                    <span className="text-xs text-muted-foreground">Quero fazer entregas</span>
                  </div>
                </button>
              </div>

              <p className="text-center text-sm text-muted-foreground mt-6">
                Já tem conta?{" "}
                <button
                  onClick={() => setMode("login")}
                  className="text-primary font-bold"
                >
                  Faça login
                </button>
              </p>
            </>
          )}

          <div className="mt-12 text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground/60 uppercase tracking-widest font-medium">
              <Shield className="h-3 w-3" />
              <span>Área exclusiva para parceiros ItaSuper</span>
            </div>
            
            <div className="pt-6 border-t border-border/50">
              <div className="flex items-center justify-center gap-3 text-[10px] font-medium text-muted-foreground">
                <Link to="/termos-de-uso" className="hover:text-primary transition-colors">Termos de Uso</Link>
                <div className="w-1 h-1 rounded-full bg-border" />
                <Link to="/politica-de-privacidade" className="hover:text-primary transition-colors">Política de Privacidade</Link>
              </div>
              <p className="text-[10px] text-muted-foreground/50 mt-2">
                © {new Date().getFullYear()} ItaSuper — Todos os direitos reservados
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PartnerLogin;
