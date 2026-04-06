import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Mail, Lock, Eye, EyeOff, KeyRound } from "lucide-react";

type AuthMode = "login" | "signup" | "forgot" | "reset";

const REMEMBER_KEY = "itasuper_remember_me";

const AuthPage = () => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem(REMEMBER_KEY) !== "false");
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from || "/";

  // If "remember me" is off, sign out when browser/tab closes
  useEffect(() => {
    if (rememberMe) return;
    const handleUnload = () => {
      localStorage.setItem(REMEMBER_KEY, "false");
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [rememberMe]);

  // On app load, if remember was false, sign out
  useEffect(() => {
    if (localStorage.getItem(REMEMBER_KEY) === "false") {
      supabase.auth.signOut();
      localStorage.removeItem(REMEMBER_KEY);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === "forgot") {
      if (!email.trim()) { toast.error("Informe seu e-mail."); return; }
      setLoading(true);
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/auth?mode=reset`,
        });
        if (error) throw error;
        setResetSent(true);
        toast.success("E-mail de recuperação enviado! Verifique sua caixa de entrada.");
      } catch (err: any) {
        toast.error(err.message || "Erro ao enviar e-mail de recuperação.");
      } finally {
        setLoading(false);
      }
      return;
    }

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
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        localStorage.setItem(REMEMBER_KEY, rememberMe ? "true" : "false");
        toast.success("Login realizado com sucesso!");
        navigate(from, { replace: true });
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Conta criada com sucesso!");
        navigate(from, { replace: true });
      } else if (mode === "reset") {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        toast.success("Senha atualizada com sucesso!");
        navigate("/", { replace: true });
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao autenticar.");
    } finally {
      setLoading(false);
    }
  };

  // Check if we're in reset mode from URL
  const searchParams = new URLSearchParams(location.search);
  if (searchParams.get("mode") === "reset" && mode !== "reset") {
    setMode("reset");
  }

  const titles: Record<AuthMode, string> = {
    login: "Entrar",
    signup: "Criar conta",
    forgot: "Recuperar senha",
    reset: "Nova senha",
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-card border-b border-border flex items-center h-14 px-4 gap-3">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="font-bold text-foreground">{titles[mode]}</h1>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <span className="text-5xl mb-4 block">
              {mode === "forgot" || mode === "reset" ? "🔑" : "🍕"}
            </span>
            <h2 className="text-xl font-black text-foreground">
              {mode === "login" && "Bem-vindo de volta!"}
              {mode === "signup" && "Crie sua conta"}
              {mode === "forgot" && "Esqueceu a senha?"}
              {mode === "reset" && "Defina sua nova senha"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "login" && "Entre para finalizar seu pedido no ItaSuper"}
              {mode === "signup" && "Cadastre-se para pedir no ItaSuper"}
              {mode === "forgot" && "Informe seu e-mail para receber o link de recuperação"}
              {mode === "reset" && "Escolha uma nova senha segura"}
            </p>
          </div>

          {mode === "forgot" && resetSent ? (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6 text-center space-y-3">
              <KeyRound className="h-10 w-10 text-green-500 mx-auto" />
              <h3 className="font-bold text-foreground">E-mail enviado!</h3>
              <p className="text-sm text-muted-foreground">
                Verifique sua caixa de entrada e clique no link para redefinir sua senha.
              </p>
              <button
                onClick={() => { setMode("login"); setResetSent(false); }}
                className="text-primary font-bold text-sm"
              >
                Voltar para login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode !== "reset" && (
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
              )}

              {mode !== "forgot" && (
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder={mode === "reset" ? "Nova senha" : "Sua senha"}
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
              )}

              {mode === "login" && (
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-border accent-primary"
                  />
                  <span className="text-sm text-muted-foreground">Lembrar de mim</span>
                </label>
              )}

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
                ) : mode === "login" ? "Entrar"
                  : mode === "signup" ? "Criar conta"
                  : mode === "forgot" ? "Enviar link"
                  : "Salvar nova senha"
                }
              </button>
            </form>
          )}

          {mode === "login" && (
            <button
              onClick={() => setMode("forgot")}
              className="w-full text-center text-sm text-muted-foreground mt-3 hover:text-primary"
            >
              Esqueceu sua senha?
            </button>
          )}

          {(mode === "login" || mode === "signup") && (
            <p className="text-center text-sm text-muted-foreground mt-6">
              {mode === "login" ? "Não tem conta? " : "Já tem conta? "}
              <button
                onClick={() => setMode(mode === "login" ? "signup" : "login")}
                className="text-primary font-bold"
              >
                {mode === "login" ? "Cadastre-se" : "Faça login"}
              </button>
            </p>
          )}

          {(mode === "forgot" && !resetSent) && (
            <p className="text-center text-sm text-muted-foreground mt-6">
              Lembrou a senha?{" "}
              <button onClick={() => setMode("login")} className="text-primary font-bold">
                Faça login
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
