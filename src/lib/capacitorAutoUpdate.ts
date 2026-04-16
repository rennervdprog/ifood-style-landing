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

const CHECK_INTERVAL_MS = 60_000; // Check every 60s
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
    const currentHash = await fetchBuildHash();
    if (!currentHash) return;

    const storedHash = localStorage.getItem(BUILD_HASH_KEY);

    if (!storedHash) {
      // First run — store the current hash
      localStorage.setItem(BUILD_HASH_KEY, currentHash);
      return;
    }

    if (currentHash !== storedHash) {
      console.log("[AutoUpdate] 🚀 New version detected, reloading...");
      localStorage.setItem(BUILD_HASH_KEY, currentHash);

      // Small delay to let any pending operations complete
      setTimeout(() => {
        window.location.reload();
      }, 1000);
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

  console.log("[AutoUpdate] ✅ Auto-update checker started (every 60s)");

  // Check immediately on start
  setTimeout(checkForUpdate, 5000);

  // Then check periodically
  intervalId = setInterval(checkForUpdate, CHECK_INTERVAL_MS);

  // Also check when app resumes from background
  if (isCapacitorNative()) {
    import("@capacitor/app").then(({ App }) => {
      App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) {
          setTimeout(checkForUpdate, 2000);
        }
      });
    }).catch(() => {});
  }
}

export function stopAutoUpdate() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
