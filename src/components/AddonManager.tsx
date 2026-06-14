import { formatBRL } from "@/lib/utils";
import { useState, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, Save, X, ChevronDown, ChevronUp, Package, FileText, Layers, Link2, Sparkles, Copy, Eye, Search } from "lucide-react";
import { formatBRLDisplay, parseBRLCentsInput } from "@/hooks/useBRLInput";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";

interface AddonManagerProps {
  storeId: string;
}

const AddonManager = ({ storeId }: AddonManagerProps) => {
  const queryClient = useQueryClient();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [groupForm, setGroupForm] = useState({ name: "", min_select: "0", max_select: "1", price_replaces_base: false });
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [editGroupForm, setEditGroupForm] = useState({ name: "", min_select: "0", max_select: "1", price_replaces_base: false });
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState({ name: "", price: "0" });
  const [showItemForm, setShowItemForm] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editItemForm, setEditItemForm] = useState({ name: "", price: "0" });
  const [bulkGroupId, setBulkGroupId] = useState<string | null>(null);
  const [bulkText, setBulkText] = useState("");
  const [bulkParsed, setBulkParsed] = useState<{ name: string; price: number }[]>([]);
  const [linkModalGroupId, setLinkModalGroupId] = useState<string | null>(null);
  const [linkSelected, setLinkSelected] = useState<Set<string>>(new Set());
  const [linkSearch, setLinkSearch] = useState("");
  const [linkSaving, setLinkSaving] = useState(false);
  const [previewGroupId, setPreviewGroupId] = useState<string | null>(null);

  // Fetch all store products for the link modal
  const { data: storeProducts } = useQuery({
    queryKey: ["store-products-for-addons", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, image_url, price")
        .eq("store_id", storeId)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch store-level addon groups (product_id IS NULL)
  const { data: groups, isLoading } = useQuery({
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

  // Count linked products per group
  const groupIds = groups?.map(g => g.id) || [];
  const { data: links } = useQuery({
    queryKey: ["addon-group-links", groupIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_addon_groups")
        .select("addon_group_id, product_id, products(name)")
        .in("addon_group_id", groupIds);
      if (error) throw error;
      return data || [];
    },
    enabled: groupIds.length > 0,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["store-addon-groups", storeId] });
    queryClient.invalidateQueries({ queryKey: ["addon-group-links"] });
  };

  const moveItem = async (group: any, itemId: string, direction: -1 | 1) => {
    const sorted = [...(group.addon_items as any[])].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((it) => it.id === itemId);
    const target = idx + direction;
    if (idx < 0 || target < 0 || target >= sorted.length) return;
    [sorted[idx], sorted[target]] = [sorted[target], sorted[idx]];
    // Reassign sort_order sequentially
    const updates = sorted.map((it, i) => ({ id: it.id, sort_order: i + 1 }));
    // Optimistic update
    queryClient.setQueryData(["store-addon-groups", storeId], (old: any) =>
      (old || []).map((g: any) =>
        g.id === group.id
          ? { ...g, addon_items: updates.map((u) => ({ ...sorted.find((s) => s.id === u.id), sort_order: u.sort_order })) }
          : g
      )
    );
    await Promise.all(
      updates.map((u) => supabase.from("addon_items").update({ sort_order: u.sort_order } as any).eq("id", u.id))
    );
    invalidate();
  };

  const addGroup = async () => {
    if (!groupForm.name.trim()) return;
    const { data: newGroup, error } = await supabase.from("addon_groups").insert({
      store_id: storeId,
      product_id: null,
      name: groupForm.name.trim(),
      min_select: parseInt(groupForm.min_select) || 0,
      max_select: parseInt(groupForm.max_select) || 1,
      price_replaces_base: groupForm.price_replaces_base,
      sort_order: (groups?.length || 0) + 1,
    } as any).select("id").single();
    if (error) { toast.error("Erro ao criar grupo"); return; }

    // If bulk items were parsed, insert them too
    if (newGroup && bulkParsed.length > 0) {
      const inserts = bulkParsed.map((item, i) => ({
        group_id: newGroup.id,
        name: item.name.trim(),
        price: item.price,
        sort_order: i + 1,
      }));
      const { error: itemsErr } = await supabase.from("addon_items").insert(inserts as any);
      if (itemsErr) { toast.error("Grupo criado, mas erro ao importar itens"); }
      else { toast.success(`Grupo criado com ${bulkParsed.length} adicionais!`); }
    } else {
      toast.success("Grupo de adicionais criado!");
    }

    setGroupForm({ name: "", min_select: "0", max_select: "1", price_replaces_base: false });
    setBulkText("");
    setBulkParsed([]);
    setShowGroupForm(false);
    invalidate();
  };

  const updateGroup = async (id: string) => {
    const { error } = await supabase.from("addon_groups").update({
      name: editGroupForm.name.trim(),
      min_select: parseInt(editGroupForm.min_select) || 0,
      max_select: parseInt(editGroupForm.max_select) || 1,
      price_replaces_base: editGroupForm.price_replaces_base,
    } as any).eq("id", id);
    if (error) { toast.error("Erro ao atualizar grupo"); return; }
    toast.success("Grupo atualizado! Alterações refletem em todos os produtos vinculados.");
    setEditingGroup(null);
    invalidate();
  };

  const deleteGroup = async (id: string) => {
    const { error } = await supabase.from("addon_groups").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir grupo"); return; }
    toast.success("Grupo excluído!");
    invalidate();
  };

  const AddonPriceInput = ({ value, onChange, placeholder }: { value: string, onChange: (v: string) => void, placeholder?: string }) => {
    const [display, setDisplay] = useState(value && parseFloat(value) > 0 ? formatBRLDisplay(parseFloat(value)) : "");
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      if (!raw.replace(/\D/g, "")) {
        setDisplay("");
        onChange("0");
        return;
      }
      const n = parseBRLCentsInput(raw);
      setDisplay(formatBRLDisplay(n));
      onChange(n.toFixed(2));
    };

    return (
      <div className="relative flex-1">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground/60">R$</span>
        <input
          type="text"
          inputMode="numeric"
          value={display}
          onChange={handleChange}
          placeholder={placeholder || "0,00"}
          className="w-full bg-secondary text-foreground pl-7 pr-2 py-2 rounded-lg text-xs border border-border focus:outline-none focus:border-primary"
        />
      </div>
    );
  };

  const addItem = async (groupId: string) => {
    if (!itemForm.name.trim()) return;
    const { error } = await supabase.from("addon_items").insert({
      group_id: groupId,
      name: itemForm.name.trim(),
      price: parseFloat(itemForm.price) || 0,
    } as any);
    if (error) { toast.error("Erro ao adicionar item"); return; }
    toast.success("Adicional criado!");
    setItemForm({ name: "", price: "0" });
    setShowItemForm(null);
    invalidate();
  };

  const updateItem = async (id: string) => {
    const { error } = await supabase.from("addon_items").update({
      name: editItemForm.name.trim(),
      price: parseFloat(editItemForm.price) || 0,
    } as any).eq("id", id);
    if (error) { toast.error("Erro ao atualizar"); return; }
    toast.success("Adicional atualizado!");
    setEditingItem(null);
    invalidate();
  };

  const deleteItem = async (id: string) => {
    const { error } = await supabase.from("addon_items").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Adicional excluído!");
    invalidate();
  };

  const getLinkedProducts = (groupId: string) =>
    (links as any[])?.filter((l: any) => l.addon_group_id === groupId) || [];

  const openLinkModal = (groupId: string) => {
    const current = new Set(getLinkedProducts(groupId).map((l: any) => l.product_id as string));
    setLinkSelected(current);
    setLinkSearch("");
    setLinkModalGroupId(groupId);
  };

  const saveLinks = async () => {
    if (!linkModalGroupId) return;
    setLinkSaving(true);
    try {
      const current = new Set(getLinkedProducts(linkModalGroupId).map((l: any) => l.product_id as string));
      const toAdd = [...linkSelected].filter((id) => !current.has(id));
      const toRemove = [...current].filter((id) => !linkSelected.has(id));

      if (toAdd.length > 0) {
        const { error } = await supabase.from("product_addon_groups").insert(
          toAdd.map((product_id) => ({
            product_id,
            addon_group_id: linkModalGroupId,
          })) as any,
        );
        if (error) throw error;
      }
      if (toRemove.length > 0) {
        const { error } = await supabase
          .from("product_addon_groups")
          .delete()
          .eq("addon_group_id", linkModalGroupId)
          .in("product_id", toRemove);
        if (error) throw error;
      }
      toast.success(`Vínculos atualizados (${linkSelected.size} ${linkSelected.size === 1 ? "produto" : "produtos"})`);
      setLinkModalGroupId(null);
      invalidate();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao atualizar vínculos");
    } finally {
      setLinkSaving(false);
    }
  };

  const duplicateGroup = async (group: any) => {
    const { data: newGroup, error } = await supabase
      .from("addon_groups")
      .insert({
        store_id: storeId,
        product_id: null,
        name: `${group.name} (cópia)`,
        min_select: group.min_select,
        max_select: group.max_select,
        price_replaces_base: group.price_replaces_base,
        sort_order: (groups?.length || 0) + 1,
      } as any)
      .select("id")
      .single();
    if (error || !newGroup) {
      toast.error("Erro ao duplicar grupo");
      return;
    }
    const items = (group.addon_items as any[]) || [];
    if (items.length > 0) {
      const inserts = items.map((it, i) => ({
        group_id: newGroup.id,
        name: it.name,
        price: it.price,
        sort_order: i + 1,
      }));
      const { error: itemsErr } = await supabase.from("addon_items").insert(inserts as any);
      if (itemsErr) {
        toast.error("Grupo duplicado, mas erro ao copiar itens");
        invalidate();
        return;
      }
    }
    toast.success(`Grupo duplicado com ${items.length} ${items.length === 1 ? "item" : "itens"}!`);
    invalidate();
  };

  const linkModalGroup = groups?.find((g: any) => g.id === linkModalGroupId);
  const previewGroup = groups?.find((g: any) => g.id === previewGroupId);
  const filteredProductsForLink = (storeProducts || []).filter((p: any) =>
    !linkSearch.trim() || (p.name || "").toLowerCase().includes(linkSearch.toLowerCase()),
  );

  // Bulk text parser
  const parseBulkText = (text: string) => {
    const lines = text.split("\n").filter(l => l.trim());
    return lines.map(line => {
      const cleaned = line.trim();
      // Match patterns: "Mostarda 2 reais", "Mostarda - R$ 2,00", "Mostarda 2.50", "Mostarda R$2", "Mostarda - 2"
      const priceMatch = cleaned.match(/[–\-]?\s*(?:R\$\s*)?(\d+(?:[.,]\d{1,2})?)\s*(?:reais|real|R\$|rs)?\s*$/i);
      if (priceMatch) {
        const priceStr = priceMatch[1].replace(",", ".");
        const price = parseFloat(priceStr) || 0;
        const name = cleaned.slice(0, cleaned.indexOf(priceMatch[0])).replace(/[\s\-–]+$/, "").trim();
        return { name: name || cleaned, price };
      }
      return { name: cleaned, price: 0 };
    }).filter(item => item.name.length > 0);
  };

  const handleBulkTextChange = (text: string) => {
    setBulkText(text);
    setBulkParsed(parseBulkText(text));
  };

  const saveBulkItems = async (groupId: string) => {
    if (bulkParsed.length === 0) return;
    const existingCount = (groups?.find(g => g.id === groupId)?.addon_items as any[])?.length || 0;
    const inserts = bulkParsed.map((item, i) => ({
      group_id: groupId,
      name: item.name.trim(),
      price: item.price,
      sort_order: existingCount + i + 1,
    }));
    const { error } = await supabase.from("addon_items").insert(inserts as any);
    if (error) { toast.error("Erro ao importar itens"); return; }
    toast.success(`${bulkParsed.length} adicionais importados!`);
    setBulkGroupId(null);
    setBulkText("");
    setBulkParsed([]);
    invalidate();
  };

  return (
    <div className="space-y-4">
      <ConfirmDialog />
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="bg-primary/15 text-primary rounded-xl p-2 flex-shrink-0">
            <Layers className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-foreground leading-tight">Adicionais</h2>
            <p className="text-xs text-foreground/70 mt-0.5">Crie grupos (ex: Molhos, Tamanhos) e vincule a produtos.</p>
          </div>
        </div>
        <button
          onClick={() => setShowGroupForm(true)}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap shadow-sm flex-shrink-0"
        >
          <Plus className="h-3.5 w-3.5" /> Novo grupo
        </button>
      </div>

      {/* Add Group Form */}
      {showGroupForm && (
        <div className="bg-card rounded-xl p-4 space-y-3">
          <input
            type="text"
            placeholder="Nome do grupo (ex: Extras de Hambúrguer)"
            value={groupForm.name}
            onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
            className="w-full bg-secondary text-foreground px-3 py-2.5 rounded-lg text-sm border border-border focus:border-primary focus:outline-none"
            autoFocus
          />
          {/* Toggle obrigatório */}
          <button
            type="button"
            onClick={() => setGroupForm({ ...groupForm, min_select: groupForm.min_select === "0" ? "1" : "0" })}
            className={`w-full flex items-center justify-between py-3 px-4 rounded-xl border-2 transition-all ${
              groupForm.min_select !== "0"
                ? "bg-primary/10 border-primary"
                : "bg-muted/50 border-transparent"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-foreground">
                {groupForm.min_select !== "0" ? "Obrigatório" : "Opcional"}
              </span>
              <span className="text-xs text-muted-foreground">
                {groupForm.min_select !== "0" ? "Cliente precisa selecionar" : "Cliente pode pular"}
              </span>
            </div>
            <div className={`w-11 h-6 rounded-full transition-colors relative ${groupForm.min_select !== "0" ? "bg-primary" : "bg-muted-foreground/30"}`}>
              <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow ${groupForm.min_select !== "0" ? "translate-x-5" : "translate-x-0.5"}`} />
            </div>
          </button>

          <div className="flex-1">
            <label className="text-xs text-muted-foreground/70 mb-1 block">Máximo de seleções</label>
            <input
              type="number"
              value={groupForm.max_select}
              onChange={(e) => setGroupForm({ ...groupForm, max_select: e.target.value })}
              className="w-full bg-secondary text-foreground px-3 py-2 rounded-lg text-sm border border-border focus:outline-none"
              min="1"
            />
          </div>

          {/* Toggle: Define preço final */}
          <button
            type="button"
            onClick={() => setGroupForm({ ...groupForm, price_replaces_base: !groupForm.price_replaces_base, min_select: !groupForm.price_replaces_base ? "1" : groupForm.min_select, max_select: !groupForm.price_replaces_base ? "1" : groupForm.max_select })}
            className={`w-full flex items-start justify-between gap-3 py-3 px-4 rounded-xl border-2 transition-all text-left ${
              groupForm.price_replaces_base ? "bg-primary/10 border-primary" : "bg-muted/50 border-transparent"
            }`}
          >
            <div className="flex-1">
              <div className="text-sm font-bold text-foreground">
                💰 Define o preço final?
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Use para tamanhos (200ml, 300ml). O preço escolhido <b>substitui</b> o preço base do produto. Vira obrigatório e seleção única.
              </div>
            </div>
            <div className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 mt-0.5 ${groupForm.price_replaces_base ? "bg-primary" : "bg-muted-foreground/30"}`}>
              <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow ${groupForm.price_replaces_base ? "translate-x-5" : "translate-x-0.5"}`} />
            </div>
          </button>

          {/* Bulk import inside group creation */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold text-primary">Cole sua lista de adicionais (opcional)</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Um item por linha. O preço é detectado automaticamente.
            </p>
            <div className="bg-muted/50 rounded-lg p-2 text-[10px] text-muted-foreground/80 font-mono space-y-0.5">
              <div>Mostarda 2 reais</div>
              <div>Molho verde R$ 5,00</div>
              <div>Bacon extra - 4</div>
            </div>
            <textarea
              value={bulkText}
              onChange={(e) => handleBulkTextChange(e.target.value)}
              placeholder="Cole sua lista aqui..."
              rows={4}
              className="w-full bg-muted text-foreground px-3 py-2 rounded-lg text-sm border border-border focus:border-primary focus:outline-none resize-none"
            />
            {bulkParsed.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-bold text-foreground/70">
                  ✅ {bulkParsed.length} {bulkParsed.length === 1 ? "item detectado" : "itens detectados"}:
                </p>
                <div className="max-h-28 overflow-y-auto space-y-1">
                  {bulkParsed.map((item, i) => (
                    <div key={i} className="flex justify-between bg-muted/50 rounded-lg px-3 py-1.5 text-xs">
                      <span className="text-foreground">{item.name}</span>
                      <span className="text-primary font-bold">
                        {item.price > 0 ? `+${formatBRL(item.price)}` : "Grátis"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button onClick={addGroup} className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-xl text-sm font-bold">
              {bulkParsed.length > 0 ? `Criar Grupo com ${bulkParsed.length} itens` : "Criar Grupo"}
            </button>
            <button onClick={() => { setShowGroupForm(false); setGroupForm({ name: "", min_select: "0", max_select: "1", price_replaces_base: false }); setBulkText(""); setBulkParsed([]); }} className="px-4 text-muted-foreground text-sm">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Groups List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="bg-card rounded-2xl p-4 animate-pulse space-y-2">
              <div className="h-4 bg-muted rounded w-1/2" />
              <div className="h-3 bg-muted rounded w-1/4" />
            </div>
          ))}
        </div>
      ) : groups && groups.length > 0 ? (
        groups.map((group: any) => {
          const linkedProducts = getLinkedProducts(group.id);
          const isExpanded = expandedGroup === group.id;

          return (
            <div key={group.id} className="bg-card rounded-2xl overflow-hidden">
              {/* Group Header */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer"
                onClick={() => setExpandedGroup(isExpanded ? null : group.id)}
              >
                <div className="flex-1">
                  {editingGroup === group.id ? (
                    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={editGroupForm.name}
                        onChange={(e) => setEditGroupForm({ ...editGroupForm, name: e.target.value })}
                        className="w-full bg-secondary text-foreground px-3 py-2 rounded-lg text-sm border border-primary focus:outline-none"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setEditGroupForm({ ...editGroupForm, min_select: editGroupForm.min_select === "0" ? "1" : "0" })}
                        className={`w-full flex items-center justify-between py-2 px-3 rounded-lg border transition-all text-left ${
                          editGroupForm.min_select !== "0" ? "bg-primary/10 border-primary" : "bg-muted/50 border-transparent"
                        }`}
                      >
                        <span className="text-xs font-bold text-foreground">
                          {editGroupForm.min_select !== "0" ? "Obrigatório" : "Opcional"}
                        </span>
                        <div className={`w-9 h-5 rounded-full transition-colors relative ${editGroupForm.min_select !== "0" ? "bg-primary" : "bg-muted-foreground/30"}`}>
                          <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform shadow ${editGroupForm.min_select !== "0" ? "translate-x-4" : "translate-x-0.5"}`} />
                        </div>
                      </button>
                      <div className="flex-1">
                        <label className="text-[10px] text-muted-foreground/70">Máx seleções</label>
                        <input
                          type="number"
                          value={editGroupForm.max_select}
                          onChange={(e) => setEditGroupForm({ ...editGroupForm, max_select: e.target.value })}
                          className="w-full bg-secondary text-foreground px-2 py-1 rounded text-xs border border-border"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditGroupForm({ ...editGroupForm, price_replaces_base: !editGroupForm.price_replaces_base, min_select: !editGroupForm.price_replaces_base ? "1" : editGroupForm.min_select, max_select: !editGroupForm.price_replaces_base ? "1" : editGroupForm.max_select })}
                        className={`w-full flex items-center justify-between py-2 px-3 rounded-lg border transition-all text-left ${
                          editGroupForm.price_replaces_base ? "bg-primary/10 border-primary" : "bg-muted/50 border-transparent"
                        }`}
                      >
                        <span className="text-xs font-bold text-foreground">
                          💰 Define preço final
                        </span>
                        <div className={`w-9 h-5 rounded-full transition-colors relative ${editGroupForm.price_replaces_base ? "bg-primary" : "bg-muted-foreground/30"}`}>
                          <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform shadow ${editGroupForm.price_replaces_base ? "translate-x-4" : "translate-x-0.5"}`} />
                        </div>
                      </button>
                      <div className="flex gap-1">
                        <button onClick={() => updateGroup(group.id)} className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-bold">
                          <Save className="h-3 w-3" />
                        </button>
                        <button onClick={() => setEditingGroup(null)} className="text-muted-foreground px-2 text-xs">Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-base text-foreground">{group.name}</h3>
                        {group.min_select > 0 ? (
                          <span className="text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                            Obrigatório
                          </span>
                        ) : (
                          <span className="text-[10px] bg-muted-foreground/80 text-background px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                            Opcional
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-foreground/70 mt-1">
                        Cliente escolhe {group.min_select > 0 ? `de ${group.min_select} a ${group.max_select}` : `até ${group.max_select}`}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <span className="inline-flex items-center gap-1 text-xs bg-muted text-foreground px-2 py-0.5 rounded-full font-semibold">
                          <Package className="h-3 w-3" />
                          {(group.addon_items as any[])?.length || 0} {((group.addon_items as any[])?.length || 0) === 1 ? "item" : "itens"}
                        </span>
                        {linkedProducts.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-semibold">
                            <Link2 className="h-3 w-3" />
                            {linkedProducts.length} produto{linkedProducts.length > 1 ? "s" : ""}
                          </span>
                        )}
                        {group.price_replaces_base && (
                          <span className="inline-flex items-center gap-1 text-xs bg-emerald-600 text-white px-2 py-0.5 rounded-full font-semibold">
                            💰 Define preço
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {editingGroup !== group.id && (
                  <div className="flex items-center gap-2 ml-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); setPreviewGroupId(group.id); }}
                      className="text-muted-foreground hover:text-foreground p-1.5"
                      title="Pré-visualizar como o cliente vê"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); openLinkModal(group.id); }}
                      className="text-muted-foreground hover:text-primary p-1.5"
                      title="Vincular a produtos em lote"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); duplicateGroup(group); }}
                      className="text-muted-foreground hover:text-foreground p-1.5"
                      title="Duplicar grupo"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingGroup(group.id);
                        setEditGroupForm({
                          name: group.name,
                          min_select: String(group.min_select),
                          max_select: String(group.max_select),
                          price_replaces_base: !!group.price_replaces_base,
                        });
                      }}
                      className="text-muted-foreground hover:text-foreground p-1.5"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                     <button
                       onClick={async (e) => {
                         e.stopPropagation();
                         const ok = await confirm({
                           title: "Excluir grupo de adicionais?",
                           description: `Tem certeza que deseja excluir "${group.name}"? Todos os itens deste grupo serão removidos e desvinculados dos produtos. Esta ação não pode ser desfeita.`,
                           confirmText: "Excluir",
                           variant: "destructive",
                         });
                         if (ok) deleteGroup(group.id);
                       }}
                      className="text-destructive/70 hover:text-destructive p-1.5"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                )}
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-2">
                  {/* Items */}
                  {(group.addon_items as any[])?.sort((a: any, b: any) => a.sort_order - b.sort_order).map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2.5">
                      {editingItem === item.id ? (
                        <div className="flex gap-2 flex-1" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editItemForm.name}
                            onChange={(e) => setEditItemForm({ ...editItemForm, name: e.target.value })}
                            className="flex-1 bg-muted text-foreground px-2 py-1 rounded text-sm border border-border focus:outline-none"
                            autoFocus
                          />
                          <AddonPriceInput
                            value={editItemForm.price}
                            onChange={(v) => setEditItemForm({ ...editItemForm, price: v })}
                            placeholder="0,00"
                          />
                          <button onClick={() => updateItem(item.id)} className="bg-primary text-primary-foreground px-2 py-1 rounded text-xs font-bold">
                            <Save className="h-3 w-3" />
                          </button>
                          <button onClick={() => setEditingItem(null)} className="text-muted-foreground px-1">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="text-sm text-foreground">{item.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-primary font-bold">
                              {item.price > 0 ? `+${formatBRL(Number(item.price))}` : "Grátis"}
                            </span>
                            <button
                              onClick={() => {
                                setEditingItem(item.id);
                                setEditItemForm({ name: item.name, price: String(item.price) });
                              }}
                              className="text-muted-foreground hover:text-foreground p-1"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                            <button
                              onClick={async () => {
                                const ok = await confirm({
                                  title: "Excluir adicional?",
                                  description: `Tem certeza que deseja excluir "${item.name}"? Esta ação não pode ser desfeita.`,
                                  confirmText: "Excluir",
                                  variant: "destructive",
                                });
                                if (ok) deleteItem(item.id);
                              }}
                              className="text-destructive/70 hover:text-destructive p-1"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}

                  {/* Add Item */}
                  {showItemForm === group.id ? (
                    <div className="flex gap-2 bg-muted/50 rounded-lg p-2">
                      <input
                        type="text"
                        placeholder="Nome do adicional"
                        value={itemForm.name}
                        onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                        className="flex-1 bg-muted text-foreground px-3 py-2 rounded-lg text-sm border border-border focus:outline-none"
                        autoFocus
                      />
                      <AddonPriceInput
                        value={itemForm.price}
                        onChange={(v) => setItemForm({ ...itemForm, price: v })}
                        placeholder="0,00"
                      />
                      <button onClick={() => addItem(group.id)} className="bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-bold">
                        <Plus className="h-4 w-4" />
                      </button>
                      <button onClick={() => { setShowItemForm(null); setItemForm({ name: "", price: "0" }); }} className="text-muted-foreground px-2">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowItemForm(group.id)}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-border rounded-xl text-muted-foreground hover:text-foreground hover:border-border transition-colors text-xs"
                      >
                        <Plus className="h-3.5 w-3.5" /> Adicionar Item
                      </button>
                      <button
                        onClick={() => { setBulkGroupId(group.id); setBulkText(""); setBulkParsed([]); }}
                        className="flex items-center gap-1.5 px-3 py-2.5 border-2 border-dashed border-primary/30 rounded-xl text-primary hover:bg-primary/10 transition-colors text-xs font-bold"
                      >
                        <FileText className="h-3.5 w-3.5" /> Importar Lista
                      </button>
                    </div>
                  )}

                  {/* Bulk Import */}
                  {bulkGroupId === group.id && (
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        <span className="text-xs font-bold text-primary">Importar adicionais em lote</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Cole uma lista com um item por linha. O sistema detecta o preço automaticamente.
                      </p>
                      <div className="bg-muted/50 rounded-lg p-2 text-[10px] text-muted-foreground/80 font-mono space-y-0.5">
                        <div>Mostarda 2 reais</div>
                        <div>Molho verde R$ 5,00</div>
                        <div>Bacon extra - 4</div>
                        <div>Cebola caramelizada 3.50</div>
                      </div>
                      <textarea
                        value={bulkText}
                        onChange={(e) => handleBulkTextChange(e.target.value)}
                        placeholder="Cole sua lista aqui..."
                        rows={5}
                        className="w-full bg-muted text-foreground px-3 py-2 rounded-lg text-sm border border-border focus:border-primary focus:outline-none resize-none"
                      />
                      {bulkParsed.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-foreground/70">
                            ✅ {bulkParsed.length} {bulkParsed.length === 1 ? "item detectado" : "itens detectados"}:
                          </p>
                          <div className="max-h-32 overflow-y-auto space-y-1">
                            {bulkParsed.map((item, i) => (
                              <div key={i} className="flex justify-between bg-muted/50 rounded-lg px-3 py-1.5 text-xs">
                                <span className="text-foreground">{item.name}</span>
                                <span className="text-primary font-bold">
                                  {item.price > 0 ? `+${formatBRL(item.price)}` : "Grátis"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveBulkItems(group.id)}
                          disabled={bulkParsed.length === 0}
                          className="flex-1 bg-primary text-primary-foreground py-2.5 rounded-xl text-sm font-bold disabled:opacity-40"
                        >
                          Importar {bulkParsed.length} {bulkParsed.length === 1 ? "item" : "itens"}
                        </button>
                        <button
                          onClick={() => { setBulkGroupId(null); setBulkText(""); setBulkParsed([]); }}
                          className="px-4 text-muted-foreground text-sm"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Linked Products */}
                  {linkedProducts.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-xs text-muted-foreground/70 font-bold mb-1.5">🔗 Vinculado a:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {linkedProducts.map((link: any) => (
                          <span key={link.product_id} className="text-xs bg-muted text-foreground/80 px-2 py-1 rounded-lg">
                            {(link.products as any)?.name || "Produto"}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      ) : (
        <div className="bg-card rounded-2xl p-6 text-center border border-dashed border-border">
          <div className="text-4xl mb-3">🧀</div>
          <h3 className="text-base font-bold text-foreground mb-1">Crie seu primeiro grupo de adicionais</h3>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto mb-4">
            Grupos são opções que o cliente escolhe no produto: <b>Molhos</b>, <b>Tamanhos</b>, <b>Extras</b>, <b>Bordas</b>…
          </p>
          <div className="text-left bg-muted/40 rounded-xl p-3 mb-4 space-y-2 max-w-xs mx-auto">
            <div className="flex gap-2 text-xs"><span className="font-bold text-primary">1.</span><span>Crie um grupo (ex: "Molhos")</span></div>
            <div className="flex gap-2 text-xs"><span className="font-bold text-primary">2.</span><span>Adicione os itens e preços</span></div>
            <div className="flex gap-2 text-xs"><span className="font-bold text-primary">3.</span><span>Vincule aos produtos no Cardápio</span></div>
          </div>
          <button
            onClick={() => setShowGroupForm(true)}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm"
          >
            <Sparkles className="h-4 w-4" /> Criar primeiro grupo
          </button>
        </div>
      )}

      {/* Link Products Modal */}
      {linkModalGroupId && linkModalGroup && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => !linkSaving && setLinkModalGroupId(null)}>
          <div className="bg-card w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-foreground truncate">Vincular "{linkModalGroup.name}"</h3>
                  <p className="text-xs text-muted-foreground">Marque os produtos que devem usar este grupo.</p>
                </div>
                <button onClick={() => setLinkModalGroupId(null)} className="text-muted-foreground p-1"><X className="h-5 w-5" /></button>
              </div>
              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={linkSearch}
                  onChange={(e) => setLinkSearch(e.target.value)}
                  placeholder="Buscar produto..."
                  className="w-full bg-secondary text-foreground pl-9 pr-3 py-2 rounded-lg text-sm border border-border focus:outline-none focus:border-primary"
                />
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setLinkSelected(new Set(filteredProductsForLink.map((p: any) => p.id)))}
                  className="text-xs text-primary font-bold"
                >Marcar todos {linkSearch ? "filtrados" : ""}</button>
                <span className="text-muted-foreground text-xs">·</span>
                <button onClick={() => setLinkSelected(new Set())} className="text-xs text-muted-foreground font-bold">Limpar</button>
                <span className="text-xs text-muted-foreground ml-auto">{linkSelected.size} selecionado{linkSelected.size === 1 ? "" : "s"}</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {filteredProductsForLink.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Nenhum produto encontrado.</p>
              ) : filteredProductsForLink.map((p: any) => {
                const checked = linkSelected.has(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      const next = new Set(linkSelected);
                      if (checked) next.delete(p.id); else next.add(p.id);
                      setLinkSelected(next);
                    }}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-lg border-2 transition-colors text-left ${checked ? "bg-primary/10 border-primary" : "bg-muted/40 border-transparent"}`}
                  >
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" loading="lazy" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0"><Package className="h-4 w-4 text-muted-foreground" /></div>
                    )}
                    <span className="flex-1 text-sm text-foreground truncate">{p.name}</span>
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${checked ? "bg-primary border-primary" : "border-muted-foreground/40"}`}>
                      {checked && <Save className="h-3 w-3 text-primary-foreground" />}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="p-4 border-t border-border flex gap-2">
              <button onClick={() => setLinkModalGroupId(null)} disabled={linkSaving} className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-muted text-foreground">Cancelar</button>
              <button onClick={saveLinks} disabled={linkSaving} className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-primary text-primary-foreground disabled:opacity-50">
                {linkSaving ? "Salvando..." : "Salvar vínculos"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewGroupId && previewGroup && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setPreviewGroupId(null)}>
          <div className="bg-card w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">Pré-visualização (como o cliente vê)</h3>
              <button onClick={() => setPreviewGroupId(null)} className="text-muted-foreground"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4 space-y-2 max-h-[70vh] overflow-y-auto">
              <div className="flex items-baseline justify-between gap-2">
                <h4 className="text-base font-bold text-foreground">{previewGroup.name}</h4>
                {previewGroup.min_select > 0 && (
                  <span className="text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-full font-bold uppercase">Obrigatório</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {previewGroup.min_select > 0 ? `Escolha de ${previewGroup.min_select} até ${previewGroup.max_select}` : `Escolha até ${previewGroup.max_select}`}
              </p>
              <div className="space-y-1.5 mt-2">
                {((previewGroup.addon_items as any[]) || []).sort((a: any, b: any) => a.sort_order - b.sort_order).map((it: any) => (
                  <div key={it.id} className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-5 h-5 ${previewGroup.max_select === 1 ? "rounded-full" : "rounded"} border-2 border-muted-foreground/40`} />
                      <span className="text-sm text-foreground">{it.name}</span>
                    </div>
                    <span className="text-sm text-primary font-bold">
                      {Number(it.price) > 0 ? `+${formatBRL(Number(it.price))}` : "Grátis"}
                    </span>
                  </div>
                ))}
                {((previewGroup.addon_items as any[]) || []).length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Sem itens neste grupo.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddonManager;
