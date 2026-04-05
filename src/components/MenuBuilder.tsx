import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Plus, Trash2, Edit2, ChevronDown, ChevronUp, GripVertical,
  Image as ImageIcon, Pause, Play, Package, Save, X, Link2, Upload, Loader2
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

  // Fetch menu sections
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

  // Fetch products
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

  // Fetch addon groups for all products (direct product-level groups)
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

  // Fetch store-level addon groups (for linking)
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

  // Fetch product-addon links
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
      if (error.code === "23505") { toast.info("Grupo já vinculado a este produto"); return; }
      toast.error("Erro ao vincular grupo");
      return;
    }
    toast.success("Grupo vinculado ao produto!");
    invalidateAll();
  };

  const unlinkAddonGroup = async (productId: string, addonGroupId: string) => {
    const { error } = await supabase
      .from("product_addon_groups")
      .delete()
      .eq("product_id", productId)
      .eq("addon_group_id", addonGroupId);
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
    const { error } = await supabase.from("menu_sections").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir seção"); return; }
    toast.success("Seção excluída!");
    invalidateAll();
  };

  // Product CRUD
  const addProduct = async (sectionId: string | null) => {
    if (!productForm.name.trim() || !productForm.price) return;
    const { error } = await supabase.from("products").insert({
      store_id: storeId,
      section_id: sectionId,
      name: productForm.name.trim(),
      price: parseFloat(productForm.price),
      description: productForm.description.trim() || null,
      image_url: productForm.image_url.trim() || null,
      metadata: productForm.metadata || {},
    } as any);
    if (error) { toast.error("Erro ao adicionar produto"); return; }
    toast.success("Produto adicionado!");
    setProductForm({ name: "", price: "", description: "", image_url: "", metadata: {} });
    setShowProductForm(null);
    invalidateAll();
  };

  const updateProduct = async (id: string) => {
    const { error } = await supabase.from("products").update({
      name: productForm.name.trim(),
      price: parseFloat(productForm.price),
      description: productForm.description.trim() || null,
      image_url: productForm.image_url.trim() || null,
      metadata: productForm.metadata || {},
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
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Produto excluído!");
    invalidateAll();
  };

  // Addon Group CRUD
  const addAddonGroup = async (productId: string) => {
    if (!addonGroupForm.name.trim()) return;
    const { error } = await supabase.from("addon_groups").insert({
      product_id: productId,
      name: addonGroupForm.name.trim(),
      min_select: parseInt(addonGroupForm.min_select),
      max_select: parseInt(addonGroupForm.max_select),
    } as any);
    if (error) { toast.error("Erro ao criar grupo"); return; }
    toast.success("Grupo de adicionais criado!");
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

  // Addon Item CRUD
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

  // Drag and drop reorder sections
  const handleSectionDrop = async (targetId: string) => {
    if (!draggedSectionId || draggedSectionId === targetId || !sections) return;
    const items = [...sections];
    const fromIdx = items.findIndex((s: any) => s.id === draggedSectionId);
    const toIdx = items.findIndex((s: any) => s.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = items.splice(fromIdx, 1);
    items.splice(toIdx, 0, moved);
    // Optimistic update
    queryClient.setQueryData(["menu-sections", storeId], items.map((s: any, i: number) => ({ ...s, sort_order: i })));
    setDraggedSectionId(null);
    setDragOverSectionId(null);
    // Persist
    const updates = items.map((s: any, i: number) =>
      supabase.from("menu_sections").update({ sort_order: i } as any).eq("id", s.id)
    );
    const results = await Promise.all(updates);
    if (results.some(r => r.error)) {
      toast.error("Erro ao salvar ordem");
      invalidateAll();
    } else {
      toast.success("Ordem das seções salva!");
    }
  };

  return (
    <div className="space-y-4">
      {/* Add Section Button */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-foreground/80 uppercase tracking-wider">Cardápio</h2>
        <button
          onClick={() => setShowAddSection(true)}
          className="flex items-center gap-1.5 bg-primary/20 text-primary px-3 py-2 rounded-xl text-xs font-bold"
        >
          <Plus className="h-3.5 w-3.5" /> Nova Seção
        </button>
      </div>

      {/* Add Section Form */}
      {showAddSection && (
        <div className="bg-card rounded-xl p-3 flex gap-2">
          <input
            type="text"
            placeholder="Nome da seção (ex: Bebidas)"
            value={newSectionName}
            onChange={(e) => setNewSectionName(e.target.value)}
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
          className={`bg-card rounded-2xl overflow-hidden transition-all ${
            dragOverSectionId === section.id ? "ring-2 ring-primary scale-[1.01]" : ""
          } ${draggedSectionId === section.id ? "opacity-50" : ""}`}
          draggable
          onDragStart={(e) => {
            setDraggedSectionId(section.id);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            setDragOverSectionId(section.id);
          }}
          onDragLeave={() => setDragOverSectionId(null)}
          onDrop={(e) => {
            e.preventDefault();
            handleSectionDrop(section.id);
          }}
          onDragEnd={() => { setDraggedSectionId(null); setDragOverSectionId(null); }}
        >
          {/* Section Header */}
          <div
            className="flex items-center justify-between p-4 cursor-pointer"
            onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
          >
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab active:cursor-grabbing" />
              {editingSection === section.id ? (
                <input
                  type="text"
                  defaultValue={section.name}
                  onBlur={(e) => updateSection(section.id, e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && updateSection(section.id, (e.target as HTMLInputElement).value)}
                  className="bg-secondary text-foreground px-2 py-1 rounded text-sm border border-primary focus:outline-none"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="font-bold text-sm text-foreground">{section.name}</span>
              )}
              <span className="text-xs text-muted-foreground/70">({getProductsBySection(section.id).length} itens)</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); setEditingSection(section.id); }}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); deleteSection(section.id); }}
                className="text-red-400 hover:text-red-300 p-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              {expandedSection === section.id ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>

          {/* Section Products */}
          {expandedSection === section.id && (
            <div className="px-4 pb-4 space-y-2">
              {getProductsBySection(section.id).map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
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
                />
              ))}

              {/* Add product to section */}
              {showProductForm === section.id ? (
                <ProductFormInline
                  form={productForm}
                  setForm={setProductForm}
                  onSave={() => addProduct(section.id)}
                  onCancel={() => { setShowProductForm(null); setProductForm({ name: "", price: "", description: "", image_url: "", metadata: {} }); }}
                  storeCategory={storeCategory}
                />
              ) : (
                <button
                  onClick={() => setShowProductForm(section.id)}
                  className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-border rounded-xl text-muted-foreground hover:text-foreground hover:border-border transition-colors text-sm"
                >
                  <Plus className="h-4 w-4" /> Adicionar Item
                </button>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Unsectioned Products */}
      {unsectionedProducts.length > 0 && (
        <div className="bg-card rounded-2xl p-4 space-y-2">
          <h3 className="text-sm font-bold text-muted-foreground mb-2">Sem Seção</h3>
          {unsectionedProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
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
            />
          ))}
        </div>
      )}

      {/* Add product without section */}
      {showProductForm === "__none__" ? (
        <ProductFormInline
          form={productForm}
          setForm={setProductForm}
          onSave={() => addProduct(null)}
          onCancel={() => { setShowProductForm(null); setProductForm({ name: "", price: "", description: "", image_url: "", metadata: {} }); }}
          storeCategory={storeCategory}
        />
      ) : (
        <button
          onClick={() => setShowProductForm("__none__")}
          className="w-full flex items-center justify-center gap-2 py-3 bg-card rounded-xl text-muted-foreground hover:text-foreground transition-colors text-sm font-bold"
        >
          <Plus className="h-4 w-4" /> Adicionar Produto Avulso
        </button>
      )}
    </div>
  );
};

