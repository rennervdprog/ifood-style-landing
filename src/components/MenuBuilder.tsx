import { useState, useRef } from "react";
import MenuImportCSV from "@/components/MenuImportCSV";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Plus, Trash2, Edit2, ChevronDown, ChevronUp, GripVertical,
  Package, Save, X, Link2, Upload, Loader2, Pause, Play, ArrowRightLeft
} from "lucide-react";

import CategoryProductFields from "@/components/CategoryProductFields";

interface MenuBuilderProps {
  storeId: string;
  storeCategory?: string;
}

const MenuBuilder = ({ storeId, storeCategory }: MenuBuilderProps) => {
  const queryClient = useQueryClient();
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [newSectionName, setNewSectionName] = useState("");
  const [showAddSection, setShowAddSection] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [showProductForm, setShowProductForm] = useState<string | null>(null);
  const [productForm, setProductForm] = useState({ name: "", price: "", description: "", image_url: "", metadata: {} as Record<string, any> });
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [showAddonForm, setShowAddonForm] = useState<string | null>(null);
  const [addonGroupForm, setAddonGroupForm] = useState({ name: "", min_select: "0", max_select: "1" });
  const [addonItemForm, setAddonItemForm] = useState({ name: "", price: "0" });
  const [showAddonItemForm, setShowAddonItemForm] = useState<string | null>(null);
  const [showLinkAddon, setShowLinkAddon] = useState<string | null>(null);
  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);
  const [movingProductId, setMovingProductId] = useState<string | null>(null);

  const { data: sections } = useQuery({
    queryKey: ["menu-sections", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_sections")
        .select("*")
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
        .select("*")
        .eq("store_id", storeId)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const productIds = products?.map(p => p.id) || [];
  const { data: addonGroups } = useQuery({
    queryKey: ["addon-groups", productIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("addon_groups")
        .select("*, addon_items(*)")
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
        .select("*, addon_items(*)")
        .eq("store_id", storeId)
        .is("product_id", null)
        .order("sort_order");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: productAddonLinks } = useQuery({
    queryKey: ["product-addon-links", productIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_addon_groups")
        .select("*")
        .in("product_id", productIds);
      if (error) throw error;
      return data || [];
    },
    enabled: productIds.length > 0,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["menu-sections", storeId] });
    queryClient.invalidateQueries({ queryKey: ["store-products", storeId] });
    queryClient.invalidateQueries({ queryKey: ["addon-groups"] });
    queryClient.invalidateQueries({ queryKey: ["store-addon-groups", storeId] });
    queryClient.invalidateQueries({ queryKey: ["product-addon-links"] });
  };

  const linkAddonGroup = async (productId: string, addonGroupId: string) => {
    const { error } = await supabase.from("product_addon_groups").insert({
      product_id: productId,
      addon_group_id: addonGroupId,
    } as any);
    if (error) {
      if (error.code === "23505") { toast.info("Grupo já vinculado"); return; }
      toast.error("Erro ao vincular grupo");
      return;
    }
    toast.success("Grupo vinculado!");
    invalidateAll();
  };

  const unlinkAddonGroup = async (productId: string, addonGroupId: string) => {
    const { error } = await supabase.from("product_addon_groups").delete().eq("product_id", productId).eq("addon_group_id", addonGroupId);
    if (error) { toast.error("Erro ao desvincular"); return; }
    toast.success("Grupo desvinculado!");
    invalidateAll();
  };

  const getLinkedGroupIds = (productId: string) =>
    (productAddonLinks as any[])?.filter((l: any) => l.product_id === productId).map((l: any) => l.addon_group_id) || [];

  const getLinkedGroups = (productId: string) => {
    const ids = getLinkedGroupIds(productId);
    return (storeAddonGroups as any[])?.filter((g: any) => ids.includes(g.id)) || [];
  };

  // Section CRUD
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
    invalidateAll();
  };

  const updateSection = async (id: string, name: string) => {
    const { error } = await supabase.from("menu_sections").update({ name } as any).eq("id", id);
    if (error) { toast.error("Erro ao atualizar seção"); return; }
    toast.success("Seção atualizada!");
    setEditingSection(null);
    invalidateAll();
  };

  const deleteSection = async (id: string) => {
    const sectionProducts = getProductsBySection(id);
    if (sectionProducts.length > 0) {
      // Move products to unsectioned before deleting
      const updates = sectionProducts.map(p =>
        supabase.from("products").update({ section_id: null } as any).eq("id", p.id)
      );
      await Promise.all(updates);
    }
    const { error } = await supabase.from("menu_sections").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir seção"); return; }
    toast.success("Seção excluída! Produtos movidos para 'Sem Seção'.");
    invalidateAll();
  };

  // Move product to another section
  const moveProduct = async (productId: string, targetSectionId: string | null) => {
    const { error } = await supabase.from("products").update({ section_id: targetSectionId } as any).eq("id", productId);
    if (error) { toast.error("Erro ao mover produto"); return; }
    toast.success("Produto movido!");
    setMovingProductId(null);
    invalidateAll();
  };

  // Product price derivation for pizzas
  const derivePriceFromMetadata = (meta: Record<string, any>): number => {
    const sizes = meta?.sizes as Array<{ name: string; price: number }> | undefined;
    if (sizes && sizes.length > 0) {
      const prices = sizes.map(s => s.price).filter(p => p > 0);
      return prices.length > 0 ? Math.min(...prices) : 0;
    }
    return 0;
  };

  const isPizzaProduct = (meta: Record<string, any>): boolean => {
    return storeCategory === "pizzas" && !meta?.is_beverage;
  };

  const addProduct = async (sectionId: string | null) => {
    const meta = productForm.metadata || {};
    const finalPrice = isPizzaProduct(meta) ? derivePriceFromMetadata(meta) : parseFloat(productForm.price) || 0;
    if (!productForm.name.trim()) { toast.error("Preencha o nome do produto"); return; }
    if (!isPizzaProduct(meta) && (!productForm.price || finalPrice <= 0)) { toast.error("Preencha o preço do produto"); return; }
    if (isPizzaProduct(meta) && finalPrice <= 0) { toast.error("Defina ao menos um tamanho com preço"); return; }

    const { error } = await supabase.from("products").insert({
      store_id: storeId,
      section_id: sectionId,
      name: productForm.name.trim(),
      price: finalPrice,
      description: productForm.description.trim() || null,
      image_url: productForm.image_url.trim() || null,
      metadata: meta,
    } as any);
    if (error) { toast.error("Erro ao adicionar produto"); return; }
    toast.success("Produto adicionado!");
    setProductForm({ name: "", price: "", description: "", image_url: "", metadata: {} });
    setShowProductForm(null);
    invalidateAll();
  };

  const updateProduct = async (id: string) => {
    const meta = productForm.metadata || {};
    const finalPrice = isPizzaProduct(meta) ? derivePriceFromMetadata(meta) : parseFloat(productForm.price);
    const { error } = await supabase.from("products").update({
      name: productForm.name.trim(),
      price: finalPrice,
      description: productForm.description.trim() || null,
      image_url: productForm.image_url.trim() || null,
      metadata: meta,
    } as any).eq("id", id);
    if (error) { toast.error("Erro ao atualizar"); return; }
    toast.success("Produto atualizado!");
    setEditingProduct(null);
    setProductForm({ name: "", price: "", description: "", image_url: "", metadata: {} });
    invalidateAll();
  };

  const toggleProductAvailable = async (id: string, available: boolean) => {
    const { error } = await supabase.from("products").update({ is_available: !available }).eq("id", id);
    if (error) { toast.error("Erro"); return; }
    toast.success(available ? "Item pausado" : "Item reativado!");
    invalidateAll();
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("Excluir este produto?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Produto excluído!");
    invalidateAll();
  };

  // Addon CRUD
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
    setShowAddonForm(null);
    invalidateAll();
  };

  const deleteAddonGroup = async (id: string) => {
    const { error } = await supabase.from("addon_groups").delete().eq("id", id);
    if (error) { toast.error("Erro"); return; }
    toast.success("Grupo excluído!");
    invalidateAll();
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
    invalidateAll();
  };

  const deleteAddonItem = async (id: string) => {
    const { error } = await supabase.from("addon_items").delete().eq("id", id);
    if (error) { toast.error("Erro"); return; }
    toast.success("Adicional excluído!");
    invalidateAll();
  };

  const getProductsBySection = (sectionId: string | null) =>
    products?.filter(p => (p as any).section_id === sectionId) || [];

  const getAddonGroups = (productId: string) =>
    (addonGroups as any[])?.filter((g: any) => g.product_id === productId) || [];

  const unsectionedProducts = getProductsBySection(null);

  // Drag and drop
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
    const updates = items.map((s: any, i: number) =>
      supabase.from("menu_sections").update({ sort_order: i } as any).eq("id", s.id)
    );
    await Promise.all(updates);
  };

  const totalProducts = products?.length || 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-foreground">Cardápio</h2>
          <p className="text-xs text-muted-foreground">{totalProducts} {totalProducts === 1 ? "produto" : "produtos"} • {sections?.length || 0} {(sections?.length || 0) === 1 ? "seção" : "seções"}</p>
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

      {/* Tip */}
      {(!sections || sections.length === 0) && (
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

      {/* Sections */}
      {sections?.map((section: any) => (
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
            onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
          >
            <div className="flex items-center gap-3">
              <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab active:cursor-grabbing" />
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
                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground">{section.name}</span>
                  <span className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full font-medium">
                    {getProductsBySection(section.id).length}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); setEditingSection(section.id); }}
                className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition-colors"
                title="Renomear"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); if (confirm(`Excluir seção "${section.name}"? Os produtos serão movidos para "Sem Seção".`)) deleteSection(section.id); }}
                className="text-muted-foreground hover:text-destructive p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
                title="Excluir seção"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              {expandedSection === section.id ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground ml-1" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground ml-1" />
              )}
            </div>
          </div>

          {/* Section Products */}
          {expandedSection === section.id && (
            <div className="px-4 pb-4 space-y-2">
              {getProductsBySection(section.id).length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhum produto nesta seção</p>
              )}
              {getProductsBySection(section.id).map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  sections={sections}
                  addonGroups={getAddonGroups(product.id)}
                  linkedGroups={getLinkedGroups(product.id)}
                  storeAddonGroups={storeAddonGroups || []}
                  linkedGroupIds={getLinkedGroupIds(product.id)}
                  onLinkGroup={(gId: string) => linkAddonGroup(product.id, gId)}
                  onUnlinkGroup={(gId: string) => unlinkAddonGroup(product.id, gId)}
                  showLinkAddon={showLinkAddon}
                  setShowLinkAddon={setShowLinkAddon}
                  onToggle={() => toggleProductAvailable(product.id, product.is_available)}
                  onDelete={() => deleteProduct(product.id)}
                  onEdit={() => {
                    setEditingProduct(product.id);
                    setProductForm({
                      name: product.name,
                      price: String(product.price),
                      description: product.description || "",
                      image_url: product.image_url || "",
                      metadata: (product as any).metadata || {},
                    });
                  }}
                  isEditing={editingProduct === product.id}
                  productForm={productForm}
                  setProductForm={setProductForm}
                  onSaveEdit={() => updateProduct(product.id)}
                  onCancelEdit={() => { setEditingProduct(null); setProductForm({ name: "", price: "", description: "", image_url: "", metadata: {} }); }}
                  showAddonForm={showAddonForm}
                  setShowAddonForm={setShowAddonForm}
                  addonGroupForm={addonGroupForm}
                  setAddonGroupForm={setAddonGroupForm}
                  onAddAddonGroup={() => addAddonGroup(product.id)}
                  onDeleteAddonGroup={deleteAddonGroup}
                  showAddonItemForm={showAddonItemForm}
                  setShowAddonItemForm={setShowAddonItemForm}
                  addonItemForm={addonItemForm}
                  setAddonItemForm={setAddonItemForm}
                  onAddAddonItem={addAddonItem}
                  storeCategory={storeCategory}
                  storeId={storeId}
                  movingProductId={movingProductId}
                  setMovingProductId={setMovingProductId}
                  onMoveProduct={moveProduct}
                />
              ))}

              {showProductForm === section.id ? (
                <ProductFormInline
                  form={productForm}
                  setForm={setProductForm}
                  onSave={() => addProduct(section.id)}
                  onCancel={() => { setShowProductForm(null); setProductForm({ name: "", price: "", description: "", image_url: "", metadata: {} }); }}
                  storeCategory={storeCategory}
                  storeId={storeId}
                />
              ) : (
                <button
                  onClick={() => { setShowProductForm(section.id); setProductForm({ name: "", price: "", description: "", image_url: "", metadata: {} }); }}
                  className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-primary/30 rounded-xl text-primary hover:bg-primary/5 transition-colors text-sm font-medium"
                >
                  <Plus className="h-4 w-4" /> Adicionar Produto
                </button>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Unsectioned Products */}
      {unsectionedProducts.length > 0 && (
        <div className="bg-card rounded-2xl p-4 space-y-2 border border-dashed border-border">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-bold text-muted-foreground">Sem Seção</h3>
              <span className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full">{unsectionedProducts.length}</span>
            </div>
            {sections && sections.length > 0 && (
              <p className="text-xs text-muted-foreground">Use ↔ para mover para uma seção</p>
            )}
          </div>
          {unsectionedProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              sections={sections || []}
              addonGroups={getAddonGroups(product.id)}
              linkedGroups={getLinkedGroups(product.id)}
              storeAddonGroups={storeAddonGroups || []}
              linkedGroupIds={getLinkedGroupIds(product.id)}
              onLinkGroup={(gId: string) => linkAddonGroup(product.id, gId)}
              onUnlinkGroup={(gId: string) => unlinkAddonGroup(product.id, gId)}
              showLinkAddon={showLinkAddon}
              setShowLinkAddon={setShowLinkAddon}
              onToggle={() => toggleProductAvailable(product.id, product.is_available)}
              onDelete={() => deleteProduct(product.id)}
              onEdit={() => {
                setEditingProduct(product.id);
                setProductForm({
                  name: product.name,
                  price: String(product.price),
                  description: product.description || "",
                  image_url: product.image_url || "",
                  metadata: (product as any).metadata || {},
                });
              }}
              isEditing={editingProduct === product.id}
              productForm={productForm}
              setProductForm={setProductForm}
              onSaveEdit={() => updateProduct(product.id)}
              onCancelEdit={() => { setEditingProduct(null); setProductForm({ name: "", price: "", description: "", image_url: "", metadata: {} }); }}
              showAddonForm={showAddonForm}
              setShowAddonForm={setShowAddonForm}
              addonGroupForm={addonGroupForm}
              setAddonGroupForm={setAddonGroupForm}
              onAddAddonGroup={() => addAddonGroup(product.id)}
              onDeleteAddonGroup={deleteAddonGroup}
              showAddonItemForm={showAddonItemForm}
              setShowAddonItemForm={setShowAddonItemForm}
              addonItemForm={addonItemForm}
              setAddonItemForm={setAddonItemForm}
              onAddAddonItem={addAddonItem}
              storeCategory={storeCategory}
              storeId={storeId}
              movingProductId={movingProductId}
              setMovingProductId={setMovingProductId}
              onMoveProduct={moveProduct}
            />
          ))}
        </div>
      )}

      {/* Quick add product */}
      {showProductForm === "__none__" ? (
        <ProductFormInline
          form={productForm}
          setForm={setProductForm}
          onSave={() => addProduct(null)}
          onCancel={() => { setShowProductForm(null); setProductForm({ name: "", price: "", description: "", image_url: "", metadata: {} }); }}
          storeCategory={storeCategory}
          storeId={storeId}
        />
      ) : (
        <button
          onClick={() => { setShowProductForm("__none__"); setProductForm({ name: "", price: "", description: "", image_url: "", metadata: {} }); }}
          className="w-full flex items-center justify-center gap-2 py-3 bg-muted/50 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-sm font-medium"
        >
          <Plus className="h-4 w-4" /> Produto Rápido (sem seção)
        </button>
      )}
    </div>
  );
};

