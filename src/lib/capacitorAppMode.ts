import { isCapacitorNative } from "@/lib/capacitorNative";
import { Capacitor } from "@capacitor/core";

export type CapacitorAppMode = "partner" | "client";

const APP_MODE_KEY = "cap_app_mode";
const LEGACY_PARTNER_KEY = "cap_partner";

/**
 * Native appIds dos APKs gerados pelo workflow de build.
 * Esta é a fonte da verdade definitiva — o appId é fixado em build time.
 */
const PARTNER_APP_IDS = new Set<string>([
  "app.itasuper.parceiro",
]);
const CLIENT_APP_IDS = new Set<string>([
  "app.itasuper.cliente",
  // legacy
  "app.lovable.e8d28aded6334d74be2161c8dbe24765",
]);

/** Lê o appId nativo (ex: app.itasuper.parceiro) — só funciona dentro do APK. */
function getNativeAppId(): string | null {
  try {
    if (!isCapacitorNative()) return null;
    // Capacitor.getAppId() existe em runtime nativo
    const anyCap = Capacitor as any;
    if (typeof anyCap.getAppId === "function") {
      const id = anyCap.getAppId();
      return typeof id === "string" && id ? id : null;
    }
  } catch {}
  return null;
}

/** Detecta o modo do APK pelo appId nativo (mais confiável que URL/storage). */
function detectModeFromNativeAppId(): CapacitorAppMode | null {
  const appId = getNativeAppId();
  if (!appId) return null;
  if (PARTNER_APP_IDS.has(appId)) return "partner";
  if (CLIENT_APP_IDS.has(appId)) return "client";
  // Fallback heurístico para appIds futuros
  if (/parceiro|partner/i.test(appId)) return "partner";
  if (/cliente|client/i.test(appId)) return "client";
  return null;
}

export function persistCapacitorAppMode(mode: CapacitorAppMode) {
  try {
    sessionStorage.setItem(APP_MODE_KEY, mode);
    localStorage.setItem(APP_MODE_KEY, mode);

    if (mode === "partner") {
      sessionStorage.setItem(LEGACY_PARTNER_KEY, "1");
      localStorage.setItem(LEGACY_PARTNER_KEY, "1");
      (window as any).__CAP_PARTNER_REDIRECTED = true;
    } else {
      sessionStorage.removeItem(LEGACY_PARTNER_KEY);
      localStorage.removeItem(LEGACY_PARTNER_KEY);
      delete (window as any).__CAP_PARTNER_REDIRECTED;
    }
  } catch {}
}

export function getCapacitorAppMode(): CapacitorAppMode | null {
  if (!isCapacitorNative()) return null;

  // 1) Fonte da verdade definitiva: appId nativo do APK
  const nativeMode = detectModeFromNativeAppId();
  if (nativeMode) {
    persistCapacitorAppMode(nativeMode);
    return nativeMode;
  }

  // 2) Override explícito por URL (?capApp=partner|client) — útil para testes
  const params = new URLSearchParams(window.location.search);
  const explicitMode = params.get("capApp");
  if (explicitMode === "partner" || explicitMode === "client") {
    persistCapacitorAppMode(explicitMode);
    return explicitMode;
  }

  if ((window as any).__CAP_PARTNER_REDIRECTED) {
    persistCapacitorAppMode("partner");
    return "partner";
  }

  try {
    const storedMode = sessionStorage.getItem(APP_MODE_KEY) || localStorage.getItem(APP_MODE_KEY);
    if (storedMode === "partner" || storedMode === "client") {
      return storedMode;
    }

    const legacyPartner =
      sessionStorage.getItem(LEGACY_PARTNER_KEY) === "1" ||
      localStorage.getItem(LEGACY_PARTNER_KEY) === "1";

    if (legacyPartner) {
      persistCapacitorAppMode("partner");
      return "partner";
    }
  } catch {}

  return null;
}

export function isPartnerCapacitorApp(): boolean {
  return getCapacitorAppMode() === "partner";
}