// Firebase Analytics wrapper — funciona no Android nativo (Capacitor) e é
// no-op no web/preview. Erros nunca sobem para o usuário.
import { Capacitor } from "@capacitor/core";

let analytics: any = null;
let ready = false;

async function loadNative() {
  if (ready || !Capacitor.isNativePlatform()) return;
  try {
    const mod = await import("@capacitor-firebase/analytics");
    analytics = mod.FirebaseAnalytics;
    await analytics.setCollectionEnabled({ enabled: true });
    ready = true;
  } catch (e) {
    console.warn("[Analytics] Firebase indisponível", e);
  }
}

export const initAnalytics = () => {
  void loadNative();
};

export const trackScreen = (name: string) => {
  if (!analytics) return;
  analytics.setCurrentScreen({ screenName: name }).catch(() => {});
};

export const trackEvent = (name: string, params?: Record<string, any>) => {
  if (!analytics) return;
  analytics.logEvent({ name, params: params || {} }).catch(() => {});
};

export const setAnalyticsUser = (userId: string | null) => {
  if (!analytics) return;
  analytics.setUserId({ userId: userId || null as any }).catch(() => {});
};