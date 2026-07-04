import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { count as outboxCount, flush as outboxFlush } from "./pdvOutbox";

/**
 * Hook React que expõe o estado da fila offline do PDV (Fase 3).
 * Auto-flush no mount, no evento `online` e a cada 30s enquanto houver itens.
 */
export function usePdvOutbox(storeId: string | undefined | null) {
  const [count, setCount] = useState(0);
  const [flushing, setFlushing] = useState(false);
  const { connected } = useNetworkStatus();

  const refresh = useCallback(() => {
    if (!storeId) {
      setCount(0);
      return;
    }
    setCount(outboxCount(storeId));
  }, [storeId]);

  const flushNow = useCallback(
    async (silent = false) => {
      if (!storeId || flushing) return;
      setFlushing(true);
      try {
        const res = await outboxFlush(storeId, async (payload) => {
          const { data, error } = await supabase.rpc(
            "pdv_finalize_sale" as any,
            { _payload: payload } as any,
          );
          if (error) return { ok: false, error: error.message };
          const orderId =
            typeof data === "string"
              ? data
              : (data as any)?.order_id ?? (data as any)?.id ?? null;
          return orderId ? { ok: true } : { ok: false, error: "no order_id" };
        });
        refresh();
        if (!silent && res.sent > 0) {
          toast.success(`Sincronizadas ${res.sent} venda(s) da fila offline.`);
        }
        if (!silent && res.failed > 0) {
          toast.error(
            `${res.failed} venda(s) ainda não sincronizaram — tentarei de novo.`,
          );
        }
      } finally {
        setFlushing(false);
      }
    },
    [storeId, flushing, refresh],
  );

  // Atualiza contagem inicial e escuta storage (quando checkout enfileira).
  useEffect(() => {
    refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith("pdv_outbox_v1:")) refresh();
    };
    window.addEventListener("storage", onStorage);
    // Evento custom disparado no mesmo tab (storage events só cruzam abas).
    const onLocal = () => refresh();
    window.addEventListener("pdv-outbox-changed", onLocal);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("pdv-outbox-changed", onLocal);
    };
  }, [refresh]);

  // Auto-flush no mount + em cada online + polling.
  useEffect(() => {
    if (!storeId) return;
    // mount
    flushNow(true);
    const onOnline = () => flushNow(true);
    window.addEventListener("online", onOnline);
    // Evento custom disparado quando checkout enfileira uma venda:
    // tenta sincronizar imediatamente (se houver rede real, resolve na hora).
    const onLocal = () => {
      if (outboxCount(storeId) > 0) flushNow(true);
    };
    window.addEventListener("pdv-outbox-changed", onLocal);
    const interval = window.setInterval(() => {
      // Tenta a cada 10s enquanto houver itens — não confia só em
      // navigator.onLine porque em Android/webview ele pode ficar preso.
      if (outboxCount(storeId) > 0) flushNow(true);
    }, 10_000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("pdv-outbox-changed", onLocal);
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  // Sempre que a rede voltar (detecção nativa via Capacitor Network),
  // dispara flush imediato — muito mais confiável que o evento `online`.
  useEffect(() => {
    if (!storeId) return;
    if (connected && outboxCount(storeId) > 0) flushNow(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, storeId]);

  return { count, flushing, flushNow, refresh };
}