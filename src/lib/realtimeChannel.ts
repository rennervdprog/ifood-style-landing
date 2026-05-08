/**
 * Realtime auto-rejoin helper.
 *
 * Wraps a Supabase channel `.subscribe()` so that on CHANNEL_ERROR / TIMED_OUT
 * / CLOSED the channel automatically tries to rejoin with exponential backoff.
 *
 * Usage:
 *   const channel = supabase.channel("foo").on("postgres_changes", ..., handler);
 *   subscribeWithRejoin(channel, (status) => setConnected(status === "SUBSCRIBED"));
 *   return () => cleanupChannel(channel);
 */
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

type StatusCb = (status: string) => void;

const META = new WeakMap<RealtimeChannel, {
  attempts: number;
  timer: ReturnType<typeof setTimeout> | null;
  disposed: boolean;
  cb?: StatusCb;
}>();

function backoff(attempts: number) {
  // 1s, 2s, 4s, 8s … capped at 15s
  return Math.min(1000 * 2 ** attempts, 15_000);
}

export function subscribeWithRejoin(channel: RealtimeChannel, cb?: StatusCb) {
  const meta = { attempts: 0, timer: null as any, disposed: false, cb };
  META.set(channel, meta);

  const join = () => {
    if (meta.disposed) return;
    channel.subscribe((status) => {
      try { cb?.(status); } catch {}
      if (status === "SUBSCRIBED") {
        meta.attempts = 0;
        if (meta.timer) { clearTimeout(meta.timer); meta.timer = null; }
        return;
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        if (meta.disposed) return;
        if (meta.timer) clearTimeout(meta.timer);
        const delay = backoff(meta.attempts++);
        console.warn(`[Realtime] ${status} on "${(channel as any).topic}" — rejoin in ${delay}ms (attempt ${meta.attempts})`);
        meta.timer = setTimeout(() => {
          try {
            // unsubscribe before resubscribe to clear server-side state
            channel.unsubscribe().catch?.(() => {});
          } catch {}
          join();
        }, delay);
      }
    });
  };

  join();
  return channel;
}

export function cleanupChannel(channel: RealtimeChannel) {
  const meta = META.get(channel);
  if (meta) {
    meta.disposed = true;
    if (meta.timer) { clearTimeout(meta.timer); meta.timer = null; }
    META.delete(channel);
  }
  try { supabase.removeChannel(channel); } catch {}
}