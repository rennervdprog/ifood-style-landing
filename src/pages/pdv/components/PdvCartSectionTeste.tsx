import { useState } from "react";
import {
  X, RotateCcw, ShoppingCart, Tag, ChevronDown, Loader2, Send,
} from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/utils";
import type { CartItem, SaleSnapshot } from "@/pages/pdv/types";
import { PdvTableSelector } from "./PdvTableSelector";
import { PdvOperatorLoginDialog } from "@/components/pdv/PdvOperatorLoginDialog";

/**
 * TELA 6 — Carrinho do PDV no /admin-teste (cópia de PdvCartSection).
 * Mesma lógica, mesmos rótulos, mesmos cálculos. Só muda a hierarquia:
 * 1) UM primário por tela: "Receber R$ X" é cheio (primário) também no
 *    modo comanda, e "Enviar à comanda" vira ação secundária vazada
 *    (nunca âmbar cheio competindo com o primário) — e o primário vem
 *    primeiro na ordem visual. Altura única h-12 (canon Tela 1).
 * 2) O limite de desconto é avisado ANTES do PIN: o campo mostra, sempre
 *    visível, que acima de 10% o sistema pede o PIN do gerente.
 * 3) Tipografia nos papéis da Tela 1 (sem micro-texto 10/11px) e valores
 *    em pdv-mono (mantido). Desconto em text-success (token), não emerald.
 * O carrinho em si já é um só componente; a unificação desktop/mobile
 * vive no PdvPageTeste, que define esta seção uma única vez e a usa
 * nos dois ramos (antes, a lista de props era duplicada no PdvPage).
 */

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
  restoreCart?: (snapshot: SaleSnapshot) => void;
  subtotal: number;
  discountAmount: number;
  finalTotal: number;
  showDiscount: boolean;
  setShowDiscount: (v: boolean | ((p: boolean) => boolean)) => void;
  discountType: "R$" | "%";
  setDiscountType: (v: "R$" | "%") => void;
  discountInput: string;
  setDiscountInput: (v: string) => void;
  /** Recebe o índice da linha (permite remover linhas diferentes do mesmo produto). */
  removeItem: (index: number) => void;
  loading: boolean;
  orderDone: boolean;
  mobileScroll?: boolean;
  /** Vai para a tela de pagamento (fluxo: carrinho → pagamento). */
  onGoToPayment: () => void;
}

