import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import ThemeToggle from "@/components/ThemeToggle";

const AppHeader = () => {
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
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-black text-xs">iD</span>
          </div>
          <span className="text-lg font-black text-primary">Delivery</span>
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
};

export default AppHeader;
