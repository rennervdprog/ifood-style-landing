import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, Users, Calendar, TrendingUp } from "lucide-react";

interface Stats {
  today: number;
  unique_today: number;
  week: number;
  month: number;
  total: number;
}

const PageViewsCard = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data, error } = await supabase.rpc("get_page_view_stats", {
      _page: "store_directory",
    });
    if (!error && data) setStats(data as unknown as Stats);
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
      </CardContent>
    </Card>
  );
};

export default PageViewsCard;
