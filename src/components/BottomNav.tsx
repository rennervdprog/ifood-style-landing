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

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border pb-safe">
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const active = isActive(tab.path);
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              data-tour={tab.label === "Pedidos" ? "nav-pedidos" : undefined}
              className={`flex flex-col items-center gap-0.5 px-4 py-2 transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <tab.icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
              <span className="text-[10px] font-bold">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
});

BottomNav.displayName = "BottomNav";

export default BottomNav;
