import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { X, Printer } from "lucide-react";
import { formatBRL } from "@/lib/utils";

export interface LabelData {
  productName: string;
  size?: string | null;
  color?: string | null;
  price: number;
  sku?: string | null;
  barcode?: string | null;
}

interface Props {
  items: LabelData[];
  onClose: () => void;
}

/**
 * Diálogo de impressão de etiquetas (Boutique). Gera Code128 via JsBarcode em
 * SVG e usa window.print() com CSS @page dimensionado pra 50x30mm — casa com
 * a maioria das etiquetadoras térmicas de balcão.
 */
export default function LabelPrintDialog({ items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.querySelectorAll<SVGSVGElement>("svg[data-barcode]").forEach((svg) => {
      const code = svg.dataset.barcode || "";
      if (!code) return;
      try {
        JsBarcode(svg, code, {
          format: "CODE128",
          displayValue: true,
          fontSize: 10,
          height: 30,
          margin: 2,
        });
      } catch (e) {
        console.warn("barcode error", e);
      }
    });
  }, [items]);

  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-3 print:static print:bg-transparent print:p-0">
      <div className="bg-background rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col print:max-w-none print:max-h-none print:rounded-none">
        <div className="flex items-center justify-between p-3 border-b border-border print:hidden">
          <p className="font-bold text-sm">Etiquetas ({items.length})</p>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-lg px-3 py-1.5 text-xs font-bold"
            >
              <Printer className="h-3.5 w-3.5" /> Imprimir
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div ref={ref} className="flex-1 overflow-auto p-3 print:overflow-visible print:p-0">
          <div className="grid grid-cols-2 gap-2 print:block print:gap-0" id="label-sheet">
            {items.map((it, i) => (
              <div
                key={i}
                className="border border-dashed border-border rounded-md p-1.5 text-center text-[10px] break-inside-avoid print:border-none print:page-break-after-always"
                style={{ width: "50mm", minHeight: "30mm" }}
              >
                <p className="font-bold truncate leading-tight text-[11px]">{it.productName}</p>
                <p className="text-[9px] text-muted-foreground truncate">
                  {[it.size, it.color].filter(Boolean).join(" · ")}
                </p>
                <p className="font-black text-[12px]">{formatBRL(it.price)}</p>
                <svg
                  data-barcode={it.barcode || it.sku || ""}
                  className="mx-auto max-w-full"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: 50mm 30mm; margin: 0; }
          body * { visibility: hidden !important; }
          #label-sheet, #label-sheet * { visibility: visible !important; }
          #label-sheet { position: absolute; left: 0; top: 0; }
        }
      `}</style>
    </div>
  );
}