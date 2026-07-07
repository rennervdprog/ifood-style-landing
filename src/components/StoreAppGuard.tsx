import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/**
 * For white-label Capacitor apps: locks navigation to a specific store.
 * 
 * Usage in capacitor.config.ts:
 *   server.url = "https://domain.com/loja-slug?storeApp=true"
 * 
 * The guard reads the storeSlug from URL params on first load,
 * then restricts all navigation to only store-related routes.
 * Also associates FCM push tokens with this store so the client
 * only receives notifications relevant to this store.
 */

const STORE_APP_KEY = "store_app_slug";
const STORE_APP_ID_KEY = "store_app_id";

const ALLOWED_PREFIXES = [
  "/carrinho",
  "/checkout",
  "/pedidos",
  "/perfil",
  "/auth",
  "/termos-de-uso",
  "/politica-de-privacidade",
];

/** Check if the current session is a white-label store app */
export function getStoreAppSlug(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage.getItem(STORE_APP_KEY);
}

export function getStoreAppId(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(STORE_APP_ID_KEY);
}

const StoreAppGuard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [storeSlug, setStoreSlug] = useState<string | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);

  // On mount, check if this is a store app session
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isStoreApp = params.get("storeApp") === "true";
    const saved = sessionStorage.getItem(STORE_APP_KEY);
    const savedId = localStorage.getItem(STORE_APP_ID_KEY);

    if (isStoreApp && !saved) {
      const path = window.location.pathname;
      const slug = path.replace(/^\//, "").split("/")[0];
      if (slug && !ALLOWED_PREFIXES.some((p) => path.startsWith(p))) {
        sessionStorage.setItem(STORE_APP_KEY, slug);
        setStoreSlug(slug);
        // Resolve store ID from slug
        resolveStoreId(slug);
      }
    } else if (saved) {
      setStoreSlug(saved);
      if (savedId) setStoreId(savedId);
      else resolveStoreId(saved);
    }
  }, []);

  async function resolveStoreId(slug: string) {
    try {
      const { data } = await supabase
        .from("stores")
        .select("id")
        .or(`slug.eq.${slug},slug_aliases.cs.{${slug}}`)
        .maybeSingle();
      if (data?.id) {
        localStorage.setItem(STORE_APP_ID_KEY, data.id);
        setStoreId(data.id);
      }
    } catch (e) {
      console.warn("[StoreAppGuard] Failed to resolve store ID:", e);
    }
  }

  // Associate FCM token with this store when user logs in
  useEffect(() => {
    if (!storeId) return;

    const updateFcmStoreId = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      // Update any FCM tokens for this user to include this store_id
      await supabase
        .from("fcm_tokens")
        .update({ store_id: storeId })
        .eq("user_id", session.user.id);
    };

    updateFcmStoreId();

    // Listen for auth changes too
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        updateFcmStoreId();
      }
    });

    return () => subscription.unsubscribe();
  }, [storeId]);

  // Guard navigation — block access to other stores
  useEffect(() => {
    if (!storeSlug) return;

    const path = location.pathname;

    // Allow store's own page (by slug)
    if (path === `/${storeSlug}` || path.startsWith(`/${storeSlug}/`)) return;

    // Allow loja/:id ONLY if it matches this store's ID
    if (path.startsWith("/loja/") && storeId) {
      const pathStoreId = path.split("/")[2];
      if (pathStoreId === storeId) return;
      // Different store — block it
      navigate(`/${storeSlug}`, { replace: true });
      return;
    }

    // Block /loja/ if we don't know the store ID yet (be safe)
    if (path.startsWith("/loja/")) {
      navigate(`/${storeSlug}`, { replace: true });
      return;
    }

    // Block store directory and index (lists other stores)
    if (path === "/" || path === "/lojas") {
      navigate(`/${storeSlug}`, { replace: true });
      return;
    }

    // Allow whitelisted routes
    if (ALLOWED_PREFIXES.some((p) => path === p || path.startsWith(p + "/"))) return;

    // Block partner/admin routes
    if (
      path.startsWith("/portal-parceiro") ||
      path.startsWith("/admin") ||
      path.startsWith("/entregador") ||
      path.startsWith("/super-admin") ||
      path.startsWith("/cadastro")
    ) {
      navigate(`/${storeSlug}`, { replace: true });
      return;
    }

    // Block any other store slug (catch-all: redirect to own store)
    navigate(`/${storeSlug}`, { replace: true });
  }, [location.pathname, navigate, storeSlug, storeId]);

  return null;
};

export default StoreAppGuard;
