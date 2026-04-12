const PUSH_DEVICE_ID_KEY = "itasuper_push_device_id";
const PUSH_STATE_KEY = "itasuper_push_state";

interface StoredPushState {
  fcmToken?: string;
  playerId?: string;
}

function getRuntime(runtimeHint?: string) {
  if (runtimeHint) return runtimeHint;
  if (typeof window !== "undefined" && (window.gonative || window.median)) return "gonative";
  return "web";
}

function getPlatform() {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent || "";
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/windows/i.test(ua)) return "windows";
  if (/macintosh|mac os x/i.test(ua)) return "mac";
  return "web";
}

function getStoredDeviceId() {
  if (typeof window === "undefined") return "server";

  let deviceId = window.localStorage.getItem(PUSH_DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    window.localStorage.setItem(PUSH_DEVICE_ID_KEY, deviceId);
  }

  return deviceId;
}

export function getCurrentPushDeviceInfo(runtimeHint?: string) {
  const runtime = getRuntime(runtimeHint);
  const platform = getPlatform();
  const deviceId = getStoredDeviceId();

  return `itasuper:${runtime}:${platform}:${deviceId}`.slice(0, 200);
}

export function getStoredPushState(): StoredPushState {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(PUSH_STATE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function rememberPushIdentifier(kind: "fcm" | "onesignal", value: string) {
  if (!value || typeof window === "undefined") return;

  const next = getStoredPushState();
  if (kind === "fcm") next.fcmToken = value;
  if (kind === "onesignal") next.playerId = value;
  window.localStorage.setItem(PUSH_STATE_KEY, JSON.stringify(next));
}

export function clearStoredPushState() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PUSH_STATE_KEY);
}