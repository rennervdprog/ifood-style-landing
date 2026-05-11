import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import {
  Search, Store, Repeat, ShoppingBag, Clock, ChevronRight, Zap,
  Mail, Lock, Eye, EyeOff, KeyRound, FileText, CheckCircle2, Phone, User,
} from "lucide-react";
 import { maskWhatsApp } from "@/lib/whatsapp";
 import { formatDocument, sanitizeDocument, validateDocument } from "@/lib/documentFormat";
import { formatBRL } from "@/lib/utils";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";
import ProductTour, { clienteTourSteps } from "@/components/ProductTour";
import { getStoreOpenStatus, type OpeningHour } from "@/lib/storeStatus";
import { useUserLocation } from "@/hooks/useUserLocation";
import { haversineDistanceMeters } from "@/lib/addressGeocoding";
import { MapPin, RefreshCw } from "lucide-react";

const mapStoresWithHours = (
  stores: any[],
  allHours: any[] | null | undefined,
  userCoords?: { lat: number; lng: number } | null,
  userCity?: string | null,
) => {
  const cityNorm = userCity?.toLowerCase().trim() || null;
  return stores
    .map((store: any) => {
      const hours = (allHours || []).filter((h: any) => h.store_id === store.id) as OpeningHour[];
      const status = getStoreOpenStatus(hours, store.force_closed || false, store.is_open);
      const lat = store.latitude;
      const lng = store.longitude;
      const distanceKm =
        userCoords && typeof lat === "number" && typeof lng === "number"
          ? haversineDistanceMeters(userCoords, { lat, lng }) / 1000
          : null;
      return { ...store, realIsOpen: status.isOpen, statusReason: status.reason, distanceKm };
    })
    .sort((a: any, b: any) => {
      if (a.realIsOpen !== b.realIsOpen) return a.realIsOpen ? -1 : 1;
      if (cityNorm) {
        const aCity = (a.address_city || "").toLowerCase() === cityNorm;
        const bCity = (b.address_city || "").toLowerCase() === cityNorm;
        if (aCity !== bCity) return aCity ? -1 : 1;
      }
      const da = a.distanceKm;
      const db = b.distanceKm;
      if (typeof da === "number" && typeof db === "number") return da - db;
      if (typeof da === "number") return -1;
      if (typeof db === "number") return 1;
      return 0;
    });
};

/* ─── Auth Section (shown when not logged in) ─── */
type AuthMode = "login" | "signup" | "forgot" | "reset";

const REMEMBER_KEY = "itasuper_remember_until";
const TWO_MONTHS_MS = 60 * 24 * 60 * 60 * 1000;

const ClientAuth = ({ onSuccess }: { onSuccess: () => void }) => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
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
            },
          },
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
            full_name: fullName.trim(),
             document: sanitizeDocument(cpf),
            whatsapp_number: `55${whatsapp.replace(/\D/g, "")}`,
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
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-white to-slate-50">
      {/* Brand */}
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
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1">
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

/* ─── Client Home (shown when logged in) ─── */

