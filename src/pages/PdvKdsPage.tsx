/**
 * KDS — Kitchen Display System (Fase 5)
 *
 * Tela fullscreen para cozinha: lista pedidos em preparo em cards grandes,
 * com tempo desde recebimento e um clique para avançar status:
 *   pendente → preparando → pronto_para_entrega/finalizado
 *
 * Atualiza via Realtime + polling backup de 10s (à prova de falha de socket).
 * Multi-terminal: qualquer PDV/tablet aberto na mesma URL vê o mesmo estado.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ArrowLeft, ChefHat, Clock, CheckCircle2, Loader2 } from "lucide-react";

type KdsOrder = {
  id: string;
  status: string;
  created_at: string;
  confirmed_at: string | null;
  order_source: string | null;
  address_details: any;
  order_items: Array<{
    id: string;
    quantity: number;
    observations: string | null;
    addons: any;
    products: { name: string } | null;
  }>;
};

const ACTIVE_STATUSES = ["pendente", "preparando", "pronto_para_entrega"];

function minutesSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

function nextStatus(current: string): string | null {
  if (current === "pendente") return "preparando";
  if (current === "preparando") return "pronto_para_entrega";
  return null; // pronto → sai da tela; balcão finaliza pelo PDV
}

function statusLabel(s: string): string {
  return ({
    pendente: "Novo",
    preparando: "Em preparo",
    pronto_para_entrega: "Pronto",
  } as Record<string, string>)[s] || s;
}

function urgencyClass(mins: number, status: string): string {
  if (status === "pronto_para_entrega") return "border-emerald-500/60 bg-emerald-500/5";
  if (mins >= 20) return "border-red-500/70 bg-red-500/10 animate-pulse";
  if (mins >= 10) return "border-amber-500/60 bg-amber-500/5";
  return "border-border/50 bg-card";
}

export default function PdvKdsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [orders, setOrders] = useState<KdsOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [, forceTick] = useState(0);
  const pollRef = useRef<number | null>(null);

  // Descobre store_id do lojista logado.
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      // 1) Super admin: usa a loja selecionada no PDV (mesma chave).
      try {
        const adminStore = localStorage.getItem("pdv_admin_selected_store");
        if (adminStore) { setStoreId(adminStore); return; }
      } catch {}
      // 2) Cache local da última loja aberta no PDV.
      try {
        const raw = localStorage.getItem("pdv_store_v1");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.id) { setStoreId(parsed.id); return; }
        }
      } catch {}
      // 3) Fallback: dono da loja.
      const { data } = await supabase.from("stores").select("id").eq("owner_id", user.id).maybeSingle();
      if (data?.id) setStoreId(data.id);
    })();
  }, [user?.id]);

  // Recarrega tempo a cada 30s (para atualizar contadores).
  useEffect(() => {
    const t = window.setInterval(() => forceTick((n) => n + 1), 30000);
    return () => window.clearInterval(t);
  }, []);

  const fetchOrders = useMemo(() => async () => {
    if (!storeId) return;
    const { data, error } = await supabase
      .from("orders")
      .select("id, status, created_at, confirmed_at, order_source, address_details, order_items(id, quantity, observations, addons, products(name))")
      .eq("store_id", storeId)
      .in("status", ACTIVE_STATUSES as any)
      .order("created_at", { ascending: true })
      .limit(80);
    if (error) { console.error("[KDS] fetch:", error); return; }
    setOrders((data as any[])?.map((o) => ({ ...o, order_items: o.order_items || [] })) || []);
    setLoading(false);
  }, [storeId]);

  useEffect(() => {
    if (!storeId) return;
    fetchOrders();
    // Polling backup — 10s.
    pollRef.current = window.setInterval(fetchOrders, 10000);
    // Realtime — pode falhar silenciosamente; o polling cobre.
    const ch = supabase
      .channel(`kds-${storeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `store_id=eq.${storeId}` }, fetchOrders)
      .subscribe();
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      supabase.removeChannel(ch);
    };
  }, [storeId, fetchOrders]);

  const advance = async (order: KdsOrder) => {
    const target = nextStatus(order.status);
    if (!target) return;
    setUpdatingId(order.id);
    // Otimista: remove/atualiza no local antes da rede.
    setOrders((prev) =>
      target === "pronto_para_entrega" && (order.order_source === "balcao" || order.order_source === "pdv")
        ? prev.filter((o) => o.id !== order.id)
        : prev.map((o) => (o.id === order.id ? { ...o, status: target } : o)),
    );
    const { error } = await supabase.from("orders").update({ status: target as any }).eq("id", order.id);
    setUpdatingId(null);
    if (error) { toast.error("Não foi possível atualizar o pedido."); fetchOrders(); return; }
    if (target === "pronto_para_entrega") toast.success("Pedido pronto!");
  };

  const grouped = useMemo(() => {
    const g: Record<string, KdsOrder[]> = { novos: [], preparo: [], prontos: [] };
    for (const o of orders) {
      if (o.status === "preparando") g.preparo.push(o);
      else if (o.status === "pronto_para_entrega") g.prontos.push(o);
      else g.novos.push(o);
    }
    return g;
  }, [orders]);

  if (!storeId) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 text-muted-foreground p-6 text-center">
        <ChefHat className="h-8 w-8 text-primary" />
        <p className="text-sm font-bold">Nenhuma loja ativa selecionada.</p>
        <p className="text-xs">Abra o PDV primeiro e escolha uma loja para carregar o KDS.</p>
        <button
          onClick={() => navigate("/admin/pdv")}
          className="mt-2 h-10 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-black uppercase"
        >
          Ir para o PDV
        </button>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando KDS…
      </div>
    );
  }

  const columns: Array<{ key: keyof typeof grouped; title: string; icon: any; accent: string }> = [
    { key: "novos", title: "Novos", icon: Clock, accent: "text-blue-500" },
    { key: "preparo", title: "Em preparo", icon: ChefHat, accent: "text-amber-500" },
    { key: "prontos", title: "Prontos", icon: CheckCircle2, accent: "text-emerald-500" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-card">
        <button
          onClick={() => navigate("/admin/pdv")}
          className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <div className="flex items-center gap-2">
          <ChefHat className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-black tracking-tight">Cozinha (KDS)</h1>
        </div>
        <div className="text-xs text-muted-foreground pdv-mono">{orders.length} ativos</div>
      </header>

      <main className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 p-3 overflow-auto">
        {columns.map(({ key, title, icon: Icon, accent }) => (
          <section key={key} className="flex flex-col min-h-0">
            <div className={`flex items-center gap-2 mb-2 ${accent}`}>
              <Icon className="h-4 w-4" />
              <h2 className="text-sm font-black uppercase tracking-wide">{title}</h2>
              <span className="text-xs font-bold text-muted-foreground">({grouped[key].length})</span>
            </div>
            <div className="flex-1 overflow-auto space-y-2 pr-1">
              {grouped[key].length === 0 && (
                <div className="text-xs text-muted-foreground/60 text-center py-8">—</div>
              )}
              {grouped[key].map((o) => {
                const mins = minutesSince(o.confirmed_at || o.created_at);
                const target = nextStatus(o.status);
                const source = o.order_source === "pdv" || o.order_source === "balcao" ? "Balcão" : "Delivery";
                return (
                  <article
                    key={o.id}
                    className={`rounded-xl border-2 p-3 transition-colors ${urgencyClass(mins, o.status)}`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="text-[10px] font-black uppercase text-muted-foreground">
                        #{o.id.slice(0, 6)} · {source}
                      </div>
                      <div className={`text-xs font-black pdv-mono ${mins >= 20 ? "text-red-500" : mins >= 10 ? "text-amber-500" : "text-muted-foreground"}`}>
                        {mins}min
                      </div>
                    </div>
                    <ul className="space-y-1 mb-2">
                      {o.order_items.map((it) => (
                        <li key={it.id} className="text-sm leading-tight">
                          <span className="font-black">{it.quantity}×</span>{" "}
                          <span className="font-bold">{it.products?.name || "Item"}</span>
                          {it.observations && (
                            <div className="text-[11px] text-muted-foreground italic ml-4">↳ {it.observations}</div>
                          )}
                          {Array.isArray(it.addons) && it.addons.length > 0 && (
                            <div className="text-[11px] text-muted-foreground ml-4">
                              + {it.addons.map((a: any) => a?.name).filter(Boolean).join(", ")}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                    {target && (
                      <button
                        onClick={() => advance(o)}
                        disabled={updatingId === o.id}
                        className="w-full h-9 rounded-lg bg-primary text-primary-foreground text-xs font-black uppercase tracking-wide disabled:opacity-60 flex items-center justify-center gap-1.5"
                      >
                        {updatingId === o.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <>{target === "preparando" ? "Iniciar preparo" : "Marcar pronto"}</>
                        )}
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}