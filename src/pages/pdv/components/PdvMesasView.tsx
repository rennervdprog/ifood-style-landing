import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, X, Trash2, ArrowRightLeft, XCircle, Receipt, CheckCircle2 } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  usePdvTables,
  usePdvTabItems,
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

const STATUS_COLORS: Record<string, string> = {
  free: "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300",
  occupied: "bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300",
  billing: "bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-300",
};

const STATUS_LABEL: Record<string, string> = {
  free: "Livre",
  occupied: "Ocupada",
  billing: "Fechando",
};

export const PdvMesasView = ({ storeId, session, products }: Props) => {
  const { tables, tabs, loading, refresh } = usePdvTables(storeId);
  const [selectedTabId, setSelectedTabId] = useState<string | null>(null);
  const [showNewTable, setShowNewTable] = useState(false);
  const [showQuickTab, setShowQuickTab] = useState(false);

  const tabByTable = useMemo(() => {
    const m = new Map<string, PdvTabRow>();
    for (const t of tabs) if (t.table_id) m.set(t.table_id, t);
    return m;
  }, [tabs]);

  const looseTabs = tabs.filter((t) => !t.table_id);

  const openTable = async (t: PdvTableRow) => {
    const existing = tabByTable.get(t.id);
    if (existing) {
      setSelectedTabId(existing.id);
      return;
    }
    if (t.status !== "free") {
      toast.error("Mesa não está livre");
      return;
    }
    try {
      const tabId = await rpcOpenTab({ storeId, tableId: t.id });
      refresh();
      setSelectedTabId(tabId);
    } catch (e: any) {
      toast.error(`Falha ao abrir mesa: ${e?.message ?? "erro"}`);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-3">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Mesas e comandas
          </p>
          <p className="text-[10px] text-muted-foreground">
            {tables.length} mesas · {tabs.length} comandas abertas
          </p>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setShowQuickTab(true)}
            className="text-xs font-bold px-3 py-1.5 rounded-md border border-primary text-primary hover:bg-primary/10 flex items-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" /> Comanda avulsa
          </button>
          <button
            onClick={() => setShowNewTable(true)}
            className="text-xs font-bold px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" /> Nova mesa
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && tables.length === 0 && looseTabs.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Nenhuma mesa cadastrada. Clique em "Nova mesa" para começar.
        </div>
      )}

      {tables.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-4">
          {tables.map((t) => {
            const tab = tabByTable.get(t.id);
            const status = tab ? "occupied" : t.status;
            return (
              <button
                key={t.id}
                onClick={() => openTable(t)}
                className={`p-3 rounded-lg border-2 text-left transition-colors ${STATUS_COLORS[status]}`}
              >
                <div className="flex items-start justify-between">
                  <span className="font-bold text-sm">{t.label}</span>
                  <span className="text-[10px] font-semibold uppercase">{STATUS_LABEL[status]}</span>
                </div>
                <div className="text-[10px] mt-1 opacity-80">{t.seats} lugares</div>
                {tab && (
                  <div className="text-[10px] mt-1 font-semibold">
                    {tab.customer_name ?? "Comanda aberta"}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {looseTabs.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
            Comandas avulsas
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {looseTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedTabId(tab.id)}
                className="p-3 rounded-lg border-2 border-primary/40 bg-primary/10 text-left"
              >
                <div className="flex items-start justify-between">
                  <span className="font-bold text-sm">
                    {tab.code ? `#${tab.code}` : "Comanda"}
                  </span>
                </div>
                <div className="text-[10px] mt-1">
                  {tab.customer_name ?? "Sem nome"}
                </div>
              </button>
            ))}
          </div>
        </div>
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

  const total = items.reduce((s, it) => s + Number(it.quantity) * Number(it.unit_price), 0);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products.slice(0, 20);
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 30);
  }, [products, query]);

  const addProduct = async (p: Product) => {
    try {
      await rpcAddTabItem({
        tabId, productId: p.id, name: p.name, quantity: 1, unitPrice: Number(p.price ?? 0),
      });
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

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center sm:justify-center" onClick={onClose}>
      <div
        className="bg-background w-full sm:max-w-3xl sm:rounded-lg max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-3 border-b border-border">
          <div>
            <h3 className="font-bold text-sm">
              {tab?.table_id
                ? tables.find((t) => t.id === tab.table_id)?.label
                : tab?.code ? `Comanda #${tab.code}` : "Comanda"}
            </h3>
            {tab?.customer_name && (
              <p className="text-[10px] text-muted-foreground">{tab.customer_name}</p>
            )}
          </div>
          <button onClick={onClose} className="p-1"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid sm:grid-cols-2 flex-1 overflow-hidden">
          {/* Produtos */}
          <div className="border-r border-border flex flex-col overflow-hidden">
            <div className="p-2 border-b border-border">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar produto..."
                className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredProducts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addProduct(p)}
                  className="w-full text-left p-2 rounded-md hover:bg-accent flex items-center justify-between"
                >
                  <span className="text-xs font-semibold truncate">{p.name}</span>
                  <span className="text-xs font-bold tabular-nums shrink-0 ml-2">
                    {formatBRL(Number(p.price ?? 0))}
                  </span>
                </button>
              ))}
              {filteredProducts.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhum produto</p>
              )}
            </div>
          </div>

          {/* Itens da comanda */}
          <div className="flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {items.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">
                  Nenhum item na comanda ainda
                </p>
              )}
              {items.map((it) => (
                <div key={it.id} className="flex items-center justify-between p-2 rounded-md bg-card border border-border">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">
                      {it.quantity}× {it.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground tabular-nums">
                      {formatBRL(Number(it.unit_price))} · Subtotal {formatBRL(Number(it.quantity) * Number(it.unit_price))}
                    </p>
                  </div>
                  <button
                    onClick={() => removeItem(it.id)}
                    className="p-1 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">Total</span>
            <span className="text-lg font-black tabular-nums">{formatBRL(total)}</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              onClick={() => setShowTransfer(true)}
              className="text-[11px] font-bold px-2 py-2 rounded-md border border-border hover:bg-accent flex items-center justify-center gap-1"
            >
              <ArrowRightLeft className="h-3 w-3" /> Transferir
            </button>
            <button
              onClick={() => setShowCancel(true)}
              className="text-[11px] font-bold px-2 py-2 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10 flex items-center justify-center gap-1"
            >
              <XCircle className="h-3 w-3" /> Cancelar
            </button>
            <button
              onClick={() => setShowClose(true)}
              disabled={items.length === 0 || !session}
              className="text-[11px] font-bold px-2 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1"
            >
              <Receipt className="h-3 w-3" /> Fechar
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