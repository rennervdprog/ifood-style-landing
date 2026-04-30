import { initSentry } from "./lib/sentry";

initSentry();

console.log("[Main] App starting...", { platform: navigator.userAgent?.slice(0, 80) });
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// PWA: aggressively reset stale service workers in preview/iframe contexts
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

if (isPreviewHost || isInIframe) {
  navigator.serviceWorker?.getRegistrations().then(async (registrations) => {
    if (registrations.length === 0) return;

    await Promise.all(registrations.map((registration) => registration.unregister()));

    const reloadKey = "preview-sw-reset";
    if (!sessionStorage.getItem(reloadKey)) {
      sessionStorage.setItem(reloadKey, "1");
      window.location.reload();
      return;
    }

    sessionStorage.removeItem(reloadKey);
  });
}

// Apply native-app class globally for GoNative/Median/Capacitor apps
import { Capacitor } from "@capacitor/core";
if (window.gonative || window.median || Capacitor.isNativePlatform()) {
  document.documentElement.classList.add("native-app");
  document.body.classList.add("native-app");
}

createRoot(document.getElementById("root")!).render(<App />);

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
