import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Lock, Eye, EyeOff, KeyRound, CheckCircle2, Check, X, Phone, User } from "lucide-react";
 import { maskWhatsApp } from "@/lib/whatsapp";
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from "@/lib/legalVersions";
import { fetchCep, formatCep } from "@/lib/location/cep";
import {
  SIGNUP_STEPS,
  SIGNUP_STEP_TITLES,
  clearSignupDraft,
  firstErrorField,
  loadSignupDraft,
  saveSignupDraft,
  validateSignupStep,
  type SignupErrors,
  type SignupStep,
  type SignupValues,
} from "@/lib/signupSteps";
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

/**
 * Convert WhatsApp digits to a synthetic e-mail used internally by Supabase Auth.
 * Login still accepts a real e-mail (legacy/admin/lojista accounts).
 */
const waToSynthEmail = (digits: string) => `wa${digits}@itasuper.app`;
const looksLikeEmail = (value: string) => /^\S+@\S+\.\S+$/.test(value.trim());
const isLegacyWhatsAppLogin = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return digits.length === 10 || digits.length === 11;
};

const AuthPage = () => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [identifier, setIdentifier] = useState(""); // login: e-mail; WhatsApp é aceito somente para contas legadas
  const [email, setEmail] = useState(""); // usado só em "forgot"
  const [signupEmail, setSignupEmail] = useState("");
  const [password, setPassword] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [fullName, setFullName] = useState("");
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
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  // Cadastro em 3 passos (só o modo signup): passo atual, erros inline por
  // campo e "CEP não encontrado" (aviso, não trava o passo — o endereço pode
  // ser preenchido manualmente).
  const [signupStep, setSignupStep] = useState<SignupStep>(1);
  const [signupErrors, setSignupErrors] = useState<SignupErrors>({});
  const [cepNotFound, setCepNotFound] = useState(false);
  const cepLookupRef = useRef(0);
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

  // --- Cadastro em 3 passos (só o modo signup) ---------------------------
  const signupValues: SignupValues = {
    email: signupEmail,
    whatsapp,
    fullName,
    password,
    cep,
    number,
    street,
    neighborhood,
    complement,
    referencePoint,
    deliveryPin,
    confirmPin,
    pinAcknowledged,
    acceptedTerms,
  };

  const clearFieldError = (key: keyof SignupErrors) => {
    setSignupErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const focusSignupField = (key: keyof SignupValues) => {
    document.getElementById(`signup-${key}`)?.focus();
  };

  /** Valida o passo atual; se válido, avança. Retorna se avançou. */
  const advanceSignupStep = (): boolean => {
    const errors = validateSignupStep(signupStep, signupValues, passedCount === PASSWORD_RULES.length);
    if (Object.keys(errors).length > 0) {
      setSignupErrors(errors);
      const first = firstErrorField(signupStep, errors);
      if (first) focusSignupField(first);
      return false;
    }
    setSignupErrors({});
    setSignupStep((signupStep + 1) as SignupStep);
    window.scrollTo(0, 0);
    return true;
  };

  /** Ir para um passo pelo rótulo do progresso: voltar é direto; avançar revalida os passos do meio. */
  const goToSignupStep = (target: SignupStep) => {
    if (target === signupStep) return;
    if (target < signupStep) {
      setSignupErrors({});
      setSignupStep(target);
      window.scrollTo(0, 0);
      return;
    }
    for (let s = signupStep; s < target; s++) {
      const step = s as SignupStep;
      const errors = validateSignupStep(step, signupValues, passedCount === PASSWORD_RULES.length);
      if (Object.keys(errors).length > 0) {
        setSignupStep(step);
        setSignupErrors(errors);
        const first = firstErrorField(step, errors);
        if (first) focusSignupField(first);
        return;
      }
    }
    setSignupErrors({});
    setSignupStep(target);
    window.scrollTo(0, 0);
  };

  /** Busca do CEP (ViaCEP → BrasilAPI): preenche rua/bairro só se vazios, como hoje; CEP não encontrado vira aviso inline (não trava o passo). */
  const handleCepChange = async (raw: string) => {
    const v = formatCep(raw);
    setCep(v);
    setCepNotFound(false);
    clearFieldError("cep");
    const digits = v.replace(/\D/g, "");
    if (digits.length === 8) {
      const lookupId = ++cepLookupRef.current;
      setCepLoading(true);
      try {
        const r = await fetchCep(digits);
        if (cepLookupRef.current !== lookupId) return; // resposta de um CEP antigo
        if (r) {
          if (!street) setStreet(r.logradouro || "");
          if (!neighborhood) setNeighborhood(r.bairro || "");
        } else {
          setCepNotFound(true);
        }
      } finally {
        if (cepLookupRef.current === lookupId) setCepLoading(false);
      }
    }
  };

  // Rascunho local: ao entrar no modo cadastro, restaura o progresso salvo
  // neste aparelho (se houver); apagado ao concluir o cadastro.
  // Declarado ANTES do efeito que salva, para ler o rascunho antes de
  // qualquer escrita na mesma transição.
  useEffect(() => {
    if (mode !== "signup") return;
    const draft = loadSignupDraft();
    if (!draft) return;
    setSignupEmail(draft.values.email);
    setWhatsapp(draft.values.whatsapp);
    setFullName(draft.values.fullName);
    setPassword(draft.values.password);
    setCep(draft.values.cep);
    setNumber(draft.values.number);
    setStreet(draft.values.street);
    setNeighborhood(draft.values.neighborhood);
    setComplement(draft.values.complement);
    setReferencePoint(draft.values.referencePoint);
    setDeliveryPin(draft.values.deliveryPin);
    setConfirmPin(draft.values.confirmPin);
    setPinAcknowledged(draft.values.pinAcknowledged);
    setAcceptedTerms(draft.values.acceptedTerms);
    setSignupStep(draft.step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    if (mode !== "signup") return;
    saveSignupDraft(signupValues, signupStep);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, signupStep, signupEmail, whatsapp, fullName, password, cep, street, number, complement, neighborhood, referencePoint, deliveryPin, confirmPin, pinAcknowledged, acceptedTerms]);

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
        toast.error("Preencha e-mail e senha.");
        return;
      }
      if (!looksLikeEmail(identifier) && !isLegacyWhatsAppLogin(identifier)) {
        toast.error("Informe um e-mail válido. Contas antigas também podem usar o WhatsApp cadastrado.");
        return;
      }
    }
    if (mode === "signup") {
      // Cadastro em 3 passos: "Continuar" valida o passo atual e avança;
      // no passo 3, revalida tudo (rede de segurança) e envia.
      if (signupStep < 3) {
        advanceSignupStep();
        return;
      }
      for (const s of [1, 2, 3] as SignupStep[]) {
        const errors = validateSignupStep(s, signupValues, passedCount === PASSWORD_RULES.length);
        if (Object.keys(errors).length > 0) {
          setSignupStep(s);
          setSignupErrors(errors);
          const first = firstErrorField(s, errors);
          if (first) focusSignupField(first);
          return;
        }
      }
      setSignupErrors({});
    }
    if (mode === "reset" && passedCount < PASSWORD_RULES.length) {
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
        const isLegacyLogin = !looksLikeEmail(id);
        const loginEmail = isLegacyLogin
          ? waToSynthEmail(`55${id.replace(/\D/g, "")}`)
          : id.toLowerCase();
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

        // Sessão perpétua (v1.10.399+): cliente/lojista/entregador ficam logados
        // até clicarem em "Sair" ou trocarem a senha. Limpa artefatos legados
        // do antigo sistema "Lembrar-me" para evitar deslogar em novos boots.
        try {
          localStorage.removeItem(REMEMBER_FLAG);
          localStorage.removeItem(REMEMBER_KEY);
          sessionStorage.removeItem(SESSION_ALIVE_KEY);
        } catch {}
        if (isLegacyLogin) {
          toast.info("Sua conta usa WhatsApp como acesso antigo. Cadastre um e-mail no Perfil para recuperar sua senha com segurança.", { duration: 7000 });
        } else {
          toast.success("Login realizado com sucesso!");
        }
        
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
        const registrationEmail = signupEmail.trim().toLowerCase();
        const { data: signUpData, error } = await supabase.auth.signUp({
          email: registrationEmail,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              role: "cliente",
              whatsapp: whatsDigits,
              full_name: fullName.trim(),
              delivery_pin: deliveryPin,
            },
          },
        });
        if (error) throw error;
        if (signUpData?.user?.id) {
          await supabase.from("terms_acceptance").insert({
            user_id: signUpData.user.id,
            terms_version: CURRENT_TERMS_VERSION,
            privacy_version: CURRENT_PRIVACY_VERSION,
            user_agent: navigator.userAgent,
          });
          await supabase.from("profiles").update({
            terms_accepted_at: new Date().toISOString(),
            whatsapp_number: whatsDigits,
            full_name: fullName.trim(),
            email: registrationEmail,
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
        clearSignupDraft();
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

  // Sem "signup": no cadastro o subtítulo muda a cada passo (SIGNUP_STEPS[].subtitle).
  const subtitles: Record<Exclude<AuthMode, "signup">, string> = {
    login: "Entre para pedir seus pratos favoritos",
    forgot: "Enviaremos um link de recuperação",
    reset: "Escolha uma nova senha segura",
  };

  const inputClass =
    "w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-white text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm";

  const inputClassPassword =
    "w-full h-11 pl-10 pr-12 rounded-xl border border-border bg-white text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm";

  // Erro inline (cadastro em passos): mesma base, borda laranja no lugar da borda padrão.
  const inputClassError =
    "w-full h-11 pl-10 pr-4 rounded-xl border border-orange-700 bg-white text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-700/20 focus:border-orange-700 transition-all text-sm";

  const inputClassPasswordError =
    "w-full h-11 pl-10 pr-12 rounded-xl border border-orange-700 bg-white text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-700/20 focus:border-orange-700 transition-all text-sm";

  const plainInputClass =
    "w-full h-11 px-3 rounded-xl border border-border bg-white text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm";

  const plainInputClassError =
    "w-full h-11 px-3 rounded-xl border border-orange-700 bg-white text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-700/20 focus:border-orange-700 text-sm";

  const signupFieldClass = (key: keyof SignupValues, withIcon = true) =>
    signupErrors[key] ? (withIcon ? inputClassError : plainInputClassError) : (withIcon ? inputClass : plainInputClass);

  const signupErrorText = (key: keyof SignupValues) =>
    signupErrors[key] ? (
      <p className="text-[11px] text-orange-700 font-medium mt-1.5">{signupErrors[key]}</p>
    ) : null;

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
          {mode === "signup" && (
            <div>
              <div className="flex gap-1.5">
                {SIGNUP_STEPS.map(({ step }) => (
                  <div
                    key={step}
                    className={`flex-1 h-1.5 rounded-full overflow-hidden relative ${
                      step < signupStep ? "bg-primary" : step === signupStep ? "bg-slate-200" : "bg-slate-200"
                    }`}
                  >
                    {step === signupStep && (
                      <div className="absolute inset-y-0 left-0 w-1/2 bg-primary rounded-full" />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-1.5 mt-2">
                {SIGNUP_STEPS.map(({ step, label }) => (
                  <button
                    key={step}
                    type="button"
                    onClick={() => goToSignupStep(step)}
                    className={`flex-1 text-left text-[11px] font-bold p-0 bg-transparent border-0 cursor-pointer ${
                      step < signupStep ? "text-primary" : step === signupStep ? "text-foreground" : "text-slate-400"
                    }`}
                  >
                    {step} · {label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 font-semibold mt-2">
                Passo {signupStep} de 3 — {SIGNUP_STEP_TITLES[signupStep]}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Seu progresso fica salvo neste aparelho até você concluir.
              </p>
            </div>
          )}
          {mode === "login" && (
            <BiometricLoginButton onSuccess={() => navigate("/cliente", { replace: true })} />
          )}
          {mode === "login" && (
            <div>
              <label className="text-xs font-semibold text-slate-500 tracking-wide mb-1.5 block">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  inputMode="email"
                  placeholder="seu@email.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className={inputClass}
                  autoComplete="username"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">Conta criada antigamente com WhatsApp? Você ainda pode informar o número nesta tela.</p>
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

          {mode === "signup" && signupStep === 1 && (
            <div>
              <label className="text-xs font-semibold text-slate-500 tracking-wide mb-1.5 block">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  id="signup-email"
                  type="email"
                  inputMode="email"
                  placeholder="seu@email.com"
                  value={signupEmail}
                  onChange={(e) => { setSignupEmail(e.target.value); clearFieldError("email"); }}
                  className={signupFieldClass("email")}
                  autoComplete="email"
                />
              </div>
              {signupErrorText("email")}
              <p className="text-[11px] text-slate-400 mt-1.5">Usaremos este e-mail para acesso e recuperação de senha.</p>
            </div>
          )}

          {mode === "signup" && signupStep === 1 && (
            <div>
              <label className="text-xs font-semibold text-slate-500 tracking-wide mb-1.5 block">WhatsApp</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  id="signup-whatsapp"
                  type="tel"
                  inputMode="numeric"
                  placeholder="(14) 99999-9999"
                  value={whatsapp}
                  onChange={(e) => { setWhatsapp(maskWhatsApp(e.target.value)); clearFieldError("whatsapp"); }}
                  maxLength={15}
                  className={signupFieldClass("whatsapp")}
                />
              </div>
              {signupErrorText("whatsapp")}
            </div>
          )}

          {mode === "signup" && signupStep === 1 && (
            <>
              <div>
                <label className="text-xs font-semibold text-slate-500 tracking-wide mb-1.5 block">Nome completo</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    id="signup-fullName"
                    type="text"
                    placeholder="Seu nome"
                    value={fullName}
                    onChange={(e) => { setFullName(e.target.value); clearFieldError("fullName"); }}
                    maxLength={80}
                    autoComplete="name"
                    className={signupFieldClass("fullName")}
                  />
                </div>
                {signupErrorText("fullName")}
              </div>
            </>
          )}

          {(mode === "login" || mode === "reset" || (mode === "signup" && signupStep === 1)) && (
            <>
              <div>
                <label className="text-xs font-semibold text-slate-500 tracking-wide mb-1.5 block">
                  {mode === "reset" ? "Nova senha" : "Senha"}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    id={mode === "signup" ? "signup-password" : undefined}
                    type={showPassword ? "text" : "password"}
                    placeholder={mode === "reset" ? "Crie uma senha forte" : "••••••"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); clearFieldError("password"); }}
                    className={mode === "signup" && signupErrors.password ? inputClassPasswordError : inputClassPassword}
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
                {mode === "signup" && signupErrorText("password")}
              </div>

              {((mode === "signup" && signupStep === 1) || mode === "reset") && password.length > 0 && (
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
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => setMode("forgot")}
                className="text-sm text-primary font-medium"
              >
                Esqueceu a senha?
              </button>
            </div>
          )}

          {mode === "signup" && signupStep === 2 && (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-1">
                  <label className="text-xs font-semibold text-slate-500 tracking-wide mb-1.5 block">CEP</label>
                  <input
                    id="signup-cep"
                    type="tel"
                    inputMode="numeric"
                    placeholder="00000-000"
                    value={cep}
                    onChange={(e) => { void handleCepChange(e.target.value); }}
                    maxLength={9}
                    className={signupFieldClass("cep", false)}
                  />
                  {signupErrorText("cep")}
                  {cepNotFound && !signupErrors.cep && (
                    <p className="text-[11px] text-orange-700 font-medium mt-1.5">CEP não encontrado. Confira os números ou preencha o endereço manualmente.</p>
                  )}
                </div>
                <div className="col-span-1">
                  <label className="text-xs font-semibold text-slate-500 tracking-wide mb-1.5 block">Número</label>
                  <input
                    id="signup-number"
                    type="text"
                    placeholder="123"
                    value={number}
                    onChange={(e) => { setNumber(e.target.value); clearFieldError("number"); }}
                    maxLength={10}
                    className={signupFieldClass("number", false)}
                  />
                  {signupErrorText("number")}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 tracking-wide mb-1.5 block">Rua / Logradouro {cepLoading && <span className="text-slate-400 font-normal">(buscando...)</span>}</label>
                <input
                  id="signup-street"
                  type="text"
                  placeholder="Rua das Flores"
                  value={street}
                  onChange={(e) => { setStreet(e.target.value); clearFieldError("street"); }}
                  maxLength={120}
                  className={signupFieldClass("street", false)}
                />
                {signupErrorText("street")}
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 tracking-wide mb-1.5 block">Bairro</label>
                <input
                  id="signup-neighborhood"
                  type="text"
                  placeholder="Centro"
                  value={neighborhood}
                  onChange={(e) => { setNeighborhood(e.target.value); clearFieldError("neighborhood"); }}
                  maxLength={80}
                  className={signupFieldClass("neighborhood", false)}
                />
                {signupErrorText("neighborhood")}
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 tracking-wide mb-1.5 block">Complemento (opcional)</label>
                <input
                  type="text"
                  placeholder="Apto 101, Bloco B"
                  value={complement}
                  onChange={(e) => setComplement(e.target.value)}
                  maxLength={80}
                  className={plainInputClass}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 tracking-wide mb-1.5 block">Ponto de referência (opcional)</label>
                <input
                  type="text"
                  placeholder="Ao lado da padaria"
                  value={referencePoint}
                  onChange={(e) => setReferencePoint(e.target.value)}
                  maxLength={120}
                  className={plainInputClass}
                />
              </div>
            </div>
          )}

          {mode === "signup" && signupStep === 3 && (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 tracking-wide mb-1.5 block">PIN (4 dígitos)</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      id="signup-deliveryPin"
                      type="tel"
                      inputMode="numeric"
                      placeholder="••••"
                      value={deliveryPin}
                      onChange={(e) => { setDeliveryPin(e.target.value.replace(/\D/g, "").slice(0, 4)); clearFieldError("deliveryPin"); }}
                      maxLength={4}
                      className={signupFieldClass("deliveryPin")}
                      autoComplete="off"
                    />
                  </div>
                  {signupErrorText("deliveryPin")}
                  <p className="text-[11px] text-slate-400 mt-1.5">Evite datas óbvias, como aniversário ou ano de nascimento.</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 tracking-wide mb-1.5 block">Confirme</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      id="signup-confirmPin"
                      type="tel"
                      inputMode="numeric"
                      placeholder="••••"
                      value={confirmPin}
                      onChange={(e) => { setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4)); clearFieldError("confirmPin"); }}
                      maxLength={4}
                      className={signupFieldClass("confirmPin")}
                      autoComplete="off"
                    />
                  </div>
                  {signupErrorText("confirmPin")}
                </div>
              </div>
              <div>
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    id="signup-pinAcknowledged"
                    type="checkbox"
                    checked={pinAcknowledged}
                    onChange={(e) => { setPinAcknowledged(e.target.checked); clearFieldError("pinAcknowledged"); }}
                    className="w-4 h-4 rounded border-border accent-primary mt-0.5 shrink-0"
                  />
                  <span className="text-xs text-slate-500 leading-relaxed">
                    Entendi que <strong>este PIN será usado em todas as minhas entregas</strong>.
                  </span>
                </label>
                {signupErrorText("pinAcknowledged")}
              </div>
            </div>
          )}

          {mode === "signup" && signupStep === 3 && (
            <div>
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  id="signup-acceptedTerms"
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => { setAcceptedTerms(e.target.checked); clearFieldError("acceptedTerms"); }}
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
              {signupErrorText("acceptedTerms")}
            </div>
          )}

          <div className={mode === "signup" && signupStep > 1 ? "flex gap-3" : ""}>
            {mode === "signup" && signupStep > 1 && (
              <button
                type="button"
                onClick={() => goToSignupStep((signupStep - 1) as SignupStep)}
                className="flex-1 h-11 bg-white text-foreground font-bold rounded-xl border border-border active:scale-[0.98] transition-all"
              >
                Voltar
              </button>
            )}
            <button
              disabled={loading || (mode === "reset" && passedCount < PASSWORD_RULES.length && password.length > 0)}
              className={`${mode === "signup" && signupStep > 1 ? "flex-1" : "w-full"} h-11 bg-primary text-primary-foreground font-bold rounded-xl active:scale-[0.98] transition-all disabled:opacity-50 shadow-md shadow-primary/20 hover:brightness-105`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Aguarde...
                </span>
              ) : mode === "login" ? "Entrar"
                : mode === "signup" ? (signupStep === 3 ? "Criar conta" : "Continuar")
                : mode === "forgot" ? "Enviar link"
                : "Salvar nova senha"
              }
            </button>
          </div>
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
            src="/itasuper-logo-horizontal.webp?v=2"
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
               Cardápio digital e delivery profissional conforme a disponibilidade da sua cidade.
             </p>
        </div>

        <div className="relative z-10">
          <div className="space-y-3 mb-12">
            {["Pedidos em tempo real", "Formas de pagamento claras", "Acompanhe o status da entrega"].map((text) => (
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
        <header className="md:hidden sticky top-0 z-10 bg-white border-b border-slate-100 h-14 flex items-center px-3">
          <img
            src="/itasuper-logo-horizontal.webp?v=2"
            alt="ItaSuper"
            width={119}
            height={28}
            decoding="async"
            className="h-7 w-auto object-contain"
          />
        </header>

        <div className="flex-1 flex items-start md:items-center justify-center px-2 pt-3 pb-8 md:px-10 md:pt-0">
          <div className="w-full max-w-sm">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-5 md:shadow-none md:border-0 md:p-0">
              <div className="mb-4">
                <h1 className="text-2xl font-black text-foreground tracking-tight">
                  {titles[mode]}
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  {mode === "signup"
                    ? SIGNUP_STEPS.find((s) => s.step === signupStep)?.subtitle
                    : subtitles[mode]}
                </p>
              </div>
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
