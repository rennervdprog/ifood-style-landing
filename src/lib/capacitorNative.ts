/**
 * Capacitor native plugins — push notifications, status bar, splash screen, haptics
 * Only activates when running inside a Capacitor native shell.
 */
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

export function isCapacitorNative(): boolean {
  return Capacitor.isNativePlatform();
}

// ── Push Notifications ──

export async function registerCapacitorPush(): Promise<string | null> {
  if (!isCapacitorNative()) return null;

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    const permResult = await PushNotifications.requestPermissions();
    if (permResult.receive !== "granted") {
      console.warn("[CapPush] Permission denied");
      return null;
    }

    await PushNotifications.register();

    return new Promise((resolve) => {
      PushNotifications.addListener("registration", async (token) => {
        console.log("[CapPush] Token:", token.value);
        await saveFcmToken(token.value);
        resolve(token.value);
      });

      PushNotifications.addListener("registrationError", (err) => {
        console.error("[CapPush] Registration error:", err);
        resolve(null);
      });
    });
  } catch (err) {
    console.error("[CapPush] Fatal error during registration:", err);
    return null;
  }
}

export async function setupPushListeners() {
  if (!isCapacitorNative()) return;

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    PushNotifications.addListener("pushNotificationReceived", (notification) => {
      console.log("[CapPush] Foreground:", notification);
    });

    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      console.log("[CapPush] Action:", action);
      const link = action.notification.data?.link;
      if (link && typeof window !== "undefined") {
        window.location.href = link;
      }
    });
  } catch (err) {
    console.error("[CapPush] Error setting up listeners:", err);
  }
}

async function saveFcmToken(token: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("fcm_tokens").upsert(
    {
      user_id: user.id,
      token,
      device_info: `capacitor-${Capacitor.getPlatform()}`,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,token" }
  );
}

// ── Status Bar ──

export async function configureStatusBar() {
  if (!isCapacitorNative()) return;

  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: "#FF4B2B" });
    await StatusBar.setOverlaysWebView({ overlay: false });
  } catch (e) {
    console.warn("[StatusBar] Error:", e);
  }
}

// ── Splash Screen ──

export async function hideSplash() {
  if (!isCapacitorNative()) return;

  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide({ fadeOutDuration: 300 });
  } catch (e) {
    console.warn("[Splash] Error:", e);
  }
}

// ── Haptics ──

export async function hapticFeedback(type: "light" | "medium" | "heavy" = "medium") {
  if (!isCapacitorNative()) return;

  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    const styleMap = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy };
    await Haptics.impact({ style: styleMap[type] });
  } catch { /* noop */ }
}

export async function hapticNotification() {
  if (!isCapacitorNative()) return;

  try {
    const { Haptics, NotificationType } = await import("@capacitor/haptics");
    await Haptics.notification({ type: NotificationType.Success });
  } catch { /* noop */ }
}

// ── App (back button, deep links) ──

export async function setupAppListeners() {
  if (!isCapacitorNative()) return;

  try {
    const { App } = await import("@capacitor/app");

    App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        App.minimizeApp();
      }
    });

    App.addListener("appUrlOpen", (event) => {
      const url = new URL(event.url);
      if (url.pathname) {
        window.location.href = url.pathname;
      }
    });
  } catch (e) {
    console.warn("[App] Error:", e);
  }
}

// ── Keyboard ──

export async function setupKeyboard() {
  if (!isCapacitorNative()) return;

  try {
    const { Keyboard } = await import("@capacitor/keyboard");
    Keyboard.setAccessoryBarVisible({ isVisible: true });
    Keyboard.setScroll({ isDisabled: false });
  } catch (e) {
    console.warn("[Keyboard] Error:", e);
  }
}

// ── Init all native features ──

export async function initCapacitorNative() {
  if (!isCapacitorNative()) return;

  console.log("[Capacitor] Initializing native features...");

  await configureStatusBar();
  setupAppListeners();
  setupKeyboard();
  setupPushListeners();

  // Hide splash after a small delay to let the app render
  setTimeout(() => hideSplash(), 500);

  console.log("[Capacitor] Native features initialized");
}
