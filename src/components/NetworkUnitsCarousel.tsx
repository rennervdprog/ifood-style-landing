import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Store as StoreIcon, ChevronRight } from "lucide-react";

interface Unit {
  id: string;
  name: string;
  slug: string | null;
  image_url: string | null;
  address_city: string | null;
  address_neighborhood: string | null;
  is_open: boolean | null;
  force_closed: boolean | null;
}

export default function NetworkUnitsCarousel({
  networkId,
  currentStoreId,
}: {
  networkId: string;
  currentStoreId: string;
}) {
  const navigate = useNavigate();

  const { data: units } = useQuery({
    queryKey: ["network-units", networkId, currentStoreId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("stores_public")
        .select("id, name, slug, image_url, address_city, address_neighborhood, is_open, force_closed")
        .eq("network_id", networkId)
        .neq("id", currentStoreId)
        .limit(20);
      return (data || []) as Unit[];
    },
    enabled: !!networkId && !!currentStoreId,
    staleTime: 1000 * 60 * 5,
  });

  if (!units || units.length === 0) return null;

  const go = (u: Unit) => navigate(u.slug ? `/${u.slug}` : `/loja/${u.id}`);

  return (
    <div className="px-5 mt-3">
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center">
              <StoreIcon className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <h3 className="text-[13px] font-black text-foreground leading-none">Nossas outras unidades</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {units.length} {units.length === 1 ? "loja" : "lojas"} desta rede
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-2.5 overflow-x-auto -mx-1 px-1 pb-1 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {units.map((u) => {
            const open = u.is_open && !u.force_closed;
            return (
              <button
                key={u.id}
                onClick={() => go(u)}
                className="snap-start shrink-0 w-[160px] text-left bg-card rounded-xl border border-border/60 overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all active:scale-[0.98]"
              >
                <div className="relative h-20 bg-muted">
                  {u.image_url ? (
                    <img loading="lazy" src={u.image_url} alt={u.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                      <StoreIcon className="h-6 w-6 text-primary/60" />
                    </div>
                  )}
                  <span
                    className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide ${
                      open ? "bg-emerald-500 text-white" : "bg-zinc-700 text-white"
                    }`}
                  >
                    {open ? "Aberta" : "Fechada"}
                  </span>
                </div>
                <div className="p-2.5">
                  <p className="text-[12px] font-bold text-foreground line-clamp-1">{u.name}</p>
                  {(u.address_neighborhood || u.address_city) && (
                    <p className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground line-clamp-1">
                      <MapPin className="h-2.5 w-2.5 shrink-0" />
                      {[u.address_neighborhood, u.address_city].filter(Boolean).join(", ")}
                    </p>
                  )}
                  <div className="flex items-center justify-end mt-1.5 text-primary text-[10px] font-bold">
                    Acessar <ChevronRight className="h-3 w-3" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}