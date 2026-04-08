import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  User, LogOut, Store, Shield, UserPlus, MapPin, Save, Bike, Wallet, Copy,
  AlertTriangle, MessageCircle, Truck, Download, Smartphone, X, Share2,
  Search, Loader2, ChevronRight, Phone, Mail, CreditCard, Package, Settings, HelpCircle, Trash2
} from "lucide-react";
import { toast } from "sonner";
import { maskWhatsApp, formatWhatsAppNumber, isValidWhatsApp } from "@/lib/whatsapp";
import { formatCep, fetchCep } from "@/lib/cepLookup";
import { calculateDeliveryFee, DEFAULT_DELIVERY_FEE_CONFIG, type DeliveryFeeConfig } from "@/lib/deliveryFee";

const SectionCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-card rounded-2xl border border-border overflow-hidden ${className}`}>
    {children}
  </div>
);

const SectionHeader = ({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle?: string }) => (
  <div className="flex items-center gap-3 px-5 pt-5 pb-3">
    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
      <Icon className="h-4.5 w-4.5 text-primary" />
    </div>
    <div>
      <h3 className="text-sm font-bold text-foreground">{title}</h3>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  </div>
);

const InputField = ({ label, ...props }: { label?: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
  <div>
    {label && <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</label>}
    <input
      {...props}
      className={`w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all ${props.className || ""}`}
    />
  </div>
);

const PerfilPage = () => {
  const { user, signOut } = useAuth();
  const { setNeighborhood } = useCart();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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

  const { data: deliveryFeeConfig } = useQuery({
    queryKey: ["delivery-fee-config"],
    queryFn: async () => {
      const { data } = await supabase.from("admin_settings").select("value").eq("key", "delivery_fee_config").maybeSingle();
      return data?.value ? (data.value as unknown as DeliveryFeeConfig) : DEFAULT_DELIVERY_FEE_CONFIG;
    },
  });

  const { data: orderCount } = useQuery({
    queryKey: ["my-order-count", user?.id],
    queryFn: async () => {
      const { count } = await supabase.from("orders").select("id", { count: "exact", head: true }).eq("client_id", user!.id);
      return count || 0;
    },
    enabled: !!user,
  });

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

  // PWA Install state
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
    // Hide install button inside GoNative native app
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

  const handleSignOut = async () => { await signOut(); toast.success("Você saiu da conta."); navigate("/"); };

  const handleSaveAddress = async () => {
    if (!street.trim() || !number.trim() || !neighborhood) { toast.error("Preencha rua, número e bairro."); return; }
    setSavingAddress(true);
    try {
      const { error } = await supabase.from("profiles").upsert({
        user_id: user!.id, cep: cep.replace(/\D/g, "") || null, street: street.trim(),
        number: number.trim(), complement: complement.trim(), reference_point: referencePoint.trim(),
        neighborhood, phone: phone.trim(),
        whatsapp_number: isValidWhatsApp(whatsappNumber) ? formatWhatsAppNumber(whatsappNumber) : null,
      } as any, { onConflict: "user_id" });
      if (error) throw error;
      if (neighborhood && calculatedFee !== null) setNeighborhood(neighborhood, calculatedFee);
      toast.success("Endereço salvo!");
      queryClient.invalidateQueries({ queryKey: ["my-profile", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["my-profile-checkout", user?.id] });
    } catch (err: any) { toast.error(err.message || "Erro ao salvar."); } finally { setSavingAddress(false); }
  };

  const handleSavePix = async () => {
    if (!pixKey.trim() || !pixType) { toast.error("Preencha o tipo e a chave PIX."); return; }
    setSavingPix(true);
    try {
      const { error } = await supabase.from("profiles").upsert({
        user_id: user!.id, pix_key: pixKey.trim(), pix_type: pixType,
      } as any, { onConflict: "user_id" });
      if (error) throw error;
      toast.success("Chave PIX salva!");
      queryClient.invalidateQueries({ queryKey: ["my-profile", user?.id] });
    } catch (err: any) { toast.error(err.message || "Erro ao salvar."); } finally { setSavingPix(false); }
  };

  const maskCpf = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const handleSavePersonal = async () => {
    if (!fullName.trim()) { toast.error("Preencha seu nome."); return; }
    setSavingPersonal(true);
    try {
      const { error } = await supabase.from("profiles").upsert({
        user_id: user!.id,
        full_name: fullName.trim(),
        document: document.replace(/\D/g, "") || null,
      } as any, { onConflict: "user_id" });
      if (error) throw error;
      toast.success("Dados pessoais salvos!");
      queryClient.invalidateQueries({ queryKey: ["my-profile", user?.id] });
    } catch (err: any) { toast.error(err.message || "Erro ao salvar."); } finally { setSavingPersonal(false); }
  };

  const copyPixKey = () => { if (pixKey) { navigator.clipboard.writeText(pixKey); toast.success("Chave PIX copiada!"); } };



  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada");
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
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

  if (!user) {
    return (
      <div className="min-h-screen bg-background pb-32 overflow-y-auto">
        <div className="flex flex-col items-center justify-center py-24 text-center px-6">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <User className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Entre na sua conta</h2>
          <p className="text-sm text-muted-foreground max-w-[260px]">Faça login para acompanhar seus pedidos e gerenciar seu perfil.</p>
          <button onClick={() => navigate("/auth")} className="mt-8 bg-primary text-primary-foreground font-bold px-10 py-3.5 rounded-2xl text-sm">
            Entrar / Cadastrar
          </button>
        </div>
        <BottomNav />
      </div>
    );
  }

  const profileRole = (profile as any)?.role;
  const isApproved = (profile as any)?.is_approved;
  const userName = (profile as any)?.full_name || user.email?.split("@")[0] || "Usuário";
  const userInitials = userName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
  const roleLabel = profileRole === "lojista" ? "Lojista" : profileRole === "motoboy" ? "Entregador" : "Cliente";
  const hasAddress = !!(street && number && neighborhood);
  const hasPix = !!(pixKey && pixType);

  return (
    <div className="min-h-screen bg-background pb-32 overflow-y-auto">
      {/* Hero header */}
      <div className="bg-gradient-to-b from-primary/10 to-background px-5 pt-8 pb-6">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border-2 border-primary/20">
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-foreground truncate">{userName}</h1>
            <p className="text-xs text-muted-foreground">{user.email}</p>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider bg-primary/10 text-primary px-2.5 py-0.5 rounded-full">
                {roleLabel}
              </span>
              {orderCount !== undefined && orderCount > 0 && (
                <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                  <Package className="h-3 w-3" /> {orderCount} pedido{orderCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 space-y-3 -mt-1">

        {/* PWA Install */}
        {showInstallButton && !isInstalled && (
          <button onClick={handleInstallClick}
            className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-2xl flex items-center justify-center gap-3 text-sm active:scale-[0.98] transition-transform shadow-sm">
            <Download className="h-5 w-5" />
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
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-yellow-600">Cadastro em Análise</p>
              <p className="text-xs text-muted-foreground">Aguarde a aprovação do administrador.</p>
            </div>
          </div>
        )}

        {/* Quick actions */}
        <SectionCard>
          <div className="divide-y divide-border">
            {myStore && (
              <button onClick={() => navigate("/admin")} className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/50 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center"><Store className="h-4 w-4 text-primary" /></div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-foreground">Painel da Loja</p>
                  <p className="text-xs text-muted-foreground">{myStore.name}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
            {myDriver && (
              <button onClick={() => navigate("/entregador")} className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/50 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center"><Bike className="h-4 w-4 text-primary" /></div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-foreground">Painel do Entregador</p>
                  <p className="text-xs text-muted-foreground">Gerenciar entregas</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
            {isAdminUser && (
              <button onClick={() => navigate("/super-admin")} className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/50 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-yellow-500/10 flex items-center justify-center"><Shield className="h-4 w-4 text-yellow-600" /></div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-foreground">Painel Administrativo</p>
                  <p className="text-xs text-muted-foreground">Gerenciar plataforma</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
            <button onClick={() => navigate("/pedidos")} className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/50 transition-colors">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center"><Package className="h-4 w-4 text-primary" /></div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-foreground">Meus Pedidos</p>
                <p className="text-xs text-muted-foreground">Acompanhe seus pedidos</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </SectionCard>

        {/* Personal data section */}
        <SectionCard>
          <button onClick={() => setActiveSection(activeSection === "personal" ? null : "personal")}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-foreground">Dados Pessoais</p>
                <p className="text-xs text-muted-foreground">
                  {fullName || "Nome não cadastrado"}{document ? ` • CPF: ***${document.replace(/\D/g, "").slice(-4)}` : ""}
                </p>
              </div>
            </div>
            <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${activeSection === "personal" ? "rotate-90" : ""}`} />
          </button>

          {activeSection === "personal" && (
            <div className="px-5 pb-5 space-y-3 border-t border-border pt-4">
              <InputField label="Nome completo" placeholder="Seu nome" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              <InputField label="CPF" placeholder="000.000.000-00" value={maskCpf(document)} onChange={(e) => setDocument(e.target.value.replace(/\D/g, ""))} inputMode="numeric" maxLength={14} />
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">E-mail</label>
                <input
                  value={user?.email || ""}
                  disabled
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-muted text-muted-foreground text-sm cursor-not-allowed"
                />
                <p className="text-[10px] text-muted-foreground mt-1">O e-mail não pode ser alterado.</p>
              </div>
              <button onClick={handleSavePersonal} disabled={savingPersonal}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 transition-all active:scale-[0.98]">
                <Save className="h-4 w-4" />
                {savingPersonal ? "Salvando..." : "Salvar Dados"}
              </button>
            </div>
          )}
        </SectionCard>

        {/* Address section - collapsible */}
        <SectionCard>
          <button onClick={() => setActiveSection(activeSection === "address" ? null : "address")}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <MapPin className="h-4 w-4 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-foreground">Endereço de Entrega</p>
                <p className="text-xs text-muted-foreground">
                  {hasAddress ? `${street}, ${number} – ${neighborhood}` : "Nenhum endereço cadastrado"}
                </p>
              </div>
            </div>
            <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${activeSection === "address" ? "rotate-90" : ""}`} />
          </button>

          {activeSection === "address" && (
            <div className="px-5 pb-5 space-y-3 border-t border-border pt-4">
              <div className="flex gap-2">
                <InputField placeholder="CEP (ex: 18690-000)" value={cep} onChange={(e) => handleCepChange(e.target.value)} inputMode="numeric" maxLength={9} />
                <button onClick={() => handleCepLookup()} disabled={loadingCep}
                  className="px-3.5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50 flex items-center gap-1 flex-shrink-0">
                  {loadingCep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2"><InputField placeholder="Rua" value={street} onChange={(e) => setStreet(e.target.value)} autoComplete="street-address" /></div>
                <InputField placeholder="Nº" value={number} onChange={(e) => setNumber(e.target.value)} inputMode="numeric" />
              </div>
              <InputField placeholder="Complemento (apto, bloco...)" value={complement} onChange={(e) => setComplement(e.target.value)} />
              <InputField label="Bairro (preenchido pelo CEP)" placeholder="Digite o CEP acima" value={neighborhood} onChange={(e) => setNeighborhoodLocal(e.target.value)} />

              {calculatedFee !== null && (
                <div className="flex flex-col gap-1 bg-primary/5 border border-primary/20 rounded-xl px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-primary" />
                    <span className="text-sm font-bold text-primary">Taxa: R$ {calculatedFee.toFixed(2)}</span>
                  </div>
                  {feeBreakdown && <span className="text-xs text-muted-foreground ml-6">{feeBreakdown}</span>}
                </div>
              )}

              <InputField placeholder="Ponto de referência" value={referencePoint} onChange={(e) => setReferencePoint(e.target.value)} />
              <InputField placeholder="Telefone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" type="tel" autoComplete="tel" />

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5 text-green-500" /> WhatsApp (com DDD)
                </label>
                <input type="tel" placeholder="+55 14 99999-9999" value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(maskWhatsApp(e.target.value))} inputMode="tel"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-green-500/30 bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all" />
              </div>

              <button onClick={handleSaveAddress} disabled={savingAddress}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 transition-all active:scale-[0.98]">
                <Save className="h-4 w-4" />
                {savingAddress ? "Salvando..." : "Salvar Endereço"}
              </button>
            </div>
          )}
        </SectionCard>

        {/* PIX Section */}
        {(profileRole === "lojista" || profileRole === "motoboy") && (
          <SectionCard>
            <button onClick={() => setActiveSection(activeSection === "pix" ? null : "pix")}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Wallet className="h-4 w-4 text-primary" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-foreground">Dados PIX</p>
                  <p className="text-xs text-muted-foreground">
                    {hasPix ? `${pixType.toUpperCase()} • ${pixKey.slice(0, 12)}...` : "Nenhuma chave cadastrada"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!hasPix && <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />}
                <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${activeSection === "pix" ? "rotate-90" : ""}`} />
              </div>
            </button>

            {activeSection === "pix" && (
              <div className="px-5 pb-5 space-y-3 border-t border-border pt-4">
                {!hasPix && (
                  <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
                    <p className="text-xs text-destructive font-bold">Cadastre sua chave PIX para receber pagamentos!</p>
                  </div>
                )}
                <select value={pixType} onChange={(e) => setPixType(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none transition-all">
                  <option value="">Tipo da Chave</option>
                  <option value="cpf">CPF</option>
                  <option value="cnpj">CNPJ</option>
                  <option value="email">E-mail</option>
                  <option value="phone">Telefone</option>
                  <option value="random">Chave Aleatória</option>
                </select>
                <div className="flex gap-2">
                  <InputField placeholder="Sua chave PIX" value={pixKey} onChange={(e) => setPixKey(e.target.value)} />
                  {pixKey && (
                    <button onClick={copyPixKey} className="px-3 py-2.5 rounded-xl border border-border bg-background text-muted-foreground hover:text-foreground flex-shrink-0">
                      <Copy className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <button onClick={handleSavePix} disabled={savingPix}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 transition-all active:scale-[0.98]">
                  <Save className="h-4 w-4" />
                  {savingPix ? "Salvando..." : "Salvar Chave PIX"}
                </button>
              </div>
            )}
          </SectionCard>
        )}

        {/* Become partner */}
        {!myStore && !myDriver && profileRole !== "lojista" && profileRole !== "motoboy" && (
          <button onClick={() => navigate("/parceiro")}
            className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <UserPlus className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-primary">Seja um Parceiro</p>
              <p className="text-xs text-muted-foreground">Cadastre sua loja ou seja entregador</p>
            </div>
            <ChevronRight className="h-4 w-4 text-primary" />
          </button>
        )}

        {/* Replay tutorial */}
        <button
          onClick={async () => {
            if (user) {
              await supabase.from("profiles").update({ has_seen_onboarding: false } as any).eq("user_id", user.id);
              toast.success("Tutorial será exibido ao voltar à tela inicial!");
              queryClient.invalidateQueries({ queryKey: ["my-profile", user.id] });
            }
          }}
          className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl border border-border bg-card hover:bg-accent transition-colors"
        >
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <HelpCircle className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-foreground">Ver tutorial novamente</p>
            <p className="text-xs text-muted-foreground">Reveja o guia de uso do app</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>

        {/* Delete account */}
        <SectionCard>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-destructive/5 transition-colors"
          >
            <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center">
              <Trash2 className="h-4 w-4 text-destructive" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-destructive">Excluir minha conta</p>
              <p className="text-xs text-muted-foreground">Seus dados serão mantidos conforme exigências legais</p>
            </div>
            <ChevronRight className="h-4 w-4 text-destructive" />
          </button>
        </SectionCard>

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
                  <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-3 space-y-2 text-xs text-muted-foreground">
                    <p className="font-bold text-destructive text-sm">O que acontece ao excluir:</p>
                    <p>• Seus dados pessoais serão removidos da plataforma</p>
                    <p>• Endereços salvos e tokens de notificação serão apagados</p>
                    <p>• Você não poderá mais acessar sua conta</p>
                    <p className="font-bold text-foreground mt-2">Dados retidos por lei (LGPD/CTN):</p>
                    <p>• Histórico de pedidos: 5 anos (fins fiscais)</p>
                    <p>• Dados financeiros: 5 anos (obrigações tributárias)</p>
                    <p>• Aceites de termos: mantidos como prova legal</p>
                  </div>
                  <button
                    onClick={() => setDeleteStep(1)}
                    className="w-full py-3 rounded-xl bg-destructive text-destructive-foreground font-bold text-sm"
                  >
                    Entendo, quero continuar
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="w-full py-3 rounded-xl border border-border text-muted-foreground font-bold text-sm"
                  >
                    Cancelar
                  </button>
                </>
              )}
              {deleteStep === 1 && (
                <>
                  <h3 className="text-lg font-bold text-foreground">Confirmar Exclusão</h3>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Motivo (opcional)</label>
                    <textarea
                      value={deleteReason}
                      onChange={e => setDeleteReason(e.target.value)}
                      placeholder="Por que deseja excluir sua conta?"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-destructive/50 resize-none h-20"
                    />
                  </div>
                  <p className="text-xs text-destructive font-bold text-center">
                    Digite "EXCLUIR" para confirmar
                  </p>
                  <input
                    type="text"
                    placeholder='Digite "EXCLUIR"'
                    className="w-full px-3.5 py-2.5 rounded-xl border border-destructive/50 bg-background text-foreground text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-destructive/50"
                    onChange={e => {
                      if (e.target.value.toUpperCase() === "EXCLUIR") {
                        handleDeleteAccount();
                      }
                    }}
                    disabled={deletingAccount}
                  />
                  {deletingAccount && (
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Excluindo conta...
                    </div>
                  )}
                  <button
                    onClick={() => { setDeleteStep(0); setShowDeleteConfirm(false); }}
                    disabled={deletingAccount}
                    className="w-full py-3 rounded-xl border border-border text-muted-foreground font-bold text-sm disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Sign out */}
        <button onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 p-3.5 rounded-2xl border border-destructive/20 bg-destructive/5 text-destructive font-semibold text-sm hover:bg-destructive/10 transition-colors">
          <LogOut className="h-4 w-4" />
          Sair da conta
        </button>

        {/* Legal links */}
        <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
          <a href="/termos-de-uso" className="hover:underline">Termos de Uso</a>
          <span>•</span>
          <a href="/politica-de-privacidade" className="hover:underline">Política de Privacidade</a>
        </div>

        <p className="text-center text-[10px] text-muted-foreground pb-4">ItaSuper v1.0</p>
      </div>
      <BottomNav />
    </div>
  );
};

export default PerfilPage;
