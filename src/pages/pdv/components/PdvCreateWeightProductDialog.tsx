import { useEffect, useState } from "react";
import { Scale, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatBRLDisplay, parseBRLCentsInput } from "@/hooks/useBRLInput";

interface Props {
  open: boolean;
  onClose: () => void;
  storeId: string;
  onCreated: () => void;
}

/**
 * Cria um produto exclusivo do PDV vendido por peso (kg).
 * O produto recebe `metadata.pdv_only = true` para NÃO aparecer no cardápio do cliente.
 */
export const PdvCreateWeightProductDialog = ({ open, onClose, storeId, onCreated }: Props) => {
  const [name, setName] = useState("");
  const [pricePerKg, setPricePerKg] = useState(0);
  const [priceDisplay, setPriceDisplay] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setPricePerKg(0);
      setPriceDisplay("");
    }
  }, [open]);

  if (!open) return null;

  const canSave = name.trim().length > 1 && pricePerKg > 0 && !saving;

  const handlePrice = (raw: string) => {
    if (!raw.replace(/\D/g, "")) {
      setPriceDisplay("");
      setPricePerKg(0);
      return;
    }
    const n = parseBRLCentsInput(raw);
    setPricePerKg(n);
    setPriceDisplay(formatBRLDisplay(n));
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload: any = {
        store_id: storeId,
        name: name.trim(),
        price: 0,
        is_available: true,
        sold_by_weight: true,
        price_per_kg: pricePerKg,
        weight_unit: "kg",
        metadata: { pdv_only: true, sold_by_weight: true, price_per_kg: pricePerKg, weight_unit: "kg" },
      };
      const { error } = await supabase.from("products").insert(payload);
      if (error) throw error;
      toast.success("Produto por peso criado");
      onCreated();
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao criar produto");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card rounded-2xl border border-border w-full max-w-sm p-5 space-y-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Scale className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-black text-base">Novo produto por peso</h3>
            <p className="text-[11px] text-muted-foreground">Exclusivo do PDV · não aparece no cardápio</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-muted-foreground">Nome</label>
          <input
            type="text"
            autoFocus
            placeholder="Ex.: Salada self-service"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2.5 bg-muted/40 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-muted-foreground">Preço por kg</label>
          <div className="flex items-center gap-1.5 bg-muted/40 px-3 py-2.5 rounded-xl focus-within:ring-2 focus-within:ring-primary/40">
            <span className="text-muted-foreground font-bold text-sm">R$</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="0,00"
              value={priceDisplay}
              onChange={(e) => handlePrice(e.target.value)}
              className="flex-1 bg-transparent text-sm font-bold focus:outline-none"
            />
            <span className="text-[11px] font-bold text-muted-foreground">/ kg</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 h-11 rounded-xl border border-border text-sm font-bold text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-black hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Criar
          </button>
        </div>
      </div>
    </div>
  );
};