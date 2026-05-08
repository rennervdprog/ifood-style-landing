/**
 * Non-blocking native app version check.
 *
 * The web bundle (loaded via auto-update) carries the latest known native
 * version constant. We compare it with the installed APK version
 * (App.getInfo().version). If older, we show a one-time toast suggesting
 * the user updates via Play Store — but we never block usage.
 *
 * To raise the recommended version, just bump LATEST_NATIVE_VERSION below
 * on each release that ships a new APK.
 */
import { isCapacitorNative } from "@/lib/capacitorNative";
import { toast } from "sonner";

const LATEST_NATIVE_VERSION = "1.4.2";
const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=app.lovable.e8d28aded6334d74be2161c8dbe24765";
const NOTIFIED_KEY = "itasuper_update_notified_for";

function parseVersion(v: string): number[] {
  return v.split(".").map((n) => parseInt(n, 10) || 0);
}

function isOlder(installed: string, latest: string): boolean {
  const a = parseVersion(installed);
  const b = parseVersion(latest);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x < y) return true;
    if (x > y) return false;
  }
  return false;
}

export async function checkAppVersion() {
  if (!isCapacitorNative()) return;
  try {
    const { App } = await import("@capacitor/app");
    const info = await App.getInfo();
    const installed = info.version || "0.0.0";
    if (!isOlder(installed, LATEST_NATIVE_VERSION)) return;

    // Show only once per recommended version
    let alreadyNotified = false;
    try {
      alreadyNotified = localStorage.getItem(NOTIFIED_KEY) === LATEST_NATIVE_VERSION;
    } catch {}
    if (alreadyNotified) return;

    try { localStorage.setItem(NOTIFIED_KEY, LATEST_NATIVE_VERSION); } catch {}

    toast(`Nova versão disponível (${LATEST_NATIVE_VERSION})`, {
      description: `Você está na versão ${installed}. Atualize para receber as últimas melhorias.`,
      duration: 10000,
      action: {
        label: "Atualizar",
        onClick: () => {
          try {
            window.open(PLAY_STORE_URL, "_blank");
          } catch {}
        },
      },
    });
  } catch (e) {
    console.warn("[VersionCheck] failed:", e);
  }
}
