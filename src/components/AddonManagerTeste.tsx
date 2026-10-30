/**
 * CÓPIA DE TESTE (/admin-teste) de src/components/AddonManager.tsx.
 * Redesign da aba Adicionais (estudo 25/10/2026): cartão compacto com a linha
 * "Para: <produto>" sempre visível, lista organizada por produto vinculado,
 * busca + filtros por tipo, ações atrás do menu "•••" e formulário de
 * novo/edição de grupo em bottom sheet de 2 passos.
 * NÃO usada pelo /admin original — só pela rota /admin-teste (AddonsTabTeste).
 * Dados e lógica (queries, mutations, vínculos, preços, mín/máx,
 * price_replaces_base) são os mesmos do original: só apresentação muda.
 */
import { formatBRL } from "@/lib/utils";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, Save, X, ChevronDown, ChevronUp, Package, FileText, Layers, Link2, Copy, Eye, Search, MoreVertical, Check, ArrowLeft } from "lucide-react";
import { formatBRLDisplay, parseBRLCentsInput } from "@/hooks/useBRLInput";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import AddonGroupPreview from "@/components/AddonGroupPreview";

interface AddonManagerTesteProps {
  storeId: string;
}

// Frase da regra do grupo em linguagem simples, exibida sob os campos de mín/máx.
// min só assume 0 ou 1 na UI (toggle Opcional/Obrigatório); o parse espelha o salvamento.
const addonRulePhrase = (minRaw: string, maxRaw: string) => {
  const min = parseInt(minRaw) || 0;
  const max = parseInt(maxRaw) || 1;
  const noun = max === 1 ? "item" : "itens";
  if (min >= 1 && max === 1) return "O cliente escolhe exatamente 1 item deste grupo.";
  if (min >= 1) return `O cliente escolhe de ${min} até ${max} ${noun} deste grupo.`;
  return `O cliente pode pular este grupo ou escolher até ${max} ${noun}.`;
};

// Tipo do grupo derivado do nome (regra do estudo — sem campo novo no banco).
type AddonGroupType = "sabor" | "borda" | "combo" | "bebida";
const addonGroupType = (name: string): AddonGroupType => {
  const n = (name || "").toLowerCase();
  if (n.includes("sabor")) return "sabor";
  if (n.includes("borda")) return "borda";
  if (n.includes("refrigerante") || n.includes("bebida")) return "bebida";
  return "combo";
};
const ADDON_TYPE_LABELS: Record<AddonGroupType, string> = {
  sabor: "Sabores",
  borda: "Bordas",
  combo: "Combos",
  bebida: "Bebidas",
};

// Frase curta da regra pro cartão ("escolhe 1 a 4 sabores").
const addonRuleShort = (group: any) => {
  const min = Number(group.min_select) || 0;
  const max = Number(group.max_select) || 1;
  const type = addonGroupType(group.name);
  const noun = type === "sabor" ? "sabor" : type === "borda" ? "borda" : "item";
  const plural = max > 1 ? (noun === "item" ? "itens" : `${noun}es`) : noun;
  if (min >= 1 && max === 1) return `escolhe exatamente 1 ${noun}`;
  if (min >= 1) return `escolhe de ${min} a ${max} ${plural}`;
  return `escolhe até ${max} ${plural}`;
};

// Faixa de preço do grupo pro cartão ("R$ 74,99 – R$ 99,99" / "Incluso no combo").
const addonPriceRange = (group: any): string => {
  const items = (group.addon_items as any[]) || [];
  if (items.length === 0) return "Sem itens";
  const prices = items.map((it: any) => Number(it.price) || 0);
  const pmin = Math.min(...prices);
  const pmax = Math.max(...prices);
  const type = addonGroupType(group.name);
  if (type === "combo" || type === "bebida") {
    if (pmax > 0) return `até +${formatBRL(pmax)}`;
    return "Incluso no combo";
  }
  if (group.price_replaces_base) return `${formatBRL(pmin)} – ${formatBRL(pmax)}`;
  if (pmin === 0) return `Grátis a +${formatBRL(pmax)}`;
  return `+${formatBRL(pmin)} a +${formatBRL(pmax)}`;
};

