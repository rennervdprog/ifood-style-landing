/**
 * Realtime auto-rejoin helper.
 *
 * Wraps a Supabase channel `.subscribe()` exactly once.
 *
 * Important: Supabase/Phoenix channels cannot call `join()` twice on the same
 * channel instance. Reconnects are handled by the Realtime client itself after
 * socket reconnects; manually calling `subscribe()` again causes native crashes
 * with: "tried to join multiple times".
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
  disposed: boolean;
  cb?: StatusCb;
}>();

export function subscribeWithRejoin(channel: RealtimeChannel, cb?: StatusCb) {
  const existing = META.get(channel);
  if (existing) return channel;

  const meta = { disposed: false, cb };
  META.set(channel, meta);

  channel.subscribe((status) => {
    if (meta.disposed) return;
    try { cb?.(status); } catch {}
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
      console.warn(`[Realtime] ${status} on "${(channel as any).topic}"`);
    }
  });

  return channel;
}

export function cleanupChannel(channel: RealtimeChannel) {
  const meta = META.get(channel);
  if (meta) {
    meta.disposed = true;
    META.delete(channel);
  }
  try { supabase.removeChannel(channel); } catch {}
}