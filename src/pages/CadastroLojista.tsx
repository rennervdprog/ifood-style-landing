import { useState, useMemo, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowLeft, Mail, Lock, Eye, EyeOff, Store, FileText, CheckCircle, CheckCircle2, MapPin, Search, Loader2, Phone, Shield, ChevronRight, User, Users, Package, TrendingUp, Zap, CreditCard, BarChart3, Crown } from "lucide-react";
import { PasswordStrengthIndicator, usePasswordStrength } from "@/components/PasswordStrengthIndicator";
import { Constants } from "@/integrations/supabase/types";
import { formatCep, fetchCep, resolveAddress } from "@/lib/location";
  import { maskWhatsApp, formatWhatsAppNumber } from "@/lib/whatsapp";
  import { formatDocument, sanitizeDocument, validateDocument } from "@/lib/documentFormat";
import { PLANS, PLANS_ORDER, DELIVERY_FEE_NOTE, PIX_FEE_NOTE } from "@/lib/plansInfo";
import { useSupporterCount } from "@/hooks/useSupporterCount";
import { Check } from "lucide-react";
import PlanFeeBreakdown from "@/components/fees/PlanFeeBreakdown";
import WhyThisCharge from "@/components/fees/WhyThisCharge";
import { ChevronDown } from "lucide-react";

const storeCategories = Constants.public.Enums.store_category;

const categoryLabels: Record<string, string> = {
  lanches: "🍔 Lanches", pizzas: "🍕 Pizzas", pasteis: "🥟 Pastéis", restaurante: "🍽️ Restaurante",
  adegas: "🍷 Adegas", japonesa: "🍣 Japonesa", saudavel: "🥗 Saudável",
  sobremesas: "🍰 Sobremesas", cafeteria: "☕ Cafeteria", churrasco: "🥩 Churrasco",
  farmacias: "💊 Farmácia", docerias: "🍰 Doceria",
  roupas: "👗 Roupas",
};

