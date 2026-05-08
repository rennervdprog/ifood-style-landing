/**
 * Haptic feedback utility (Capacitor).
 *
 * Sem efeito quando rodando na web — todos os métodos são no-op fora do APK.
 * Importe como `import { haptic } from "@/lib/haptics"`.
 */
import { isCapacitorNative } from "@/lib/capacitorNative";

let plugin: any = null;
let loading: Promise<any> | null = null;

async function getPlugin() {
  if (plugin) return plugin;
  if (loading) return loading;
  loading = import("@capacitor/haptics").then((m) => {
    plugin = m;
    return m;
  }).catch(() => null);
  return loading;
}

export const haptic = {
  /** Pequena vibração — uso geral em toques importantes */
  light: async () => {
    if (!isCapacitorNative()) return;
    const p = await getPlugin();
    try { await p?.Haptics.impact({ style: p.ImpactStyle.Light }); } catch {}
  },
  /** Vibração média — confirmar ação (aceitar pedido, sair p/ entrega) */
  medium: async () => {
    if (!isCapacitorNative()) return;
    const p = await getPlugin();
    try { await p?.Haptics.impact({ style: p.ImpactStyle.Medium }); } catch {}
  },
  /** Vibração forte — alertar (novo pedido, entrega confirmada) */
  heavy: async () => {
    if (!isCapacitorNative()) return;
    const p = await getPlugin();
    try { await p?.Haptics.impact({ style: p.ImpactStyle.Heavy }); } catch {}
  },
  /** Sucesso — após finalizar entrega/PIN correto */
  success: async () => {
    if (!isCapacitorNative()) return;
    const p = await getPlugin();
    try { await p?.Haptics.notification({ type: p.NotificationType.Success }); } catch {}
  },
  /** Aviso — recusar pedido / status mudou */
  warning: async () => {
    if (!isCapacitorNative()) return;
    const p = await getPlugin();
    try { await p?.Haptics.notification({ type: p.NotificationType.Warning }); } catch {}
  },
  /** Erro — PIN inválido / falha em ação */
  error: async () => {
    if (!isCapacitorNative()) return;
    const p = await getPlugin();
    try { await p?.Haptics.notification({ type: p.NotificationType.Error }); } catch {}
  },
  /**
   * Padrão "novo pedido" — combo forte que chama atenção mesmo no bolso.
   * 3 batidas heavy espaçadas.
   */
  newOrder: async () => {
    if (!isCapacitorNative()) return;
    const p = await getPlugin();
    if (!p) return;
    try {
      await p.Haptics.impact({ style: p.ImpactStyle.Heavy });
      setTimeout(() => p.Haptics.impact({ style: p.ImpactStyle.Heavy }).catch(() => {}), 180);
      setTimeout(() => p.Haptics.impact({ style: p.ImpactStyle.Heavy }).catch(() => {}), 360);
    } catch {}
  },
};