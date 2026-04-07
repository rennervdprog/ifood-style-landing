import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import CategoryScroll from "@/components/CategoryScroll";
import SearchBar from "@/components/SearchBar";
import StoreCard from "@/components/StoreCard";
import StoreCardSkeleton from "@/components/StoreCardSkeleton";
import CartFAB from "@/components/CartFAB";
import PopularProducts from "@/components/PopularProducts";
import PromoBanners from "@/components/PromoBanners";
import FirstOrderBanner from "@/components/FirstOrderBanner";
import { useState } from "react";
import { getStoreOpenStatus, type OpeningHour } from "@/lib/storeStatus";

const PartnerClientView = () => {
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: stores, isLoading } = useQuery({
    queryKey: ["stores-client"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .in("status", ["ativo", "bloqueado"]);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: allHours } = useQuery({
    queryKey: ["opening-hours-all"],
    queryFn: async () => {
      const { data } = await supabase.from("opening_hours").select("*");
      return data || [];
    },
  });

  const filteredStores = (stores || [])
    .filter((s: any) => {
      if (selectedCategory && s.category !== selectedCategory) return false;
      if (searchQuery && !s.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    })
    .map((s: any) => {
      const storeHours = (allHours || []).filter((h: any) => h.store_id === s.id);
      const status = getStoreOpenStatus(storeHours as OpeningHour[], s.force_closed, s.is_open);
      const isSuspended = s.status === "bloqueado";
      return { ...s, is_open: isSuspended ? false : status.isOpen, statusReason: isSuspended ? "Loja temporariamente fechada" : status.reason };
    })
    .sort((a: any, b: any) => (a.is_open === b.is_open ? 0 : a.is_open ? -1 : 1));

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppHeader />
      <FirstOrderBanner />
      <PromoBanners />
      
      <div className="px-4 py-3">
        <SearchBar value={searchQuery} onChange={setSearchQuery} />
      </div>

      <CategoryScroll selected={selectedCategory} onSelect={setSelectedCategory} />

      <PopularProducts />

      <div className="px-4 py-2">
        <h2 className="text-lg font-bold text-foreground mb-3">Lojas</h2>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <StoreCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredStores.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {filteredStores.map((store: any) => (
              <StoreCard
                key={store.id}
                id={store.id}
                name={store.name}
                category={store.category}
                image_url={store.image_url}
                is_open={store.is_open}
                rating={store.rating}
              />
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8 text-sm">
            Nenhuma loja encontrada.
          </p>
        )}
      </div>

      <CartFAB />
      <BottomNav />
    </div>
  );
};

export default PartnerClientView;
