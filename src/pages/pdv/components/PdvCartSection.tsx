import {
  X, RotateCcw, ShoppingCart, Tag, ChevronDown, ChevronRight,
  Split, Calculator, Wallet, Loader2, CheckCircle2, Send,
} from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { parseBRL } from "@/hooks/useBRLInput";
import { PdvSplitPayment, type SplitPayment } from "@/components/pdv/PdvSplitPayment";
import { PDV_METHODS, COLOR_MAP } from "@/pages/pdv/constants";
import type { CartItem } from "@/pages/pdv/types";
import { PdvTableSelector } from "./PdvTableSelector";

interface Props {
  cart: CartItem[];
  storeId?: string | null;
  tableId: string;
  setTableId: (v: string) => void;
  selectedTable: { id: string; label: string } | null;
  setSelectedTable: (v: { id: string; label: string } | null) => void;
  selectedTabId: string | null;
  setSelectedTabId: (v: string | null) => void;
  onSendToTab?: () => void;
  totalItems: number;
  clearSale: () => void;
  subtotal: number;
  discountAmount: number;
  finalTotal: number;
  showDiscount: boolean;
  setShowDiscount: (v: boolean | ((p: boolean) => boolean)) => void;
  discountType: "R$" | "%";
  setDiscountType: (v: "R$" | "%") => void;
  discountInput: string;
  setDiscountInput: (v: string) => void;
  paymentMethod: string;
  setPaymentMethod: (v: string) => void;
  setCashReceived: (v: string) => void;
  cashReceived: string;
  troco: number;
  trocoNegativo: boolean;
  finalTotal_: number;
  /** Recebe o índice da linha (permite remover linhas diferentes do mesmo produto). */
  removeItem: (index: number) => void;
  onFinalize: () => void;
  loading: boolean;
  orderDone: boolean;
  splitMode: boolean;
  setSplitMode: (v: boolean) => void;
  splitPayments: SplitPayment[];
  setSplitPayments: (v: SplitPayment[]) => void;
}

