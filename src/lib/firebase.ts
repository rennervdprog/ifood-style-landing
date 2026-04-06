import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import { supabase } from "@/integrations/supabase/client";
import { isGoNative } from "@/lib/gonative";

const firebaseConfig = {
  apiKey: "AIzaSyC7o57Z8Y-F2KLyqSIGtHTSPgTxGRr-JNQ",
  authDomain: "itafood-c71a1.firebaseapp.com",
  projectId: "itafood-c71a1",
  storageBucket: "itafood-c71a1.firebasestorage.app",
  messagingSenderId: "344752263518",
  appId: "1:344752263518:web:abcb197795dbd262d37fcf",
};

const VAPID_KEY = "BHb2UjlHI-eRw9xybN8PXFfQv21M8ayZoLAC11t0rbiwFVp56_JyNSbVpmkZJzROHyiW9_n0bbkNqtdX6jg22_E";

const app = initializeApp(firebaseConfig);

let messagingInstance: ReturnType<typeof getMessaging> | null = null;

async function getMessagingInstance() {
  if (messagingInstance) return messagingInstance;
  const supported = await isSupported();
  if (!supported) return null;
  messagingInstance = getMessaging(app);
  return messagingInstance;
}

export async function requestPushPermissionAndRegister(): Promise<string | null> {
  try {
    // Check if in iframe (Lovable preview) — skip registration
    try {
      if (window.self !== window.top) return null;
    } catch {
      return null;
    }

    // Native app uses OneSignal/GoNative push, so don't also register web FCM tokens
    if (isGoNative()) return null;

    if (!("Notification" in window)) return null;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    // Register SW
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");

    const messaging = await getMessagingInstance();
    if (!messaging) return null;

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      await saveTokenToDatabase(token);
    }

    return token;
  } catch (error) {
    console.error("Push registration error:", error);
    return null;
  }
}

async function saveTokenToDatabase(token: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const deviceInfo = navigator.userAgent.slice(0, 200);

  await supabase.from("fcm_tokens").upsert(
    {
      user_id: user.id,
      token,
      device_info: deviceInfo,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,token" }
  );
}

export function onForegroundMessage(callback: (payload: any) => void) {
  getMessagingInstance().then((messaging) => {
    if (!messaging) return;
    onMessage(messaging, (payload) => {
      callback(payload);
    });
  });
}

// Helper to send push via edge function
export async function sendPushNotification(
  userIds: string[],
  title: string,
  body?: string,
  data?: Record<string, string>
) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      console.warn("[sendPush] No session, skipping push");
      return null;
    }

    const res = await supabase.functions.invoke("send-push", {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: { user_ids: userIds, title, body, data },
    });

    if (res.error) {
      console.error("[sendPush] Error:", res.error.message);
      return null;
    }

    return res.data;
  } catch (e: any) {
    console.error("[sendPush] Exception:", e?.message || e);
    return null;
  }
}
