import { useMemo, useState } from "react";
import { ChevronDown, Coins } from "lucide-react";
import { formatBRL, addMoney } from "@/lib/utils";

const DENOMINATIONS = [
  { value: 200, label: "R$ 200" },
  { value: 100, label: "R$ 100" },
  { value: 50, label: "R$ 50" },
  { value: 20, label: "R$ 20" },
  { value: 10, label: "R$ 10" },
  { value: 5, label: "R$ 5" },
  { value: 2, label: "R$ 2" },
  { value: 1, label: "R$ 1 (moeda)" },
  { value: 0.5, label: "R$ 0,50" },
  { value: 0.25, label: "R$ 0,25" },
  { value: 0.1, label: "R$ 0,10" },
];

interface Props {
  /** Recebe o total e o objeto { "200": qty, ... } */
  onChange: (total: number, counts: Record<string, number>) => void;
}

/**
 * Conferência de caixa por cédula/moeda.
 * O usuário digita quantas cédulas/moedas tem de cada valor;
 * o componente soma e dispara onChange com o total.
 */
export const PdvDenominationCount = ({ onChange }: Props) => {
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const total = useMemo(() => {
    const values = DENOMINATIONS.map((d) => d.value * (counts[String(d.value)] || 0));
    return addMoney(0, ...values);
  }, [counts]);

  const update = (val: number, qty: string) => {
    const n = Math.max(0, parseInt(qty || "0", 10) || 0);
    const next = { ...counts, [String(val)]: n };
    setCounts(next);
    onChange(addMoney(0, ...DENOMINATIONS.map((d) => d.value * (next[String(d.value)] || 0))), next);
  };

  return (
    <div className="bg-muted/30 rounded-xl border border-border/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-3 py-2.5 flex items-center gap-2 hover:bg-muted/50 transition-colors"
      >
        <Coins className="h-4 w-4 text-amber-500" />
        <span className="text-xs font-bold flex-1 text-left">
          Conferência por cédula {total > 0 && <span className="text-muted-foreground font-medium">— soma: {formatBRL(total)}</span>}
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="p-3 pt-0 space-y-1.5 border-t border-border/50">
          {DENOMINATIONS.map((d) => (
            <div key={d.value} className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground w-24">{d.label}</span>
              <span className="text-xs text-muted-foreground">×</span>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="0"
                value={counts[String(d.value)] || ""}
                onChange={(e) => update(d.value, e.target.value)}
                className="w-16 px-2 py-1.5 bg-background rounded-lg text-sm font-bold text-center border border-border/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <span className="text-xs font-bold text-foreground ml-auto tabular-nums">
                {formatBRL(d.value * (counts[String(d.value)] || 0))}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};