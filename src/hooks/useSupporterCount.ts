import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const SUPPORTER_LIMIT = 10;

/**
 * Conta lojas no plano Apoiador (ativas) consultando o Supabase EXTERNO
 * (banco de produção) via edge function `count-supporters`.
 * Faz polling a cada 30s para refletir novas assinaturas.
 */
export function useSupporterCount() {
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchCount = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("count-supporters");
        if (cancelled) return;
        if (!error && data && typeof data.count === "number") setCount(data.count);
      } catch {
        /* silent */
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchCount();
    const interval = setInterval(fetchCount, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const remaining = count === null ? null : Math.max(0, SUPPORTER_LIMIT - count);
  return { count, remaining, loading, limit: SUPPORTER_LIMIT };
}