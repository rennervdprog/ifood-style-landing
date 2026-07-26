import { useMemo, useState } from "react";
import { ChevronDown, Users, Receipt, Store, Plus, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usePdvTables, rpcOpenTab } from "@/pages/pdv/state/usePdvTables";
import { toast } from "sonner";

interface Props {
  storeId: string | undefined | null;
  tableId: string;
  setTableId: (v: string) => void;
  selectedTable: { id: string; label: string } | null;
  setSelectedTable: (v: { id: string; label: string } | null) => void;
  selectedTabId: string | null;
  setSelectedTabId: (v: string | null) => void;
}

/**
 * Seletor real de Mesa/Comanda para o carrinho do PDV.
 * Integra com pdv_tables + pdv_tabs em vez do input de texto livre.
 */
export const PdvTableSelector = ({
  storeId, tableId, setTableId,
  selectedTable, setSelectedTable,
  selectedTabId, setSelectedTabId,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [freeCode, setFreeCode] = useState("");
  const { tables, tabs, refresh } = usePdvTables(storeId);

  const tabByTable = useMemo(() => {
    const m = new Map<string, string>();
    tabs.forEach((t) => { if (t.table_id) m.set(t.table_id, t.id); });
    return m;
  }, [tabs]);

  const looseTabs = useMemo(() => tabs.filter((t) => !t.table_id), [tabs]);

  const clear = () => {
    setSelectedTable(null);
    setSelectedTabId(null);
    setTableId("");
    setOpen(false);
  };

  const pickTable = async (t: { id: string; label: string; status: string }) => {
    const existingTab = tabByTable.get(t.id);
    setSelectedTable({ id: t.id, label: t.label });
    setTableId(`Mesa ${t.label}`);
    if (existingTab) {
      setSelectedTabId(existingTab);
      setOpen(false);
      return;
    }
    // Abre a comanda da mesa on-demand
    if (!storeId) return;
    try {
      const tabId = await rpcOpenTab({ storeId, tableId: t.id });
      setSelectedTabId(tabId);
      refresh();
      setOpen(false);
    } catch (e: any) {
      toast.error(`Falha ao abrir comanda: ${e?.message ?? "erro"}`);
    }
  };

  const pickLooseTab = (t: { id: string; code: string | null; customer_name: string | null }) => {
    setSelectedTable(null);
    setSelectedTabId(t.id);
    setTableId(t.code || t.customer_name || "Comanda");
    setOpen(false);
  };

  const createLooseTab = async () => {
    if (!storeId) return;
    const code = freeCode.trim();
    if (!code) { toast.error("Informe um código ou nome"); return; }
    try {
      const tabId = await rpcOpenTab({ storeId, code, customerName: null });
      setSelectedTable(null);
      setSelectedTabId(tabId);
      setTableId(code);
      setFreeCode("");
      refresh();
      setOpen(false);
    } catch (e: any) {
      toast.error(`Falha: ${e?.message ?? "erro"}`);
    }
  };

  const badgeLabel = selectedTabId
    ? (selectedTable ? `Mesa ${selectedTable.label}` : (tableId || "Comanda"))
    : "Balcão";
  const active = !!selectedTabId;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`text-[11px] font-bold rounded-lg px-2.5 py-1.5 border flex items-center gap-1.5 transition-colors ${
            active
              ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40"
              : "bg-muted/40 text-muted-foreground border-border/50 hover:bg-muted"
          }`}
        >
          {active ? <Receipt className="h-3 w-3" /> : <Store className="h-3 w-3" />}
          <span className="truncate max-w-[110px]">{badgeLabel}</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0 max-h-[70vh] overflow-y-auto">
        <button
          onClick={clear}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold hover:bg-muted transition-colors border-b"
        >
          <Store className="h-3.5 w-3.5" /> Balcão / Venda avulsa
          {!active && <Check className="h-3.5 w-3.5 ml-auto text-primary" />}
        </button>

        {tables.length > 0 && (
          <div className="p-2 border-b">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1 pb-1.5">
              Mesas
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {tables.map((t) => {
                const hasTab = tabByTable.has(t.id);
                const sel = selectedTable?.id === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => pickTable(t)}
                    className={`text-xs font-bold px-2 py-2 rounded-md border transition-all ${
                      sel
                        ? "bg-amber-500 text-white border-amber-600"
                        : hasTab
                          ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                          : "bg-muted/40 border-border hover:bg-muted"
                    }`}
                    title={hasTab ? "Comanda aberta" : "Livre"}
                  >
                    <div>{t.label}</div>
                    <div className="text-[9px] font-normal opacity-70 flex items-center justify-center gap-0.5">
                      <Users className="h-2.5 w-2.5" />{t.seats}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {looseTabs.length > 0 && (
          <div className="p-2 border-b">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1 pb-1.5">
              Comandas avulsas abertas
            </p>
            <div className="space-y-1">
              {looseTabs.map((t) => {
                const sel = selectedTabId === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => pickLooseTab(t)}
                    className={`w-full text-left text-xs px-2 py-1.5 rounded-md flex items-center gap-2 ${
                      sel ? "bg-amber-500/20" : "hover:bg-muted"
                    }`}
                  >
                    <Receipt className="h-3 w-3 opacity-70" />
                    <span className="font-semibold truncate">{t.code || t.customer_name || "Sem nome"}</span>
                    {sel && <Check className="h-3 w-3 ml-auto text-primary" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="p-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1 pb-1.5">
            Nova comanda avulsa
          </p>
          <div className="flex gap-1.5">
            <input
              value={freeCode}
              onChange={(e) => setFreeCode(e.target.value)}
              placeholder="Nome/código"
              className="flex-1 text-xs bg-muted/40 rounded-md px-2 py-1.5 border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); createLooseTab(); } }}
            />
            <button
              onClick={createLooseTab}
              className="text-xs font-bold px-2.5 py-1.5 bg-primary text-primary-foreground rounded-md flex items-center gap-1"
            >
              <Plus className="h-3 w-3" /> Abrir
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};