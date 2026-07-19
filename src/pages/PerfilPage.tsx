import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { supabase, SUPABASE_URL } from "@/integrations/supabase/client";
import { isCapacitorNative } from "@/lib/capacitorNative";
import BottomNav from "@/components/BottomNav";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  User, LogOut, Store, Shield, UserPlus, MapPin, Save, Bike, Wallet, Copy,
  AlertTriangle, MessageCircle, Truck, Download, Smartphone, X, Share2,
  Search, Loader2, ChevronRight, Phone, Mail, CreditCard, Package, Settings, HelpCircle, Trash2, CheckCircle2, Users,
  KeyRound, Bell, Moon, Sun, Newspaper, Sparkles, Send, FileText, ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import ThemeToggle from "@/components/ThemeToggle";
import { maskWhatsApp, formatWhatsAppNumber, isValidWhatsApp } from "@/lib/whatsapp";
import { formatCep, fetchCep } from "@/lib/location";
import { calculateDeliveryFee, DEFAULT_DELIVERY_FEE_CONFIG, type DeliveryFeeConfig } from "@/lib/deliveryFee";
import SignOutConfirm from "@/components/SignOutConfirm";
 import { formatPixKeyDisplay, sanitizePixKeyForAsaas, validatePixKey, PIX_PLACEHOLDERS } from "@/lib/pixFormat";
 import { formatDocument, sanitizeDocument, validateDocument } from "@/lib/documentFormat";
 import { checkAppVersion } from "@/lib/appVersionCheck";
 import { APP_VERSION } from "@/lib/appVersion";
 import { forceCheckForOtaUpdate } from "@/lib/otaUpdate";

/* ── Reusable UI atoms ─────────────────────────────────── */

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-card rounded-2xl border border-border overflow-hidden shadow-sm ${className}`}>{children}</div>
);

const MenuRow = ({ icon: Icon, iconBg = "bg-primary/10", iconColor = "text-primary", title, subtitle, onClick, trailing, danger = false }: {
  icon: React.ElementType; iconBg?: string; iconColor?: string; title: string; subtitle?: string;
  onClick?: () => void; trailing?: React.ReactNode; danger?: boolean;
}) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3.5 px-4 py-3.5 transition-colors ${danger ? "hover:bg-destructive/5" : "hover:bg-muted/50"} active:bg-muted`}>
    <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
      <Icon className={`h-[18px] w-[18px] ${iconColor}`} />
    </div>
    <div className="flex-1 text-left min-w-0">
      <p className={`text-sm font-semibold leading-tight ${danger ? "text-destructive" : "text-foreground"}`}>{title}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
    </div>
    {trailing || <ChevronRight className={`h-4 w-4 shrink-0 ${danger ? "text-destructive/50" : "text-muted-foreground/40"}`} />}
  </button>
);

