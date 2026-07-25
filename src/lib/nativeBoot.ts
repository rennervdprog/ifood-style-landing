/**
 * Boot extra do app nativo — roda uma vez após initCapacitorNative().
 * Centraliza: OTA (Capgo), screen-orientation, network listener.
 * Mantém initCapacitorNative() responsável por push/status bar/splash.
 */
import { isCapacitorNative } from "@/lib/capacitorNative";
import { getCapacitorAppMode } from "@/lib/capacitorAppMode";

let booted = false;
let otaReadyCalled = false;

function setNativeKeyboardOpen(open: boolean) {
  const root = document.documentElement;
  const body = document.body;

  if (open) {
    root.classList.add("keyboard-open");
    body.classList.add("keyboard-open");
    return;
  }

  root.classList.remove("keyboard-open");
  body.classList.remove("keyboard-open");
}

function keepFocusedFieldVisible(delay = 120) {
  window.setTimeout(() => {
    window.requestAnimationFrame(() => {
      const active = document.activeElement;
      if (!(active instanceof HTMLElement)) return;

      const tagName = active.tagName.toLowerCase();
      const isEditable =
        tagName === "input" ||
        tagName === "textarea" ||
        active.isContentEditable ||
        active.getAttribute("role") === "textbox";

      if (!isEditable) return;

      const rect = active.getBoundingClientRect();
      const safeTop = 72;
      const safeBottom = window.innerHeight - 24;

      if (rect.top >= safeTop && rect.bottom <= safeBottom) return;

      active.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
    });
  }, delay);
}

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
    // O endpoint ota-update separa cliente/parceiro pelo app_id nativo.
    const scheduleLatest = () => CapacitorUpdater.getLatest().catch((e: unknown) => {
      console.warn("[OTA] getLatest falhou:", e);
    });
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

  // 4) Keyboard — no Android usamos o resize NATIVO do sistema
  //    (AndroidManifest adjustResize). Não forçamos altura/padding manual:
  //    esse hack criava a "faixa" branca/cinza entre input e teclado.
  try {
    const { Keyboard } = await import("@capacitor/keyboard");
    await Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(() => {});

    Keyboard.addListener("keyboardWillShow", () => {
      setNativeKeyboardOpen(true);
      keepFocusedFieldVisible(160);
    });
    Keyboard.addListener("keyboardDidShow", () => {
      setNativeKeyboardOpen(true);
      keepFocusedFieldVisible(40);
    });
    Keyboard.addListener("keyboardWillHide", () => setNativeKeyboardOpen(false));
    Keyboard.addListener("keyboardDidHide", () => setNativeKeyboardOpen(false));
    window.addEventListener("focusin", () => {
      if (document.documentElement.classList.contains("keyboard-open")) {
        keepFocusedFieldVisible(80);
      }
    });
  } catch {}

  // 5) Safe-area nativo — o plugin @capacitor-community/safe-area já publica
  //    as CSS vars --safe-area-inset-* automaticamente no boot nativo
  //    (config em capacitor.config.ts). Aqui só logamos que carregou.
  try {
    await import("@capacitor-community/safe-area");
  } catch {}
}