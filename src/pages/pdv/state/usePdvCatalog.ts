import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MenuSection, Product } from "../types";

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
        .select("id, name, sort_order")
        .eq("store_id", storeId!)
        .order("sort_order");
      return (data || []) as MenuSection[];
    },
    enabled: !!storeId,
  });

  const { data: products = [], isLoading: prodLoading } = useQuery({
    queryKey: ["pdv-products", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, price, image_url, section_id, is_available, store_id, description, metadata, sold_by_weight, price_per_kg, weight_unit")
        .eq("store_id", storeId!)
        .eq("is_available", true)
        .order("name");
      // Backwards-compat: alguns produtos só têm sold_by_weight/price_per_kg
      // armazenados em metadata. Normalizamos para os campos top-level.
      return ((data || []) as any[]).map((p) => ({
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
    },
    enabled: !!storeId,
    staleTime: 60_000,
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