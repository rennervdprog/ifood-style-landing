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
import { getCapacitorAppMode } from "@/lib/capacitorAppMode";

const OTA_UPDATE_URL = "https://lktzrqjvqoojlrhqnxuz.supabase.co/functions/v1/ota-update";

function compareVersions(a: string, b: string): number {
  const parse = (value: string) => value.split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  const left = parse(a);
  const right = parse(b);
  const len = Math.max(left.length, right.length);
  for (let i = 0; i < len; i += 1) {
    const diff = (left[i] || 0) - (right[i] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

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

    const mode = getCapacitorAppMode() === "partner" ? "parceiro" : "cliente";
    const { App } = await import("@capacitor/app");
    const appInfo = await App.getInfo().catch(() => null);
    const current = await CapacitorUpdater.current().catch(() => null as any);
    const currentBundleVersion = current?.bundle?.version || APP_VERSION;

    // 2) Consulta o endpoint OTA público. Não usamos getLatest() aqui porque
    // APKs antigos apontavam direto para um arquivo estático, mas o plugin faz
    // POST no updateUrl; este caminho manual sempre fala com a edge function.
    const latestResponse = await fetch(OTA_UPDATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: appInfo?.id,
        version_name: currentBundleVersion,
        defaultChannel: mode,
      }),
    });
    const latest = await latestResponse.json().catch(() => null);
    if (!latestResponse.ok) {
      return { status: "error", message: latest?.message || "Falha ao consultar OTA" };
    }
    const remoteVersion: string | undefined = latest?.version;
    const remoteUrl: string | undefined = latest?.url;
    console.log("[OTA] getLatest →", latest);

    if (latest?.kind === "up_to_date" || latest?.error === "no_new_version_available") {
      return { status: "up-to-date", current: currentBundleVersion };
    }

    if (!remoteVersion || !remoteUrl) {
      return { status: "error", message: "Manifest remoto inválido" };
    }

    if (compareVersions(remoteVersion, currentBundleVersion) <= 0) {
      return { status: "up-to-date", current: currentBundleVersion };
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
    await CapacitorUpdater.reload();
    return { status: "applied", version: remoteVersion };
  } catch (e: any) {
    const message = e?.message || String(e) || "Erro desconhecido";
    console.warn("[OTA] forceCheckForOtaUpdate failed:", e);
    return { status: "error", message };
  }
}