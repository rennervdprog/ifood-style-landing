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
     <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border/50 shadow-sm">
       <div className="flex items-center justify-between px-6 h-16">
         <div className="flex items-center gap-3 group cursor-pointer" onClick={() => navigate("/lojas")}>
           <div className="relative">
             <img src="/logo-itasuper-128.webp" alt="ItaSuper" className="w-10 h-10 rounded-2xl shadow-lg group-hover:scale-105 transition-transform duration-300" width={40} height={40} loading="eager" />
             <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full animate-pulse" />
           </div>
           <span className="text-xl font-black tracking-tighter text-foreground group-hover:text-primary transition-colors">Ita<span className="text-primary">Super</span></span>
         </div>
 
         <div className="flex items-center gap-3">
           <button
             onClick={() => navigate(user ? "/perfil" : "/auth")}
             className="flex items-center gap-2 text-xs bg-muted/50 hover:bg-primary/10 border border-border/50 px-4 py-2 rounded-[1.25rem] transition-all active:scale-95 group"
           >
             <MapPin className="h-4 w-4 text-primary group-hover:animate-bounce" />
             <div className="flex flex-col items-start leading-none">
               <span className="text-[9px] uppercase font-black text-muted-foreground mb-0.5 tracking-widest">Entregar em</span>
               <span className="font-bold text-foreground max-w-[110px] truncate">
                 {displayNeighborhood || "Definir local"}
               </span>
             </div>
           </button>
           <div className="p-1 bg-muted/50 rounded-full border border-border/50">
             <ThemeToggle />
           </div>
         </div>
       </div>
     </header>
  );
});

AppHeader.displayName = "AppHeader";

export default AppHeader;
