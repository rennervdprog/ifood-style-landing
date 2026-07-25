/**
 * OTA — verificação e aplicação manual.
 *
 * O download automático roda em background via `autoUpdate: true` no
 * capacitor.config.ts, mas nem sempre chega (rede lenta, app fechado antes,
 * bundle marcado como falho, etc.). Este helper faz o fluxo completo
 * manualmente: getLatest → download → set → reload — garantindo que o
 * usuário receba a versão nova imediatamente ao tocar "Verificar
 * atualizações" no Perfil.
 */
import { isCapacitorNative } from "@/lib/capacitorNative";
import { APP_VERSION } from "@/lib/appVersion";

export type OtaCheckResult =
  | { status: "not-native" }
  | { status: "up-to-date"; current: string }
  | { status: "downloading"; version: string }
  | { status: "applied"; version: string }
  | { status: "error"; message: string };

export async function forceCheckForOtaUpdate(): Promise<OtaCheckResult> {
  if (!isCapacitorNative()) return { status: "not-native" };
  try {
    const { CapacitorUpdater } = await import("@capgo/capacitor-updater");

    // 1) Confirma que o bundle atual está OK — impede rollback e desbloqueia set().
    try { await CapacitorUpdater.notifyAppReady(); } catch {}

    // 2) Consulta o manifest remoto.
    const latest: any = await CapacitorUpdater.getLatest();
    const remoteVersion: string | undefined = latest?.version;
    const remoteUrl: string | undefined = latest?.url;
    console.log("[OTA] getLatest →", latest);

    if (!remoteVersion || !remoteUrl) {
      return { status: "error", message: "Manifest remoto inválido" };
    }

    if (remoteVersion === APP_VERSION) {
      return { status: "up-to-date", current: APP_VERSION };
    }

    // 3) Baixa o bundle explicitamente (não depender do autoUpdate silencioso).
    const bundle: any = await CapacitorUpdater.download({
      url: remoteUrl,
      version: remoteVersion,
      // checksum opcional — o plugin já valida se veio no manifest.
      ...(latest?.checksum ? { checksum: latest.checksum } : {}),
      ...(latest?.sessionKey ? { sessionKey: latest.sessionKey } : {}),
    });
    console.log("[OTA] download OK →", bundle);

    if (!bundle?.id) {
      return { status: "error", message: "Download retornou bundle vazio" };
    }

    // 4) Aplica agora — reinicia o webview no novo bundle.
    await CapacitorUpdater.set({ id: bundle.id });
    return { status: "applied", version: remoteVersion };
  } catch (e: any) {
    const message = e?.message || String(e) || "Erro desconhecido";
    console.warn("[OTA] forceCheckForOtaUpdate failed:", e);
    return { status: "error", message };
  }
}