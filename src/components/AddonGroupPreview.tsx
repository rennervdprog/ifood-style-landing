import { Eye } from "lucide-react";
import { formatBRL } from "@/lib/utils";

export interface AddonPreviewItem {
  name: string;
  price: number;
}

interface AddonGroupPreviewProps {
  name: string;
  minSelect: number;
  maxSelect: number;
  priceReplacesBase: boolean;
  items: AddonPreviewItem[];
}

/**
 * Prévia ao vivo de como o grupo de adicionais aparece pro cliente.
 * Apenas exibição — os marcadores (radio/checkbox) são visuais e nada é salvo aqui.
 * Quando priceReplacesBase está ligado, o preço do item substitui o preço base
 * do produto, então ele aparece sem o "+" dos adicionais comuns.
 */
const AddonGroupPreview = ({ name, minSelect, maxSelect, priceReplacesBase, items }: AddonGroupPreviewProps) => {
  const singleChoice = maxSelect <= 1;
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        <Eye className="h-3.5 w-3.5" />
        Como o cliente vê
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-bold text-foreground truncate">{name.trim() || "Nome do grupo"}</span>
        {minSelect >= 1 ? (
          <span className="text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-full font-bold uppercase shrink-0">
            Obrigatório
          </span>
        ) : (
          <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-bold uppercase shrink-0">
            Opcional
          </span>
        )}
      </div>
      {items.length > 0 ? (
        <div className="space-y-1.5">
          {items.map((item, i) => (
            <div key={i} className="flex items-center justify-between gap-2 bg-card border border-border/60 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-5 h-5 shrink-0 ${singleChoice ? "rounded-full" : "rounded"} border-2 border-muted-foreground/40`} />
                <span className="text-sm text-foreground truncate">{item.name}</span>
              </div>
              <span className="text-sm text-primary font-bold shrink-0">
                {item.price > 0 ? (priceReplacesBase ? formatBRL(item.price) : `+${formatBRL(item.price)}`) : "Grátis"}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-3">
          Os itens que você adicionar aparecem aqui.
        </p>
      )}
    </div>
  );
};

export default AddonGroupPreview;
