import { isCapacitorNative } from "@/lib/capacitorNative";

export type CapacitorAppMode = "partner" | "client";

const APP_MODE_KEY = "cap_app_mode";
const LEGACY_PARTNER_KEY = "cap_partner";
const BUILD_TIME_APP_MODE = (import.meta.env.VITE_CAPACITOR_APP_MODE || "").toLowerCase();
let nativeDetectedMode: CapacitorAppMode | null = null;
let nativeDetectionPromise: Promise<CapacitorAppMode | null> | null = null;

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

function normalizeMode(value: string | undefined | null): CapacitorAppMode | null {
  if (value === "partner" || value === "parceiro") return "partner";
  if (value === "client" || value === "cliente") return "client";
  return null;
}

function detectModeFromIdentifier(identifier: string | undefined | null): CapacitorAppMode | null {
  if (!identifier) return null;
  if (PARTNER_APP_IDS.has(identifier)) return "partner";
  if (CLIENT_APP_IDS.has(identifier)) return "client";
  // Fallback heurístico para appIds futuros
  if (/parceiro|partner/i.test(identifier)) return "partner";
  if (/cliente|client/i.test(identifier)) return "client";
  return null;
}

function getBuildTimeAppMode(): CapacitorAppMode | null {
  return normalizeMode(BUILD_TIME_APP_MODE);
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