// Rótulo de preço de um item (sabor que define o preço aparece sem o "+").
const addonItemPrice = (group: any, item: any): { label: string; free: boolean } => {
  const price = Number(item.price) || 0;
  if (price === 0) {
    const type = addonGroupType(group.name);
    return { label: type === "combo" || type === "bebida" ? "Incluso" : "Grátis", free: true };
  }
  return { label: group.price_replaces_base ? formatBRL(price) : `+${formatBRL(price)}`, free: false };
};

const AddonManagerTeste = ({ storeId }: AddonManagerTesteProps) => {
  const queryClient = useQueryClient();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [groupForm, setGroupForm] = useState({ name: "", min_select: "0", max_select: "1", price_replaces_base: false });
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
  // Redesign: busca, filtro por tipo, seções por produto, menu "•••" e sheet de grupo.
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | AddonGroupType>("all");
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [menuGroupId, setMenuGroupId] = useState<string | null>(null);
  const [groupSheet, setGroupSheet] = useState<null | { mode: "create" | "edit"; step: 1 | 2; groupId?: string }>(null);
  const [sheetType, setSheetType] = useState<"sabor" | "borda" | "outro">("sabor");

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

  // Modo de preço da pizza da loja — mesma query da aba Pizzaria
  // (PizzaFlavorManagerTeste), com a mesma chave: o cache é compartilhado,
  // então quando o modo muda lá a linha da regra aqui atualiza junto.
  // Só leitura: o sheet nunca grava o modo.
  const { data: storeRow } = useQuery({
    queryKey: ["store-for-pizza", storeId],
    queryFn: async () => {
      const { data } = await supabase.from("stores").select("settings").eq("id", storeId).single();
      return data;
    },
  });
  const priceMode = ((storeRow?.settings || {}) as Record<string, any>).pizza_price_mode as "maior" | "media" | "soma" | undefined;
  // "media" e "soma" são a mesma regra (somar) em todos os fluxos — a
  // linguagem é a mesma da tela de configuração (PR #356) e do modal (PR #358).
  const priceRuleText = priceMode === "maior"
    ? "A pizza custa o preço do sabor mais caro."
    : "Os sabores somam no preço da pizza.";

  // Linha da regra de preço no sheet: quando o grupo define o preço, mostra
  // a regra que a loja configurou (e onde mudar); quando não define, os itens
  // sempre somam — não há nada para configurar nesses grupos.
  const priceRuleBox = (definesPrice: boolean) => (
    <p className="text-xs text-foreground/80 bg-muted/40 rounded-xl px-3 py-2 leading-relaxed">
      {definesPrice ? (
        <>{priceRuleText} <b>Mudar em Pizzaria/Pastel → Regras.</b></>
      ) : (
        "Os itens deste grupo sempre somam no preço."
      )}
    </p>
  );

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
    setGroupSheet(null);
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
    setGroupSheet(null);
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
  const menuGroup = groups?.find((g: any) => g.id === menuGroupId);
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

  // --- Bottom sheet de novo/edição de grupo (2 passos) ---
  const sheetForm = groupSheet?.mode === "edit" ? editGroupForm : groupForm;
  const patchSheetForm = (patch: Partial<typeof groupForm>) => {
    if (groupSheet?.mode === "edit") setEditGroupForm((f) => ({ ...f, ...patch }));
    else setGroupForm((f) => ({ ...f, ...patch }));
  };
  // O tipo já pré-ajusta obrigatório e preço: sabor nasce obrigatório e define
  // o preço (como os sabores de pizza); borda/outro nascem opcionais, máx 1.
  const applySheetType = (t: "sabor" | "borda" | "outro") => {
    setSheetType(t);
    if (t === "sabor") patchSheetForm({ min_select: "1", max_select: "1", price_replaces_base: true });
    else patchSheetForm({ min_select: "0", max_select: "1", price_replaces_base: false });
  };
  const openCreateSheet = () => {
    setGroupForm({ name: "", min_select: "1", max_select: "1", price_replaces_base: true });
    setBulkText("");
    setBulkParsed([]);
    setSheetType("sabor");
    setGroupSheet({ mode: "create", step: 1 });
  };
  const openEditSheet = (group: any) => {
    setEditGroupForm({
      name: group.name,
      min_select: String(group.min_select),
      max_select: String(group.max_select),
      price_replaces_base: !!group.price_replaces_base,
    });
    const t = addonGroupType(group.name);
    setSheetType(t === "sabor" || t === "borda" ? t : "outro");
    setGroupSheet({ mode: "edit", step: 1, groupId: group.id });
  };
  const closeSheet = () => {
    setGroupSheet(null);
    setBulkText("");
    setBulkParsed([]);
  };
  const saveSheet = async () => {
    if (groupSheet?.mode === "edit" && groupSheet.groupId) await updateGroup(groupSheet.groupId);
    else await addGroup();
  };

  // --- Busca + filtro por tipo ---
  const isFiltering = searchQuery.trim() !== "" || typeFilter !== "all";
  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return ((groups as any[]) || []).filter((g: any) => {
      if (typeFilter !== "all" && addonGroupType(g.name) !== typeFilter) return false;
      if (!q) return true;
      if ((g.name || "").toLowerCase().includes(q)) return true;
      if (getLinkedProducts(g.id).some((l: any) => ((l.products as any)?.name || "").toLowerCase().includes(q))) return true;
      return ((g.addon_items as any[]) || []).some((it: any) => (it.name || "").toLowerCase().includes(q));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, links, searchQuery, typeFilter]);

  const typeCounts = useMemo(() => {
    const c: Record<AddonGroupType, number> = { sabor: 0, borda: 0, combo: 0, bebida: 0 };
    ((groups as any[]) || []).forEach((g: any) => { c[addonGroupType(g.name)] += 1; });
    return c;
  }, [groups]);

  const totals = useMemo(() => {
    const list = (groups as any[]) || [];
    const items = list.reduce((n: number, g: any) => n + (((g.addon_items as any[]) || []).length), 0);
    const productIds = new Set(((links as any[]) || []).map((l: any) => l.product_id as string));
    return { groups: list.length, items, products: productIds.size };
  }, [groups, links]);

  // --- Seções recolhíveis por produto vinculado (grupos sem vínculo vão pro fim) ---
  const sections = useMemo(() => {
    const sorted = [...filteredGroups].sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const byKey = new Map<string, { key: string; productName: string; groups: any[] }>();
    const order: string[] = [];
    for (const g of sorted) {
      const linked = getLinkedProducts(g.id);
      const key = linked.length > 0 ? (linked[0].product_id as string) : "unlinked";
      const productName = linked.length > 0
        ? ((linked[0].products as any)?.name || "Produto")
        : "Sem produto vinculado";
      if (!byKey.has(key)) {
        byKey.set(key, { key, productName, groups: [] });
        order.push(key);
      }
      byKey.get(key)!.groups.push(g);
    }
    // "Sem produto vinculado" sempre por último; o resto mantém a ordem do primeiro grupo.
    order.sort((a, b) => {
      if (a === "unlinked") return 1;
      if (b === "unlinked") return -1;
      return (byKey.get(a)!.groups[0].sort_order ?? 0) - (byKey.get(b)!.groups[0].sort_order ?? 0);
    });
    return order.map((k) => byKey.get(k)!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredGroups, links]);

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const askDeleteGroup = async (group: any) => {
    const ok = await confirm({
      title: "Excluir grupo de adicionais?",
      description: `Tem certeza que deseja excluir "${group.name}"? Todos os itens deste grupo serão removidos e desvinculados dos produtos. Esta ação não pode ser desfeita.`,
      confirmText: "Excluir",
      variant: "destructive",
    });
    if (ok) deleteGroup(group.id);
  };

  const sheetPreviewItems = groupSheet?.mode === "edit"
    ? [...(((groups as any[]) || []).find((g: any) => g.id === groupSheet.groupId)?.addon_items as any[]) || []]
        .sort((a: any, b: any) => a.sort_order - b.sort_order)
        .map((it: any) => ({ name: it.name, price: Number(it.price) || 0 }))
    : bulkParsed;

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
            <p className="text-xs text-foreground/70 mt-0.5">Grupos de sabores, bordas e extras — organizados por produto.</p>
          </div>
        </div>
        <button
          onClick={openCreateSheet}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap shadow-sm flex-shrink-0"
        >
          <Plus className="h-3.5 w-3.5" /> Novo grupo
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        <b className="text-foreground">{totals.groups}</b> {totals.groups === 1 ? "grupo" : "grupos"} · <b className="text-foreground">{totals.items}</b> itens · <b className="text-foreground">{totals.products}</b> {totals.products === 1 ? "produto" : "produtos"}
        {isFiltering && totals.groups !== filteredGroups.length && (
          <> · mostrando <b className="text-foreground">{filteredGroups.length}</b></>
        )}
      </p>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar grupo, item ou produto…"
          className="w-full bg-card text-foreground pl-9 pr-3 py-2.5 rounded-xl text-sm border border-border focus:outline-none focus:border-primary"
        />
      </div>

      {/* Filtros por tipo */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(["all", "sabor", "borda", "combo", "bebida"] as const).map((t) => {
          const count = t === "all" ? totals.groups : typeCounts[t];
          const active = typeFilter === t;
          return (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`flex-shrink-0 rounded-full px-3 py-2 text-xs font-bold border transition-colors ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border"
              }`}
            >
              {t === "all" ? "Todos" : ADDON_TYPE_LABELS[t]} <span className={active ? "opacity-75 font-semibold" : "opacity-60 font-semibold"}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Lista por produto */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="bg-card rounded-xl p-4 animate-pulse space-y-2">
              <div className="h-4 bg-muted rounded w-1/2" />
              <div className="h-3 bg-muted rounded w-1/4" />
            </div>
          ))}
        </div>
      ) : groups && groups.length > 0 ? (
        filteredGroups.length === 0 ? (
          <div className="bg-card rounded-xl p-6 text-center">
            <p className="text-sm font-bold text-foreground">Nenhum grupo encontrado</p>
            <p className="text-xs text-muted-foreground mt-1">Tente outro nome, item ou produto.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sections.map((section) => {
              const isOpen = isFiltering || !collapsedSections.has(section.key);
              return (
                <section key={section.key}>
                  <button
                    type="button"
                    onClick={() => toggleSection(section.key)}
                    className="w-full flex items-center justify-between py-2 text-left"
                  >
                    <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground truncate">{section.productName}</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground font-semibold flex-shrink-0 ml-2">
                      {section.groups.length} {section.groups.length === 1 ? "grupo" : "grupos"}
                      {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="space-y-2">
                      {section.groups.map((group: any) => {
                        const linkedProducts = getLinkedProducts(group.id);
                        const isExpanded = expandedGroup === group.id;
                        const items = (group.addon_items as any[]) || [];
                        const paraText = linkedProducts.length === 0
                          ? "Sem produto vinculado"
                          : linkedProducts.length === 1
                            ? ((linkedProducts[0].products as any)?.name || "Produto")
                            : `${((linkedProducts[0].products as any)?.name || "Produto")} +${linkedProducts.length - 1}`;
                        return (
                          <div key={group.id} className="bg-card rounded-xl overflow-hidden border border-border/60 shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
                            {/* Cartão compacto */}
                            <div
                              className="flex items-start gap-2 px-3 py-3 cursor-pointer"
                              onClick={() => setExpandedGroup(isExpanded ? null : group.id)}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-bold text-[15px] text-foreground truncate">{group.name}</h3>
                                  {group.min_select > 0 ? (
                                    <span className="text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wide flex-shrink-0">
                                      Obrigatório
                                    </span>
                                  ) : (
                                    <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-bold uppercase tracking-wide flex-shrink-0">
                                      Opcional
                                    </span>
                                  )}
                                </div>
                                <p className="text-[13px] text-muted-foreground mt-0.5 truncate">
                                  <Link2 className="inline h-3 w-3 mr-1 align-[-1px]" />
                                  Para: <b className={linkedProducts.length === 0 ? "font-semibold text-muted-foreground" : "text-foreground"}>{paraText}</b>
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {items.length} {items.length === 1 ? "item" : "itens"} · <span className="text-primary font-bold">{addonPriceRange(group)}</span> · {addonRuleShort(group)}
                                </p>
                                {group.price_replaces_base && (
                                  <p className="text-xs text-emerald-600 font-semibold mt-0.5">O preço do sabor vale como preço da pizza</p>
                                )}
                              </div>
                              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setMenuGroupId(group.id); }}
                                  className="w-11 h-11 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground active:bg-muted"
                                  aria-label="Mais ações"
                                >
                                  <MoreVertical className="h-5 w-5" />
                                </button>
                                <span className="w-11 h-11 flex items-center justify-center text-muted-foreground" aria-hidden>
                                  {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                                </span>
                              </div>
                            </div>

                            {/* Conteúdo expandido */}
                            {isExpanded && (
                              <div className="px-3 pb-3 space-y-2 border-t border-border/60 pt-2">
                                {(() => {
                                  const sortedItems = [...items].sort((a: any, b: any) => a.sort_order - b.sort_order);
                                  return sortedItems.map((item: any, itemIdx: number) => {
                                    const price = addonItemPrice(group, item);
                                    return (
                                      <div key={item.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2.5">
                                        {editingItem === item.id ? (
                                          <div className="flex gap-2 flex-1" onClick={(e) => e.stopPropagation()}>
                                            <input
                                              type="text"
                                              value={editItemForm.name}
                                              onChange={(e) => setEditItemForm({ ...editItemForm, name: e.target.value })}
                                              className="flex-1 bg-muted text-foreground px-2 py-1 rounded text-sm border border-border focus:outline-none min-w-0"
                                              autoFocus
                                            />
                                            <AddonPriceInput
                                              value={editItemForm.price}
                                              onChange={(v) => setEditItemForm({ ...editItemForm, price: v })}
                                              placeholder="0,00"
                                            />
                                            <button onClick={() => updateItem(item.id)} className="bg-primary text-primary-foreground px-2 py-1 rounded text-xs font-bold flex-shrink-0">
                                              <Save className="h-3 w-3" />
                                            </button>
                                            <button onClick={() => setEditingItem(null)} className="text-muted-foreground px-1 flex-shrink-0">
                                              <X className="h-3 w-3" />
                                            </button>
                                          </div>
                                        ) : (
                                          <>
                                            <span className="text-sm text-foreground min-w-0 truncate">{item.name}</span>
                                            <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                                              <span className={`text-sm font-bold ${price.free ? "text-muted-foreground" : "text-primary"}`}>
                                                {price.label}
                                              </span>
                                              <div className="flex flex-col">
                                                <button
                                                  onClick={() => moveItem(group, item.id, -1)}
                                                  disabled={itemIdx === 0}
                                                  className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed leading-none"
                                                  title="Mover para cima"
                                                >
                                                  <ChevronUp className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                  onClick={() => moveItem(group, item.id, 1)}
                                                  disabled={itemIdx === sortedItems.length - 1}
                                                  className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed leading-none"
                                                  title="Mover para baixo"
                                                >
                                                  <ChevronDown className="h-3.5 w-3.5" />
                                                </button>
                                              </div>
                                              <button
                                                onClick={() => {
                                                  setEditingItem(item.id);
                                                  setEditItemForm({ name: item.name, price: String(item.price) });
                                                }}
                                                className="text-muted-foreground hover:text-foreground p-2"
                                              >
                                                <Edit2 className="h-3.5 w-3.5" />
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
                                                className="text-destructive/70 hover:text-destructive p-2"
                                              >
                                                <Trash2 className="h-3.5 w-3.5" />
                                              </button>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    );
                                  });
                                })()}

                                {/* Add Item */}
                                {showItemForm === group.id ? (
                                  <div className="flex gap-2 bg-muted/50 rounded-lg p-2">
                                    <input
                                      type="text"
                                      placeholder="Nome do adicional"
                                      value={itemForm.name}
                                      onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                                      className="flex-1 bg-muted text-foreground px-3 py-2 rounded-lg text-sm border border-border focus:outline-none min-w-0"
                                      autoFocus
                                    />
                                    <AddonPriceInput
                                      value={itemForm.price}
                                      onChange={(v) => setItemForm({ ...itemForm, price: v })}
                                      placeholder="0,00"
                                    />
                                    <button onClick={() => addItem(group.id)} className="bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-bold flex-shrink-0">
                                      <Plus className="h-4 w-4" />
                                    </button>
                                    <button onClick={() => { setShowItemForm(null); setItemForm({ name: "", price: "0" }); }} className="text-muted-foreground px-2 flex-shrink-0">
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
                                        <p className="text-xs font-bold text-foreground/70 flex items-center gap-1">
                                          <Check className="h-3.5 w-3.5 text-primary" />
                                          {bulkParsed.length} {bulkParsed.length === 1 ? "item detectado" : "itens detectados"}:
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
                                    <p className="text-xs text-muted-foreground/70 font-bold mb-1.5 flex items-center gap-1">
                                      <Link2 className="h-3 w-3" /> Vinculado a:
                                    </p>
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
                      })}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )
      ) : (
        <div className="bg-card rounded-2xl p-6 text-center border border-dashed border-border">
          <div className="flex justify-center mb-3">
            <div className="bg-primary/15 text-primary rounded-2xl p-3">
              <Layers className="h-8 w-8" />
            </div>
          </div>
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
            onClick={openCreateSheet}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm"
          >
            <Plus className="h-4 w-4" /> Criar primeiro grupo
          </button>
        </div>
      )}

      {/* Menu "•••" do grupo */}
      {menuGroupId && menuGroup && (
        <div className="fixed inset-0 z-[70] bg-black/60 flex items-end sm:items-center justify-center" onClick={() => setMenuGroupId(null)}>
          <div className="bg-card w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-2 pb-[calc(1.5rem+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => { setMenuGroupId(null); setPreviewGroupId(menuGroup.id); }}
              className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-sm text-foreground hover:bg-muted/50 text-left"
            >
              <Eye className="h-4 w-4 text-muted-foreground" /> Pré-visualizar como o cliente vê
            </button>
            <button
              onClick={() => { setMenuGroupId(null); openLinkModal(menuGroup.id); }}
              className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-sm text-foreground hover:bg-muted/50 text-left"
            >
              <Link2 className="h-4 w-4 text-muted-foreground" /> Vincular a produtos
            </button>
            <button
              onClick={() => { setMenuGroupId(null); duplicateGroup(menuGroup); }}
              className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-sm text-foreground hover:bg-muted/50 text-left"
            >
              <Copy className="h-4 w-4 text-muted-foreground" /> Duplicar grupo
            </button>
            <button
              onClick={() => { setMenuGroupId(null); openEditSheet(menuGroup); }}
              className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-sm text-foreground hover:bg-muted/50 text-left"
            >
              <Edit2 className="h-4 w-4 text-muted-foreground" /> Editar grupo
            </button>
            <div className="h-px bg-border my-1 mx-3" />
            <button
              onClick={() => { const g = menuGroup; setMenuGroupId(null); askDeleteGroup(g); }}
              className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-sm font-bold text-destructive hover:bg-destructive/10 text-left"
            >
              <Trash2 className="h-4 w-4" /> Excluir grupo
            </button>
          </div>
        </div>
      )}

      {/* Bottom sheet de novo/edição de grupo — 2 passos */}
      {groupSheet && (
        <div className="fixed inset-0 z-[70] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={closeSheet}>
          <div className="bg-card w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[88vh] flex flex-col pb-[env(safe-area-inset-bottom)]" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-border flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-foreground truncate">
                  {groupSheet.mode === "edit" ? "Editar grupo" : "Novo grupo de adicionais"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Passo {groupSheet.step} de 2 — {groupSheet.step === 1 ? "nome e tipo" : "itens e regras"}
                </p>
              </div>
              <button onClick={closeSheet} className="text-muted-foreground p-1 flex-shrink-0"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {groupSheet.step === 1 ? (
                <>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground block mb-1">Nome do grupo</label>
                    <input
                      type="text"
                      placeholder="Ex.: Sabores da pizza"
                      value={sheetForm.name}
                      onChange={(e) => patchSheetForm({ name: e.target.value })}
                      className="w-full bg-secondary text-foreground px-3 py-2.5 rounded-lg text-sm border border-border focus:border-primary focus:outline-none"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground block mb-1">Tipo</label>
                    <div className="flex gap-2">
                      {(["sabor", "borda", "outro"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => applySheetType(t)}
                          className={`flex-1 py-3 px-2 rounded-xl border-2 text-sm font-bold transition-all ${
                            sheetType === t
                              ? "bg-primary/10 border-primary text-primary"
                              : "bg-muted/50 border-transparent text-foreground"
                          }`}
                        >
                          {t === "sabor" ? "Sabor" : t === "borda" ? "Borda" : "Outro"}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-2">
                      O tipo já ajusta obrigatório e preço: sabor nasce obrigatório e define o preço da pizza; borda e outro nascem opcionais, no máximo 1. Dá pra ajustar tudo no passo 2.
                    </p>
                    {/* Regra de preço do tipo escolhido — acompanha a escolha em tempo real */}
                    {priceRuleBox(sheetType === "sabor")}
                  </div>
                </>
              ) : (
                <>
                  {/* Toggle obrigatório */}
                  <button
                    type="button"
                    onClick={() => patchSheetForm({ min_select: sheetForm.min_select === "0" ? "1" : "0" })}
                    className={`w-full flex items-center justify-between py-3 px-4 rounded-xl border-2 transition-all ${
                      sheetForm.min_select !== "0"
                        ? "bg-primary/10 border-primary"
                        : "bg-muted/50 border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">
                        {sheetForm.min_select !== "0" ? "Obrigatório" : "Opcional"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {sheetForm.min_select !== "0" ? "Cliente precisa selecionar" : "Cliente pode pular"}
                      </span>
                    </div>
                    <div className={`w-11 h-6 rounded-full transition-colors relative ${sheetForm.min_select !== "0" ? "bg-primary" : "bg-muted-foreground/30"}`}>
                      <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow ${sheetForm.min_select !== "0" ? "translate-x-5" : "translate-x-0.5"}`} />
                    </div>
                  </button>

                  <div>
                    <label className="text-xs text-muted-foreground/70 mb-1 block">Máximo de seleções</label>
                    <input
                      type="number"
                      value={sheetForm.max_select}
                      onChange={(e) => patchSheetForm({ max_select: e.target.value })}
                      className="w-full bg-secondary text-foreground px-3 py-2 rounded-lg text-sm border border-border focus:outline-none"
                      min="1"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">{addonRulePhrase(sheetForm.min_select, sheetForm.max_select)}</p>

                  {/* Toggle: Define preço final */}
                  <button
                    type="button"
                    onClick={() => patchSheetForm({ price_replaces_base: !sheetForm.price_replaces_base, min_select: !sheetForm.price_replaces_base ? "1" : sheetForm.min_select, max_select: !sheetForm.price_replaces_base ? "1" : sheetForm.max_select })}
                    className={`w-full flex items-start justify-between gap-3 py-3 px-4 rounded-xl border-2 transition-all text-left ${
                      sheetForm.price_replaces_base ? "bg-primary/10 border-primary" : "bg-muted/50 border-transparent"
                    }`}
                  >
                    <div className="flex-1">
                      <div className="text-sm font-bold text-foreground">
                        Define o preço final?
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Use para tamanhos (200ml, 300ml). O preço escolhido <b>substitui</b> o preço base do produto. Vira obrigatório e seleção única.
                      </div>
                    </div>
                    <div className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 mt-0.5 ${sheetForm.price_replaces_base ? "bg-primary" : "bg-muted-foreground/30"}`}>
                      <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow ${sheetForm.price_replaces_base ? "translate-x-5" : "translate-x-0.5"}`} />
                    </div>
                  </button>

                  {/* Regra de preço deste grupo — acompanha o interruptor em tempo real */}
                  {priceRuleBox(sheetForm.price_replaces_base)}

                  {/* Importação em lote (só na criação) */}
                  {groupSheet.mode === "create" && (
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
                          <p className="text-xs font-bold text-foreground/70 flex items-center gap-1">
                            <Check className="h-3.5 w-3.5 text-primary" />
                            {bulkParsed.length} {bulkParsed.length === 1 ? "item detectado" : "itens detectados"}:
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
                  )}

                  {/* Prévia sempre visível acima do botão de salvar */}
                  <AddonGroupPreview
                    name={sheetForm.name}
                    minSelect={parseInt(sheetForm.min_select) || 0}
                    maxSelect={parseInt(sheetForm.max_select) || 1}
                    priceReplacesBase={sheetForm.price_replaces_base}
                    items={sheetPreviewItems}
                  />
                </>
              )}
            </div>
            <div className="p-4 border-t border-border flex gap-2">
              {groupSheet.step === 1 ? (
                <>
                  <button onClick={closeSheet} className="px-4 py-2.5 rounded-xl text-sm font-bold bg-muted text-foreground">Cancelar</button>
                  <button
                    onClick={() => setGroupSheet({ ...groupSheet, step: 2 })}
                    disabled={!sheetForm.name.trim()}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-primary text-primary-foreground disabled:opacity-40"
                  >
                    Continuar
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setGroupSheet({ ...groupSheet, step: 1 })}
                    className="px-4 py-2.5 rounded-xl text-sm font-bold bg-muted text-foreground flex items-center gap-1"
                  >
                    <ArrowLeft className="h-4 w-4" /> Voltar
                  </button>
                  <button onClick={saveSheet} className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-primary text-primary-foreground">
                    {groupSheet.mode === "edit"
                      ? "Salvar alterações"
                      : bulkParsed.length > 0 ? `Criar grupo com ${bulkParsed.length} itens` : "Criar grupo"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Link Products Modal */}
      {linkModalGroupId && linkModalGroup && (
        <div className="fixed inset-0 z-[70] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => !linkSaving && setLinkModalGroupId(null)}>
          <div className="bg-card w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col pb-[env(safe-area-inset-bottom)]" onClick={(e) => e.stopPropagation()}>
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
        <div className="fixed inset-0 z-[70] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setPreviewGroupId(null)}>
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

export default AddonManagerTeste;
