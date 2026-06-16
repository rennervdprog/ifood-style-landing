import { initSentry } from "./lib/sentry";
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

initSentry();

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { HelmetProvider } from "react-helmet-async";

// Apply native-app class globally for GoNative/Median/Capacitor apps
import { Capacitor } from "@capacitor/core";

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

if (isPreviewHost || isInIframe || isCapacitor) {
  navigator.serviceWorker?.getRegistrations().then(async (registrations) => {
    if (registrations.length === 0) return;

    await Promise.all(registrations.map((registration) => registration.unregister()));

    // Inside Capacitor we don't reload — the WebView would loop. The next launch is clean.
    if (isCapacitor) return;

    const reloadKey = "preview-sw-reset";
    if (!sessionStorage.getItem(reloadKey)) {
      sessionStorage.setItem(reloadKey, "1");
      window.location.reload();
      return;
    }

    sessionStorage.removeItem(reloadKey);
  });

  // Also wipe any caches the SW left behind (Capacitor only — preview reload above already triggers fetch).
  if (isCapacitor && "caches" in window) {
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).catch(() => {});
  }
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
