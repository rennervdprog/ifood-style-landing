/**
 * Capacitor Auto-Update
 * 
 * Since the Capacitor app loads from the live URL (itasuper.com.br),
 * we detect new deployments by checking the Vite build hash.
 * When a new version is detected, the WebView reloads automatically.
 * 
 * Works both in Capacitor native and regular web — on web it's a no-op
 * unless the user has been on the page for a long time.
 */
import { isCapacitorNative } from "@/lib/capacitorNative";

const CHECK_INTERVAL_MS = 5 * 60_000; // Check every 5 min (was 30s — much less battery/data)
const BUILD_HASH_KEY = "itasuper_build_hash";
let checking = false;
let intervalId: ReturnType<typeof setInterval> | null = null;

/** Extract a fingerprint from index.html script/link tags */
async function fetchBuildHash(): Promise<string | null> {
  try {
    const res = await fetch(`/?_t=${Date.now()}`, {
      cache: "no-store",
      headers: { Accept: "text/html" },
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Extract hashed asset filenames from <script src="..."> and <link href="...">
    const hashes = html.match(/\/assets\/[^"']+\.[a-f0-9]{8}\.[^"']+/g);
    if (!hashes || hashes.length === 0) return null;

    // Join all hashed filenames into a single fingerprint
    return hashes.sort().join("|");
  } catch {
    return null;
  }
}

async function checkForUpdate() {
  if (checking) return;
  checking = true;

  try {
    // Skip if offline — saves a doomed network round-trip
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return;
    }

    const currentHash = await fetchBuildHash();
    if (!currentHash) return;

    const storedHash = localStorage.getItem(BUILD_HASH_KEY);

    if (!storedHash) {
      // First run — store the current hash
      localStorage.setItem(BUILD_HASH_KEY, currentHash);
      return;
    }

    if (currentHash !== storedHash) {
      console.log("[AutoUpdate] 🚀 New version detected, clearing caches and reloading...");
      localStorage.setItem(BUILD_HASH_KEY, currentHash);

      // Clear caches so the WebView fetches fresh assets
      try {
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
        const regs = await navigator.serviceWorker?.getRegistrations();
        if (regs) await Promise.all(regs.map((r) => r.unregister()));
      } catch (e) {
        console.warn("[AutoUpdate] Cache clear failed:", e);
      }

      setTimeout(() => {
        // Force reload bypassing cache
        window.location.href = window.location.pathname + "?_v=" + Date.now();
      }, 500);
    }
  } catch (e) {
    console.warn("[AutoUpdate] Check failed:", e);
  } finally {
    checking = false;
  }
}

/**
 * Start the auto-update checker.
 * Should be called once from App.tsx.
 */
export function initAutoUpdate() {
  // Only run in Capacitor native or if explicitly enabled
  if (!isCapacitorNative()) return;

  console.log("[AutoUpdate] ✅ Auto-update checker started (every 5min)");

  // Check after 5s on start (don't compete with first paint)
  setTimeout(checkForUpdate, 5000);

  // Then check periodically
  intervalId = setInterval(checkForUpdate, CHECK_INTERVAL_MS);

  // Also check when app resumes from background — but only if it's been a while
  let lastResumeCheck = Date.now();
  import("@capacitor/app").then(({ App }) => {
    App.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) return;
      const now = Date.now();
      // Throttle: only check on resume if >2min since last check
      if (now - lastResumeCheck < 2 * 60_000) return;
      lastResumeCheck = now;
      setTimeout(checkForUpdate, 2000);
    });
  }).catch(() => {});
}

export function stopAutoUpdate() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
