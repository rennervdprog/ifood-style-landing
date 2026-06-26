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

// PWA: registro guardado em src/lib/registerPWA.ts (NetworkFirst em /api/store/*
// + cache de imagens). Em preview/iframe/Capacitor o wrapper desregistra
// qualquer /sw.js antigo. firebase-messaging-sw.js permanece intacto.
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
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
