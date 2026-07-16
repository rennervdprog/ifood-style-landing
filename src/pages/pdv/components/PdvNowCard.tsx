import { useQuery } from "@tanstack/react-query";
import { Activity, TrendingUp, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";

interface Props {
  sessionId?: string | null;
  vendasTotal: number;
  vendasCount: number;
  ticketMedio: number;
}

/**
 * Dashboard "Agora" — visão em tempo real do turno atual: totais, ticket médio,
 * top 3 produtos e últimas 5 vendas. Fica acima do catálogo na tela de venda.
 */
export const PdvNowCard = ({ sessionId, vendasTotal, vendasCount, ticketMedio }: Props) => {
  const { data } = useQuery({
    queryKey: ["pdv-now", sessionId],
    enabled: !!sessionId,
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data: orders } = await supabase
        .from("orders")
        .select("id, total_price, created_at, status")
        .eq("pdv_session_id", sessionId!)
        .order("created_at", { ascending: false });
      const ok = (orders || []).filter((o: any) => o.status !== "cancelado");
      const ids = ok.map((o: any) => o.id);
      let topProducts: { name: string; qty: number }[] = [];
      if (ids.length) {
        const { data: items } = await supabase
          .from("order_items")
          .select("product_id, quantity, products(name)")
          .in("order_id", ids);
        const map = new Map<string, { name: string; qty: number }>();
        (items || []).forEach((it: any) => {
          const name = it.products?.name || "Produto";
          const cur = map.get(it.product_id) || { name, qty: 0 };
          cur.qty += Number(it.quantity || 0);
          map.set(it.product_id, cur);
        });
        topProducts = Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 3);
      }
      return {
        lastSales: ok.slice(0, 5).map((o: any) => ({
          id: o.id,
          total: Number(o.total_price || 0),
          at: o.created_at as string,
        })),
        topProducts,
      };
    },
  });

  const lastSales = data?.lastSales ?? [];
  const topProducts = data?.topProducts ?? [];

  return (
    <div className="border-b border-border bg-gradient-to-r from-primary/5 via-background to-background px-3 py-2 shrink-0">
      <div className="flex items-center gap-2 mb-2">
        <Activity className="h-3.5 w-3.5 text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Agora</span>
        <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> ao vivo
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-2">
        <Stat label="Vendas" value={formatBRL(vendasTotal)} />
        <Stat label="Pedidos" value={String(vendasCount)} />
        <Stat label="Ticket médio" value={formatBRL(ticketMedio)} />
      </div>
      {(topProducts.length > 0 || lastSales.length > 0) && (
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/60">
          <div>
            <div className="flex items-center gap-1 mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <TrendingUp className="h-3 w-3" /> Top 3
            </div>
            {topProducts.length === 0 ? (
              <div className="text-[11px] text-muted-foreground">—</div>
            ) : topProducts.map((p, i) => (
              <div key={i} className="flex justify-between text-[11px]">
                <span className="truncate text-foreground/80">{i + 1}. {p.name}</span>
                <span className="pdv-mono font-semibold text-foreground">{p.qty}x</span>
              </div>
            ))}
          </div>
          <div>
            <div className="flex items-center gap-1 mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <Clock className="h-3 w-3" /> Últimas
            </div>
            {lastSales.length === 0 ? (
              <div className="text-[11px] text-muted-foreground">—</div>
            ) : lastSales.map((s) => (
              <div key={s.id} className="flex justify-between text-[11px]">
                <span className="text-foreground/80">{new Date(s.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                <span className="pdv-mono font-semibold text-emerald-600">{formatBRL(s.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-card border border-border rounded-md px-2 py-1.5">
    <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="text-sm font-black pdv-mono text-foreground truncate">{value}</div>
  </div>
);