const InputField = ({ label, ...props }: { label?: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
  <div>
    {label && <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{label}</label>}
    <input
      {...props}
      className={`w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all ${props.className || ""}`}
    />
  </div>
);

const StatusBadge = ({ done, label }: { done: boolean; label: string }) => (
  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${done ? "bg-green-500/10 text-green-600" : "bg-amber-500/10 text-amber-600"}`}>
    {done ? <CheckCircle2 className="h-2.5 w-2.5" /> : <AlertTriangle className="h-2.5 w-2.5" />}
    {label}
  </span>
);

/* ── Main Component ────────────────────────────────────── */

const PerfilPage = () => {
  const { user, signOut } = useAuth();
  const { setNeighborhood } = useCart();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  /* ── Queries ── */
  const { data: myStore } = useQuery({
    queryKey: ["my-store", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("stores").select("id, name").eq("owner_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: isAdminUser } = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id).eq("role", "admin").maybeSingle();
      return !!data;
    },
    enabled: !!user,
  });

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: myDriver } = useQuery({
    queryKey: ["my-driver", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("drivers").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: isModerator } = useQuery({
    queryKey: ["is-moderator", user?.id],
    queryFn: async () => {
      if (!user) return false;
      // Check by user_id first
      const { data: byId } = await (supabase as any).from("moderators").select("id").eq("user_id", user.id).eq("is_active", true).maybeSingle();
      if (byId) return true;
      // Check by email
      if (user.email) {
        const { data: byEmail } = await (supabase as any).from("moderators").select("id").eq("email", user.email).eq("is_active", true).maybeSingle();
        if (byEmail) return true;
      }
      return false;
    },
    enabled: !!user,
  });

  const { data: deliveryFeeConfig } = useQuery({
    queryKey: ["delivery-fee-config"],
    queryFn: async () => {
      const { data } = await supabase.from("admin_settings").select("value").eq("key", "delivery_fee_config").maybeSingle();
      return data?.value ? (data.value as unknown as DeliveryFeeConfig) : DEFAULT_DELIVERY_FEE_CONFIG;
    },
  });

   const { data: orderCount, isLoading: loadingOrders } = useQuery({
     queryKey: ["my-order-count", user?.id],
     queryFn: async () => {
       const { count } = await supabase.from("orders").select("id", { count: "exact", head: true }).eq("client_id", user!.id);
       return count || 0;
     },
     enabled: !!user,
   });

  /* ── Local state ── */
  const [calculatedFee, setCalculatedFee] = useState<number | null>(null);
  const [feeBreakdown, setFeeBreakdown] = useState<string>("");
  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [referencePoint, setReferencePoint] = useState("");
  const [neighborhood, setNeighborhoodLocal] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressLoaded, setAddressLoaded] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [pixKey, setPixKey] = useState("");
  const [pixType, setPixType] = useState("");
  const [savingPix, setSavingPix] = useState(false);
  const [pixLoaded, setPixLoaded] = useState(false);
  const [activeSection, setActiveSection] = useState<"address" | "pix" | "personal" | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteStep, setDeleteStep] = useState(0);
  const [fullName, setFullName] = useState("");
  const [document, setDocument] = useState("");
  const [savingPersonal, setSavingPersonal] = useState(false);
   const [personalLoaded, setPersonalLoaded] = useState(false);
  const [appVersion, setAppVersion] = useState(APP_VERSION);

  /* PIN de entrega */
  const [pinValue, setPinValue] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [savingPin, setSavingPin] = useState(false);
  const [showPinEdit, setShowPinEdit] = useState(false);
  const [notifStatus, setNotifStatus] = useState<NotificationPermission | "unsupported">(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );

  const handleSentryTest = useCallback(async () => {
    try {
      const Sentry = await import("@sentry/react");
      const sentryClient = Sentry.getClient?.();

      if (!sentryClient) {
        toast.error("Sentry inicializou sem cliente ativo");
        return;
      }

      const eventId = Sentry.captureException(new Error(`Teste manual Sentry - ItaSuper v${appVersion}`), {
        tags: { source: "perfil-test-button", app_version: appVersion },
        extra: { testedAt: new Date().toISOString(), path: window.location.pathname },
        fingerprint: ["manual-sentry-test", appVersion],
      });

      const delivered = await Sentry.flush(5000);

      if (delivered) {
        toast.success(`Sentry enviado: ${eventId.slice(0, 8)}`);
      } else {
        toast.error("Sentry não confirmou o envio");
      }
    } catch {
      toast.error("Falha ao enviar teste ao Sentry");
    }
  }, [appVersion]);

  /* ── Effects ── */
  useEffect(() => {
    if (!isCapacitorNative()) return;

    let cancelled = false;
    const refreshVersion = async () => {
      try {
        const { App } = await import("@capacitor/app");
        const info = await App.getInfo();
        if (!cancelled && info.version) setAppVersion(info.version);
      } catch {}
    };

    refreshVersion();

    // Re-check whenever the app comes back to foreground or window regains focus
    const onResume = () => refreshVersion();
    window.addEventListener("capacitor-app-resume", onResume);
    window.addEventListener("focus", onResume);
    window.document.addEventListener("visibilitychange", onResume);

    return () => {
      cancelled = true;
      window.removeEventListener("capacitor-app-resume", onResume);
      window.removeEventListener("focus", onResume);
      window.document.removeEventListener("visibilitychange", onResume);
    };
  }, []);

  useEffect(() => {
    if (profile && !addressLoaded) {
      setCep((profile as any).cep ? formatCep((profile as any).cep) : "");
      setStreet((profile as any).street || "");
      setNumber((profile as any).number || "");
      setComplement((profile as any).complement || "");
      setReferencePoint((profile as any).reference_point || "");
      setNeighborhoodLocal((profile as any).neighborhood || "");
      setPhone((profile as any).phone || "");
      const wn = (profile as any).whatsapp_number || "";
      setWhatsappNumber(wn ? maskWhatsApp(wn) : "");
      setAddressLoaded(true);
    }
  }, [profile, addressLoaded]);

  useEffect(() => {
    if (profile && !pixLoaded) {
      setPixKey((profile as any).pix_key || "");
      setPixType((profile as any).pix_type || "");
      setPixLoaded(true);
    }
  }, [profile, pixLoaded]);

  useEffect(() => {
    if (profile && !personalLoaded) {
      setFullName((profile as any).full_name || "");
      setDocument((profile as any).document || "");
      setPersonalLoaded(true);
    }
  }, [profile, personalLoaded]);

  /* ── PWA Install ── */
  interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  }
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  const isIOS = useMemo(() => /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream, []);
  const isStandalone = useMemo(() => window.matchMedia("(display-mode: standalone)").matches, []);

  useEffect(() => {
    const goNativeCheck = async () => {
      const { isGoNative } = await import("@/lib/gonative");
      if (isGoNative()) { setIsInstalled(true); return; }
    };
    goNativeCheck();
    if (isStandalone) { setIsInstalled(true); return; }
    if (isIOS) { setShowInstallButton(true); return; }
    const handler = (e: Event) => { e.preventDefault(); setDeferredPrompt(e as BeforeInstallPromptEvent); setShowInstallButton(true); };
    window.addEventListener("beforeinstallprompt", handler);
    const installedHandler = () => { setIsInstalled(true); setShowInstallButton(false); };
    window.addEventListener("appinstalled", installedHandler);
    return () => { window.removeEventListener("beforeinstallprompt", handler); window.removeEventListener("appinstalled", installedHandler); };
  }, [isIOS, isStandalone]);

  const handleInstallClick = useCallback(async () => {
    if (isIOS) { setShowIOSModal(true); return; }
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") { setShowInstallButton(false); setIsInstalled(true); }
    setDeferredPrompt(null);
  }, [isIOS, deferredPrompt]);

  /* ── Handlers ── */
  const handleCepChange = (value: string) => {
    const formatted = formatCep(value);
    setCep(formatted);
    const digits = value.replace(/\D/g, "");
    if (digits.length === 8) handleCepLookup(digits);
  };

  const handleCepLookup = async (digits?: string) => {
    const cepDigits = digits || cep.replace(/\D/g, "");
    if (cepDigits.length !== 8) { toast.error("Digite um CEP válido com 8 dígitos."); return; }
    setLoadingCep(true);
    try {
      const result = await fetchCep(cepDigits);
      if (!result) { toast.error("CEP não encontrado."); return; }
      setStreet(result.logradouro || "");
      if (result.complemento) setComplement(result.complemento);
      if (result.bairro) setNeighborhoodLocal(result.bairro);
      toast.success("Endereço preenchido pelo CEP!");
    } catch { toast.error("Erro ao buscar CEP."); } finally { setLoadingCep(false); }
  };

  useEffect(() => {
    const cepDigits = cep.replace(/\D/g, "");
    if (cepDigits.length !== 8 || !deliveryFeeConfig) { setCalculatedFee(null); setFeeBreakdown(""); return; }
    let cancelled = false;
    calculateDeliveryFee(cepDigits, "", deliveryFeeConfig).then((result) => {
      if (!cancelled) { setCalculatedFee(result.fee); setFeeBreakdown(result.breakdown); }
    });
    return () => { cancelled = true; };
  }, [cep, deliveryFeeConfig]);

  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

   const handleSaveAddress = async () => {
     if (!street.trim() || !number.trim() || !neighborhood) { toast.error("Preencha rua, número e bairro."); return; }
     if (!whatsappNumber.replace(/\D/g, "")) {
       toast.error("O WhatsApp é obrigatório para entregas.");
       return;
     }
     setSavingAddress(true);
    try {
      const { error } = await supabase.from("profiles").upsert({
        user_id: user!.id, cep: cep.replace(/\D/g, "") || null, street: street.trim(),
         number: number.trim(), complement: complement.trim(), reference_point: referencePoint.trim(),
         neighborhood, 
         phone: phone.replace(/\D/g, "") ? formatWhatsAppNumber(phone) : null,
         whatsapp_number: whatsappNumber.replace(/\D/g, "") ? formatWhatsAppNumber(whatsappNumber) : null,
       } as any, { onConflict: "user_id" });
      if (error) throw error;
      if (neighborhood && calculatedFee !== null) setNeighborhood(neighborhood, calculatedFee);
      toast.success("Endereço salvo!");
       queryClient.invalidateQueries({ queryKey: ["my-profile", user?.id] });
       queryClient.invalidateQueries({ queryKey: ["my-profile-checkout", user?.id] });
    } catch (err: any) { toast.error(err.message || "Erro ao salvar."); } finally { setSavingAddress(false); }
  };

  const handleSavePix = async () => {
    if (!pixType) { toast.error("Selecione o tipo da chave PIX."); return; }
    const validation = validatePixKey(pixKey, pixType);
    if (validation) { toast.error(validation); return; }
    const cleanKey = sanitizePixKeyForAsaas(pixKey, pixType);
    setSavingPix(true);
    try {
      const { error } = await supabase.from("profiles").upsert({
        user_id: user!.id, pix_key: cleanKey, pix_type: pixType,
      } as any, { onConflict: "user_id" });
      if (error) throw error;
      setPixKey(cleanKey);
      toast.success("Chave PIX salva!");
      queryClient.invalidateQueries({ queryKey: ["my-profile", user?.id] });
    } catch (err: any) { toast.error(err.message || "Erro ao salvar."); } finally { setSavingPix(false); }
  };

  const handleSavePersonal = async () => {
     if (!fullName.trim()) { toast.error("Preencha seu nome."); return; }
     if (!document.trim()) { toast.error("CPF ou CNPJ é obrigatório para gerar suas cobranças."); return; }
     if (!validateDocument(document)) { toast.error("CPF ou CNPJ inválido."); return; }
    setSavingPersonal(true);
    try {
       const { error } = await supabase.from("profiles").upsert({
         user_id: user!.id,
         full_name: fullName.trim(),
         document: sanitizeDocument(document),
       } as any, { onConflict: "user_id" });
      if (error) throw error;
      toast.success("Dados pessoais salvos!");
      queryClient.invalidateQueries({ queryKey: ["my-profile", user?.id] });
    } catch (err: any) { toast.error(err.message || "Erro ao salvar."); } finally { setSavingPersonal(false); }
  };

  const copyPixKey = () => { if (pixKey) { navigator.clipboard.writeText(pixKey); toast.success("Chave PIX copiada!"); } };

  const handleSavePin = async () => {
    if (!/^\d{4}$/.test(pinValue)) { toast.error("O PIN deve ter 4 dígitos."); return; }
    if (pinValue !== pinConfirm) { toast.error("Os PINs não coincidem."); return; }
    setSavingPin(true);
    try {
      const { error } = await supabase.from("profiles").update({ delivery_pin: pinValue } as any).eq("user_id", user!.id);
      if (error) throw error;
      toast.success("PIN atualizado! Será usado em todas as próximas entregas.");
      setShowPinEdit(false); setPinValue(""); setPinConfirm("");
      queryClient.invalidateQueries({ queryKey: ["my-profile", user?.id] });
    } catch (err: any) { toast.error(err.message || "Erro ao salvar PIN."); }
    finally { setSavingPin(false); }
  };

  const handleEnableNotifications = async () => {
    if (typeof Notification === "undefined") { toast.error("Este dispositivo não suporta notificações."); return; }
    try {
      const perm = await Notification.requestPermission();
      setNotifStatus(perm);
      if (perm === "granted") {
        toast.success("Notificações ativadas!");
        new Notification("ItaSuper", { body: "Notificações funcionando ✅", icon: "/logo-itasuper-128.webp" });
      } else if (perm === "denied") {
        toast.error("Permissão negada. Ative nas configurações do navegador.");
      }
    } catch { toast.error("Erro ao ativar notificações."); }
  };

  const handleShareApp = async () => {
    const url = "https://itasuper.com.br";
    const shareData = { title: "ItaSuper", text: "Peça no ItaSuper — delivery rápido e sem taxas absurdas.", url };
    try {
      if (navigator.share) { await navigator.share(shareData); }
      else { await navigator.clipboard.writeText(url); toast.success("Link copiado!"); }
    } catch {}
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada");
      const response = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ reason: deleteReason || "Solicitação do usuário" }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Erro ao excluir conta");
      toast.success("Conta excluída com sucesso.");
      await signOut();
      navigate("/");
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir conta");
    } finally {
      setDeletingAccount(false);
    }
  };

  /* ── Not logged in ── */
   if (loadingOrders) {
     return (
       <div className="min-h-screen bg-background pb-32">
         <div className="bg-primary/5 pt-12 pb-8 px-6 space-y-4">
           <div className="w-20 h-20 rounded-3xl bg-muted animate-pulse mx-auto" />
           <div className="h-6 w-40 bg-muted animate-pulse mx-auto rounded" />
           <div className="h-4 w-60 bg-muted animate-pulse mx-auto rounded" />
         </div>
         <div className="px-4 -mt-6 space-y-4">
           {[1, 2, 3].map(i => (
             <div key={i} className="h-16 w-full bg-card animate-pulse rounded-2xl border border-border" />
           ))}
         </div>
         <BottomNav />
       </div>
     );
   }

   if (!user) {
    return (
      <div className="min-h-screen bg-background pb-32 overflow-y-auto">
        <div className="flex flex-col items-center justify-center py-24 text-center px-6">
          <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mb-6">
            <User className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Entre na sua conta</h2>
          <p className="text-sm text-muted-foreground max-w-[260px]">Faça login para acompanhar seus pedidos e gerenciar seu perfil.</p>
          <button onClick={() => navigate("/auth")} className="mt-8 bg-primary text-primary-foreground font-bold px-10 py-3.5 rounded-2xl text-sm active:scale-[0.98] transition-transform shadow-lg shadow-primary/25">
            Entrar / Cadastrar
          </button>
        </div>
        <BottomNav />
      </div>
    );
  }

  /* ── Derived values ── */
  const profileRole = (profile as any)?.role;
  const isApproved = (profile as any)?.is_approved;
  const userName = (profile as any)?.full_name || user.email?.split("@")[0] || "Usuário";
  const userInitials = userName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
  const roleLabel = profileRole === "lojista" ? "Lojista" : profileRole === "motoboy" ? "Entregador" : "Cliente";
  const hasAddress = !!(street && number && neighborhood);
  const hasPix = !!(pixKey && pixType);
  const currentPin = (profile as any)?.delivery_pin as string | undefined;
  const hasPin = !!currentPin && /^\d{4}$/.test(currentPin);
  const isClient = !profileRole || profileRole === "cliente";

  return (
    <div className="min-h-screen bg-background pb-32 overflow-y-auto">
      {/* ── Hero Header ── */}
      <div className="relative bg-gradient-to-br from-primary via-primary to-primary/80 pt-10 pb-14 px-5 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full" />
        <div className="absolute -bottom-6 -left-6 w-28 h-28 bg-white/5 rounded-full" />
        <div className="relative z-10 flex items-center gap-4">
          <Avatar className="h-18 w-18 border-3 border-white/30 shadow-lg">
            <AvatarFallback className="bg-white/20 text-white font-bold text-xl backdrop-blur-sm h-[72px] w-[72px]">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-white truncate">{userName}</h1>
            <p className="text-xs text-white/70 truncate">{user.email}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 text-white px-2.5 py-1 rounded-full backdrop-blur-sm">
                {roleLabel}
              </span>
              {orderCount !== undefined && orderCount > 0 && (
                <span className="text-[10px] font-medium text-white/80 flex items-center gap-1">
                  <Package className="h-3 w-3" /> {orderCount} pedido{orderCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="px-4 -mt-6 space-y-3 relative z-10">

        {/* PWA Install */}
        {showInstallButton && !isInstalled && (
          <button onClick={handleInstallClick}
            className="w-full bg-card text-foreground font-bold py-3.5 rounded-2xl flex items-center justify-center gap-3 text-sm active:scale-[0.98] transition-transform shadow-md border border-border">
            <Download className="h-5 w-5 text-primary" />
            📲 Instalar Aplicativo
          </button>
        )}

        {/* iOS Install Modal */}
        {showIOSModal && (
          <div className="fixed inset-0 z-[100] bg-black/60 flex items-end justify-center" onClick={() => setShowIOSModal(false)}>
            <div className="bg-card w-full max-w-md rounded-t-3xl p-6 space-y-4 animate-in slide-in-from-bottom-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-foreground">Instalar no iPhone</h3>
                <button onClick={() => setShowIOSModal(false)} className="text-muted-foreground"><X className="h-5 w-5" /></button>
              </div>
              <div className="space-y-3">
                {[
                  { step: "1", title: "Toque no botão Compartilhar", desc: <span className="flex items-center gap-1">Ícone <Share2 className="h-3.5 w-3.5 inline" /> na barra do Safari</span> },
                  { step: "2", title: 'Role e toque em:', desc: <>"<strong>Adicionar à Tela de Início</strong>"</> },
                  { step: "3", title: 'Toque em "Adicionar"', desc: "Pronto! O app aparecerá na sua tela inicial" },
                ].map((item) => (
                  <div key={item.step} className="flex items-start gap-3 bg-muted/50 rounded-xl p-3">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm font-bold text-primary">{item.step}</div>
                    <div>
                      <p className="text-sm font-bold text-foreground">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => setShowIOSModal(false)} className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl text-sm">Entendi!</button>
            </div>
          </div>
        )}

        {/* Pending approval */}
        {(profileRole === "lojista" || profileRole === "motoboy") && !isApproved && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-700 dark:text-amber-400">Cadastro em Análise</p>
              <p className="text-xs text-muted-foreground">Aguarde a aprovação do administrador para começar.</p>
            </div>
          </div>
        )}

        {/* ── Quick Actions ── */}
        <Card>
          <div className="px-4 pt-3.5 pb-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Acesso Rápido</p>
          </div>
          <div className="divide-y divide-border/50">
            <MenuRow icon={Package} title="Meus Pedidos" subtitle="Acompanhe seus pedidos" onClick={() => navigate("/pedidos")} />
            {myStore && <MenuRow icon={Store} title="Painel da Loja" subtitle={myStore.name} onClick={() => navigate("/admin")} />}
            {myDriver && <MenuRow icon={Bike} title="Painel do Entregador" subtitle="Gerenciar entregas" onClick={() => navigate("/entregador")} />}
            {isModerator && <MenuRow icon={Users} iconBg="bg-purple-500/10" iconColor="text-purple-600" title="Painel do Moderador" subtitle="Indicações e ganhos" onClick={() => navigate("/moderador")} />}
            {isAdminUser && <MenuRow icon={Shield} iconBg="bg-amber-500/10" iconColor="text-amber-600" title="Painel Administrativo" subtitle="Gerenciar plataforma" onClick={() => navigate("/super-admin")} />}
          </div>
        </Card>

        {/* ── Meus Dados (collapsible sections) ── */}
        <div className="pt-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1 mb-2">Meus Dados</p>
        </div>

        {/* Personal Data */}
        <Card>
          <button onClick={() => setActiveSection(activeSection === "personal" ? null : "personal")}
            className="w-full flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-muted/50">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <User className="h-[18px] w-[18px] text-primary" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground">Dados Pessoais</p>
                <StatusBadge done={!!fullName} label={fullName ? "OK" : "Pendente"} />
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {fullName || "Toque para cadastrar seu nome"}
              </p>
            </div>
            <ChevronRight className={`h-4 w-4 text-muted-foreground/40 transition-transform duration-200 ${activeSection === "personal" ? "rotate-90" : ""}`} />
          </button>

          {activeSection === "personal" && (
            <div className="px-4 pb-5 space-y-3 border-t border-border/50 pt-4 animate-in slide-in-from-top-2 duration-200">
               <InputField label="Nome completo" placeholder="Digite seu nome completo" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                <div>
                  <InputField label="CPF ou CNPJ *" placeholder="CPF ou CNPJ (obrigatório)" value={formatDocument(document)} onChange={(e) => setDocument(formatDocument(e.target.value))} inputMode="numeric" maxLength={18} />
                  {!document.trim() && (
                    <p className="text-[11px] text-destructive mt-1 font-medium">
                      ⚠️ Obrigatório — sem CPF/CNPJ não é possível gerar as cobranças mensais do seu plano.
                    </p>
                  )}
                </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">E-mail</label>
                <input value={user?.email || ""} disabled
                  className="w-full px-4 py-3 rounded-xl border border-border bg-muted text-muted-foreground text-sm cursor-not-allowed" />
                <p className="text-[10px] text-muted-foreground mt-1">O e-mail não pode ser alterado.</p>
              </div>
              <button onClick={handleSavePersonal} disabled={savingPersonal}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 transition-all active:scale-[0.98] shadow-sm">
                {savingPersonal ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {savingPersonal ? "Salvando..." : "Salvar Dados Pessoais"}
              </button>
            </div>
          )}
        </Card>

        {/* Address */}
        <Card>
          <button onClick={() => setActiveSection(activeSection === "address" ? null : "address")}
            className="w-full flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-muted/50">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <MapPin className="h-[18px] w-[18px] text-primary" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground">Endereço de Entrega</p>
                <StatusBadge done={hasAddress} label={hasAddress ? "OK" : "Pendente"} />
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {hasAddress ? `${street}, ${number} – ${neighborhood}` : "Toque para cadastrar seu endereço"}
              </p>
            </div>
            <ChevronRight className={`h-4 w-4 text-muted-foreground/40 transition-transform duration-200 ${activeSection === "address" ? "rotate-90" : ""}`} />
          </button>

          {activeSection === "address" && (
            <div className="px-4 pb-5 space-y-3 border-t border-border/50 pt-4 animate-in slide-in-from-top-2 duration-200">
              <div className="flex gap-2">
                <div className="flex-1">
                  <InputField label="CEP" placeholder="18690-000" value={cep} onChange={(e) => handleCepChange(e.target.value)} inputMode="numeric" maxLength={9} />
                </div>
                <div className="pt-[22px]">
                  <button onClick={() => handleCepLookup()} disabled={loadingCep}
                    className="h-[46px] px-4 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50 flex items-center gap-1.5 shrink-0">
                    {loadingCep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    Buscar
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2"><InputField label="Rua" placeholder="Nome da rua" value={street} onChange={(e) => setStreet(e.target.value)} autoComplete="street-address" /></div>
                <InputField label="Nº" placeholder="000" value={number} onChange={(e) => setNumber(e.target.value)} inputMode="numeric" />
              </div>
              <InputField label="Complemento" placeholder="Apto, bloco, casa..." value={complement} onChange={(e) => setComplement(e.target.value)} />
              <InputField label="Bairro" placeholder="Preenchido pelo CEP" value={neighborhood} onChange={(e) => setNeighborhoodLocal(e.target.value)} />

              {calculatedFee !== null && (
                <div className="flex items-center gap-2.5 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
                  <Truck className="h-4 w-4 text-primary shrink-0" />
                  <div>
                    <span className="text-sm font-bold text-primary">Taxa estimada: R$ {calculatedFee.toFixed(2)}</span>
                    {feeBreakdown && <p className="text-[10px] text-muted-foreground">{feeBreakdown}</p>}
                  </div>
                </div>
              )}

              <InputField label="Ponto de referência" placeholder="Próximo ao mercado, escola..." value={referencePoint} onChange={(e) => setReferencePoint(e.target.value)} />
              <InputField 
                label="Telefone" 
                placeholder="(14) 99999-9999" 
                value={phone} 
                onChange={(e) => setPhone(maskWhatsApp(e.target.value))} 
                inputMode="tel" 
                type="tel" 
                autoComplete="tel" 
              />

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5 text-green-500" /> WhatsApp (com DDD)
                </label>
                <input type="tel" placeholder="(14) 99999-9999" value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(maskWhatsApp(e.target.value))} inputMode="tel"
                  className="w-full px-4 py-3 rounded-xl border border-green-500/30 bg-background text-foreground placeholder:text-muted-foreground/60 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all" />
              </div>

              <button onClick={handleSaveAddress} disabled={savingAddress}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 transition-all active:scale-[0.98] shadow-sm">
                {savingAddress ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {savingAddress ? "Salvando..." : "Salvar Endereço"}
              </button>
            </div>
          )}
        </Card>

        {/* PIX Section */}
        {(profileRole === "lojista" || profileRole === "motoboy") && (
          <Card>
            <button onClick={() => setActiveSection(activeSection === "pix" ? null : "pix")}
              className="w-full flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-muted/50">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Wallet className="h-[18px] w-[18px] text-primary" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">Dados PIX</p>
                  <StatusBadge done={hasPix} label={hasPix ? "OK" : "Obrigatório"} />
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {hasPix ? `${pixType.toUpperCase()} • ${pixKey.slice(0, 16)}...` : "Cadastre para receber pagamentos"}
                </p>
              </div>
              <ChevronRight className={`h-4 w-4 text-muted-foreground/40 transition-transform duration-200 ${activeSection === "pix" ? "rotate-90" : ""}`} />
            </button>

            {activeSection === "pix" && (
              <div className="px-4 pb-5 space-y-3 border-t border-border/50 pt-4 animate-in slide-in-from-top-2 duration-200">
                {!hasPix && (
                  <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-3.5 flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                    <p className="text-xs text-destructive font-bold">Cadastre sua chave PIX para receber pagamentos!</p>
                  </div>
                )}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Tipo da Chave</label>
                  <select value={pixType} onChange={(e) => setPixType(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none transition-all">
                    <option value="">Selecione o tipo</option>
                    <option value="cpf">CPF</option>
                    <option value="cnpj">CNPJ</option>
                    <option value="email">E-mail</option>
                    <option value="phone">Telefone</option>
                    <option value="random">Chave Aleatória</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <InputField
                      label="Chave PIX"
                      placeholder={PIX_PLACEHOLDERS[pixType] || "Sua chave PIX"}
                      value={pixType ? formatPixKeyDisplay(pixKey, pixType) : pixKey}
                      onChange={(e) => setPixKey(e.target.value)}
                    />
                  </div>
                  {pixKey && (
                    <div className="pt-[22px]">
                      <button onClick={copyPixKey} className="h-[46px] px-3.5 rounded-xl border border-border bg-background text-muted-foreground hover:text-foreground shrink-0 flex items-center">
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
                <button onClick={handleSavePix} disabled={savingPix}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 transition-all active:scale-[0.98] shadow-sm">
                  {savingPix ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {savingPix ? "Salvando..." : "Salvar Chave PIX"}
                </button>
              </div>
            )}
          </Card>
        )}

        {/* PIN de Entrega — só clientes */}
        {isClient && (
          <Card>
            <div className="w-full flex items-center gap-3.5 px-4 py-3.5">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <KeyRound className="h-[18px] w-[18px] text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">PIN de Entrega</p>
                  <StatusBadge done={hasPin} label={hasPin ? "OK" : "Pendente"} />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {hasPin ? "•• •• (código exigido pelo entregador)" : "Defina um PIN de 4 dígitos"}
                </p>
              </div>
              <button onClick={() => setShowPinEdit(true)} className="text-xs font-bold text-primary px-3 py-2 rounded-lg hover:bg-primary/5">
                {hasPin ? "Alterar" : "Definir"}
              </button>
            </div>
          </Card>
        )}

        {/* ── Preferências ── */}
        <div className="pt-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1 mb-2">Preferências</p>
        </div>
        <Card>
          <div className="divide-y divide-border/50">
            <div className="flex items-center gap-3.5 px-4 py-3.5">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Moon className="h-[18px] w-[18px] text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Tema</p>
                <p className="text-xs text-muted-foreground mt-0.5">Alternar entre claro e escuro</p>
              </div>
              <ThemeToggle />
            </div>
            <MenuRow
              icon={Bell}
              title="Notificações"
              subtitle={
                notifStatus === "granted" ? "Ativadas neste dispositivo"
                : notifStatus === "denied" ? "Bloqueadas — ative nas config. do navegador"
                : notifStatus === "unsupported" ? "Não suportado neste dispositivo"
                : "Toque para ativar alertas de pedido"
              }
              onClick={handleEnableNotifications}
              trailing={
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${notifStatus === "granted" ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"}`}>
                  {notifStatus === "granted" ? "ATIVO" : "ATIVAR"}
                </span>
              }
            />
          </div>
        </Card>

        {/* ── Ajuda & Suporte ── */}
        <div className="pt-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1 mb-2">Ajuda & Suporte</p>
        </div>
        <Card>
          <div className="divide-y divide-border/50">
            <MenuRow
              icon={MessageCircle}
              iconBg="bg-green-500/10"
              iconColor="text-green-600"
              title="Falar com o Suporte"
              subtitle="WhatsApp — resposta em minutos"
              onClick={() => window.open(`https://wa.me/5522992796291?text=${encodeURIComponent(`Olá! Sou ${userName} (${user.email}) e preciso de ajuda no ItaSuper.`)}`, "_blank")}
            />
            <MenuRow
              icon={HelpCircle}
              title="Ver tutorial novamente"
              subtitle="Reveja o guia de uso do app"
              onClick={async () => {
                if (user) {
                  await supabase.from("profiles").update({ has_seen_onboarding: false } as any).eq("user_id", user.id);
                  toast.success("Tutorial será exibido ao voltar à tela inicial!");
                  queryClient.invalidateQueries({ queryKey: ["my-profile", user.id] });
                }
              }}
            />
            <MenuRow
              icon={AlertTriangle}
              iconBg="bg-amber-500/10"
              iconColor="text-amber-600"
              title="Reportar um problema"
              subtitle="Envie um relato via WhatsApp"
              onClick={() => window.open(`https://wa.me/5522992796291?text=${encodeURIComponent(`[BUG] ItaSuper v${appVersion}\nUsuário: ${userName}\nE-mail: ${user.email}\n\nDescreva o problema:`)}`, "_blank")}
            />
          </div>
        </Card>

        {/* ── Sobre o App ── */}
        <div className="pt-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1 mb-2">Sobre o ItaSuper</p>
        </div>
        <Card>
          <div className="divide-y divide-border/50">
            <MenuRow icon={Share2} title="Compartilhar o app" subtitle="Convide amigos e lojas" onClick={handleShareApp} />
            <MenuRow icon={Newspaper} title="Blog & Novidades" subtitle="Dicas, atualizações e cases" onClick={() => navigate("/blog")} />
            {!isCapacitorNative() && (
              <MenuRow icon={Smartphone} title="Baixar aplicativo" subtitle="APK Android oficial" onClick={() => navigate("/download")} />
            )}
            {isClient && !myStore && !myDriver && (
              <MenuRow
                icon={UserPlus}
                iconBg="bg-amber-500/10"
                iconColor="text-amber-600"
                title="Seja um Parceiro"
                subtitle="Cadastre sua loja gratuitamente"
                onClick={() => navigate("/cadastro-lojista")}
              />
            )}
            {(profileRole === "lojista" || myStore) && (
              <MenuRow icon={Sparkles} title="Ver Planos" subtitle="Compare os planos disponíveis" onClick={() => navigate("/planos")} />
            )}
          </div>
        </Card>

        {/* ── Zona de Perigo ── */}
        <div className="pt-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 px-1 mb-2">Conta</p>
        </div>

        <Card>
          <div className="divide-y divide-border/50">
            <MenuRow icon={LogOut} iconBg="bg-destructive/5" iconColor="text-destructive" title="Sair da conta" subtitle="Fazer logout do ItaSuper" onClick={() => setShowSignOutConfirm(true)} danger />
            <MenuRow icon={Trash2} iconBg="bg-destructive/5" iconColor="text-destructive" title="Excluir minha conta" subtitle="Seus dados serão mantidos conforme a lei" onClick={() => setShowDeleteConfirm(true)} danger />
          </div>
        </Card>

        <SignOutConfirm
          hideTrigger
          open={showSignOutConfirm}
          onOpenChange={setShowSignOutConfirm}
        />

        {/* PIN edit modal */}
        {showPinEdit && (
          <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4" onClick={() => !savingPin && setShowPinEdit(false)}>
            <div className="bg-card w-full max-w-sm rounded-2xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <KeyRound className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">{hasPin ? "Alterar PIN" : "Definir PIN"}</h3>
                  <p className="text-xs text-muted-foreground">Usado pelo entregador em todas as entregas</p>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Novo PIN (4 dígitos)</label>
                <input inputMode="numeric" autoFocus value={pinValue}
                  onChange={(e) => setPinValue(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="0000"
                  className="w-full h-12 px-4 rounded-xl border border-border bg-background text-center text-2xl tracking-[0.5em] font-bold focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Confirmar PIN</label>
                <input inputMode="numeric" value={pinConfirm}
                  onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="0000"
                  className="w-full h-12 px-4 rounded-xl border border-border bg-background text-center text-2xl tracking-[0.5em] font-bold focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <button onClick={handleSavePin} disabled={savingPin}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50">
                {savingPin ? "Salvando..." : "Salvar PIN"}
              </button>
              <button onClick={() => setShowPinEdit(false)} disabled={savingPin}
                className="w-full py-3 rounded-xl border border-border text-muted-foreground font-bold text-sm disabled:opacity-50">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Delete account confirmation modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4" onClick={() => !deletingAccount && setShowDeleteConfirm(false)}>
            <div className="bg-card w-full max-w-md rounded-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
              {deleteStep === 0 && (
                <>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                      <AlertTriangle className="h-6 w-6 text-destructive" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-foreground">Excluir Conta</h3>
                      <p className="text-xs text-muted-foreground">Esta ação não pode ser desfeita</p>
                    </div>
                  </div>
                  <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-3.5 space-y-2 text-xs text-muted-foreground">
                    <p className="font-bold text-destructive text-sm">O que acontece ao excluir:</p>
                    <p>• Seus dados pessoais serão removidos</p>
                    <p>• Endereços e tokens de notificação apagados</p>
                    <p>• Você não poderá mais acessar sua conta</p>
                    <p className="font-bold text-foreground mt-2">Dados retidos por lei (LGPD/CTN):</p>
                    <p>• Histórico de pedidos: 5 anos</p>
                    <p>• Dados financeiros: 5 anos</p>
                    <p>• Aceites de termos: mantidos como prova legal</p>
                  </div>
                  <button onClick={() => setDeleteStep(1)}
                    className="w-full py-3.5 rounded-xl bg-destructive text-destructive-foreground font-bold text-sm">
                    Entendo, quero continuar
                  </button>
                  <button onClick={() => setShowDeleteConfirm(false)}
                    className="w-full py-3 rounded-xl border border-border text-muted-foreground font-bold text-sm">
                    Cancelar
                  </button>
                </>
              )}
              {deleteStep === 1 && (
                <>
                  <h3 className="text-lg font-bold text-foreground">Confirmar Exclusão</h3>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Motivo (opcional)</label>
                    <textarea value={deleteReason} onChange={e => setDeleteReason(e.target.value)}
                      placeholder="Por que deseja excluir sua conta?"
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-destructive/50 resize-none h-20" />
                  </div>
                  <p className="text-xs text-destructive font-bold text-center">
                    Digite "EXCLUIR" para confirmar
                  </p>
                  <input type="text" placeholder='Digite "EXCLUIR"'
                    className="w-full px-4 py-3 rounded-xl border border-destructive/50 bg-background text-foreground text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-destructive/50"
                    onChange={e => { if (e.target.value.toUpperCase() === "EXCLUIR") handleDeleteAccount(); }}
                    disabled={deletingAccount} />
                  {deletingAccount && (
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Excluindo conta...
                    </div>
                  )}
                  <button onClick={() => { setDeleteStep(0); setShowDeleteConfirm(false); }}
                    disabled={deletingAccount}
                    className="w-full py-3 rounded-xl border border-border text-muted-foreground font-bold text-sm disabled:opacity-50">
                    Cancelar
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Legal links */}
        <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground pt-2">
          <a href="/termos-de-uso" className="hover:underline">Termos de Uso</a>
          <span>•</span>
          <a href="/politica-de-privacidade" className="hover:underline">Política de Privacidade</a>
        </div>

        <div className="flex flex-col items-center gap-1 pb-4">
          <p className="text-center text-[10px] text-muted-foreground/50">{`ItaSuper v${appVersion}`}</p>
          <button
            onClick={handleSentryTest}
            className="text-[10px] text-muted-foreground/40 underline"
          >
            Testar Sentry
          </button>
          {isCapacitorNative() && (
            <button 
              onClick={async () => {
                toast.promise(
                  Promise.all([
                    forceCheckForOtaUpdate(),
                    checkAppVersion((import.meta.env.VITE_CAPACITOR_APP_MODE || "cliente") as "cliente" | "parceiro")
                  ]),
                  {
                    loading: 'Verificando atualizações...',
                    success: 'Verificação concluída — reabra o app se houver atualização',
                    error: 'Erro ao verificar atualizações'
                  }
                );
              }}
              className="text-[10px] font-bold text-primary hover:underline"
            >
              Verificar atualizações
            </button>
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

export default PerfilPage;
