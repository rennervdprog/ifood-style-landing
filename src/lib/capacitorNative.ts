/**
 * Capacitor native plugins — push notifications, status bar, splash screen, haptics
 * Only activates when running inside a Capacitor native shell.
 */
import { Capacitor } from "@capacitor/core";
import { claimFcmPushToken } from "@/lib/pushRegistration";
import { rememberPushIdentifier, getStoredPushState, getCurrentPushDeviceInfo } from "@/lib/pushSession";

let listenersReady = false;
let registrationPromise: Promise<string | null> | null = null;
let resolveRegistration: ((value: string | null) => void) | null = null;
let registrationTimeoutId: number | null = null;
let lastKnownToken: string | null = null;

/**
 * Global queue for notification tap navigation.
 * Stores the target path so PushNavigator can replay it once React Router is ready.
 * Persists in localStorage to survive cold starts and full page reloads.
 */
const PENDING_PUSH_KEY = "pending_push_nav_v2";
let pendingPushNavigation: string | null = null;

// Restore from localStorage on module load (cold start)
try {
  const stored = typeof localStorage !== "undefined" ? localStorage.getItem(PENDING_PUSH_KEY) : null;
  if (stored) {
    pendingPushNavigation = stored;
    console.log("[CapPush] 📥 Restored pending push from localStorage:", stored);
  }
} catch {}

function setPendingPushNavigation(path: string | null) {
  pendingPushNavigation = path;
  try {
    if (typeof localStorage === "undefined") return;
    if (path) {
      localStorage.setItem(PENDING_PUSH_KEY, path);
    } else {
      localStorage.removeItem(PENDING_PUSH_KEY);
    }
  } catch {}
}

/** Get and clear the pending push navigation path */
export function consumePendingPushNavigation(): string | null {
  const path = pendingPushNavigation;
  setPendingPushNavigation(null);
  return path;
}

/** Check if there's a pending push navigation */
export function hasPendingPushNavigation(): boolean {
  return pendingPushNavigation !== null;
}

export function isCapacitorNative(): boolean {
  return Capacitor.isNativePlatform();
}

// ── Push Notifications ──

/** Reset registration state so next call does a fresh registration */
export function resetPushRegistrationState() {
  registrationPromise = null;
  resolveRegistration = null;
  if (registrationTimeoutId !== null) {
    window.clearTimeout(registrationTimeoutId);
    registrationTimeoutId = null;
  }
}

function settleRegistration(token: string | null) {
  if (registrationTimeoutId !== null) {
    window.clearTimeout(registrationTimeoutId);
    registrationTimeoutId = null;
  }

  resolveRegistration?.(token);
  resolveRegistration = null;
  registrationPromise = null;
}

// We store the plugin reference here to avoid returning it from an async function
// (Capacitor plugins have a .then() method that confuses JS await)
let pushPlugin: any = null;

