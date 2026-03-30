import { useEffect, useState } from "react";
import { MapPin, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";

interface NeighborhoodFee {
  id: string;
  name: string;
  fee: number;
}

const AppHeader = () => {
  const { neighborhood, setNeighborhood } = useCart();
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodFee[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    supabase.from("neighborhood_fees").select("*").order("name").then(({ data }) => {
      if (data) setNeighborhoods(data);
    });
  }, []);

  const urban = neighborhoods.filter((n) => n.fee <= 4);
  const rural = neighborhoods.filter((n) => n.fee > 4);

  return (
    <header className="sticky top-0 z-50 bg-card border-b border-border">
      <div className="flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-black text-xs">iD</span>
          </div>
          <span className="text-lg font-black text-primary">Delivery</span>
        </div>

        <div className="relative">
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-1.5 text-sm bg-muted px-3 py-1.5 rounded-full"
          >
            <MapPin className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold text-foreground max-w-[120px] truncate">
              {neighborhood || "Selecionar bairro"}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>

          {open && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-card rounded-xl shadow-lg border border-border py-1 max-h-80 overflow-y-auto z-50">
              {urban.length > 0 && (
                <>
                  <div className="px-4 py-2 text-xs font-bold text-primary uppercase tracking-wider bg-primary/5">
                    Zona Urbana — R$ 4,00
                  </div>
                  {urban.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => {
                        setNeighborhood(n.name, n.fee);
                        setOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors flex justify-between ${
                        neighborhood === n.name ? "text-primary font-bold" : "text-foreground"
                      }`}
                    >
                      <span>{n.name}</span>
                      <span className="text-muted-foreground">R$ {n.fee.toFixed(2)}</span>
                    </button>
                  ))}
                </>
              )}
              {rural.length > 0 && (
                <>
                  <div className="px-4 py-2 text-xs font-bold text-destructive uppercase tracking-wider bg-destructive/5 mt-1">
                    Zona Rural / Afastados — R$ 12,00
                  </div>
                  {rural.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => {
                        setNeighborhood(n.name, n.fee);
                        setOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors flex justify-between ${
                        neighborhood === n.name ? "text-primary font-bold" : "text-foreground"
                      }`}
                    >
                      <span>{n.name}</span>
                      <span className="text-muted-foreground">R$ {n.fee.toFixed(2)}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
