import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const SUPPORTER_LIMIT = 10;

/**
 * Conta lojas no plano Apoiador (ativas) em tempo real.
 * Reassina via Realtime para refletir mudanças sem refresh.
 */
export function useSupporterCount() {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchCount = async () => {
      try {
        const { data, error } = await supabase.rpc("count_supporter_plans" as any);
        if (cancelled) return;
        if (!error && typeof data === "number") setCount(data);
      } catch {
        /* silent */
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchCount();

    const channel = supabase
      .channel("supporter-count")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "store_plans", filter: "plan_type=eq.supporter" },
        () => fetchCount()
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  const remaining = count === null ? null : Math.max(0, SUPPORTER_LIMIT - count);
  return { count, remaining, loading, limit: SUPPORTER_LIMIT };
}