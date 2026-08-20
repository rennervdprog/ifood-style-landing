import { Grid3x3, Layers, Package, Plus, Settings2 } from "lucide-react";
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

export const SectionNav = ({
  items,
  activeId,
  onSelect,
  onManage,
  onNewSection,
  totalProducts,
  unsectionedCount,
}: SectionNavProps) => {
  const allItems: SectionNavItem[] = [
    { id: "all", name: "Todos os produtos", count: totalProducts },
    ...items,
    ...(unsectionedCount > 0 ? [{ id: "none" as const, name: "Sem seção", count: unsectionedCount }] : []),
  ];

  const getIcon = (id: SectionScope) => (id === "all" ? Grid3x3 : id === "none" ? Package : Layers);

  return (
    <>
      <nav className="-mx-2 overflow-x-auto border-b border-border px-2 pb-3 lg:hidden" aria-label="Seções do cardápio">
        <div className="flex min-w-max items-center gap-1.5">
          {allItems.map((item) => {
            const Icon = getIcon(item.id);
            const active = item.id === activeId;
            return (
              <button
                key={String(item.id)}
                onClick={() => onSelect(item.id)}
                className={`inline-flex items-center gap-1.5 border px-3 py-2 text-xs font-bold ${
                  active ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.name}
                <span className="text-[10px] tabular-nums">{item.count}</span>
              </button>
            );
          })}
          <button onClick={onManage} className="inline-flex items-center gap-1.5 border border-dashed border-border px-3 py-2 text-xs font-bold text-muted-foreground">
            <Settings2 className="h-3.5 w-3.5" /> Gerenciar
          </button>
        </div>
      </nav>

      <aside className="sticky top-4 hidden w-56 shrink-0 self-start border-r border-border pr-4 lg:block" aria-label="Seções do cardápio">
        <div className="mb-2 flex items-center justify-between px-2 py-2">
          <h3 className="text-sm font-black text-foreground">Seções</h3>
          <button onClick={onManage} className="inline-flex h-8 w-8 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground" title="Gerenciar seções">
            <Settings2 className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-0.5">
          {allItems.map((item) => {
            const Icon = getIcon(item.id);
            const active = item.id === activeId;
            return (
              <button
                key={String(item.id)}
                onClick={() => onSelect(item.id)}
                className={cn(
                  "flex w-full items-center gap-2 border-l-2 px-2 py-2.5 text-left text-sm transition-colors",
                  active ? "border-primary bg-primary/5 font-black text-primary" : "border-transparent font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{item.name}</span>
                <span className={`min-w-[22px] border px-1.5 py-0.5 text-center text-[10px] font-bold tabular-nums ${active ? "border-primary/20 bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>{item.count}</span>
              </button>
            );
          })}
        </div>
        <button onClick={onNewSection} className="mt-4 inline-flex items-center gap-2 px-2 py-2 text-sm font-black text-primary hover:bg-primary/5">
          <Plus className="h-4 w-4" /> Nova seção
        </button>
      </aside>
    </>
  );
};

export default SectionNav;
