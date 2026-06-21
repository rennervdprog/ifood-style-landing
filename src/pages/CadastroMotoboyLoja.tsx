import { useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowLeft, Mail, Lock, Eye, EyeOff, User, Phone, Bike, CheckCircle, Store, Loader2 } from "lucide-react";
 import { maskWhatsApp, formatWhatsAppNumber } from "@/lib/whatsapp";
import { PasswordStrengthIndicator, usePasswordStrength } from "@/components/PasswordStrengthIndicator";

const schema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  emailConfirm: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").max(100),
  fullName: z.string().trim().min(3, "Nome deve ter pelo menos 3 caracteres").max(100),
   phone: z.string().trim().min(1, "WhatsApp é obrigatório").min(10, "WhatsApp inválido").max(20),
  vehicle: z.string().trim().min(2, "Informe o tipo de veículo").max(50),
}).refine(data => data.email === data.emailConfirm, {
  message: "Os e-mails não coincidem",
  path: ["emailConfirm"],
});

const InputField = ({ label, icon: Icon, value, onChange, error, type = "text", placeholder, ...props }: any) => (
  <div className="space-y-1.5">
    <label className="text-xs font-bold text-foreground">{label}</label>
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full pl-10 pr-3 py-3 bg-muted/50 border ${error ? "border-red-500" : "border-border"} rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30`}
        {...props}
      />
    </div>
    {error && <p className="text-[11px] text-red-500 font-medium">{error}</p>}
  </div>
);

const CadastroMotoboyLoja = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [emailConfirm, setEmailConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = schema.safeParse({ email, emailConfirm, password, fullName, phone, vehicle });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => { fieldErrors[err.path[0] as string] = err.message; });
      setErrors(fieldErrors);
      return;
    }

    if (!acceptedTerms) { toast.error("Você precisa aceitar os Termos de Uso."); return; }

    setLoading(true);
    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: window.location.origin,
             data: {
               full_name: fullName.trim(),
               role: "motoboy",
               driver_type: "store",
               vehicle: vehicle.trim(),
               whatsapp: formatWhatsAppNumber(phone),
               phone: formatWhatsAppNumber(phone),
             },
        },
      });
      if (signUpError) throw signUpError;

      const userId = signUpData.user?.id;
      if (!userId) throw new Error("Erro ao criar conta");

      await supabase.from("terms_acceptance").insert({
        user_id: userId,
        terms_version: "3.0",
        privacy_version: "3.0",
        user_agent: navigator.userAgent,
      });

      setSuccess(true);
    } catch (err: any) {
      if (err.message?.includes("already registered")) {
        toast.error("Este e-mail já está cadastrado. Faça login.");
      } else {
        toast.error(err.message || "Erro ao cadastrar.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        <div className="text-center space-y-5 max-w-sm">
          <div className="w-20 h-20 bg-green-500/10 rounded-3xl flex items-center justify-center mx-auto">
            <CheckCircle className="h-10 w-10 text-green-500" />
          </div>
          <div>
             <h2 className="text-xl font-black text-foreground">Cadastro Realizado! 🎉</h2>
             <p className="text-sm text-muted-foreground mt-2">
               Sua conta ainda está em análise aguarde. Agora peça ao dono da loja para te adicionar como motoboy próprio.
             </p>
          </div>
          <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 flex items-start gap-3">
            <Mail className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground text-left">
              Verifique seu e-mail <span className="font-bold text-foreground">{email}</span> para confirmar sua conta.
            </p>
          </div>
          <div className="bg-muted/50 rounded-2xl p-4 flex items-start gap-3">
            <Store className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground text-left">
              Após o dono da loja vincular seu telefone, você poderá acessar o painel de entregas em{" "}
              <span className="font-bold text-foreground">/entregador</span>.
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => navigate("/")} className="flex-1 bg-muted text-foreground font-bold px-5 py-3.5 rounded-xl text-sm">
              Voltar à Home
            </button>
            <button onClick={() => navigate("/auth")} className="flex-1 bg-primary text-primary-foreground font-bold px-5 py-3.5 rounded-xl text-sm">
              Fazer Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3 max-w-lg mx-auto">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-muted/80 flex items-center justify-center">
            <ArrowLeft className="h-4 w-4 text-foreground" />
          </button>
          <div>
            <h1 className="text-base font-black text-foreground">Cadastro Motoboy de Loja</h1>
            <p className="text-[11px] text-muted-foreground">Entregador próprio vinculado a uma loja</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Info banner */}
        <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <Store className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold text-foreground mb-1">Como funciona?</p>
              <ol className="text-[11px] text-muted-foreground leading-relaxed list-decimal list-inside space-y-1">
                <li>Cadastre-se aqui com seus dados básicos</li>
                <li>Informe seu telefone ao dono da loja</li>
                <li>O dono da loja vai te adicionar como motoboy próprio</li>
                <li>Acesse o painel de entregas e veja apenas os pedidos da sua loja</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Aviso de responsabilidade */}
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold text-foreground mb-1">Importante: vínculo com a loja</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Este app é uma <span className="font-bold text-foreground">ferramenta da loja</span> para organizar suas entregas. O ItaSuper <span className="font-bold text-foreground">não contrata, não paga e não fiscaliza</span> motoboys de loja — toda relação (pagamento, horário, seguro, documentos) é de responsabilidade do <span className="font-bold text-foreground">dono da loja</span>. Sem vínculo ativo aceito pelo lojista, o app não libera entregas.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <InputField label="Nome completo" icon={User} value={fullName} onChange={(e: any) => setFullName(e.target.value)} error={errors.fullName} placeholder="Seu nome completo" />
          <InputField label="E-mail" icon={Mail} value={email} onChange={(e: any) => setEmail(e.target.value)} error={errors.email} placeholder="seu@email.com" type="email" />
          <InputField label="Confirme o e-mail" icon={Mail} value={emailConfirm} onChange={(e: any) => setEmailConfirm(e.target.value)} error={errors.emailConfirm} placeholder="Repita o e-mail" type="email" />
          
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">Senha</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className={`w-full pl-10 pr-10 py-3 bg-muted/50 border ${errors.password ? "border-red-500" : "border-border"} rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30`}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2">
                {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
              </button>
            </div>
            {errors.password && <p className="text-[11px] text-red-500 font-medium">{errors.password}</p>}
          </div>
          <PasswordStrengthIndicator password={password} />

          <InputField label="WhatsApp / Telefone" icon={Phone} value={phone} onChange={(e: any) => setPhone(maskWhatsApp(e.target.value))} error={errors.phone} placeholder="(14) 99999-9999" type="tel" />
          <InputField label="Veículo (ex: Moto Honda CG 160)" icon={Bike} value={vehicle} onChange={(e: any) => setVehicle(e.target.value)} error={errors.vehicle} placeholder="Tipo e modelo do veículo" />

          {/* Terms */}
          <label className="flex items-start gap-3 bg-muted/30 rounded-xl p-3 cursor-pointer">
            <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} className="mt-0.5 rounded" />
            <span className="text-[11px] text-muted-foreground leading-relaxed">
              Li e aceito os{" "}
              <Link to="/termos-de-uso" className="text-primary font-bold underline" target="_blank">Termos de Uso</Link>{" "}
              e a{" "}
              <Link to="/politica-de-privacidade" className="text-primary font-bold underline" target="_blank">Política de Privacidade</Link>.
            </span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground font-black py-3.5 rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="animate-spin h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full" />
            ) : (
              <>
                <Bike className="h-4 w-4" />
                Criar Conta de Motoboy
              </>
            )}
          </button>

          <p className="text-center text-xs text-muted-foreground">
            Já tem conta?{" "}
            <Link to="/auth" className="text-primary font-bold">Fazer login</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default CadastroMotoboyLoja;
