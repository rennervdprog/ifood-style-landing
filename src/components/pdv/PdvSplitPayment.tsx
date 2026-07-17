import { useMemo, useState } from "react";
import { Banknote, CreditCard, Smartphone, X, Plus, Wallet, Users } from "lucide-react";
import { formatBRL, addMoney, subtractMoney } from "@/lib/utils";
import { parseBRL } from "@/hooks/useBRLInput";

export interface SplitPayment {
  method: string;
  amount: number;
}

interface Props {
  total: number;
  payments: SplitPayment[];
  onChange: (payments: SplitPayment[]) => void;
}

const METHODS = [
  { id: "dinheiro", label: "Dinheiro", icon: Banknote, color: "emerald" },
  { id: "maquininha_pix", label: "PIX", icon: Smartphone, color: "orange" },
  { id: "maquininha_credito", label: "Crédito", icon: CreditCard, color: "blue" },
  { id: "maquininha_debito", label: "Débito", icon: CreditCard, color: "indigo" },
];

const COLORS: Record<string, string> = {
  emerald: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  blue: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  indigo: "bg-indigo-500/10 text-indigo-600 border-indigo-500/30",
  orange: "bg-primary/10 text-primary border-primary/30",
};

/**
 * Painel de multi-pagamento: cliente paga em mais de uma forma.
 * Mostra saldo restante e permite adicionar/remover pagamentos.
 * Quando soma == total, está completo.
 */
export const PdvSplitPayment = ({ total, payments, onChange }: Props) => {
  const [pickerMethod, setPickerMethod] = useState<string>("dinheiro");
  const [pickerAmount, setPickerAmount] = useState("");
  // Fase 2 item 9 — dividir por pessoa: gera N pagamentos iguais.
  const [peopleCount, setPeopleCount] = useState<number>(2);

  const paid = useMemo(() => addMoney(0, ...payments.map((p) => p.amount)), [payments]);
  const remaining = subtractMoney(total, paid);
  const isComplete = Math.abs(remaining) < 0.01;

  const addPayment = () => {
    const amt = pickerAmount ? parseBRL(pickerAmount) : remaining;
    if (amt <= 0) return;
    const finalAmt = Math.min(amt, remaining);
    onChange([...payments, { method: pickerMethod, amount: finalAmt }]);
    setPickerAmount("");
  };

  const removePayment = (idx: number) =>
    onChange(payments.filter((_, i) => i !== idx));

  /**
   * Divide o total em N partes iguais. A última parte absorve o resto de centavos
   * (ex.: R$ 10 / 3 = 3,33 + 3,33 + 3,34) para não deixar diferença.
   */
  const splitPerPerson = (n: number) => {
    if (n < 2 || total <= 0) return;
    const cents = Math.round(total * 100);
    const base = Math.floor(cents / n);
    const rest = cents - base * n;
    const list: SplitPayment[] = Array.from({ length: n }).map((_, i) => ({
      method: "dinheiro",
      amount: (i === n - 1 ? base + rest : base) / 100,
    }));
    onChange(list);
  };

  const changeMethodAt = (idx: number, method: string) =>
    onChange(payments.map((p, i) => (i === idx ? { ...p, method } : p)));

  return (
    <div className="space-y-2.5">
      {/* Pagamentos já feitos */}
      {payments.length > 0 && (
        <div className="space-y-1.5">
          {payments.map((p, idx) => {
            const m = METHODS.find((x) => x.id === p.method);
            const Icon = m?.icon || Wallet;
            return (
              <div
                key={idx}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${COLORS[m?.color || "emerald"]}`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="text-[10px] font-black shrink-0 opacity-70">#{idx + 1}</span>
                <select
                  value={p.method}
                  onChange={(e) => changeMethodAt(idx, e.target.value)}
                  className="text-xs font-bold flex-1 bg-transparent focus:outline-none cursor-pointer"
                  aria-label="Alterar forma de pagamento"
                >
                  {METHODS.map((mm) => (
                    <option key={mm.id} value={mm.id}>{mm.label}</option>
                  ))}
                </select>
                <span className="text-sm font-black">{formatBRL(p.amount)}</span>
                <button
                  onClick={() => removePayment(idx)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  aria-label="Remover pagamento"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Saldo */}
      <div
        className={`rounded-xl px-3 py-2.5 flex items-center justify-between border ${
          isComplete
            ? "bg-emerald-500/10 border-emerald-500/30"
            : "bg-amber-500/10 border-amber-500/30"
        }`}
      >
        <span className={`text-xs font-bold ${isComplete ? "text-emerald-600" : "text-amber-700 dark:text-amber-400"}`}>
          {isComplete ? "✓ Pagamento completo" : "Falta receber"}
        </span>
        <span
          className={`text-base font-black ${
            isComplete ? "text-emerald-600" : "text-amber-600"
          }`}
        >
          {isComplete ? formatBRL(total) : formatBRL(remaining)}
        </span>
      </div>

      {/* Fase 2 item 9 — dividir por pessoa */}
      {payments.length === 0 && total > 0 && (
        <div className="bg-muted/20 rounded-xl p-2.5 space-y-2 border border-dashed border-border/60">
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-primary" />
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex-1">
              Dividir por pessoa
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPeopleCount((n) => Math.max(2, n - 1))}
              className="h-9 w-9 rounded-lg bg-card border border-border/60 font-black text-sm"
              aria-label="Menos pessoas"
            >−</button>
            <div className="flex-1 text-center">
              <p className="text-lg font-black leading-none">{peopleCount}</p>
              <p className="text-[9px] text-muted-foreground uppercase">
                {formatBRL(total / peopleCount)} cada
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPeopleCount((n) => Math.min(12, n + 1))}
              className="h-9 w-9 rounded-lg bg-card border border-border/60 font-black text-sm"
              aria-label="Mais pessoas"
            >+</button>
            <button
              type="button"
              onClick={() => splitPerPerson(peopleCount)}
              className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-[11px] font-black active:scale-95 transition-transform"
            >
              Dividir
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            Cada pessoa pode trocar sua forma de pagamento depois.
          </p>
        </div>
      )}

      {/* Adicionar pagamento */}
      {!isComplete && (
        <div className="space-y-2 bg-muted/30 rounded-xl p-2.5">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Adicionar pagamento
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {METHODS.map((m) => {
              const Icon = m.icon;
              const sel = pickerMethod === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setPickerMethod(m.id)}
                  className={`flex flex-col items-center gap-1 px-1 py-2 rounded-lg border text-[10px] font-bold transition-all ${
                    sel
                      ? `${COLORS[m.color]} ring-2 ring-offset-1 ring-current ring-offset-background`
                      : "bg-card border-border/60 text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="leading-none">{m.label}</span>
                </button>
              );
            })}
          </div>
          <div className="flex gap-1.5">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">R$</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder={remaining.toFixed(2).replace(".", ",")}
                value={pickerAmount}
                onChange={(e) => setPickerAmount(e.target.value.replace(/[^0-9.,]/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && addPayment()}
                className="w-full pl-9 pr-3 py-2.5 bg-background rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/30 border border-border/60"
              />
            </div>
            <button
              onClick={addPayment}
              className="px-3 h-10 rounded-lg bg-primary text-primary-foreground font-bold text-xs flex items-center gap-1 active:scale-95 transition-transform"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            Deixe vazio para usar o restante ({formatBRL(remaining)})
          </p>
        </div>
      )}
    </div>
  );
};