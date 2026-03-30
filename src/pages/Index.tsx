import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PackageOpen } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import CartFAB from "@/components/CartFAB";
import CategoryScroll from "@/components/CategoryScroll";
import StoreCard from "@/components/StoreCard";
import StoreCardSkeleton from "@/components/StoreCardSkeleton";

const Index = () => {
  const [category, setCategory] = useState("all");

  const { data: stores, isLoading } = useQuery({
    queryKey: ["stores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .eq("status" as any, "ativo")
        .order("is_open", { ascending: false })
        .order("rating", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = stores?.filter(
    (s) => category === "all" || s.category === category
  );

  return (
    <div className="min-h-screen bg-background pb-32">
      <AppHeader />

      <div className="px-4 pt-4">
        <h1 className="text-xl font-black text-foreground">
          O que você quer <span className="text-primary">pedir</span> hoje?
        </h1>
      </div>

      <CategoryScroll selected={category} onSelect={setCategory} />

      <div className="px-4">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <StoreCardSkeleton key={i} />
            ))}
          </div>
        ) : filtered && filtered.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((store) => (
              <StoreCard key={store.id} {...store} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <PackageOpen className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-lg font-bold text-foreground mb-1">
              Nenhum estabelecimento aberto
            </h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              Nenhum estabelecimento aberto no momento. Volte mais tarde!
            </p>
          </div>
        )}
      </div>

      <CartFAB />
      <BottomNav />
    </div>
  );
};

export default Index;
