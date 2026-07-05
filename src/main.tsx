import { assertExternalBackend } from "./lib/externalBackend";

assertExternalBackend();

// Declarar extensões do Window para gonative/median (apps nativos WebView)
declare global {
  interface Window {
    gonative?: {
      onesignal?: {
        onesignalInfo?: (callback?: (info: any) => void) => void | Promise<any>;
        info?: (options: { callback: string }) => void;
        externalUserId?: { set?: (options: { externalId: string }) => void };
        setExternalUserId?: (id: string) => void;
      };
    };
    median?: {
      onesignal?: {
        onesignalInfo?: (callback?: (info: any) => void) => void | Promise<any>;
        info?: (options: { callback: string }) => void;
        externalUserId?: { set?: (options: { externalId: string }) => void };
        setExternalUserId?: (id: string) => void;
      };
    };
  }
}

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { HelmetProvider } from "react-helmet-async";

// Apply native-app class globally for GoNative/Median/Capacitor apps
import { Capacitor } from "@capacitor/core";

// 🚀 OTA: chama notifyAppReady cedo — impede rollback do bundle no próximo boot.
// É barato (<5ms) e desbloqueia o watchdog do plugin.
if (Capacitor.isNativePlatform?.()) {
  import("./lib/nativeBoot").then(({ notifyOtaAppReady }) => notifyOtaAppReady()).catch(() => {});
}

// 🚀 Cold-start: no APK Parceiro, se a URL inicial é "/" (rota padrão do
// Capacitor), reescreve para /portal-parceiro ANTES do React montar.
// Evita carregar o chunk pesado de StoreDirectory + queries de lojas/cidades
// só pra o RouteGuard redirecionar depois. Economiza ~1-2s no cold start.
try {
  const isCap = Capacitor.isNativePlatform?.();
  const appId = (Capacitor as any).getAppId?.() || "";
  const mode = import.meta.env.VITE_CAPACITOR_APP_MODE;
  const isPartner = mode === "parceiro" || appId.includes("parceiro");
  if (isCap && isPartner && (location.pathname === "/" || location.pathname === "/index")) {
    history.replaceState(null, "", "/portal-parceiro" + location.search + location.hash);
  }
} catch {}

// 🚀 Sentry + Analytics saem do caminho crítico do boot — carregados só
// depois do primeiro paint via requestIdleCallback (evita bloquear ~150KB
// de JS no cold start do APK).
const bootObservability = () => {
  import("./lib/sentry").then(({ initSentry }) => initSentry()).catch(() => {});
  import("./lib/analytics").then(({ initAnalytics }) => initAnalytics()).catch(() => {});
};
if (typeof (window as any).requestIdleCallback === "function") {
  (window as any).requestIdleCallback(bootObservability, { timeout: 3000 });
} else {
  setTimeout(bootObservability, 1500);
}

// PWA: aggressively reset stale service workers in preview/iframe contexts
// AND inside Capacitor native (PWA features are redundant — the OS handles install/push).
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const isPreviewHost =
  (window as any).location.hostname.includes("id-preview--") ||
  (window as any).location.hostname.includes("lovableproject.com");

const isCapacitor = Capacitor.isNativePlatform();

// PWA: registro guardado em src/lib/registerPWA.ts (NetworkFirst em /api/store/*
// + cache de imagens). Em preview/iframe/Capacitor o wrapper desregistra
// qualquer /sw.js antigo. firebase-messaging-sw.js permanece intacto.
// Pular no APK Capacitor — Service Worker é redundante lá (o Android já cacheia
// o bundle local + Capgo cuida de OTA). Evita import + trabalho no cold start.
if (typeof window !== "undefined" && "serviceWorker" in navigator && !isCapacitor) {
  import("./lib/registerPWA").then(({ registerPWA }) => registerPWA()).catch(() => {});
}

if (window.gonative || window.median || isCapacitor) {
  document.documentElement.classList.add("native-app");
  document.body.classList.add("native-app");
}

// Listener de atualização do Service Worker
// Quando um novo SW toma controle, limpar caches e recarregar
if ("serviceWorker" in navigator && !isPreviewHost && !isInIframe && !isCapacitor) {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // Ignorar trocas de controlador do firebase-messaging-sw.js — esse SW
    // só serve push em background e atualiza sozinho, não deve disparar reload.
    const ctrl = navigator.serviceWorker.controller;
    if (ctrl && ctrl.scriptURL && ctrl.scriptURL.includes("firebase-messaging-sw")) {
      return;
    }
    // Usar localStorage com timestamp — persiste entre reloads, evita loop
    const reloadKey = "sw-update-reload-ts";
    const lastReload = Number(localStorage.getItem(reloadKey) || 0);
    const now = Date.now();
    // Só recarrega se não houve reload nos últimos 5 minutos
    if (now - lastReload > 5 * 60 * 1000) {
      localStorage.setItem(reloadKey, String(now));
      if ("caches" in window) {
        caches.keys()
          .then(keys => Promise.all(keys.map(k => caches.delete(k))))
          .catch(() => {})
          .finally(() => (window as any).location.reload());
      } else {
        (window as any).location.reload();
      }
    }
  });
}

createRoot(document.getElementById("root")!).render(
  <HelmetProvider><App /></HelmetProvider>
);

// 🚀 Splash: esconde IMEDIATAMENTE após o primeiro paint do React —
// não espera useEffect dos Providers (que só disparam depois do mount de
// AuthProvider/StoreProvider/CartProvider). Ganha 400-800ms de percepção.
if (Capacitor.isNativePlatform?.()) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      import("./lib/capacitorNative").then(({ hideSplash }) => hideSplash()).catch(() => {});
    });
  });
}

// Web Vitals — chamado DEPOIS do React montar, nunca antes
// Usa requestIdleCallback para não competir com o primeiro render
if (typeof requestIdleCallback !== "undefined") {
  requestIdleCallback(() => {
    import("./lib/sentry").then(({ initWebVitals }) => initWebVitals()).catch(() => {});
  });
} else {
  setTimeout(() => {
    import("./lib/sentry").then(({ initWebVitals }) => initWebVitals()).catch(() => {});
  }, 2000);
}

// Fase 6 — Vercel Analytics + Speed Insights (Web Vitals reais p/ dashboard Vercel)
// Só roda em produção web (não em dev, iframe preview Lovable ou Capacitor nativo).
(() => {
  try {
    if (import.meta.env.DEV) return;
    if (typeof window === "undefined") return;
    if (Capacitor.isNativePlatform?.()) return;
    if (window.self !== window.top) return; // iframe (preview Lovable)
    const host = window.location.hostname;
    if (host.endsWith("lovable.app") || host.endsWith("lovableproject.com")) return;
    const load = () => {
      Promise.all([
        import("@vercel/analytics"),
        import("@vercel/speed-insights"),
      ])
        .then(([a, s]) => {
          a.inject?.();
          s.injectSpeedInsights?.();
        })
        .catch(() => {});
    };
    if (typeof requestIdleCallback !== "undefined") requestIdleCallback(load, { timeout: 4000 });
    else setTimeout(load, 2500);
  } catch {}
})();

// Remove o shell estático assim que o React montar.
// requestAnimationFrame garante que rodamos depois do primeiro paint do React,
// evitando "flash branco" entre a remoção do shell e o primeiro frame da SPA.
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    const shell = document.getElementById("lcp-shell");
    if (shell) {
      shell.style.transition = "opacity .15s ease-out";
      shell.style.opacity = "0";
      setTimeout(() => shell.remove(), 180);
    }
    // Tira o background fixo do body para herdar o tema do app
    document.body.style.background = "";
  });
});