// Upload helper
const uploadProductImage = async (file: File): Promise<string | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { toast.error("Faça login primeiro"); return null; }
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  if (!["png", "jpg", "jpeg", "webp"].includes(ext)) { toast.error("Use PNG, JPG ou WEBP."); return null; }
  if (file.size > 5 * 1024 * 1024) { toast.error("Máx 5MB"); return null; }
  const filePath = `${user.id}/products/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("store-assets").upload(filePath, file, { upsert: true });
  if (error) { toast.error("Erro ao enviar imagem"); return null; }
  const { data: urlData } = supabase.storage.from("store-assets").getPublicUrl(filePath);
  return urlData.publicUrl;
};

// Product Form
const ProductFormInline = ({
  form, setForm, onSave, onCancel, storeCategory, storeId,
}: {
  form: { name: string; price: string; description: string; image_url: string; metadata: Record<string, any> };
  setForm: (f: any) => void;
  onSave: () => void;
  onCancel: () => void;
  storeCategory?: string;
  storeId?: string;
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const url = await uploadProductImage(file);
    if (url) setForm({ ...form, image_url: url });
    setUploading(false);
  };

  const hidePriceField = storeCategory === "pizzas" && !form.metadata?.is_beverage;

  return (
    <div className="bg-secondary/50 border border-border rounded-xl p-4 space-y-3">
      <input
        type="text"
        placeholder="Nome do produto *"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        className="w-full bg-background text-foreground px-3 py-2.5 rounded-lg text-sm border border-border focus:border-primary focus:outline-none font-medium"
        autoFocus
      />
      <div className="flex gap-2">
        {!hidePriceField && (
          <input
            type="number"
            placeholder="Preço *"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            className="w-1/3 bg-background text-foreground px-3 py-2.5 rounded-lg text-sm border border-border focus:border-primary focus:outline-none"
            inputMode="decimal"
            step="0.01"
          />
        )}
        <div className="flex-1">
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileSelect} className="hidden" />
          {form.image_url ? (
            <div className="flex items-center gap-2 bg-background rounded-lg px-3 py-2 border border-border">
              <img src={form.image_url} alt="" className="w-8 h-8 rounded object-cover" />
              <button onClick={() => setForm({ ...form, image_url: "" })} className="text-destructive text-xs hover:underline">Remover</button>
              <button onClick={() => fileInputRef.current?.click()} className="text-primary text-xs hover:underline">Trocar</button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full flex items-center justify-center gap-2 bg-background text-muted-foreground px-3 py-2.5 rounded-lg text-sm border border-dashed border-border hover:border-primary hover:text-primary transition-colors"
            >
              {uploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</> : <><Upload className="h-4 w-4" /> Foto</>}
            </button>
          )}
        </div>
      </div>
      <input
        type="text"
        placeholder="Descrição (opcional)"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        className="w-full bg-background text-foreground px-3 py-2.5 rounded-lg text-sm border border-border focus:border-primary focus:outline-none"
      />

      {storeCategory && (
        <CategoryProductFields
          category={storeCategory}
          metadata={form.metadata || {}}
          onChange={(metadata) => setForm({ ...form, metadata })}
          storeId={storeId}
        />
      )}

      <div className="flex gap-2 pt-1">
        <button onClick={onSave} className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors">
          Salvar Produto
        </button>
        <button onClick={onCancel} className="px-4 py-2.5 text-muted-foreground text-sm hover:text-foreground transition-colors">
          Cancelar
        </button>
      </div>
    </div>
  );
};

// Product Card
const ProductCard = ({
  product, sections, addonGroups, linkedGroups, storeAddonGroups, linkedGroupIds,
  onLinkGroup, onUnlinkGroup, showLinkAddon, setShowLinkAddon,
  onToggle, onDelete, onEdit, isEditing, productForm, setProductForm,
  onSaveEdit, onCancelEdit, showAddonForm, setShowAddonForm,
  addonGroupForm, setAddonGroupForm, onAddAddonGroup, onDeleteAddonGroup,
  showAddonItemForm, setShowAddonItemForm, addonItemForm, setAddonItemForm,
  onAddAddonItem, onDeleteAddonItem, storeCategory, storeId,
  movingProductId, setMovingProductId, onMoveProduct,
}: any) => {
  if (isEditing) {
    return (
      <ProductFormInline
        form={productForm}
        setForm={setProductForm}
        onSave={onSaveEdit}
        onCancel={onCancelEdit}
        storeCategory={storeCategory}
        storeId={storeId}
      />
    );
  }

  const isMoving = movingProductId === product.id;

  return (
    <div className={`bg-background rounded-xl p-3 border border-border transition-all ${!product.is_available ? "opacity-50" : ""} ${isMoving ? "ring-2 ring-primary" : ""}`}>
      <div className="flex items-start gap-3">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
        ) : (
          <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
            <Package className="h-5 w-5 text-muted-foreground/50" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-foreground truncate">{product.name}</h4>
          {product.description && <p className="text-xs text-muted-foreground line-clamp-1">{product.description}</p>}
          <div className="flex items-center justify-between mt-1">
            <span className="text-sm font-black text-primary">R$ {Number(product.price).toFixed(2)}</span>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <button onClick={() => setMovingProductId(isMoving ? null : product.id)} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Mover para outra seção">
                <ArrowRightLeft className={`h-3.5 w-3.5 ${isMoving ? "text-primary" : "text-muted-foreground"}`} />
              </button>
              <button onClick={onToggle} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title={product.is_available ? "Pausar" : "Reativar"}>
                {product.is_available ? <Pause className="h-3.5 w-3.5 text-yellow-500" /> : <Play className="h-3.5 w-3.5 text-primary" />}
              </button>
              <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Editar">
                <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors" title="Excluir">
                <Trash2 className="h-3.5 w-3.5 text-destructive/70" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Move to section picker */}
      {isMoving && sections && sections.length > 0 && (
        <div className="mt-3 bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-1.5">
          <p className="text-xs font-bold text-primary">Mover para:</p>
          <div className="flex flex-wrap gap-1.5">
            {product.section_id && (
              <button
                onClick={() => onMoveProduct(product.id, null)}
                className="text-xs bg-muted text-muted-foreground px-3 py-1.5 rounded-lg hover:bg-muted/80 transition-colors"
              >
                Sem Seção
              </button>
            )}
            {sections
              .filter((s: any) => s.id !== product.section_id)
              .map((s: any) => (
                <button
                  key={s.id}
                  onClick={() => onMoveProduct(product.id, s.id)}
                  className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors font-medium"
                >
                  {s.name}
                </button>
              ))}
          </div>
          <button onClick={() => setMovingProductId(null)} className="text-xs text-muted-foreground hover:text-foreground mt-1">
            Cancelar
          </button>
        </div>
      )}

      {/* Linked addon groups */}
      {linkedGroups && linkedGroups.length > 0 && (
        <div className="mt-2 pl-2 border-l-2 border-primary/30 space-y-1">
          <span className="text-[10px] text-primary font-bold uppercase">🔗 Vinculados</span>
          {linkedGroups.map((group: any) => (
            <div key={group.id} className="text-xs">
              <div className="flex items-center justify-between">
                <span className="text-foreground/80 font-bold">{group.name}</span>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground/70">{group.min_select > 0 ? `mín ${group.min_select}` : "opcional"}, máx {group.max_select}</span>
                  <button onClick={() => onUnlinkGroup(group.id)} className="text-yellow-500 p-0.5"><X className="h-3 w-3" /></button>
                </div>
              </div>
              {group.addon_items?.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between pl-2 py-0.5">
                  <span className="text-muted-foreground">{item.name}</span>
                  <span className="text-muted-foreground/70">+R$ {Number(item.price).toFixed(2)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Direct addon groups */}
      {addonGroups.length > 0 && (
        <div className="mt-2 pl-2 border-l-2 border-border space-y-1">
          {addonGroups.map((group: any) => (
            <div key={group.id} className="text-xs">
              <div className="flex items-center justify-between">
                <span className="text-foreground/80 font-bold">{group.name}</span>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground/70">{group.min_select > 0 ? `mín ${group.min_select}` : "opcional"}, máx {group.max_select}</span>
                  <button onClick={() => onDeleteAddonGroup(group.id)} className="text-destructive/70 p-0.5"><Trash2 className="h-3 w-3" /></button>
                </div>
              </div>
              {group.addon_items?.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between pl-2 py-0.5">
                  <span className="text-muted-foreground">{item.name}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground/70">+R$ {Number(item.price).toFixed(2)}</span>
                    <button onClick={() => onDeleteAddonItem?.(item.id)} className="text-destructive/70 p-0.5"><X className="h-2.5 w-2.5" /></button>
                  </div>
                </div>
              ))}
              {showAddonItemForm === group.id ? (
                <div className="flex gap-1 mt-1">
                  <input type="text" placeholder="Nome" value={addonItemForm.name}
                    onChange={(e: any) => setAddonItemForm({ ...addonItemForm, name: e.target.value })}
                    className="flex-1 bg-muted text-foreground px-2 py-1 rounded text-xs border border-border focus:outline-none" autoFocus />
                  <input type="number" placeholder="R$" value={addonItemForm.price}
                    onChange={(e: any) => setAddonItemForm({ ...addonItemForm, price: e.target.value })}
                    className="w-16 bg-muted text-foreground px-2 py-1 rounded text-xs border border-border focus:outline-none" step="0.50" />
                  <button onClick={() => onAddAddonItem(group.id)} className="bg-primary text-primary-foreground px-2 py-1 rounded text-xs font-bold">+</button>
                  <button onClick={() => setShowAddonItemForm(null)} className="text-muted-foreground px-1 text-xs">✕</button>
                </div>
              ) : (
                <button onClick={() => setShowAddonItemForm(group.id)} className="text-primary text-xs mt-0.5 hover:underline">+ adicional</button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Link / Create addon */}
      {showLinkAddon === product.id ? (
        <div className="mt-2 bg-primary/5 border border-primary/20 rounded-lg p-2 space-y-1">
          <p className="text-xs text-primary font-bold">🔗 Vincular Grupo</p>
          {storeAddonGroups.filter((g: any) => !linkedGroupIds.includes(g.id)).length > 0 ? (
            storeAddonGroups.filter((g: any) => !linkedGroupIds.includes(g.id)).map((g: any) => (
              <button key={g.id} onClick={() => { onLinkGroup(g.id); setShowLinkAddon(null); }}
                className="w-full text-left bg-background hover:bg-muted text-foreground px-3 py-2 rounded-lg text-xs transition-colors border border-border">
                <span className="font-bold">{g.name}</span>
                <span className="text-muted-foreground ml-2">({(g.addon_items as any[])?.length || 0} itens)</span>
              </button>
            ))
          ) : (
            <p className="text-xs text-muted-foreground py-2">Nenhum grupo disponível. Crie na aba "Adicionais".</p>
          )}
          <button onClick={() => setShowLinkAddon(null)} className="text-muted-foreground text-xs">Cancelar</button>
        </div>
      ) : null}

      {/* Action row */}
      <div className="mt-2 flex gap-3">
        <button onClick={() => setShowLinkAddon(product.id)} className="text-xs text-primary hover:underline flex items-center gap-1">
          <Link2 className="h-3 w-3" /> Vincular
        </button>
        {showAddonForm === product.id ? (
          <div className="flex-1 bg-muted/30 rounded-lg p-2 space-y-1">
            <input type="text" placeholder="Nome do grupo (ex: Molhos)" value={addonGroupForm.name}
              onChange={(e) => setAddonGroupForm({ ...addonGroupForm, name: e.target.value })}
              className="w-full bg-background text-foreground px-2 py-1.5 rounded text-xs border border-border focus:outline-none" autoFocus />
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground">Mín</label>
                <input type="number" value={addonGroupForm.min_select}
                  onChange={(e) => setAddonGroupForm({ ...addonGroupForm, min_select: e.target.value })}
                  className="w-full bg-background text-foreground px-2 py-1 rounded text-xs border border-border" />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground">Máx</label>
                <input type="number" value={addonGroupForm.max_select}
                  onChange={(e) => setAddonGroupForm({ ...addonGroupForm, max_select: e.target.value })}
                  className="w-full bg-background text-foreground px-2 py-1 rounded text-xs border border-border" />
              </div>
            </div>
            <div className="flex gap-1">
              <button onClick={onAddAddonGroup} className="flex-1 bg-primary text-primary-foreground py-1.5 rounded text-xs font-bold">Criar</button>
              <button onClick={() => setShowAddonForm(null)} className="px-3 text-muted-foreground text-xs">Cancelar</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowAddonForm(product.id)} className="text-xs text-muted-foreground hover:underline">+ Grupo Direto</button>
        )}
      </div>
    </div>
  );
};

export default MenuBuilder;