const ClientHomeContent = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const userLocation = useUserLocation();

  const { data: profile } = useQuery({
    queryKey: ["client-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name, city").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const { data: recentOrders } = useQuery({
    queryKey: ["client-recent-orders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, stores!inner(id, name, image_url, slug, is_open), order_items(*, products(id, name, price, is_available, image_url, store_id))")
        .eq("client_id", user!.id)
        .in("status", ["entregue", "finalizado"])
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 2,
  });

  const { data: searchResults } = useQuery({
    queryKey: ["client-store-search", searchQuery, userLocation.coords?.lat, userLocation.coords?.lng],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("public-store-catalog", {
        body: { query: searchQuery, limit: 50, fallback_to_all: true },
      });
      if (error) throw error;
      const stores = Array.isArray(data?.stores) ? data.stores : [];
      if (stores.length === 0) return [];

      // Fetch opening hours for all found stores
      const storeIds = stores.map((s: any) => s.id);
      const { data: allHours } = await supabase
        .from("opening_hours")
        .select("store_id, day_of_week, open_time, close_time, is_closed_all_day")
        .in("store_id", storeIds);

      return mapStoresWithHours(stores, allHours, userLocation.coords, userLocation.city);
    },
    enabled: searchQuery.length >= 2,
    staleTime: 1000 * 60,
  });

   const hasOrders = (recentOrders && recentOrders.length > 0) || searchQuery.length > 0;

  // Cidade preferencial: GPS atual > cidade do cadastro
  const effectiveCity = userLocation.city?.trim() || profile?.city?.trim() || null;

  // All available stores for the city — always loaded so every client sees options
   const { data: suggestedStores, isLoading: loadingStores } = useQuery({
    queryKey: ["available-stores", effectiveCity || "all", userLocation.coords?.lat, userLocation.coords?.lng],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("public-store-catalog", {
        body: {
          city: effectiveCity,
          limit: 50,
          fallback_to_all: true,
        },
      });
      if (error) throw error;
      let rows = Array.isArray(data?.stores) ? data.stores : [];

      if (rows.length === 0) {
        const { data: fallbackData, error: fallbackError } = await supabase.functions.invoke("public-store-catalog", {
          body: { limit: 50, fallback_to_all: true },
        });
        if (fallbackError) throw fallbackError;
        rows = Array.isArray(fallbackData?.stores) ? fallbackData.stores : [];
      }

      // Fetch opening hours
      const storeIds = rows.map((s: any) => s.id);
      if (storeIds.length === 0) return [];
      const { data: allHours } = await supabase
        .from("opening_hours")
        .select("store_id, day_of_week, open_time, close_time, is_closed_all_day")
        .in("store_id", storeIds);

      return mapStoresWithHours(rows, allHours, userLocation.coords, userLocation.city);
    },
    enabled: true,
    staleTime: 1000 * 60 * 5,
  });

   const showSuggestions = searchFocused && !searchQuery && suggestedStores && suggestedStores.length > 0;

   if (loadingStores) {
     return (
       <div className="min-h-screen bg-slate-50 pb-24">
         <div className="bg-primary pt-10 pb-24 px-5">
           <div className="flex items-center justify-between mb-8">
             <div className="h-10 w-32 bg-primary-foreground/20 animate-pulse rounded-lg" />
             <div className="h-10 w-10 bg-primary-foreground/20 animate-pulse rounded-full" />
           </div>
           <div className="h-14 w-full bg-white animate-pulse rounded-2xl" />
         </div>
         <div className="px-5 -mt-16 space-y-8">
           <div className="space-y-4">
             <div className="h-6 w-32 bg-slate-200 animate-pulse rounded" />
             <div className="flex gap-3 overflow-x-hidden">
               {[1, 2, 3].map(i => (
                 <div key={i} className="min-w-[140px] h-44 bg-white animate-pulse rounded-3xl border border-slate-100" />
               ))}
             </div>
           </div>
           <div className="space-y-4">
             <div className="h-6 w-40 bg-slate-200 animate-pulse rounded" />
             {[1, 2].map(i => (
               <div key={i} className="h-24 w-full bg-white animate-pulse rounded-3xl border border-slate-100" />
             ))}
           </div>
         </div>
         <BottomNav />
       </div>
     );
   }

  const lastStores = recentOrders
    ? Array.from(new Map(recentOrders.map((o: any) => [o.stores?.id, o.stores])).values()).filter(Boolean).slice(0, 5)
    : [];

  const lastOrder = recentOrders?.[0];

  const handleReorder = (order: any) => {
    const availableItems = order.order_items?.filter((item: any) => item.products?.is_available) || [];
    if (availableItems.length === 0) { toast.error("Nenhum item disponível no momento."); return; }
    availableItems.forEach((item: any) => {
      if (item.products) {
        addItem({
          id: item.products.id, name: item.products.name, price: item.products.price,
          basePrice: item.products.price, store_id: item.products.store_id,
          store_name: order.stores?.name || "", image_url: item.products.image_url,
        }, item.quantity);
      }
    });
    toast.success(`${availableItems.length} itens adicionados ao carrinho!`);
    navigate("/carrinho");
  };

  const goToStore = (store: any) => {
    if (store?.slug) navigate(`/${store.slug}`);
    else if (store?.id) navigate(`/loja/${store.id}`);
  };

  const firstName = profile?.full_name?.split(" ")[0] || "Cliente";
  const visibleStores = searchQuery.length >= 2 ? searchResults || [] : suggestedStores || [];

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-primary px-4 pt-10 pb-6 rounded-b-3xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary-foreground/20 flex items-center justify-center">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-primary-foreground font-extrabold text-lg">ItaSuper</span>
          </div>
        </div>
        <h1 className="text-primary-foreground text-xl font-bold">Olá, {firstName}! 👋</h1>
        <p className="text-primary-foreground/70 text-sm mt-0.5">O que vai pedir hoje?</p>
        <form onSubmit={(e) => e.preventDefault()} className="mt-4" data-tour="search">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
              placeholder="Pesquisar loja pelo nome..."
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            {/* Suggestions dropdown for new users */}
            {showSuggestions && visibleStores.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-lg z-50 max-h-72 overflow-y-auto">
                <p className="px-3 pt-3 pb-1 text-xs font-semibold text-muted-foreground">
                  ✨ Sugestões{profile?.city ? ` em ${profile.city}` : ""}
                </p>
                {visibleStores.map((store: any) => (
                  <button key={store.id} onClick={() => goToStore(store)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left">
                    {store.image_url ? (
                      <img loading="lazy" decoding="async" src={store.image_url} className="w-10 h-10 rounded-lg object-cover" alt="" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Store className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{store.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{store.category?.replace(/_/g, " ")}</p>
                    </div>
                    <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${store.realIsOpen ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>
                      {store.realIsOpen ? "Aberta" : "Fechada"}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </form>
      </div>

      <div className="px-4 mt-5 space-y-6">
        {/* Search Results */}
        {searchQuery.length >= 2 && searchResults && (
          <div>
            <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-1.5">
              <Search className="h-4 w-4 text-primary" /> Resultados
            </h2>
            {searchResults.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma loja encontrada para "{searchQuery}"</p>
            ) : (
              <div className="space-y-2">
                {searchResults.map((store: any) => (
                  <button key={store.id} onClick={() => goToStore(store)}
                    className="w-full flex items-center gap-3 p-3 bg-card border border-border rounded-xl hover:bg-muted/50 transition-colors text-left">
                    {store.image_url ? (
                      <img loading="lazy" decoding="async" src={store.image_url} className="w-12 h-12 rounded-xl object-cover" alt="" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Store className="h-5 w-5 text-primary" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-foreground truncate">{store.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{store.category?.replace(/_/g, " ")}</p>
                      {!store.realIsOpen && store.statusReason && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">{store.statusReason}</p>
                      )}
                    </div>
                    <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${store.realIsOpen ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                      {store.realIsOpen ? "Aberta" : "Fechada"}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Last Order */}
        {!searchQuery && lastOrder && (
          <div>
            <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-primary" /> Último pedido
            </h2>
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-3">
                {lastOrder.stores?.image_url ? (
                  <img loading="lazy" decoding="async" src={lastOrder.stores.image_url} className="w-10 h-10 rounded-xl object-cover" alt="" />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <ShoppingBag className="h-5 w-5 text-primary" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground">{lastOrder.stores?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(lastOrder.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                  </p>
                </div>
                <span className="text-sm font-bold text-primary">{formatBRL(Number(lastOrder.total_price))}</span>
              </div>
              <div className="space-y-0.5 mb-3">
                {lastOrder.order_items?.slice(0, 3).map((item: any) => (
                  <p key={item.id} className="text-xs text-muted-foreground">{item.quantity}x {item.products?.name || "Item"}</p>
                ))}
                {(lastOrder.order_items?.length || 0) > 3 && (
                  <p className="text-xs text-muted-foreground">+{lastOrder.order_items.length - 3} itens</p>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => goToStore(lastOrder.stores)}
                  className="flex-1 bg-muted text-foreground text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5">
                  <Store className="h-3.5 w-3.5" /> Ver loja
                </button>
                <button onClick={() => handleReorder(lastOrder)}
                  className="flex-1 bg-primary text-primary-foreground text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5">
                  <Repeat className="h-3.5 w-3.5" /> Pedir de novo
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Last Visited Stores */}
        {!searchQuery && lastStores.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-1.5">
              <Store className="h-4 w-4 text-primary" /> Suas lojas
            </h2>
            <div className="flex overflow-x-auto gap-3 no-scrollbar -mx-1 px-1 pb-1">
              {lastStores.map((store: any) => (
                <button key={store.id} onClick={() => goToStore(store)}
                  className="flex-shrink-0 w-28 flex flex-col items-center gap-2 p-3 bg-card border border-border rounded-2xl hover:bg-muted/50 transition-colors">
                  {store.image_url ? (
                    <img loading="lazy" decoding="async" src={store.image_url} className="w-14 h-14 rounded-xl object-cover" alt="" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Store className="h-6 w-6 text-primary" />
                    </div>
                  )}
                  <p className="text-xs font-bold text-foreground text-center truncate w-full">{store.name}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Reorder */}
        {!searchQuery && recentOrders && recentOrders.length > 1 && (
          <div>
            <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-1.5">
              <Repeat className="h-4 w-4 text-primary" /> Pedir de novo
            </h2>
            <div className="flex overflow-x-auto gap-3 no-scrollbar -mx-1 px-1 pb-1">
              {recentOrders.slice(1, 6).map((order: any) => (
                <div key={order.id} className="flex-shrink-0 w-44 bg-card border border-border rounded-2xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    {order.stores?.image_url ? (
                      <img loading="lazy" decoding="async" src={order.stores.image_url} className="w-8 h-8 rounded-lg object-cover" alt="" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <ShoppingBag className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{order.stores?.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    {order.order_items?.slice(0, 2).map((item: any) => (
                      <p key={item.id} className="text-[10px] text-muted-foreground truncate">{item.quantity}x {item.products?.name || "Item"}</p>
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">{formatBRL(Number(order.total_price))}</span>
                    <button onClick={() => handleReorder(order)}
                      className="bg-primary text-primary-foreground text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1">
                      <Repeat className="h-3 w-3" /> Pedir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!searchQuery && (!recentOrders || recentOrders.length === 0) && (
          <div className="text-center py-10">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-bold text-foreground text-lg mb-1">Nenhum pedido ainda</h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-4">
              Pesquise uma loja pelo nome ou cole o link que o lojista compartilhou com você.
            </p>
          </div>
        )}

        {/* Always-visible: All available stores in the city */}
        {!searchQuery && (
          <div>
            <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-1.5">
              <Store className="h-4 w-4 text-primary" />
              Lojas disponíveis{profile?.city ? ` em ${profile.city}` : ""}
            </h2>
            {loadingStores ? (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-32 rounded-2xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : visibleStores.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {visibleStores.map((store: any) => (
                  <button
                    key={store.id}
                    onClick={() => goToStore(store)}
                    className="bg-card border border-border rounded-2xl p-3 flex flex-col gap-2 text-left hover:bg-muted/50 transition-colors"
                  >
                    {store.image_url ? (
                      <img loading="lazy" decoding="async" src={store.image_url} className="w-full h-20 rounded-xl object-cover" alt={store.name} />
                    ) : (
                      <div className="w-full h-20 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Store className="h-7 w-7 text-primary" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{store.name}</p>
                      <p className="text-[11px] text-muted-foreground capitalize truncate">
                        {store.category?.replace(/_/g, " ")}
                      </p>
                    </div>
                    <span
                      className={`self-start text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        store.realIsOpen
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      {store.realIsOpen ? "Aberta" : "Fechada"}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma loja disponível no momento.
              </p>
            )}
          </div>
        )}
      </div>

      <BottomNav />
      <ProductTour steps={clienteTourSteps} tourKey="cliente_home" />
    </div>
  );
};

/* ─── Main Page Component ─── */

const ClientHome = () => {
  const { user, loading } = useAuth();
  const [justLoggedIn, setJustLoggedIn] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Not logged in → show auth screen
  if (!user && !justLoggedIn) {
    return <ClientAuth onSuccess={() => setJustLoggedIn(true)} />;
  }

  // Logged in → show client home
  return <ClientHomeContent />;
};

export default ClientHome;
