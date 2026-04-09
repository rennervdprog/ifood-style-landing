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
} else {
  // Production: detect SW updates and show a non-intrusive update banner
  if ("serviceWorker" in navigator) {
    let updatePending = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (updatePending) return;
      updatePending = true;
      // Show update banner instead of forcing reload
      const banner = document.createElement("div");
      banner.id = "sw-update-banner";
      banner.style.cssText = "position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:99999;background:#1f2937;color:#fff;padding:10px 20px;border-radius:12px;font-size:14px;display:flex;align-items:center;gap:12px;box-shadow:0 4px 20px rgba(0,0,0,0.3);font-family:system-ui,sans-serif;";
      banner.innerHTML = `
        <span>🔄 Nova versão disponível</span>
        <button id="sw-update-btn" style="background:#ef4444;color:#fff;border:none;padding:6px 16px;border-radius:8px;font-weight:bold;cursor:pointer;font-size:13px;">Atualizar</button>
        <button id="sw-dismiss-btn" style="background:transparent;color:#9ca3af;border:none;padding:4px;cursor:pointer;font-size:18px;line-height:1;">✕</button>
      `;
      document.body.appendChild(banner);
      document.getElementById("sw-update-btn")?.addEventListener("click", () => window.location.reload());
      document.getElementById("sw-dismiss-btn")?.addEventListener("click", () => banner.remove());
    });
  }
}

// Apply native-app class globally for GoNative/Median apps
if (window.gonative || window.median) {
  document.documentElement.classList.add("native-app");
}

createRoot(document.getElementById("root")!).render(<App />);
