import { Home, ClipboardList, User, Store } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useStoreContext } from "@/contexts/StoreContext";

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentStoreSlug, currentStoreId } = useStoreContext();

  // If we're in a store context (client accessed via slug), show store-scoped nav
  const isStoreContext = !!currentStoreSlug;

  const tabs = isStoreContext
    ? [
        { icon: Store, label: "Loja", path: `/${currentStoreSlug}` },
        { icon: ClipboardList, label: "Pedidos", path: `/pedidos?store=${currentStoreId}` },
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
    // For store slug paths
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
