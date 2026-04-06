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
    __nativeDebugLog?: string[];
  }
}

// ── Debug log helper ──
function nativeLog(msg: string) {
  console.log(`[GoNative] ${msg}`);
  if (typeof window !== "undefined") {
    if (!window.__nativeDebugLog) window.__nativeDebugLog = [];
    window.__nativeDebugLog.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
    // Keep last 50 entries
    if (window.__nativeDebugLog.length > 50) window.__nativeDebugLog.shift();
  }
}

export function getNativeDebugLog(): string[] {
  return typeof window !== "undefined" ? (window.__nativeDebugLog || []) : [];
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
 */
export async function setOneSignalExternalUserId(userId: string): Promise<void> {
  if (!isGoNative()) {
    nativeLog("setExternalUserId: NOT GoNative env, skipping");
    return;
  }

  nativeLog(`setExternalUserId: starting for ${userId.slice(0, 8)}...`);

  for (let i = 0; i < 10; i++) {
    const bridge = getBridge();
    nativeLog(`setExternalUserId: attempt ${i}, bridge=${!!bridge}, keys=${bridge ? Object.keys(bridge).join(",") : "none"}`);
    
    if (bridge) {
      // SDK v5+ style
      if (bridge.externalUserId?.set) {
        try {
          bridge.externalUserId.set({ externalId: userId });
          nativeLog(`✅ external_user_id SET (v5): ${userId.slice(0, 8)}...`);
          return;
        } catch (e) {
          nativeLog(`❌ externalUserId.set FAILED: ${e}`);
        }
      }
      // Legacy style
      if (typeof bridge.setExternalUserId === "function") {
        try {
          bridge.setExternalUserId(userId);
          nativeLog(`✅ external_user_id SET (legacy): ${userId.slice(0, 8)}...`);
          return;
        } catch (e) {
          nativeLog(`❌ setExternalUserId FAILED: ${e}`);
        }
      }
      nativeLog(`⚠️ bridge exists but no externalUserId method. Available: ${Object.keys(bridge).join(", ")}`);
      if (i > 3) break;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  nativeLog("❌ Could not set external_user_id — no method available");
}

function installGlobalCallbacks() {
  if (typeof window === "undefined") return;
  window.gonative_onesignal_info = (info: any) => { 
    cachedInfo = info; 
    nativeLog(`Global callback received info: ${JSON.stringify(info).slice(0, 200)}`);
  };
  window.median_onesignal_info = (info: any) => { 
    cachedInfo = info; 
    nativeLog(`Median callback received info: ${JSON.stringify(info).slice(0, 200)}`);
  };
}

function extractPlayerId(info: any): string | null {
  return info?.subscription?.id ?? info?.oneSignalUserId ?? info?.oneSignalId ?? null;
}

async function readOneSignalInfo(): Promise<any> {
  installGlobalCallbacks();
  if (cachedInfo) {
    nativeLog(`Using cached info: ${JSON.stringify(cachedInfo).slice(0, 200)}`);
    return cachedInfo;
  }

  let bridge = getBridge();
  nativeLog(`readOneSignalInfo: initial bridge=${!!bridge}`);
  
  if (!bridge) {
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      bridge = getBridge();
      if (bridge) {
        nativeLog(`readOneSignalInfo: bridge found after ${i + 1}s`);
        break;
      }
    }
  }

  const b = getBridge();
  if (!b) {
    nativeLog("❌ readOneSignalInfo: no bridge after 8s wait");
    nativeLog(`window.gonative=${!!window.gonative}, window.median=${!!window.median}`);
    if (window.gonative) nativeLog(`gonative keys: ${Object.keys(window.gonative).join(", ")}`);
    if (window.median) nativeLog(`median keys: ${Object.keys(window.median).join(", ")}`);
    return null;
  }

  nativeLog(`Bridge methods: ${Object.keys(b).join(", ")}`);

  if (typeof b.onesignalInfo === "function") {
    nativeLog("Trying onesignalInfo()...");
    try {
      const result = await b.onesignalInfo((info: any) => info);
      if (result && typeof result === "object") { 
        cachedInfo = result; 
        nativeLog(`✅ onesignalInfo returned: ${JSON.stringify(result).slice(0, 300)}`);
        return result; 
      }
      nativeLog(`onesignalInfo returned non-object: ${typeof result}`);
    } catch (e) {
      nativeLog(`onesignalInfo() threw: ${e}`);
    }

    try {
      return await new Promise<any>((resolve) => {
        let settled = false;
        b.onesignalInfo?.((info: any) => { 
          settled = true; 
          cachedInfo = info; 
          nativeLog(`✅ onesignalInfo callback: ${JSON.stringify(info).slice(0, 300)}`);
          resolve(info); 
        });
        setTimeout(() => { 
          if (!settled) {
            nativeLog("⚠️ onesignalInfo callback timeout (4s)");
            resolve(null); 
          }
        }, 4000);
      });
    } catch (e) {
      nativeLog(`onesignalInfo callback error: ${e}`);
    }
  }

  if (typeof b.info === "function") {
    nativeLog("Trying b.info() with global callback...");
    const cbName = window.median ? "median_onesignal_info" : "gonative_onesignal_info";
    return await new Promise<any>((resolve) => {
      let settled = false;
      const prev = (window as any)[cbName];
      (window as any)[cbName] = (info: any) => {
        settled = true; cachedInfo = info; (window as any)[cbName] = prev; 
        nativeLog(`✅ info() global callback: ${JSON.stringify(info).slice(0, 300)}`);
        resolve(info);
      };
      try { b.info?.({ callback: cbName }); } catch (e) { 
        nativeLog(`info() threw: ${e}`);
        (window as any)[cbName] = prev; resolve(null); return; 
      }
      setTimeout(() => { 
        if (!settled) { 
          nativeLog("⚠️ info() global callback timeout (5s)");
          (window as any)[cbName] = prev; resolve(null); 
        }
      }, 5000);
    });
  }

  nativeLog("❌ No info method available on bridge");
  return null;
}

export async function registerGoNativePlayer(): Promise<string | null> {
  nativeLog(`registerGoNativePlayer: isGoNative=${isGoNative()}`);
  if (!isGoNative()) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    nativeLog("registerGoNativePlayer: no user logged in");
    return null;
  }
  nativeLog(`registerGoNativePlayer: user=${user.id.slice(0, 8)}...`);

  // Always try to set external_user_id
  setOneSignalExternalUserId(user.id).catch((e) => nativeLog(`setExternalUserId error: ${e}`));

  const info = await readOneSignalInfo();
  const playerId = extractPlayerId(info);

  nativeLog(`Player ID: ${playerId || "NULL"}`);
  nativeLog(`Full info: ${JSON.stringify(info).slice(0, 500)}`);

  if (!playerId) {
    nativeLog("⚠️ No player_id, but external_user_id was attempted");
    return null;
  }

  try {
    const deviceInfo = JSON.stringify({
      ua: navigator.userAgent.slice(0, 120),
      platform: info?.platform ?? null,
      appVersion: info?.appVersion ?? null,
    }).slice(0, 200);

    const { error } = await (supabase.from("onesignal_players") as any).upsert(
      {
        user_id: user.id,
        player_id: playerId,
        device_info: deviceInfo,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,player_id" }
    );

    if (error) {
      nativeLog(`❌ DB upsert error: ${JSON.stringify(error)}`);
    } else {
      nativeLog(`✅ Player saved to DB: ${playerId}`);
    }
    return playerId;
  } catch (error) {
    nativeLog(`❌ Error saving player: ${error}`);
    return null;
  }
}

/** Diagnostic function - returns full debug state */
export async function runNativeDiagnostics(): Promise<Record<string, any>> {
  const diag: Record<string, any> = {
    timestamp: new Date().toISOString(),
    isGoNative: isGoNative(),
    hasGonativeObj: typeof window !== "undefined" && !!window.gonative,
    hasMedianObj: typeof window !== "undefined" && !!window.median,
    gonativeKeys: typeof window !== "undefined" && window.gonative ? Object.keys(window.gonative) : [],
    medianKeys: typeof window !== "undefined" && window.median ? Object.keys(window.median) : [],
    bridgeExists: !!getBridge(),
    bridgeMethods: getBridge() ? Object.keys(getBridge()!) : [],
    cachedInfo: cachedInfo ? JSON.stringify(cachedInfo).slice(0, 500) : null,
    playerId: extractPlayerId(cachedInfo),
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : "N/A",
  };

  // Try reading fresh info
  nativeLog("=== RUNNING DIAGNOSTICS ===");
  const info = await readOneSignalInfo();
  diag.freshInfo = info ? JSON.stringify(info).slice(0, 500) : null;
  diag.freshPlayerId = extractPlayerId(info);
  diag.debugLog = getNativeDebugLog();

  return diag;
}

if (typeof window !== "undefined") {
  installGlobalCallbacks();
  // Log initial state on load
  setTimeout(() => {
    nativeLog(`Init: isGoNative=${isGoNative()}, bridge=${!!getBridge()}`);
    if (window.gonative) nativeLog(`gonative keys: ${Object.keys(window.gonative).join(", ")}`);
    if (window.median) nativeLog(`median keys: ${Object.keys(window.median).join(", ")}`);
    const b = getBridge();
    if (b) nativeLog(`bridge methods: ${Object.keys(b).join(", ")}`);
  }, 1000);
}
