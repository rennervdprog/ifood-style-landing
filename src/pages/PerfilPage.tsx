import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase/client";
import BottomNav from "@/components/BottomNav";
import { User, LogOut, Store, Shield, UserPlus, MapPin, Save, Bike, Wallet, Copy, AlertTriangle, MessageCircle, Truck, Download, Smartphone, X, Share2, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { maskWhatsApp, formatWhatsAppNumber, isValidWhatsApp } from "@/lib/whatsapp";
import { formatCep, fetchCep } from "@/lib/cepLookup";
import { calculateDeliveryFee, DEFAULT_DELIVERY_FEE_CONFIG, type DeliveryFeeConfig } from "@/lib/deliveryFee";

const PerfilPage = () => {
  const { user, signOut } = useAuth();
  const { setNeighborhood } = useCart();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: myStore } = useQuery({
    queryKey: ["my-store", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("stores")
        .select("id, name")
        .eq("owner_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: isAdminUser } = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
    enabled: !!user,
  });

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: myDriver } = useQuery({
    queryKey: ["my-driver", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("drivers")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: deliveryFeeConfig } = useQuery({
    queryKey: ["delivery-fee-config"],
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_settings")
        .select("value")
        .eq("key", "delivery_fee_config")
        .maybeSingle();
      return data?.value ? (data.value as unknown as DeliveryFeeConfig) : DEFAULT_DELIVERY_FEE_CONFIG;
    },
  });

  const [calculatedFee, setCalculatedFee] = useState<number | null>(null);
  const [feeBreakdown, setFeeBreakdown] = useState<string>("");

  // Address form state
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

  // PIX form state
  const [pixKey, setPixKey] = useState("");
  const [pixType, setPixType] = useState("");
  const [savingPix, setSavingPix] = useState(false);
  const [pixLoaded, setPixLoaded] = useState(false);

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
    if (isStandalone) { setIsInstalled(true); return; }

    if (isIOS) {
      setShowInstallButton(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallButton(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const installedHandler = () => {
      setIsInstalled(true);
      setShowInstallButton(false);
    };
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, [isIOS, isStandalone]);

  const handleInstallClick = useCallback(async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowInstallButton(false);
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  }, [isIOS, deferredPrompt]);

  const handleCepChange = (value: string) => {
    const formatted = formatCep(value);
    setCep(formatted);
    const digits = value.replace(/\D/g, "");
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
      if (result.complemento) setComplement(result.complemento);
      if (result.bairro) {
        setNeighborhoodLocal(result.bairro);
      }
      toast.success("Endereço preenchido pelo CEP!");
    } catch {
      toast.error("Erro ao buscar CEP.");
    } finally {
      setLoadingCep(false);
    }
  };

  // Compute selected neighborhood fee
  const selectedFee = useMemo(() => {
    if (!neighborhood || !neighborhoods) return null;
    const found = neighborhoods.find((n) => n.name === neighborhood);
    return found ? found.fee : null;
  }, [neighborhood, neighborhoods]);

  const handleSignOut = async () => {
    await signOut();
    toast.success("Você saiu da conta.");
    navigate("/");
  };

  const handleSaveAddress = async () => {
    if (!street.trim() || !number.trim() || !neighborhood) {
      toast.error("Preencha rua, número e bairro.");
      return;
    }
    setSavingAddress(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({
          user_id: user!.id,
          cep: cep.replace(/\D/g, "") || null,
          street: street.trim(),
          number: number.trim(),
          complement: complement.trim(),
          reference_point: referencePoint.trim(),
          neighborhood,
          phone: phone.trim(),
          whatsapp_number: isValidWhatsApp(whatsappNumber) ? formatWhatsAppNumber(whatsappNumber) : null,
        } as any, { onConflict: "user_id" });
      if (error) throw error;

      // Sync cart neighborhood
      if (neighborhood && neighborhoods) {
        const found = neighborhoods.find((n) => n.name === neighborhood);
        if (found) {
          setNeighborhood(found.name, found.fee);
        }
      }

      toast.success("Endereço salvo!");
      queryClient.invalidateQueries({ queryKey: ["my-profile", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["my-profile-checkout", user?.id] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar.");
    } finally {
      setSavingAddress(false);
    }
  };

  const handleSavePix = async () => {
    if (!pixKey.trim() || !pixType) {
      toast.error("Preencha o tipo e a chave PIX.");
      return;
    }
    setSavingPix(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({
          user_id: user!.id,
          pix_key: pixKey.trim(),
          pix_type: pixType,
        } as any, { onConflict: "user_id" });
      if (error) throw error;
      toast.success("Chave PIX salva!");
      queryClient.invalidateQueries({ queryKey: ["my-profile", user?.id] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar.");
    } finally {
      setSavingPix(false);
    }
  };

  const copyPixKey = () => {
    if (pixKey) {
      navigator.clipboard.writeText(pixKey);
      toast.success("Chave PIX copiada!");
    }
  };

  if (!user) {
    return (
       <div className="min-h-screen bg-background pb-32 overflow-y-auto">
        <header className="sticky top-0 z-50 bg-card border-b border-border flex items-center h-14 px-4">
          <h1 className="font-bold text-foreground">Meu Perfil</h1>
        </header>
        <div className="flex flex-col items-center justify-center py-24 text-center px-4">
          <User className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-lg font-bold text-foreground mb-1">Faça login</h2>
          <p className="text-sm text-muted-foreground">Entre para acompanhar seus pedidos.</p>
          <button onClick={() => navigate("/auth")} className="mt-6 bg-primary text-primary-foreground font-bold px-8 py-3 rounded-2xl">
            Entrar
          </button>
        </div>
        <BottomNav />
      </div>
    );
  }

  const profileRole = (profile as any)?.role;
  const isApproved = (profile as any)?.is_approved;

  return (
    <div className="min-h-screen bg-background pb-32 overflow-y-auto">
      <header className="sticky top-0 z-50 bg-card border-b border-border flex items-center h-14 px-4">
        <h1 className="font-bold text-foreground">Meu Perfil</h1>
      </header>
      <div className="px-4 py-6 space-y-4">
        {/* User info */}
        <div className="bg-card rounded-2xl p-4 border border-border flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="font-bold text-foreground">{(profile as any)?.full_name || user.email}</h2>
            <p className="text-xs text-muted-foreground">
              {profileRole === "lojista" ? "Lojista" : profileRole === "motoboy" ? "Entregador" : "Cliente"} no FoodIta
            </p>
          </div>
        </div>

        {/* PWA Install Button */}
        {showInstallButton && !isInstalled && (
          <button
            onClick={handleInstallClick}
            className="w-full bg-destructive text-destructive-foreground font-bold py-3.5 rounded-2xl flex items-center justify-center gap-3 text-sm active:scale-[0.98] transition-transform"
          >
            <Download className="h-5 w-5" />
            📲 Baixar Aplicativo FoodIta
          </button>
        )}

        {/* iOS Install Modal */}
        {showIOSModal && (
          <div className="fixed inset-0 z-[100] bg-black/60 flex items-end justify-center" onClick={() => setShowIOSModal(false)}>
            <div className="bg-card w-full max-w-md rounded-t-3xl p-6 space-y-4 animate-in slide-in-from-bottom-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-foreground">Instalar FoodIta no iPhone</h3>
                <button onClick={() => setShowIOSModal(false)} className="text-muted-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-3 bg-muted/50 rounded-xl p-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-lg">1</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">Toque no botão Compartilhar</p>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      Ícone <Share2 className="h-3.5 w-3.5 inline" /> na barra do Safari (embaixo)
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 bg-muted/50 rounded-xl p-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-lg">2</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">Role para baixo e toque em:</p>
                    <p className="text-xs text-muted-foreground mt-0.5">"<strong>Adicionar à Tela de Início</strong>"</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 bg-muted/50 rounded-xl p-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-lg">3</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">Toque em "Adicionar"</p>
                    <p className="text-xs text-muted-foreground mt-0.5">O FoodIta aparecerá na sua tela inicial!</p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowIOSModal(false)}
                className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl text-sm"
              >
                Entendi!
              </button>
            </div>
          </div>
        )}

        {/* Address section */}
        <div className="bg-card rounded-2xl p-4 border border-border">
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            Endereço de Entrega
          </h3>
          <div className="space-y-3">
          {/* CEP field */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="CEP (ex: 18690-000)"
              value={cep}
              onChange={(e) => handleCepChange(e.target.value)}
              inputMode="numeric"
              maxLength={9}
              className="flex-1 px-3 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={() => handleCepLookup()}
              disabled={loadingCep}
              className="px-3 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50 flex items-center gap-1"
            >
              {loadingCep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </button>
          </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <input
                  type="text"
                  placeholder="Rua"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  autoComplete="street-address"
                />
              </div>
              <input
                type="text"
                placeholder="Nº"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                inputMode="numeric"
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <input
              type="text"
              placeholder="Complemento (apto, bloco...)"
              value={complement}
              onChange={(e) => setComplement(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">Bairro (preenchido pelo CEP)</label>
              <input
                type="text"
                placeholder="Digite o CEP acima para preencher"
                value={neighborhood}
                onChange={(e) => setNeighborhoodLocal(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            {/* Delivery fee indicator */}
            {selectedFee !== null && (
              <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2">
                <Truck className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold text-primary">
                  Taxa de entrega para este local: R$ {selectedFee.toFixed(2)}
                </span>
              </div>
            )}
            <input
              type="text"
              placeholder="Ponto de referência (Ex: Próximo à Igreja)"
              value={referencePoint}
              onChange={(e) => setReferencePoint(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <input
              type="tel"
              placeholder="Telefone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              autoComplete="tel"
            />
            <div>
              <label className="text-xs font-bold text-foreground mb-1 flex items-center gap-1.5">
                <MessageCircle className="h-3.5 w-3.5 text-green-500" />
                WhatsApp (com DDD)
              </label>
              <input
                type="tel"
                placeholder="+55 14 99999-9999"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(maskWhatsApp(e.target.value))}
                inputMode="tel"
                className="w-full px-3 py-2.5 rounded-xl border border-green-500/30 bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <button
              onClick={handleSaveAddress}
              disabled={savingAddress}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {savingAddress ? "Salvando..." : "Salvar Endereço"}
            </button>
          </div>
        </div>

        {/* PIX Section - only for lojista/motoboy */}
        {(profileRole === "lojista" || profileRole === "motoboy") && (
          <div className="bg-card rounded-2xl p-4 border border-border">
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              Dados de Recebimento (PIX)
            </h3>
            {!pixKey && !pixType && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
                <p className="text-xs text-destructive font-bold">
                  Cadastre sua chave PIX para receber seus pagamentos!
                </p>
              </div>
            )}
            <div className="space-y-3">
              <select
                value={pixType}
                onChange={(e) => setPixType(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary appearance-none"
              >
                <option value="">Tipo da Chave</option>
                <option value="cpf">CPF</option>
                <option value="cnpj">CNPJ</option>
                <option value="email">E-mail</option>
                <option value="phone">Telefone</option>
                <option value="random">Chave Aleatória</option>
              </select>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Sua chave PIX"
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  className="flex-1 px-3 py-2.5 rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {pixKey && (
                  <button
                    onClick={copyPixKey}
                    className="px-3 py-2.5 rounded-xl border border-border bg-background text-muted-foreground hover:text-foreground"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                )}
              </div>
              <button
                onClick={handleSavePix}
                disabled={savingPix}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {savingPix ? "Salvando..." : "Salvar Chave PIX"}
              </button>
            </div>
          </div>
        )}
        {/* Partner buttons */}
        {myStore && (
          <button
            onClick={() => navigate("/admin")}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-border bg-secondary text-secondary-foreground font-bold"
          >
            <Store className="h-4 w-4" />
            Painel da Loja ({myStore.name})
          </button>
        )}

        {myDriver && (
          <button
            onClick={() => navigate("/entregador")}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-border bg-secondary text-secondary-foreground font-bold"
          >
            <Bike className="h-4 w-4" />
            Painel do Entregador
          </button>
        )}

        {isAdminUser && (
          <button
            onClick={() => navigate("/super-admin")}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-600 font-bold"
          >
            <Shield className="h-4 w-4" />
            Painel Administrativo
          </button>
        )}

        {!myStore && !myDriver && profileRole !== "lojista" && profileRole !== "motoboy" && (
          <button
            onClick={() => navigate("/parceiro")}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-primary/30 bg-primary/5 text-primary font-bold"
          >
            <UserPlus className="h-4 w-4" />
            Seja um Parceiro
          </button>
        )}

        {/* Pending approval notice */}
        {(profileRole === "lojista" || profileRole === "motoboy") && !isApproved && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 text-center">
            <p className="text-sm font-bold text-yellow-600">🛡️ Cadastro em Análise</p>
            <p className="text-xs text-muted-foreground mt-1">
              Aguarde a aprovação do administrador.
            </p>
          </div>
        )}

        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-border bg-card text-destructive font-bold"
        >
          <LogOut className="h-4 w-4" />
          Sair da conta
        </button>
      </div>
      <BottomNav />
    </div>
  );
};

export default PerfilPage;
