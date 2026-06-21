import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, Users, Calendar, TrendingUp, Store, Smartphone, Globe } from "lucide-react";

interface Stats {
  today: number;
  unique_today: number;
  week: number;
  month: number;
  total: number;
  funnel_7d?: Record<string, number> | null;
  top_stores_7d?: { store_id: string; views: number }[];
  top_sources_7d?: { source: string; views: number }[];
  devices_7d?: Record<string, number> | null;
}

const PageViewsCard = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [storeNames, setStoreNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data, error } = await supabase.rpc("get_page_view_stats", {
      _page: "store_directory",
    });
    if (!error && data) {
      const s = data as unknown as Stats;
      setStats(s);
      const ids = (s.top_stores_7d || []).map((t) => t.store_id).filter(Boolean);
      if (ids.length) {
        const { data: ss } = await supabase.from("stores").select("id,name").in("id", ids);
        const map: Record<string, string> = {};
        (ss || []).forEach((r: any) => { map[r.id] = r.name; });
        setStoreNames(map);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, []);

  const items = [
    { label: "Hoje", value: stats?.today ?? 0, icon: Eye, color: "text-primary" },
    { label: "Únicos hoje", value: stats?.unique_today ?? 0, icon: Users, color: "text-blue-500" },
    { label: "7 dias", value: stats?.week ?? 0, icon: Calendar, color: "text-emerald-500" },
    { label: "30 dias", value: stats?.month ?? 0, icon: TrendingUp, color: "text-amber-500" },
  ];

  // Funil 7d: home → loja → checkout → cadastro
  const funnel = stats?.funnel_7d || {};
  const fHome = funnel["store_directory"] || 0;
  const fStore = funnel["store_page"] || 0;
  const fCheckout = funnel["checkout"] || 0;
  const fCadLojista = funnel["cadastro_lojista"] || 0;
  const fCadEntregador = funnel["cadastro_entregador"] || 0;

  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

  const funnelSteps = [
    { label: "Home (página inicial)", value: fHome, base: fHome },
    { label: "Página de loja", value: fStore, base: fHome },
    { label: "Checkout", value: fCheckout, base: fStore || fHome },
  ];

  return (
    <Card className="border-border/60">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-foreground">Visitas — Página inicial</h3>
            <p className="text-xs text-muted-foreground">Excluindo admin, moderadores e contas internas</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">Total</p>
            <p className="text-lg font-black text-foreground">{stats?.total ?? 0}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="bg-muted/40 rounded-xl p-3 border border-border/40">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className={`h-3.5 w-3.5 ${item.color}`} />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase">{item.label}</span>
                </div>
                <p className="text-xl font-black text-foreground">
                  {loading ? "—" : item.value}
                </p>
              </div>
            );
          })}
        </div>

        {/* Funil de conversão (7 dias) */}
        <div className="mt-4">
          <p className="text-[11px] font-bold text-muted-foreground uppercase mb-2">Funil — últimos 7 dias</p>
          <div className="space-y-1.5">
            {funnelSteps.map((s, i) => {
              const p = i === 0 ? 100 : pct(s.value, s.base);
              return (
                <div key={s.label} className="flex items-center gap-2">
                  <span className="text-[11px] text-foreground w-40 shrink-0">{s.label}</span>
                  <div className="flex-1 h-5 bg-muted/40 rounded overflow-hidden relative">
                    <div className="h-full bg-primary/70" style={{ width: `${Math.min(100, p)}%` }} />
                    <span className="absolute inset-0 flex items-center justify-end pr-2 text-[10px] font-bold text-foreground">
                      {s.value} {i > 0 && `(${p}%)`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          {(fCadLojista > 0 || fCadEntregador > 0) && (
            <div className="flex gap-3 mt-2 text-[11px] text-muted-foreground">
              <span>Cadastro lojista: <b className="text-foreground">{fCadLojista}</b></span>
              <span>Cadastro entregador: <b className="text-foreground">{fCadEntregador}</b></span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-4">
          {/* Top lojas */}
          <div className="bg-muted/30 rounded-xl p-3 border border-border/40">
            <p className="text-[11px] font-bold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
              <Store className="h-3.5 w-3.5" /> Top lojas (7d)
            </p>
            {(stats?.top_stores_7d || []).length === 0 ? (
              <p className="text-[11px] text-muted-foreground">Sem dados ainda</p>
            ) : (
              <ul className="space-y-1">
                {(stats?.top_stores_7d || []).slice(0, 5).map((t) => (
                  <li key={t.store_id} className="flex justify-between text-[11px]">
                    <span className="truncate">{storeNames[t.store_id] || t.store_id.slice(0, 8)}</span>
                    <span className="font-bold text-foreground">{t.views}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {/* Top fontes */}
          <div className="bg-muted/30 rounded-xl p-3 border border-border/40">
            <p className="text-[11px] font-bold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" /> Fontes (7d)
            </p>
            {(stats?.top_sources_7d || []).length === 0 ? (
              <p className="text-[11px] text-muted-foreground">Sem dados ainda</p>
            ) : (
              <ul className="space-y-1">
                {(stats?.top_sources_7d || []).slice(0, 5).map((t) => (
                  <li key={t.source} className="flex justify-between text-[11px]">
                    <span className="truncate capitalize">{t.source}</span>
                    <span className="font-bold text-foreground">{t.views}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {/* Devices */}
          <div className="bg-muted/30 rounded-xl p-3 border border-border/40">
            <p className="text-[11px] font-bold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
              <Smartphone className="h-3.5 w-3.5" /> Dispositivos (7d)
            </p>
            {Object.keys(stats?.devices_7d || {}).length === 0 ? (
              <p className="text-[11px] text-muted-foreground">Sem dados ainda</p>
            ) : (
              <ul className="space-y-1">
                {Object.entries(stats?.devices_7d || {}).map(([k, v]) => (
                  <li key={k} className="flex justify-between text-[11px]">
                    <span className="capitalize">{k}</span>
                    <span className="font-bold text-foreground">{v as number}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PageViewsCard;
