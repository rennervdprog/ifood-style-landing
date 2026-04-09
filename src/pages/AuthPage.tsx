import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Lock, Eye, EyeOff, KeyRound, FileText, ShoppingBag } from "lucide-react";

type AuthMode = "login" | "signup" | "forgot" | "reset";

const REMEMBER_KEY = "itasuper_remember_until";
const TWO_MONTHS_MS = 60 * 24 * 60 * 60 * 1000;

const AuthPage = () => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cpf, setCpf] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from || "/";

  useEffect(() => {
    const until = localStorage.getItem(REMEMBER_KEY);
    if (until && Date.now() > Number(until)) {
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
    if (mode === "signup" && cpf.replace(/\D/g, "").length !== 11) {
      toast.error("CPF deve ter 11 dígitos.");
      return;
    }
    if (mode === "signup" && !acceptedTerms) {
      toast.error("Você precisa aceitar os Termos de Uso e Política de Privacidade.");
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
        if (rememberMe) {
          localStorage.setItem(REMEMBER_KEY, String(Date.now() + TWO_MONTHS_MS));
        } else {
          localStorage.removeItem(REMEMBER_KEY);
        }
        toast.success("Login realizado com sucesso!");
        navigate(from, { replace: true });
      } else if (mode === "signup") {
        const { data: signUpData, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (signUpData?.user?.id) {
          await supabase.from("terms_acceptance").insert({
            user_id: signUpData.user.id,
            terms_version: "1.0",
            privacy_version: "1.0",
            user_agent: navigator.userAgent,
          });
          await supabase.from("profiles").update({
            terms_accepted_at: new Date().toISOString(),
            document: cpf.replace(/\D/g, ""),
          }).eq("user_id", signUpData.user.id);
        }
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

  const searchParams = new URLSearchParams(location.search);
  if (searchParams.get("mode") === "reset" && mode !== "reset") {
    setMode("reset");
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero gradient header */}
      <div className="relative bg-gradient-to-br from-primary via-primary to-primary/80 pt-12 pb-20 px-6 text-center overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full" />
        
        <div className="relative z-10">
          <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            {mode === "forgot" || mode === "reset" ? (
              <KeyRound className="h-10 w-10 text-white" />
            ) : (
              <ShoppingBag className="h-10 w-10 text-white" />
            )}
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            {mode === "login" && "Bem-vindo de volta!"}
            {mode === "signup" && "Crie sua conta"}
            {mode === "forgot" && "Esqueceu a senha?"}
            {mode === "reset" && "Nova senha"}
          </h1>
          <p className="text-white/80 text-sm mt-1.5 max-w-[260px] mx-auto">
            {mode === "login" && "Entre para pedir seus pratos favoritos"}
            {mode === "signup" && "Cadastre-se e peça no ItaSuper"}
            {mode === "forgot" && "Enviaremos um link de recuperação"}
            {mode === "reset" && "Escolha uma nova senha segura"}
          </p>
        </div>
      </div>

      {/* Form card overlapping header */}
      <div className="flex-1 px-5 -mt-10 pb-8">
        <div className="w-full max-w-sm mx-auto bg-card rounded-2xl shadow-xl border border-border/50 p-6">
          {mode === "forgot" && resetSent ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 bg-green-500/10 rounded-2xl flex items-center justify-center mx-auto">
                <KeyRound className="h-8 w-8 text-green-500" />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-lg">E-mail enviado!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Verifique sua caixa de entrada e clique no link para redefinir sua senha.
                </p>
              </div>
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
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">E-mail</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-12 pl-10 pr-4 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                      autoComplete="email"
                    />
                  </div>
                </div>
              )}

              {mode !== "forgot" && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                    {mode === "reset" ? "Nova senha" : "Senha"}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder={mode === "reset" ? "Mínimo 6 caracteres" : "••••••"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full h-12 pl-10 pr-12 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {mode === "signup" && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">CPF</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="000.000.000-00"
                      value={cpf}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
                        let formatted = digits;
                        if (digits.length > 3) formatted = digits.slice(0, 3) + "." + digits.slice(3);
                        if (digits.length > 6) formatted = digits.slice(0, 3) + "." + digits.slice(3, 6) + "." + digits.slice(6);
                        if (digits.length > 9) formatted = digits.slice(0, 3) + "." + digits.slice(3, 6) + "." + digits.slice(6, 9) + "-" + digits.slice(9);
                        setCpf(formatted);
                      }}
                      maxLength={14}
                      className="w-full h-12 pl-10 pr-4 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                    />
                  </div>
                </div>
              )}

              {mode === "login" && (
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-border accent-primary"
                    />
                    <span className="text-sm text-muted-foreground">Lembrar-me</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setMode("forgot")}
                    className="text-sm text-primary font-semibold"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
              )}

              {mode === "signup" && (
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="w-4 h-4 rounded border-border accent-primary mt-0.5 shrink-0"
                  />
                  <span className="text-xs text-muted-foreground leading-relaxed">
                    Li e aceito os{" "}
                    <Link to="/termos-de-uso" target="_blank" className="text-primary font-bold underline">
                      Termos de Uso
                    </Link>{" "}
                    e a{" "}
                    <Link to="/politica-de-privacidade" target="_blank" className="text-primary font-bold underline">
                      Política de Privacidade
                    </Link>
                  </span>
                </label>
              )}

              <button
                disabled={loading}
                className="w-full h-12 bg-primary text-primary-foreground font-bold rounded-xl active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-primary/25 hover:shadow-primary/40"
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

          {(mode === "login" || mode === "signup") && (
            <div className="mt-6 pt-5 border-t border-border/50">
              <p className="text-center text-sm text-muted-foreground">
                {mode === "login" ? "Não tem conta? " : "Já tem conta? "}
                <button
                  onClick={() => setMode(mode === "login" ? "signup" : "login")}
                  className="text-primary font-bold"
                >
                  {mode === "login" ? "Cadastre-se" : "Faça login"}
                </button>
              </p>
            </div>
          )}

          {(mode === "forgot" && !resetSent) && (
            <div className="mt-6 pt-5 border-t border-border/50">
              <p className="text-center text-sm text-muted-foreground">
                Lembrou a senha?{" "}
                <button onClick={() => setMode("login")} className="text-primary font-bold">
                  Faça login
                </button>
              </p>
            </div>
          )}
        </div>

        {/* Bottom branding */}
        <p className="text-center text-xs text-muted-foreground/60 mt-6">
          ItaSuper · O delivery oficial de Itatinga
        </p>
      </div>
    </div>
  );
};

export default AuthPage;
