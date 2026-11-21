// Firebase Analytics wrapper — funciona no Android nativo (Capacitor) e é
// no-op no web/preview. Erros nunca sobem para o usuário.
//
// LGPD (item 15): o Firebase Analytics só coleta com consentimento de
// analytics (`itasuper_consent`, ver src/lib/cookieConsent.ts). Sem
// consentimento, `setCollectionEnabled({ enabled: false })` e nenhum
// evento é enviado — o app funciona igual.
import { Capacitor } from "@capacitor/core";
import { hasAnalyticsConsent } from "@/lib/cookieConsent";

let analytics: any = null;
let ready = false;

async function loadNative() {
  if (ready || !Capacitor.isNativePlatform()) return;
  try {
    const mod = await import("@capacitor-firebase/analytics");
    analytics = mod.FirebaseAnalytics;
    // Gate de consentimento: sem aceite de analytics, a coleta fica
    // desligada (o padrão do plugin seria ligar).
    await analytics.setCollectionEnabled({ enabled: hasAnalyticsConsent() });
    ready = true;
  } catch (e) {
    console.warn("[Analytics] Firebase indisponível", e);
  }
}

export const initAnalytics = () => {
  void loadNative();
  if (!consentListenerAttached && typeof window !== "undefined") {
    consentListenerAttached = true;
    window.addEventListener("itasuper:consent-changed", () => {
      // Se o Firebase ainda não carregou, `loadNative` lê o consentimento
      // atualizado quando carregar; se já carregou, aplica na hora.
      if (analytics) applyAnalyticsConsent();
      else void loadNative();
    });
  }
};

/**
 * Aplica a escolha de consentimento em tempo real: aceitar analytics no
 * banner liga a coleta sem precisar recarregar; recusar desliga.
 * Chamado pelo banner via evento `itasuper:consent-changed` — registrado
 * uma única vez pelo primeiro `initAnalytics`.
 */
let consentListenerAttached = false;

export const applyAnalyticsConsent = () => {
  if (!analytics) return;
  analytics
    .setCollectionEnabled({ enabled: hasAnalyticsConsent() })
    .catch(() => {});
};

export const trackScreen = (name: string) => {
  if (!analytics || !hasAnalyticsConsent()) return;
  analytics.setCurrentScreen({ screenName: name }).catch(() => {});
};

export const trackEvent = (name: string, params?: Record<string, any>) => {
  if (!analytics || !hasAnalyticsConsent()) return;
  analytics.logEvent({ name, params: params || {} }).catch(() => {});
};

export const setAnalyticsUser = (userId: string | null) => {
  if (!analytics || !hasAnalyticsConsent()) return;
  analytics.setUserId({ userId: userId || null as any }).catch(() => {});
};