export const PdvCartSection = ({
  cart, storeId, tableId, setTableId,
  selectedTable, setSelectedTable, selectedTabId, setSelectedTabId, onSendToTab,
  totalItems, clearSale,
  subtotal, discountAmount, finalTotal,
  showDiscount, setShowDiscount, discountType, setDiscountType,
  discountInput, setDiscountInput,
  paymentMethod, setPaymentMethod, setCashReceived, cashReceived,
  troco, trocoNegativo, finalTotal_,
  removeItem, onFinalize, loading, orderDone,
  splitMode, setSplitMode, splitPayments, setSplitPayments,
}: Props) => (
  <div className="flex flex-col h-full min-h-0 overflow-hidden">
    {/* Cabeçalho */}
    <div className={`px-3 pt-2.5 pb-2 border-b shrink-0 transition-colors ${selectedTabId ? "border-amber-500/40 bg-amber-500/5" : "border-border"}`}>
      <div className="flex items-center justify-between">
        <PdvTableSelector
          storeId={storeId}
          tableId={tableId}
          setTableId={setTableId}
          selectedTable={selectedTable}
          setSelectedTable={setSelectedTable}
          selectedTabId={selectedTabId}
          setSelectedTabId={setSelectedTabId}
        />
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">{totalItems} itens</span>
          {cart.length > 0 && (
            <button onClick={() => { if (window.confirm("Limpar toda a venda atual?")) clearSale(); }} aria-label="Limpar venda" className="p-1 rounded-lg hover:bg-muted transition-colors">
              <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>
      {selectedTabId && (
        <p className="text-[10px] text-amber-700 dark:text-amber-300 mt-1.5 font-semibold">
          Modo comanda — itens serão acumulados sem cobrar.
        </p>
      )}
    </div>

    {/* Itens */}
    <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
      {cart.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-2 py-8">
          <div className="w-14 h-14 rounded-2xl bg-muted/40 flex items-center justify-center">
            <ShoppingCart className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <p className="text-xs text-muted-foreground">Selecione os produtos</p>
        </div>
      ) : cart.map((item, idx) => (
        <div key={`${item.id}__${(item.addons||[]).map(a=>a.name).join(",")}__${item.metadata?.weight_grams ?? ""}__${idx}`} className="px-2.5 py-2 rounded-xl hover:bg-muted/30 group transition-colors">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-[11px] font-black text-primary">
                {item.metadata?.weight_grams
                  ? `${item.metadata.weight_grams}g`
                  : item.quantity}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{item.name}</p>
              {item.metadata?.weight_grams && item.metadata?.price_per_kg ? (
                <p className="text-[10px] text-muted-foreground truncate">
                  {item.metadata.weight_grams} g × {formatBRL(Number(item.metadata.price_per_kg))}/kg
                </p>
              ) : null}
              {item.addons && item.addons.length > 0 && (
                <p className="text-[10px] text-muted-foreground truncate">
                  {item.addons.map(a => a.name).join(", ")}
                </p>
              )}
              {item.observations && !item.metadata?.weight_grams && (
                <p className="text-[10px] text-amber-600 italic truncate">"{item.observations}"</p>
              )}
            </div>
            <p className="text-xs font-black text-foreground shrink-0 pdv-mono">{formatBRL(item.price * item.quantity)}</p>
            <button onClick={() => removeItem(idx)} className="p-0.5 text-muted-foreground hover:text-destructive transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100">
            {/* removeItem(idx) — não idx do produto (Bug P0 report) */}
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>

    {/* Pagamento */}
    <div className="border-t border-border shrink-0 bg-card">
      {/* Desconto */}
      <div className="px-3 pt-2.5">
        <button onClick={() => setShowDiscount(!showDiscount)}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors w-full">
          <Tag className="h-3 w-3" />
          {discountAmount > 0
            ? <span className="text-emerald-500 font-bold">Desconto: −{formatBRL(discountAmount)}</span>
            : <span>Desconto</span>}
          <ChevronDown className={`h-3 w-3 ml-auto transition-transform ${showDiscount ? "rotate-180" : ""}`} />
        </button>
        {showDiscount && (
          <div className="mt-2 flex items-center gap-1.5">
            <div className="flex rounded-lg overflow-hidden border border-border shrink-0">
              <button onClick={() => setDiscountType("R$")} className={`px-2.5 py-1.5 text-[11px] font-bold transition-colors ${discountType === "R$" ? "bg-primary text-white" : "bg-muted/50 text-muted-foreground"}`}>R$</button>
              <button onClick={() => setDiscountType("%")} className={`px-2.5 py-1.5 text-[11px] font-bold transition-colors ${discountType === "%" ? "bg-primary text-white" : "bg-muted/50 text-muted-foreground"}`}>%</button>
            </div>
            <input type="text" inputMode="decimal"
              placeholder={discountType === "%" ? "10" : "5,00"}
              value={discountInput} onChange={(e) => setDiscountInput(e.target.value.replace(/[^0-9.,]/g, ""))}
              className="flex-1 px-2.5 py-1.5 bg-muted/40 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary/30 border border-border/50" />
          </div>
        )}
      </div>

      {/* Totais */}
      <div className="px-3 pt-2 pb-1 space-y-0.5">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-semibold pdv-mono">{formatBRL(subtotal)}</span>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-emerald-500">Desconto</span>
            <span className="font-bold text-emerald-500 pdv-mono">−{formatBRL(discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-between items-baseline pt-1 border-t border-border/40">
          <span className="text-sm font-black">Total</span>
          <span className="text-2xl font-black text-primary pdv-mono">{formatBRL(finalTotal)}</span>
        </div>
      </div>

      {/* Toggle Split */}
      {finalTotal > 0 && (
        <div className="px-3 pt-1 pb-1.5 flex items-center justify-between">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Pagamento
          </span>
          <button
            onClick={() => {
              setSplitMode(!splitMode);
              setSplitPayments([]);
              setPaymentMethod("");
              setCashReceived("");
            }}
            className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border transition-colors ${
              splitMode
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
            }`}
          >
            <Split className="h-3 w-3" />
            {splitMode ? "Pagamento único" : "Dividir pagamento"}
          </button>
        </div>
      )}

      {/* Métodos OU Split */}
      {splitMode ? (
        <div className="px-3 pb-2">
          <PdvSplitPayment
            total={finalTotal}
            payments={splitPayments}
            onChange={setSplitPayments}
          />
        </div>
      ) : (
        <div className="px-3 pt-1 pb-2 grid grid-cols-2 gap-1.5">
          {PDV_METHODS.map(pm => {
            const Icon = pm.icon;
            const sel = paymentMethod === pm.id;
            return (
              <button key={pm.id}
                onClick={() => { setPaymentMethod(pm.id); setCashReceived(""); }}
                data-sel={sel}
                className={`flex items-center gap-1.5 px-2.5 py-2.5 rounded-xl border text-left transition-all active:scale-[0.97] ${COLOR_MAP[pm.color]}`}>
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="text-[11px] font-bold truncate">{pm.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Troco */}
      {!splitMode && paymentMethod === "dinheiro" && (
        <div className="mx-3 mb-2 bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 space-y-2">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Calculator className="h-3 w-3" /> Valor recebido
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">R$</span>
            <input type="text" inputMode="decimal"
              placeholder={finalTotal_.toFixed(2).replace(".", ",")}
              value={cashReceived}
              onChange={(e) => setCashReceived(e.target.value.replace(/[^0-9.,]/g, ""))}
              data-pdv-no-hotkey
              className={`w-full pl-8 pr-3 py-2.5 rounded-xl text-xl font-black text-center focus:outline-none focus:ring-2 transition-colors ${trocoNegativo ? "bg-red-500/10 text-red-500 border border-red-500/30" : "bg-white dark:bg-muted/50 border border-border/50 focus:ring-primary/30"}`}
            />
          </div>
          {/* Sugestões de cédulas */}
          {finalTotal_ > 0 && !cashReceived && (
            <div className="flex gap-1.5 flex-wrap">
              {[
                Math.ceil(finalTotal_ / 5) * 5,
                Math.ceil(finalTotal_ / 10) * 10,
                Math.ceil(finalTotal_ / 20) * 20,
                Math.ceil(finalTotal_ / 50) * 50,
              ].filter((v, i, a) => v >= finalTotal_ && a.indexOf(v) === i).slice(0, 4).map(v => (
                <button key={v} onClick={() => setCashReceived(v.toFixed(2).replace(".", ","))}
                  className="text-[11px] font-bold bg-muted/60 hover:bg-muted px-2.5 py-1 rounded-lg transition-colors">
                  R$ {v.toFixed(0)}
                </button>
              ))}
            </div>
          )}
          {cashReceived && (
            <div className={`flex justify-between items-center rounded-xl px-3 py-2.5 ${trocoNegativo ? "bg-red-500/10" : "bg-emerald-500/15"}`}>
              <span className={`text-xs font-bold ${trocoNegativo ? "text-red-500" : "text-emerald-700 dark:text-emerald-400"} flex items-center gap-1`}>
                {trocoNegativo ? "⚠️ Falta" : <><Wallet className="h-3.5 w-3.5" /> Troco</>}
              </span>
              <span className={`text-xl font-black pdv-mono ${trocoNegativo ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"}`}>
                {trocoNegativo ? formatBRL(finalTotal_ - (parseBRL(cashReceived))) : formatBRL(troco)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Finalizar */}
      <div className="px-3 pb-3">
        {(() => {
          const splitTotal = (splitPayments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
          const splitComplete = splitMode && Math.abs(splitTotal - finalTotal) < 0.01;
          const canFinalize =
            !loading && !orderDone && cart.length > 0 &&
            (splitMode ? splitComplete : (!!paymentMethod && !trocoNegativo));
          return (
            <button onClick={onFinalize}
              disabled={!canFinalize}
              className="w-full h-12 bg-primary text-primary-foreground font-black text-sm rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg shadow-primary/25 disabled:opacity-50">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Registrando...</>
                : orderDone ? <><CheckCircle2 className="h-4 w-4" /> Venda registrada!</>
                : <>Finalizar {formatBRL(finalTotal)} <ChevronRight className="h-4 w-4" /></>}
            </button>
          );
        })()}
      </div>
    </div>
  </div>
);