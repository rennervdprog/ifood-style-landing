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

  // 1) OTA — self-hosted via bucket app-releases.
  //    - notifyAppReady evita rollback automático do bundle atual.
  //    - Listeners emitem toast quando um bundle novo é baixado.
  //    - getLatest força um check em foreground.
  try {
    const { CapacitorUpdater } = await import("@capgo/capacitor-updater");
    await CapacitorUpdater.notifyAppReady();

    CapacitorUpdater.addListener("updateAvailable", async (info: any) => {
      console.log("[OTA] Novo bundle disponível:", info?.bundle?.version);
      try {
        const { toast } = await import("sonner");
        toast.success("Atualização baixada", {
          description: "Será aplicada ao reabrir o app.",
          duration: 6000,
        });
      } catch {}
    });

    CapacitorUpdater.addListener("downloadFailed", (info: any) => {
      console.warn("[OTA] Download falhou:", info);
    });

    // Adiar checagem de OTA pra depois do primeiro paint — não competir
    // com o render inicial nem com a hidratação de dados.
    const scheduleLatest = () => CapacitorUpdater.getLatest().catch(() => {});
    const w = window as any;
    if (typeof w.requestIdleCallback === "function") {
      w.requestIdleCallback(scheduleLatest, { timeout: 5000 });
    } else {
      setTimeout(scheduleLatest, 3000);
    }
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