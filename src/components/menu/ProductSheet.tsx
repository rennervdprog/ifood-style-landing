import { useEffect, useState } from "react";
import { Package, ArrowLeft } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetClose } from "@/components/ui/sheet";
import { ProductFormInline, ProductFormData } from "@/components/menu/ProductCard";

type ProductSection = { id: string; name: string };

interface ProductSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: ProductFormData;
  sectionId?: string | null;
  sectionName?: string | null;
  sections?: ProductSection[];
  onSave: (data: ProductFormData, sectionId?: string | null) => void;
  storeCategory?: string;
  storeId?: string;
  storeCategories?: string[];
}

/**
 * Sheet lateral (desktop) / bottom sheet (mobile) para criar/editar produto.
 * Reaproveita o `ProductFormInline` existente sem duplicar lógica.
 */
export const ProductSheet = ({
  open,
  onOpenChange,
  mode,
  initial,
  sectionId,
  sectionName,
  sections = [],
  onSave,
  storeCategory,
  storeId,
  storeCategories,
}: ProductSheetProps) => {
  const [live, setLive] = useState<ProductFormData | undefined>(initial);
  const [targetSectionId, setTargetSectionId] = useState(sectionId || "");
  const preview = live || initial;
  const price = Number(preview?.price || 0);

  useEffect(() => {
    setLive(initial);
  }, [initial, open]);

  useEffect(() => {
    setTargetSectionId(sectionId || "");
  }, [sectionId, open]);

  const targetSectionName = targetSectionId
    ? sections.find((section) => section.id === targetSectionId)?.name || null
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg overflow-y-auto p-0"
      >
        <SheetHeader className="sticky top-0 z-20 bg-background border-b border-border px-3 py-3 flex-row items-center gap-2 space-y-0">
          <SheetClose className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg hover:bg-muted text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </SheetClose>
          <div className="min-w-0 flex-1">
            <SheetTitle className="text-base leading-tight truncate">
              {mode === "create" ? "Novo produto" : "Editar produto"}
            </SheetTitle>
            {mode === "edit" && sectionName !== undefined && (
              <SheetDescription className="text-xs truncate">
                {sectionName ? <>Seção atual: <span className="font-semibold text-foreground">{sectionName}</span></> : "Este produto está sem seção"}
              </SheetDescription>
            )}
          </div>
        </SheetHeader>

        {/* Live preview — como aparece pro cliente */}
        <div className="px-5 pt-4">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-2">Pré-visualização</p>
          <div className="bg-card border border-border rounded-xl p-3 flex items-start gap-3">
            {preview?.image_url ? (
              <img src={preview.image_url} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <Package className="h-5 w-5 text-muted-foreground/50" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-bold text-foreground truncate">
                {preview?.name?.trim() || "Nome do produto"}
              </h4>
              {preview?.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">{preview.description}</p>
              )}
              <p className="text-sm font-black text-primary mt-1">
                {price > 0 ? formatBRL(price) : "R$ 0,00"}
              </p>
            </div>
          </div>
        </div>

        {mode === "create" && (
          <div className="px-5 pt-4">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-1.5">
              <label htmlFor="product-section" className="text-xs font-bold text-foreground">
                Seção de destino
              </label>
              <select
                id="product-section"
                value={targetSectionId}
                onChange={(event) => setTargetSectionId(event.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              >
                <option value="">Sem seção — organizar depois</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>{section.name}</option>
                ))}
              </select>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {targetSectionName
                  ? <>Este produto será salvo em <strong className="text-foreground">{targetSectionName}</strong>.</>
                  : "Você pode salvar agora e mover o produto para uma seção depois."}
              </p>
            </div>
          </div>
        )}

        <div className="p-5">
          <ProductFormInline
            initial={initial}
            onSave={(data) => onSave(data, mode === "create" ? targetSectionId || null : undefined)}
            onCancel={() => onOpenChange(false)}
            storeCategory={storeCategory}
            storeId={storeId}
            storeCategories={storeCategories}
            onChange={setLive}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ProductSheet;
