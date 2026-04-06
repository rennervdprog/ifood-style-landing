import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Store, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";

const StoreDirectory = () => {
  const navigate = useNavigate();

  const { data: stores, isLoading } = useQuery({
    queryKey: ["active-stores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, slug, image_url, category")
        .eq("status", "ativo")
        .order("name");
      if (error) throw error;
      return (data || []).filter((s: any) => s.slug);
    },
  });

  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Store className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-black text-foreground">ITA<span className="text-primary">FOOD</span></h1>
          <p className="text-sm text-muted-foreground mt-1">Escolha um estabelecimento</p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : stores && stores.length > 0 ? (
          <div className="space-y-3">
            {stores.map((store: any) => (
              <button
                key={store.id}
                onClick={() => navigate(`/${store.slug}`)}
                className="w-full flex items-center gap-4 p-4 bg-card border border-border rounded-2xl hover:border-primary/50 transition-all active:scale-[0.98]"
              >
                {store.image_url ? (
                  <img
                    src={store.image_url}
                    alt={store.name}
                    className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Store className="h-6 w-6 text-primary" />
                  </div>
                )}
                <div className="flex-1 text-left">
                  <h3 className="font-bold text-foreground">{store.name}</h3>
                  <p className="text-xs text-muted-foreground capitalize">{store.category}</p>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-10">
            <p className="text-muted-foreground">Nenhum estabelecimento disponível no momento.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StoreDirectory;
