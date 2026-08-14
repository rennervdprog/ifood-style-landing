import { Capacitor } from "@capacitor/core";

/**
 * Fase 5 — Fonte única para resolução de deep-links / rotas iniciais do Capacitor.
 *
 * Hoje temos lógica espalhada em:
 *  - `main.tsx`  → cold-start rewrite `/` → `/portal-parceiro` no APK parceiro
 *  - `App.tsx`   → `<PushNavigator/>` + `consumePendingPushNavigation`
 *  - `lib/capacitorNative.ts` → `appUrlOpen` + `backButton`
 *
 * Esta camada centraliza APENAS o rewrite de cold-start (chamado antes do React
 * montar). As demais integrações continuam onde estão até a migração para
 * `createBrowserRouter` (evita mover listeners junto com a arquitetura).
 */

function detectPartnerApp(): boolean {
  try {
    const appId = (Capacitor as unknown as { getAppId?: () => string }).getAppId?.() || "";
    const mode = import.meta.env.VITE_CAPACITOR_APP_MODE;
    return mode === "parceiro" || appId.includes("parceiro");
  } catch {
    return false;
  }
}

/**
 * Reescreve `location.pathname` para a home nativa correta antes do React montar.
 * Segurança: só age em rotas raiz (`/` ou `/index`) para não pisar em deep-links.
 * Retorna o novo path aplicado, ou `null` se nada mudou.
 */
export function resolveNativeColdStartPath(): string | null {
  try {
    if (!Capacitor.isNativePlatform?.()) return null;
    const path = location.pathname;
    const isRoot = path === "/" || path === "/index";
    if (!isRoot) return null;

    // App Parceiro → /portal-parceiro. (App Cliente já usa "/" como home.)
    if (detectPartnerApp()) {
      const next = "/portal-parceiro" + location.search + location.hash;
      history.replaceState(null, "", next);
      return next;
    }
    return null;
  } catch {
    return null;
  }
}