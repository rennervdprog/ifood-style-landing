/**
 * ABA CARDÁPIO REORG (Fase 3 da reorganização, montada só no /admin-teste).
 *
 * Produtos e Estoque viram UMA tela com duas visualizações — o mesmo
 * catálogo por dois ângulos, como o padrão Produtos/Fichas técnicas que
 * já existia dentro do cardápio:
 *  - "Cardápio": o construtor de cardápio (MenuBuilderReorg);
 *  - "Estoque": a tela de quantidades (StockTab, componente original
 *    reutilizado, sem modificação).
 * A sub-aba "Estoque" saiu da navegação (filterReorgNavGroups); quem
 * chega pela aba "stock" (link direto) cai nesta mesma tela, já na
 * visualização de Estoque (initialView="estoque").
 * O botão "Como funciona" desta tela fica ao lado do seletor de
 * visualização (Fase 2 dos tutoriais, 2026-11-10 — ajuda na tela de
 * novo; o "?" do cabeçalho do shell continua existindo).
 */
import { useState } from "react";
import { Boxes, UtensilsCrossed } from "lucide-react";
import TutorialHelpButton from "@/components/TutorialHelp";
import MenuBuilderReorg from "../sections/MenuBuilderReorg";
import StockTab from "./StockTab";
import { cn } from "@/lib/utils";

interface Props {
  storeId: string;
  storeCategory: string;
  initialView?: "cardapio" | "estoque";
}

const MenuTabReorg = ({ storeId, storeCategory, initialView = "cardapio" }: Props) => {
  const [view, setView] = useState<"cardapio" | "estoque">(initialView);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
      <div
        className="inline-flex rounded-xl border border-border bg-card p-1"
        role="tablist"
        aria-label="Visualização do cardápio"
      >
        <button
          type="button"
          role="tab"
          aria-selected={view === "cardapio"}
          onClick={() => setView("cardapio")}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors",
            view === "cardapio"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <UtensilsCrossed className="h-4 w-4" />
          Cardápio
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "estoque"}
          onClick={() => setView("estoque")}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors",
            view === "estoque"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Boxes className="h-4 w-4" />
          Estoque
        </button>
      </div>
      <TutorialHelpButton tutorialId="menu" />
      </div>

      {view === "cardapio" ? (
        <MenuBuilderReorg storeId={storeId} storeCategory={storeCategory} />
      ) : (
        <StockTab storeId={storeId} />
      )}
    </div>
  );
};

export default MenuTabReorg;