const PLATFORM_CITIES = ["itatinga"];

   const schema = z.object({
     email: z.string().trim().email("E-mail inválido").max(255),
     confirmEmail: z.string().trim().email("E-mail inválido").max(255),
     password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").max(100),
     storeName: z.string().trim().min(3, "Nome da loja deve ter pelo menos 3 caracteres").max(100),
      document: z.string().trim().refine(v => validateDocument(v), "CPF ou CNPJ inválido"),
     birthDate: z.string().min(10, "Data de nascimento obrigatória").max(10)
       .refine((v) => {
         const d = new Date(v);
         if (isNaN(d.getTime())) return false;
         const today = new Date();
         let age = today.getFullYear() - d.getFullYear();
         const m = today.getMonth() - d.getMonth();
         if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
         return age >= 18 && age <= 120;
       }, "Lojista deve ter 18 anos ou mais (cláusula 2.2 dos Termos)"),
     whatsapp: z.string().trim().min(1, "WhatsApp é obrigatório").min(10, "WhatsApp inválido (ex: 14 99999-9999)").max(20),
  storeCategory: z.enum(storeCategories as unknown as [string, ...string[]], { errorMap: () => ({ message: "Selecione uma categoria" }) }),
  cep: z.string().min(8, "CEP inválido"),
  city: z.string().min(1, "Busque o CEP para identificar a cidade"),
  street: z.string().trim().min(2, "Rua é obrigatória"),
  addressNumber: z.string().trim().min(1, "Número é obrigatório"),
  neighborhood: z.string().trim().min(2, "Bairro é obrigatório"),
  selectedPlan: z.enum(["supporter", "fixed", "hybrid", "commission_only", "autonomy", "pdv_only"], { errorMap: () => ({ message: "Selecione um plano" }) }),
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
  const promoCode = (searchParams.get("promo") || "").toUpperCase();
  const promoCity = searchParams.get("city") || "";
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState("");
  const [storeName, setStoreName] = useState("");
  const [document, setDocument] = useState("");
  const [storeCategory, setStoreCategory] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [cep, setCep] = useState("");
  const [city, setCity] = useState("");
  const [street, setStreet] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [accountType, setAccountType] = useState<"single" | "matriz">("single");
  const [networkName, setNetworkName] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedPlan, setSelectedPlan] = useState<"supporter" | "fixed" | "hybrid" | "commission_only" | "autonomy" | "pdv_only" | "">("");
  const [acceptedDynamic, setAcceptedDynamic] = useState(false);
  const [expandedPlan, setExpandedPlan] = useState<"supporter" | "fixed" | "hybrid" | "commission_only" | "autonomy" | "pdv_only" | "">("");
  const isPdvOnly = selectedPlan === "pdv_only";

  const isDynamicPlan = selectedPlan === "fixed" || selectedPlan === "hybrid" || selectedPlan === "autonomy";
  useEffect(() => {
    setAcceptedDynamic(false);
  }, [selectedPlan]);
  // PDV Somente: auto-seleciona categoria (não usada) para passar validação
  useEffect(() => {
    if (selectedPlan === "pdv_only" && !storeCategory) {
      setStoreCategory("restaurante");
    }
  }, [selectedPlan, storeCategory]);
  // Promo de captação: força plano Essencial (fixed) e pula a etapa de plano.
  useEffect(() => {
    if (promoCode) {
      setSelectedPlan("fixed");
      setStep((s) => (s === 0 ? 1 : s));
    }
  }, [promoCode]);

  // Tracking: visita ao cadastro de lojista (etapa final do funil de aquisição)
  useEffect(() => {
    import("@/lib/pageView").then((m) => m.trackPageView("cadastro_lojista"));
  }, []);
  const { count: supporterCountRaw, loading: supporterLoading } = useSupporterCount();
  const supporterCount = supporterCountRaw ?? 0;
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

    const result = schema.safeParse({ email, confirmEmail, password, storeName, document, birthDate, whatsapp, storeCategory, cep, city, street, addressNumber, neighborhood, selectedPlan });
    // Validar nome da rede se for cadastro de matriz
    if (accountType === "matriz" && !networkName.trim()) {
      toast.error("Digite o nome da sua rede (ex: Itasuper Pizzaria).");
      return;
    }

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
      // Antifraude: valida CNPJ na Receita (BrasilAPI) — bloqueia BAIXADA/INAPTA/SUSPENSA
      const docDigits = sanitizeDocument(document);
      if (docDigits.length === 14) {
        try {
          const resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${docDigits}`);
          if (resp.ok) {
            const cnpjData = await resp.json();
            const sit = String(cnpjData?.descricao_situacao_cadastral || cnpjData?.situacao_cadastral || "").toUpperCase();
            if (sit && !["ATIVA", "ATIVO"].includes(sit)) {
              toast.error(`CNPJ com situação "${sit}" na Receita. Não é possível cadastrar.`);
              setLoading(false);
              return;
            }
          } else if (resp.status === 404) {
            toast.error("CNPJ não encontrado na Receita Federal.");
            setLoading(false);
            return;
          }
          // outros erros (5xx/timeout) → fail-open, prossegue
        } catch {
          /* fail-open em erro de rede */
        }
      }

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

        // Se for cadastro como matriz, registrar a rede após criar a loja
        if (accountType === "matriz" && networkName.trim()) {
          try {
            const { error: matrizErr } = await (supabase as any).rpc("register_as_matriz", {
              _network_name: networkName.trim(),
              _user_id: signUpData.user.id, // passar explícito — auth.uid() pode ser null neste momento
              _plan_type: selectedPlan,
              _monthly_fee: selectedPlan === "hybrid" ? 50 : selectedPlan === "supporter" ? 75 : 0,
              _revenue_threshold: selectedPlan === "fixed" ? 5000 : selectedPlan === "autonomy" ? 2500 : selectedPlan === "hybrid" ? 5000 : null,
              _upgrade_monthly_fee: selectedPlan === "fixed" ? 180 : selectedPlan === "autonomy" ? 239.90 : selectedPlan === "hybrid" ? 100 : null,
              _upgrade_trigger_months: (selectedPlan === "fixed" || selectedPlan === "hybrid" || selectedPlan === "autonomy") ? 2 : null,
            });
            if (matrizErr) {
              console.warn("register_as_matriz aviso:", matrizErr.message);
            }
          } catch (e) {
            console.warn("matriz exception (não-fatal):", e);
          }
        }

        await supabase.from("terms_acceptance").insert({
          user_id: signUpData.user.id,
          terms_version: "3.0",
          privacy_version: "3.0",
          user_agent: navigator.userAgent,
        });
         await supabase.from("profiles").update({
           terms_accepted_at: new Date().toISOString(),
           birth_date: birthDate,
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
          // Geocoda o endereço (CEP+rua+número) para já gravar latitude/longitude.
          // Não bloqueia o cadastro se falhar — a loja salva mesmo sem coords.
          let storeLat: number | null = null;
          let storeLng: number | null = null;
          try {
            const resolved = await resolveAddress({
              prefer: "address",
              fallback: ["cep"],
              address: {
                street: street.trim(),
                number: addressNumber.trim(),
                neighborhood: neighborhood.trim(),
                city: normalizedCity,
                postalcode: cep.replace(/\D/g, ""),
                country: "Brasil",
              },
            });
            if (resolved.coords) {
              storeLat = resolved.coords.lat;
              storeLng = resolved.coords.lng;
            }
          } catch (e) {
            console.warn("[CadastroLojista] geocode falhou:", e);
          }
          await supabase.from("stores").update({
            address_street: street.trim(),
            address_number: addressNumber.trim(),
            address_neighborhood: neighborhood.trim(),
            address_cep: cep.replace(/\D/g, ""),
            address_city: city,
            ...(storeLat !== null && storeLng !== null
              ? { latitude: storeLat, longitude: storeLng }
              : {}),
          } as any).eq("id", storeRow.id);

          // Plano Somente PDV: esconde da vitrine + ativa add-on PDV embutido (grátis)
          if (selectedPlan === "pdv_only") {
            try {
              await supabase.from("stores").update({
                is_visible: false,
                is_open: false,
                plan_type: "pdv_only",
              } as any).eq("id", storeRow.id);
              // Garante que store_plans reflita pdv_only (fallback caso a RPC tenha caído no ELSE)
              await (supabase as any).from("store_plans").update({
                plan_type: "pdv_only",
                monthly_fee: 69.00,
                commission_rate: 0,
                pdv_enabled: true,
                pdv_commission_rate: 0,
                pdv_fixed_fee_per_sale: 0,
              }).eq("store_id", storeRow.id);
              await (supabase as any).from("store_addons").upsert({
                store_id: storeRow.id,
                addon_key: "pdv",
                status: "active",
                price_override: 0,
              }, { onConflict: "store_id,addon_key" });
            } catch (e) {
              console.warn("[CadastroLojista] pdv_only setup falhou:", e);
            }
            // Telemetria: conversão finalizada do plano Somente PDV
            try {
              const m = await import("@/lib/pageView");
              await m.trackPageView("cadastro_pdv_only_created", { storeId: storeRow.id });
            } catch { /* ignore */ }
          }

          // Aplica promo de captação (ex: LONDRINA10 — Essencial R$ 0/mês travado)
          if (promoCode) {
            try {
              const { data: promoRes } = await (supabase as any).rpc("apply_promo_to_store", {
                _store_id: storeRow.id,
                _code: promoCode,
              });
              if (promoRes?.success) {
                toast.success(`🎉 Vaga garantida! Plano Essencial R$ 0/mês ativado.`);
              } else if (promoRes?.error === "sold_out") {
                toast.warning("Vagas da promoção esgotadas — sua loja ficou no plano Essencial padrão.");
              }
            } catch {
              // não bloqueia o cadastro
            }
          }

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

      toast.success("Cadastro realizado! Sua loja já está ativa. 🎉");
       navigate(accountType === "matriz" ? "/matriz" : "/admin", { replace: true });
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

      {/* Promo Banner — campanha de captação */}
      {promoCode && (
        <div className="mx-4 mt-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl px-4 py-3 text-xs flex items-center gap-2 shadow-md">
          <Crown className="h-5 w-5 text-yellow-300 shrink-0" />
          <span className="leading-snug">
            🎉 <strong>Vaga {promoCity || "promocional"} garantida!</strong><br />
            Plano Essencial travado em <strong>R$ 0/mês</strong> — sem comissão.
          </span>
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
                  <p className="text-xs text-muted-foreground mt-1">
                    7 dias grátis · sem contrato · troque quando quiser
                  </p>
                </div>

                {/* Cards compactos — toque em "Ver detalhes" para expandir */}
                <div className="space-y-3">
                {(["fixed", "autonomy", "pdv_only"] as const).map((id) => {
                  const p = PLANS[id];
                  const Icon = p.icon;
                  const selected = selectedPlan === id;
                  const isExpanded = expandedPlan === id || selected;
                  const isDynamic = id === "fixed" || id === "autonomy";
                  return (
                    <div
                      key={id}
                      className={`w-full rounded-2xl border-2 transition-all relative ${
                        selected
                          ? "border-primary bg-primary/5 ring-2 ring-primary/30 shadow-lg shadow-primary/10"
                          : "border-border bg-card hover:border-primary/40"
                      }`}
                    >
                      {p.badge && (
                        <span className="absolute -top-2.5 right-4 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md whitespace-nowrap bg-primary text-primary-foreground">
                          {p.badge}
                        </span>
                      )}
                      {/* Header compacto — sempre visível, seleciona o plano */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPlan(id);
                          if (id === "pdv_only") {
                            import("@/lib/pageView").then((m) =>
                              m.trackPageView("cadastro_pdv_only_select")
                            ).catch(() => {});
                          }
                        }}
                        className="w-full text-left p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl ${p.accentBg} flex items-center justify-center shrink-0`}>
                            <Icon className={`h-5 w-5 ${p.accent}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-sm text-foreground">Plano {p.name}</h3>
                            <p className="text-[11px] text-muted-foreground leading-snug truncate">{p.forWho}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xl font-black text-foreground tabular-nums">
                              {p.monthlyFee === 0 ? "Grátis" : `R$${p.monthlyFee}`}
                            </span>
                            {p.monthlyFee > 0 && <span className="text-[10px] text-muted-foreground ml-0.5">/mês</span>}
                          </div>
                        </div>

                        {/* Chips comparativos */}
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-foreground/80">
                            Comissão {p.commissionRate === 0 ? "0%" : `${p.commissionRate}%`}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-foreground/80">
                            PIX {p.pixFee === 0 ? "grátis" : `R$${p.pixFee.toFixed(2).replace(".", ",")}`}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-foreground/80">
                            {id === "pdv_only" ? "Sem delivery" : `Entrega ${id === "autonomy" ? "sem taxa" : "+R$ 0,99"}`}
                          </span>
                          {p.monthlyFee > 0 && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                              🎁 7 dias grátis
                            </span>
                          )}
                          {isDynamic && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400">
                              📈 Dinâmico
                            </span>
                          )}
                        </div>
                      </button>

                      {/* Toggle "Ver detalhes" */}
                      <button
                        type="button"
                        onClick={() => setExpandedPlan(isExpanded && !selected ? "" : id)}
                        className="w-full px-4 py-2 text-[11px] font-semibold text-primary flex items-center justify-center gap-1 border-t border-border/50 hover:bg-muted/30 transition-colors rounded-b-2xl"
                        aria-expanded={isExpanded}
                      >
                        {isExpanded ? "Ocultar detalhes" : "Ver detalhes"}
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </button>

                      {/* Conteúdo expandido */}
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-border/50">
                          {p.monthlyFee > 0 && (
                            <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
                              <p className="text-[12px] font-bold text-foreground mb-1">🎁 7 dias grátis para testar</p>
                              <ul className="text-[11px] text-muted-foreground leading-relaxed space-y-0.5">
                                <li>• Dia 1–7: liberado, sem cobrar nada</li>
                                <li>• Dia 8: 1ª cobrança de R${p.monthlyFee}/mês (se não cancelar)</li>
                                <li>• Cancele a qualquer hora antes do dia 8</li>
                              </ul>
                            </div>
                          )}

                          <ul className="space-y-1.5">
                            {p.features.map(f => (
                              <li key={f} className="flex items-start gap-2 text-[12px] text-foreground leading-relaxed">
                                <Check className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                                <span>{f}</span>
                              </li>
                            ))}
                          </ul>

                          {id !== "pdv_only" && (
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                              💡 O <strong>PDV de balcão</strong> é um módulo à parte (R$ 49/mês), independente do plano. Você pode ativar/cancelar quando quiser em "Meu Plano".
                            </p>
                          )}

                          <PlanFeeBreakdown planId={id} orderValue={50} viaPix={true} />

                          {id !== "pdv_only" && (
                            <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground leading-relaxed">
                              <span>
                                {id === "autonomy"
                                  ? <>✨ Sem os R$ 0,99 da plataforma: você define a taxa de entrega e fica com 100%.</>
                                  : <>Entrega: cliente paga sua taxa + R$ 0,99 da plataforma. Nada sai do seu caixa.</>}
                              </span>
                              <WhyThisCharge title="Taxa de entrega">{DELIVERY_FEE_NOTE}</WhyThisCharge>
                            </div>
                          )}

                          {p.pixFee > 0 && (
                            <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground leading-relaxed">
                              <span>PIX: R${p.pixFee.toFixed(2).replace(".", ",")} por pedido pago via PIX.</span>
                              <WhyThisCharge title="Taxa PIX">{PIX_FEE_NOTE}</WhyThisCharge>
                            </div>
                          )}

                          {isDynamic && (
                            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2">
                              <p className="text-[11px] text-foreground leading-relaxed">
                                <strong>📈 Plano dinâmico:</strong> começa em R$ 0/mês. Quando sua loja faturar <strong>R$ {id === "autonomy" ? "2.500" : "5.000"}</strong> (60 dias), a mensalidade passa a <strong>R$ {id === "autonomy" ? "239,90" : "180"}/mês</strong> — com 30 dias de aviso e seu aceite expresso.
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                </div>

                {isDynamicPlan && (
                  <div className="rounded-xl border-2 border-amber-500/50 bg-amber-500/10 p-3">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={acceptedDynamic}
                        onChange={(e) => setAcceptedDynamic(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-2 border-amber-600 accent-amber-600 cursor-pointer shrink-0"
                      />
                      <span className="text-[12px] font-semibold text-foreground leading-snug">
                        Entendi e aceito que a mensalidade pode aumentar conforme o faturamento (plano dinâmico)
                      </span>
                    </label>
                  </div>
                )}

                <button
                  type="button"
                  onClick={nextStep}
                  disabled={!selectedPlan || (isDynamicPlan && !acceptedDynamic)}
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

                {/* Tipo de conta — Loja única ou Matriz com unidades */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-foreground/80 px-1">Tipo de conta</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setAccountType("single")}
                      className={`p-3 rounded-2xl border-2 text-left transition-all ${
                        accountType === "single" ? "border-primary bg-primary/5" : "border-border bg-card"
                      }`}>
                      <p className={`text-xs font-black ${accountType === "single" ? "text-primary" : "text-foreground"}`}>🏪 Loja única</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Uma única loja</p>
                    </button>
                    <button type="button" onClick={() => setAccountType("matriz")}
                      className={`p-3 rounded-2xl border-2 text-left transition-all ${
                        accountType === "matriz" ? "border-primary bg-primary/5" : "border-border bg-card"
                      }`}>
                      <p className={`text-xs font-black ${accountType === "matriz" ? "text-primary" : "text-foreground"}`}>🏢 Matriz</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Várias unidades</p>
                    </button>
                  </div>
                  {accountType === "matriz" && (
                    <div className="bg-blue-500/8 border border-blue-500/20 rounded-xl p-2.5">
                      <p className="text-[11px] text-blue-700 dark:text-blue-400 mb-2">
                        💡 A matriz é uma página-guia da rede (não vende). Depois você cria as unidades, cada uma com seu próprio gerente, cardápio e financeiro.
                      </p>
                      <FieldInput icon={Store} placeholder="Nome da Rede (ex: Itasuper Pizzaria)" value={networkName} onChange={setNetworkName} />
                    </div>
                  )}
                </div>

                <FieldInput icon={Store} placeholder={accountType === "matriz" ? "Nome da Página Matriz (ex: Itasuper Pizzaria)" : "Nome da Loja"} value={storeName} onChange={setStoreName} error={errors.storeName} />

                {!isPdvOnly && (
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
                )}
                {isPdvOnly && (
                  <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-[11px] text-muted-foreground">
                    ℹ️ Plano <strong>Somente PDV</strong>: sua loja não aparecerá na vitrine pública. Categoria e delivery não são usados.
                  </div>
                )}

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
                          Sua loja funcionará com motoboy próprio. Cadastre seus entregadores no painel para realizar as entregas.
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
