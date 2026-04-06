// GoNative + OneSignal integration helpers
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    gonative?: {
      onesignal?: {
        onesignalInfo?: (callback: (info: { oneSignalUserId?: string; oneSignalPushToken?: string; oneSignalSubscribed?: boolean }) => void) => void;
      };
    };
  }
}

export function isGoNative(): boolean {
  return typeof window !== "undefined" && !!window.gonative;
}

export async function registerGoNativePlayer(): Promise<string | null> {
  if (!isGoNative() || !window.gonative?.onesignal?.onesignalInfo) {
    return null;
  }

  return new Promise((resolve) => {
    window.gonative!.onesignal!.onesignalInfo!(async (info) => {
      const playerId = info.oneSignalUserId;
      if (!playerId) {
        resolve(null);
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          resolve(null);
          return;
        }

        await (supabase.from("onesignal_players") as any).upsert(
          {
            user_id: user.id,
            player_id: playerId,
            device_info: navigator.userAgent.slice(0, 200),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,player_id" }
        );

        console.log("GoNative OneSignal player registered:", playerId);
        resolve(playerId);
      } catch (err) {
        console.error("Error saving OneSignal player:", err);
        resolve(null);
      }
    });
  });
}
