import { useMemo, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { Bike, Smartphone, Store, Check, X, Sparkles, MapPin, Clock, ShieldCheck, RefreshCw, MessageCircle } from "lucide-react";
import SupportTicketModal from "@/components/SupportTicketModal";
import { toast } from "sonner";
import StoreDriverView from "@/components/StoreDriverView";
import DriverPersistentAlert from "@/components/DriverPersistentAlert";
import SignOutConfirm from "@/components/SignOutConfirm";

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
    const { error } =
      status === "accepted"
        ? await supabase.from("store_drivers").update({ status } as any).eq("id", linkId)
        : await supabase.from("store_drivers").delete().eq("id", linkId);
    if (error) toast.error("Erro ao processar convite.");
    else {
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
      <div className="min-h-screen bg-gradient-to-br from-background via-accent/20 to-background pt-safe pb-safe">
        {pendingLinks.length > 0 ? (
          <div className="px-5 pt-8 pb-10 max-w-md mx-auto">
            {/* Hero */}
            <div className="text-center mb-8">
              <div className="relative mx-auto w-24 h-24 mb-5">
                <div className="absolute inset-0 bg-primary/30 rounded-[2rem] blur-2xl animate-pulse" />
                <div className="relative w-24 h-24 bg-gradient-to-br from-primary to-primary/70 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-primary/40">
                  <Bike className="h-12 w-12 text-primary-foreground" strokeWidth={2.5} />
                </div>
                <div className="absolute -top-1 -right-1 w-7 h-7 bg-card border-2 border-primary rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-[11px] font-black text-primary">{pendingLinks.length}</span>
                </div>
              </div>
              <p className="text-xs font-black text-primary uppercase tracking-widest mb-2">
                Olá, {driverName}
              </p>
              <h1 className="text-3xl font-black text-foreground tracking-tight mb-2">
                Você foi convidado!
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed px-4">
                {pendingLinks.length === 1
                  ? "Uma loja quer contar com você como motoboy próprio."
                  : `${pendingLinks.length} lojas querem contar com você como motoboy próprio.`}
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
                    className="relative bg-card rounded-3xl overflow-hidden shadow-xl shadow-primary/5 border border-border/60"
                  >
                    {/* Faixa superior gradiente */}
                    <div className="h-1.5 bg-gradient-to-r from-primary via-primary/70 to-primary" />
                    <div className="p-5 space-y-5">
                      <div className="flex items-center gap-4">
                        <div className="relative shrink-0">
                          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center border border-primary/10">
                            <Store className="h-7 w-7 text-primary" strokeWidth={2.2} />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-0.5">
                            Convite • Pendente
                          </p>
                          <p className="font-black text-foreground text-lg leading-tight truncate">
                            {storeName}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 py-2">
                        <div className="flex flex-col items-center gap-1 py-2 px-1 rounded-xl bg-muted/40">
                          <ShieldCheck className="h-4 w-4 text-primary" />
                          <span className="text-[9px] font-bold text-muted-foreground text-center leading-tight">
                            Vínculo<br/>Direto
                          </span>
                        </div>
                        <div className="flex flex-col items-center gap-1 py-2 px-1 rounded-xl bg-muted/40">
                          <MapPin className="h-4 w-4 text-primary" />
                          <span className="text-[9px] font-bold text-muted-foreground text-center leading-tight">
                            Entregas<br/>Locais
                          </span>
                        </div>
                        <div className="flex flex-col items-center gap-1 py-2 px-1 rounded-xl bg-muted/40">
                          <Clock className="h-4 w-4 text-primary" />
                          <span className="text-[9px] font-bold text-muted-foreground text-center leading-tight">
                            Horário<br/>Flexível
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-5 gap-2.5">
                        <button
                          disabled={isLoading}
                          onClick={() => handleInvitation(link.id, "rejected")}
                          className="col-span-2 h-12 rounded-2xl border border-border bg-background text-muted-foreground text-sm font-bold flex items-center justify-center gap-1.5 hover:bg-muted/60 hover:text-destructive transition-all active:scale-95 disabled:opacity-50"
                        >
                          <X className="h-4 w-4" strokeWidth={2.5} />
                          Recusar
                        </button>
                        <button
                          disabled={isLoading}
                          onClick={() => handleInvitation(link.id, "accepted")}
                          className="col-span-3 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/85 text-primary-foreground text-sm font-black shadow-lg shadow-primary/30 flex items-center justify-center gap-1.5 active:scale-95 transition-all disabled:opacity-60"
                        >
                          {isLoading ? (
                            <div className="animate-spin h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full" />
                          ) : (
                            <>
                              <Check className="h-4 w-4" strokeWidth={3} />
                              Aceitar Convite
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
          <div className="px-5 pt-12 pb-10 max-w-md mx-auto flex flex-col items-center text-center">
            <div className="relative mx-auto w-28 h-28 mb-6">
              <div className="absolute inset-0 bg-primary/20 rounded-[2.25rem] blur-2xl" />
              <div className="relative w-28 h-28 bg-gradient-to-br from-primary to-primary/70 rounded-[2.25rem] flex items-center justify-center shadow-2xl shadow-primary/30">
                <Bike className="h-14 w-14 text-primary-foreground" strokeWidth={2.4} />
              </div>
              <div className="absolute -top-2 -right-2 w-9 h-9 bg-card border-2 border-amber-500 rounded-full flex items-center justify-center shadow-lg">
                <Sparkles className="h-4 w-4 text-amber-500" />
              </div>
            </div>

            <p className="text-xs font-black text-primary uppercase tracking-widest mb-2">
              Bem-vindo, {driverName}
            </p>
            <h1 className="text-2xl font-black text-foreground tracking-tight mb-3">
              Conta criada com sucesso!
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed mb-8 px-2">
              Agora é só pedir ao <span className="font-bold text-foreground">dono da loja</span> para
              adicionar você como motoboy próprio no painel dele.
            </p>

            {/* Steps card */}
            <div className="w-full bg-card rounded-3xl p-5 shadow-lg shadow-primary/5 border border-border/60 mb-8 text-left space-y-4">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                Próximos passos
              </p>
              {[
                { n: "1", t: "Envie seu e-mail", d: "Compartilhe com o dono da loja o e-mail que você usou aqui." },
                { n: "2", t: "Aguarde o convite", d: "Ele vai te adicionar pelo painel da loja." },
                { n: "3", t: "Aceite e comece", d: "O convite aparecerá nesta tela em segundos." },
              ].map((s) => (
                <div key={s.n} className="flex items-start gap-3">
                  <div className="shrink-0 w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-black text-primary">{s.n}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground leading-tight">{s.t}</p>
                    <p className="text-xs text-muted-foreground leading-snug mt-0.5">{s.d}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["v2-store-driver-links", user?.id] });
                toast.success("Verificando convites...");
              }}
              className="w-full max-w-xs h-14 bg-gradient-to-br from-primary to-primary/85 text-primary-foreground font-black rounded-2xl text-sm shadow-xl shadow-primary/30 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className="h-4 w-4" strokeWidth={2.6} />
              Verificar Convites
            </button>

            <SignOutConfirm
              redirectTo="/portal-parceiro"
              triggerClassName="block mx-auto text-xs text-muted-foreground hover:text-destructive transition-colors mt-6 font-medium"
              triggerTitle="Sair da conta"
            />
          </div>
        )}
      </div>
    );
  }

  // Motoboy de loja com vínculo aceito → render direto
  const driverFirstName = (driverProfile as any)?.full_name?.split(" ")[0] || "Entregador";

  const [showSupport, setShowSupport] = useState(false);

  return (
    <>
      {driverProfile && (
        <SupportTicketModal
          open={showSupport}
          onClose={() => setShowSupport(false)}
          userRole="motoboy"
        />
      )}
      <DriverPersistentAlert availableCount={0} hasActiveDelivery={false} isOnline onReview={() => {}} />
      <div className="min-h-screen bg-background text-foreground pb-[5.5rem] native-app">
        <header className="sticky top-0 z-50 bg-card/90 backdrop-blur-xl border-b border-border/60 pt-safe shadow-sm">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                <div className="absolute inset-0 bg-primary/25 rounded-2xl blur-md" />
                <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-primary/75 flex items-center justify-center shadow-lg shadow-primary/30">
                  <Bike className="h-5 w-5 text-primary-foreground" strokeWidth={2.6} />
                </div>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black text-primary uppercase tracking-widest leading-none mb-0.5">
                  Motoboy da Loja
                </p>
                <h1 className="font-black text-base text-foreground leading-tight truncate">
                  Olá, {driverFirstName}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSupport(true)}
                className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary active:scale-95 transition-all"
                title="Suporte"
              >
                <MessageCircle className="h-4 w-4" />
              </button>
              <SignOutConfirm
                redirectTo="/portal-parceiro"
                triggerClassName="w-10 h-10 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all active:scale-95 shrink-0"
                triggerTitle="Sair"
              />
            </div>
          </div>
        </header>

        <StoreDriverView linkedStoreIds={linkedStoreIds} />
      </div>
    </>
  );
};

export default DriverDashboardV2;