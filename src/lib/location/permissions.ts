/**
 * Gerenciador unificado de permissão de GPS.
 * - Web: navigator.permissions + tentativa de re-prompt via getCurrentPosition.
 * - Capacitor (APK): @capacitor/geolocation + abertura de configurações nativas.
 *
 * Não dá pra ligar o GPS do SO via JS, mas a gente consegue:
 * 1) Pedir permissão de novo se o usuário tiver limpado/resetado.
 * 2) Abrir direto a tela de localização do celular no Android (Capacitor).
 * 3) Dar instruções precisas por navegador quando bloqueado de vez.
 */
import { isCapacitorNative } from "@/lib/capacitorNative";
import type { PermissionResult, PermissionState } from "./types";

async function openNativeLocationSettings(): Promise<void> {
  if (!isCapacitorNative()) return;
  try {
    const { NativeSettings, AndroidSettings, IOSSettings } = await import(
      "capacitor-native-settings"
    );
    await NativeSettings.open({
      optionAndroid: AndroidSettings.Location,
      optionIOS: IOSSettings.LocationServices,
    });
  } catch {
    try {
      const { App } = await import("@capacitor/app");
      await (App as any).openUrl?.({ url: "android.settings.LOCATION_SOURCE_SETTINGS" });
    } catch {
      /* ignore */
    }
  }
}

async function openAppSettings(): Promise<void> {
  if (!isCapacitorNative()) return;
  try {
    const { NativeSettings, AndroidSettings, IOSSettings } = await import(
      "capacitor-native-settings"
    );
    await NativeSettings.open({
      optionAndroid: AndroidSettings.ApplicationDetails,
      optionIOS: IOSSettings.App,
    });
  } catch {
    /* ignore */
  }
}

/** Lê o estado atual sem disparar prompt. */
export async function checkLocationPermission(): Promise<PermissionResult> {
  if (isCapacitorNative()) {
    try {
      const { Geolocation } = await import("@capacitor/geolocation");
      const perm = await Geolocation.checkPermissions();
      const granted = perm.location === "granted" || perm.coarseLocation === "granted";
      const state: PermissionState = granted
        ? "granted"
        : perm.location === "denied"
        ? "denied"
        : "prompt";
      return {
        state,
        message:
          state === "denied"
            ? "Permissão de localização negada. Abra as configurações do app para liberar."
            : undefined,
        openSettings: state === "denied" ? openAppSettings : undefined,
      };
    } catch {
      return { state: "unsupported" };
    }
  }

  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    return { state: "unsupported", message: "Este navegador não suporta GPS." };
  }

  if (typeof navigator.permissions?.query === "function") {
    try {
      const p = await navigator.permissions.query({ name: "geolocation" as PermissionName });
      const state: PermissionState =
        p.state === "granted" ? "granted" : p.state === "denied" ? "denied" : "prompt";
      return {
        state,
        message:
          state === "denied"
            ? "Permissão bloqueada. Clique no cadeado ao lado do endereço e libere a localização."
            : undefined,
      };
    } catch {
      /* fallback abaixo */
    }
  }
  return { state: "prompt" };
}

/**
 * Solicita permissão (dispara o prompt). Retorna granted/denied/services_off.
 * Em web "denied", tenta novamente um getCurrentPosition rápido — alguns
 * navegadores re-prompt se o usuário tiver limpado a permissão.
 */
export async function requestLocationPermission(): Promise<PermissionResult> {
  if (isCapacitorNative()) {
    try {
      const { Geolocation } = await import("@capacitor/geolocation");
      const perm = await Geolocation.requestPermissions();
      const granted = perm.location === "granted" || perm.coarseLocation === "granted";
      if (granted) {
        // Sanity check: tenta uma leitura rápida pra detectar serviço desligado.
        try {
          await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 4000 });
          return { state: "granted" };
        } catch (e: any) {
          const code = String(e?.code || e?.message || "");
          if (code.includes("0007") || /not enabled/i.test(code)) {
            return {
              state: "services_off",
              message: "GPS desligado no celular. Ative a localização nas configurações.",
              openSettings: openNativeLocationSettings,
            };
          }
          return { state: "granted" };
        }
      }
      return {
        state: "denied",
        message: "Permissão de localização negada para o app.",
        openSettings: openAppSettings,
      };
    } catch (e: any) {
      const code = String(e?.code || e?.message || "");
      if (code.includes("0007") || /not enabled/i.test(code)) {
        return {
          state: "services_off",
          message: "GPS desligado no celular. Ative a localização.",
          openSettings: openNativeLocationSettings,
        };
      }
      return { state: "denied" };
    }
  }

  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    return { state: "unsupported" };
  }

  return await new Promise<PermissionResult>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve({ state: "granted" }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          resolve({
            state: "denied",
            message:
              "Permissão bloqueada. Clique no cadeado/info ao lado do endereço do site e libere a localização, depois recarregue a página.",
          });
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          resolve({
            state: "services_off",
            message: "GPS indisponível no momento. Ative a localização do dispositivo.",
          });
        } else {
          resolve({ state: "prompt" });
        }
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  });
}

export { openNativeLocationSettings, openAppSettings };
