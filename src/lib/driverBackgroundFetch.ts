/**
 * Driver Background Fetch — sincroniza estado do motoboy com o
 * Background Runner nativo (`public/runners/driverBackground.js`).
 *
 * O Runner roda em contexto isolado nativo (sem React/Supabase SDK),
 * por isso passamos os dados via `BackgroundRunner.setKeyValue` (CapacitorKV).
 *
 * Use `syncDriverBackgroundState` toda vez que o motoboy ficar online/offline
 * ou as lojas vinculadas mudarem.
 */
import { isCapacitorNative } from "@/lib/capacitorNative";

const KV = {
  SUPABASE_URL: "SUPABASE_URL",
  SUPABASE_KEY: "SUPABASE_KEY",
  USER_ID: "USER_ID",
  LINKED_STORE_IDS: "LINKED_STORE_IDS",
  ONLINE: "ONLINE",
  LAST_SEEN_ORDER_IDS: "LAST_SEEN_ORDER_IDS",
};

let initPromise: Promise<void> | null = null;

const RUNNER_LABEL = "app.itasuper.driver.background";

async function dispatchState(details: Record<string, unknown>) {
  if (!isCapacitorNative()) return;
  try {
    const { BackgroundRunner } = await import("@capacitor/background-runner");
    await BackgroundRunner.dispatchEvent({
      label: RUNNER_LABEL,
      event: "setState",
      details,
    });
  } catch {
    // Plugin pode não estar disponível em web/dev — no-op silencioso.
  }
}

/**
 * Inicializa o background fetch do motoboy:
 *  - Pede permissão de notificações locais (uma vez)
 *  - Persiste credenciais e identificadores no KV do runner
 *  - Dispara um check imediato pra validar que tudo funciona
 */
export async function initDriverBackgroundFetch(opts: {
  userId: string;
  linkedStoreIds: string[];
  isOnline: boolean;
}) {
  if (!isCapacitorNative()) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // Permissão de notificações locais
      try {
        const { LocalNotifications } = await import("@capacitor/local-notifications");
        const perm = await LocalNotifications.checkPermissions();
        if (perm.display !== "granted") {
          await LocalNotifications.requestPermissions();
        }
      } catch {}

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

      await dispatchState({
        SUPABASE_URL: supabaseUrl || "",
        SUPABASE_KEY: supabaseKey || "",
        USER_ID: opts.userId,
        LINKED_STORE_IDS: opts.linkedStoreIds.join(","),
        ONLINE: opts.isOnline ? "1" : "0",
      });

      // Dispara um check imediato (não espera o intervalo de 15 min)
      try {
        const { BackgroundRunner } = await import("@capacitor/background-runner");
        await BackgroundRunner.dispatchEvent({
          label: RUNNER_LABEL,
          event: "checkForOrders",
          details: {},
        });
      } catch {}
    } catch (e) {
      console.warn("[DriverBgFetch] init failed:", e);
    }
  })();

  return initPromise;
}

/** Atualiza estado online/offline do motoboy no KV (sem reinicializar). */
export async function setDriverBackgroundOnline(isOnline: boolean) {
  await dispatchState({ ONLINE: isOnline ? "1" : "0" });
}

/** Atualiza lojas vinculadas (após aceitar/recusar convite). */
export async function setDriverBackgroundStores(storeIds: string[]) {
  await dispatchState({ LINKED_STORE_IDS: storeIds.join(",") });
}

/** Limpa o estado quando o motoboy faz logout — para o runner não buscar nada. */
export async function clearDriverBackgroundState() {
  await dispatchState({ RESET: true });
}