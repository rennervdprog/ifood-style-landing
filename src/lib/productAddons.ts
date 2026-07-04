import { supabase } from "@/integrations/supabase/client";

export interface ProductAddonGroup {
  id: string;
  name: string;
  min_select: number;
  max_select: number;
  sort_order: number;
  price_replaces_base?: boolean;
}

export interface ProductAddonItem {
  id: string;
  group_id: string;
  name: string;
  price: number;
  sort_order: number;
}

export interface ProductAddonsData {
  groups: ProductAddonGroup[];
  items: ProductAddonItem[];
}

const groupWithItemsSelect = "id,name,min_select,max_select,sort_order,price_replaces_base,addon_items(id,group_id,name,price,sort_order)";

const normalizeGroup = (row: ProductAddonGroup & { addon_items?: ProductAddonItem[] | null }): ProductAddonGroup => {
  const { addon_items: _addonItems, ...group } = row;
  return group;
};

const normalizeLinkedGroup = (value: unknown) => {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
};

export async function fetchProductAddons(productId: string): Promise<ProductAddonsData> {
  const cacheKey = `pdv_addons_v1:${productId}`;
  const readCache = (): ProductAddonsData | null => {
    try {
      const raw = localStorage.getItem(cacheKey);
      return raw ? (JSON.parse(raw) as ProductAddonsData) : null;
    } catch { return null; }
  };

  // Offline: devolve cache imediatamente, ou vazio (sem travar em "Carregando opções…")
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return readCache() || { groups: [], items: [] };
  }

  // Timeout defensivo: se a rede estiver "meio-caída" (navigator.onLine=true
  // mas sem conectividade real), não deixamos o modal travar em spinner.
  // Após 4s, cai no cache local (ou vazio).
  const timeout = new Promise<{ timedOut: true }>((resolve) =>
    setTimeout(() => resolve({ timedOut: true }), 1500),
  );
  const fetchAll = Promise.all([
    supabase
      .from("addon_groups")
      .select(groupWithItemsSelect)
      .eq("product_id", productId)
      .order("sort_order"),
    (supabase as any)
      .from("product_addon_groups")
      .select(`addon_group_id,addon_groups(${groupWithItemsSelect})`)
      .eq("product_id", productId),
  ]);
  const raced = await Promise.race([fetchAll, timeout]);
  if ((raced as any).timedOut) {
    return readCache() || { groups: [], items: [] };
  }
  const [directRes, linkedRes] = raced as Awaited<typeof fetchAll>;

  if (directRes.error || linkedRes.error) {
    const cached = readCache();
    if (cached) return cached;
    throw directRes.error || linkedRes.error;
  }

  const directRows = (directRes.data || []) as Array<ProductAddonGroup & { addon_items?: ProductAddonItem[] | null }>;
  const directIds = new Set(directRows.map((group) => group.id));
  const linkedRows = ((linkedRes.data || []) as any[])
    .map((row) => normalizeLinkedGroup(row.addon_groups))
    .filter(Boolean)
    .filter((group: ProductAddonGroup) => !directIds.has(group.id)) as Array<ProductAddonGroup & { addon_items?: ProductAddonItem[] | null }>;

  const groups = [...directRows, ...linkedRows]
    .map(normalizeGroup)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const items = [...directRows, ...linkedRows]
    .flatMap((group) => group.addon_items || [])
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)) as ProductAddonItem[];

  const result: ProductAddonsData = { groups, items };
  try { localStorage.setItem(cacheKey, JSON.stringify(result)); } catch {}
  return result;
}