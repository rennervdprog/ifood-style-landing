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
  // Production: detect SW updates and reload immediately
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.location.reload();
    });
  }
}

// Apply native-app class globally for GoNative/Median apps
if (window.gonative || window.median) {
  document.documentElement.classList.add("native-app");
}

createRoot(document.getElementById("root")!).render(<App />);
