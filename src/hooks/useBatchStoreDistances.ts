/**
 * Enriquecimento assíncrono das distâncias das lojas via edge OSRM.
 * Recebe a lista já mapeada (com haversine × 1.3 como estimativa inicial)
 * e devolve a mesma lista com `distanceKm` atualizada para a rota real.
 *
 * Cachea em sessionStorage por (userCoords arredondado, storeId) para não
 * repetir chamadas ao trocar de aba/rota.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Coordinates } from "@/lib/location";

type WithDistance = { id: string; distanceKm?: number | null; latitude?: number | null; longitude?: number | null };

const CACHE_PREFIX = "itasuper:dist:v2";
const roundCoord = (n: number) => Math.round(n * 1000) / 1000; // ~110m

function cacheKey(cust: Coordinates, storeId: string) {
  return `${CACHE_PREFIX}|${roundCoord(cust.lat)},${roundCoord(cust.lng)}|${storeId}`;
}
function readCache(cust: Coordinates, storeId: string): number | null {
  try {
    const v = sessionStorage.getItem(cacheKey(cust, storeId));
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  } catch { return null; }
}
function writeCache(cust: Coordinates, storeId: string, km: number) {
  try { sessionStorage.setItem(cacheKey(cust, storeId), String(km)); } catch { /* quota */ }
}

export function useBatchStoreDistances<T extends WithDistance>(
  stores: T[] | undefined,
  customer: Coordinates | null,
): T[] {
  const [enriched, setEnriched] = useState<Record<string, number>>({});

  // Dedup stable key para o effect (evita disparo por identidade nova do array).
  const storeKey = useMemo(() => {
    if (!stores?.length) return "";
    return stores.map((s) => s.id).join(",");
  }, [stores]);

  useEffect(() => {
    if (!customer || !stores?.length) return;
    const cand = stores.filter(
      (s) => typeof s.latitude === "number" && typeof s.longitude === "number",
    );
    if (!cand.length) return;

    // Aplica cache imediato (síncrono).
    const fromCache: Record<string, number> = {};
    const toFetch: T[] = [];
    for (const s of cand) {
      const c = readCache(customer, s.id);
      if (c != null) fromCache[s.id] = c;
      else toFetch.push(s);
    }
    if (Object.keys(fromCache).length) setEnriched((prev) => ({ ...prev, ...fromCache }));
    if (!toFetch.length) return;

    let alive = true;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("batch-store-distances", {
          body: {
            customer: { lat: customer.lat, lng: customer.lng },
            stores: toFetch.map((s) => ({ id: s.id, lat: s.latitude, lng: s.longitude })),
          },
        });
        if (error || !data?.ok || !Array.isArray(data.results)) return;
        const patch: Record<string, number> = {};
        for (const r of data.results as Array<{ id: string; distanceKm: number | null }>) {
          if (typeof r.distanceKm === "number") {
            patch[r.id] = r.distanceKm;
            writeCache(customer, r.id, r.distanceKm);
          }
        }
        if (alive && Object.keys(patch).length) setEnriched((prev) => ({ ...prev, ...patch }));
      } catch { /* silencioso: fica com haversine × 1.3 */ }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeKey, customer?.lat, customer?.lng]);

  return useMemo(() => {
    if (!stores?.length) return stores ?? [];
    if (!Object.keys(enriched).length) return stores;
    return stores.map((s) =>
      enriched[s.id] != null ? ({ ...s, distanceKm: enriched[s.id] } as T) : s,
    );
  }, [stores, enriched]);
}