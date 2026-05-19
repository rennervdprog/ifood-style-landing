import { useState, useMemo, useCallback } from "react";
import DailyMenuManager from "@/components/DailyMenuManager";
import MenuImportCSV from "@/components/MenuImportCSV";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Plus, Trash2, Edit2, ChevronDown, ChevronUp, GripVertical,
  Package, PackageX, Save, X, Loader2, ArrowUp, ArrowDown, Search, Pause, Play, ArrowRightLeft, Layers, CheckSquare, Square,
} from "lucide-react";
import { ProductCard, ProductFormInline, ProductFormData } from "@/components/menu/ProductCard";
import { ConfirmDialog } from "@/components/menu/ConfirmDialog";

interface MenuBuilderProps {
  storeId: string;
  storeCategory?: string;
}

type ConfirmState = {
  title: string;
  description?: string;
  destructive?: boolean;
  confirmText?: string;
  onConfirm: () => void;
} | null;

const PRODUCT_FIELDS = "id, store_id, section_id, name, price, description, image_url, is_available, metadata, created_at";

const MenuBuilder = ({ storeId, storeCategory }: MenuBuilderProps) => {
  const queryClient = useQueryClient();

  // ----- UI state -----
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [newSectionName, setNewSectionName] = useState("");
  const [showAddSection, setShowAddSection] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [showProductForm, setShowProductForm] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [editInitialForm, setEditInitialForm] = useState<ProductFormData | undefined>(undefined);
  const [showAddonFormFor, setShowAddonFormFor] = useState<string | null>(null);
  const [addonGroupForm, setAddonGroupForm] = useState({ name: "", min_select: "0", max_select: "1" });
  const [addonItemForm, setAddonItemForm] = useState({ name: "", price: "0" });
  const [showAddonItemForm, setShowAddonItemForm] = useState<string | null>(null);
  const [showLinkAddonFor, setShowLinkAddonFor] = useState<string | null>(null);
  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);
  const [movingProductId, setMovingProductId] = useState<string | null>(null);
  const [showSectionAddonLink, setShowSectionAddonLink] = useState<string | null>(null);
  const [linkingSectionAddon, setLinkingSectionAddon] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [moveBulkOpen, setMoveBulkOpen] = useState(false);

  // ----- Queries -----
  const { data: sections } = useQuery({
    queryKey: ["menu-sections", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_sections")
        .select("id, name, sort_order")
        .eq("store_id", storeId)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: products } = useQuery({
    queryKey: ["store-products", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(PRODUCT_FIELDS)
        .eq("store_id", storeId)
        .order("name");
      if (error) throw error;
      return data;
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
      return data;
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

  // ----- Memoized derivations -----
  const productsBySection = useMemo(() => {
    const map = new Map<string | null, any[]>();
    (products || []).forEach((p: any) => {
      const k = p.section_id || null;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    });
    return map;
  }, [products]);

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

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase().trim();
    return (products || []).filter((p: any) =>
      p.name?.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q)
    );
  }, [products, search]);

  // ----- Granular invalidation helpers -----
  const invalidateProducts = () => queryClient.invalidateQueries({ queryKey: ["store-products", storeId] });
  const invalidateSections = () => queryClient.invalidateQueries({ queryKey: ["menu-sections", storeId] });
  const invalidateAddons = () => {
    queryClient.invalidateQueries({ queryKey: ["addon-groups", storeId] });
    queryClient.invalidateQueries({ queryKey: ["store-addon-groups", storeId] });
  };
  const invalidateLinks = () => queryClient.invalidateQueries({ queryKey: ["product-addon-links", storeId] });

  // ----- Section CRUD -----
  const addSection = async () => {
    if (!newSectionName.trim()) return;
    const { error } = await supabase.from("menu_sections").insert({
      store_id: storeId,
      name: newSectionName.trim(),
      sort_order: (sections?.length || 0) + 1,
    } as any);
    if (error) { toast.error("Erro ao criar seção"); return; }
    toast.success("Seção criada!");
    setNewSectionName("");
    setShowAddSection(false);
    invalidateSections();
  };

  const updateSection = async (id: string, name: string) => {
    if (!name.trim()) { setEditingSection(null); return; }
    const { error } = await supabase.from("menu_sections").update({ name: name.trim() } as any).eq("id", id);
    if (error) { toast.error("Erro ao atualizar seção"); return; }
    toast.success("Seção atualizada!");
    setEditingSection(null);
    invalidateSections();
  };

  const deleteSection = async (id: string) => {
    const sectionProducts = productsBySection.get(id) || [];
    if (sectionProducts.length > 0) {
      await supabase.from("products").update({ section_id: null } as any).in("id", sectionProducts.map((p: any) => p.id));
    }
    const { error } = await supabase.from("menu_sections").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir seção"); return; }
    toast.success("Seção excluída! Produtos movidos para 'Sem Seção'.");
    invalidateSections();
    invalidateProducts();
  };

  // ----- Section addon linking helpers -----
  const getLinkedGroupIds = useCallback((productId: string) => linksByProduct.get(productId) || [], [linksByProduct]);

  const getSectionLinkedGroupIds = useCallback((sectionId: string) => {
    const sectionProducts = productsBySection.get(sectionId) || [];
    if (sectionProducts.length === 0) return [];
    const allGroupIds = storeAddonGroupsList.map((g) => g.id);
    return allGroupIds.filter((gId) =>
      sectionProducts.every((p: any) => getLinkedGroupIds(p.id).includes(gId))
    );
  }, [productsBySection, storeAddonGroupsList, getLinkedGroupIds]);

  const linkGroupToSection = async (sectionId: string, addonGroupId: string) => {
    setLinkingSectionAddon(true);
    try {
      const sectionProducts = productsBySection.get(sectionId) || [];
      const inserts = sectionProducts
        .filter((p: any) => !getLinkedGroupIds(p.id).includes(addonGroupId))
        .map((p: any) => ({ product_id: p.id, addon_group_id: addonGroupId }));
      if (inserts.length === 0) { toast.info("Grupo já vinculado a todos"); return; }
      const { error } = await supabase.from("product_addon_groups").insert(inserts as any);
      if (error) { toast.error("Erro ao vincular grupo à seção"); return; }
      toast.success(`Grupo vinculado a ${inserts.length} produto${inserts.length > 1 ? "s" : ""}!`);
      invalidateLinks();
    } finally { setLinkingSectionAddon(false); }
  };

  const unlinkGroupFromSection = async (sectionId: string, addonGroupId: string) => {
    setLinkingSectionAddon(true);
    try {
      const sectionProducts = productsBySection.get(sectionId) || [];
      const productIdsToUnlink = sectionProducts
        .filter((p: any) => getLinkedGroupIds(p.id).includes(addonGroupId))
        .map((p: any) => p.id);
      if (productIdsToUnlink.length === 0) return;
      const { error } = await supabase.from("product_addon_groups")
        .delete()
        .eq("addon_group_id", addonGroupId)
        .in("product_id", productIdsToUnlink);
      if (error) { toast.error("Erro ao desvincular"); return; }
      toast.success(`Grupo desvinculado de ${productIdsToUnlink.length} produto${productIdsToUnlink.length > 1 ? "s" : ""}!`);
      invalidateLinks();
    } finally { setLinkingSectionAddon(false); }
  };

  // ----- Product CRUD -----
  const addProduct = async (sectionId: string | null, formData: ProductFormData) => {
    const finalPrice = parseFloat(formData.price) || 0;
    if (!formData.name.trim()) { toast.error("Preencha o nome do produto"); return; }
    if (!formData.price || finalPrice <= 0) { toast.error("Preencha o preço do produto"); return; }
    const { error } = await supabase.from("products").insert({
      store_id: storeId,
      section_id: sectionId,
      name: formData.name.trim(),
      price: finalPrice,
      description: formData.description.trim() || null,
      image_url: formData.image_url.trim() || null,
      metadata: formData.metadata || {},
    } as any);
    if (error) { toast.error("Erro ao adicionar produto"); return; }
    toast.success("Produto adicionado!");
    setShowProductForm(null);
    invalidateProducts();
  };

  const updateProduct = async (id: string, formData: ProductFormData) => {
    const finalPrice = parseFloat(formData.price) || 0;
    const { error } = await supabase.from("products").update({
      name: formData.name.trim(),
      price: finalPrice,
      description: formData.description.trim() || null,
      image_url: formData.image_url.trim() || null,
      metadata: formData.metadata || {},
    } as any).eq("id", id);
    if (error) { toast.error("Erro ao atualizar"); return; }
    toast.success("Produto atualizado!");
    setEditingProduct(null);
    setEditInitialForm(undefined);
    invalidateProducts();
  };

  const toggleProductAvailable = async (id: string, available: boolean) => {
    const { error } = await supabase.from("products").update({ is_available: !available }).eq("id", id);
    if (error) { toast.error("Erro"); return; }
    toast.success(available ? "Item pausado" : "Item reativado!");
    invalidateProducts();
  };

  const toggleProductOutOfStock = async (id: string, currentMeta: any) => {
    const isOOS = !!currentMeta?.out_of_stock;
    const newMeta = { ...(currentMeta || {}), out_of_stock: !isOOS };
    const { error } = await supabase.from("products").update({ metadata: newMeta } as any).eq("id", id);
    if (error) { toast.error("Erro"); return; }
    toast.success(isOOS ? "Produto disponível novamente!" : "Produto marcado como esgotado");
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
        if (error) { toast.error("Erro ao excluir"); return; }
        toast.success("Produto excluído!");
        setConfirmState(null);
        invalidateProducts();
      },
    });
  };

  const moveProduct = async (productId: string, targetSectionId: string | null) => {
    const { error } = await supabase.from("products").update({ section_id: targetSectionId } as any).eq("id", productId);
    if (error) { toast.error("Erro ao mover produto"); return; }
    toast.success("Produto movido!");
    setMovingProductId(null);
    invalidateProducts();
  };

  // ----- Addon CRUD (per-product) -----
  const linkAddonGroup = async (productId: string, addonGroupId: string) => {
    const { error } = await supabase.from("product_addon_groups").insert({ product_id: productId, addon_group_id: addonGroupId } as any);
    if (error) {
      if (error.code === "23505") { toast.info("Grupo já vinculado"); return; }
      toast.error("Erro ao vincular grupo"); return;
    }
    toast.success("Grupo vinculado!");
    invalidateLinks();
  };
  const unlinkAddonGroup = async (productId: string, addonGroupId: string) => {
    const { error } = await supabase.from("product_addon_groups").delete().eq("product_id", productId).eq("addon_group_id", addonGroupId);
    if (error) { toast.error("Erro ao desvincular"); return; }
    toast.success("Grupo desvinculado!");
    invalidateLinks();
  };
  const addAddonGroup = async (productId: string) => {
    if (!addonGroupForm.name.trim()) return;
    const { error } = await supabase.from("addon_groups").insert({
      product_id: productId,
      name: addonGroupForm.name.trim(),
      min_select: parseInt(addonGroupForm.min_select),
      max_select: parseInt(addonGroupForm.max_select),
    } as any);
    if (error) { toast.error("Erro ao criar grupo"); return; }
    toast.success("Grupo criado!");
    setAddonGroupForm({ name: "", min_select: "0", max_select: "1" });
    setShowAddonFormFor(null);
    invalidateAddons();
  };
  const deleteAddonGroup = async (id: string) => {
    const { error } = await supabase.from("addon_groups").delete().eq("id", id);
    if (error) { toast.error("Erro"); return; }
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
    if (error) { toast.error("Erro"); return; }
    toast.success("Adicional criado!");
    setAddonItemForm({ name: "", price: "0" });
    setShowAddonItemForm(null);
    invalidateAddons();
  };
  const deleteAddonItem = async (id: string) => {
    const { error } = await supabase.from("addon_items").delete().eq("id", id);
    if (error) { toast.error("Erro"); return; }
    toast.success("Adicional excluído!");
    invalidateAddons();
  };

  // ----- Reorder -----
  const handleSectionDrop = async (targetId: string) => {
    if (!draggedSectionId || draggedSectionId === targetId || !sections) return;
    const items = [...sections];
    const fromIdx = items.findIndex((s: any) => s.id === draggedSectionId);
    const toIdx = items.findIndex((s: any) => s.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = items.splice(fromIdx, 1);
    items.splice(toIdx, 0, moved);
    queryClient.setQueryData(["menu-sections", storeId], items.map((s: any, i: number) => ({ ...s, sort_order: i })));
    setDraggedSectionId(null);
    setDragOverSectionId(null);
    await Promise.all(items.map((s: any, i: number) =>
      supabase.from("menu_sections").update({ sort_order: i } as any).eq("id", s.id)
    ));
  };

  const moveSectionBy = async (sectionId: string, delta: -1 | 1) => {
    if (!sections) return;
    const items = [...sections];
    const fromIdx = items.findIndex((s: any) => s.id === sectionId);
    const toIdx = fromIdx + delta;
    if (fromIdx === -1 || toIdx < 0 || toIdx >= items.length) return;
    const [moved] = items.splice(fromIdx, 1);
    items.splice(toIdx, 0, moved);
    queryClient.setQueryData(["menu-sections", storeId], items.map((s: any, i: number) => ({ ...s, sort_order: i })));
    const results = await Promise.all(items.map((s: any, i: number) =>
      supabase.from("menu_sections").update({ sort_order: i } as any).eq("id", s.id)
    ));
    if (results.some(r => r.error)) { toast.error("Erro ao reordenar"); invalidateSections(); }
  };

  // ----- Bulk actions -----
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = () => setSelectedIds(new Set());

  const selectAllInSection = (sectionId: string | null) => {
    const list = productsBySection.get(sectionId) || [];
    setSelectedIds((prev) => {
      const next = new Set(prev);
      list.forEach((p: any) => next.add(p.id));
      return next;
    });
  };

  const bulkAvailable = async (available: boolean) => {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from("products").update({ is_available: available }).in("id", ids);
    setBulkBusy(false);
    if (error) { toast.error("Erro"); return; }
    toast.success(`${ids.length} ${available ? "reativado" : "pausado"}${ids.length > 1 ? "s" : ""}!`);
    clearSelection();
    invalidateProducts();
  };

  const bulkOutOfStock = async (value: boolean) => {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    const ids = Array.from(selectedIds);
    // metadata é jsonb — precisa preservar campos atuais por produto
    const targets = (products || []).filter((p: any) => ids.includes(p.id));
    const results = await Promise.all(targets.map((p: any) =>
      supabase.from("products").update({
        metadata: { ...((p.metadata as any) || {}), out_of_stock: value },
      } as any).eq("id", p.id)
    ));
    setBulkBusy(false);
    if (results.some(r => r.error)) { toast.error("Erro em alguns itens"); }
    else toast.success(`${ids.length} ${value ? "marcado" : "desmarcado"}${ids.length > 1 ? "s" : ""} como esgotado!`);
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
        if (error) { toast.error("Erro"); return; }
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
    const { error } = await supabase.from("products").update({ section_id: sectionId } as any).in("id", ids);
    setBulkBusy(false);
    setMoveBulkOpen(false);
    if (error) { toast.error("Erro ao mover"); return; }
    toast.success(`${ids.length} produto${ids.length > 1 ? "s" : ""} movido${ids.length > 1 ? "s" : ""}!`);
    clearSelection();
    invalidateProducts();
  };

  // ----- Section toggle helpers -----
  const isSectionExpanded = (id: string) => expandedSections.has(id);
  const toggleSection = (id: string) => setExpandedSections((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const expandAll = () => setExpandedSections(new Set((sections || []).map((s: any) => s.id)));
  const collapseAll = () => setExpandedSections(new Set());

  // ----- Stats -----
  const totalProducts = products?.length || 0;
  const activeCount = useMemo(() => (products || []).filter((p: any) => p.is_available).length, [products]);
  const pausedCount = totalProducts - activeCount;
  const outOfStockCount = useMemo(
    () => (products || []).filter((p: any) => p.is_available && p.metadata?.out_of_stock).length,
    [products]
  );

  const unsectionedProducts = productsBySection.get(null) || [];

  // ----- Render helpers -----
  const renderProductCard = (product: any) => (
    <ProductCard
      key={product.id}
      product={product}
      sections={sections || []}
      addonGroups={addonGroupsByProduct.get(product.id) || []}
      linkedGroups={(linksByProduct.get(product.id) || []).map((gid) => storeAddonGroupsList.find((g) => g.id === gid)).filter(Boolean) as any[]}
      storeAddonGroups={storeAddonGroupsList}
      linkedGroupIds={linksByProduct.get(product.id) || []}
      selected={selectedIds.has(product.id)}
      onToggleSelect={() => toggleSelect(product.id)}
      onLinkGroup={(gId) => linkAddonGroup(product.id, gId)}
      onUnlinkGroup={(gId) => unlinkAddonGroup(product.id, gId)}
      showLinkAddon={showLinkAddonFor === product.id}
      setShowLinkAddon={(v) => setShowLinkAddonFor(v ? product.id : null)}
      onToggleAvailable={() => toggleProductAvailable(product.id, product.is_available)}
      onToggleOutOfStock={() => toggleProductOutOfStock(product.id, (product as any).metadata)}
      onDelete={() => deleteProductConfirm(product.id, product.name)}
      onEdit={() => {
        setEditingProduct(product.id);
        setEditInitialForm({
          name: product.name,
          price: Number(product.price).toFixed(2),
          description: product.description || "",
          image_url: product.image_url || "",
          metadata: (product as any).metadata || {},
        });
      }}
      isEditing={editingProduct === product.id}
      initialEditForm={editingProduct === product.id ? editInitialForm : undefined}
      onSaveEdit={(data) => updateProduct(product.id, data)}
      onCancelEdit={() => { setEditingProduct(null); setEditInitialForm(undefined); }}
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
      onStartMove={() => setMovingProductId(movingProductId === product.id ? null : product.id)}
      onCancelMove={() => setMovingProductId(null)}
      onMoveProduct={moveProduct}
    />
  );

  return (
    <div className="space-y-4">
      {storeCategory !== "adegas" && (
        <DailyMenuManager storeId={storeId} products={products || []} onUpdate={invalidateProducts} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-foreground">Cardápio</h2>
          <p className="text-xs text-muted-foreground">
            <span className="text-primary font-bold">{activeCount} ativos</span>
            {pausedCount > 0 && <span className="text-muted-foreground"> · {pausedCount} pausados</span>}
            {outOfStockCount > 0 && <span className="text-destructive"> · {outOfStockCount} esgotado{outOfStockCount > 1 ? "s" : ""}</span>}
            {" · "}{sections?.length || 0} {(sections?.length || 0) === 1 ? "seção" : "seções"}
          </p>
        </div>
        <div className="flex gap-2">
          <MenuImportCSV storeId={storeId} />
          <button
            onClick={() => setShowAddSection(true)}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" /> Nova Seção
          </button>
        </div>
      </div>

      {/* Search + expand controls */}
      {totalProducts > 0 && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-card pl-9 pr-9 py-2 rounded-xl text-sm border border-border focus:border-primary focus:outline-none"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {!search && (sections?.length || 0) > 0 && (
            <button
              onClick={expandedSections.size === (sections?.length || 0) ? collapseAll : expandAll}
              className="text-xs text-primary font-bold px-3 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 transition-colors flex-shrink-0"
            >
              {expandedSections.size === (sections?.length || 0) ? "Recolher" : "Expandir"}
            </button>
          )}
        </div>
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="sticky top-2 z-20 bg-primary text-primary-foreground rounded-2xl p-3 shadow-lg flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4" />
            <span className="text-sm font-bold">{selectedIds.size} selecionado{selectedIds.size > 1 ? "s" : ""}</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button disabled={bulkBusy} onClick={() => bulkAvailable(false)} className="bg-primary-foreground/15 hover:bg-primary-foreground/25 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 disabled:opacity-50">
              <Pause className="h-3.5 w-3.5" /> Pausar
            </button>
            <button disabled={bulkBusy} onClick={() => bulkAvailable(true)} className="bg-primary-foreground/15 hover:bg-primary-foreground/25 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 disabled:opacity-50">
              <Play className="h-3.5 w-3.5" /> Reativar
            </button>
            <button disabled={bulkBusy} onClick={() => bulkOutOfStock(true)} className="bg-destructive/80 hover:bg-destructive px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 disabled:opacity-50">
              <PackageX className="h-3.5 w-3.5" /> Esgotar
            </button>
            <button disabled={bulkBusy} onClick={() => bulkOutOfStock(false)} className="bg-primary-foreground/15 hover:bg-primary-foreground/25 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 disabled:opacity-50">
              <Package className="h-3.5 w-3.5" /> Repor
            </button>
            <button disabled={bulkBusy} onClick={() => setMoveBulkOpen(true)} className="bg-primary-foreground/15 hover:bg-primary-foreground/25 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 disabled:opacity-50">
              <ArrowRightLeft className="h-3.5 w-3.5" /> Mover
            </button>
            <button disabled={bulkBusy} onClick={bulkDeleteConfirm} className="bg-destructive hover:bg-destructive/90 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 disabled:opacity-50">
              <Trash2 className="h-3.5 w-3.5" /> Excluir
            </button>
            <button onClick={clearSelection} className="text-xs underline opacity-80">Limpar</button>
            {bulkBusy && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>
        </div>
      )}

      {/* Bulk move picker */}
      {moveBulkOpen && (
        <div className="bg-card border border-border rounded-xl p-3 space-y-2">
          <p className="text-xs font-bold text-foreground">Mover {selectedIds.size} produto{selectedIds.size > 1 ? "s" : ""} para:</p>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => bulkMoveTo(null)} className="text-xs bg-muted text-muted-foreground px-3 py-1.5 rounded-lg hover:bg-muted/80">Sem Seção</button>
            {(sections || []).map((s: any) => (
              <button key={s.id} onClick={() => bulkMoveTo(s.id)} className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/20 font-medium">{s.name}</button>
            ))}
          </div>
          <button onClick={() => setMoveBulkOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
        </div>
      )}

      {/* Search results view */}
      {filteredProducts !== null && (
        <div className="bg-card rounded-2xl p-4 space-y-2 border border-border">
          <p className="text-xs text-muted-foreground">{filteredProducts.length} resultado{filteredProducts.length === 1 ? "" : "s"} para "<strong>{search}</strong>"</p>
          {filteredProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum produto encontrado</p>
          ) : (
            filteredProducts.map((p: any) => renderProductCard(p))
          )}
        </div>
      )}

      {/* Tip */}
      {filteredProducts === null && (!sections || sections.length === 0) && (
        <div className="bg-accent/10 border border-accent/30 rounded-xl p-4 text-center">
          <p className="text-sm text-accent-foreground font-medium">📋 Comece criando seções para organizar seu cardápio</p>
          <p className="text-xs text-muted-foreground mt-1">Ex: Hambúrgueres, Bebidas, Combos, Acompanhamentos</p>
        </div>
      )}

      {/* Add Section Form */}
      {showAddSection && (
        <div className="bg-card rounded-xl p-3 flex gap-2 shadow-sm border border-border">
          <input
            type="text"
            placeholder="Nome da seção (ex: Hambúrgueres, Bebidas...)"
            value={newSectionName}
            onChange={(e) => setNewSectionName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSection()}
            className="flex-1 bg-secondary text-foreground px-3 py-2 rounded-lg text-sm border border-border focus:border-primary focus:outline-none"
            autoFocus
          />
          <button onClick={addSection} className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-bold">
            <Save className="h-4 w-4" />
          </button>
          <button onClick={() => { setShowAddSection(false); setNewSectionName(""); }} className="text-muted-foreground px-2">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Sections (escondido durante busca) */}
      {filteredProducts === null && sections?.map((section: any) => {
        const sectionProducts = productsBySection.get(section.id) || [];
        const expanded = isSectionExpanded(section.id);
        const sectionLinkedIds = getSectionLinkedGroupIds(section.id);
        const allSelected = sectionProducts.length > 0 && sectionProducts.every((p: any) => selectedIds.has(p.id));
        return (
          <div
            key={section.id}
            className={`bg-card rounded-2xl overflow-hidden shadow-sm border border-border transition-all ${
              dragOverSectionId === section.id ? "ring-2 ring-primary scale-[1.01]" : ""
            } ${draggedSectionId === section.id ? "opacity-50" : ""}`}
            draggable
            onDragStart={(e) => { setDraggedSectionId(section.id); e.dataTransfer.effectAllowed = "move"; }}
            onDragOver={(e) => { e.preventDefault(); setDragOverSectionId(section.id); }}
            onDragLeave={() => setDragOverSectionId(null)}
            onDrop={(e) => { e.preventDefault(); handleSectionDrop(section.id); }}
            onDragEnd={() => { setDraggedSectionId(null); setDragOverSectionId(null); }}
          >
            {/* Section Header */}
            <div
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => toggleSection(section.id)}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab active:cursor-grabbing hidden sm:block flex-shrink-0" />
                {editingSection === section.id ? (
                  <input
                    type="text"
                    defaultValue={section.name}
                    onBlur={(e) => updateSection(section.id, e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && updateSection(section.id, (e.target as HTMLInputElement).value)}
                    className="bg-secondary text-foreground px-3 py-1.5 rounded-lg text-sm border border-primary focus:outline-none font-bold"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold text-foreground truncate">{section.name}</span>
                    <span className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                      {sectionProducts.length}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={(e) => { e.stopPropagation(); moveSectionBy(section.id, -1); }} disabled={sections?.[0]?.id === section.id}
                  className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-30 disabled:hover:bg-transparent" title="Mover para cima">
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); moveSectionBy(section.id, 1); }} disabled={sections?.[sections.length - 1]?.id === section.id}
                  className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-30 disabled:hover:bg-transparent" title="Mover para baixo">
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); setEditingSection(section.id); }}
                  className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition-colors" title="Renomear">
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button onClick={(e) => {
                  e.stopPropagation();
                  setConfirmState({
                    title: `Excluir seção "${section.name}"?`,
                    description: `Os ${sectionProducts.length} produto${sectionProducts.length === 1 ? "" : "s"} desta seção ${sectionProducts.length === 1 ? "será movido" : "serão movidos"} para "Sem Seção".`,
                    destructive: true,
                    confirmText: "Excluir seção",
                    onConfirm: async () => { await deleteSection(section.id); setConfirmState(null); },
                  });
                }} className="text-muted-foreground hover:text-destructive p-1.5 rounded-lg hover:bg-destructive/10 transition-colors" title="Excluir seção">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground ml-1" /> : <ChevronDown className="h-4 w-4 text-muted-foreground ml-1" />}
              </div>
            </div>

            {/* Section Products */}
            {expanded && (
              <div className="px-4 pb-4 space-y-2">
                {/* Bulk select row */}
                {sectionProducts.length > 0 && (
                  <button
                    onClick={() => allSelected ? setSelectedIds((prev) => { const next = new Set(prev); sectionProducts.forEach((p: any) => next.delete(p.id)); return next; }) : selectAllInSection(section.id)}
                    className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground px-2 py-1"
                  >
                    {allSelected ? <CheckSquare className="h-3.5 w-3.5 text-primary" /> : <Square className="h-3.5 w-3.5" />}
                    {allSelected ? "Desmarcar todos" : "Selecionar todos"}
                  </button>
                )}

                {/* Beverage section toggle */}
                <div className="flex items-center justify-between bg-muted/50 border border-border rounded-xl p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🥤</span>
                    <span className="text-xs font-bold text-foreground/70">Seção de bebidas</span>
                    <span className="text-[10px] text-muted-foreground hidden sm:inline">(marca todos como bebida)</span>
                  </div>
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const allBeverage = sectionProducts.length > 0 && sectionProducts.every((p: any) => p.metadata?.is_beverage);
                      const newValue = !allBeverage;
                      await Promise.all(sectionProducts.map((p: any) =>
                        supabase.from("products").update({ metadata: { ...(p.metadata || {}), is_beverage: newValue } } as any).eq("id", p.id)
                      ));
                      toast.success(newValue ? "Todos marcados como bebida!" : "Bebida removido dos itens!");
                      invalidateProducts();
                    }}
                    className={`w-10 h-5 rounded-full transition-colors relative ${
                      sectionProducts.length > 0 && sectionProducts.every((p: any) => p.metadata?.is_beverage) ? "bg-primary" : "bg-muted-foreground/30"
                    }`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${
                      sectionProducts.length > 0 && sectionProducts.every((p: any) => p.metadata?.is_beverage) ? "translate-x-5" : "translate-x-0.5"
                    }`} />
                  </button>
                </div>

                {/* Section addon group linking */}
                <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl p-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Layers className="h-4 w-4 text-primary flex-shrink-0" />
                    <span className="text-xs font-bold text-primary">Adicionais da seção</span>
                    <span className="text-[10px] text-muted-foreground hidden sm:inline">(aplica em todos)</span>
                  </div>
                  <button type="button" onClick={(e) => { e.stopPropagation(); setShowSectionAddonLink(showSectionAddonLink === section.id ? null : section.id); }}
                    className="text-primary text-xs font-bold px-3 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors flex-shrink-0">
                    {showSectionAddonLink === section.id ? "Fechar" : "Gerenciar"}
                  </button>
                </div>

                {showSectionAddonLink === section.id && storeAddonGroupsList.length > 0 && (
                  <div className="bg-muted/30 border border-border rounded-xl p-3 space-y-2">
                    <p className="text-[11px] text-muted-foreground">
                      Vincular/desvincular grupos para <strong>todos os {sectionProducts.length} produtos</strong>:
                    </p>
                    {sectionProducts.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-2">Adicione produtos à seção primeiro</p>
                    ) : (
                      <div className="space-y-1.5">
                        {storeAddonGroupsList.map((group: any) => {
                          const isLinkedToAll = sectionLinkedIds.includes(group.id);
                          const linkedCount = sectionProducts.filter((p: any) => getLinkedGroupIds(p.id).includes(group.id)).length;
                          const isPartial = linkedCount > 0 && linkedCount < sectionProducts.length;
                          return (
                            <button key={group.id} disabled={linkingSectionAddon}
                              onClick={() => isLinkedToAll ? unlinkGroupFromSection(section.id, group.id) : linkGroupToSection(section.id, group.id)}
                              className={`w-full flex items-center justify-between py-2.5 px-3 rounded-xl border-2 transition-all text-left ${
                                isLinkedToAll ? "bg-primary/10 border-primary" : isPartial ? "bg-accent/10 border-accent/50" : "bg-muted/50 border-transparent hover:border-primary/30"
                              }`}>
                              <div>
                                <span className="text-sm font-bold text-foreground">{group.name}</span>
                                <span className="text-[10px] text-muted-foreground ml-2">
                                  {(group.addon_items as any[])?.length || 0} itens • {group.min_select > 0 ? "Obrigatório" : "Opcional"}
                                </span>
                                {isPartial && <span className="text-[10px] text-accent ml-2 font-bold">({linkedCount}/{sectionProducts.length})</span>}
                              </div>
                              <div className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${isLinkedToAll ? "bg-primary" : isPartial ? "bg-accent" : "bg-muted-foreground/30"}`}>
                                <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform shadow ${isLinkedToAll ? "translate-x-5" : isPartial ? "translate-x-2.5" : "translate-x-0.5"}`} />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {showSectionAddonLink === section.id && storeAddonGroupsList.length === 0 && (
                  <div className="bg-muted/30 border border-border rounded-xl p-3 text-center">
                    <p className="text-xs text-muted-foreground">Nenhum grupo de adicionais criado.</p>
                    <p className="text-[11px] text-muted-foreground mt-1">Crie grupos na aba "Adicionais" primeiro.</p>
                  </div>
                )}

                {sectionProducts.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhum produto nesta seção</p>
                )}
                {sectionProducts.map((p: any) => renderProductCard(p))}

                {showProductForm === section.id ? (
                  <ProductFormInline
                    onSave={(formData) => addProduct(section.id, formData)}
                    onCancel={() => setShowProductForm(null)}
                    storeCategory={storeCategory}
                    storeId={storeId}
                  />
                ) : (
                  <button
                    onClick={() => setShowProductForm(section.id)}
                    className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-primary/30 rounded-xl text-primary hover:bg-primary/5 transition-colors text-sm font-medium"
                  >
                    <Plus className="h-4 w-4" /> Adicionar Produto
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Unsectioned Products */}
      {filteredProducts === null && unsectionedProducts.length > 0 && (
        <div className="bg-card rounded-2xl p-4 space-y-2 border border-dashed border-border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-bold text-muted-foreground">Sem Seção</h3>
              <span className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full">{unsectionedProducts.length}</span>
            </div>
            {sections && sections.length > 0 && (
              <p className="text-xs text-muted-foreground hidden sm:block">Use ↔ para mover para uma seção</p>
            )}
          </div>
          {unsectionedProducts.map((p: any) => renderProductCard(p))}
        </div>
      )}

      {/* Quick add product */}
      {filteredProducts === null && (
        showProductForm === "__none__" ? (
          <ProductFormInline
            onSave={(formData) => addProduct(null, formData)}
            onCancel={() => setShowProductForm(null)}
            storeCategory={storeCategory}
            storeId={storeId}
          />
        ) : (
          <button
            onClick={() => setShowProductForm("__none__")}
            className="w-full flex items-center justify-center gap-2 py-3 bg-muted/50 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-sm font-medium"
          >
            <Plus className="h-4 w-4" /> Produto Rápido (sem seção)
          </button>
        )
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

export default MenuBuilder;