async function ensurePushListeners() {
  const { PushNotifications } = await import("@capacitor/push-notifications");
  pushPlugin = PushNotifications;

  if (listenersReady) return;

  PushNotifications.addListener("registration", async (token) => {
    console.log("[CapPush] Token:", token.value);
    lastKnownToken = token.value;
    rememberPushIdentifier("fcm", token.value);

    try {
      await saveFcmToken(token.value);
      settleRegistration(token.value);
    } catch (error) {
      console.error("[CapPush] Failed to claim token:", error);
      settleRegistration(null);
    }
  });

  PushNotifications.addListener("registrationError", (err) => {
    console.error("[CapPush] Registration error:", err);
    settleRegistration(null);
  });

  PushNotifications.addListener("pushNotificationReceived", (notification) => {
    console.log("[CapPush] Foreground:", JSON.stringify(notification));
    try {
      // Play bell sound
      const audio = new Audio("/sounds/order-bell.mp3");
      audio.volume = 1.0;
      audio.play().catch(() => {});
      // Show toast
      const title = notification.title || "ItaSuper";
      const body = notification.body || "";
      import("sonner").then(({ toast }) => {
        toast(title, { description: body });
      }).catch(() => {});
      // Haptic feedback
      import("@capacitor/haptics").then(({ Haptics, NotificationType }) => {
        Haptics.notification({ type: NotificationType.Warning });
      }).catch(() => {});
    } catch {}
  });

  PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    console.log("[CapPush] 🔔 Action received:", JSON.stringify(action));
    const data = action.notification.data || {};
    // FCM passes data as strings; Capacitor sometimes nests under .notification
    const link = data.link || data.click_action || "/";
    const orderId = data.order_id;

    if (typeof window === "undefined") return;

    // Build the target URL based on the notification link and order context
    let targetPath = link;

    if (orderId) {
      if (link === "/pedidos" || link.startsWith("/pedidos")) {
        targetPath = `/pedidos`;
      } else if (link === "/admin" || link.startsWith("/admin")) {
        targetPath = `/admin?order=${orderId}`;
      } else if (link === "/entregador" || link.startsWith("/entregador")) {
        targetPath = `/entregador?order=${orderId}`;
      }
    }

    console.log("[CapPush] 🎯 Target path:", targetPath);

    // Store in global queue (also persisted to localStorage) — survives cold start
    setPendingPushNavigation(targetPath);

    // Dispatch the custom event for when PushNavigator is already mounted.
    // Retry a few times because React Router may still be mounting, but stop
    // as soon as the navigation has been consumed (no wasted dispatches).
    const timers: number[] = [];
    const dispatch = () => {
      if (pendingPushNavigation !== targetPath) {
        timers.forEach((t) => window.clearTimeout(t));
        return;
      }
      window.dispatchEvent(
        new CustomEvent("capacitor-push-navigate", { detail: { path: targetPath } })
      );
    };
    timers.push(window.setTimeout(dispatch, 100));
    timers.push(window.setTimeout(dispatch, 500));
    timers.push(window.setTimeout(dispatch, 1500));

    // Final fallback: if nothing navigated after 3s, use window.location
    timers.push(window.setTimeout(() => {
      if (pendingPushNavigation === targetPath) {
        console.log("[CapPush] ⚠️ Fallback: forcing navigation via window.location to", targetPath);
        setPendingPushNavigation(null);
        const url = new URL(targetPath, window.location.origin);
        window.location.href = url.toString();
      }
    }, 3000));
  });

  listenersReady = true;
  console.log("[CapPush] ✅ All listeners registered");
}

/**
 * Re-claim the stored FCM token for the currently logged-in user.
 * This is critical after account switches on the same device.
 */
export async function reclaimStoredToken(): Promise<void> {
  const stored = getStoredPushState();
  const token = lastKnownToken || stored.fcmToken;
  if (!token) {
    console.log("[CapPush] 🔍 reclaimStoredToken: no token available (lastKnown=null, stored=null)");
    return;
  }

  // Get current auth user for debug
  const { supabase } = await import("@/integrations/supabase/client");
  const { data: { session } } = await supabase.auth.getSession();
  const currentUserId = session?.user?.id || "NO_SESSION";
  const currentEmail = session?.user?.email || "NO_EMAIL";
  const deviceInfo = getCurrentPushDeviceInfo("capacitor");

  console.log(`[CapPush] 🔍 reclaimStoredToken: user=${currentEmail} (${currentUserId}), token=${token.slice(0, 12)}..., device=${deviceInfo}`);
  
  try {
    await saveFcmToken(token);
    console.log(`[CapPush] ✅ Token claimed successfully for ${currentEmail}`);
  } catch (e) {
    console.warn("[CapPush] ❌ Failed to re-claim stored token:", e);
  }
}

