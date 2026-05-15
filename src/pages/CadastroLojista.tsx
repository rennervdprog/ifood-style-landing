import { useState, useMemo, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowLeft, Mail, Lock, Eye, EyeOff, Store, FileText, CheckCircle, CheckCircle2, MapPin, Search, Loader2, Key, Phone, Shield, ChevronRight, User, Users, Package, TrendingUp, Zap, CreditCard, BarChart3, Crown } from "lucide-react";
import { PasswordStrengthIndicator, usePasswordStrength } from "@/components/PasswordStrengthIndicator";
import { Constants } from "@/integrations/supabase/types";
import { formatCep, fetchCep } from "@/lib/cepLookup";
 import { maskWhatsApp, formatWhatsAppNumber } from "@/lib/whatsapp";
 import { formatPixKeyDisplay, sanitizePixKeyForAsaas, validatePixKey, PIX_PLACEHOLDERS } from "@/lib/pixFormat";
 import { formatDocument, sanitizeDocument, validateDocument } from "@/lib/documentFormat";
import { PLANS, PLANS_ORDER, DELIVERY_FEE_NOTE, PIX_FEE_NOTE } from "@/lib/plansInfo";
import { Check } from "lucide-react";

const storeCategories = Constants.public.Enums.store_category;

const categoryLabels: Record<string, string> = {
  lanches: "🍔 Lanches", pizzas: "🍕 Pizzas", restaurante: "🍽️ Restaurante",
  adegas: "🍷 Adegas", japonesa: "🍣 Japonesa", saudavel: "🥗 Saudável",
  sobremesas: "🍰 Sobremesas", cafeteria: "☕ Cafeteria", churrasco: "🥩 Churrasco",
  farmacias: "💊 Farmácia", docerias: "🍰 Doceria",
};

const pixTypeLabels: Record<string, string> = {
  cpf: "CPF", cnpj: "CNPJ", email: "E-mail", phone: "Telefone", random: "Chave Aleatória",
};

const PLATFORM_CITIES = ["itatinga"];

   const schema = z.object({
     email: z.string().trim().email("E-mail inválido").max(255),
     confirmEmail: z.string().trim().email("E-mail inválido").max(255),
     password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").max(100),
     storeName: z.string().trim().min(3, "Nome da loja deve ter pelo menos 3 caracteres").max(100),
      document: z.string().trim().refine(v => validateDocument(v), "CPF ou CNPJ inválido"),
     birthDate: z.string().min(10, "Data de nascimento obrigatória").max(10),
     whatsapp: z.string().trim().min(1, "WhatsApp é obrigatório").min(10, "WhatsApp inválido (ex: 14 99999-9999)").max(20),
     pixType: z.enum(["cpf", "cnpj", "email", "phone", "random"] as const, { errorMap: () => ({ message: "Selecione o tipo da chave PIX" }) }),
  pixKey: z.string().trim().min(1, "Chave PIX obrigatória").max(100),
  storeCategory: z.enum(storeCategories as unknown as [string, ...string[]], { errorMap: () => ({ message: "Selecione uma categoria" }) }),
  cep: z.string().min(8, "CEP inválido"),
  city: z.string().min(1, "Busque o CEP para identificar a cidade"),
  street: z.string().trim().min(2, "Rua é obrigatória"),
  addressNumber: z.string().trim().min(1, "Número é obrigatório"),
  neighborhood: z.string().trim().min(2, "Bairro é obrigatório"),
  selectedPlan: z.enum(["supporter", "fixed", "hybrid", "commission_only"], { errorMap: () => ({ message: "Selecione um plano" }) }),
}).refine((data) => data.email === data.confirmEmail, {
  message: "Os e-mails não coincidem",
  path: ["confirmEmail"],
});

const STEPS = [
  { label: "Plano", icon: Crown },
  { label: "Conta", icon: Mail },
  { label: "Loja", icon: Store },
  { label: "Dados", icon: User },
];

