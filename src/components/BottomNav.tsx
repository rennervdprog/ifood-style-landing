import { Home, ClipboardList, User, Store } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useStoreContext } from "@/contexts/StoreContext";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentStoreSlug, currentStoreId } = useStoreContext();
  const { user } = useAuth();

  // Check if logged-in user is a lojista
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

  // Get lojista's own store
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

  const isLojista = profile?.role === "lojista";
  const isStoreContext = !!currentStoreSlug;

  const tabs = isStoreContext
    ? [
        { icon: Store, label: "Loja", path: `/${currentStoreSlug}` },
        { icon: ClipboardList, label: "Pedidos", path: `/pedidos?store=${currentStoreId}` },
        { icon: User, label: "Perfil", path: "/perfil" },
      ]
    : isLojista && ownStore
    ? [
        { icon: Store, label: "Minha Loja", path: `/loja/${ownStore.id}` },
        { icon: ClipboardList, label: "Pedidos", path: "/pedidos" },
        { icon: User, label: "Perfil", path: "/perfil" },
      ]
    : [
        { icon: Home, label: "Home", path: "/" },
        { icon: ClipboardList, label: "Pedidos", path: "/pedidos" },
        { icon: User, label: "Perfil", path: "/perfil" },
      ];

  const isActive = (tabPath: string) => {
    const [path] = tabPath.split("?");
    if (path === "/" && location.pathname === "/") return true;
    if (path === "/pedidos" && location.pathname === "/pedidos") return true;
    if (path === "/perfil" && location.pathname === "/perfil") return true;
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
};

export default BottomNav;