export const PdvCartSectionTeste = ({
  cart, storeId, tableId, setTableId,
  selectedTable, setSelectedTable, selectedTabId, setSelectedTabId, onSendToTab,
  totalItems, clearSale, restoreCart,
  subtotal, discountAmount, finalTotal,
  showDiscount, setShowDiscount, discountType, setDiscountType,
  discountInput, setDiscountInput,
  removeItem, loading, orderDone,
  mobileScroll = false,
  onGoToPayment,
}: Props) => {
  // Proteção de desconto: acima de 10% exige PIN do gerente
  const [showManagerGate, setShowManagerGate] = useState(false);
  const [pendingDiscount, setPendingDiscount] = useState<string | null>(null);

  // Limpar a venda e remover item também exigem PIN do gerente
  const [gatePurpose, setGatePurpose] = useState<"clear" | "remove" | null>(null);
  const [pendingRemoveIndex, setPendingRemoveIndex] = useState<number | null>(null);

  const DISCOUNT_MANAGER_LIMIT = 10; // %

  const handleDiscountChange = (raw: string) => {
    const clean = raw.replace(/[^\d,]/g, "");
    // Proteção nos DOIS modos: no modo R$, converte o valor pra % do subtotal
    // e aplica o mesmo limite (antes, desconto alto em R$ burlava a autorização).
    const v = parseFloat(clean.replace(",", "."));
    if (!isNaN(v)) {
      const pct = discountType === "%" ? v : subtotal > 0 ? (v / subtotal) * 100 : 0;
      if (pct > DISCOUNT_MANAGER_LIMIT + 1e-9) {
        // Guarda o valor pendente, limpa o campo (não deixa desconto parcial
        // aplicado atrás do modal) e pede autorização do gerente
        setPendingDiscount(clean);
        setDiscountInput("");
        setShowManagerGate(true);
        return;
      }
    }
    setDiscountInput(clean);
  };

  const handleManagerApproved = () => {
    if (pendingDiscount !== null) {
      setDiscountInput(pendingDiscount);
      toast.success("Desconto autorizado pelo gerente");
    }
    setPendingDiscount(null);
    setShowManagerGate(false);
  };

  const handleManagerClosed = () => {
    setPendingDiscount(null);
    setShowManagerGate(false);
    toast.info("Desconto acima de 10% precisa de autorização do gerente");
  };

  const inTabMode = !!selectedTabId;
  const cartEmpty = cart.length === 0;
  const ctaDisabled = cartEmpty || loading || orderDone;

  const handleClearSale = () => {
    // Limpar a venda inteira exige autorização do gerente.
    setGatePurpose("clear");
  };

  const executeClearSale = () => {
    // Snapshot da venda para o "Desfazer" (campos de pagamento preenchidos vazios —
    // o pagamento agora acontece na tela própria).
    const snapshot: SaleSnapshot = {
      items: [...cart],
      paymentMethod: "",
      tableId,
      selectedTable,
      selectedTabId,
      discountType,
      discountInput,
      cashReceived: "",
      splitMode: false,
      splitPayments: [],
    };
    clearSale();
    toast.warning("Venda limpa", {
      action: restoreCart ? {
        label: "Desfazer",
        onClick: () => restoreCart(snapshot),
      } : undefined,
      duration: 5000,
    });
  };

  return (
  <div className={mobileScroll ? "flex flex-col min-h-0 overflow-visible" : "flex flex-col h-full min-h-0 overflow-hidden"}>
    {/* Cabeçalho */}
    <div className={`px-3 pt-2.5 pb-2 border-b shrink-0 transition-colors ${inTabMode ? "border-amber-500/40 bg-amber-500/5" : "border-border"}`}>
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
          <span className="text-xs text-muted-foreground">{totalItems} itens</span>
          {!cartEmpty && (
            <button onClick={handleClearSale} aria-label="Limpar venda" title="Limpar venda (ESC)"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
              <RotateCcw className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>
      {inTabMode && (
        <p className="text-xs text-amber-700 dark:text-amber-300 mt-1.5 font-semibold">
          Modo comanda — itens serão acumulados sem cobrar.
        </p>
      )}
    </div>

    {/* Itens */}
    <div className={mobileScroll ? "p-2 space-y-1" : "flex-1 overflow-y-auto p-2 space-y-1 min-h-0"}>
      {cartEmpty ? (
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
              <span className="text-xs font-black text-primary">
                {item.metadata?.weight_grams
                  ? `${item.metadata.weight_grams}g`
                  : item.quantity}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{item.name}</p>
              {item.metadata?.weight_grams && item.metadata?.price_per_kg ? (
                <p className="text-xs text-muted-foreground truncate">
                  {item.metadata.weight_grams} g × {formatBRL(Number(item.metadata.price_per_kg))}/kg
                </p>
              ) : null}
              {item.addons && item.addons.length > 0 && (
                <p className="text-xs text-muted-foreground truncate">
                  {item.addons.map(a => a.name).join(", ")}
                </p>
              )}
              {item.observations && !item.metadata?.weight_grams && (
                <p className="text-xs text-amber-600 italic truncate">"{item.observations}"</p>
              )}
            </div>
            <p className="text-xs font-black text-foreground shrink-0 pdv-mono">{formatBRL(item.price * item.quantity)}</p>
            {/* removeItem(idx) — índice da linha, não do produto */}
            <button onClick={() => { setPendingRemoveIndex(idx); setGatePurpose("remove"); }} aria-label="Remover item"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors shrink-0">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      ))}
    </div>

    {/* Rodapé: desconto, totais e ação */}
    <div className="border-t border-border shrink-0 bg-card">
      {/* Desconto */}
      <div className="px-3 pt-2.5">
        <button onClick={() => setShowDiscount(!showDiscount)}
          title="Desconto (F3)"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full">
          <Tag className="h-3 w-3" />
          {discountAmount > 0
            ? <span className="text-success font-bold">Desconto: −{formatBRL(discountAmount)}</span>
            : <span>Desconto</span>}
          <kbd className="ml-1 px-1.5 py-0.5 rounded bg-muted text-xs font-black text-muted-foreground">F3</kbd>
          <ChevronDown className={`h-3 w-3 ml-auto transition-transform ${showDiscount ? "rotate-180" : ""}`} />
        </button>
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
          Acima de 10% de desconto, o sistema pede o PIN do gerente antes de aplicar.
        </p>
        {showDiscount && (
          <div className="mt-2 rounded-xl border border-warning/30 bg-warning/10 px-2.5 py-2">
            <p className="text-xs font-bold text-foreground">
              Acima de 10%, o PIN do gerente será pedido
            </p>
            <p className="text-xs text-muted-foreground">
              Vale para desconto em % e em R$ — em R$, o valor é convertido para % do subtotal antes de comparar com o limite.
            </p>
          </div>
        )}
        {showDiscount && (
          <div className="mt-2 flex items-center gap-1.5">
            <div className="flex rounded-lg overflow-hidden border border-border shrink-0">
              <button onClick={() => setDiscountType("R$")} className={`px-2.5 py-1.5 text-xs font-bold transition-colors ${discountType === "R$" ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground"}`}>R$</button>
              <button onClick={() => setDiscountType("%")} className={`px-2.5 py-1.5 text-xs font-bold transition-colors ${discountType === "%" ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground"}`}>%</button>
            </div>
            <input type="text" inputMode="decimal"
              placeholder={discountType === "%" ? "10" : "5,00"}
              value={discountInput} onChange={(e) => handleDiscountChange(e.target.value)}
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
            <span className="text-success">Desconto</span>
            <span className="font-bold text-success pdv-mono">−{formatBRL(discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-between items-baseline pt-1 border-t border-border/40">
          <span className="text-sm font-extrabold">Total</span>
          <span className="text-2xl font-extrabold text-primary pdv-mono">{formatBRL(finalTotal)}</span>
        </div>
      </div>

      {/* Ações */}
      <div className="px-3 pb-3 pt-1 space-y-1.5">
        {inTabMode ? (
          <>
            <button
              onClick={onGoToPayment}
              disabled={ctaDisabled}
              className="w-full h-12 bg-primary text-primary-foreground font-extrabold text-base rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg shadow-primary/25 disabled:opacity-50"
            >
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Aguarde...</>
                : <>Receber {formatBRL(finalTotal)}</>}
            </button>
            <button
              onClick={onSendToTab}
              disabled={ctaDisabled}
              className="w-full h-12 border border-border bg-card text-foreground font-bold text-sm rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
                : <><Send className="h-4 w-4" /> Enviar {totalItems} {totalItems === 1 ? "item" : "itens"} à comanda</>}
            </button>
          </>
        ) : (
          <button
            onClick={onGoToPayment}
            disabled={ctaDisabled}
            className="w-full h-12 bg-primary text-primary-foreground font-extrabold text-base rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg shadow-primary/25 disabled:opacity-50"
          >
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Aguarde...</>
              : <>Receber {formatBRL(finalTotal)}</>}
          </button>
        )}
      </div>
    </div>

    {/* Autorização do gerente para desconto alto */}
    {showManagerGate && storeId && (
      <PdvOperatorLoginDialog
        open={showManagerGate}
        storeId={storeId}
        onClose={handleManagerClosed}
        onLogin={handleManagerApproved}
        requiredRole="gerente"
        title="Autorização do gerente"
      />
    )}

    {/* Autorização do gerente para limpar a venda / remover item */}
    {gatePurpose !== null && storeId && (
      <PdvOperatorLoginDialog
        open
        storeId={storeId}
        onClose={() => { setGatePurpose(null); setPendingRemoveIndex(null); }}
        onLogin={() => {
          if (gatePurpose === "clear") executeClearSale();
          else if (gatePurpose === "remove" && pendingRemoveIndex !== null) removeItem(pendingRemoveIndex);
          setGatePurpose(null);
          setPendingRemoveIndex(null);
        }}
        requiredRole="gerente"
        title="Autorização do gerente"
      />
    )}
  </div>
  );
};

