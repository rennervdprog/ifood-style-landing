import { supabase } from "@/integrations/supabase/client";

type LegacyOneSignalInfo = {
  oneSignalUserId?: string;
  oneSignalPushToken?: string;
  oneSignalSubscribed?: boolean;
  platform?: string;
  appVersion?: string;
};

type ModernOneSignalInfo = {
  oneSignalId?: string;
  externalId?: string;
  platform?: string;
  appVersion?: string;
  subscription?: {
    id?: string;
    token?: string;
    optedIn?: boolean;
  };
};

type NativeOneSignalInfo = LegacyOneSignalInfo & ModernOneSignalInfo;

type BridgeApi = {
  onesignalInfo?: ((callback?: (info: NativeOneSignalInfo) => void) => Promise<NativeOneSignalInfo | void> | void);
  info?: ((options: { callback: string }) => void);
};

declare global {
  interface Window {
    gonative?: { onesignal?: BridgeApi };
    median?: { onesignal?: BridgeApi };
    gonative_onesignal_info?: (info: NativeOneSignalInfo) => void;
    median_onesignal_info?: (info: NativeOneSignalInfo) => void;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getBridge(): BridgeApi | null {
  return window.median?.onesignal ?? window.gonative?.onesignal ?? null;
}

function extractPlayerId(info: NativeOneSignalInfo | null | undefined): string | null {
  return info?.subscription?.id ?? info?.oneSignalUserId ?? info?.oneSignalId ?? null;
}

function isSubscribed(info: NativeOneSignalInfo | null | undefined): boolean | null {
  if (typeof info?.subscription?.optedIn === "boolean") return info.subscription.optedIn;
  if (typeof info?.oneSignalSubscribed === "boolean") return info.oneSignalSubscribed;
  return null;
}

async function waitForBridge(maxAttempts = 12, delayMs = 1000): Promise<BridgeApi | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const bridge = typeof window !== "undefined" ? getBridge() : null;
    if (bridge?.onesignalInfo || bridge?.info) return bridge;
    await sleep(delayMs);
  }
  return null;
}

async function readOneSignalInfo(): Promise<NativeOneSignalInfo | null> {
  const bridge = await waitForBridge();
  if (!bridge) {
    console.warn("GoNative/Median OneSignal bridge not found");
    return null;
  }

  if (typeof bridge.onesignalInfo === "function") {
    try {
      const result = await bridge.onesignalInfo((info) => info);
      if (result && typeof result === "object") {
        return result as NativeOneSignalInfo;
      }
    } catch (error) {
      console.warn("onesignalInfo() promise path failed", error);
    }

    try {
      const callbackResult = await new Promise<NativeOneSignalInfo | null>((resolve) => {
        let settled = false;
        bridge.onesignalInfo?.((info) => {
          settled = true;
          resolve(info);
        });
        setTimeout(() => {
          if (!settled) resolve(null);
        }, 4000);
      });

      if (callbackResult) return callbackResult;
    } catch (error) {
      console.warn("onesignalInfo() callback path failed", error);
    }
  }

  if (typeof bridge.info === "function") {
    const callbackName = window.median ? "median_onesignal_info" : "gonative_onesignal_info";

    return await new Promise<NativeOneSignalInfo | null>((resolve) => {
      let settled = false;
      const handler = (info: NativeOneSignalInfo) => {
        settled = true;
        if (callbackName === "median_onesignal_info") delete window.median_onesignal_info;
        else delete window.gonative_onesignal_info;
        resolve(info);
      };

      if (callbackName === "median_onesignal_info") window.median_onesignal_info = handler;
      else window.gonative_onesignal_info = handler;

      try {
        bridge.info?.({ callback: callbackName });
      } catch (error) {
        console.warn("onesignal info callback bridge failed", error);
        if (callbackName === "median_onesignal_info") delete window.median_onesignal_info;
        else delete window.gonative_onesignal_info;
        resolve(null);
        return;
      }

      setTimeout(() => {
        if (!settled) {
          if (callbackName === "median_onesignal_info") delete window.median_onesignal_info;
          else delete window.gonative_onesignal_info;
          resolve(null);
        }
      }, 5000);
    });
  }

  return null;
}

export function isGoNative(): boolean {
  return typeof window !== "undefined" && (!!window.gonative || !!window.median);
}

export async function registerGoNativePlayer(): Promise<string | null> {
  if (!isGoNative()) return null;

  const info = await readOneSignalInfo();
  console.log("Native OneSignal info:", info);

  const playerId = extractPlayerId(info);
  if (!playerId) {
    console.warn("OneSignal player ID not available yet");
    return null;
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const deviceInfo = JSON.stringify({
      ua: navigator.userAgent.slice(0, 120),
      platform: info?.platform ?? null,
      subscribed: isSubscribed(info),
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

    console.log("GoNative/Median OneSignal player registered:", playerId);
    return playerId;
  } catch (error) {
    console.error("Error saving OneSignal player:", error);
    return null;
  }
}
