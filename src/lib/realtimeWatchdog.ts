/**
 * Web-only Realtime watchdog.
 *
 * Polls the Supabase Realtime socket every 30s. If it is in CLOSED/CLOSING state
 * but we have active channels, force a reconnect. This catches the "silently dead
 * socket" case common on corporate networks, captive portals, or aggressive NATs.
 *
 * On Capacitor we already have appStateChange + Network listeners, so this is a
 * no-op there.
 */
import { supabase } from "@/integrations/supabase/client";
import { isCapacitorNative } from "@/lib/capacitorNative";

let started = false;

export function initRealtimeWatchdog() {
  if (started || isCapacitorNative()) return;
  if (typeof window === "undefined") return;
  started = true;

  const CHECK_INTERVAL = 30_000;

  const tick = () => {
    try {
      const channels = supabase.getChannels();
      if (channels.length === 0) return;

      const conn: any = (supabase.realtime as any)?.conn;
      const state = conn?.readyState;
      // 0=CONNECTING 1=OPEN 2=CLOSING 3=CLOSED
      if (state === 2 || state === 3) {
        console.warn("[RealtimeWatchdog] Socket closed but channels active — reconnecting socket");
        try {
          supabase.realtime.disconnect();
          supabase.realtime.connect();
        } catch (e) {
          console.warn("[RealtimeWatchdog] reconnect error:", e);
        }
      }
    } catch {}
  };

  setInterval(tick, CHECK_INTERVAL);

  // Best-effort cleanup of channels on tab close
  window.addEventListener("beforeunload", () => {
    try { supabase.removeAllChannels(); } catch {}
  });

  console.log("[RealtimeWatchdog] ✅ Started (web)");
}