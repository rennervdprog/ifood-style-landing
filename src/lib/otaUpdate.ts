/**
 * OTA — helper de verificação manual.
 *
 * O download automático já roda em background via `autoUpdate: true` no
 * capacitor.config.ts. Este helper existe apenas para o botão "Verificar
 * atualizações" na tela de Perfil, que força um check imediato.
 */
import { isCapacitorNative } from "@/lib/capacitorNative";

export async function forceCheckForOtaUpdate(): Promise<void> {
  if (!isCapacitorNative()) return;
  try {
    const { CapacitorUpdater } = await import("@capgo/capacitor-updater");
    await CapacitorUpdater.getLatest();
  } catch (e) {
    console.warn("[OTA] forceCheckForOtaUpdate failed:", e);
    throw e;
  }
}