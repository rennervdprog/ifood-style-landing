import { useEffect, useMemo, useState } from "react";
import { Scale, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/utils";
import type { Product } from "@/pages/pdv/types";

interface Props {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  onAdd: (
    product: Product,
    addons: any[],
    observations: string,
    quantity: number,
    totalUnitPrice: number,
    metadata?: Record<string, any>,
  ) => void;
}

/**
 * Modal para venda por peso (PDV).
 * Entrada manual em gramas. Calcula o total proporcional ao preço por kg.
 */
export const PdvWeightDialog = ({ product, open, onClose, onAdd }: Props) => {
  const [grams, setGrams] = useState("");
  const [reading, setReading] = useState(false);
  const [scaleSupported, setScaleSupported] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Feature-flag lida do settings da loja injetado em window (opt-in).
    // Se o navegador não suportar Web Serial, esconde o botão de leitura.
    let cancelled = false;
    (async () => {
      try {
        const flag = (window as any).__pdvScaleEnabled === true;
        if (!flag) return;
        const { isScaleSupported } = await import("@/lib/toledoScale");
        if (!cancelled) setScaleSupported(isScaleSupported());
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (open) setGrams("");
  }, [open, product?.id]);

  const handleReadScale = async () => {
    setReading(true);
    try {
      const { readScaleGrams } = await import("@/lib/toledoScale");
      const g = await readScaleGrams();
      if (g == null) { toast.error("Balança não respondeu. Verifique a conexão."); return; }
      setGrams(String(g));
      toast.success(`Peso lido: ${g} g`);
    } finally { setReading(false); }
  };

  const pricePerKg = useMemo(
    () => Number(product?.price_per_kg ?? product?.price ?? 0) || 0,
    [product],
  );
  const gramsNum = Number((grams || "").replace(/[^0-9]/g, "")) || 0;
  const total = useMemo(
    () => Math.round(((gramsNum / 1000) * pricePerKg) * 100) / 100,
    [gramsNum, pricePerKg],
  );

  if (!open || !product) return null;

  const canAdd = gramsNum > 0 && total > 0;
  const per100g = pricePerKg / 10;

  const handleAdd = () => {
    if (!canAdd) return;
    onAdd(
      product,
      [],
      `${gramsNum} g`,
      1,
      total,
      { weight_grams: gramsNum, price_per_kg: pricePerKg, weight_unit: "kg" },
    );
    onClose();
  };

  const presets = [100, 200, 250, 500, 750, 1000];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card rounded-2xl border border-border w-full max-w-sm p-5 space-y-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Scale className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-black text-base truncate">{product.name}</h3>
            <p className="text-[11px] text-muted-foreground">
              {formatBRL(pricePerKg)} / kg ·{" "}
              <span className="text-foreground/70">{formatBRL(per100g)} a cada 100 g</span>
            </p>
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-muted-foreground">Peso (gramas)</label>
          <div className="relative mt-1.5">
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              placeholder="0"
              value={grams}
              onChange={(e) => setGrams(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
              className="w-full px-4 py-3 bg-muted/40 rounded-xl text-2xl font-black text-center focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
              g
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {presets.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGrams(String(g))}
                className="text-[11px] font-bold bg-muted/60 hover:bg-muted px-2.5 py-1 rounded-lg transition-colors"
              >
                {g >= 1000 ? `${(g / 1000).toFixed(g % 1000 ? 2 : 0)} kg` : `${g} g`}
              </button>
            ))}
          </div>
          {scaleSupported && (
            <button
              type="button"
              onClick={handleReadScale}
              disabled={reading}
              className="w-full mt-2 h-10 rounded-xl bg-primary/10 text-primary border border-primary/30 text-xs font-black flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {reading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Scale className="h-3.5 w-3.5" />}
              Ler balança
            </button>
          )}
        </div>

        <div className="rounded-xl bg-primary/8 border border-primary/20 p-3 flex items-center justify-between">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Total
          </span>
          <span className="text-2xl font-black text-primary pdv-mono">{formatBRL(total)}</span>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 rounded-xl border border-border text-sm font-bold text-muted-foreground hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!canAdd}
            className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-black hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Loader2 className="h-4 w-4 hidden" />
            Adicionar
          </button>
        </div>
      </div>
    </div>
  );
};