/**
 * Capacitor app-lifecycle helpers
 * 
 * - Reconnects Supabase Realtime when app resumes from background
 * - Pauses Realtime when app goes to background (saves battery)
 * - Refocuses React Query on resume
 * - Uses @capacitor/network for connectivity-aware behaviour
 */
import { isCapacitorNative } from "@/lib/capacitorNative";
import { supabase } from "@/integrations/supabase/client";
import { focusManager, onlineManager } from "@tanstack/react-query";

let lifecycleReady = false;

/**
 * Force Supabase Realtime to reconnect all channels.
 * This is critical on mobile where the WebSocket often silently dies
 * when the app is backgrounded for more than a few seconds.
 */
function reconnectRealtime() {
  try {
    const channels = supabase.getChannels();
    if (channels.length === 0) return;

    console.log(`[CapLifecycle] ♻️ Reconnecting ${channels.length} Realtime channel(s)…`);

    supabase.realtime.disconnect();
    supabase.realtime.connect();

    // Do not call channel.subscribe() again here: Phoenix channels can only
    // join once per instance. The Realtime client re-joins channels after the
    // socket reconnects; React Query refetch below keeps stale screens fresh.
    focusManager.setFocused(true);
  } catch (e) {
    console.warn("[CapLifecycle] Realtime reconnect error:", e);
  }
}

/**
 * Set up network-aware online manager for React Query.
 * When @capacitor/network reports offline, React Query pauses all queries.
 */
async function setupNetworkListener() {
  try {
    const { Network } = await import("@capacitor/network");

    // Set initial status
    const status = await Network.getStatus();
    onlineManager.setOnline(status.connected);
    console.log("[CapLifecycle] 🌐 Network:", status.connected ? "online" : "offline", `(${status.connectionType})`);

    Network.addListener("networkStatusChange", (s) => {
      const wasOffline = !onlineManager.isOnline();
      onlineManager.setOnline(s.connected);
      console.log("[CapLifecycle] 🌐 Network changed:", s.connected ? "online" : "offline");

      // Coming back online → reconnect Realtime
      if (s.connected && wasOffline) {
        reconnectRealtime();
      }
    });
  } catch (e) {
    console.warn("[CapLifecycle] Network plugin error:", e);
  }
}

/**
 * Listen for app state changes (foreground / background).
 * On resume: tell React Query the window is focused + reconnect Realtime.
 * On pause: optionally disconnect Realtime to save battery.
 */
async function setupAppStateListener() {
  try {
    const { App } = await import("@capacitor/app");

    let lastBackgroundedAt = 0;
    App.addListener("appStateChange", ({ isActive }) => {
      console.log("[CapLifecycle]", isActive ? "▶️ Resumed" : "⏸️ Backgrounded");

      if (isActive) {
        const sinceBackgrounded = lastBackgroundedAt ? Date.now() - lastBackgroundedAt : Infinity;
        onlineManager.setOnline(true);
        focusManager.setFocused(true);
        reconnectRealtime();
        window.dispatchEvent(new CustomEvent("capacitor-app-resume"));

        // Only run the late reconnect if the app was backgrounded > 10s
        if (sinceBackgrounded > 10_000) {
          setTimeout(() => {
            onlineManager.setOnline(true);
            focusManager.setFocused(true);
            reconnectRealtime();
            window.dispatchEvent(new CustomEvent("capacitor-app-resume"));
          }, 1200);
        }
      } else {
        lastBackgroundedAt = Date.now();
        focusManager.setFocused(false);
      }
    });
  } catch (e) {
    console.warn("[CapLifecycle] AppState listener error:", e);
  }
}

/**
 * Initialise all Capacitor lifecycle optimisations.
 * Call once from App.tsx after initCapacitorNative().
 */
export async function initCapacitorLifecycle() {
  if (!isCapacitorNative() || lifecycleReady) return;
  lifecycleReady = true;

  console.log("[CapLifecycle] Initialising lifecycle optimisations…");

  // Run in parallel — they are independent
  await Promise.allSettled([
    setupNetworkListener(),
    setupAppStateListener(),
  ]);

  // Override React Query's focus manager to use Capacitor's app state
  // instead of document.visibilityState (which is unreliable in WebView)
  focusManager.setEventListener((handleFocus) => {
    // On web the default listener uses visibilitychange; on Capacitor
    // we already push focus state via appStateChange above, so we just
    // return a noop cleanup.
    return () => {};
  });

  console.log("[CapLifecycle] ✅ Lifecycle optimisations ready");
}
