import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, MapPin, Route, Bike, Store as StoreIcon, Calendar } from "lucide-react";

/**
 * Histórico operacional de entregas do motoboy.
 *
 * Só métricas de operação (data, loja, bairro, distância, tempo). O ItaSuper é
 * o software que conecta lojista e motoboy — não define, não intermedeia e não
 * tem ciência dos valores combinados entre eles. Por isso esta tela não exibe
 * valor a receber, ganho ou status de pagamento: a plataforma não é parte
 * dessa relação. Ver "Não vinculação" nos Termos de Uso.
 *
 * A fonte é `orders` (RLS: motoboy lê o que entregou), não a tabela legada
 * `store_driver_earnings`.
 */

interface Props {
  storeIds: string[];
}

function haversineKm(lat1?: number | null, lng1?: number | null, lat2?: number | null, lng2?: number | null): number | null {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null;
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

type Period = "7d" | "30d" | "all";

const DriverRideHistory = ({ storeIds }: Props) => {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>("30d");

  const since = useMemo(() => {
    if (period === "all") return null;
    const d = new Date();
    d.setDate(d.getDate() - (period === "7d" ? 7 : 30));
    return d.toISOString();
  }, [period]);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["driver-ride-history", user?.id, period],
    queryFn: async () => {
      let q = supabase
        .from("orders")
        .select("id, created_at, confirmed_at, status, neighborhood, address_details, client_lat, client_lng, store_id")
        .eq("driver_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(period === "all" ? 1000 : 200);
      if (since) q = q.gte("created_at", since);
      const { data, error } = await q;
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!user,
  });

  const storeIdSet = useMemo(() => {
    const s = new Set<string>(storeIds);
    (orders || []).forEach((o: any) => s.add(o.store_id));
    return Array.from(s);
  }, [storeIds, orders]);

  const { data: stores } = useQuery({
    queryKey: ["driver-ride-history-stores", storeIdSet],
    queryFn: async () => {
      if (!storeIdSet.length) return [];
      const { data } = await supabase
        .from("stores_public")
        .select("id, name, latitude, longitude")
        .in("id", storeIdSet);
      return data || [];
    },
    enabled: storeIdSet.length > 0,
  });

  const storesById = useMemo(() => {
    const m = new Map<string, any>();
    (stores || []).forEach((s: any) => m.set(s.id, s));
    return m;
  }, [stores]);

  const enriched = useMemo(() => {
    return (orders || []).map((o) => {
      const s = storesById.get(o.store_id);
      const km = haversineKm(s?.latitude, s?.longitude, o?.client_lat, o?.client_lng);
      // `driver_finish_delivery` sobrescreve `confirmed_at` no momento da
      // entrega, então ele marca o fim da corrida — não o início. Sem um
      // carimbo de início preservado não há como medir duração sem mentir,
      // por isso a tela não exibe tempo.
      const dateISO = o?.confirmed_at || o?.created_at;
      const concluida = o?.status === "entregue" || o?.status === "finalizado";
      return { o, s, km, dateISO, concluida };
    });
  }, [orders, storesById]);

  const totals = useMemo(() => {
    const totalKm = enriched.reduce((sum, r) => sum + (r.km || 0), 0);
    const count = enriched.length;
    const avgKm = count ? totalKm / count : 0;
    const lojas = new Set(enriched.map((r) => r.o.store_id)).size;
    const concluidas = enriched.filter((r) => r.concluida).length;
    return { totalKm, count, avgKm, lojas, concluidas };
  }, [enriched]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Period filter */}
      <div className="flex bg-muted/50 p-1 rounded-2xl">
        {([
          { key: "7d" as const, label: "7 dias" },
          { key: "30d" as const, label: "30 dias" },
          { key: "all" as const, label: "Tudo" },
        ]).map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
              period === p.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-2">
        <SummaryCard icon={<Route className="h-4 w-4 text-primary" />} label="Distância" value={`${totals.totalKm.toFixed(1)} km`} sub={`Média ${totals.avgKm.toFixed(1)} km/entrega`} tooltip="Linha reta loja → cliente (não é a rota real percorrida)." />
        <SummaryCard icon={<Bike className="h-4 w-4 text-primary" />} label="Corridas" value={`${totals.count}`} sub="No período" />
        <SummaryCard icon={<Bike className="h-4 w-4 text-success" />} label="Concluídas" value={`${totals.concluidas}`} sub="Entregues no período" />
        <SummaryCard icon={<StoreIcon className="h-4 w-4 text-success" />} label="Lojas" value={`${totals.lojas}`} sub="Atendidas no período" />
      </div>

      {/* List */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">
          Detalhes das Corridas
        </p>

        {enriched.length === 0 && (
          <div className="text-center py-10 text-xs text-muted-foreground bg-card border border-border rounded-2xl">
            Nenhuma corrida no período.
          </div>
        )}

        {enriched.map(({ o, s, km, dateISO, concluida }) => {
          const date = new Date(dateISO);
          return (
            <div key={o.id} className="bg-card border border-border rounded-2xl p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-black text-foreground truncate">
                    {s?.name || "Loja"}
                  </p>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Calendar className="h-3 w-3" />
                    {date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    {" · #"}
                    {String(o.id).slice(0, 6).toUpperCase()}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-[10px] font-bold uppercase ${concluida ? "text-success" : "text-warning"}`}>
                    {concluida ? "Entregue" : "Em andamento"}
                  </p>
                </div>
              </div>

              {(o?.neighborhood || o?.address_details) && (
                <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                  <MapPin className="h-3 w-3 mt-0.5 shrink-0 text-primary" />
                  <span className="truncate">
                    {[o?.neighborhood, o?.address_details].filter(Boolean).join(" · ")}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <Metric icon={<Route className="h-3 w-3" />} label="Distância" value={km != null ? `${km.toFixed(1)} km` : "—"} />
                <Metric icon={<StoreIcon className="h-3 w-3" />} label="Bairro" value={o?.neighborhood || "—"} />
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground text-center px-3 leading-relaxed">
        Distância calculada em linha reta (loja → cliente), não é a rota real percorrida.
        Os valores da entrega são combinados diretamente entre você e a loja — o ItaSuper não participa dessa negociação.
      </p>
    </div>
  );
};

function SummaryCard({ icon, label, value, sub, tooltip }: { icon: React.ReactNode; label: string; value: string; sub?: string; tooltip?: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-3" title={tooltip}>
      <div className="flex items-center gap-1.5 mb-1">{icon}<span className="text-[10px] font-bold text-muted-foreground uppercase">{label}</span></div>
      <p className="text-base font-black text-foreground">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-muted/40 rounded-xl px-2 py-1.5">
      <div className="flex items-center gap-1 text-muted-foreground">{icon}<span className="text-[9px] font-bold uppercase">{label}</span></div>
      <p className="text-[11px] font-black text-foreground mt-0.5 tabular-nums">{value}</p>
    </div>
  );
}

export default DriverRideHistory;
