import { isCapacitorNative } from "@/lib/capacitorNative";

export type CapacitorAppMode = "partner" | "client";

const APP_MODE_KEY = "cap_app_mode";
const LEGACY_PARTNER_KEY = "cap_partner";

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