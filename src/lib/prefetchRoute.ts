/**
 * Route chunk prefetch registry.
 *
 * Register lazy imports by path once, then trigger them from hover/focus/touch
 * handlers on links pointing at that path. Uses `requestIdleCallback` +
 * `navigator.connection.saveData` to avoid burning mobile data.
 */
type Loader = () => Promise<unknown>;

const registry = new Map<string, Loader>();
const started = new Set<string>();

export function registerRoutePrefetch(path: string, loader: Loader) {
  registry.set(path, loader);
}

function shouldSkip(): boolean {
  if (typeof navigator === "undefined") return true;
  const conn = (navigator as any).connection;
  if (conn?.saveData) return true;
  if (conn?.effectiveType && /2g/.test(conn.effectiveType)) return true;
  return false;
}

export function prefetchRoute(path: string) {
  if (shouldSkip()) return;
  const loader = registry.get(path);
  if (!loader || started.has(path)) return;
  started.add(path);
  const run = () => {
    loader().catch(() => started.delete(path));
  };
  if (typeof (window as any).requestIdleCallback === "function") {
    (window as any).requestIdleCallback(run, { timeout: 800 });
  } else {
    setTimeout(run, 0);
  }
}

/** Props helper for any element that should prefetch a route on interaction. */
export function prefetchHandlers(path: string) {
  const fire = () => prefetchRoute(path);
  return {
    onMouseEnter: fire,
    onFocus: fire,
    onTouchStart: fire,
  };
}