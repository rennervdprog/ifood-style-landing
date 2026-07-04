import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { count as outboxCount, flush as outboxFlush } from "./pdvOutbox";

/**
 * Hook React que expõe o estado da fila offline do PDV (Fase 3).
 * Auto-flush no mount, quando a rede volta e com backoff enquanto houver
 * itens. Nunca dispara RPC se estiver offline — evita travar o app com
 * requests que já vão falhar.
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
      // Não tenta se está offline — só gasta tempo e trava a UI.
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      if (outboxCount(storeId) === 0) return;
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
    // mount: tenta uma vez
    flushNow(true);
    const onOnline = () => flushNow(true);
    window.addEventListener("online", onOnline);
    // Evento custom disparado quando checkout enfileira uma venda:
    // tenta sincronizar imediatamente.
    const onLocal = () => {
      if (outboxCount(storeId) > 0) flushNow(true);
    };
    window.addEventListener("pdv-outbox-changed", onLocal);
    // Polling adaptativo: só agenda o próximo tick se houver itens.
    // Começa em 15s e dobra até 2min — não dispara nada com fila vazia
    // ou offline, então não pesa no app em uso normal.
    let delay = 15_000;
    let timer: number | undefined;
    const tick = () => {
      if (outboxCount(storeId) === 0) { delay = 15_000; return; }
      const online =
        typeof navigator === "undefined" || navigator.onLine !== false;
      if (online) flushNow(true);
      delay = Math.min(delay * 2, 120_000);
      timer = window.setTimeout(tick, delay);
    };
    timer = window.setTimeout(tick, delay);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("pdv-outbox-changed", onLocal);
      if (timer) window.clearTimeout(timer);
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