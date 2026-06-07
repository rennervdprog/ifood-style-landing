import { formatBRL } from "@/lib/utils";
import { useState, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, Save, X, ChevronDown, ChevronUp, Package, FileText, Layers, Link2, Sparkles } from "lucide-react";
import { formatBRLDisplay, parseBRLCentsInput } from "@/hooks/useBRLInput";

interface AddonManagerProps {
  storeId: string;
}

const AddonManager = ({ storeId }: AddonManagerProps) => {
  const queryClient = useQueryClient();
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
                      onClick={(e) => { e.stopPropagation(); deleteGroup(group.id); }}
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
                            <button onClick={() => deleteItem(item.id)} className="text-destructive/70 hover:text-destructive p-1">
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
    </div>
  );
};

export default AddonManager;
