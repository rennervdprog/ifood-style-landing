import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import MenuBuilder from "@/components/MenuBuilder";

/** Cardápio standalone acessível a partir do PDV (principalmente pra lojas pdv_only,
 *  que não têm painel do lojista). Renderiza o mesmo MenuBuilder do painel. */
const PdvCardapioPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: store, isLoading } = useQuery({
    queryKey: ["pdv-cardapio-store", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("stores")
        .select("id, name, category")
        .eq("owner_id", user!.id)
        .eq("status", "ativo")
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (!user) navigate("/", { replace: true });
  }, [user, navigate]);

  if (isLoading || !store) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
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