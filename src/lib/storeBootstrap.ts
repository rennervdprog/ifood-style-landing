/**
 * Carrega o bootstrap da loja preferindo o cache da Edge da Vercel
 * (rota /api/store/:slug). Cai para a RPC direta no Supabase se a edge falhar.
 * Reduz cascata de 6 queries para 1 e serve da CDN em ~30ms.
 */
import { supabase } from "@/integrations/supabase/client";

export type StoreBootstrap = {
  store: any | null;
  hours: any[];
  sections: any[];
  products: any[];
  owner_profile: { id: string; whatsapp_number: string | null } | null;
  online_drivers_count: number;
};

export async function fetchStoreBootstrap(slug: string): Promise<StoreBootstrap | null> {
  const clean = (slug || "").trim();
  if (!clean) return null;

  // 1) Tenta edge da Vercel (cache CDN).
  try {
    const res = await fetch(`/api/store/${encodeURIComponent(clean)}`, {
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === "object" && "store" in data) {
        return data as StoreBootstrap;
      }
    }
  } catch {
    /* fallback abaixo */
  }

  // 2) Fallback: RPC direta no Supabase externo.
  const { data, error } = await supabase.rpc("store_bootstrap" as any, { _slug: clean });
  if (error || !data) return null;
  return data as StoreBootstrap;
}