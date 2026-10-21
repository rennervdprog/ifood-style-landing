import { useState } from "react";
import { ArrowLeft, Lock, Loader2, Receipt, EyeOff, Eye, Scale, Check } from "lucide-react";
import { PdvOperatorLoginDialog } from "@/components/pdv/PdvOperatorLoginDialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { chunk } from "@/lib/batch";
import { formatBRL } from "@/lib/utils";
import { parseBRL, formatBRLDisplay } from "@/hooks/useBRLInput";
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
  storeId?: string;
}

export const PdvFechamentoScreen = ({
  currentSession, sessionSummary, closingAmount, setClosingAmount,
  saldoEsperado, turnoSangrias, turnoSuprimentos,
  blindClose, setBlindClose, setDenominationCounts,
  onBack, onConfirm, loading, storeId: propStoreId,
}: Props) => {
  const byPayment: Record<string, number> = sessionSummary?.by_payment || {};
  const diffAmount = parseBRL(closingAmount) - saldoEsperado;
  // Fase 2: fechamento de caixa exige PIN do gerente.
  const [managerGateOpen, setManagerGateOpen] = useState(false);
  const storeId = propStoreId || currentSession?.store_id;
  const hasAmount = !!closingAmount && !Number.isNaN(parseBRL(closingAmount));
  const isOk = hasAmount && Math.abs(diffAmount) < 0.05;
  const { confirm, ConfirmDialog } = useConfirmDialog();

  // Passo atual do stepper (visual): 1 = contar, 2 = comparar, 3 = autorizar, 4 = pronto
  const currentStep = managerGateOpen ? 3 : hasAmount ? 2 : 1;

  const handleContinue = async () => {
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
    // Fase 2: exige PIN do gerente antes de fechar.
    setManagerGateOpen(true);
  };

  // Vendas por peso — agrega gramas/valor a partir de order_items.metadata
  // dos pedidos do turno (PDV). Sem schema novo.
  const { data: weightSummary } = useQuery({
    queryKey: ["pdv-weight-summary", currentSession?.id],
    enabled: !!currentSession?.id,
    queryFn: async () => {
      const { data: orders } = await supabase
        .from("orders")
        .select("id")
        .eq("pdv_session_id", currentSession!.id)
        .neq("status", "cancelado");
      const ids = (orders || []).map((o: any) => o.id);
      if (ids.length === 0) return { totalGrams: 0, totalValue: 0, byProduct: [] as any[] };
      const batches = await Promise.all(
        chunk(ids, 100).map(async (orderIds) => {
          const { data, error } = await supabase
            .from("order_items")
            .select("product_id, quantity, unit_price, metadata, products(name)")
            .in("order_id", orderIds);
          if (error) throw error;
          return data ?? [];
        }),
      );
      const items = batches.flat();
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

  const stepState = (n: number): "done" | "now" | "todo" => {
    if (n < currentStep) return "done";
    if (n === currentStep) return "now";
    return "todo";
  };

  const renderStepDot = (n: number) => {
    const s = stepState(n);
    return (
      <div className="flex flex-col items-center shrink-0">
        <div
          className={`w-[30px] h-[30px] rounded-full flex items-center justify-center text-sm font-extrabold transition-all ${
            s === "done"
              ? "bg-green-600 text-white"
              : s === "now"
                ? "bg-primary text-white shadow-[0_0_0_5px_rgba(255,106,0,0.15)]"
                : "bg-muted text-muted-foreground"
          }`}
        >
          {s === "done" ? <Check className="h-4 w-4" strokeWidth={3} /> : n}
        </div>
      </div>
    );
  };

  return (
    <div className="pdv-shell min-h-screen bg-background flex flex-col">
      <header className="h-14 border-b border-border flex items-center px-4 gap-3 bg-card shrink-0">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-muted active:scale-95 transition-all" aria-label="Voltar">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <p className="text-base font-bold">Fechar o caixa</p>
          <p className="text-[10px] text-muted-foreground">
            Aberto às {currentSession && new Date(currentSession.opened_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <span className="text-xs font-bold text-muted-foreground">passo {currentStep} de 4</span>
      </header>

      <div className="flex-1 overflow-y-auto p-4 pb-32">
        {/* Stepper */}
        <div className="flex flex-col">
          {/* Passo 1 — Quanto tem na gaveta? */}
          <div className="flex gap-3.5">
            {renderStepDot(1)}
            <div className="flex-1 pb-6">
              <p className="text-[15px] font-bold">Quanto tem na gaveta?</p>
              <p className="text-[13px] text-muted-foreground mt-0.5">Conte o dinheiro e digite o valor.</p>
              {!managerGateOpen && (
                <div className="mt-3 space-y-3">
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">R$</span>
                    <input
                      type="text" inputMode="decimal" placeholder="0,00"
                      value={closingAmount}
                      onChange={e => {
                        const digits = e.target.value.replace(/\D/g, "");
                        if (!digits) { setClosingAmount(""); return; }
                        const n = Number(digits) / 100;
                        setClosingAmount(n === 0 ? "0,00" : formatBRLDisplay(n));
                      }}
                      className="w-full pl-11 pr-4 py-4 bg-card border-2 border-border rounded-2xl text-[22px] font-extrabold text-center focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <PdvDenominationCount
                    onChange={(total, counts) => {
                      setDenominationCounts(counts);
                      if (total > 0) setClosingAmount(total.toFixed(2).replace(".", ","));
                    }}
                  />
                </div>
              )}
              {managerGateOpen && (
                <p className="text-[26px] font-extrabold mt-2 tabular-nums">{formatBRL(parseBRL(closingAmount))}</p>
              )}
            </div>
          </div>
          <div className="w-0.5 bg-border ml-[27px] -mt-4 mb-0 h-4" />

          {/* Passo 2 — Confere com o esperado? */}
          <div className="flex gap-3.5">
            {renderStepDot(2)}
            <div className="flex-1 pb-6">
              <p className="text-[15px] font-bold">Confere com o esperado?</p>
              {!blindClose ? (
                <p className="text-[13px] text-muted-foreground mt-0.5">
                  O sistema esperava <b className="text-foreground">{formatBRL(saldoEsperado)}</b>.
                </p>
              ) : (
                <p className="text-[13px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                  <EyeOff className="h-3.5 w-3.5" /> Fechamento cego: o esperado está oculto.
                </p>
              )}
              {hasAmount && !blindClose && (
                <div className={`mt-2.5 rounded-xl px-4 py-3 flex justify-between items-center font-bold ${
                  isOk ? "bg-green-600/10 text-green-700 dark:text-green-400"
                  : diffAmount > 0 ? "bg-green-600/10 text-green-700 dark:text-green-400"
                  : "bg-red-500/10 text-red-600 dark:text-red-400"
                }`}>
                  <span className="text-sm uppercase tracking-wide">
                    {isOk ? "Conferido" : diffAmount > 0 ? "Sobra" : "Falta"}
                  </span>
                  <span className="text-xl font-extrabold tabular-nums">
                    {isOk ? "—" : formatBRL(Math.abs(diffAmount))}
                  </span>
                </div>
              )}
              {hasAmount && blindClose && (
                <p className="text-xs text-purple-600 dark:text-purple-400 font-bold mt-2">
                  A diferença será calculada após confirmar.
                </p>
              )}
              <button
                type="button"
                onClick={() => setBlindClose(v => !v)}
                className="mt-2 text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
              >
                {blindClose ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                {blindClose ? "Mostrar valor esperado" : "Fechamento cego (anti-fraude)"}
              </button>
            </div>
          </div>
          <div className="w-0.5 bg-border ml-[27px] -mt-4 mb-0 h-4" />

          {/* Passo 3 — Gerente autoriza */}
          <div className="flex gap-3.5">
            {renderStepDot(3)}
            <div className="flex-1 pb-6">
              <p className="text-[15px] font-bold">Gerente autoriza</p>
              <p className="text-[13px] text-muted-foreground mt-0.5">PIN do gerente pra confirmar o fechamento.</p>
            </div>
          </div>
          <div className="w-0.5 bg-border ml-[27px] -mt-4 mb-0 h-4" />

          {/* Passo 4 — Pronto */}
          <div className="flex gap-3.5">
            {renderStepDot(4)}
            <div className="flex-1">
              <p className="text-[15px] font-bold">Pronto!</p>
              <p className="text-[13px] text-muted-foreground mt-0.5">Resumo do turno salvo.</p>
            </div>
          </div>
        </div>

        {/* Resumo do turno (compacto) */}
        <details className="mt-4 bg-card rounded-2xl border border-border">
          <summary className="p-4 text-sm font-bold flex items-center gap-2 cursor-pointer list-none">
            <Receipt className="h-4 w-4 text-primary" /> Resumo do turno
            <span className="ml-auto text-xs text-muted-foreground font-semibold">ver</span>
          </summary>
          <div className="px-4 pb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Total vendido</p>
                <p className="text-xl font-extrabold text-emerald-600">{formatBRL(sessionSummary?.total_sales ?? 0)}</p>
                <p className="text-[10px] text-muted-foreground">{sessionSummary?.total_orders ?? 0} vendas</p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Abertura</p>
                <p className="text-xl font-extrabold">{formatBRL(currentSession?.opening_amount ?? 0)}</p>
                <p className="text-[10px] text-muted-foreground">troco inicial</p>
              </div>
              {turnoSangrias > 0 && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Sangrias</p>
                  <p className="text-lg font-extrabold text-red-500">−{formatBRL(turnoSangrias)}</p>
                </div>
              )}
              {turnoSuprimentos > 0 && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Suprimentos</p>
                  <p className="text-lg font-extrabold text-blue-500">+{formatBRL(turnoSuprimentos)}</p>
                </div>
              )}
            </div>
            {Object.keys(byPayment).length > 0 && (
              <div className="border-t border-border/40 pt-3 space-y-1.5">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Por pagamento</p>
                {Object.entries(byPayment).map(([m, v]) => {
                  const pm = PDV_METHODS.find(p => p.id === m);
                  return (
                    <div key={m} className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">{pm?.label || m}</span>
                      <span className="text-sm font-bold tabular-nums">{formatBRL(Number(v))}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {weightSummary && weightSummary.totalGrams > 0 && (
              <div className="border-t border-border/40 pt-3">
                <p className="text-sm font-bold flex items-center gap-2">
                  <Scale className="h-4 w-4 text-primary" /> Vendas por peso
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {(weightSummary.totalGrams / 1000).toFixed(3).replace(".", ",")} kg · {formatBRL(weightSummary.totalValue)}
                </p>
              </div>
            )}
          </div>
        </details>
      </div>

      {/* CTA fixo */}
      <div
        className="fixed bottom-0 left-0 right-0 p-4 bg-card/95 backdrop-blur-sm border-t border-border"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      >
        <button
          onClick={handleContinue}
          disabled={loading || !hasAmount}
          className="w-full h-14 bg-primary text-white font-extrabold text-base rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg shadow-primary/30 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Lock className="h-5 w-5" />}
          Continuar
        </button>
      </div>
      <ConfirmDialog />
      {managerGateOpen && storeId && (
        <PdvOperatorLoginDialog
          open={managerGateOpen}
          storeId={storeId}
          requiredRole="gerente"
          title="Gerente: autorize o fechamento"
          onClose={() => setManagerGateOpen(false)}
          onLogin={(op) => {
            setManagerGateOpen(false);
            toast.success(`Fechamento autorizado por ${op.name}`);
            onConfirm();
          }}
        />
      )}
    </div>
  );
};
