import { useMemo, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { Bike, Smartphone, Store } from "lucide-react";
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

  const { data: storeDriverLinks, isFetched: linksFetched } = useQuery({
    queryKey: ["v2-store-driver-links", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("store_drivers")
        .select("id, store_id, status, stores(name)")
        .eq("driver_user_id", user!.id);
      return data || [];
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 2,
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
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="max-w-md text-center space-y-6">
          <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto">
            <Smartphone className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-2xl font-black text-foreground">Acesso Mobile</h1>
          <p className="text-muted-foreground">
            O painel do entregador está disponível apenas para{" "}
            <span className="text-primary font-bold">dispositivos móveis</span>.
          </p>
        </div>
      </div>
    );
  }

  // Loading → nunca mostra UI da plataforma
  if (!linksFetched) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Sem vínculo aceito: convites pendentes ou aguardando
  if (!isStoreDriver) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
        {pendingLinks.length > 0 ? (
          <div className="w-full max-w-sm space-y-6">
            <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-2">
              <Bike className="h-10 w-10 text-primary" />
            </div>
            <div className="text-center">
              <h1 className="text-xl font-black text-foreground mb-2">Convites de Lojas 🏢</h1>
              <p className="text-sm text-muted-foreground">
                Você recebeu convites para trabalhar como motoboy próprio nas seguintes lojas:
              </p>
            </div>
            <div className="space-y-3">
              {pendingLinks.map((link: any) => (
                <div key={link.id} className="bg-card border border-border rounded-2xl p-4 space-y-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Store className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-foreground">{(link.stores as any)?.name || "Loja"}</p>
                      <p className="text-[10px] text-muted-foreground uppercase font-black">Convite Pendente</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      disabled={acceptingInvite === link.id}
                      onClick={() => handleInvitation(link.id, "rejected")}
                      className="py-2.5 rounded-xl border border-red-500/20 bg-red-500/5 text-red-500 text-xs font-bold hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    >
                      Recusar
                    </button>
                    <button
                      disabled={acceptingInvite === link.id}
                      onClick={() => handleInvitation(link.id, "accepted")}
                      className="py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-50"
                    >
                      Aceitar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-amber-500/10 rounded-3xl flex items-center justify-center mx-auto mb-2">
              <Store className="h-10 w-10 text-amber-500" />
            </div>
            <div>
              <h1 className="text-xl font-black text-foreground mb-2">Aguardando Vinculação 🔗</h1>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                Sua conta foi criada! Peça ao{" "}
                <span className="font-bold text-foreground">dono da loja</span> para te adicionar como
                motoboy próprio no painel dele.
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="bg-primary text-primary-foreground font-bold px-8 py-3.5 rounded-2xl text-sm shadow-lg shadow-primary/20 active:scale-95 transition-all"
            >
              Verificar Convites
            </button>
            <SignOutConfirm
              redirectTo="/portal-parceiro"
              triggerClassName="block mx-auto text-xs text-muted-foreground hover:text-destructive transition-colors mt-4"
              triggerTitle="Sair"
            />
          </div>
        )}
      </div>
    );
  }

  // Motoboy de loja com vínculo aceito → render direto
  const driverFirstName = (driverProfile as any)?.full_name?.split(" ")[0] || "Entregador";

  return (
    <>
      <DriverPersistentAlert availableCount={0} hasActiveDelivery={false} isOnline onReview={() => {}} />
      <div className="min-h-screen bg-background text-foreground pb-[5.5rem] native-app">
        <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-xl border-b border-border pt-safe">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Bike className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="font-black text-base text-foreground leading-tight">{driverFirstName}</h1>
                <p className="text-[11px] text-muted-foreground font-medium">Motoboy da Loja</p>
              </div>
            </div>
            <SignOutConfirm
              redirectTo="/portal-parceiro"
              triggerClassName="w-10 h-10 rounded-2xl bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all active:scale-95"
              triggerTitle="Sair"
            />
          </div>
        </header>

        <StoreDriverView linkedStoreIds={linkedStoreIds} />
      </div>
    </>
  );
};

export default DriverDashboardV2;