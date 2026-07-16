import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStorePdvAccess } from "@/hooks/useStorePdvAccess";
import { toast } from "sonner";
import MenuBuilder from "@/components/MenuBuilder";

/** Cardápio standalone acessível a partir do PDV (principalmente pra lojas pdv_only,
 *  que não têm painel do lojista). Renderiza o mesmo MenuBuilder do painel. */
const PdvCardapioPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: store, isFetched } = useQuery({
    queryKey: ["pdv-cardapio-store", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      // Admin pode ter selecionado uma loja no PDV — respeitar essa escolha
      try {
        const adminStoreId = localStorage.getItem("pdv_admin_selected_store");
        if (adminStoreId) {
          const { data } = await supabase
            .from("stores").select("id, name, category")
            .eq("id", adminStoreId).maybeSingle();
          if (data) return data;
        }
      } catch {}
      // Cache do PDV (mesma loja que o caixa está usando)
      try {
        const raw = localStorage.getItem("pdv_store_v1");
        if (raw) {
          const cached = JSON.parse(raw);
          if (cached?.id) return cached;
        }
      } catch {}
      const { data } = await supabase
        .from("stores")
        .select("id, name, category")
        .eq("owner_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const pdvAccess = useStorePdvAccess(store?.id);

  useEffect(() => {
    if (!user) navigate("/", { replace: true });
  }, [user, navigate]);

  // Gate: sem acesso ao módulo PDV → volta pra aba de plano com aviso.
  useEffect(() => {
    if (!store?.id || pdvAccess.isLoading) return;
    if (!pdvAccess.enabled) {
      toast.error("Ative o módulo PDV pra usar o caixa e o cardápio.");
      navigate("/admin?tab=plano", { replace: true });
    }
  }, [store?.id, pdvAccess.enabled, pdvAccess.isLoading, navigate]);

  if (!isFetched) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3 px-6 text-center">
        <p className="text-sm text-muted-foreground max-w-xs">
          Nenhuma loja encontrada para o seu usuário. Abra o PDV primeiro para selecionar uma loja.
        </p>
        <button
          onClick={() => navigate("/admin/pdv")}
          className="bg-primary text-primary-foreground font-bold px-5 py-2.5 rounded-xl text-sm"
        >
          Ir para o PDV
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="h-12 border-b border-border bg-card flex items-center px-3 gap-2 sticky top-0 z-10">
        <button
          onClick={() => navigate("/admin/pdv")}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          title="Voltar ao PDV"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="w-px h-5 bg-border" />
        <span className="text-sm font-bold">Cardápio · {store.name}</span>
      </header>
      <div className="p-3">
        <MenuBuilder storeId={store.id} storeCategory={store.category} />
      </div>
    </div>
  );
};

export default PdvCardapioPage;