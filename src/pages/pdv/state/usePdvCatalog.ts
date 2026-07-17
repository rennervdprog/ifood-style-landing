import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MenuSection, Product } from "../types";

/**
 * Cache local (localStorage) de seções + produtos por loja.
 * Serve para o PDV abrir imediatamente após um reload sem internet
 * (ou com rede lenta) usando o snapshot do último carregamento.
 * TTL de 24h — se ficar velho, é ignorado.
 */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
function cacheKey(kind: "products" | "sections", storeId: string) {
  return `pdv_catalog_v1:${kind}:${storeId}`;
}
function readCache<T>(kind: "products" | "sections", storeId?: string): T | undefined {
  if (!storeId) return undefined;
  try {
    const raw = localStorage.getItem(cacheKey(kind, storeId));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { at: number; data: T };
    if (Date.now() - parsed.at > CACHE_TTL_MS) return undefined;
    return parsed.data;
  } catch { return undefined; }
}
function writeCache<T>(kind: "products" | "sections", storeId: string, data: T) {
  try {
    localStorage.setItem(cacheKey(kind, storeId), JSON.stringify({ at: Date.now(), data }));
  } catch {}
}

/**
 * Carrega seções + produtos da loja e expõe utilitários de filtro/agrupamento.
 *
 * - `sections`: seções ativas, ordenadas.
 * - `products`: produtos disponíveis (cache 60s).
 * - `filtered`: aplica busca por nome OU filtro por seção (busca tem prioridade).
 * - `grouped`: produtos agrupados por nome de seção (chave string).
 */
export function usePdvCatalog(params: {
  storeId: string | undefined;
  search: string;
  activeSection: string | null;
}) {
  const { storeId, search, activeSection } = params;

  const { data: sections = [] } = useQuery({
    queryKey: ["pdv-sections", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("menu_sections")
        .select("id, name, sort_order, pdv_color")
        .eq("store_id", storeId!)
        .order("sort_order");
      const list = (data || []) as MenuSection[];
      if (storeId) writeCache("sections", storeId, list);
      return list;
    },
    enabled: !!storeId,
    initialData: () => readCache<MenuSection[]>("sections", storeId),
    initialDataUpdatedAt: 0, // força refetch em background, mas mostra cache já
  });

  const { data: products = [], isLoading: prodLoading } = useQuery({
    queryKey: ["pdv-products", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, price, image_url, section_id, is_available, store_id, description, metadata, sold_by_weight, price_per_kg, weight_unit, pdv_short_code, pdv_sort_order")
        .eq("store_id", storeId!)
        .eq("is_available", true)
        .order("pdv_sort_order", { ascending: true, nullsFirst: false })
        .order("name");
      // Backwards-compat: alguns produtos só têm sold_by_weight/price_per_kg
      // armazenados em metadata. Normalizamos para os campos top-level.
      const list = ((data || []) as any[]).map((p) => ({
        ...p,
        sold_by_weight: !!(p.sold_by_weight ?? p.metadata?.sold_by_weight),
        price_per_kg:
          p.price_per_kg != null
            ? Number(p.price_per_kg)
            : p.metadata?.price_per_kg != null
              ? Number(p.metadata.price_per_kg)
              : null,
        weight_unit: p.weight_unit || p.metadata?.weight_unit || "kg",
      })) as Product[];
      if (storeId) writeCache("products", storeId, list);
      return list;
    },
    enabled: !!storeId,
    staleTime: 60_000,
    initialData: () => readCache<Product[]>("products", storeId),
    initialDataUpdatedAt: 0,
  });

  const sectionMap = useMemo(
    () => new Map(sections.map((s) => [s.id, s.name])),
    [sections],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = q ? products.filter((p) => p.name.toLowerCase().includes(q)) : products;
    if (activeSection && !q) list = list.filter((p) => p.section_id === activeSection);
    return list;
  }, [products, search, activeSection]);

  const grouped = useMemo(() => {
    const result: Record<string, Product[]> = {};
    filtered.forEach((p) => {
      const s = p.section_id ? sectionMap.get(p.section_id) || "Outros" : "Sem categoria";
      if (!result[s]) result[s] = [];
      result[s].push(p);
    });
    return result;
  }, [filtered, sectionMap]);

  return { sections, products, prodLoading, sectionMap, filtered, grouped };
}