/**
 * Carrega o bootstrap da loja preferindo o cache da Edge da Vercel
 * (rota /api/store/:slug). Cai para a RPC direta no Supabase se a edge falhar.
 * Reduz cascata de 6 queries para 1 e serve da CDN em ~30ms.
 */
import { supabase } from "@/integrations/supabase/client";

const SESSION_CACHE_PREFIX = "store-bootstrap:";
const SESSION_CACHE_TTL_MS = 3 * 60 * 1_000;

type CachedBootstrap = {
  cachedAt: number;
  data: StoreBootstrap;
};

export type StoreBootstrap = {
  store: any | null;
  hours: any[];
  sections: any[];
  products: any[];
  owner_profile: { id: string; whatsapp_number: string | null } | null;
  online_drivers_count: number;
};

function cacheKey(slug: string) {
  return `${SESSION_CACHE_PREFIX}${slug.toLowerCase()}`;
}

export function getCachedStoreBootstrap(slug: string): CachedBootstrap | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(cacheKey(slug));
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedBootstrap;
    if (!cached?.data || !Number.isFinite(cached.cachedAt)) return null;
    if (Date.now() - cached.cachedAt > SESSION_CACHE_TTL_MS) {
      window.sessionStorage.removeItem(cacheKey(slug));
      return null;
    }
    return cached;
  } catch {
    return null;
  }
}

function cacheStoreBootstrap(slug: string, data: StoreBootstrap) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(cacheKey(slug), JSON.stringify({ cachedAt: Date.now(), data }));
  } catch {
    // O catálogo funciona normalmente se o armazenamento estiver indisponível.
  }
}

export function invalidateCachedStoreBootstrap(storeId?: string | null) {
  if (typeof window === "undefined") return;
  try {
    const keys = Array.from({ length: window.sessionStorage.length }, (_, index) => window.sessionStorage.key(index))
      .filter((key): key is string => Boolean(key?.startsWith(SESSION_CACHE_PREFIX)));
    for (const key of keys) {
      if (!storeId) {
        window.sessionStorage.removeItem(key);
        continue;
      }
      const raw = window.sessionStorage.getItem(key);
      const cached = raw ? JSON.parse(raw) as CachedBootstrap : null;
      if (cached?.data?.store?.id === storeId) window.sessionStorage.removeItem(key);
    }
  } catch {
    // A invalidação do React Query continua funcionando se storage falhar.
  }
}

export async function fetchStoreBootstrap(slug: string): Promise<StoreBootstrap | null> {
  const clean = (slug || "").trim();
  if (!clean) return null;

  const cached = getCachedStoreBootstrap(clean);
  if (cached) return cached.data;

  // 1) Tenta edge da Vercel (cache CDN).
  try {
    const response = await fetch(`/api/store/${encodeURIComponent(clean)}`, {
      headers: { Accept: "application/json" },
    });
    if (response.ok) {
      const data = await response.json();
      if (data && typeof data === "object" && "store" in data) {
        cacheStoreBootstrap(clean, data as StoreBootstrap);
        return data as StoreBootstrap;
      }
    }
  } catch {
    // Fallback abaixo.
  }

  // 2) Fallback: RPC direta no Supabase externo.
  const { data, error } = await supabase.rpc("store_bootstrap" as any, { _slug: clean });
  if (error || !data) return null;
  cacheStoreBootstrap(clean, data as StoreBootstrap);
  return data as StoreBootstrap;
}
