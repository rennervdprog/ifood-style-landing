import { useState } from "react";
import { Package, ArrowLeft } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetClose } from "@/components/ui/sheet";
import { ProductFormInline, ProductFormData } from "@/components/menu/ProductCard";

interface ProductSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: ProductFormData;
  sectionName?: string | null;
  onSave: (data: ProductFormData) => void;
  storeCategory?: string;
  storeId?: string;
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
  sectionName,
  onSave,
  storeCategory,
  storeId,
}: ProductSheetProps) => {
  const [live, setLive] = useState<ProductFormData | undefined>(initial);
  const preview = live || initial;
  const price = Number(preview?.price || 0);

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
            {sectionName !== undefined && (
              <SheetDescription className="text-xs truncate">
                {sectionName ? <>Seção: <span className="font-semibold text-foreground">{sectionName}</span></> : "Sem seção"}
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
        <div className="p-5">
          <ProductFormInline
            initial={initial}
            onSave={(data) => {
              onSave(data);
            }}
            onCancel={() => onOpenChange(false)}
            storeCategory={storeCategory}
            storeId={storeId}
            onChange={setLive}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ProductSheet;