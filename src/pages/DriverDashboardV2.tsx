import { useMemo, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { Bike, Store, Check, X, MapPin, Clock, ShieldCheck, RefreshCw, MessageCircle, LogOut, Headphones, Smartphone, User as UserIcon, Package } from "lucide-react";
import SupportTicketModal from "@/components/SupportTicketModal";
import { toast } from "sonner";
import StoreDriverView from "@/components/StoreDriverView";
import DriverPersistentAlert from "@/components/DriverPersistentAlert";
import SignOutConfirm from "@/components/SignOutConfirm";
import { haptic } from "@/lib/haptics";
import NativeShell from "@/components/native/NativeShell";
import NativeBottomTabs, { type NativeTab } from "@/components/native/NativeBottomTabs";
import { useRuntime } from "@/lib/runtime";

/**
 * DriverDashboard V2 — exclusivo para Motoboy de Loja.
 * Motoboy da plataforma foi descontinuado.
 *
 * Otimizações:
 * - Render condicional sem flash da UI antiga: enquanto resolve o vínculo,
 *   mostra apenas um spinner (nunca a tela de "motoboy da plataforma").
 * - Apenas as queries necessárias para identificar vínculo com loja.
 * - Toda lógica de entrega vive em <StoreDriverView /> já existente.
 */
const DriverDashboardV2 = () => {
  const isMobile = useIsMobile();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [acceptingInvite, setAcceptingInvite] = useState<string | null>(null);
  const [showSupport, setShowSupport] = useState(false);
  const { isPartnerNative } = useRuntime();
  const [activeTab, setActiveTab] = useState<"orders" | "support" | "profile">("orders");

  const { data: driverProfile } = useQuery({
    queryKey: ["v2-driver-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const {
    data: storeDriverLinks,
    isSuccess: linksLoaded,
    isError: linksError,
    refetch: refetchLinks,
  } = useQuery({
    queryKey: ["v2-store-driver-links", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_drivers")
        .select("id, store_id, status, stores(name)")
        .eq("driver_user_id", user!.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 2,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
  });

  const acceptedLinks = useMemo(
    () => (storeDriverLinks || []).filter((l: any) => l.status === "accepted"),
    [storeDriverLinks]
  );
  const pendingLinks = useMemo(
    () => (storeDriverLinks || []).filter((l: any) => l.status === "pending"),
    [storeDriverLinks]
  );
  const linkedStoreIds = useMemo(() => acceptedLinks.map((l: any) => l.store_id), [acceptedLinks]);
  const isStoreDriver = acceptedLinks.length > 0;

  useEffect(() => {
    if (!user) return;
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ["v2-driver-profile", user.id] });
      queryClient.invalidateQueries({ queryKey: ["v2-store-driver-links", user.id] });
    };
    window.addEventListener("capacitor-app-resume", refresh);
    return () => window.removeEventListener("capacitor-app-resume", refresh);
  }, [user, queryClient]);

  const handleInvitation = async (linkId: string, status: "accepted" | "rejected") => {
    setAcceptingInvite(linkId);
    if (status === "accepted") haptic.medium(); else haptic.light();
    const { error } =
      status === "accepted"
        ? await supabase.from("store_drivers").update({ status } as any).eq("id", linkId)
        : await supabase.from("store_drivers").delete().eq("id", linkId);
    if (error) {
      haptic.error();
      toast.error("Erro ao processar convite.");
    } else {
      if (status === "accepted") haptic.success();
      toast.success(status === "accepted" ? "Convite aceito!" : "Convite recusado.");
      queryClient.invalidateQueries({ queryKey: ["v2-store-driver-links", user?.id] });
    }
    setAcceptingInvite(null);
  };

  // Guards
  if (authLoading) return null;
  if (!user) {
    navigate("/auth", { replace: true });
    return null;
  }

  if (!isMobile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-accent/30 to-background flex items-center justify-center p-8">
        <div className="max-w-md text-center space-y-6">
          <div className="relative mx-auto w-24 h-24">
            <div className="absolute inset-0 bg-primary/20 rounded-[2rem] blur-2xl" />
            <div className="relative w-24 h-24 bg-gradient-to-br from-primary to-primary/70 rounded-[2rem] flex items-center justify-center shadow-xl shadow-primary/30">
              <Smartphone className="h-12 w-12 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">Acesso Mobile</h1>
          <p className="text-muted-foreground leading-relaxed">
            O painel do entregador foi desenhado para{" "}
            <span className="text-primary font-bold">smartphones</span>. Abra no app ou em um celular.
          </p>
        </div>
      </div>
    );
  }

  // Loading / erro de rede → nunca mostra UI errada de "aguardando convite".
  // Só avança quando a query realmente teve sucesso (evita falso negativo
  // quando o fetch abortou por timeout/resume do app).
  if (!linksLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-accent/20 to-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/30 rounded-full blur-xl" />
            <div className="relative animate-spin h-12 w-12 border-[3px] border-primary border-t-transparent rounded-full" />
          </div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            {linksError ? "Reconectando…" : "Carregando"}
          </p>
          {linksError && (
            <button
              onClick={() => refetchLinks()}
              className="mt-2 text-xs font-bold text-primary underline underline-offset-4"
            >
              Tentar novamente
            </button>
          )}
        </div>
      </div>
    );
  }

  // Sem vínculo aceito: convites pendentes ou aguardando
  if (!isStoreDriver) {
    const driverName = (driverProfile as any)?.full_name?.split(" ")[0] || "Entregador";
    return (
      <div className="min-h-screen bg-background pt-safe pb-safe">
        {pendingLinks.length > 0 ? (
          <div className="px-4 pt-5 pb-10 max-w-md mx-auto">
            {/* Header simples */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Bike className="h-4.5 w-4.5 text-primary" strokeWidth={2.5} />
                </div>
                <p className="text-sm font-black text-foreground">{driverName}</p>
              </div>
              <SignOutConfirm redirectTo="/portal-parceiro" triggerClassName="w-9 h-9 rounded-xl bg-muted/60 flex items-center justify-center">
                <LogOut className="h-4 w-4 text-muted-foreground" />
              </SignOutConfirm>
            </div>
            <div className="mb-5">
              <h1 className="text-2xl font-black text-foreground mb-1">
                {pendingLinks.length === 1 ? "Convite recebido" : `${pendingLinks.length} convites`}
              </h1>
              <p className="text-sm text-muted-foreground">
                {pendingLinks.length === 1 ? "Uma loja quer te contratar." : "Lojas querem te contratar."}
              </p>
            </div>

            {/* Cards de convite — premium iFood style */}
            <div className="space-y-4">
              {pendingLinks.map((link: any) => {
                const storeName = (link.stores as any)?.name || "Loja";
                const isLoading = acceptingInvite === link.id;
                return (
                  <div
                    key={link.id}
                    className="bg-card rounded-2xl border border-border/60 overflow-hidden"
                  >
                    <div className="p-4 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-primary/8 flex items-center justify-center shrink-0">
                          <Store className="h-6 w-6 text-primary" strokeWidth={2} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Convite de loja</p>
                          <p className="font-black text-foreground text-base leading-tight truncate">{storeName}</p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {[
                          { icon: ShieldCheck, label: "Vínculo direto" },
                          { icon: MapPin, label: "Entregas locais" },
                          { icon: Clock, label: "Horário flexível" },
                        ].map(({icon: Icon, label}) => (
                          <div key={label} className="flex-1 flex flex-col items-center gap-1 bg-muted/40 rounded-xl py-2.5">
                            <Icon className="h-4 w-4 text-primary" />
                            <span className="text-[10px] font-semibold text-muted-foreground text-center leading-tight">{label}</span>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2.5 pt-1">
                        <button
                          disabled={isLoading}
                          onClick={() => handleInvitation(link.id, "rejected")}
                          className="md3-ripple md3-state-layer h-14 px-5 rounded-full border border-border bg-background text-muted-foreground text-sm font-bold flex items-center justify-center gap-1.5 active:scale-[0.97] transition-transform disabled:opacity-50"
                        >
                          <X className="h-4 w-4" strokeWidth={2.5} />
                          Recusar
                        </button>
                        <button
                          disabled={isLoading}
                          onClick={() => handleInvitation(link.id, "accepted")}
                          className="md3-ripple md3-button-filled md3-elev-2 flex-1 h-14 bg-primary text-primary-foreground text-base font-black flex items-center justify-center gap-2 disabled:opacity-60"
                        >
                          {isLoading ? (
                            <div className="animate-spin h-5 w-5 border-2 border-primary-foreground border-t-transparent rounded-full" />
                          ) : (
                            <>
                              <Check className="h-5 w-5" strokeWidth={2.8} />
                              Aceitar
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <SignOutConfirm
              redirectTo="/portal-parceiro"
              triggerClassName="block mx-auto text-xs text-muted-foreground hover:text-destructive transition-colors mt-8 font-medium"
              triggerTitle="Sair da conta"
            />
          </div>
        ) : (
          <div className="flex flex-col min-h-screen bg-background">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-safe pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Bike className="h-5 w-5 text-primary" strokeWidth={2.5} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Bem-vindo</p>
                  <p className="text-sm font-black text-foreground">{driverName}</p>
                </div>
              </div>
              <SignOutConfirm redirectTo="/portal-parceiro" triggerClassName="w-10 h-10 rounded-2xl bg-muted/60 flex items-center justify-center">
                <LogOut className="h-4 w-4 text-muted-foreground" />
              </SignOutConfirm>
            </div>

            {/* Conteúdo */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-6 pb-16">
              <div className="w-24 h-24 rounded-[2rem] bg-primary/8 flex items-center justify-center">
                <Bike className="h-12 w-12 text-primary" strokeWidth={1.8} />
              </div>
              <div>
                <h1 className="text-xl font-black text-foreground mb-2">Aguardando vínculo</h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                  Peça ao <span className="font-semibold text-foreground">dono da loja</span> para adicionar seu e-mail como motoboy no painel dele.
                </p>
              </div>

              <div className="w-full max-w-sm space-y-2.5">
                {[
                  { n: "1", t: "Envie seu e-mail cadastrado para o lojista" },
                  { n: "2", t: "Ele te adiciona pelo painel da loja" },
                  { n: "3", t: "O convite aparece nesta tela" },
                ].map(s => (
                  <div key={s.n} className="flex items-center gap-3 bg-muted/40 rounded-2xl px-4 py-3 text-left">
                    <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-black flex items-center justify-center shrink-0">{s.n}</span>
                    <p className="text-sm text-foreground">{s.t}</p>
                  </div>
                ))}
              </div>

              <button
                onClick={() => { haptic.light(); queryClient.invalidateQueries({ queryKey: ["v2-store-driver-links", user?.id] }); toast.success("Verificando..."); }}
                className="md3-ripple md3-button-filled md3-elev-2 w-full max-w-sm h-14 bg-primary text-primary-foreground font-black text-sm flex items-center justify-center gap-2"
              >
                <RefreshCw className="h-4 w-4" strokeWidth={2.5} />
                Verificar convites
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Motoboy de loja com vínculo aceito → render direto
  const driverFirstName = (driverProfile as any)?.full_name?.split(" ")[0] || "Entregador";

  const tabs: NativeTab[] = [
    { key: "orders", label: "Pedidos", icon: <Package className="h-5 w-5" strokeWidth={2.2} /> },
    { key: "support", label: "Suporte", icon: <Headphones className="h-5 w-5" strokeWidth={2.2} /> },
    { key: "profile", label: "Perfil", icon: <UserIcon className="h-5 w-5" strokeWidth={2.2} /> },
  ];

  const handleTabChange = (key: string) => {
    if (key === "support") {
      setShowSupport(true);
      return;
    }
    setActiveTab(key as typeof activeTab);
    if (key === "orders") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const mainContent = (
    <>
      {driverProfile && (
        <SupportTicketModal
          open={showSupport}
          onClose={() => setShowSupport(false)}
          userRole="motoboy"
        />
      )}
      <DriverPersistentAlert availableCount={0} hasActiveDelivery={false} isOnline onReview={() => {}} />
      <div className={`min-h-screen bg-background text-foreground native-app ${isPartnerNative ? "" : "pb-[5.5rem]"}`}>
        <header className="sticky top-0 z-50 md3-appbar">
          <div className="px-4 h-16 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shrink-0 md3-elev-2">
                <span className="text-sm font-black text-primary-foreground tracking-tight">
                  {(driverFirstName || "E").trim().charAt(0).toUpperCase()}
                </span>
                <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-card border-2 border-background flex items-center justify-center">
                  <Bike className="h-2.5 w-2.5 text-primary" strokeWidth={3} />
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">
                  Entregador
                </p>
                <p className="text-base font-black text-foreground leading-tight truncate mt-0.5">
                  {driverFirstName}
                </p>
              </div>
            </div>
            {!isPartnerNative && <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => { haptic.light(); setShowSupport(true); }}
                aria-label="Suporte"
                className="md3-ripple md3-state-layer w-10 h-10 rounded-full bg-muted flex items-center justify-center active:scale-[0.93] transition-all"
              >
                <Headphones className="h-[18px] w-[18px] text-foreground" strokeWidth={2.2} />
              </button>
              <SignOutConfirm
                redirectTo="/portal-parceiro"
                triggerClassName="md3-ripple md3-state-layer w-10 h-10 rounded-full bg-muted flex items-center justify-center active:scale-[0.93] transition-all"
              >
                <LogOut className="h-[18px] w-[18px] text-foreground" strokeWidth={2.2} />
              </SignOutConfirm>
            </div>}
          </div>
        </header>

        {(!isPartnerNative || activeTab === "orders") && (
          <StoreDriverView linkedStoreIds={linkedStoreIds} />
        )}
        {isPartnerNative && activeTab === "profile" && (
          <div className="px-5 py-8 space-y-4 max-w-md mx-auto">
            <div className="bg-card rounded-2xl border border-border/60 p-5 flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                <span className="text-lg font-black text-primary-foreground">
                  {(driverFirstName || "E").trim().charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Entregador</p>
                <p className="text-base font-black text-foreground truncate">{(driverProfile as any)?.full_name || driverFirstName}</p>
              </div>
            </div>
            <SignOutConfirm redirectTo="/portal-parceiro">
              <button
                type="button"
                className="w-full h-14 rounded-2xl bg-destructive/10 text-destructive font-black flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                <LogOut className="h-5 w-5" strokeWidth={2.5} />
                Sair da conta
              </button>
            </SignOutConfirm>
          </div>
        )}
      </div>
    </>
  );

  if (isPartnerNative) {
    return (
      <NativeShell withBottomTabs>
        {mainContent}
        <NativeBottomTabs tabs={tabs} activeKey={activeTab} onChange={handleTabChange} />
      </NativeShell>
    );
  }

  return mainContent;
};

export default DriverDashboardV2;