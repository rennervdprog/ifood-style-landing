import { ArrowLeft, Lock, Loader2, Receipt, EyeOff, Eye, Scale } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import { parseBRL, parseBRLCentsInput, formatBRLDisplay } from "@/hooks/useBRLInput";
import { PdvDenominationCount } from "@/components/pdv/PdvDenominationCount";
import { PDV_METHODS } from "@/pages/pdv/constants";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { toast } from "sonner";
import type { PdvSession } from "@/pages/pdv/types";

interface Props {
  currentSession: PdvSession | null;
  sessionSummary: any;
  closingAmount: string;
  setClosingAmount: (v: string) => void;
  saldoEsperado: number;
  turnoSangrias: number;
  turnoSuprimentos: number;
  blindClose: boolean;
  setBlindClose: (v: boolean | ((p: boolean) => boolean)) => void;
  setDenominationCounts: (v: Record<string, number>) => void;
  onBack: () => void;
  onConfirm: () => void;
  loading: boolean;
}

export const PdvFechamentoScreen = ({
  currentSession, sessionSummary, closingAmount, setClosingAmount,
  saldoEsperado, turnoSangrias, turnoSuprimentos,
  blindClose, setBlindClose, setDenominationCounts,
  onBack, onConfirm, loading,
}: Props) => {
  const byPayment: Record<string, number> = sessionSummary?.by_payment || {};
  const diffAmount = parseBRL(closingAmount) - saldoEsperado;
  const isOk = !!closingAmount && Math.abs(diffAmount) < 0.05;
  const { confirm, ConfirmDialog } = useConfirmDialog();

  // Vendas por peso — agrega gramas/valor a partir de order_items.metadata
  // dos pedidos do turno (PDV). Sem schema novo.
  const { data: weightSummary } = useQuery({
    queryKey: ["pdv-weight-summary", currentSession?.id],
    enabled: !!currentSession?.id,
    queryFn: async () => {
      const { data: orders } = await supabase
        .from("orders")
        .select("id")
        .eq("pdv_session_id", currentSession!.id);
      const ids = (orders || []).map((o: any) => o.id);
      if (ids.length === 0) return { totalGrams: 0, totalValue: 0, byProduct: [] as any[] };
      const { data: items } = await supabase
        .from("order_items")
        .select("product_id, quantity, unit_price, metadata, products(name)")
        .in("order_id", ids);
      let totalGrams = 0;
      let totalValue = 0;
      const byProduct = new Map<string, { name: string; grams: number; value: number }>();
      (items || []).forEach((it: any) => {
        const g = Number(it?.metadata?.weight_grams || 0);
        if (g <= 0) return;
        const v = Number(it.unit_price) * Number(it.quantity || 1);
        totalGrams += g;
        totalValue += v;
        const name = it.products?.name || "Produto";
        const cur = byProduct.get(it.product_id) || { name, grams: 0, value: 0 };
        cur.grams += g;
        cur.value += v;
        byProduct.set(it.product_id, cur);
      });
      return {
        totalGrams,
        totalValue,
        byProduct: Array.from(byProduct.values()).sort((a, b) => b.value - a.value),
      };
    },
    staleTime: 30_000,
  });

  return (
    <div className="pdv-shell min-h-screen bg-background flex flex-col">
      <header className="h-14 border-b border-border flex items-center px-4 gap-3 bg-card">
        <button onClick={onBack} className="p-1.5 rounded-xl hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Lock className="h-5 w-5 text-destructive" />
        <div className="flex-1">
          <p className="text-sm font-bold">Fechamento de Caixa</p>
          <p className="text-[10px] text-muted-foreground">
            Aberto às {currentSession && new Date(currentSession.opened_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-28">
        <div className="bg-card rounded-2xl border border-border p-4 space-y-4">
          <h3 className="text-sm font-black flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" /> Resumo do Turno
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-emerald-500/8 border border-emerald-500/15 rounded-xl p-3 space-y-0.5">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Total Vendido</p>
              <p className="text-xl font-black text-emerald-500">{formatBRL(sessionSummary?.total_sales ?? 0)}</p>
              <p className="text-[10px] text-muted-foreground">{sessionSummary?.total_orders ?? 0} vendas</p>
            </div>
            <div className="bg-muted/40 rounded-xl p-3 space-y-0.5">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Abertura</p>
              <p className="text-xl font-black text-foreground">{formatBRL(currentSession?.opening_amount ?? 0)}</p>
              <p className="text-[10px] text-muted-foreground">troco inicial</p>
            </div>
            {turnoSangrias > 0 && (
              <div className="bg-red-500/8 border border-red-500/15 rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Sangrias</p>
                <p className="text-lg font-black text-red-500">−{formatBRL(turnoSangrias)}</p>
              </div>
            )}
            {turnoSuprimentos > 0 && (
              <div className="bg-blue-500/8 border border-blue-500/15 rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Suprimentos</p>
                <p className="text-lg font-black text-blue-500">+{formatBRL(turnoSuprimentos)}</p>
              </div>
            )}
          </div>

          {Object.keys(byPayment).length > 0 && (
            <div className="border-t border-border/40 pt-3 space-y-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Por pagamento</p>
              {Object.entries(byPayment).map(([m, v]) => {
                const pm = PDV_METHODS.find(p => p.id === m);
                return (
                  <div key={m} className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{pm?.label || m}</span>
                    <span className="text-sm font-bold">{formatBRL(Number(v))}</span>
                  </div>
                );
              })}
            </div>
          )}

          {!blindClose ? (
            <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-3.5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-amber-700 dark:text-amber-400">Dinheiro esperado no caixa</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Abertura + vendas − sangrias + suprimentos</p>
              </div>
              <p className="text-xl font-black text-amber-500">{formatBRL(saldoEsperado)}</p>
            </div>
          ) : (
            <div className="bg-purple-500/8 border border-purple-500/30 rounded-xl p-3.5 flex items-center gap-3">
              <EyeOff className="h-5 w-5 text-purple-500 shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-bold text-purple-700 dark:text-purple-300">Fechamento cego ativo</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  O valor esperado fica oculto até você confirmar o fechamento. Padrão antifraude.
                </p>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setBlindClose(v => !v)}
            className="w-full text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5"
          >
            {blindClose ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            {blindClose ? "Mostrar valor esperado" : "Ativar fechamento cego (anti-fraude)"}
          </button>
        </div>

        {weightSummary && weightSummary.totalGrams > 0 && (
          <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
            <h3 className="text-sm font-black flex items-center gap-2">
              <Scale className="h-4 w-4 text-primary" /> Vendas por peso
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-primary/8 border border-primary/15 rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Peso total</p>
                <p className="text-lg font-black text-primary">
                  {(weightSummary.totalGrams / 1000).toFixed(3).replace(".", ",")} kg
                </p>
              </div>
              <div className="bg-emerald-500/8 border border-emerald-500/15 rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Valor</p>
                <p className="text-lg font-black text-emerald-500">
                  {formatBRL(weightSummary.totalValue)}
                </p>
              </div>
            </div>
            {weightSummary.byProduct.length > 0 && (
              <div className="border-t border-border/40 pt-2 space-y-1.5">
                {weightSummary.byProduct.map((p: any, i: number) => (
                  <div key={i} className="flex justify-between items-center text-sm">
                    <span className="text-foreground truncate pr-2">
                      {p.name}
                      <span className="text-[10px] text-muted-foreground ml-1">
                        · {(p.grams / 1000).toFixed(3).replace(".", ",")} kg
                      </span>
                    </span>
                    <span className="font-bold tabular-nums">{formatBRL(p.value)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <h3 className="text-sm font-black">Conferência</h3>
          <div>
            <label className="text-xs font-bold text-muted-foreground">Dinheiro contado no caixa</label>
            <div className="relative mt-2">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">R$</span>
              <input
                type="text" inputMode="decimal" placeholder="0,00"
                value={closingAmount}
                onChange={e => {
                  const n = parseBRLCentsInput(e.target.value);
                  setClosingAmount(n > 0 ? formatBRLDisplay(n) : "");
                }}
                className="w-full pl-10 pr-4 py-3.5 bg-muted/40 rounded-xl text-xl font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <PdvDenominationCount
            onChange={(total, counts) => {
              setDenominationCounts(counts);
              if (total > 0) setClosingAmount(total.toFixed(2).replace(".", ","));
            }}
          />

          {closingAmount && !blindClose && (
            <div className={`rounded-xl p-3 flex justify-between items-center border ${isOk ? "bg-emerald-500/8 border-emerald-500/20" : "bg-red-500/8 border-red-500/20"}`}>
              <p className={`text-sm font-bold ${isOk ? "text-emerald-600" : "text-red-500"}`}>
                {isOk ? "✅ Caixa conferido" : diffAmount > 0 ? "⚠️ Sobra" : "⚠️ Falta"}
              </p>
              <p className={`text-lg font-black ${isOk ? "text-emerald-500" : "text-red-500"}`}>
                {isOk ? "—" : formatBRL(Math.abs(diffAmount))}
              </p>
            </div>
          )}
          {closingAmount && blindClose && (
            <div className="rounded-xl p-3 bg-purple-500/8 border border-purple-500/20">
              <p className="text-xs text-purple-600 dark:text-purple-400 font-bold flex items-center gap-1.5">
                <EyeOff className="h-3.5 w-3.5" /> A diferença será calculada após confirmar
              </p>
            </div>
          )}
        </div>
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 p-4 bg-card/95 backdrop-blur-sm border-t border-border"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      >
        <button
          onClick={async () => {
            if (!closingAmount || Number.isNaN(parseBRL(closingAmount))) {
              toast.error("Informe o valor conferido no caixa antes de fechar.");
              return;
            }
            const ok = await confirm({
              title: "Confirmar fechamento do caixa?",
              description: "Esta ação não pode ser desfeita.",
              confirmText: "Fechar caixa",
              variant: "destructive",
            });
            if (!ok) return;
            onConfirm();
          }}
          disabled={loading || !closingAmount}
          className="w-full h-14 bg-destructive text-destructive-foreground font-black text-base rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Lock className="h-5 w-5" />}
          Confirmar Fechamento
        </button>
      </div>
      <ConfirmDialog />
    </div>
  );
};