/**
 * TELA 3 — CÓPIA DE TESTE (/admin-teste) de src/components/menu/ProductSheet.tsx.
 * Idêntica ao original, EXCETO (só apresentação/usabilidade):
 *  1. SEÇÃO OBRIGATÓRIA no modo criar (item 6): some a opção
 *     "Sem seção — organizar depois"; sem seção escolhida, o salvamento
 *     é bloqueado com erro INLINE junto ao campo ("Escolha uma seção
 *     para o produto") — nada é salvo sem seção.
 *  2. CRIAR SEÇÃO SEM SAIR DO FORMULÁRIO: botão "+ Criar nova seção"
 *     abre um campo inline que cria a seção com os mesmos dados do
 *     MenuBuilder (store_id, nome, sort_order) e já a seleciona; a
 *     lista do painel é invalidada para o MenuBuilderTeste recarregar.
 *     Sem isso, uma loja sem nenhuma seção não conseguiria criar o
 *     primeiro produto.
 *  3. Pré-visualização sem foto avisa: "Sem foto — adicione uma foto
 *     no formulário abaixo."
 *  4. Modo editar sem seção explica onde organizar ("Mover de seção"
 *     no card do produto) em vez de só constatar.
 * Nada muda em dados, cálculos, preços ou no fluxo de salvar do produto
 * em si (o gate de nome/preço continua no MenuBuilderTeste).
 */
import { useEffect, useState } from "react";
import { Package, ArrowLeft, Plus } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetClose } from "@/components/ui/sheet";
import { ProductFormInlineTeste, ProductFormData } from "./ProductCardTeste";

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
export const ProductSheetTeste = ({
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
  const queryClient = useQueryClient();
  const [live, setLive] = useState<ProductFormData | undefined>(initial);
  const [targetSectionId, setTargetSectionId] = useState(sectionId || "");
  // Tela 3, item 6: erro inline de seção + criação inline de seção.
  const [sectionError, setSectionError] = useState<string | undefined>(undefined);
  const [showNewSection, setShowNewSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [creatingSection, setCreatingSection] = useState(false);
  // Seções criadas aqui dentro, até o MenuBuilderTeste recarregar a lista.
  const [createdSections, setCreatedSections] = useState<ProductSection[]>([]);
  const allSections: ProductSection[] = [
    ...sections,
    ...createdSections.filter((c) => !sections.some((s) => s.id === c.id)),
  ];

  const handleCreateSection = async () => {
    const name = newSectionName.trim();
    if (!name || !storeId) return;
    setCreatingSection(true);
    const { data, error } = await supabase
      .from("menu_sections")
      .insert({ store_id: storeId, name, sort_order: allSections.length + 1 } as any)
      .select("id")
      .single();
    setCreatingSection(false);
    if (error || !data) {
      toast.error("Erro ao criar seção");
      return;
    }
    const created = { id: (data as any).id as string, name };
    setCreatedSections((prev) => [...prev, created]);
    setTargetSectionId(created.id);
    setSectionError(undefined);
    setShowNewSection(false);
    setNewSectionName("");
    toast.success("Seção criada!");
    queryClient.invalidateQueries({ queryKey: ["menu-sections", storeId] });
  };

  // Tela 3, item 6: sem seção, o produto NÃO é salvo.
  const handleSave = (data: ProductFormData) => {
    if (mode === "create" && !targetSectionId) {
      setSectionError("Escolha uma seção para o produto");
      return;
    }
    onSave(data, mode === "create" ? targetSectionId || null : undefined);
  };
  const preview = live || initial;
  const price = Number(preview?.price || 0);

  useEffect(() => {
    setLive(initial);
  }, [initial, open]);

  useEffect(() => {
    setTargetSectionId(sectionId || "");
    setSectionError(undefined);
    setShowNewSection(false);
    setNewSectionName("");
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
                {sectionName ? <>Seção atual: <span className="font-semibold text-foreground">{sectionName}</span></> : "Este produto está sem seção — use “Mover de seção” no card do produto para organizá-lo"}
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
          {!preview?.image_url && (
            <p className="mt-2 text-xs font-bold text-amber-600">Sem foto — adicione uma foto no formulário abaixo.</p>
          )}
        </div>

        {mode === "create" && (
          <div className="px-5 pt-4">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-1.5">
              <label htmlFor="product-section-teste" className="text-sm font-bold text-foreground">
                Seção *
              </label>
              <select
                id="product-section-teste"
                value={targetSectionId}
                onChange={(event) => {
                  setTargetSectionId(event.target.value);
                  setSectionError(undefined);
                }}
                aria-invalid={!!sectionError}
                className={`w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none ${sectionError ? "border-destructive" : "border-border"}`}
              >
                <option value="" disabled>Escolha uma seção…</option>
                {allSections.map((section) => (
                  <option key={section.id} value={section.id}>{section.name}</option>
                ))}
              </select>
              {sectionError && (
                <p role="alert" className="text-sm font-medium text-destructive">{sectionError}</p>
              )}
              <p className="text-xs leading-relaxed text-muted-foreground">
                {targetSectionName
                  ? <>Este produto será salvo em <strong className="text-foreground">{targetSectionName}</strong>.</>
                  : allSections.length === 0
                    ? "Sua loja ainda não tem nenhuma seção — crie a primeira abaixo."
                    : "Todo produto precisa de uma seção para o cliente achar no cardápio."}
              </p>
              {!showNewSection ? (
                <button
                  type="button"
                  onClick={() => setShowNewSection(true)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" /> Criar nova seção
                </button>
              ) : (
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={newSectionName}
                    onChange={(event) => setNewSectionName(event.target.value)}
                    placeholder="Nome da nova seção"
                    className="flex-1 min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCreateSection}
                    disabled={!newSectionName.trim() || creatingSection}
                    className="rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {creatingSection ? "Criando…" : "Criar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewSection(false);
                      setNewSectionName("");
                    }}
                    className="px-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="p-5">
          <ProductFormInlineTeste
            initial={initial}
            onSave={handleSave}
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

export default ProductSheetTeste;