export async function registerCapacitorPush(options: { requestPermission?: boolean } = {}): Promise<string | null> {
  if (!isCapacitorNative()) return null;

  const requestPermission = options.requestPermission ?? true;

  try {
    await ensurePushListeners();

    const permResult = requestPermission
      ? await pushPlugin.requestPermissions()
      : await pushPlugin.checkPermissions();

    if (permResult.receive !== "granted") {
      console.warn(`[CapPush] Permission not granted (${permResult.receive})`);
      return null;
    }

    // Always reset state so we get a fresh registration and re-claim
    resetPushRegistrationState();

    registrationPromise = new Promise<string | null>(async (resolve) => {
      resolveRegistration = resolve;
      registrationTimeoutId = window.setTimeout(() => {
        console.warn("[CapPush] Registration timeout — trying stored token re-claim");
        // Even if registration times out, try to re-claim stored token
        reclaimStoredToken().catch(console.error);
        settleRegistration(lastKnownToken);
      }, 10000);

      try {
        await pushPlugin.register();
      } catch (error) {
        console.error("[CapPush] Fatal error during registration:", error);
        settleRegistration(null);
      }
    });

    return await registrationPromise;
  } catch (err) {
    console.error("[CapPush] Fatal error during registration:", err);
    settleRegistration(null);
    return null;
  }
}

export async function setupPushListeners() {
  if (!isCapacitorNative()) return;

  try {
    await ensurePushListeners();
  } catch (err) {
    console.error("[CapPush] Error setting up listeners:", err);
  }
}

async function saveFcmToken(token: string) {
  const deviceInfo = getCurrentPushDeviceInfo("capacitor");
  await claimFcmPushToken(token, deviceInfo);
}

// ── Status Bar ──

export async function configureStatusBar() {
  if (!isCapacitorNative()) return;

  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    // Style.Light = ícones brancos (combina com fundo laranja da marca)
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: "#FF6B00" });
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

// Cache the plugin reference so the first import is the only one
let hapticsPlugin: any = null;
async function getHaptics() {
  if (!hapticsPlugin) {
    const mod = await import("@capacitor/haptics");
    hapticsPlugin = mod;
  }
  return hapticsPlugin;
}

export async function hapticFeedback(type: "light" | "medium" | "heavy" = "medium") {
  if (!isCapacitorNative()) return;

  try {
    const { Haptics, ImpactStyle } = await getHaptics();
    const styleMap = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy };
    await Haptics.impact({ style: styleMap[type] });
  } catch { /* noop */ }
}

export async function hapticNotification() {
  if (!isCapacitorNative()) return;

  try {
    const { Haptics, NotificationType } = await getHaptics();
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
      try {
        const url = new URL(event.url);
        const targetPath = url.pathname + (url.search || "");
        if (!url.pathname) return;
        console.log("[App] 🔗 Deep link opened:", targetPath);
        // Use the same notification navigation queue so we don't full-reload
        setPendingPushNavigation(targetPath);
        const navEvent = new CustomEvent("capacitor-push-navigate", {
          detail: { path: targetPath },
        });
        window.dispatchEvent(navEvent);
      } catch (e) {
        console.warn("[App] appUrlOpen parse error:", e);
      }
    });
  } catch (e) {
    console.warn("[App] Error:", e);
  }
}

// ── Location Permission ──

export async function requestLocationPermission(): Promise<boolean> {
  if (!isCapacitorNative()) return false;

  try {
    const { Geolocation } = await import("@capacitor/geolocation");
    const perm = await Geolocation.requestPermissions();
    const granted = perm.location === "granted" || perm.coarseLocation === "granted";
    console.log(`[Location] Permission: ${granted ? "granted" : perm.location}`);
    return granted;
  } catch (e) {
    console.warn("[Location] Permission request failed:", e);
    return false;
  }
}



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

  console.log("[Capacitor] Platform:", Capacitor.getPlatform());

  // Push listeners: fire-and-forget. Cold-start taps são capturados via
  // `pending_push_nav_v2` no localStorage.
  setupPushListeners()
    .then(() => console.log("[Capacitor] ✅ Push listeners ready"))
    .catch((e) => console.warn("[Capacitor] Push listener setup failed:", e));

  // Splash NÃO é escondido aqui — quem controla é o App root (após rota
  // inicial montar). Evita "tela branca com spinner" entre splash e o
  // primeiro paint real. Fallback: launchShowDuration em capacitor.config.

  // Visual setup runs in parallel
  configureStatusBar().catch(() => {});
  setupKeyboard().catch(() => {});
  setupAppListeners().catch(() => {});

  // Location/notification permissions are now handled by the
  // CapacitorPermissionsOnboarding component (first-launch flow), so we no
  // longer auto-request here to avoid showing the OS dialog without context.
}
