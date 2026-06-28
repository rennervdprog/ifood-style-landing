import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Mail, Lock, Eye, EyeOff, KeyRound, FileText, Phone, User, ShoppingBag, Zap, ShieldCheck,
} from "lucide-react";
import { maskWhatsApp } from "@/lib/whatsapp";
import { formatDocument, sanitizeDocument, validateDocument } from "@/lib/documentFormat";
import { toast } from "sonner";

type AuthMode = "login" | "signup" | "forgot" | "reset";

const REMEMBER_KEY = "itasuper_remember_until";
const TWO_MONTHS_MS = 60 * 24 * 60 * 60 * 1000;

const ClientAuthScreen = ({ onSuccess }: { onSuccess: () => void }) => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [deliveryPin, setDeliveryPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinAcknowledged, setPinAcknowledged] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === "forgot") {
      if (!email.trim()) { toast.error("Informe seu e-mail."); return; }
      setLoading(true);
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/cliente?mode=reset`,
        });
        if (error) throw error;
        setResetSent(true);
        toast.success("E-mail de recuperação enviado!");
      } catch (err: any) {
        toast.error(err.message || "Erro ao enviar e-mail.");
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!email.trim() || !password.trim()) { toast.error("Preencha todos os campos."); return; }
    if (mode === "signup" && fullName.trim().length < 3) { toast.error("Informe seu nome completo."); return; }
    if (mode === "signup" && !validateDocument(cpf)) { toast.error("CPF ou CNPJ inválido."); return; }
    if (mode === "signup") {
      const whatsDigits = whatsapp.replace(/\D/g, "");
      if (whatsDigits.length < 10 || whatsDigits.length > 11) {
        toast.error("Informe um WhatsApp válido com DDD.");
        return;
      }
    }
    if (mode === "signup" && !acceptedTerms) { toast.error("Aceite os Termos de Uso."); return; }
    if (mode === "signup") {
      if (!/^\d{4}$/.test(deliveryPin)) { toast.error("Defina um PIN de entrega com 4 dígitos numéricos."); return; }
      if (deliveryPin !== confirmPin) { toast.error("Os PINs informados não coincidem."); return; }
      if (!pinAcknowledged) { toast.error("Confirme que este PIN será usado em todas as entregas."); return; }
    }
    if (password.length < 6) { toast.error("Senha: mínimo 6 caracteres."); return; }

    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        if (rememberMe) localStorage.setItem(REMEMBER_KEY, String(Date.now() + TWO_MONTHS_MS));
        else localStorage.removeItem(REMEMBER_KEY);
        toast.success("Login realizado!");
        onSuccess();
      } else if (mode === "signup") {
        const { data: signUpData, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: fullName.trim(),
              role: "cliente",
              document: sanitizeDocument(cpf),
              whatsapp: `55${whatsapp.replace(/\D/g, "")}`,
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
            full_name: fullName.trim(),
            document: sanitizeDocument(cpf),
            whatsapp_number: `55${whatsapp.replace(/\D/g, "")}`,
            delivery_pin: deliveryPin,
          }).eq("user_id", signUpData.user.id);
        }
        toast.success("Conta criada!");
        onSuccess();
      } else if (mode === "reset") {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        toast.success("Senha atualizada!");
        onSuccess();
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao autenticar.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full h-11 pl-10 pr-4 rounded-xl border border-border bg-white text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm";
  const inputClassPassword = "w-full h-11 pl-10 pr-12 rounded-xl border border-border bg-white text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm";

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

  return (
    <div className="min-h-dvh flex flex-col bg-gradient-to-b from-white to-slate-50">
      <div className="flex items-center justify-center gap-2.5 pt-10 pb-6">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
          <Zap className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="text-foreground font-black text-xl">ItaSuper</span>
      </div>

      <div className="flex-1 flex items-start justify-center px-5 pb-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 mx-auto">
              {mode === "forgot" || mode === "reset" ? (
                <KeyRound className="h-6 w-6 text-primary" />
              ) : (
                <ShoppingBag className="h-6 w-6 text-primary" />
              )}
            </div>
            <h1 className="text-2xl font-black text-foreground tracking-tight">{titles[mode]}</h1>
            <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">{subtitles[mode]}</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            {mode === "forgot" && resetSent ? (
              <div className="text-center space-y-4 py-6">
                <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mx-auto">
                  <KeyRound className="h-7 w-7 text-green-500" />
                </div>
                <h3 className="font-bold text-foreground text-lg">E-mail enviado!</h3>
                <p className="text-sm text-slate-500 mt-1.5 leading-relaxed max-w-xs mx-auto">
                  Verifique sua caixa de entrada e clique no link para redefinir sua senha.
                </p>
                <button onClick={() => { setMode("login"); setResetSent(false); }} className="text-primary font-semibold text-sm">
                  Voltar para login
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode !== "reset" && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 tracking-wide mb-1.5 block">E-mail</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} autoComplete="email" />
                    </div>
                  </div>
                )}
                {mode !== "forgot" && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 tracking-wide mb-1.5 block">
                      {mode === "reset" ? "Nova senha" : "Senha"}
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input type={showPassword ? "text" : "password"} placeholder={mode === "reset" ? "Mínimo 6 caracteres" : "••••••"} value={password} onChange={(e) => setPassword(e.target.value)} className={inputClassPassword} autoComplete={mode === "login" ? "current-password" : "new-password"} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>
                        {showPassword ? <EyeOff className="h-4 w-4 text-slate-400" /> : <Eye className="h-4 w-4 text-slate-400" />}
                      </button>
                    </div>
                  </div>
                )}
                {mode === "signup" && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 tracking-wide mb-1.5 block">Nome completo</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input type="text" placeholder="Seu nome" value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        autoComplete="name" maxLength={80} className={inputClass} />
                    </div>
                  </div>
                )}
                {mode === "signup" && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 tracking-wide mb-1.5 block">CPF ou CNPJ</label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input type="text" inputMode="numeric" placeholder="CPF ou CNPJ" value={cpf}
                        onChange={(e) => setCpf(formatDocument(e.target.value))}
                        maxLength={18} className={inputClass} />
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
                        placeholder="(15) 99999-9999"
                        value={maskWhatsApp(whatsapp)}
                        onChange={(e) => {
                          let digits = e.target.value.replace(/\D/g, "");
                          if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
                          setWhatsapp(digits.slice(0, 11));
                        }}
                        maxLength={16}
                        className={inputClass}
                      />
                    </div>
                  </div>
                )}
                {mode === "login" && (
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="w-4 h-4 rounded border-border accent-primary" />
                      <span className="text-sm text-slate-500">Lembrar-me</span>
                    </label>
                    <button type="button" onClick={() => setMode("forgot")} className="text-sm text-primary font-medium">Esqueceu a senha?</button>
                  </div>
                )}
                {mode === "signup" && (
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} className="w-4 h-4 rounded border-border accent-primary mt-0.5 shrink-0" />
                    <span className="text-xs text-slate-500 leading-relaxed">
                      Li e aceito os{" "}
                      <Link to="/termos-de-uso" target="_blank" className="text-primary font-semibold underline">Termos de Uso</Link>{" "}
                      e a{" "}
                      <Link to="/politica-de-privacidade" target="_blank" className="text-primary font-semibold underline">Política de Privacidade</Link>
                    </span>
                  </label>
                )}
                <button disabled={loading} className="w-full h-11 bg-primary text-primary-foreground font-bold rounded-xl active:scale-[0.98] transition-all disabled:opacity-50 shadow-md shadow-primary/20 hover:brightness-105">
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      Aguarde...
                    </span>
                  ) : mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : mode === "forgot" ? "Enviar link" : "Salvar nova senha"}
                </button>
              </form>
            )}

            {(mode === "login" || mode === "signup") && (
              <div className="mt-6 pt-5 border-t border-slate-100">
                <p className="text-center text-sm text-slate-500">
                  {mode === "login" ? "Não tem conta? " : "Já tem conta? "}
                  <button onClick={() => setMode(mode === "login" ? "signup" : "login")} className="text-primary font-semibold">
                    {mode === "login" ? "Cadastre-se" : "Faça login"}
                  </button>
                </p>
              </div>
            )}
            {mode === "forgot" && !resetSent && (
              <div className="mt-6 pt-5 border-t border-slate-100">
                <p className="text-center text-sm text-slate-500">
                  Lembrou a senha?{" "}
                  <button onClick={() => setMode("login")} className="text-primary font-semibold">Faça login</button>
                </p>
              </div>
            )}
          </div>

          <div className="text-center space-y-2 mt-8 pb-4">
            <p className="text-xs text-slate-400">
              © {new Date().getFullYear()} Itasuper — Todos os direitos reservados
            </p>
            <div className="flex items-center justify-center gap-4 text-[10px] text-slate-400">
              <Link to="/termos-de-uso" className="hover:text-primary underline">Termos</Link>
              <Link to="/politica-de-privacidade" className="hover:text-primary underline">Política</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientAuthScreen;