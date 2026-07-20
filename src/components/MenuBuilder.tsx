import { useState, useMemo, useCallback, useEffect } from "react";
import DailyMenuManager from "@/components/DailyMenuManager";
import MenuImportCSV from "@/components/MenuImportCSV";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Loader2, Package, Sparkles, ArrowLeft } from "lucide-react";
import { ProductCard, ProductFormData } from "@/components/menu/ProductCard";
import { ConfirmDialog } from "@/components/menu/ConfirmDialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionNav, SectionScope } from "@/components/menu/SectionNav";
import { MenuToolbar, ProductFilter } from "@/components/menu/MenuToolbar";
import { ProductSheet } from "@/components/menu/ProductSheet";
import { SectionManageSheet } from "@/components/menu/SectionManageSheet";
import { BulkActionBar } from "@/components/menu/BulkActionBar";
import { SortableProductGrid } from "@/components/menu/SortableProductGrid";

interface MenuBuilderProps {
  storeId: string;
  storeCategory?: string;
  storeCategories?: string[];
}

type ConfirmState = {
  title: string;
  description?: string;
  destructive?: boolean;
  confirmText?: string;
  onConfirm: () => void;
} | null;

const PRODUCT_FIELDS =
  "id, store_id, section_id, name, price, description, image_url, is_available, metadata, sold_by_weight, price_per_kg, weight_unit, sort_order, created_at";

