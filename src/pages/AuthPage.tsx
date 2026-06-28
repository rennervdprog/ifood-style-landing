import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Lock, Eye, EyeOff, KeyRound, ShoppingBag, CheckCircle2, Check, X, Phone, User, FileText, ShieldCheck, MapPin } from "lucide-react";
 import { maskWhatsApp } from "@/lib/whatsapp";
import { formatDocument, sanitizeDocument, validateDocument } from "@/lib/documentFormat";
import { fetchCep, formatCep } from "@/lib/location/cep";
import { isPartnerCapacitorApp, persistCapacitorAppMode } from "@/lib/capacitorAppMode";
import { PARTNER_ROUTES } from "@/components/CapacitorRouteGuard";
import BiometricLoginButton from "@/components/BiometricLoginButton";
import {
  isBiometricAvailable,
  isBiometricEnabled,
  enableBiometricLogin,
  wasBiometricPromptDismissed,
  markBiometricPromptDismissed,
} from "@/lib/biometricAuth";
import { isCapacitorNative } from "@/lib/capacitorNative";

type AuthMode = "login" | "signup" | "forgot" | "reset";

interface PasswordRule {
  label: string;
  test: (pw: string) => boolean;
}

const PASSWORD_RULES: PasswordRule[] = [
  { label: "Mínimo 8 caracteres", test: (pw) => pw.length >= 8 },
  { label: "Uma letra maiúscula", test: (pw) => /[A-Z]/.test(pw) },
  { label: "Uma letra minúscula", test: (pw) => /[a-z]/.test(pw) },
  { label: "Um número", test: (pw) => /[0-9]/.test(pw) },
  { label: "Um caractere especial (!@#$...)", test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

const REMEMBER_KEY = "itasuper_remember_until";
const REMEMBER_FLAG = "itasuper_remember";
const SESSION_ALIVE_KEY = "itasuper_session_alive";
const TWO_MONTHS_MS = 60 * 24 * 60 * 60 * 1000;

/**
 * Convert WhatsApp digits to a synthetic e-mail used internally by Supabase Auth.
 * Login still accepts a real e-mail (legacy/admin/lojista accounts).
 */
const waToSynthEmail = (digits: string) => `wa${digits}@itasuper.app`;
const looksLikeEmail = (v: string) => v.includes("@");

const AuthPage = () => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [identifier, setIdentifier] = useState(""); // login: WhatsApp ou e-mail
  const [email, setEmail] = useState(""); // usado só em "forgot"
  const [password, setPassword] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [deliveryPin, setDeliveryPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinAcknowledged, setPinAcknowledged] = useState(false);
  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [referencePoint, setReferencePoint] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const ruleResults = useMemo(() => PASSWORD_RULES.map(r => r.test(password)), [password]);
  const passedCount = ruleResults.filter(Boolean).length;
  const strengthPercent = (passedCount / PASSWORD_RULES.length) * 100;
  const strengthColor = strengthPercent <= 20 ? "bg-red-500" : strengthPercent <= 60 ? "bg-yellow-500" : strengthPercent < 100 ? "bg-blue-500" : "bg-green-500";

  // Expiry / session-only enforcement is handled centrally in AuthContext.

  useEffect(() => {
    // If we're in the partner app, but trying to access the client auth page, 
    // redirect to the partner login page.
    if (isPartnerCapacitorApp() && mode !== "reset") {
      navigate("/portal-parceiro", { replace: true });
    }
  }, [mode, navigate]);

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

    if (mode === "login") {
      if (!identifier.trim() || !password.trim()) {
        toast.error("Preencha WhatsApp e senha.");
        return;
      }
    }
    if (mode === "signup") {
      const whatsDigits = whatsapp.replace(/\D/g, "");
      if (whatsDigits.length < 10 || whatsDigits.length > 11) {
        toast.error("Informe um WhatsApp válido com DDD.");
        return;
      }
      if (!password.trim()) {
        toast.error("Crie uma senha.");
        return;
      }
      if (fullName.trim().length < 3) { toast.error("Informe seu nome completo."); return; }
      if (!validateDocument(cpf)) { toast.error("CPF ou CNPJ inválido."); return; }
      if (!/^\d{4}$/.test(deliveryPin)) { toast.error("Defina um PIN de entrega com 4 dígitos numéricos."); return; }
      if (deliveryPin !== confirmPin) { toast.error("Os PINs informados não coincidem."); return; }
      if (!pinAcknowledged) { toast.error("Confirme que este PIN será usado em todas as suas entregas."); return; }
      const cepDigits = cep.replace(/\D/g, "");
      if (cepDigits.length !== 8) { toast.error("CEP inválido."); return; }
      if (!street.trim() || !number.trim() || !neighborhood.trim()) {
        toast.error("Preencha rua, número e bairro do endereço.");
        return;
      }
    }
    if (mode === "signup" && !acceptedTerms) {
      toast.error("Você precisa aceitar os Termos de Uso e Política de Privacidade.");
      return;
    }
    if ((mode === "signup" || mode === "reset") && passedCount < PASSWORD_RULES.length) {
      toast.error("Sua senha não atende todos os requisitos. Verifique abaixo.");
      return;
    }
    if (mode === "login" && password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        const id = identifier.trim();
        const loginEmail = looksLikeEmail(id)
          ? id
          : waToSynthEmail(`55${id.replace(/\D/g, "")}`);
        const { data: signInData, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
        if (error) throw error;

        // Offer to enable biometric login (Capacitor only, once per device)
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
                const ok = await enableBiometricLogin(loginEmail, password);
                if (ok) toast.success("Biometria ativada!");
              } else {
                markBiometricPromptDismissed();
              }
            }
          } catch (e) {
            console.warn("[Auth] biometric enable prompt failed:", e);
          }
        }

        // Detect accounts migrated from Lovable Cloud — force them to redefine their password
        const meta = (signInData?.user?.user_metadata || {}) as Record<string, any>;
        const { data: profMig } = await supabase
          .from("profiles")
          .select("migrated_from_cloud, migration_temp_password")
          .eq("user_id", signInData!.user!.id)
          .maybeSingle();
        const isMigrated = !!meta.migrated_from_cloud || !!(profMig as any)?.migrated_from_cloud;
        const tempPwStillActive = !!(profMig as any)?.migration_temp_password;

        if (isMigrated && tempPwStillActive) {
          // Sign back out and send recovery email automatically
          await supabase.auth.signOut();
          if (looksLikeEmail(id)) {
            await supabase.auth.resetPasswordForEmail(id, {
              redirectTo: `${window.location.origin}/auth?mode=reset`,
            });
          }
          toast.warning(
            "Sua conta foi migrada. Enviamos um e-mail para você redefinir sua senha.",
            { duration: 8000 }
          );
          setMode("forgot");
          setResetSent(true);
          return;
        }

        // Persist the user's choice and mark this tab/app session as alive.
        // - rememberMe=true  → session persists across browser restarts up to 2 months.
        // - rememberMe=false → session lives only until the browser/app is closed
        //   (sessionStorage is cleared on close; AuthContext will sign out on next launch).
        localStorage.setItem(REMEMBER_FLAG, rememberMe ? "1" : "0");
        sessionStorage.setItem(SESSION_ALIVE_KEY, "1");
        if (rememberMe) {
          localStorage.setItem(REMEMBER_KEY, String(Date.now() + TWO_MONTHS_MS));
        } else {
          localStorage.removeItem(REMEMBER_KEY);
        }
        toast.success("Login realizado com sucesso!");
        
        const { data: { user: loggedUser } } = await supabase.auth.getUser();
        if (loggedUser) {
          console.log("[Auth] Checking roles for user:", loggedUser.id);
          const { data: adminRole } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", loggedUser.id)
            .eq("role", "admin")
            .maybeSingle();
          
          if (adminRole) {
            if (isPartnerCapacitorApp()) persistCapacitorAppMode("partner");
            navigate("/super-admin", { replace: true });
            return;
          }

          const { data: prof } = await supabase
            .from("profiles")
            .select("role, is_approved")
            .eq("user_id", loggedUser.id)
            .maybeSingle();
          
          if (prof?.role === "lojista") {
            if (isPartnerCapacitorApp()) persistCapacitorAppMode("partner");
            navigate("/admin", { replace: true });
            return;
          }
          
          if (prof?.role === "motoboy") {
            if (isPartnerCapacitorApp()) persistCapacitorAppMode("partner");
            navigate("/entregador", { replace: true });
            return;
          }
        }
        
        // Fallback: If it's the partner app but user is just a client, we shouldn't send to /cliente
        if (isPartnerCapacitorApp()) {
          navigate("/portal-parceiro", { replace: true });
        } else {
          navigate("/cliente", { replace: true });
        }
      } else if (mode === "signup") {
        const whatsDigits = `55${whatsapp.replace(/\D/g, "")}`;
        const synthEmail = waToSynthEmail(whatsDigits);
        const { data: signUpData, error } = await supabase.auth.signUp({
          email: synthEmail,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              role: "cliente",
              whatsapp: whatsDigits,
              full_name: fullName.trim(),
              document: sanitizeDocument(cpf),
              delivery_pin: deliveryPin,
            },
          },
        });
        if (error) throw error;
        if (signUpData?.user?.id) {
          await supabase.from("terms_acceptance").insert({
            user_id: signUpData.user.id,
            terms_version: "3.0",
            privacy_version: "3.0",
            user_agent: navigator.userAgent,
          });
          await supabase.from("profiles").update({
            terms_accepted_at: new Date().toISOString(),
            whatsapp_number: whatsDigits,
            full_name: fullName.trim(),
            document: sanitizeDocument(cpf),
            delivery_pin: deliveryPin,
          }).eq("user_id", signUpData.user.id);
          await supabase.from("saved_addresses").insert({
            user_id: signUpData.user.id,
            label: "Casa",
            cep: formatCep(cep),
            street: street.trim(),
            number: number.trim(),
            complement: complement.trim() || null,
            neighborhood: neighborhood.trim(),
            reference_point: referencePoint.trim() || null,
            is_default: true,
          });
        }
        toast.success("Conta criada com sucesso!");
        if (isPartnerCapacitorApp()) {
          // A client signing up in the partner app? Send back to partner portal
          navigate("/portal-parceiro", { replace: true });
        } else {
          navigate("/cliente", { replace: true });
        }
      } else if (mode === "reset") {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        // Clear the migration temp-password flag so we don't ask again next time
        const { data: { user: u } } = await supabase.auth.getUser();
        if (u?.id) {
          await supabase
            .from("profiles")
            .update({ migration_temp_password: false } as any)
            .eq("user_id", u.id);
        }
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

  const titles: Record<AuthMode, string> = {
    login: "Bem-vindo de volta",
    signup: "Crie sua conta",
    forgot: "Recuperar senha",
    reset: "Nova senha",
  };

  const subtitles: Record<AuthMode, string> = {
    login: "Entre para pedir seus pratos favoritos",
    signup: "Cadastre-se e peça no ItaSuper",
    forgot: "Enviaremos um link de recuperação",
    reset: "Escolha uma nova senha segura",
  };

  const inputClass =
    "w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-white text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm";

  const inputClassPassword =
    "w-full h-11 pl-10 pr-12 rounded-xl border border-border bg-white text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm";

  const formContent = (
    <>
      {mode === "forgot" && resetSent ? (
        <div className="text-center space-y-4 py-6">
          <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mx-auto">
            <KeyRound className="h-7 w-7 text-green-500" />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-lg">E-mail enviado!</h3>
            <p className="text-sm text-slate-500 mt-1.5 leading-relaxed max-w-xs mx-auto">
              Verifique sua caixa de entrada e clique no link para redefinir sua senha.
            </p>
          </div>
          <button
            onClick={() => { setMode("login"); setResetSent(false); }}
            className="text-primary font-semibold text-sm"
          >
            Voltar para login
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "login" && (
            <BiometricLoginButton onSuccess={() => navigate("/cliente", { replace: true })} />
          )}
          {mode === "login" && (
            <div>
              <label className="text-xs font-semibold text-slate-500 tracking-wide mb-1.5 block">WhatsApp</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="tel"
                  inputMode="text"
                  placeholder="(14) 99999-9999"
                  value={identifier}
                  onChange={(e) => {
                    const v = e.target.value;
                    setIdentifier(looksLikeEmail(v) ? v : maskWhatsApp(v));
                  }}
                  className={inputClass}
                  autoComplete="username"
                />
              </div>
            </div>
          )}
          {mode === "forgot" && (
            <div>
              <label className="text-xs font-semibold text-slate-500 tracking-wide mb-1.5 block">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  autoComplete="email"
                />
              </div>
            </div>
          )}

          {mode === "signup" && (
            <div>
              <label className="text-xs font-semibold text-slate-500 tracking-wide mb-1.5 block">WhatsApp</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="(14) 99999-9999"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(maskWhatsApp(e.target.value))}
                  maxLength={15}
                  className={inputClass}
                />
              </div>
            </div>
          )}

          {mode === "signup" && (
            <>
              <div>
                <label className="text-xs font-semibold text-slate-500 tracking-wide mb-1.5 block">Nome completo</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Seu nome"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    maxLength={80}
                    autoComplete="name"
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 tracking-wide mb-1.5 block">CPF ou CNPJ</label>
                <div className="relative">
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="CPF ou CNPJ"
                    value={cpf}
                    onChange={(e) => setCpf(formatDocument(e.target.value))}
                    maxLength={18}
                    className={inputClass}
                  />
                </div>
              </div>
            </>
          )}

          {mode !== "forgot" && (
            <>
              <div>
                <label className="text-xs font-semibold text-slate-500 tracking-wide mb-1.5 block">
                  {mode === "reset" ? "Nova senha" : "Senha"}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder={mode === "reset" ? "Crie uma senha forte" : "••••••"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClassPassword}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-slate-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-slate-400" />
                    )}
                  </button>
                </div>
              </div>

              {(mode === "signup" || mode === "reset") && password.length > 0 && (
                <div className="space-y-2">
                  <div className="flex gap-1 h-1.5 rounded-full overflow-hidden bg-slate-100">
                    {PASSWORD_RULES.map((_, i) => (
                      <div
                        key={i}
                        className={`flex-1 rounded-full transition-all duration-300 ${i < passedCount ? strengthColor : "bg-slate-200"}`}
                      />
                    ))}
                  </div>
                  <div className="grid grid-cols-1 gap-1">
                    {PASSWORD_RULES.map((rule, i) => (
                      <div key={i} className={`flex items-center gap-1.5 text-xs transition-colors ${ruleResults[i] ? "text-green-600" : "text-slate-400"}`}>
                        {ruleResults[i] ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        {rule.label}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
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
                <span className="text-sm text-slate-500">Lembrar-me</span>
              </label>
              <button
                type="button"
                onClick={() => setMode("forgot")}
                className="text-sm text-primary font-medium"
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
              <span className="text-xs text-slate-500 leading-relaxed">
                Li e aceito os{" "}
                <Link to="/termos-de-uso" target="_blank" className="text-primary font-semibold underline">
                  Termos de Uso
                </Link>{" "}
                e a{" "}
                <Link to="/politica-de-privacidade" target="_blank" className="text-primary font-semibold underline">
                  Política de Privacidade
                </Link>
              </span>
            </label>
          )}

          <button
            disabled={loading || ((mode === "signup" || mode === "reset") && passedCount < PASSWORD_RULES.length && password.length > 0)}
            className="w-full h-11 bg-primary text-primary-foreground font-bold rounded-xl active:scale-[0.98] transition-all disabled:opacity-50 shadow-md shadow-primary/20 hover:brightness-105"
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
        <div className="mt-6 pt-5 border-t border-slate-100">
          <p className="text-center text-sm text-slate-500">
            {mode === "login" ? "Não tem conta? " : "Já tem conta? "}
            <button
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="text-primary font-semibold"
            >
              {mode === "login" ? "Cadastre-se" : "Faça login"}
            </button>
          </p>
        </div>
      )}

      {(mode === "forgot" && !resetSent) && (
        <div className="mt-6 pt-5 border-t border-slate-100">
          <p className="text-center text-sm text-slate-500">
            Lembrou a senha?{" "}
            <button onClick={() => setMode("login")} className="text-primary font-semibold">
              Faça login
            </button>
          </p>
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <h1 className="sr-only">Acesse sua conta no ItaSuper</h1>
      <div className="hidden md:flex md:w-[45%] bg-gradient-to-br from-slate-900 via-[#2D1810] to-orange-950 flex-col justify-between p-10 lg:p-14 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-primary/5 rounded-full blur-3xl" />

        <div className="relative z-10">
          <img
            src="/itasuper-logo-horizontal.webp"
            alt="ItaSuper"
            width={220}
            height={52}
            decoding="async"
            className="h-12 lg:h-14 w-auto object-contain"
          />
        </div>

        <div className="relative z-10 space-y-4">
          <h2 className="text-3xl lg:text-4xl font-black text-white leading-tight">
            Peça online.<br />Receba em casa.
          </h2>
             <p className="text-white/60 text-sm max-w-xs">
               Cardápio digital e delivery profissional para todo o Brasil.
             </p>
        </div>

        <div className="relative z-10">
          <div className="space-y-3 mb-12">
            {["Pedidos em tempo real", "Pagamento seguro", "Rastreie sua entrega"].map((text) => (
              <div key={text} className="flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="text-white/70 text-xs">{text}</span>
              </div>
            ))}
          </div>

          <div className="pt-8 border-t border-white/5 space-y-2">
            <p className="text-[10px] text-white/30 uppercase tracking-widest font-medium">
              © {new Date().getFullYear()} ItaSuper — Todos os direitos reservados
            </p>
            <div className="flex gap-4 text-[10px] text-white/40">
              <Link to="/termos-de-uso" className="hover:text-white transition-colors">Termos de Uso</Link>
              <Link to="/politica-de-privacidade" className="hover:text-white transition-colors">Política de Privacidade</Link>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-gradient-to-b from-white to-slate-50 md:bg-white">
        <div className="md:hidden flex items-center justify-center pt-10 pb-6">
          <img
            src="/itasuper-logo-horizontal.webp"
            alt="ItaSuper"
            width={190}
            height={45}
            decoding="async"
            className="h-11 w-auto object-contain"
          />
        </div>

        <div className="flex-1 flex items-start md:items-center justify-center px-5 pb-8 md:px-10">
          <div className="w-full max-w-sm">
            <div className="mb-8 md:text-left text-center">
              <div className={`w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 md:mx-0 mx-auto`}>
                {mode === "forgot" || mode === "reset" ? (
                  <KeyRound className="h-6 w-6 text-primary" />
                ) : (
                  <ShoppingBag className="h-6 w-6 text-primary" />
                )}
              </div>
              <h1 className="text-2xl font-black text-foreground tracking-tight">
                {titles[mode]}
              </h1>
              <p className="text-sm text-slate-500 mt-1 max-w-xs md:mx-0 mx-auto">
                {subtitles[mode]}
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:shadow-none md:border-0 md:p-0">
              {formContent}
            </div>

            <div className="md:hidden mt-auto pt-10 text-center space-y-3">
              <div className="flex items-center justify-center gap-4 text-[11px] font-medium text-slate-400">
                <Link to="/termos-de-uso" className="hover:text-primary transition-colors underline-offset-4 underline decoration-slate-200">Termos de Uso</Link>
                <div className="w-1 h-1 rounded-full bg-slate-300" />
                <Link to="/politica-de-privacidade" className="hover:text-primary transition-colors underline-offset-4 underline decoration-slate-200">Política de Privacidade</Link>
              </div>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter opacity-70">
                © {new Date().getFullYear()} ItaSuper — Todos os direitos reservados
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
