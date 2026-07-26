import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Store as StoreIcon, Clock } from "lucide-react";
import { getStoreOpenStatus, type OpeningHour } from "@/lib/storeStatus";

interface Unit {
  id: string;
  name: string;
  slug: string | null;
  image_url: string | null;
  address_city: string | null;
  address_neighborhood: string | null;
  is_open: boolean | null;
  force_closed: boolean | null;
  delivery_mode: string | null;
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
        .select("id, name, slug, image_url, address_city, address_neighborhood, is_open, force_closed, delivery_mode")
        .eq("network_id", networkId)
        .neq("id", currentStoreId)
        .order("name", { ascending: true })
        .limit(20);
      return (data || []) as Unit[];
    },
    enabled: !!networkId && !!currentStoreId,
    staleTime: 1000 * 60 * 5,
  });

  const unitIds = (units || []).map((u) => u.id);
  const { data: hoursMap } = useQuery({
    queryKey: ["network-units-hours", unitIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("opening_hours")
        .select("store_id, day_of_week, open_time, close_time, is_closed_all_day")
        .in("store_id", unitIds);
      const map: Record<string, OpeningHour[]> = {};
      (data || []).forEach((h: any) => {
        (map[h.store_id] ||= []).push(h);
      });
      return map;
    },
    enabled: unitIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  if (!units || units.length === 0) return null;

  const go = (u: Unit) => navigate(u.slug ? `/${u.slug}` : `/loja/${u.id}`);

  const deliveryLabels = (mode: string | null) => {
    const parts: string[] = [];
    if (mode === "own" || mode === "both" || mode === "platform") parts.push("Entrega");
    if (mode === "pickup" || mode === "both" || !mode) parts.unshift("Retirada");
    if (parts.length === 0) parts.push("Entrega");
    return parts;
  };

  return (
    <div className="px-5 mt-4">
      <h3 className="text-[15px] font-black text-foreground mb-3">Nossas unidades</h3>
      <div className="flex flex-col gap-2.5">
        {units.map((u) => {
          const hours = hoursMap?.[u.id] || [];
          const status = getStoreOpenStatus(hours, !!u.force_closed, !!u.is_open);
          const methods = deliveryLabels(u.delivery_mode);
          return (
            <button
              key={u.id}
              onClick={() => go(u)}
              className="text-left flex items-center gap-3 p-3 rounded-2xl bg-card border border-border/60 hover:border-border transition-colors active:scale-[0.99]"
            >
              <div className="h-14 w-14 shrink-0 rounded-xl bg-muted overflow-hidden flex items-center justify-center">
                {u.image_url ? (
                  <img loading="lazy" src={u.image_url} alt={u.name} className="w-full h-full object-cover" />
                ) : (
                  <StoreIcon className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold text-foreground line-clamp-1">{u.name}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {methods.map((m, i) => (
                    <span key={m}>
                      {i > 0 ? " • " : "• "}
                      {m}
                    </span>
                  ))}
                </p>
                <p
                  className={`flex items-center gap-1 text-[11px] font-semibold mt-0.5 ${
                    status.isOpen ? "text-emerald-500" : "text-primary"
                  }`}
                >
                  <Clock className="h-3 w-3" />
                  {status.reason}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}