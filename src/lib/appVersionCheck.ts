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

import { supabase } from "@/integrations/supabase/client";

const NOTIFIED_KEY = "itasuper_update_notified_for";
const DOWNLOAD_URL = "https://itasuper.com.br/download";

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

export async function checkAppVersion(appType: "cliente" | "parceiro" = "cliente") {
  if (!isCapacitorNative()) return;
  try {
    // Get latest version from Supabase
    const { data } = await supabase.storage
      .from('app-releases')
      .download(`version-${appType}.json`);
    
    if (!data) return;
    
    const text = await data.text();
    const { version: latestVersion } = JSON.parse(text);

    const { App } = await import("@capacitor/app");
    const info = await App.getInfo();
    const installed = info.version || "0.0.0";
    
    if (!isOlder(installed, latestVersion)) return;

    // Show only once per recommended version
    let alreadyNotified = false;
    try {
      alreadyNotified = localStorage.getItem(NOTIFIED_KEY) === latestVersion;
    } catch {}
    if (alreadyNotified) return;

    try { localStorage.setItem(NOTIFIED_KEY, latestVersion); } catch {}

    toast(`Nova versão disponível (${latestVersion})`, {
      description: `Você está na versão ${installed}. Atualize para receber as últimas melhorias.`,
      duration: 10000,
      action: {
        label: "Atualizar",
        onClick: () => {
          try {
            window.open(DOWNLOAD_URL, "_blank");
          } catch {}
        },
      },
    });
  } catch (e) {
    console.warn("[VersionCheck] failed:", e);
  }
}
