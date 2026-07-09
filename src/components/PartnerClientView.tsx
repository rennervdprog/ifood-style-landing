import { memo, useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { LayoutDashboard, Truck, ChevronRight, ShoppingCart } from "lucide-react";
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
import { getStoreOpenStatus, type OpeningHour } from "@/lib/storeStatus";

const PartnerClientView = memo(() => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const handleCategorySelect = useCallback((value: string) => {
    setSelectedCategory(value === "all" ? null : value);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  const { data: profile } = useQuery({
    queryKey: ["partner-role-banner", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const { data: ownedStore } = useQuery({
    queryKey: ["partner-owned-store-plan", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("stores")
        .select("id, plan_type")
        .eq("owner_id", user!.id)
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user && profile?.role === "lojista",
    staleTime: 1000 * 60 * 5,
  });
  const isPdvOnly = (ownedStore as any)?.plan_type === "pdv_only";

  const { data: stores, isLoading } = useQuery({
    queryKey: ["stores-client"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores_public")
        .select("*")
        .in("status", ["ativo", "bloqueado"]);
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 2,
  });

  const { data: allHours } = useQuery({
    queryKey: ["opening-hours-all"],
    queryFn: async () => {
      const { data } = await supabase.from("opening_hours").select("*");
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  const filteredStores = useMemo(() => {
    return (stores || [])
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
  }, [stores, allHours, selectedCategory, searchQuery]);

  return (
    <div className="min-h-screen bg-background pb-20">
      <AppHeader />

      {profile?.role === "lojista" && (
        <button
          onClick={() => navigate("/admin")}
          className="mx-4 mt-3 flex items-center gap-3 rounded-xl bg-primary/10 border border-primary/20 p-3 transition-colors active:bg-primary/20"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            {isPdvOnly ? <ShoppingCart className="h-5 w-5" /> : <LayoutDashboard className="h-5 w-5" />}
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-bold text-foreground">
              {isPdvOnly ? "Abrir PDV" : "Acessar Painel do Lojista"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isPdvOnly ? "Frente de caixa da sua loja" : "Gerencie sua loja e pedidos"}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      )}
      {profile?.role === "motoboy" && (
        <button
          onClick={() => navigate("/entregador")}
          className="mx-4 mt-3 flex items-center gap-3 rounded-xl bg-primary/10 border border-primary/20 p-3 transition-colors active:bg-primary/20"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Truck className="h-5 w-5" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-bold text-foreground">Acessar Painel de Entregas</p>
            <p className="text-xs text-muted-foreground">Veja entregas disponíveis</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      )}

      <FirstOrderBanner />
      <PromoBanners />
      
      <div className="px-4 py-3">
        <SearchBar value={searchQuery} onChange={handleSearchChange} />
      </div>

      <CategoryScroll selected={selectedCategory || "all"} onSelect={handleCategorySelect} />

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
                slug={store.slug}
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
});

PartnerClientView.displayName = "PartnerClientView";

export default PartnerClientView;
