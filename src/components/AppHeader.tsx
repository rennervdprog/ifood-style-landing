import { memo, useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import ThemeToggle from "@/components/ThemeToggle";

const AppHeader = memo(() => {
  const { neighborhood } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profileNeighborhood, setProfileNeighborhood] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("neighborhood")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.neighborhood) setProfileNeighborhood(data.neighborhood);
      });
  }, [user]);

  const displayNeighborhood = neighborhood || profileNeighborhood;

  return (
    <header className="sticky top-0 z-50 bg-card border-b border-border">
      <div className="flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-2">
          <img src="/itasuper-logo.jpg" alt="ItaSuper" className="w-10 h-10 rounded-lg" width={40} height={40} loading="eager" />
          <span className="text-lg font-black text-primary">ItaSuper</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(user ? "/perfil" : "/auth")}
            className="flex items-center gap-1.5 text-sm bg-muted px-3 py-1.5 rounded-full"
          >
            <MapPin className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold text-foreground max-w-[140px] truncate">
              {displayNeighborhood || "Cadastre seu endereço"}
            </span>
          </button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
});

AppHeader.displayName = "AppHeader";

export default AppHeader;
