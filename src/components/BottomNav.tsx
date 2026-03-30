import { Home, ClipboardList, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

const tabs = [
  { icon: Home, label: "Home", path: "/" },
  { icon: ClipboardList, label: "Pedidos", path: "/pedidos" },
  { icon: User, label: "Perfil", path: "/perfil" },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border pb-safe">
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const active = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
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
