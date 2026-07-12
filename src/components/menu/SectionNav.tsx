import { Package, Grid3x3, Layers, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type SectionScope = "all" | "none" | string;

export interface SectionNavItem {
  id: SectionScope;
  name: string;
  count: number;
}

interface SectionNavProps {
  items: SectionNavItem[];
  activeId: SectionScope;
  onSelect: (id: SectionScope) => void;
  onManage: () => void;
  onNewSection: () => void;
  totalProducts: number;
  unsectionedCount: number;
}

/**
 * Navegação de seções: sidebar vertical no desktop, chips horizontais no mobile.
 * Mostra "Todos" e "Sem seção" além das seções reais.
 */
export const SectionNav = ({
  items,
  activeId,
  onSelect,
  onManage,
  onNewSection,
  totalProducts,
  unsectionedCount,
}: SectionNavProps) => {
  const fixedItems: SectionNavItem[] = [
    { id: "all", name: "Todos", count: totalProducts },
    ...(unsectionedCount > 0 ? [{ id: "none" as const, name: "Sem seção", count: unsectionedCount }] : []),
  ];
  const allItems = [...fixedItems, ...items];

  return (
    <>
      {/* Mobile: chips horizontais */}
      <div className="lg:hidden -mx-2 px-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {allItems.map((item) => {
            const active = item.id === activeId;
            const Icon = item.id === "all" ? Grid3x3 : item.id === "none" ? Package : Layers;
            return (
              <button
                key={String(item.id)}
                onClick={() => onSelect(item.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors flex-shrink-0",
                  active
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card text-foreground/80 border-border hover:bg-muted"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.name}</span>
                <span
                  className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center",
                    active ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"
                  )}
                >
                  {item.count}
                </span>
              </button>
            );
          })}
          <button
            onClick={onManage}
            className="flex items-center gap-1 px-3 py-2 rounded-full text-xs font-semibold whitespace-nowrap bg-card text-muted-foreground border border-dashed border-border hover:bg-muted flex-shrink-0"
            title="Gerenciar seções"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Gerenciar
          </button>
        </div>
      </div>

      {/* Desktop: sidebar vertical */}
      <aside className="hidden lg:flex lg:flex-col lg:w-56 lg:flex-shrink-0 lg:sticky lg:top-4 lg:self-start bg-card border border-border rounded-2xl p-2 gap-1 max-h-[calc(100vh-2rem)] overflow-y-auto">
        <div className="flex items-center justify-between px-2 py-2">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Seções</span>
          <button
            onClick={onManage}
            className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors"
            title="Gerenciar seções"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
        </div>
        {allItems.map((item) => {
          const active = item.id === activeId;
          const Icon = item.id === "all" ? Grid3x3 : item.id === "none" ? Package : Layers;
          return (
            <button
              key={String(item.id)}
              onClick={() => onSelect(item.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors text-left",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-foreground/80 hover:bg-muted"
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="flex-1 truncate">{item.name}</span>
              <span
                className={cn(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
                  active ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"
                )}
              >
                {item.count}
              </span>
            </button>
          );
        })}
        <button
          onClick={onNewSection}
          className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-primary hover:bg-primary/10 border border-dashed border-primary/40 transition-colors"
        >
          + Nova seção
        </button>
      </aside>
    </>
  );
};

export default SectionNav;