const MenuBuilder = ({ storeId, storeCategory, storeCategories }: MenuBuilderProps) => {
  const queryClient = useQueryClient();

  // ---------- UI state ----------
  const [activeSection, setActiveSection] = useState<SectionScope>("all");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ProductFilter>("all");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const [productSheet, setProductSheet] = useState<
    | { mode: "create"; sectionId: string | null }
    | { mode: "edit"; id: string; initial: ProductFormData; sectionName: string | null }
    | null
  >(null);

  const [sectionSheetOpen, setSectionSheetOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [dailyMenuOpen, setDailyMenuOpen] = useState(false);
  const [moveBulkOpen, setMoveBulkOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);

  // ---------- Queries ----------
  const { data: sections, isLoading: loadingSections } = useQuery({
    queryKey: ["menu-sections", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_sections")
        .select("id, name, sort_order")
        .eq("store_id", storeId)
        .order("sort_order");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: products, isLoading: loadingProducts } = useQuery({
    queryKey: ["store-products", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(PRODUCT_FIELDS)
        .eq("store_id", storeId)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("name");
      if (error) throw error;
      return (data || []).filter(
        (p: any) =>
          !p?.metadata?.pdv_only &&
          !p?.sold_by_weight &&
          !p?.metadata?.sold_by_weight &&
          !p?.metadata?.hidden
      );
    },
  });

  // Slug da loja — pra copiar link público do produto
  const { data: storeSlug } = useQuery({
    queryKey: ["store-slug", storeId],
    queryFn: async () => {
      const { data } = await supabase.from("stores").select("slug").eq("id", storeId).maybeSingle();
      return (data as any)?.slug || null;
    },
  });

  const productIds = useMemo(() => (products || []).map((p: any) => p.id), [products]);

  const { data: addonGroups } = useQuery({
    queryKey: ["addon-groups", storeId, productIds.length],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("addon_groups")
        .select("id, product_id, name, min_select, max_select, sort_order, addon_items(id, name, price)")
        .in("product_id", productIds)
        .order("sort_order");
      if (error) throw error;
      return data || [];
    },
    enabled: productIds.length > 0,
  });

  const { data: storeAddonGroups } = useQuery({
    queryKey: ["store-addon-groups", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("addon_groups")
        .select("id, name, min_select, max_select, sort_order, addon_items(id, name, price)")
        .eq("store_id", storeId)
        .is("product_id", null)
        .order("sort_order");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: productAddonLinks } = useQuery({
    queryKey: ["product-addon-links", storeId, productIds.length],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_addon_groups")
        .select("product_id, addon_group_id")
        .in("product_id", productIds);
      if (error) throw error;
      return data || [];
    },
    enabled: productIds.length > 0,
  });

  // ---------- Derivations ----------
  const productsBySection = useMemo(() => {
    const map = new Map<string | null, any[]>();
    (products || []).forEach((p: any) => {
      const k = p.section_id || null;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    });
    return map;
  }, [products]);

  const productCounts = useMemo(() => {
    const map = new Map<string | null, number>();
    productsBySection.forEach((list, key) => map.set(key, list.length));
    return map;
  }, [productsBySection]);

  const addonGroupsByProduct = useMemo(() => {
    const map = new Map<string, any[]>();
    (addonGroups as any[] || []).forEach((g) => {
      if (!map.has(g.product_id)) map.set(g.product_id, []);
      map.get(g.product_id)!.push(g);
    });
    return map;
  }, [addonGroups]);

  const linksByProduct = useMemo(() => {
    const map = new Map<string, string[]>();
    (productAddonLinks as any[] || []).forEach((l) => {
      if (!map.has(l.product_id)) map.set(l.product_id, []);
      map.get(l.product_id)!.push(l.addon_group_id);
    });
    return map;
  }, [productAddonLinks]);

  const storeAddonGroupsList = (storeAddonGroups as any[]) || [];

  const unsectionedProducts = productsBySection.get(null) || [];

  const totalProducts = products?.length || 0;
  const activeCount = useMemo(
    () => (products || []).filter((p: any) => p.is_available).length,
    [products]
  );
  const pausedCount = totalProducts - activeCount;
  const outOfStockCount = useMemo(
    () => (products || []).filter((p: any) => p.is_available && p.metadata?.out_of_stock).length,
    [products]
  );
  const noImageCount = useMemo(
    () => (products || []).filter((p: any) => !p.image_url).length,
    [products]
  );

  const filterCounts = useMemo(
    () => ({
      all: totalProducts,
      active: activeCount,
      paused: pausedCount,
      out_of_stock: outOfStockCount,
      no_image: noImageCount,
    }),
    [totalProducts, activeCount, pausedCount, outOfStockCount, noImageCount]
  );

  const visibleProducts = useMemo(() => {
    let list: any[] = [];
    if (activeSection === "all") list = products || [];
    else if (activeSection === "none") list = unsectionedProducts;
    else list = productsBySection.get(activeSection) || [];

    // Filter
    if (filter === "active") list = list.filter((p: any) => p.is_available);
    else if (filter === "paused") list = list.filter((p: any) => !p.is_available);
    else if (filter === "out_of_stock") list = list.filter((p: any) => !!p.metadata?.out_of_stock);
    else if (filter === "no_image") list = list.filter((p: any) => !p.image_url);

    // Search
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (p: any) =>
          p.name?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [activeSection, products, unsectionedProducts, productsBySection, filter, search]);

  // ---------- Invalidation helpers ----------
  const invalidateProducts = () =>
    queryClient.invalidateQueries({ queryKey: ["store-products", storeId] });
  const invalidateSections = () =>
    queryClient.invalidateQueries({ queryKey: ["menu-sections", storeId] });
  const invalidateAddons = () => {
    queryClient.invalidateQueries({ queryKey: ["addon-groups", storeId] });
    queryClient.invalidateQueries({ queryKey: ["store-addon-groups", storeId] });
  };
  const invalidateLinks = () =>
    queryClient.invalidateQueries({ queryKey: ["product-addon-links", storeId] });

  // ---------- Section CRUD ----------
  const createSection = async (name: string) => {
    const { error } = await supabase.from("menu_sections").insert({
      store_id: storeId,
      name,
      sort_order: (sections?.length || 0) + 1,
    } as any);
    if (error) {
      toast.error("Erro ao criar seção");
      return;
    }
    toast.success("Seção criada!");
    invalidateSections();
  };

  const renameSection = async (id: string, name: string) => {
    if (!name.trim()) return;
    const { error } = await supabase
      .from("menu_sections")
      .update({ name: name.trim() } as any)
      .eq("id", id);
    if (error) {
      toast.error("Erro ao renomear");
      return;
    }
    toast.success("Seção atualizada!");
    invalidateSections();
  };

  const moveSection = async (sectionId: string, delta: -1 | 1) => {
    if (!sections) return;
    const items = [...sections];
    const fromIdx = items.findIndex((s: any) => s.id === sectionId);
    const toIdx = fromIdx + delta;
    if (fromIdx === -1 || toIdx < 0 || toIdx >= items.length) return;
    const [moved] = items.splice(fromIdx, 1);
    items.splice(toIdx, 0, moved);
    queryClient.setQueryData(
      ["menu-sections", storeId],
      items.map((s: any, i: number) => ({ ...s, sort_order: i }))
    );
    const results = await Promise.all(
      items.map((s: any, i: number) =>
        supabase.from("menu_sections").update({ sort_order: i } as any).eq("id", s.id)
      )
    );
    if (results.some((r) => r.error)) {
      toast.error("Erro ao reordenar");
      invalidateSections();
    }
  };

  const deleteSectionConfirm = (id: string, name: string, count: number) => {
    setConfirmState({
      title: `Excluir seção "${name}"?`,
      description:
        count > 0
          ? `Os ${count} produto${count === 1 ? "" : "s"} desta seção ${count === 1 ? "será movido" : "serão movidos"} para "Sem seção".`
          : "Esta seção está vazia.",
      destructive: true,
      confirmText: "Excluir seção",
      onConfirm: async () => {
        const list = productsBySection.get(id) || [];
        if (list.length > 0) {
          await supabase
            .from("products")
            .update({ section_id: null } as any)
            .in("id", list.map((p: any) => p.id));
        }
        const { error } = await supabase.from("menu_sections").delete().eq("id", id);
        if (error) {
          toast.error("Erro ao excluir seção");
          return;
        }
        toast.success("Seção excluída!");
        setConfirmState(null);
        if (activeSection === id) setActiveSection("all");
        invalidateSections();
        invalidateProducts();
      },
    });
  };

  // ---------- Product CRUD ----------
  const addProduct = async (sectionId: string | null, formData: ProductFormData) => {
    const finalPrice = parseFloat(formData.price) || 0;
    if (!formData.name.trim()) {
      toast.error("Preencha o nome do produto");
      return;
    }
    if (!formData.price || finalPrice <= 0) {
      toast.error("Preencha o preço do produto");
      return;
    }
    const soldByWeight = !!formData.metadata?.sold_by_weight;
    const pricePerKg = Number(formData.metadata?.price_per_kg ?? 0) || null;
    if (soldByWeight && (!pricePerKg || pricePerKg <= 0)) {
      toast.error("Defina o preço por kg para vender por peso");
      return;
    }
    const { error } = await supabase.from("products").insert({
      store_id: storeId,
      section_id: sectionId,
      name: formData.name.trim(),
      price: soldByWeight ? pricePerKg || finalPrice : finalPrice,
      description: formData.description.trim() || null,
      image_url: formData.image_url.trim() || null,
      metadata: formData.metadata || {},
      sold_by_weight: soldByWeight,
      price_per_kg: soldByWeight ? pricePerKg : null,
      weight_unit: "kg",
    } as any);
    if (error) {
      console.error("[MenuBuilder] insert products failed:", error);
      toast.error(`Erro ao adicionar produto: ${error.message || error.code || "desconhecido"}`);
      return;
    }
    toast.success("Produto adicionado!");
    setProductSheet(null);
    invalidateProducts();
  };

  const updateProduct = async (id: string, formData: ProductFormData) => {
    const finalPrice = parseFloat(formData.price) || 0;
    const soldByWeight = !!formData.metadata?.sold_by_weight;
    const pricePerKg = Number(formData.metadata?.price_per_kg ?? 0) || null;
    if (soldByWeight && (!pricePerKg || pricePerKg <= 0)) {
      toast.error("Defina o preço por kg para vender por peso");
      return;
    }
    const { error } = await supabase
      .from("products")
      .update({
        name: formData.name.trim(),
        price: soldByWeight ? pricePerKg || finalPrice : finalPrice,
        description: formData.description.trim() || null,
        image_url: formData.image_url.trim() || null,
        metadata: formData.metadata || {},
        sold_by_weight: soldByWeight,
        price_per_kg: soldByWeight ? pricePerKg : null,
      } as any)
      .eq("id", id);
    if (error) {
      toast.error("Erro ao atualizar");
      return;
    }
    toast.success("Produto atualizado!");
    setProductSheet(null);
    invalidateProducts();
  };

  const toggleProductAvailable = async (id: string, available: boolean) => {
    const { error } = await supabase.from("products").update({ is_available: !available }).eq("id", id);
    if (error) {
      toast.error("Erro");
      return;
    }
    toast.success(available ? "Item pausado" : "Item reativado!");
    invalidateProducts();
  };

  const toggleProductOutOfStock = async (id: string, currentMeta: any) => {
    const isOOS = !!currentMeta?.out_of_stock;
    const newMeta = { ...(currentMeta || {}), out_of_stock: !isOOS };
    const { error } = await supabase.from("products").update({ metadata: newMeta } as any).eq("id", id);
    if (error) {
      toast.error("Erro");
      return;
    }
    toast.success(isOOS ? "Produto disponível novamente!" : "Produto marcado como esgotado");
    invalidateProducts();
  };

  const duplicateProduct = async (product: any) => {
    const { error } = await supabase.from("products").insert({
      store_id: storeId,
      section_id: product.section_id ?? null,
      name: `${product.name} (cópia)`,
      price: Number(product.price) || 0,
      description: product.description ?? null,
      image_url: product.image_url ?? null,
      metadata: (product as any).metadata ?? {},
      is_available: false,
    } as any);
    if (error) {
      toast.error("Erro ao duplicar produto");
      return;
    }
    toast.success("Produto duplicado (pausado para revisar)");
    invalidateProducts();
  };

  const deleteProductConfirm = (id: string, name: string) => {
    setConfirmState({
      title: "Excluir produto?",
      description: `"${name}" será removido permanentemente. Esta ação não pode ser desfeita.`,
      destructive: true,
      confirmText: "Excluir",
      onConfirm: async () => {
        const { error } = await supabase.from("products").delete().eq("id", id);
        if (error) {
          const isFk =
            (error as any)?.code === "23503" ||
            /foreign key|violates/i.test(error.message || "");
          if (isFk) {
            const current = (products || []).find((p: any) => p.id === id) as any;
            const newMeta = { ...(current?.metadata || {}), hidden: true };
            const { error: updErr } = await supabase
              .from("products")
              .update({ is_available: false, metadata: newMeta } as any)
              .eq("id", id);
            if (updErr) {
              toast.error(updErr.message || "Erro ao arquivar");
              return;
            }
            toast.success("Produto arquivado (tinha pedidos antigos)");
            setConfirmState(null);
            invalidateProducts();
            return;
          }
          toast.error(error.message || "Erro ao excluir");
          return;
        }
        toast.success("Produto excluído!");
        setConfirmState(null);
        invalidateProducts();
      },
    });
  };

  const moveProduct = async (productId: string, targetSectionId: string | null) => {
    const { error } = await supabase
      .from("products")
      .update({ section_id: targetSectionId } as any)
      .eq("id", productId);
    if (error) {
      toast.error("Erro ao mover produto");
      return;
    }
    toast.success("Produto movido!");
    invalidateProducts();
  };

  // ---------- Addon CRUD (per-product) — mantido igual ----------
  const linkAddonGroup = async (productId: string, addonGroupId: string) => {
    const { error } = await supabase
      .from("product_addon_groups")
      .insert({ product_id: productId, addon_group_id: addonGroupId } as any);
    if (error) {
      if (error.code === "23505") {
        toast.info("Grupo já vinculado");
        return;
      }
      toast.error("Erro ao vincular grupo");
      return;
    }
    toast.success("Grupo vinculado!");
    invalidateLinks();
  };
  const unlinkAddonGroup = async (productId: string, addonGroupId: string) => {
    const { error } = await supabase
      .from("product_addon_groups")
      .delete()
      .eq("product_id", productId)
      .eq("addon_group_id", addonGroupId);
    if (error) {
      toast.error("Erro ao desvincular");
      return;
    }
    toast.success("Grupo desvinculado!");
    invalidateLinks();
  };

  const [addonGroupForm, setAddonGroupForm] = useState({
    name: "",
    min_select: "0",
    max_select: "1",
  });
  const [addonItemForm, setAddonItemForm] = useState({ name: "", price: "0" });
  const [showAddonFormFor, setShowAddonFormFor] = useState<string | null>(null);
  const [showAddonItemForm, setShowAddonItemForm] = useState<string | null>(null);
  const [showLinkAddonFor, setShowLinkAddonFor] = useState<string | null>(null);
  const [movingProductId, setMovingProductId] = useState<string | null>(null);

  const addAddonGroup = async (productId: string) => {
    if (!addonGroupForm.name.trim()) return;
    const { error } = await supabase.from("addon_groups").insert({
      product_id: productId,
      name: addonGroupForm.name.trim(),
      min_select: parseInt(addonGroupForm.min_select),
      max_select: parseInt(addonGroupForm.max_select),
    } as any);
    if (error) {
      toast.error("Erro ao criar grupo");
      return;
    }
    toast.success("Grupo criado!");
    setAddonGroupForm({ name: "", min_select: "0", max_select: "1" });
    setShowAddonFormFor(null);
    invalidateAddons();
  };
  const deleteAddonGroup = async (id: string) => {
    const { error } = await supabase.from("addon_groups").delete().eq("id", id);
    if (error) {
      toast.error("Erro");
      return;
    }
    toast.success("Grupo excluído!");
    invalidateAddons();
  };
  const addAddonItem = async (groupId: string) => {
    if (!addonItemForm.name.trim()) return;
    const { error } = await supabase.from("addon_items").insert({
      group_id: groupId,
      name: addonItemForm.name.trim(),
      price: parseFloat(addonItemForm.price) || 0,
    } as any);
    if (error) {
      toast.error("Erro");
      return;
    }
    toast.success("Adicional criado!");
    setAddonItemForm({ name: "", price: "0" });
    setShowAddonItemForm(null);
    invalidateAddons();
  };
  const deleteAddonItem = async (id: string) => {
    const { error } = await supabase.from("addon_items").delete().eq("id", id);
    if (error) {
      toast.error("Erro");
      return;
    }
    toast.success("Adicional excluído!");
    invalidateAddons();
  };

  // ---------- Selection & bulk ----------
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  };

  const bulkAvailable = async (available: boolean) => {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from("products").update({ is_available: available }).in("id", ids);
    setBulkBusy(false);
    if (error) {
      toast.error("Erro");
      return;
    }
    toast.success(`${ids.length} ${available ? "reativado" : "pausado"}${ids.length > 1 ? "s" : ""}!`);
    clearSelection();
    invalidateProducts();
  };

  const bulkOutOfStock = async (value: boolean) => {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    const ids = Array.from(selectedIds);
    const targets = (products || []).filter((p: any) => ids.includes(p.id));
    const results = await Promise.all(
      targets.map((p: any) =>
        supabase
          .from("products")
          .update({ metadata: { ...((p.metadata as any) || {}), out_of_stock: value } } as any)
          .eq("id", p.id)
      )
    );
    setBulkBusy(false);
    if (results.some((r) => r.error)) toast.error("Erro em alguns itens");
    else
      toast.success(
        `${ids.length} ${value ? "marcado" : "desmarcado"}${ids.length > 1 ? "s" : ""} como esgotado!`
      );
    clearSelection();
    invalidateProducts();
  };

  const bulkDeleteConfirm = () => {
    if (selectedIds.size === 0) return;
    const n = selectedIds.size;
    setConfirmState({
      title: `Excluir ${n} produto${n > 1 ? "s" : ""}?`,
      description: "Esta ação não pode ser desfeita.",
      destructive: true,
      confirmText: "Excluir todos",
      onConfirm: async () => {
        setBulkBusy(true);
        const ids = Array.from(selectedIds);
        const { error } = await supabase.from("products").delete().in("id", ids);
        setBulkBusy(false);
        setConfirmState(null);
        if (error) {
          toast.error("Erro");
          return;
        }
        toast.success(`${ids.length} produto${ids.length > 1 ? "s" : ""} excluído${ids.length > 1 ? "s" : ""}!`);
        clearSelection();
        invalidateProducts();
      },
    });
  };

  const bulkMoveTo = async (sectionId: string | null) => {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    const ids = Array.from(selectedIds);
    const { error } = await supabase
      .from("products")
      .update({ section_id: sectionId } as any)
      .in("id", ids);
    setBulkBusy(false);
    setMoveBulkOpen(false);
    if (error) {
      toast.error("Erro ao mover");
      return;
    }
    toast.success(`${ids.length} produto${ids.length > 1 ? "s" : ""} movido${ids.length > 1 ? "s" : ""}!`);
    clearSelection();
    invalidateProducts();
  };

  const bulkDuplicate = async () => {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    const ids = Array.from(selectedIds);
    const targets = (products || []).filter((p: any) => ids.includes(p.id));
    const rows = targets.map((p: any) => ({
      store_id: storeId,
      section_id: p.section_id ?? null,
      name: `${p.name} (cópia)`,
      price: Number(p.price) || 0,
      description: p.description ?? null,
      image_url: p.image_url ?? null,
      metadata: p.metadata ?? {},
      is_available: false,
    }));
    const { error } = await supabase.from("products").insert(rows as any);
    setBulkBusy(false);
    if (error) {
      toast.error("Erro ao duplicar");
      return;
    }
    toast.success(`${rows.length} produto${rows.length > 1 ? "s duplicados" : " duplicado"} (pausado)`);
    clearSelection();
    invalidateProducts();
  };

  // ---------- Copiar link público ----------
  const copyProductLink = async (product: any) => {
    const slug = storeSlug || storeId;
    const base = typeof window !== "undefined" ? window.location.origin : "https://itasuper.com.br";
    const url = `${base}/${slug}?p=${product.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado!");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  // ---------- Reorder (drag & drop) ----------
  const reorderProducts = async (orderedIds: string[]) => {
    // Optimistic: reordena localmente já
    const previous = queryClient.getQueryData<any[]>(["store-products", storeId]);
    if (previous) {
      const byId = new Map(previous.map((p: any) => [p.id, p]));
      const reordered = orderedIds.map((id, i) => ({ ...byId.get(id), sort_order: i }));
      // Mantém itens fora da lista visível
      const kept = previous.filter((p: any) => !orderedIds.includes(p.id));
      queryClient.setQueryData(["store-products", storeId], [...reordered, ...kept]);
    }
    const results = await Promise.all(
      orderedIds.map((id, i) =>
        supabase.from("products").update({ sort_order: i } as any).eq("id", id)
      )
    );
    if (results.some((r) => r.error)) {
      toast.error("Erro ao reordenar");
      invalidateProducts();
    }
  };

  // ---------- Atalhos de teclado (desktop) ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const inField =
        !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || (t as any).isContentEditable);
      if (e.key === "Escape") {
        if (productSheet) setProductSheet(null);
        else if (sectionSheetOpen) setSectionSheetOpen(false);
        else if (importOpen) setImportOpen(false);
        else if (dailyMenuOpen) setDailyMenuOpen(false);
        else if (moveBulkOpen) setMoveBulkOpen(false);
        else if (selectedIds.size > 0) clearSelection();
        return;
      }
      if (inField) return;
      if (e.key === "/") {
        const input = document.querySelector<HTMLInputElement>('input[placeholder="Buscar produto..."]');
        if (input) { e.preventDefault(); input.focus(); }
      } else if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        openCreate();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [productSheet, sectionSheetOpen, importOpen, dailyMenuOpen, moveBulkOpen, selectedIds, activeSection]);

  // ---------- Section nav items ----------
  const sectionNavItems = useMemo(
    () =>
      (sections || []).map((s: any) => ({
        id: s.id as string,
        name: s.name,
        count: productCounts.get(s.id) || 0,
      })),
    [sections, productCounts]
  );

  const activeSectionName =
    activeSection === "all"
      ? "Todos os produtos"
      : activeSection === "none"
        ? "Sem seção"
        : (sections || []).find((s: any) => s.id === activeSection)?.name || "";

  // ---------- Handlers helpers ----------
  const openCreate = () => {
    const sectionId =
      activeSection === "all" || activeSection === "none" ? null : (activeSection as string);
    setProductSheet({ mode: "create", sectionId });
  };

  const openEdit = (product: any) => {
    const sectionName =
      product.section_id ? (sections || []).find((s: any) => s.id === product.section_id)?.name || null : null;
    setProductSheet({
      mode: "edit",
      id: product.id,
      sectionName,
      initial: {
        name: product.name,
        price: Number(product.price).toFixed(2),
        description: product.description || "",
        image_url: product.image_url || "",
        metadata: {
          ...((product as any).metadata || {}),
          ...((product as any).sold_by_weight
            ? {
                sold_by_weight: true,
                price_per_kg: Number(
                  (product as any).price_per_kg ?? (product as any).metadata?.price_per_kg ?? 0
                ),
                weight_unit: (product as any).weight_unit || "kg",
              }
            : {}),
        },
      },
    });
  };

  const renderProductCard = (product: any) => (
    <ProductCard
      key={product.id}
      product={product}
      sections={sections || []}
      addonGroups={addonGroupsByProduct.get(product.id) || []}
      linkedGroups={
        (linksByProduct.get(product.id) || [])
          .map((gid) => storeAddonGroupsList.find((g) => g.id === gid))
          .filter(Boolean) as any[]
      }
      storeAddonGroups={storeAddonGroupsList}
      linkedGroupIds={linksByProduct.get(product.id) || []}
      selected={selectedIds.has(product.id)}
      onToggleSelect={() => {
        if (!selectionMode) setSelectionMode(true);
        toggleSelect(product.id);
      }}
      onLinkGroup={(gId) => linkAddonGroup(product.id, gId)}
      onUnlinkGroup={(gId) => unlinkAddonGroup(product.id, gId)}
      showLinkAddon={showLinkAddonFor === product.id}
      setShowLinkAddon={(v) => setShowLinkAddonFor(v ? product.id : null)}
      onToggleAvailable={() => toggleProductAvailable(product.id, product.is_available)}
      onToggleOutOfStock={() => toggleProductOutOfStock(product.id, (product as any).metadata)}
      onDelete={() => deleteProductConfirm(product.id, product.name)}
      onDuplicate={() => duplicateProduct(product)}
      onCopyLink={() => copyProductLink(product)}
      onEdit={() => openEdit(product)}
      isEditing={false}
      onSaveEdit={() => {}}
      onCancelEdit={() => {}}
      showAddonForm={showAddonFormFor === product.id}
      setShowAddonForm={(v) => setShowAddonFormFor(v ? product.id : null)}
      addonGroupForm={addonGroupForm}
      setAddonGroupForm={setAddonGroupForm}
      onAddAddonGroup={() => addAddonGroup(product.id)}
      onDeleteAddonGroup={deleteAddonGroup}
      showAddonItemForm={showAddonItemForm}
      setShowAddonItemForm={setShowAddonItemForm}
      addonItemForm={addonItemForm}
      setAddonItemForm={setAddonItemForm}
      onAddAddonItem={addAddonItem}
      onDeleteAddonItem={deleteAddonItem}
      storeCategory={storeCategory}
      storeId={storeId}
      isMoving={movingProductId === product.id}
      storeCategories={storeCategories}
      onStartMove={() => setMovingProductId(movingProductId === product.id ? null : product.id)}
      onCancelMove={() => setMovingProductId(null)}
      onMoveProduct={(pid, sid) => {
        moveProduct(pid, sid);
        setMovingProductId(null);
      }}
    />
  );

  // ---------- Loading state ----------
  if (loadingSections || (loadingProducts && !products)) {
    return (
      <div className="max-w-6xl mx-auto w-full space-y-3">
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // ---------- Empty state (no sections + no products) ----------
  const showFullEmpty = totalProducts === 0 && (sections?.length || 0) === 0;

  return (
    <div className="max-w-6xl mx-auto w-full">
      {/* Header + stats */}
      <div className="flex items-end justify-between flex-wrap gap-2 mb-3 px-1">
        <div>
          <h2 className="text-xl font-bold text-foreground">Cardápio</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            <span className="text-primary font-bold">{activeCount} ativos</span>
            {pausedCount > 0 && <span> · {pausedCount} pausados</span>}
            {outOfStockCount > 0 && (
              <span className="text-destructive"> · {outOfStockCount} esgotado{outOfStockCount > 1 ? "s" : ""}</span>
            )}
            {" · "}
            {sections?.length || 0} {(sections?.length || 0) === 1 ? "seção" : "seções"}
          </p>
        </div>
      </div>

      {showFullEmpty ? (
        <EmptyState
          onCreateSection={() => setSectionSheetOpen(true)}
          onOpenImport={() => setImportOpen(true)}
        />
      ) : (
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Section nav */}
          <SectionNav
            items={sectionNavItems}
            activeId={activeSection}
            onSelect={setActiveSection}
            onManage={() => setSectionSheetOpen(true)}
            onNewSection={() => setSectionSheetOpen(true)}
            totalProducts={totalProducts}
            unsectionedCount={unsectionedProducts.length}
          />

          {/* Main column */}
          <div className="flex-1 min-w-0 space-y-3">
            <MenuToolbar
              search={search}
              onSearchChange={setSearch}
              filter={filter}
              onFilterChange={setFilter}
              filterCounts={filterCounts}
              selectionMode={selectionMode}
              onToggleSelectionMode={() => {
                if (selectionMode) clearSelection();
                else setSelectionMode(true);
              }}
              onNewProduct={openCreate}
              onOpenImport={() => setImportOpen(true)}
              onOpenDailyMenu={() => setDailyMenuOpen(true)}
              onOpenSectionManage={() => setSectionSheetOpen(true)}
              disableDailyMenu={storeCategory === "adegas"}
            />

            {/* Section header */}
            <div className="flex items-center justify-between px-1">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-foreground truncate">
                  {activeSectionName}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  {visibleProducts.length} produto{visibleProducts.length === 1 ? "" : "s"}
                  {search && ` para "${search}"`}
                </p>
              </div>
            </div>

            {/* Grid de produtos */}
            {visibleProducts.length === 0 ? (
              <EmptySectionState
                hasSearch={!!search}
                onCreate={openCreate}
                filter={filter}
                onResetFilter={() => setFilter("all")}
              />
            ) : (
              <SortableProductGrid
                items={visibleProducts}
                enabled={
                  !selectionMode &&
                  !search &&
                  filter === "all" &&
                  activeSection !== "all"
                }
                onReorder={reorderProducts}
                renderItem={(p) => renderProductCard(p)}
              />
            )}

            {/* Bulk action bar */}
            {selectedIds.size > 0 && (
              <BulkActionBar
                count={selectedIds.size}
                busy={bulkBusy}
                onPause={() => bulkAvailable(false)}
                onResume={() => bulkAvailable(true)}
                onOutOfStock={() => bulkOutOfStock(true)}
                onRestock={() => bulkOutOfStock(false)}
                onMove={() => setMoveBulkOpen(true)}
                onDuplicate={bulkDuplicate}
                onDelete={bulkDeleteConfirm}
                onClear={clearSelection}
              />
            )}

            {/* Bulk move picker */}
            {moveBulkOpen && (
              <div className="bg-card border border-border rounded-xl p-3 space-y-2">
                <p className="text-xs font-bold text-foreground">
                  Mover {selectedIds.size} produto{selectedIds.size > 1 ? "s" : ""} para:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => bulkMoveTo(null)}
                    className="text-xs bg-muted text-muted-foreground px-3 py-1.5 rounded-lg hover:bg-muted/80"
                  >
                    Sem seção
                  </button>
                  {(sections || []).map((s: any) => (
                    <button
                      key={s.id}
                      onClick={() => bulkMoveTo(s.id)}
                      className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/20 font-medium"
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setMoveBulkOpen(false)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile FAB */}
      {!showFullEmpty && productSheet === null && selectedIds.size === 0 && (
        <button
          onClick={openCreate}
          className="lg:hidden fixed bottom-20 right-4 z-30 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-all active:scale-95 flex items-center gap-2 px-5 py-3 font-bold text-sm"
          aria-label="Novo produto"
        >
          <Plus className="h-5 w-5" /> Novo
        </button>
      )}

      {/* Product sheet */}
      {productSheet && (
        <ProductSheet
          open={true}
          onOpenChange={(v) => !v && setProductSheet(null)}
          mode={productSheet.mode}
          initial={productSheet.mode === "edit" ? productSheet.initial : undefined}
          sectionName={
            productSheet.mode === "create"
              ? productSheet.sectionId
                ? (sections || []).find((s: any) => s.id === productSheet.sectionId)?.name || null
                : null
              : productSheet.sectionName
          }
          onSave={(data) =>
            productSheet.mode === "create"
              ? addProduct(productSheet.sectionId, data)
              : updateProduct(productSheet.id, data)
          }
          storeCategory={storeCategory}
          storeId={storeId}
          storeCategories={storeCategories}
        />
      )}

      {/* Section manage sheet */}
      <SectionManageSheet
        open={sectionSheetOpen}
        onOpenChange={setSectionSheetOpen}
        sections={sections || []}
        productCounts={productCounts}
        onCreate={createSection}
        onRename={renameSection}
        onMove={moveSection}
        onDelete={deleteSectionConfirm}
      />

      {/* Import CSV sheet */}
      <Sheet open={importOpen} onOpenChange={setImportOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0">
          <SheetHeader className="sticky top-0 z-20 bg-background border-b border-border px-3 py-3 flex-row items-center gap-2 space-y-0">
            <SheetClose className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg hover:bg-muted text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </SheetClose>
            <SheetTitle className="text-base leading-tight truncate flex-1">Importar cardápio</SheetTitle>
          </SheetHeader>
          <div className="p-5">
            <MenuImportCSV storeId={storeId} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Daily menu sheet */}
      {storeCategory !== "adegas" && (
        <Sheet open={dailyMenuOpen} onOpenChange={setDailyMenuOpen}>
          <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0">
            <SheetHeader className="sticky top-0 z-20 bg-background border-b border-border px-3 py-3 flex-row items-center gap-2 space-y-0">
              <SheetClose className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg hover:bg-muted text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </SheetClose>
              <SheetTitle className="text-base leading-tight truncate flex-1">Cardápio do dia</SheetTitle>
            </SheetHeader>
            <div className="p-5">
              <DailyMenuManager
                storeId={storeId}
                products={products || []}
                onUpdate={invalidateProducts}
              />
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* Confirm dialog */}
      {confirmState && (
        <ConfirmDialog
          open={true}
          onOpenChange={(v) => !v && setConfirmState(null)}
          title={confirmState.title}
          description={confirmState.description}
          destructive={confirmState.destructive}
          confirmText={confirmState.confirmText}
          onConfirm={confirmState.onConfirm}
        />
      )}
    </div>
  );
};

// ---------- Empty states ----------
const EmptyState = ({
  onCreateSection,
  onOpenImport,
}: {
  onCreateSection: () => void;
  onOpenImport: () => void;
}) => (
  <div className="bg-card border border-border rounded-2xl p-8 text-center max-w-lg mx-auto">
    <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
      <Sparkles className="h-6 w-6 text-primary" />
    </div>
    <h3 className="text-lg font-bold text-foreground">Vamos montar seu cardápio</h3>
    <p className="text-sm text-muted-foreground mt-1">
      Comece criando uma seção (ex: Hambúrgueres) ou importe seu cardápio de um CSV em poucos segundos.
    </p>
    <div className="flex flex-col sm:flex-row gap-2 justify-center mt-5">
      <button
        onClick={onCreateSection}
        className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors"
      >
        Criar primeira seção
      </button>
      <button
        onClick={onOpenImport}
        className="bg-card border border-border text-foreground px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-muted transition-colors"
      >
        Importar CSV
      </button>
    </div>
  </div>
);

const EmptySectionState = ({
  hasSearch,
  onCreate,
  filter,
  onResetFilter,
}: {
  hasSearch: boolean;
  onCreate: () => void;
  filter: ProductFilter;
  onResetFilter: () => void;
}) => (
  <div className="bg-card border border-dashed border-border rounded-2xl p-8 text-center">
    <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-muted flex items-center justify-center">
      <Package className="h-5 w-5 text-muted-foreground" />
    </div>
    {hasSearch ? (
      <p className="text-sm text-muted-foreground">Nenhum produto encontrado para a busca.</p>
    ) : filter !== "all" ? (
      <>
        <p className="text-sm text-muted-foreground">Nenhum produto com este filtro.</p>
        <button
          onClick={onResetFilter}
          className="mt-3 text-xs text-primary font-bold underline"
        >
          Limpar filtro
        </button>
      </>
    ) : (
      <>
        <p className="text-sm text-muted-foreground">Nenhum produto nesta seção ainda.</p>
        <button
          onClick={onCreate}
          className="mt-3 inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> Adicionar primeiro produto
        </button>
      </>
    )}
  </div>
);

export default MenuBuilder;