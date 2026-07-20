import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Loader2, Plus, X, Trash2, ArrowRightLeft, XCircle, Receipt, CheckCircle2,
  Utensils, CreditCard, CircleDot, Clock, Users, Search, ChevronRight,
} from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { haptic } from "@/lib/haptics";
import {
  usePdvTables,
  usePdvTabItems,
  usePdvTabsTotals,
  rpcOpenTab,
  rpcAddTabItem,
  rpcRemoveTabItem,
  rpcTransferTab,
  rpcCancelTab,
  rpcCloseTab,
  type PdvTableRow,
  type PdvTabRow,
} from "@/pages/pdv/state/usePdvTables";
import type { Product, PdvSession } from "@/pages/pdv/types";

interface Props {
  storeId: string;
  session: PdvSession | null;
  products: Product[];
}

type StatusKey = "free" | "occupied" | "billing";

const STATUS_META: Record<StatusKey, {
  label: string;
  icon: typeof CircleDot;
  border: string;
  bg: string;
  chip: string;
  dot: string;
}> = {
  free: {
    label: "Livre",
    icon: CircleDot,
    border: "border-l-emerald-500",
    bg: "bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/30",
    chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  occupied: {
    label: "Ocupada",
    icon: Utensils,
    border: "border-l-amber-500",
    bg: "bg-amber-500/5 hover:bg-amber-500/10 border-amber-500/30",
    chip: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  billing: {
    label: "Fechando",
    icon: CreditCard,
    border: "border-l-rose-500",
    bg: "bg-rose-500/5 hover:bg-rose-500/10 border-rose-500/30",
    chip: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500",
  },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h}h${rm}m` : `${h}h`;
}

export const PdvMesasView = ({ storeId, session, products }: Props) => {
  const { tables, tabs, loading, refresh } = usePdvTables(storeId);
  const [selectedTabId, setSelectedTabId] = useState<string | null>(null);
  const [showNewTable, setShowNewTable] = useState(false);
  const [showQuickTab, setShowQuickTab] = useState(false);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [confirmOpenTable, setConfirmOpenTable] = useState<PdvTableRow | null>(null);
  // tick a cada 60s pra atualizar "tempo aberta"
  const [, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(i);
  }, []);

  const tabIds = useMemo(() => tabs.map((t) => t.id), [tabs]);
  const totals = usePdvTabsTotals(tabIds);

  const tabByTable = useMemo(() => {
    const m = new Map<string, PdvTabRow>();
    for (const t of tabs) if (t.table_id) m.set(t.table_id, t);
    return m;
  }, [tabs]);

  const looseTabs = tabs.filter((t) => !t.table_id);

  const openTableNow = async (t: PdvTableRow) => {
    const existing = tabByTable.get(t.id);
    if (existing) {
      setSelectedTabId(existing.id);
      return;
    }
    try {
      const tabId = await rpcOpenTab({ storeId, tableId: t.id });
      haptic.success();
      refresh();
      setSelectedTabId(tabId);
    } catch (e: any) {
      toast.error(`Falha ao abrir mesa: ${e?.message ?? "erro"}`);
    }
  };

  const onTableClick = (t: PdvTableRow) => {
    const existing = tabByTable.get(t.id);
    if (existing) {
      haptic.light();
      setSelectedTabId(existing.id);
      return;
    }
    setConfirmOpenTable(t);
  };

  const occupiedCount = tables.filter((t) => tabByTable.has(t.id)).length;
  const freeCount = tables.length - occupiedCount;
  const totalOpenValue = Array.from(totals.values()).reduce((s, v) => s + v.total, 0);

  return (
    <div className="flex-1 overflow-y-auto pb-24 relative">
      {/* KPI strip */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="grid grid-cols-3 gap-2 p-3">
          <KpiChip label="Livres" value={String(freeCount)} tone="emerald" />
          <KpiChip label="Ocupadas" value={String(occupiedCount)} tone="amber" />
          <KpiChip label="Aberto" value={formatBRL(totalOpenValue)} tone="primary" />
        </div>
      </div>

      <div className="p-3 space-y-4">
        {loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[110px] rounded-xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && tables.length === 0 && looseTabs.length === 0 && (
          <div className="text-center py-12 px-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Utensils className="h-6 w-6 text-primary" />
            </div>
            <p className="font-bold text-sm mb-1">Nenhuma mesa cadastrada</p>
            <p className="text-xs text-muted-foreground mb-4">
              Crie mesas ou abra uma comanda avulsa pelo botão “+”.
            </p>
            <button
              onClick={() => setShowNewTable(true)}
              className="text-xs font-bold px-4 py-2 rounded-md bg-primary text-primary-foreground"
            >
              Criar primeira mesa
            </button>
          </div>
        )}

        {tables.length > 0 && (
          <section>
            <SectionHeader title="Mesas" count={tables.length} />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {tables.map((t) => {
                const tab = tabByTable.get(t.id);
                const status: StatusKey = tab ? "occupied" : (t.status as StatusKey);
                const meta = STATUS_META[status];
                const tot = tab ? totals.get(tab.id) : undefined;
                return (
                  <button
                    key={t.id}
                    onClick={() => onTableClick(t)}
                    className={`relative text-left rounded-xl border-2 border-l-[6px] transition-all active:scale-[0.98] ${meta.border} ${meta.bg} p-3 min-h-[110px] flex flex-col justify-between`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="font-black text-lg leading-none truncate">{t.label}</span>
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${meta.chip}`}>
                        <meta.icon className="h-2.5 w-2.5" /> {meta.label}
                      </span>
                    </div>

                    {tab ? (
                      <div className="space-y-0.5">
                        <div className="text-[15px] font-black tabular-nums leading-tight">
                          {formatBRL(tot?.total ?? 0)}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span className="inline-flex items-center gap-0.5">
                            <Clock className="h-2.5 w-2.5" /> {timeAgo(tab.opened_at)}
                          </span>
                          <span>·</span>
                          <span>{tot?.count ?? 0} itens</span>
                        </div>
                        {tab.customer_name && (
                          <div className="text-[10px] font-semibold truncate">{tab.customer_name}</div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Users className="h-3 w-3" /> {t.seats} lugares
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {looseTabs.length > 0 && (
          <section>
            <SectionHeader title="Comandas avulsas" count={looseTabs.length} />
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-3 px-3 snap-x">
              {looseTabs.map((tab) => {
                const tot = totals.get(tab.id);
                return (
                  <button
                    key={tab.id}
                    onClick={() => { haptic.light(); setSelectedTabId(tab.id); }}
                    className="snap-start shrink-0 w-[160px] text-left rounded-xl border-2 border-l-[6px] border-primary/40 border-l-primary bg-primary/5 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-sm">{tab.code ? `#${tab.code}` : "Comanda"}</span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="text-[15px] font-black tabular-nums mt-1">
                      {formatBRL(tot?.total ?? 0)}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {timeAgo(tab.opened_at)} · {tot?.count ?? 0} itens
                    </div>
                    {tab.customer_name && (
                      <div className="text-[10px] font-semibold truncate mt-0.5">{tab.customer_name}</div>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => setShowAddSheet(true)}
        className="fixed bottom-24 right-4 z-20 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition"
        aria-label="Adicionar"
      >
        <Plus className="h-6 w-6" />
      </button>

      {showAddSheet && (
        <ActionSheet onClose={() => setShowAddSheet(false)}>
          <button
            onClick={() => { setShowAddSheet(false); setShowNewTable(true); }}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent text-left"
          >
            <div className="h-10 w-10 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <Utensils className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <div className="font-bold text-sm">Nova mesa</div>
              <div className="text-[11px] text-muted-foreground">Cadastrar mesa fixa</div>
            </div>
          </button>
          <button
            onClick={() => { setShowAddSheet(false); setShowQuickTab(true); }}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent text-left"
          >
            <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center">
              <Receipt className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="font-bold text-sm">Comanda avulsa</div>
              <div className="text-[11px] text-muted-foreground">Sem mesa vinculada</div>
            </div>
          </button>
        </ActionSheet>
      )}

      {confirmOpenTable && (
        <ModalShell title={`Abrir ${confirmOpenTable.label}?`} onClose={() => setConfirmOpenTable(null)}>
          <p className="text-xs text-muted-foreground mb-4">
            {confirmOpenTable.seats} lugares · A mesa será marcada como ocupada.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setConfirmOpenTable(null)}
              className="text-sm font-bold py-2.5 rounded-md border border-border"
            >
              Cancelar
            </button>
            <button
              onClick={() => { const t = confirmOpenTable; setConfirmOpenTable(null); openTableNow(t); }}
              className="text-sm font-bold py-2.5 rounded-md bg-primary text-primary-foreground"
            >
              Abrir mesa
            </button>
          </div>
        </ModalShell>
      )}

      {showNewTable && (
        <NewTableDialog
          storeId={storeId}
          onClose={() => setShowNewTable(false)}
          onCreated={() => { setShowNewTable(false); refresh(); }}
        />
      )}

      {showQuickTab && (
        <QuickTabDialog
          storeId={storeId}
          onClose={() => setShowQuickTab(false)}
          onCreated={(tabId) => { setShowQuickTab(false); refresh(); setSelectedTabId(tabId); }}
        />
      )}

      {selectedTabId && (
        <TabDrawer
          tabId={selectedTabId}
          session={session}
          products={products}
          tables={tables}
          allTabs={tabs}
          onClose={() => setSelectedTabId(null)}
          onAfterAction={() => refresh()}
        />
      )}
    </div>
  );
};

function KpiChip({ label, value, tone }: { label: string; value: string; tone: "emerald" | "amber" | "primary" }) {
  const toneClass =
    tone === "emerald" ? "text-emerald-600 dark:text-emerald-400"
    : tone === "amber" ? "text-amber-600 dark:text-amber-400"
    : "text-primary";
  return (
    <div className="rounded-lg bg-card border border-border px-2 py-1.5">
      <div className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider">{label}</div>
      <div className={`text-sm font-black tabular-nums truncate ${toneClass}`}>{value}</div>
    </div>
  );
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center justify-between mb-2 px-0.5">
      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{title}</p>
      <span className="text-[10px] font-bold text-muted-foreground tabular-nums">{count}</span>
    </div>
  );
}

function ActionSheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-end sm:items-center sm:justify-center" onClick={onClose}>
      <div className="bg-background w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-3 pb-6 sm:pb-3" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto h-1 w-10 rounded-full bg-muted mb-3 sm:hidden" />
        <div className="space-y-1">{children}</div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

function NewTableDialog({ storeId, onClose, onCreated }: { storeId: string; onClose: () => void; onCreated: () => void }) {
  const [label, setLabel] = useState("");
  const [seats, setSeats] = useState("4");
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!label.trim()) return toast.error("Informe o nome da mesa");
    setSaving(true);
    try {
      const { error } = await (supabase as any).from("pdv_tables").insert({
        store_id: storeId,
        label: label.trim(),
        seats: Number(seats) || 4,
      });
      if (error) throw error;
      toast.success("Mesa criada");
      onCreated();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao criar mesa");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Nova mesa" onClose={onClose}>
      <label className="block text-xs font-bold mb-1">Nome/Número</label>
      <input
        autoFocus
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Mesa 01"
        className="w-full border border-input rounded-md px-3 py-2 text-sm mb-3 bg-background"
      />
      <label className="block text-xs font-bold mb-1">Lugares</label>
      <input
        value={seats}
        onChange={(e) => setSeats(e.target.value.replace(/\D/g, ""))}
        className="w-full border border-input rounded-md px-3 py-2 text-sm mb-4 bg-background"
      />
      <button
        onClick={create}
        disabled={saving}
        className="w-full bg-primary text-primary-foreground rounded-md py-2 text-sm font-bold disabled:opacity-60"
      >
        {saving ? "Criando..." : "Criar mesa"}
      </button>
    </ModalShell>
  );
}

function QuickTabDialog({ storeId, onClose, onCreated }: { storeId: string; onClose: () => void; onCreated: (id: string) => void }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const create = async () => {
    setSaving(true);
    try {
      const id = await rpcOpenTab({ storeId, code: code.trim() || null, customerName: name.trim() || null });
      onCreated(id);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao abrir comanda");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Nova comanda avulsa" onClose={onClose}>
      <label className="block text-xs font-bold mb-1">Código (opcional)</label>
      <input
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="12"
        className="w-full border border-input rounded-md px-3 py-2 text-sm mb-3 bg-background"
      />
      <label className="block text-xs font-bold mb-1">Cliente (opcional)</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="João"
        className="w-full border border-input rounded-md px-3 py-2 text-sm mb-4 bg-background"
      />
      <button
        onClick={create}
        disabled={saving}
        className="w-full bg-primary text-primary-foreground rounded-md py-2 text-sm font-bold disabled:opacity-60"
      >
        {saving ? "Abrindo..." : "Abrir comanda"}
      </button>
    </ModalShell>
  );
}

function TabDrawer({
  tabId, session, products, tables, allTabs, onClose, onAfterAction,
}: {
  tabId: string;
  session: PdvSession | null;
  products: Product[];
  tables: PdvTableRow[];
  allTabs: PdvTabRow[];
  onClose: () => void;
  onAfterAction: () => void;
}) {
  const tab = allTabs.find((t) => t.id === tabId);
  const { items, refetch: refetchItems } = usePdvTabItems(tabId);
  const [query, setQuery] = useState("");
  const [showClose, setShowClose] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [mobileView, setMobileView] = useState<"itens" | "add">("itens");

  const total = items.reduce((s, it) => s + Number(it.quantity) * Number(it.unit_price), 0);
  const itemCount = items.reduce((s, it) => s + Number(it.quantity), 0);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products.slice(0, 20);
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 30);
  }, [products, query]);

  const qtyByProduct = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) {
      if (!it.product_id) continue;
      m.set(it.product_id, (m.get(it.product_id) ?? 0) + Number(it.quantity));
    }
    return m;
  }, [items]);

  const addProduct = async (p: Product) => {
    try {
      await rpcAddTabItem({
        tabId, productId: p.id, name: p.name, quantity: 1, unitPrice: Number(p.price ?? 0),
      });
      haptic.light();
      refetchItems();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao adicionar");
    }
  };

  const removeItem = async (id: string) => {
    try {
      await rpcRemoveTabItem(id);
      refetchItems();
    } catch (e: any) {
      const msg = e?.message === "item_not_found" ? "Item já removido" : (e?.message ?? "erro");
      toast.error(msg);
      refetchItems();
    }
  };

  const tableLabel = tab?.table_id
    ? tables.find((t) => t.id === tab.table_id)?.label
    : tab?.code ? `Comanda #${tab.code}` : "Comanda";

  const ProductsList = (
    <div className="flex flex-col overflow-hidden h-full">
      <div className="p-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar produto..."
            className="w-full border border-input rounded-md pl-8 pr-3 py-2.5 text-sm bg-background"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredProducts.map((p) => {
          const q = qtyByProduct.get(p.id) ?? 0;
          return (
            <button
              key={p.id}
              onClick={() => addProduct(p)}
              className="w-full text-left px-3 py-2.5 rounded-md hover:bg-accent active:bg-accent border border-transparent hover:border-border flex items-center gap-2"
            >
              {q > 0 && (
                <span className="shrink-0 h-6 min-w-6 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-black flex items-center justify-center tabular-nums">
                  {q}
                </span>
              )}
              <span className="flex-1 text-sm font-semibold truncate">{p.name}</span>
              <span className="text-sm font-bold tabular-nums shrink-0">
                {formatBRL(Number(p.price ?? 0))}
              </span>
              <Plus className="h-4 w-4 text-primary shrink-0" />
            </button>
          );
        })}
        {filteredProducts.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">Nenhum produto</p>
        )}
      </div>
    </div>
  );

  const ItemsList = (
    <div className="flex flex-col overflow-hidden h-full">
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {items.length === 0 && (
          <div className="text-center py-10 px-4">
            <Receipt className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">
              Nenhum item ainda. Toque em <b>“Adicionar”</b> para começar.
            </p>
          </div>
        )}
        {items.map((it) => (
          <div key={it.id} className="flex items-center justify-between gap-2 p-2.5 rounded-md bg-card border border-border">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="shrink-0 h-7 min-w-7 px-1.5 rounded-md bg-primary/10 text-primary text-xs font-black flex items-center justify-center tabular-nums">
                {it.quantity}×
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{it.name}</p>
                <p className="text-[10px] text-muted-foreground tabular-nums">
                  {formatBRL(Number(it.unit_price))} · {formatBRL(Number(it.quantity) * Number(it.unit_price))}
                </p>
              </div>
            </div>
            <button
              onClick={() => removeItem(it.id)}
              className="h-9 w-9 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center shrink-0"
              aria-label="Remover"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center sm:justify-center" onClick={onClose}>
      <div
        className="bg-background w-full h-[96vh] sm:h-auto sm:max-w-3xl sm:max-h-[92vh] sm:rounded-xl rounded-t-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border shrink-0">
          <div className="mx-auto sm:hidden absolute top-1.5 left-1/2 -translate-x-1/2 h-1 w-10 rounded-full bg-muted" />
          <div className="min-w-0">
            <h3 className="font-black text-base truncate">{tableLabel}</h3>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              {tab && <span>Aberta há {timeAgo(tab.opened_at)}</span>}
              {tab?.customer_name && <span>· {tab.customer_name}</span>}
            </div>
          </div>
          <button onClick={onClose} className="h-9 w-9 rounded-md hover:bg-accent flex items-center justify-center shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mobile tabs */}
        <div className="sm:hidden flex border-b border-border shrink-0">
          <button
            onClick={() => setMobileView("itens")}
            className={`flex-1 text-xs font-bold py-2.5 border-b-2 ${
              mobileView === "itens" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
            }`}
          >
            Itens ({itemCount})
          </button>
          <button
            onClick={() => setMobileView("add")}
            className={`flex-1 text-xs font-bold py-2.5 border-b-2 flex items-center justify-center gap-1 ${
              mobileView === "add" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
            }`}
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden">
          {/* Desktop: split */}
          <div className="hidden sm:grid grid-cols-2 h-full">
            <div className="border-r border-border">{ProductsList}</div>
            {ItemsList}
          </div>
          {/* Mobile: single view */}
          <div className="sm:hidden h-full">
            {mobileView === "itens" ? ItemsList : ProductsList}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border p-3 space-y-2 shrink-0 bg-background">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total</div>
              <div className="text-2xl font-black tabular-nums leading-none">{formatBRL(total)}</div>
            </div>
            <div className="text-right text-[10px] text-muted-foreground">
              {itemCount} {itemCount === 1 ? "item" : "itens"}
            </div>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            <button
              onClick={() => setShowTransfer(true)}
              className="col-span-1 h-11 rounded-md border border-border hover:bg-accent flex items-center justify-center"
              aria-label="Transferir"
            >
              <ArrowRightLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowCancel(true)}
              className="col-span-1 h-11 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10 flex items-center justify-center"
              aria-label="Cancelar comanda"
            >
              <XCircle className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowClose(true)}
              disabled={items.length === 0 || !session}
              className="col-span-3 h-11 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5 font-bold text-sm"
            >
              <Receipt className="h-4 w-4" /> Fechar {formatBRL(total)}
            </button>
          </div>
          {!session && (
            <p className="text-[10px] text-destructive text-center">
              Abra o caixa para fechar comandas.
            </p>
          )}
        </div>

        {showClose && session && (
          <CloseTabDialog
            tabId={tabId}
            sessionId={session.id}
            total={total}
            onClose={() => setShowClose(false)}
            onDone={() => { setShowClose(false); onAfterAction(); onClose(); }}
          />
        )}
        {showTransfer && (
          <TransferDialog
            tabId={tabId}
            tables={tables}
            currentTableId={tab?.table_id ?? null}
            occupiedTableIds={new Set(allTabs.map((t) => t.table_id).filter(Boolean) as string[])}
            onClose={() => setShowTransfer(false)}
            onDone={() => { setShowTransfer(false); onAfterAction(); }}
          />
        )}
        {showCancel && (
          <CancelDialog
            tabId={tabId}
            onClose={() => setShowCancel(false)}
            onDone={() => { setShowCancel(false); onAfterAction(); onClose(); }}
          />
        )}
      </div>
    </div>
  );
}

function CloseTabDialog({ tabId, sessionId, total, onClose, onDone }: {
  tabId: string; sessionId: string; total: number; onClose: () => void; onDone: () => void;
}) {
  const [method, setMethod] = useState<"dinheiro" | "debito" | "credito" | "pix">("dinheiro");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await rpcCloseTab({
        tabId, sessionId,
        payments: [{ method, amount: total }],
      });
      toast.success("Comanda fechada");
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao fechar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={`Fechar — ${formatBRL(total)}`} onClose={onClose}>
      <label className="block text-xs font-bold mb-2">Forma de pagamento</label>
      <div className="grid grid-cols-2 gap-1.5 mb-4">
        {(["dinheiro", "debito", "credito", "pix"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMethod(m)}
            className={`text-xs font-bold px-3 py-2 rounded-md border-2 uppercase ${
              method === m
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground"
            }`}
          >
            {m}
          </button>
        ))}
      </div>
      <button
        onClick={submit}
        disabled={saving}
        className="w-full bg-primary text-primary-foreground rounded-md py-2 text-sm font-bold disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        Confirmar pagamento
      </button>
    </ModalShell>
  );
}