const CadastroLojista = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const referralCode = searchParams.get("ref") || "";
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState("");
  const [storeName, setStoreName] = useState("");
  const [document, setDocument] = useState("");
  const [storeCategory, setStoreCategory] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [pixType, setPixType] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [cep, setCep] = useState("");
  const [city, setCity] = useState("");
  const [street, setStreet] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedPlan, setSelectedPlan] = useState<"supporter" | "fixed" | "hybrid" | "commission_only" | "">("");
  const [supporterCount, setSupporterCount] = useState<number>(0);
  const [supporterLoading, setSupporterLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const { data, error } = await supabase.rpc("count_supporter_plans" as any);
        if (!isMounted) return;
        if (!error && typeof data === "number") setSupporterCount(data);
      } catch {
        /* ignore */
      } finally {
        if (isMounted) setSupporterLoading(false);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  const supporterAvailable = !supporterLoading && supporterCount < 10;
  const supporterRemaining = Math.max(0, 10 - supporterCount);

  const handleCepChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    const formatted = formatCep(digits);
    setCep(formatted);
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

  const validateStep = (stepIndex: number): boolean => {
    setErrors({});
    if (stepIndex === 0) {
      if (!selectedPlan) {
        toast.error("Selecione um plano para continuar.");
        return false;
      }
    }
    if (stepIndex === 1) {
      const fieldErrors: Record<string, string> = {};
      if (!email.trim()) fieldErrors.email = "E-mail obrigatório";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) fieldErrors.email = "E-mail inválido";
      if (!confirmEmail.trim()) fieldErrors.confirmEmail = "Confirme seu e-mail";
      else if (email.trim() !== confirmEmail.trim()) fieldErrors.confirmEmail = "Os e-mails não coincidem";
      if (!password) fieldErrors.password = "Senha obrigatória";
      else if (password.length < 6) fieldErrors.password = "Senha deve ter pelo menos 6 caracteres";
      if (Object.keys(fieldErrors).length > 0) { setErrors(fieldErrors); return false; }
    }
    if (stepIndex === 2) {
      const fieldErrors: Record<string, string> = {};
      if (storeName.trim().length < 3) fieldErrors.storeName = "Nome da loja deve ter pelo menos 3 caracteres";
      if (!storeCategory) fieldErrors.storeCategory = "Selecione uma categoria";
      if (cep.replace(/\D/g, "").length < 8) fieldErrors.cep = "CEP inválido";
      if (!city) fieldErrors.city = "Busque o CEP para identificar a cidade";
      if (!street.trim()) fieldErrors.street = "Rua é obrigatória";
      if (!addressNumber.trim()) fieldErrors.addressNumber = "Número é obrigatório";
      if (!neighborhood.trim()) fieldErrors.neighborhood = "Bairro é obrigatório";
      if (Object.keys(fieldErrors).length > 0) { setErrors(fieldErrors); return false; }
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep(step)) setStep(prev => Math.min(prev + 1, 3));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = schema.safeParse({ email, confirmEmail, password, storeName, document, birthDate, whatsapp, pixType, pixKey, storeCategory, cep, city, street, addressNumber, neighborhood, selectedPlan });
    // Extra: valida formato da chave PIX conforme tipo (Asaas)
    const pixErr = validatePixKey(pixKey, pixType);
    if (pixErr && result.success) {
      setErrors({ pixKey: pixErr });
      toast.error(pixErr);
      return;
    }
    const cleanPixKey = sanitizePixKeyForAsaas(pixKey, pixType);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    if (!acceptedTerms) {
      toast.error("Você precisa aceitar os Termos de Uso e Política de Privacidade.");
      return;
    }

    setLoading(true);
    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: window.location.origin,
             data: {
               full_name: storeName.trim(),
               role: "lojista",
               document: sanitizeDocument(document),
               birth_date: birthDate,
               whatsapp: formatWhatsAppNumber(whatsapp),
               phone: formatWhatsAppNumber(whatsapp),
               pix_type: pixType,
               pix_key: cleanPixKey,
               store_name: storeName.trim(),
               store_category: storeCategory,
               city: normalizedCity,
               cep: cep.replace(/\D/g, ""),
               street: street,
               address_number: addressNumber.trim(),
               neighborhood: neighborhood,
               selected_plan: selectedPlan,
             },
        },
      });
      if (signUpError) throw signUpError;

      if (signUpData?.user?.id) {
        // Aguardar propagação do novo usuário no Supabase
        await new Promise(r => setTimeout(r, 800));

        // Login com retry (até 3 tentativas)
        let signInErr: any = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
          signInErr = error;
          if (!error) break;
          if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 1000));
        }
        if (signInErr) {
          // Não abortar — trigger de fallback já criou o profile/loja
          toast.warning("Cadastro criado! Faça login para continuar.");
          navigate("/portal-parceiro", { replace: true });
          return;
        }

        // Criar loja via RPC (fallback: trigger no banco garante criação mesmo se falhar)
        let createdStoreId: string | null = null;
        try {
          const { data: storeIdRpc, error: rpcErr } = await (supabase as any).rpc(
            "register_as_lojista",
            {
              _full_name: storeName.trim(),
              _document: sanitizeDocument(document),
              _store_name: storeName.trim(),
              _store_category: storeCategory,
              _avatar_url: null,
              _whatsapp: formatWhatsAppNumber(whatsapp),
              _selected_plan: selectedPlan,
            }
          );
          if (rpcErr) {
            console.warn("register_as_lojista aviso (não-fatal):", rpcErr.message);
          } else if (typeof storeIdRpc === "string") {
            createdStoreId = storeIdRpc;
          }
        } catch (rpcEx) {
          console.warn("RPC exception (não-fatal, trigger garante loja):", rpcEx);
        }

        await supabase.from("terms_acceptance").insert({
          user_id: signUpData.user.id,
          terms_version: "2.0",
          privacy_version: "2.0",
          user_agent: navigator.userAgent,
        });
         await supabase.from("profiles").update({
           terms_accepted_at: new Date().toISOString(),
           birth_date: birthDate,
           pix_type: pixType as any,
           pix_key: cleanPixKey,
           cep: cep.replace(/\D/g, ""),
           street: street,
           address_number: addressNumber.trim(),
           neighborhood: neighborhood,
           city: normalizedCity,
           phone: formatWhatsAppNumber(whatsapp),
           whatsapp_number: formatWhatsAppNumber(whatsapp),
         } as any).eq("user_id", signUpData.user.id);

        // Busca a loja (criada via RPC ou via trigger, dependendo do ambiente)
        let storeRow: { id: string } | null = createdStoreId ? { id: createdStoreId } : null;
        if (!storeRow) {
          const { data } = await supabase
            .from("stores")
            .select("id")
            .eq("owner_id", signUpData.user.id)
            .maybeSingle();
          storeRow = data as any;
        }
        if (storeRow?.id) {
          await supabase.from("stores").update({
            address_street: street.trim(),
            address_number: addressNumber.trim(),
            address_neighborhood: neighborhood.trim(),
            address_cep: cep.replace(/\D/g, ""),
            address_city: city,
          } as any).eq("id", storeRow.id);

          // Link store to moderator if referral code present
          if (referralCode && storeRow.id) {
            try {
              const { data: mod } = await (supabase as any)
                .from("moderators")
                .select("id")
                .eq("referral_code", referralCode)
                .eq("is_active", true)
                .maybeSingle();
              if (mod?.id) {
                await (supabase as any).from("moderator_referrals").insert({
                  moderator_id: mod.id,
                  store_id: storeRow.id,
                });
              }
            } catch {
              // Non-critical: don't block signup
            }
          }
        }
      }

       toast.success("Cadastro realizado com sucesso! Sua conta está em análise aguarde.");
       navigate("/admin", { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Erro ao cadastrar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-xl border-b border-border flex items-center h-14 px-4 gap-3">
        <button onClick={() => step > 0 ? setStep(step - 1) : navigate("/")} className="w-9 h-9 rounded-xl bg-muted/50 flex items-center justify-center">
          <ArrowLeft className="h-4 w-4 text-foreground" />
        </button>
        <div className="flex items-center gap-2">
          <Store className="h-5 w-5 text-primary" />
          <h1 className="font-bold text-foreground text-sm">Cadastro Lojista</h1>
        </div>
      </header>

      {/* Referral Banner */}
      {referralCode && (
        <div className="mx-4 mt-2 bg-accent/20 border border-accent rounded-xl px-4 py-2 text-xs text-accent-foreground flex items-center gap-2">
          <Users className="h-4 w-4" />
          <span>Cadastro via indicação: <span className="font-bold font-mono">{referralCode}</span></span>
        </div>
      )}

      {/* Stepper */}
      <div className="px-6 pt-5 pb-2">
        <div className="flex items-center justify-between gap-2">
          {STEPS.map((s, i) => {
            const isActive = i === step;
            const isDone = i < step;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5 cursor-pointer" onClick={() => { if (isDone) setStep(i); }}>
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
                  isDone ? "bg-green-500/10 hover:bg-green-500/20" : isActive ? "bg-primary/10" : "bg-muted/50"
                }`}>
                  {isDone ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <s.icon className={`h-5 w-5 ${isActive ? "text-primary" : "text-muted-foreground/50"}`} />
                  )}
                </div>
                <span className={`text-[10px] font-bold ${isDone ? "text-green-500" : isActive ? "text-primary" : "text-muted-foreground/50"}`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center px-6 py-4 overflow-y-auto">
        <div className="w-full max-w-sm">
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* ═══ Step 0: Plano ═══ */}
            {step === 0 && (
              <div className="space-y-4">
                <div className="text-center mb-2">
                  <h2 className="text-lg font-black text-foreground">Escolha seu plano</h2>
                  <p className="text-xs text-muted-foreground mt-1">Sem contrato. Troque quando quiser. Sem multa.</p>
                  <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                    <Zap className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-xs font-bold text-emerald-600">Teste 7 dias grátis · só paga depois</span>
                  </div>
                </div>

                {/* Cards de plano — ordem: Comissão, Crescimento, Essencial, Apoiador */}
                {(["commission_only", "hybrid", "fixed", "supporter"] as const).map((id) => {
                  if (id === "supporter" && !supporterAvailable) return null;
                  const p = PLANS[id];
                  const Icon = p.icon;
                  const selected = selectedPlan === id;
                  const isSupporter = id === "supporter";
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSelectedPlan(id)}
                      className={`w-full text-left rounded-2xl border-2 p-4 transition-all relative ${
                        selected
                          ? "border-primary bg-primary/5"
                          : isSupporter
                            ? "border-amber-500/40 bg-amber-500/5 hover:border-amber-500/70"
                            : "border-border bg-card hover:border-primary/40"
                      }`}
                    >
                      {p.badge && (
                        <span className={`absolute -top-2.5 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isSupporter ? "bg-amber-500 text-white" : "bg-primary text-primary-foreground"
                        }`}>
                          {isSupporter ? `🚀 ${supporterRemaining} vagas` : p.badge}
                        </span>
                      )}
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-10 h-10 rounded-xl ${p.accentBg} flex items-center justify-center`}>
                          <Icon className={`h-5 w-5 ${p.accent}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-sm text-foreground">Plano {p.name}</h3>
                          <p className="text-[11px] text-muted-foreground truncate">{p.tagline}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-lg font-black text-foreground">
                            {p.monthlyFee === 0 ? "Grátis" : `R$${p.monthlyFee}`}
                          </span>
                          {p.monthlyFee > 0 && <span className="text-xs text-muted-foreground">/mês</span>}
                        </div>
                      </div>

                      {/* Trial badge — só planos pagos */}
                      {p.monthlyFee > 0 && (
                        <div className="mb-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-2 space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-base leading-none">🎁</span>
                            <p className="text-[11px] font-extrabold text-emerald-700 dark:text-emerald-400 leading-tight">
                              7 DIAS GRÁTIS para testar
                            </p>
                          </div>
                          <ul className="text-[9.5px] text-emerald-700/90 dark:text-emerald-400/90 leading-snug space-y-0.5 pl-0.5">
                            <li>• <strong>Dia 1–7:</strong> liberado, sem cobrar nada</li>
                            <li>• <strong>Dia 8:</strong> 1ª cobrança de R${p.monthlyFee} (se não cancelar)</li>
                            <li>• Cancele a qualquer hora antes do dia 8</li>
                          </ul>
                        </div>
                      )}

                      {/* Quick costs */}
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <div className="rounded-lg bg-muted/40 p-2 text-center">
                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Comissão</p>
                          <p className="text-xs font-bold text-foreground">
                            {p.commissionRate === 0 ? "0%" : `${p.commissionRate}%`}
                          </p>
                        </div>
                        <div className="rounded-lg bg-muted/40 p-2 text-center">
                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">PIX</p>
                          <p className="text-xs font-bold text-foreground">
                            {p.pixFee === 0 ? "Grátis" : `R$${p.pixFee.toFixed(2).replace(".", ",")}`}
                          </p>
                        </div>
                        <div className="rounded-lg bg-muted/40 p-2 text-center">
                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Entrega</p>
                          <p className="text-xs font-bold text-foreground">+R$2</p>
                          <p className="text-[10px] text-muted-foreground leading-tight">cliente paga</p>
                        </div>
                      </div>

                      <p className="text-[10px] text-muted-foreground italic mb-2 leading-snug">
                        💡 Os <strong>R$2 da entrega</strong> são somados à taxa que você cobra. Quem paga é o cliente — não sai do seu caixa.
                      </p>

                      <ul className="space-y-1">
                        {p.features.slice(0, 3).map(f => (
                          <li key={f} className="flex items-start gap-1.5 text-[11px] text-foreground">
                            <Check className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}

                {selectedPlan && (
                  <div className="rounded-xl bg-primary/5 border border-primary/15 p-3 space-y-1.5">
                    <p className="text-xs font-bold text-foreground">Como funciona o {PLANS[selectedPlan].name}</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      <strong>Exemplo:</strong> {PLANS[selectedPlan].example(50)}.
                    </p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">💡 {DELIVERY_FEE_NOTE}</p>
                    {PLANS[selectedPlan].pixFee > 0 && (
                      <p className="text-[10px] text-muted-foreground leading-relaxed">💡 {PIX_FEE_NOTE}</p>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={nextStep}
                  disabled={!selectedPlan}
                  className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  Próximo <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* ═══ Step 1: Conta ═══ */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="text-center mb-2">
                  <h2 className="text-lg font-black text-foreground">Crie sua conta</h2>
                  <p className="text-xs text-muted-foreground mt-1">Dados de acesso à plataforma</p>
                </div>

                <FieldInput icon={Mail} type="email" placeholder="Seu e-mail" value={email} onChange={setEmail} error={errors.email} autoComplete="email" />
                <FieldInput icon={Mail} type="email" placeholder="Confirme seu e-mail" value={confirmEmail} onChange={setConfirmEmail} error={errors.confirmEmail} autoComplete="email" />
                <p className="text-[10px] text-muted-foreground -mt-2 px-1 flex items-center gap-1">
                  <Shield className="h-3 w-3 text-primary flex-shrink-0" />
                  Garanta que o e-mail esteja correto. Será usado para notificações e repasses financeiros.
                </p>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Sua senha (min. 6 caracteres)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-12 pl-10 pr-12 rounded-2xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1">
                    {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </button>
                  {errors.password && <p className="text-xs text-destructive mt-1">{errors.password}</p>}
                </div>
                <PasswordStrengthIndicator password={password} />

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(0)}
                    className="flex-1 bg-muted text-foreground font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" /> Voltar
                  </button>
                  <button
                    type="button"
                    onClick={nextStep}
                    className="flex-1 bg-primary text-primary-foreground font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    Próximo <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ═══ Step 2: Loja ═══ */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="text-center mb-2">
                  <h2 className="text-lg font-black text-foreground">Sobre sua loja</h2>
                  <p className="text-xs text-muted-foreground mt-1">Nome, categoria e localização</p>
                </div>

                <FieldInput icon={Store} placeholder="Nome da Loja" value={storeName} onChange={setStoreName} error={errors.storeName} />

                <div>
                  <div className="relative">
                    <Store className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <select
                      value={storeCategory}
                      onChange={(e) => setStoreCategory(e.target.value)}
                      className="w-full h-12 pl-10 pr-4 rounded-2xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm appearance-none"
                    >
                      <option value="">Selecione a categoria</option>
                      {storeCategories.map((cat) => (
                        <option key={cat} value={cat}>{categoryLabels[cat] || cat}</option>
                      ))}
                    </select>
                  </div>
                  {errors.storeCategory && <p className="text-xs text-destructive mt-1 px-1">{errors.storeCategory}</p>}
                </div>

                {/* CEP */}
                <div>
                  <label className="text-xs font-bold text-muted-foreground mb-1.5 block px-1">Localização da Loja</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="CEP (ex: 18690-000)"
                        value={cep}
                        onChange={(e) => handleCepChange(e.target.value)}
                        inputMode="numeric"
                        maxLength={9}
                        className="w-full h-12 pl-10 pr-4 rounded-2xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCepLookup()}
                      disabled={loadingCep}
                      className="px-4 h-12 rounded-2xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50 flex items-center gap-1"
                    >
                      {loadingCep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.cep && <p className="text-xs text-destructive mt-1 px-1">{errors.cep}</p>}
                  {errors.city && <p className="text-xs text-destructive mt-1 px-1">{errors.city}</p>}

                  {city && (
                    <div className="mt-2 p-3 rounded-2xl border border-border bg-muted/50">
                      <p className="text-sm font-bold text-foreground flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        {city}
                        {isPlatformCity ? (
                          <span className="text-xs bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full">✅ Plataforma Completa</span>
                        ) : (
                          <span className="text-xs bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full">📱 Cardápio Digital</span>
                        )}
                      </p>
                      {street && <p className="text-xs text-muted-foreground mt-1">{street}{addressNumber ? `, ${addressNumber}` : ""}{neighborhood ? ` - ${neighborhood}` : ""}</p>}
                      {!isPlatformCity && (
                        <p className="text-xs text-amber-600 mt-1">
                          Motoboys da plataforma ainda não disponíveis. Sua loja funcionará como cardápio digital com motoboy próprio.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Street + Number fields */}
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <div className="col-span-2">
                      <input
                        type="text"
                        placeholder="Rua / Avenida *"
                        value={street}
                        onChange={(e) => setStreet(e.target.value)}
                        className="w-full h-12 px-4 rounded-2xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                      />
                      {errors.street && <p className="text-xs text-destructive mt-1 px-1">{errors.street}</p>}
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Nº *"
                        value={addressNumber}
                        onChange={(e) => setAddressNumber(e.target.value)}
                        inputMode="numeric"
                        className="w-full h-12 px-4 rounded-2xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                      />
                      {errors.addressNumber && <p className="text-xs text-destructive mt-1 px-1">{errors.addressNumber}</p>}
                    </div>
                  </div>

                  {/* Neighborhood */}
                  <div className="mt-2">
                    <input
                      type="text"
                      placeholder="Bairro *"
                      value={neighborhood}
                      onChange={(e) => setNeighborhood(e.target.value)}
                      className="w-full h-12 px-4 rounded-2xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    />
                    {errors.neighborhood && <p className="text-xs text-destructive mt-1 px-1">{errors.neighborhood}</p>}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex-1 bg-muted text-foreground font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" /> Voltar
                  </button>
                  <button
                    type="button"
                    onClick={nextStep}
                    className="flex-1 bg-primary text-primary-foreground font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    Próximo <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ═══ Step 3: Dados Pessoais & Financeiro ═══ */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="text-center mb-2">
                  <h2 className="text-lg font-black text-foreground">Dados pessoais</h2>
                  <p className="text-xs text-muted-foreground mt-1">Documento, contato e dados de pagamento</p>
                </div>

                 <FieldInput 
                   icon={FileText} 
                   placeholder="CPF ou CNPJ" 
                   value={document} 
                   onChange={(v) => setDocument(formatDocument(v))} 
                   error={errors.document} 
                   inputMode="numeric" 
                   maxLength={18}
                 />

                <div>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="date"
                      placeholder="Data de Nascimento"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="w-full h-12 pl-10 pr-4 rounded-2xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 px-1">Data de nascimento do responsável</p>
                  {errors.birthDate && <p className="text-xs text-destructive mt-1 px-1">{errors.birthDate}</p>}
                </div>

                 <div>
                   <FieldInput 
                     icon={Phone} 
                     placeholder="(14) 99999-9999" 
                     value={whatsapp} 
                     onChange={(v) => {
                       const digits = v.replace(/\D/g, "");
                       setWhatsapp(digits.slice(0, 11));
                     }} 
                     error={errors.whatsapp} 
                     inputMode="tel" 
                     isPhone={true}
                   />
                   <p className="text-[10px] text-muted-foreground mt-1 px-1">Usado para contato e Asaas.</p>
                 </div>

                {/* PIX */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground px-1 block">Chave PIX para recebimento</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <select
                      value={pixType}
                      onChange={(e) => setPixType(e.target.value)}
                      className="w-full h-12 pl-10 pr-4 rounded-2xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm appearance-none"
                    >
                      <option value="">Tipo da chave PIX</option>
                      {Object.entries(pixTypeLabels).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </div>
                  {errors.pixType && <p className="text-xs text-destructive mt-1 px-1">{errors.pixType}</p>}
                  <FieldInput
                    icon={Key}
                    placeholder={PIX_PLACEHOLDERS[pixType] || "Sua chave PIX"}
                    value={pixType ? formatPixKeyDisplay(pixKey, pixType) : pixKey}
                    onChange={setPixKey}
                    error={errors.pixKey}
                  />
                  <p className="text-[10px] text-muted-foreground px-1">Chave PIX onde você receberá os pagamentos</p>
                </div>

                {/* Terms */}
                <label className="flex items-start gap-3 cursor-pointer select-none bg-muted/50 rounded-2xl p-3.5">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="w-5 h-5 rounded-lg border-border accent-primary mt-0.5 shrink-0"
                  />
                  <span className="text-xs text-muted-foreground leading-relaxed">
                    Li e aceito os{" "}
                    <Link to="/termos-de-uso" target="_blank" className="text-primary font-bold underline">Termos de Uso</Link>{" "}
                    e a{" "}
                    <Link to="/politica-de-privacidade" target="_blank" className="text-primary font-bold underline">Política de Privacidade</Link>{" "}
                    do ItaSuper.
                  </span>
                </label>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="flex-1 bg-muted text-foreground font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" /> Voltar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-primary text-primary-foreground font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                        Cadastrando...
                      </span>
                    ) : "Cadastrar"}
                  </button>
                </div>
              </div>
            )}
          </form>

          <p className="text-center text-xs text-muted-foreground mt-5 mb-8">
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

 const FieldInput = ({ icon: Icon, placeholder, value, onChange, error, type = "text", autoComplete, inputMode, maxLength, isPhone }: {
   icon: React.ElementType; placeholder: string; value: string; onChange: (v: string) => void; error?: string; type?: string; autoComplete?: string; inputMode?: string; maxLength?: number; isPhone?: boolean;
 }) => (
   <div>
     <div className="relative">
       <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
       <input
         type={type}
         inputMode={inputMode as any}
         placeholder={placeholder}
         value={isPhone ? maskWhatsApp(value) : value}
         onChange={(e) => onChange(e.target.value)}
         className="w-full h-12 pl-10 pr-4 rounded-2xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
         autoComplete={autoComplete}
         maxLength={isPhone ? 16 : maxLength}
       />
     </div>
     {error && <p className="text-xs text-destructive mt-1 px-1">{error}</p>}
   </div>
 );

export default CadastroLojista;
