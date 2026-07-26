import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bike } from "lucide-react";

interface Props {
  storeId: string;
  onClick?: () => void;
}

/**
 * Card compacto para o Início do painel do lojista:
 * lista quantas entregas cada motoboy da equipe fez hoje e no total.
 * Fonte: store_driver_earnings (inclui delivery normal e manual).
 */
export default function DriverDeliveriesCard({ storeId, onClick }: Props) {
  const { data: drivers } = useQuery({
    queryKey: ["dash-store-drivers", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("store_drivers")
        .select("driver_user_id")
        .eq("store_id", storeId);
      return (data as any[]) || [];
    },
    enabled: !!storeId,
    staleTime: 60_000,
  });

  const ids = (drivers || []).map((d: any) => d.driver_user_id);

  const { data: profiles } = useQuery({
    queryKey: ["dash-driver-profiles", ids.join(",")],
    queryFn: async () => {
      if (!ids.length) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", ids);
      return (data as any[]) || [];
    },
    enabled: ids.length > 0,
    staleTime: 60_000,
  });

  const { data: stats } = useQuery({
    queryKey: ["dash-driver-deliveries", storeId, ids.join(",")],
    queryFn: async () => {
      if (!ids.length) return {} as Record<string, { today: number; total: number }>;
      const { data } = await supabase
        .from("store_driver_earnings" as any)
        .select("driver_user_id, created_at")
        .eq("store_id", storeId)
        .in("driver_user_id", ids);
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const startMs = start.getTime();
      const map: Record<string, { today: number; total: number }> = {};
      (data as any[] || []).forEach((r) => {
        const k = r.driver_user_id;
        if (!map[k]) map[k] = { today: 0, total: 0 };
        map[k].total += 1;
        if (new Date(r.created_at).getTime() >= startMs) map[k].today += 1;
      });
      return map;
    },
    enabled: ids.length > 0,
    refetchInterval: 30_000,
  });

  if (!ids.length) return null;

  const rows = ids.map((id) => {
    const p = (profiles || []).find((x: any) => x.user_id === id);
    const s = (stats || {})[id] || { today: 0, total: 0 };
    return { id, name: p?.full_name || "Motoboy", today: s.today, total: s.total };
  }).sort((a, b) => b.today - a.today);

  const totalHoje = rows.reduce((a, r) => a + r.today, 0);

  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      <button
        onClick={onClick}
        className="w-full flex items-center gap-3 p-4 text-left active:bg-muted/40 transition-colors"
      >
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Bike className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-black text-foreground">Entregas dos motoboys</h3>
          <p className="text-[11px] text-muted-foreground">
            {totalHoje} entrega{totalHoje === 1 ? "" : "s"} hoje · {rows.length} motoboy{rows.length === 1 ? "" : "s"}
          </p>
        </div>
      </button>
      <div className="border-t border-border divide-y divide-border">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between px-4 py-2.5">
            <span className="text-sm font-bold text-foreground truncate">{r.name}</span>
            <div className="flex items-center gap-3 text-[11px] font-bold">
              <span className="text-primary">Hoje: {r.today}</span>
              <span className="text-muted-foreground">Total: {r.total}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
