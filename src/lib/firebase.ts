import { supabase } from "@/integrations/supabase/client";
import { isCapacitorNative } from "@/lib/capacitorNative";
import { claimFcmPushToken } from "@/lib/pushRegistration";

console.log("[Firebase] Module loading, isCapacitorNative:", isCapacitorNative());

let app: any = null;
let messagingInstance: any = null;

// Defer Firebase init — do NOT run at module load on Capacitor native
function getFirebaseApp() {
  if (app) return app;
  try {
    console.log("[Firebase] Initializing Firebase app...");
    const { initializeApp } = require("firebase/app");
    const firebaseConfig = {
      apiKey: "AIzaSyC7o57Z8Y-F2KLyqSIGtHTSPgTxGRr-JNQ",
      authDomain: "itasuper-c71a1.firebaseapp.com",
      projectId: "itasuper-c71a1",
      storageBucket: "itasuper-c71a1.firebasestorage.app",
      messagingSenderId: "344752263518",
      appId: "1:344752263518:web:abcb197795dbd262d37fcf",
    };
    app = initializeApp(firebaseConfig);
    console.log("[Firebase] App initialized successfully");
    return app;
  } catch (e) {
    console.error("[Firebase] initializeApp CRASHED:", e);
    return null;
  }
}

// Only init Firebase on web — skip entirely on Capacitor native
if (!isCapacitorNative()) {
  getFirebaseApp();
} else {
  console.log("[Firebase] Skipping Firebase Web SDK init on Capacitor native");
}

const VAPID_KEY = "BHb2UjlHI-eRw9xybN8PXFfQv21M8ayZoLAC11t0rbiwFVp56_JyNSbVpmkZJzROHyiW9_n0bbkNqtdX6jg22_E";

async function getMessagingInstance() {
  if (messagingInstance) return messagingInstance;
  if (isCapacitorNative()) {
    console.log("[Firebase] getMessagingInstance: skipping on Capacitor native");
    return null;
  }
  try {
    const { getMessaging, isSupported } = await import("firebase/messaging");
    const supported = await isSupported();
    console.log("[Firebase] Messaging supported:", supported);
    if (!supported) return null;
    const firebaseApp = getFirebaseApp();
    if (!firebaseApp) return null;
    messagingInstance = getMessaging(firebaseApp);
    return messagingInstance;
  } catch (e) {
    console.error("[Firebase] getMessagingInstance CRASHED:", e);
    return null;
  }
}

export async function requestPushPermissionAndRegister(): Promise<string | null> {
  console.log("[Firebase] requestPushPermissionAndRegister called, isCapacitorNative:", isCapacitorNative());
  
  // NEVER run web push on Capacitor native
  if (isCapacitorNative()) {
    console.log("[Firebase] Skipping web push registration on Capacitor native");
    return null;
  }

  try {
    // Check if in iframe (Lovable preview) — skip registration
    try {
      if (window.self !== window.top) return null;
    } catch {
      return null;
    }

    // Native app uses OneSignal/GoNative push
    const { isGoNative } = await import("@/lib/gonative");
    if (isGoNative()) return null;

    if (!("Notification" in window)) {
      console.log("[Firebase] Notification API not available");
      return null;
    }

    const permission = await Notification.requestPermission();
    console.log("[Firebase] Permission result:", permission);
    if (permission !== "granted") return null;

    // Register SW
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    console.log("[Firebase] SW registered");

    const messaging = await getMessagingInstance();
    if (!messaging) return null;

    const { getToken } = await import("firebase/messaging");
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    console.log("[Firebase] FCM token obtained:", token ? "yes" : "no");

    if (token) {
      await saveTokenToDatabase(token);
    }

    return token;
  } catch (error) {
    console.error("[Firebase] Push registration error:", error);
    return null;
  }
}

async function saveTokenToDatabase(token: string) {
  const deviceInfo = navigator.userAgent.slice(0, 200);
  await claimFcmPushToken(token, deviceInfo);
}

export function onForegroundMessage(callback: (payload: any) => void) {
  if (isCapacitorNative()) {
    console.log("[Firebase] onForegroundMessage: skipping on Capacitor native");
    return;
  }
  getMessagingInstance().then(async (messaging) => {
    if (!messaging) return;
    const { onMessage } = await import("firebase/messaging");
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
