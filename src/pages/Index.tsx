import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PackageOpen, LayoutDashboard, Truck, ShoppingBag, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import CartFAB from "@/components/CartFAB";
import CategoryScroll from "@/components/CategoryScroll";
import StoreCard from "@/components/StoreCard";
import StoreCardSkeleton from "@/components/StoreCardSkeleton";
import SearchBar from "@/components/SearchBar";
import PromoBanners from "@/components/PromoBanners";
import ReorderSection from "@/components/ReorderSection";
import FirstOrderBanner from "@/components/FirstOrderBanner";
import { getStoreOpenStatus, type OpeningHour } from "@/lib/storeStatus";
import ProductTour, { clienteTourSteps } from "@/components/ProductTour";

const RoleBanner = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ["index-role-banner", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  if (!user || !profile) return null;

  const role = profile.role;
  const firstName = profile.full_name?.split(" ")[0] || "";

  if (role === "lojista") {
    return (
      <button
        onClick={() => navigate("/partner-login")}
        className="mx-4 mt-3 flex items-center gap-3 rounded-xl bg-primary/10 border border-primary/20 p-3 transition-colors active:bg-primary/20"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <LayoutDashboard className="h-5 w-5" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-bold text-foreground">Painel do Lojista</p>
          <p className="text-xs text-muted-foreground">Gerencie sua loja e pedidos</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>
    );
  }

  if (role === "motoboy") {
    return (
      <button
        onClick={() => navigate("/driver")}
        className="mx-4 mt-3 flex items-center gap-3 rounded-xl bg-primary/10 border border-primary/20 p-3 transition-colors active:bg-primary/20"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Truck className="h-5 w-5" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-bold text-foreground">Painel do Entregador</p>
          <p className="text-xs text-muted-foreground">Veja entregas disponíveis</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>
    );
  }

  // Cliente
  return (
    <button
      onClick={() => navigate("/pedidos")}
      className="mx-4 mt-3 flex items-center gap-3 rounded-xl bg-primary/10 border border-primary/20 p-3 transition-colors active:bg-primary/20"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <ShoppingBag className="h-5 w-5" />
      </div>
      <div className="flex-1 text-left">
        <p className="text-sm font-bold text-foreground">Olá, {firstName || "Cliente"}! 👋</p>
        <p className="text-xs text-muted-foreground">Acompanhe seus pedidos</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
};

const Index = () => {
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");

  const { data: stores, isLoading } = useQuery({
    queryKey: ["stores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, slug, image_url, category, rating, is_open, force_closed, status, delivery_mode, own_delivery_fee")
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

  const storeIds = useMemo(() => stores?.map(s => s.id) || [], [stores]);

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

  const sorted = useMemo(() => {
    if (!stores) return undefined;
    const withStatus = stores.map(store => {
      const hours = (allHours as any[])?.filter((h: any) => h.store_id === store.id) || [];
      const status = getStoreOpenStatus(hours as OpeningHour[], (store as any).force_closed || false, store.is_open);
      return { ...store, computedOpen: status.isOpen, statusReason: status.reason };
    });
    return withStatus.sort((a, b) => {
      if (a.computedOpen && !b.computedOpen) return -1;
      if (!a.computedOpen && b.computedOpen) return 1;
      return 0;
    });
  }, [stores, allHours]);

  const filtered = useMemo(() => {
    let result = sorted?.filter((s) => category === "all" || s.category === category);
    if (search.length >= 2 && result) {
      const searchLower = search.toLowerCase();
      const matchingStoreIds = new Set<string>();
      result.forEach(s => { if (s.name.toLowerCase().includes(searchLower)) matchingStoreIds.add(s.id); });
      if (products) {
        products.forEach((p: any) => { if (p.name.toLowerCase().includes(searchLower)) matchingStoreIds.add(p.store_id); });
      }
      result = result.filter(s => matchingStoreIds.has(s.id));
    }
    return result;
  }, [sorted, category, search, products]);

  return (
    <div className="min-h-screen bg-background pb-32 overflow-y-auto">
      <AppHeader />

      <div className="px-4 pt-4 space-y-3">
        <h1 className="text-xl font-black text-foreground">
          O que você quer <span className="text-primary">pedir</span> hoje?
        </h1>
        <div data-tour="search">
          <SearchBar value={search} onChange={setSearch} />
        </div>
      </div>

      <PromoBanners />
      <FirstOrderBanner />

      <div data-tour="categories">
        <CategoryScroll selected={category} onSelect={setCategory} />
      </div>

      <ReorderSection />

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
            {filtered.map((store, idx) => (
              <div key={store.id} {...(idx === 0 ? { "data-tour": "store-card" } : {})}>
                <StoreCard {...store} is_open={store.computedOpen} statusReason={store.statusReason} />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <PackageOpen className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-lg font-bold text-foreground mb-1">
              {search.length >= 2 ? "Nenhum resultado encontrado" : stores && stores.length === 0 ? "Estamos chegando!" : category === "farmacias" ? "Ainda não temos farmácias parceiras" : category === "docerias" ? "Ainda não temos docerias parceiras" : "Nenhum estabelecimento nesta categoria"}
            </h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              {search.length >= 2 ? `Nenhuma loja ou produto encontrado para "${search}".` : stores && stores.length === 0 ? "Novas lojas no ItaSuper em breve. Fique ligado!" : "Nenhum estabelecimento aberto no momento. Volte mais tarde!"}
            </p>
          </div>
        )}
      </div>

      <div data-tour="cart-fab">
        <CartFAB />
      </div>
      <BottomNav />
      <ProductTour steps={clienteTourSteps} tourKey="cliente" />
    </div>
  );
};

export default Index;