function TransferDialog({ tabId, tables, currentTableId, occupiedTableIds, onClose, onDone }: {
  tabId: string;
  tables: PdvTableRow[];
  currentTableId: string | null;
  occupiedTableIds: Set<string>;
  onClose: () => void;
  onDone: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await rpcTransferTab(tabId, selected);
      toast.success("Comanda transferida");
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao transferir");
    } finally {
      setSaving(false);
    }
  };

  const available = tables.filter((t) => t.id !== currentTableId && !occupiedTableIds.has(t.id));

  return (
    <ModalShell title="Transferir para outra mesa" onClose={onClose}>
      <div className="grid grid-cols-3 gap-1.5 mb-4 max-h-60 overflow-y-auto">
        {available.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelected(t.id)}
            className={`p-2 rounded-md border-2 text-xs font-bold ${
              selected === t.id ? "border-primary bg-primary/10" : "border-border"
            }`}
          >
            {t.label}
          </button>
        ))}
        {available.length === 0 && (
          <p className="col-span-3 text-xs text-muted-foreground text-center py-3">
            Nenhuma mesa livre.
          </p>
        )}
      </div>
      <button
        onClick={submit}
        disabled={saving || !selected}
        className="w-full bg-primary text-primary-foreground rounded-md py-2 text-sm font-bold disabled:opacity-60"
      >
        {saving ? "Transferindo..." : "Confirmar"}
      </button>
    </ModalShell>
  );
}

function CancelDialog({ tabId, onClose, onDone }: { tabId: string; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (reason.trim().length < 3) return toast.error("Informe um motivo");
    setSaving(true);
    try {
      await rpcCancelTab(tabId, reason.trim());
      toast.success("Comanda cancelada");
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "erro");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Cancelar comanda" onClose={onClose}>
      <label className="block text-xs font-bold mb-1">Motivo</label>
      <textarea
        autoFocus
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        className="w-full border border-input rounded-md px-3 py-2 text-sm mb-4 bg-background"
      />
      <button
        onClick={submit}
        disabled={saving}
        className="w-full bg-destructive text-destructive-foreground rounded-md py-2 text-sm font-bold disabled:opacity-60"
      >
        {saving ? "Cancelando..." : "Cancelar comanda"}
      </button>
    </ModalShell>
  );
}

function ModalShell({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background rounded-lg w-full max-w-md p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-bold text-sm">{title}</h4>
          <button onClick={onClose} className="p-1"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}