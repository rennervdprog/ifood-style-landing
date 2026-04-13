import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * For white-label Capacitor apps: locks navigation to a specific store.
 * 
 * Usage in capacitor.config.ts:
 *   server.url = "https://domain.com/loja-slug?storeApp=true"
 * 
 * The guard reads the storeSlug from URL params on first load,
 * then restricts all navigation to only store-related routes.
 */

const STORE_APP_KEY = "store_app_slug";

const ALLOWED_PREFIXES = [
  "/carrinho",
  "/checkout",
  "/pedidos",
  "/perfil",
  "/auth",
  "/termos-de-uso",
  "/politica-de-privacidade",
];

const StoreAppGuard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [storeSlug, setStoreSlug] = useState<string | null>(null);

  // On mount, check if this is a store app session
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isStoreApp = params.get("storeApp") === "true";
    const saved = sessionStorage.getItem(STORE_APP_KEY);

    if (isStoreApp && !saved) {
      // Extract slug from the current path
      const path = window.location.pathname;
      const slug = path.replace(/^\//, "").split("/")[0];
      if (slug && !ALLOWED_PREFIXES.some((p) => path.startsWith(p))) {
        sessionStorage.setItem(STORE_APP_KEY, slug);
        setStoreSlug(slug);
      }
    } else if (saved) {
      setStoreSlug(saved);
    }
  }, []);

  // Guard navigation
  useEffect(() => {
    if (!storeSlug) return;

    const path = location.pathname;

    // Allow store's own page
    if (path === `/${storeSlug}` || path.startsWith(`/${storeSlug}/`)) return;

    // Allow loja/:id format
    if (path.startsWith("/loja/")) return;

    // Allow whitelisted routes
    if (ALLOWED_PREFIXES.some((p) => path === p || path.startsWith(p + "/"))) return;

    // Redirect everything else to the store
    navigate(`/${storeSlug}`, { replace: true });
  }, [location.pathname, navigate, storeSlug]);

  return null;
};

export default StoreAppGuard;
