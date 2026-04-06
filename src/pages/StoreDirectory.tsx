import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Store, Truck, ShieldCheck, Zap, ChevronRight, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";

const StoreDirectory = () => {
  const navigate = useNavigate();

  const { data: stores, isLoading } = useQuery({
    queryKey: ["active-stores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, slug, image_url, category, rating")
        .eq("status", "ativo")
        .order("name");
      if (error) throw error;
      return (data || []).filter((s: any) => s.slug);
    },
  });

  // Show max 6 random stores
  const displayStores = stores
    ? [...stores].sort(() => Math.random() - 0.5).slice(0, 6)
    : [];

  const features = [
    { icon: Zap, title: "Pedido Rápido", desc: "Faça seu pedido em segundos" },
    { icon: Truck, title: "Entrega Ágil", desc: "Motoboys dedicados na sua cidade" },
    { icon: ShieldCheck, title: "Pagamento Seguro", desc: "PIX, cartão e dinheiro" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-primary/5 px-4 pt-14 pb-12">
        <div className="max-w-md mx-auto text-center relative z-10">
          <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-primary/10">
            <Store className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">
            ITA<span className="text-primary">SUPER</span>
          </h1>
          <p className="text-base text-muted-foreground mt-2 leading-relaxed">
            O delivery oficial da sua cidade.<br />
            Peça dos melhores estabelecimentos com entrega rápida!
          </p>
        </div>
        <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
      </section>

      {/* Features */}
      <section className="px-4 py-8 max-w-md mx-auto">
        <div className="grid grid-cols-3 gap-3">
          {features.map((f, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-3 text-center">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-2">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <p className="text-xs font-bold text-foreground leading-tight">{f.title}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Partners */}
      <section className="px-4 pb-12 max-w-md mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-foreground">Nossos Parceiros</h2>
          {stores && stores.length > 6 && (
            <span className="text-xs text-muted-foreground">
              {stores.length} lojas
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-muted animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : displayStores.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {displayStores.map((store: any) => (
              <button
                key={store.id}
                onClick={() => navigate(`/${store.slug}`)}
                className="group bg-card border border-border rounded-2xl p-3 text-left hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all active:scale-[0.97]"
              >
                {store.image_url ? (
                  <img
                    src={store.image_url}
                    alt={store.name}
                    loading="lazy"
                    width={200}
                    height={80}
                    className="w-full h-20 rounded-xl object-cover mb-2"
                  />
                ) : (
                  <div className="w-full h-20 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                    <Store className="h-8 w-8 text-primary" />
                  </div>
                )}
                <h3 className="font-bold text-sm text-foreground truncate">{store.name}</h3>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-[10px] text-muted-foreground capitalize">{store.category}</p>
                  {store.rating > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] text-amber-500 font-bold">
                      <Star className="h-3 w-3 fill-amber-500" />
                      {Number(store.rating).toFixed(1)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-2 text-primary">
                  <span className="text-[10px] font-bold group-hover:underline">Ver cardápio</span>
                  <ChevronRight className="h-3 w-3" />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 bg-card border border-border rounded-2xl">
            <Store className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum estabelecimento disponível no momento.</p>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-6 px-4 text-center">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} <span className="font-bold">ItaSuper</span> — Todos os direitos reservados
        </p>
      </footer>
    </div>
  );
};

export default StoreDirectory;
