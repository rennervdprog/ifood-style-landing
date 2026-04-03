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
import SearchBar from "@/components/SearchBar";
import PromoBanners from "@/components/PromoBanners";
import ReorderSection from "@/components/ReorderSection";
import PopularProducts from "@/components/PopularProducts";
import FirstOrderBanner from "@/components/FirstOrderBanner";
import { getStoreOpenStatus, type OpeningHour } from "@/lib/storeStatus";

const Index = () => {
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");

  const { data: stores, isLoading } = useQuery({
    queryKey: ["stores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .order("rating", { ascending: false });
      if (error) throw error;
      return (data || []).filter((s: any) => !s.status || s.status === "ativo");
    },
  });

  const { data: products } = useQuery({
    queryKey: ["all-products-search"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, store_id")
        .eq("is_available", true);
      if (error) throw error;
      return data || [];
    },
    enabled: search.length >= 2,
  });

  const storeIds = stores?.map(s => s.id) || [];
  const { data: allHours } = useQuery({
    queryKey: ["all-opening-hours", storeIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opening_hours")
        .select("*")
        .in("store_id", storeIds);
      if (error) throw error;
      return data || [];
    },
    enabled: storeIds.length > 0,
  });

  const storesWithStatus = stores?.map(store => {
    const hours = (allHours as any[])?.filter((h: any) => h.store_id === store.id) || [];
    const status = getStoreOpenStatus(hours as OpeningHour[], (store as any).force_closed || false, store.is_open);
    return { ...store, computedOpen: status.isOpen, statusReason: status.reason };
  });

  const sorted = storesWithStatus?.sort((a, b) => {
    if (a.computedOpen && !b.computedOpen) return -1;
    if (!a.computedOpen && b.computedOpen) return 1;
    return 0;
  });

  let filtered = sorted?.filter((s) => category === "all" || s.category === category);

  if (search.length >= 2 && filtered) {
    const searchLower = search.toLowerCase();
    const matchingStoreIds = new Set<string>();
    filtered.forEach(s => { if (s.name.toLowerCase().includes(searchLower)) matchingStoreIds.add(s.id); });
    if (products) {
      products.forEach((p: any) => { if (p.name.toLowerCase().includes(searchLower)) matchingStoreIds.add(p.store_id); });
    }
    filtered = filtered.filter(s => matchingStoreIds.has(s.id));
  }

  return (
    <div className="min-h-screen bg-background pb-32 overflow-y-auto">
      <AppHeader />

      <div className="px-4 pt-4 space-y-3">
        <h1 className="text-xl font-black text-foreground">
          O que você quer <span className="text-primary">pedir</span> hoje?
        </h1>
        <SearchBar value={search} onChange={setSearch} />
      </div>

      {/* Promotional banners */}
      <PromoBanners />

      {/* First order coupon banner */}
      <FirstOrderBanner />

      <CategoryScroll selected={category} onSelect={setCategory} />

      {/* Reorder section */}
      <ReorderSection />

      {/* Popular products */}
      <PopularProducts />

      <div className="px-4 mt-4">
        <h2 className="text-sm font-bold text-foreground mb-3">Estabelecimentos</h2>
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <StoreCardSkeleton key={i} />
            ))}
          </div>
        ) : filtered && filtered.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filtered.map((store) => (
              <StoreCard key={store.id} {...store} is_open={store.computedOpen} statusReason={store.statusReason} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <PackageOpen className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-lg font-bold text-foreground mb-1">
              {search.length >= 2 ? "Nenhum resultado encontrado" : stores && stores.length === 0 ? "Estamos chegando!" : category === "farmacias" ? "Ainda não temos farmácias parceiras" : category === "docerias" ? "Ainda não temos docerias parceiras" : "Nenhum estabelecimento nesta categoria"}
            </h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              {search.length >= 2 ? `Nenhuma loja ou produto encontrado para "${search}".` : stores && stores.length === 0 ? "Novas lojas no FoodIta em breve. Fique ligado!" : "Nenhum estabelecimento aberto no momento. Volte mais tarde!"}
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
