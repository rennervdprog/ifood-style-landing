/**
 * Boot extra do app nativo — roda uma vez após initCapacitorNative().
 * Centraliza: OTA (Capgo), screen-orientation, network listener.
 * Mantém initCapacitorNative() responsável por push/status bar/splash.
 */
import { isCapacitorNative } from "@/lib/capacitorNative";
import { getCapacitorAppMode } from "@/lib/capacitorAppMode";

let booted = false;

export async function nativeBoot() {
  if (!isCapacitorNative() || booted) return;
  booted = true;

  // 1) OTA — sinaliza que o bundle atual está OK e busca atualização.
  try {
    const { CapacitorUpdater } = await import("@capgo/capacitor-updater");
    // Marca esta versão como "ready" (evita rollback automático).
    await CapacitorUpdater.notifyAppReady();
    // Dispara verificação em background; se houver bundle novo será
    // aplicado no próximo cold start (autoUpdate=true no config).
    CapacitorUpdater.getLatest().catch(() => {});
  } catch (e) {
    console.warn("[NativeBoot] CapacitorUpdater not available:", e);
  }

  // 2) Entregador / Parceiro: trava em portrait (evita layouts quebrados).
  if (getCapacitorAppMode() === "partner") {
    try {
      const { ScreenOrientation } = await import("@capacitor/screen-orientation");
      await ScreenOrientation.lock({ orientation: "portrait" });
    } catch {}
  }

  // 3) Network listener — emite evento global usado por banners/queries.
  try {
    const { Network } = await import("@capacitor/network");
    Network.addListener("networkStatusChange", (status) => {
      window.dispatchEvent(
        new CustomEvent("native-network-change", { detail: status }),
      );
    });
  } catch {}
}