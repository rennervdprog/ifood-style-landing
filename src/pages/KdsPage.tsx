import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ChefHat, Package, AlertTriangle } from "lucide-react";

type KdsOrder = {
  id: string;
  code: string | null;
  status: "preparando" | "pronto_para_entrega";
  created_at: string;
  notes: string | null;
  order_items: Array<{
    id: string;
    quantity: number;
    notes: string | null;
    products: { name: string } | null;
  }>;
};

const POLL_MS = 5000;

const elapsedLabel = (iso: string) => {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h${m ? ` ${m}m` : ""}`;
};

const elapsedMin = (iso: string) =>
  Math.floor((Date.now() - new Date(iso).getTime()) / 60000);

export default function KdsPage() {
  const { token = "" } = useParams();
  const [orders, setOrders] = useState<KdsOrder[]>([]);
  const [storeName, setStoreName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [tick, setTick] = useState(0);

  const fetchOrders = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("kds", {
        body: { action: "get-orders", token },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setOrders(((data as any).orders || []) as KdsOrder[]);
      setStoreName((data as any).store_name || "");
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Erro ao carregar pedidos");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchOrders();
    const id = setInterval(fetchOrders, POLL_MS);
    return () => clearInterval(id);
  }, [fetchOrders]);

  // re-render por minuto para atualizar cronômetros
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const updateStatus = async (orderId: string, status: KdsOrder["status"]) => {
    setBusyIds((s) => new Set(s).add(orderId));
    // optimistic
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
    try {
      const { data, error } = await supabase.functions.invoke("kds", {
        body: { action: "update-status", token, order_id: orderId, status },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
    } catch {
      fetchOrders();
    } finally {
      setBusyIds((s) => {
        const n = new Set(s);
        n.delete(orderId);
        return n;
      });
    }
  };

  const cols = useMemo(() => {
    void tick;
    return {
      preparando: orders.filter((o) => o.status === "preparando"),
      pronto_para_entrega: orders.filter((o) => o.status === "pronto_para_entrega"),
    };
  }, [orders, tick]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center gap-3">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <h1 className="text-xl font-bold text-foreground">Acesso inválido</h1>
        <p className="text-sm text-muted-foreground max-w-md">
          O link do KDS não é válido ou expirou. Gere um novo no painel da loja em Configurações → Display de Cozinha.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black">KDS — {storeName || "Cozinha"}</h1>
          <p className="text-[11px] text-muted-foreground">
            Atualização automática a cada {POLL_MS / 1000}s · {orders.length} pedidos ativos
          </p>
        </div>
        <button
          onClick={fetchOrders}
          className="text-xs font-bold px-3 py-2 rounded-lg bg-primary text-primary-foreground"
        >
          Atualizar
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3">
        <Column
          title="Em preparo"
          icon={<ChefHat className="h-5 w-5" />}
          accent="bg-amber-500/10 border-amber-500/30"
          orders={cols.preparando}
          actionLabel="Marcar pronto"
          nextStatus="pronto_para_entrega"
          onAction={updateStatus}
          busyIds={busyIds}
        />
        <Column
          title="Prontos"
          icon={<Package className="h-5 w-5" />}
          accent="bg-emerald-500/10 border-emerald-500/30"
          orders={cols.pronto_para_entrega}
          actionLabel={null}
          nextStatus={null}
          onAction={updateStatus}
          busyIds={busyIds}
        />
      </div>
      <p className="text-[11px] text-muted-foreground text-center pb-3 px-3">
        Os pedidos aparecem aqui após o admin aceitar. A cozinha só marca como prontos.
      </p>
    </div>
  );
}

function Column({
  title,
  icon,
  accent,
  orders,
  actionLabel,
  nextStatus,
  onAction,
  busyIds,
}: {
  title: string;
  icon: React.ReactNode;
  accent: string;
  orders: KdsOrder[];
  actionLabel: string | null;
  nextStatus: KdsOrder["status"] | null;
  onAction: (id: string, s: KdsOrder["status"]) => void;
  busyIds: Set<string>;
}) {
  return (
    <div className={`rounded-2xl border ${accent} p-3 flex flex-col gap-3 min-h-[60vh]`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-base font-black">{title}</h2>
        </div>
        <span className="text-sm font-black px-2 py-0.5 rounded-full bg-background border border-border">
          {orders.length}
        </span>
      </div>
      {orders.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">Nenhum pedido</p>
      ) : (
        orders.map((o) => {
          const mins = elapsedMin(o.created_at);
          const late = mins >= 20;
          return (
            <div
              key={o.id}
              className={`rounded-xl bg-card border ${late ? "border-destructive" : "border-border"} p-3 shadow-sm`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="text-sm font-black">#{o.code || o.id.slice(0, 6)}</div>
                  <div className={`text-xs font-bold ${late ? "text-destructive" : "text-muted-foreground"}`}>
                    {elapsedLabel(o.created_at)}
                  </div>
                </div>
              </div>
              <ul className="space-y-1 mb-2">
                {o.order_items?.map((it) => (
                  <li key={it.id} className="text-sm">
                    <span className="font-black">{it.quantity}×</span>{" "}
                    <span className="font-bold">{it.products?.name || "Item"}</span>
                    {it.notes && (
                      <div className="text-[11px] text-muted-foreground italic ml-5">obs: {it.notes}</div>
                    )}
                  </li>
                ))}
              </ul>
              {o.notes && (
                <div className="text-[11px] bg-muted rounded-lg p-2 mb-2">
                  <span className="font-bold">Observação:</span> {o.notes}
                </div>
              )}
              {actionLabel && nextStatus && (
                <button
                  onClick={() => onAction(o.id, nextStatus)}
                  disabled={busyIds.has(o.id)}
                  className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-black text-sm disabled:opacity-50"
                >
                  {busyIds.has(o.id) ? "..." : actionLabel}
                </button>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
