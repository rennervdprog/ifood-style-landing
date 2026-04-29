import { memo, useMemo } from "react";
 import { Home, ClipboardList, User, Store, LayoutDashboard } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useStoreContext } from "@/contexts/StoreContext";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
 import { supabase } from "@/integrations/supabase/client";
 import { isPartnerCapacitorApp } from "@/lib/capacitorAppMode";

const BottomNav = memo(() => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentStoreSlug, currentStoreId } = useStoreContext();
   const { user } = useAuth();
   const isPartnerApp = isPartnerCapacitorApp();

  const { data: profile } = useQuery({
    queryKey: ["bottom-nav-profile", user?.id],
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

  const { data: ownStore } = useQuery({
    queryKey: ["own-store", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("stores")
        .select("id, slug")
        .eq("owner_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user && profile?.role === "lojista",
    staleTime: 1000 * 60 * 5,
  });

   const isLojista = (profile as any)?.role === "lojista";
   const isMotoboy = (profile as any)?.role === "motoboy" || (profile as any)?.role === "entregador";
  const isStoreContext = !!currentStoreSlug;

  const tabs = useMemo(() => {
    if (isStoreContext) {
      return [
        { icon: Store, label: "Loja", path: `/${currentStoreSlug}` },
        { icon: ClipboardList, label: "Pedidos", path: `/pedidos?store=${currentStoreId}` },
        { icon: User, label: "Perfil", path: "/perfil" },
      ];
    }
    if (isLojista && ownStore) {
      return [
        { icon: Store, label: "Minha Loja", path: ownStore.slug ? `/${ownStore.slug}` : `/loja/${ownStore.id}` },
        { icon: ClipboardList, label: "Pedidos", path: "/pedidos" },
        { icon: User, label: "Perfil", path: "/perfil" },
      ];
    }
     if (isPartnerApp) {
       if (!user) return [];
       const baseTabs = [];
       if (isLojista) {
         baseTabs.push({ icon: LayoutDashboard, label: "Painel", path: "/admin" });
       } else if (isMotoboy) {
         baseTabs.push({ icon: LayoutDashboard, label: "Entregas", path: "/entregador" });
       }
       baseTabs.push({ icon: ClipboardList, label: "Pedidos", path: "/pedidos" });
       baseTabs.push({ icon: User, label: "Perfil", path: "/perfil" });
       return baseTabs;
     }
     return [
       { icon: Home, label: "Home", path: "/cliente" },
       { icon: ClipboardList, label: "Pedidos", path: "/pedidos" },
       { icon: User, label: "Perfil", path: "/perfil" },
     ];
   }, [isStoreContext, currentStoreSlug, currentStoreId, isLojista, ownStore, isPartnerApp, user, isMotoboy]);

  const isActive = (tabPath: string) => {
    const [path] = tabPath.split("?");
    if (path === "/" && location.pathname === "/") return true;
    if (path === "/cliente" && location.pathname === "/cliente") return true;
    if (path === "/pedidos" && location.pathname === "/pedidos") return true;
     if (path === "/perfil" && location.pathname === "/perfil") return true;
     if (path === "/admin" && location.pathname === "/admin") return true;
     if (path === "/entregador" && location.pathname === "/entregador") return true;
    if (path.startsWith("/loja/") && location.pathname === path) return true;
    if (currentStoreSlug && location.pathname === `/${currentStoreSlug}`) return path === `/${currentStoreSlug}`;
    if (location.pathname.startsWith("/loja/") && path === `/${currentStoreSlug}`) return true;
    return false;
  };

   if (isPartnerApp && !user) return null;
   if (tabs.length === 0) return null;
 
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-t border-border/40 safe-area-bottom shadow-[0_-8px_30px_rgb(0,0,0,0.04)]">
      <div className="mx-auto max-w-md h-16 flex items-stretch justify-around px-2">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              data-tour={tab.label === "Pedidos" ? "nav-pedidos" : undefined}
              className={`relative flex-1 flex flex-col items-center justify-center transition-all duration-200 group active:scale-95 ${
                active 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-all duration-300 ${
                active ? "bg-primary/10" : "group-hover:bg-accent/50"
              }`}>
                <tab.icon 
                  className={`h-5 w-5 transition-transform duration-300 ${active ? "scale-110" : "group-hover:scale-105"}`} 
                  strokeWidth={active ? 2.5 : 2} 
                />
              </div>
              <span className={`text-[11px] font-medium mt-1 transition-all duration-200 ${
                active ? "opacity-100 font-bold tracking-tight" : "opacity-70"
              }`}>
                {tab.label}
              </span>
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
});

BottomNav.displayName = "BottomNav";

export default BottomNav;
