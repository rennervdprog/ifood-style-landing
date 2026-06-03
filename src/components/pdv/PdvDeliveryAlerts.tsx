import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Bell, X } from "lucide-react";
import { toast } from "sonner";
import { ALERT_SOUND_URL } from "@/pages/admin/constants";

interface PendingOrder {
  id: string;
  total: number;
  created_at: string;
  order_source: string | null;
}

interface Props {
  storeId: string;
}

/**
 * Badge flutuante exibido no PDV alertando pedidos de DELIVERY novos
 * (status=pendente, order_source != 'pdv') em tempo real. Clique leva
 * direto para a aba de Pedidos do painel admin.
 */
export const PdvDeliveryAlerts = ({ storeId }: Props) => {
  const navigate = useNavigate();
  const [pending, setPending] = useState<PendingOrder[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const knownIds = useRef<Set<string>>(new Set());

  // Cria audio uma vez
  useEffect(() => {
    audioRef.current = new Audio(ALERT_SOUND_URL);
    audioRef.current.loop = false;
    audioRef.current.volume = 0.7;
  }, []);

  // Fetch inicial
  useEffect(() => {
    if (!storeId) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, total, created_at, order_source")
        .eq("store_id", storeId)
        .eq("status", "pendente")
        .neq("order_source", "pdv")
        .order("created_at", { ascending: false })
        .limit(20);
      if (!active) return;
      const list = (data || []) as PendingOrder[];
      knownIds.current = new Set(list.map((o) => o.id));
      setPending(list);
    })();
    return () => {
      active = false;
    };
  }, [storeId]);

  // Realtime
  useEffect(() => {
    if (!storeId) return;
    const channel = supabase
      .channel(`pdv-delivery-alerts-${storeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `store_id=eq.${storeId}` },
        (payload: any) => {
          const row = payload.new || payload.old;
          if (!row) return;
          const isPdv = row.order_source === "pdv";
          const isPending = row.status === "pendente";

          if (payload.eventType === "DELETE" || !isPending || isPdv) {
            setPending((prev) => prev.filter((o) => o.id !== row.id));
            knownIds.current.delete(row.id);
            return;
          }

          // INSERT/UPDATE com status pendente e não-PDV
          const isNew = !knownIds.current.has(row.id);
          knownIds.current.add(row.id);
          setPending((prev) => {
            const without = prev.filter((o) => o.id !== row.id);
            return [{ id: row.id, total: row.total, created_at: row.created_at, order_source: row.order_source }, ...without];
          });

          if (isNew) {
            setDismissed(false);
            try { audioRef.current?.play().catch(() => {}); } catch { /* ignore */ }
            toast.success("🔔 Novo pedido no Delivery!", {
              description: "Toque para abrir a tela de pedidos.",
              action: { label: "Abrir", onClick: () => navigate("/admin?tab=orders") },
            });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeId, navigate]);

  if (!pending.length || dismissed) return null;

  return (
    <button
      onClick={() => navigate("/admin?tab=orders")}
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-lg shadow-primary/30 ring-2 ring-primary/40 animate-pulse hover:scale-105 transition-transform"
    >
      <Bell className="h-5 w-5" />
      <span className="text-sm font-bold">
        {pending.length} novo{pending.length > 1 ? "s" : ""} no Delivery
      </span>
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          setDismissed(true);
        }}
        className="ml-1 rounded-full p-1 hover:bg-primary-foreground/20 cursor-pointer"
        aria-label="Ocultar"
      >
        <X className="h-3.5 w-3.5" />
      </span>
    </button>
  );
};

export default PdvDeliveryAlerts;