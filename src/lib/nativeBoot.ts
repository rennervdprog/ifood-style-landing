/**
 * Boot extra do app nativo — roda uma vez após initCapacitorNative().
 * Centraliza: OTA (Capgo), screen-orientation, network listener.
 * Mantém initCapacitorNative() responsável por push/status bar/splash.
 */
import { isCapacitorNative } from "@/lib/capacitorNative";
import { getCapacitorAppMode } from "@/lib/capacitorAppMode";

let booted = false;
let otaReadyCalled = false;

/**
 * Deve ser chamado o MAIS CEDO possível no cold start (antes de qualquer
 * requestIdleCallback). `notifyAppReady` é uma chamada barata (<5ms) que
 * impede o rollback automático do bundle atual pelo watchdog do plugin.
 * Isolado de `nativeBoot()` porque aquele roda em idle e pode não disparar
 * a tempo em execuções lentas — resultado seria "OTA não aplica".
 */
export async function notifyOtaAppReady() {
  if (!isCapacitorNative() || otaReadyCalled) return;
  otaReadyCalled = true;
  try {
    const { CapacitorUpdater } = await import("@capgo/capacitor-updater");
    await CapacitorUpdater.notifyAppReady();
  } catch (e) {
    console.warn("[OTA] notifyAppReady falhou:", e);
  }
}

export async function nativeBoot() {
  if (!isCapacitorNative() || booted) return;
  booted = true;

  // 1) OTA — self-hosted via bucket app-releases.
  //    (notifyAppReady já foi chamado cedo em main.tsx via notifyOtaAppReady)
  //    - Listeners emitem toast quando um bundle novo é baixado.
  //    - getLatest força um check em foreground.
  try {
    const { CapacitorUpdater } = await import("@capgo/capacitor-updater");

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