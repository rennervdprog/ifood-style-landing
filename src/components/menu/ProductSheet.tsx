import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
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
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg overflow-y-auto p-0"
      >
        <SheetHeader className="sticky top-0 z-10 bg-background border-b border-border px-5 py-4">
          <SheetTitle className="text-base">
            {mode === "create" ? "Novo produto" : "Editar produto"}
          </SheetTitle>
          {sectionName !== undefined && (
            <SheetDescription className="text-xs">
              {sectionName ? <>Seção: <span className="font-semibold text-foreground">{sectionName}</span></> : "Sem seção"}
            </SheetDescription>
          )}
        </SheetHeader>
        <div className="p-5">
          <ProductFormInline
            initial={initial}
            onSave={(data) => {
              onSave(data);
            }}
            onCancel={() => onOpenChange(false)}
            storeCategory={storeCategory}
            storeId={storeId}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ProductSheet;