// Helper: upload image to store-assets bucket
const uploadProductImage = async (file: File): Promise<string | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { toast.error("Faça login primeiro"); return null; }

  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const allowed = ["png", "jpg", "jpeg", "webp"];
  if (!allowed.includes(ext)) { toast.error("Formato inválido. Use PNG, JPG ou WEBP."); return null; }
  if (file.size > 5 * 1024 * 1024) { toast.error("Imagem muito grande (máx 5MB)"); return null; }

  const filePath = `${user.id}/products/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("store-assets").upload(filePath, file, { upsert: true });
  if (error) { toast.error("Erro ao enviar imagem"); console.error(error); return null; }

  const { data: urlData } = supabase.storage.from("store-assets").getPublicUrl(filePath);
  return urlData.publicUrl;
};

// Product Form Inline
const ProductFormInline = ({
  form,
  setForm,
  onSave,
  onCancel,
  storeCategory,
}: {
  form: { name: string; price: string; description: string; image_url: string; metadata: Record<string, any> };
  setForm: (f: any) => void;
  onSave: () => void;
  onCancel: () => void;
  storeCategory?: string;
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

  return (
    <div className="bg-secondary rounded-xl p-3 space-y-2">
      <input
        type="text"
        placeholder="Nome do produto *"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        className="w-full bg-muted text-foreground px-3 py-2 rounded-lg text-sm border border-border focus:border-primary focus:outline-none"
        autoFocus
      />
      <div className="flex gap-2">
        <input
          type="number"
          placeholder="Preço *"
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
          className="w-1/3 bg-muted text-foreground px-3 py-2 rounded-lg text-sm border border-border focus:border-primary focus:outline-none"
          inputMode="decimal"
          step="0.01"
        />
        <div className="flex-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />
          {form.image_url ? (
            <div className="flex items-center gap-2">
              <img src={form.image_url} alt="Preview" className="w-10 h-10 rounded-lg object-cover border border-border" />
              <button
                onClick={() => setForm({ ...form, image_url: "" })}
                className="text-red-400 text-xs hover:underline"
              >
                Remover
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-primary text-xs hover:underline"
              >
                Trocar
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full flex items-center justify-center gap-2 bg-muted text-foreground/80 px-3 py-2 rounded-lg text-sm border border-dashed border-border hover:border-primary hover:text-primary transition-colors"
            >
              {uploading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
              ) : (
                <><Upload className="h-4 w-4" /> Foto do produto</>
              )}
            </button>
          )}
        </div>
      </div>
      <input
        type="text"
        placeholder="Descrição (opcional)"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        className="w-full bg-muted text-foreground px-3 py-2 rounded-lg text-sm border border-border focus:border-primary focus:outline-none"
      />

      {/* Category-specific fields */}
      {storeCategory && (
        <CategoryProductFields
          category={storeCategory}
          metadata={form.metadata || {}}
          onChange={(metadata) => setForm({ ...form, metadata })}
        />
      )}

      <div className="flex gap-2">
        <button onClick={onSave} className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg text-sm font-bold">
          Salvar
        </button>
        <button onClick={onCancel} className="px-4 py-2 text-muted-foreground text-sm">
          Cancelar
        </button>
      </div>
    </div>
  );
};

// Product Card
const ProductCard = ({
  product,
  addonGroups,
  linkedGroups,
  storeAddonGroups,
  linkedGroupIds,
  onLinkGroup,
  onUnlinkGroup,
  showLinkAddon,
  setShowLinkAddon,
  onToggle,
  onDelete,
  onEdit,
  isEditing,
  productForm,
  setProductForm,
  onSaveEdit,
  onCancelEdit,
  showAddonForm,
  setShowAddonForm,
  addonGroupForm,
  setAddonGroupForm,
  onAddAddonGroup,
  onDeleteAddonGroup,
  showAddonItemForm,
  setShowAddonItemForm,
  addonItemForm,
  setAddonItemForm,
  onAddAddonItem,
  onDeleteAddonItem,
  storeCategory,
}: any) => {
  if (isEditing) {
    return (
      <ProductFormInline
        form={productForm}
        setForm={setProductForm}
        onSave={onSaveEdit}
        onCancel={onCancelEdit}
        storeCategory={storeCategory}
      />
    );
  }

  return (
    <div className={`bg-muted/50 rounded-xl p-3 ${!product.is_available ? "opacity-50" : ""}`}>
      <div className="flex items-start gap-3">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
        ) : (
          <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
            <Package className="h-5 w-5 text-muted-foreground/70" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="text-sm font-bold text-foreground truncate">{product.name}</h4>
              {product.description && (
                <p className="text-xs text-muted-foreground line-clamp-1">{product.description}</p>
              )}
              <span className="text-sm font-black text-primary">R$ {Number(product.price).toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-1 ml-2">
              <button onClick={onToggle} className="p-1.5 rounded-lg hover:bg-muted" title={product.is_available ? "Pausar" : "Reativar"}>
                {product.is_available ? (
                  <Pause className="h-3.5 w-3.5 text-yellow-400" />
                ) : (
                  <Play className="h-3.5 w-3.5 text-primary" />
                )}
              </button>
              <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-muted">
                <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-muted">
                <Trash2 className="h-3.5 w-3.5 text-red-400" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Linked Store-Level Addon Groups */}
      {linkedGroups && linkedGroups.length > 0 && (
        <div className="mt-2 pl-2 border-l-2 border-primary/40 space-y-1">
          <span className="text-[10px] text-primary font-bold uppercase">🔗 Grupos Vinculados</span>
          {linkedGroups.map((group: any) => (
            <div key={group.id} className="text-xs">
              <div className="flex items-center justify-between">
                <span className="text-foreground/80 font-bold">{group.name}</span>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground/70">
                    {group.min_select > 0 ? `mín ${group.min_select}` : "opcional"}, máx {group.max_select}
                  </span>
                  <button onClick={() => onUnlinkGroup(group.id)} className="text-yellow-400 p-0.5" title="Desvincular">
                    <X className="h-3 w-3" />
                  </button>
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

      {/* Direct Addon Groups */}
      {addonGroups.length > 0 && (
        <div className="mt-2 pl-2 border-l-2 border-border space-y-1">
          {addonGroups.map((group: any) => (
            <div key={group.id} className="text-xs">
              <div className="flex items-center justify-between">
                <span className="text-foreground/80 font-bold">{group.name}</span>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground/70">
                    {group.min_select > 0 ? `mín ${group.min_select}` : "opcional"}, máx {group.max_select}
                  </span>
                  <button onClick={() => onDeleteAddonGroup(group.id)} className="text-red-400 p-0.5">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
              {group.addon_items?.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between pl-2 py-0.5">
                  <span className="text-muted-foreground">{item.name}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground/70">+R$ {Number(item.price).toFixed(2)}</span>
                    <button onClick={() => onDeleteAddonItem(item.id)} className="text-red-400 p-0.5">
                      <X className="h-2.5 w-2.5" />
                    </button>
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

      {/* Link Store Addon Group */}
      {showLinkAddon === product.id ? (
        <div className="mt-2 bg-primary/10 border border-primary/30 rounded-lg p-2 space-y-1">
          <p className="text-xs text-primary font-bold">🔗 Vincular Grupo de Adicionais</p>
          {storeAddonGroups.filter((g: any) => !linkedGroupIds.includes(g.id)).length > 0 ? (
            storeAddonGroups.filter((g: any) => !linkedGroupIds.includes(g.id)).map((g: any) => (
              <button
                key={g.id}
                onClick={() => { onLinkGroup(g.id); setShowLinkAddon(null); }}
                className="w-full text-left bg-secondary hover:bg-muted text-foreground px-3 py-2 rounded-lg text-xs transition-colors"
              >
                <span className="font-bold">{g.name}</span>
                <span className="text-muted-foreground ml-2">({(g.addon_items as any[])?.length || 0} itens)</span>
              </button>
            ))
          ) : (
            <p className="text-xs text-muted-foreground py-2">
              Nenhum grupo disponível. Crie grupos na aba "Adicionais".
            </p>
          )}
          <button onClick={() => setShowLinkAddon(null)} className="text-muted-foreground text-xs">Cancelar</button>
        </div>
      ) : null}

      {/* Action buttons */}
      <div className="mt-2 flex gap-2">
        <button onClick={() => setShowLinkAddon(product.id)} className="text-xs text-primary hover:underline flex items-center gap-1">
          <Link2 className="h-3 w-3" /> Vincular Grupo
        </button>
        {showAddonForm === product.id ? (
          <div className="flex-1 bg-muted/30 rounded-lg p-2 space-y-1">
            <input type="text" placeholder="Nome do grupo (ex: Molhos)" value={addonGroupForm.name}
              onChange={(e) => setAddonGroupForm({ ...addonGroupForm, name: e.target.value })}
              className="w-full bg-muted text-foreground px-2 py-1.5 rounded text-xs border border-border focus:outline-none" autoFocus />
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground/70">Mín</label>
                <input type="number" value={addonGroupForm.min_select}
                  onChange={(e) => setAddonGroupForm({ ...addonGroupForm, min_select: e.target.value })}
                  className="w-full bg-muted text-foreground px-2 py-1 rounded text-xs border border-border" />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground/70">Máx</label>
                <input type="number" value={addonGroupForm.max_select}
                  onChange={(e) => setAddonGroupForm({ ...addonGroupForm, max_select: e.target.value })}
                  className="w-full bg-muted text-foreground px-2 py-1 rounded text-xs border border-border" />
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
