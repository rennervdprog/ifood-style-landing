import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    gonative?: {
      onesignal?: {
        onesignalInfo?: (callback?: (info: any) => void) => Promise<any> | void;
        info?: (options: { callback: string }) => void;
        externalUserId?: {
          set?: (options: { externalId: string }) => void;
        };
        setExternalUserId?: (id: string) => void;
      };
    };
    median?: {
      onesignal?: {
        onesignalInfo?: (callback?: (info: any) => void) => Promise<any> | void;
        info?: (options: { callback: string }) => void;
        externalUserId?: {
          set?: (options: { externalId: string }) => void;
        };
        setExternalUserId?: (id: string) => void;
      };
    };
    gonative_onesignal_info?: (info: any) => void;
    median_onesignal_info?: (info: any) => void;
  }
}

let cachedInfo: any = null;

function getBridge() {
  return window.median?.onesignal ?? window.gonative?.onesignal ?? null;
}

export function isGoNative(): boolean {
  return typeof window !== "undefined" && (!!window.gonative || !!window.median);
}

/**
 * Tags the OneSignal device with the Supabase user_id as external_user_id.
 * This allows sending push by user_id without needing the player_id in the DB.
 */
export async function setOneSignalExternalUserId(userId: string): Promise<void> {
  if (!isGoNative()) return;

  // Wait a bit for bridge to be ready
  for (let i = 0; i < 10; i++) {
    const bridge = getBridge();
    if (bridge) {
      // SDK v5+ style
      if (bridge.externalUserId?.set) {
        try {
          bridge.externalUserId.set({ externalId: userId });
          console.log("OneSignal external_user_id set (v5):", userId);
          return;
        } catch (e) {
          console.warn("externalUserId.set failed:", e);
        }
      }
      // Legacy style
      if (typeof bridge.setExternalUserId === "function") {
        try {
          bridge.setExternalUserId(userId);
          console.log("OneSignal external_user_id set (legacy):", userId);
          return;
        } catch (e) {
          console.warn("setExternalUserId failed:", e);
        }
      }
      // If bridge exists but no external user id method, break
      if (i > 3) break;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.warn("Could not set OneSignal external_user_id — bridge methods not available");
}

function installGlobalCallbacks() {
  if (typeof window === "undefined") return;
  window.gonative_onesignal_info = (info: any) => { cachedInfo = info; };
  window.median_onesignal_info = (info: any) => { cachedInfo = info; };
}

function extractPlayerId(info: any): string | null {
  return info?.subscription?.id ?? info?.oneSignalUserId ?? info?.oneSignalId ?? null;
}

async function readOneSignalInfo(): Promise<any> {
  installGlobalCallbacks();
  if (cachedInfo) return cachedInfo;

  const bridge = getBridge();
  if (!bridge) {
    // Wait up to 8s
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      if (getBridge()) break;
    }
  }

  const b = getBridge();
  if (!b) return null;

  if (typeof b.onesignalInfo === "function") {
    try {
      const result = await b.onesignalInfo((info: any) => info);
      if (result && typeof result === "object") { cachedInfo = result; return result; }
    } catch { /* ignore */ }

    try {
      return await new Promise<any>((resolve) => {
        let settled = false;
        b.onesignalInfo?.((info: any) => { settled = true; cachedInfo = info; resolve(info); });
        setTimeout(() => { if (!settled) resolve(null); }, 4000);
      });
    } catch { /* ignore */ }
  }

  if (typeof b.info === "function") {
    const cbName = window.median ? "median_onesignal_info" : "gonative_onesignal_info";
    return await new Promise<any>((resolve) => {
      let settled = false;
      const prev = (window as any)[cbName];
      (window as any)[cbName] = (info: any) => {
        settled = true; cachedInfo = info; (window as any)[cbName] = prev; resolve(info);
      };
      try { b.info?.({ callback: cbName }); } catch { (window as any)[cbName] = prev; resolve(null); return; }
      setTimeout(() => { if (!settled) { (window as any)[cbName] = prev; resolve(null); } }, 5000);
    });
  }

  return null;
}

export async function registerGoNativePlayer(): Promise<string | null> {
  if (!isGoNative()) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Always try to set external_user_id (this is the key fix)
  setOneSignalExternalUserId(user.id).catch(console.error);

  const info = await readOneSignalInfo();
  const playerId = extractPlayerId(info);

  if (!playerId) {
    console.warn("OneSignal player ID not available, but external_user_id was set");
    return null;
  }

  try {
    const deviceInfo = JSON.stringify({
      ua: navigator.userAgent.slice(0, 120),
      platform: info?.platform ?? null,
      appVersion: info?.appVersion ?? null,
    }).slice(0, 200);

    await (supabase.from("onesignal_players") as any).upsert(
      {
        user_id: user.id,
        player_id: playerId,
        device_info: deviceInfo,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,player_id" }
    );

    console.log("OneSignal player registered:", playerId);
    return playerId;
  } catch (error) {
    console.error("Error saving OneSignal player:", error);
    return null;
  }
}

if (typeof window !== "undefined") {
  installGlobalCallbacks();
}
