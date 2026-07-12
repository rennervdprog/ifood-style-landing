import { Search, X, MoreHorizontal, Plus, CheckSquare, Filter } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type ProductFilter = "all" | "active" | "paused" | "out_of_stock" | "no_image";

interface MenuToolbarProps {
  search: string;
  onSearchChange: (v: string) => void;
  filter: ProductFilter;
  onFilterChange: (f: ProductFilter) => void;
  filterCounts?: Partial<Record<ProductFilter, number>>;
  selectionMode: boolean;
  onToggleSelectionMode: () => void;
  onNewProduct: () => void;
  onOpenImport: () => void;
  onOpenDailyMenu: () => void;
  onOpenSectionManage: () => void;
  disableDailyMenu?: boolean;
}

const FILTER_LABELS: Record<ProductFilter, string> = {
  all: "Todos",
  active: "Ativos",
  paused: "Pausados",
  out_of_stock: "Esgotados",
  no_image: "Sem imagem",
};

export const MenuToolbar = ({
  search,
  onSearchChange,
  filter,
  onFilterChange,
  filterCounts,
  selectionMode,
  onToggleSelectionMode,
  onNewProduct,
  onOpenImport,
  onOpenDailyMenu,
  onOpenSectionManage,
  disableDailyMenu,
}: MenuToolbarProps) => {
  return (
    <div className="sticky top-0 z-20 -mx-2 px-2 py-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b border-border/50">
      <div className="flex items-center gap-2">
        {/* Busca */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar produto..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-card pl-9 pr-8 py-2 rounded-xl text-sm border border-border focus:border-primary focus:outline-none"
          />
          {search && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
              aria-label="Limpar busca"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filtro */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors flex-shrink-0",
                filter !== "all"
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "bg-card text-foreground/80 border-border hover:bg-muted"
              )}
              aria-label="Filtrar"
            >
              <Filter className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{FILTER_LABELS[filter]}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel className="text-xs">Filtrar produtos</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(Object.keys(FILTER_LABELS) as ProductFilter[]).map((f) => (
              <DropdownMenuCheckboxItem
                key={f}
                checked={filter === f}
                onCheckedChange={() => onFilterChange(f)}
              >
                <span className="flex-1">{FILTER_LABELS[f]}</span>
                {filterCounts?.[f] !== undefined && (
                  <span className="ml-2 text-[10px] font-bold text-muted-foreground tabular-nums">
                    {filterCounts[f]}
                  </span>
                )}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Modo seleção */}
        <button
          onClick={onToggleSelectionMode}
          className={cn(
            "hidden sm:flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors flex-shrink-0",
            selectionMode
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card text-foreground/80 border-border hover:bg-muted"
          )}
          aria-label="Modo seleção"
        >
          <CheckSquare className="h-3.5 w-3.5" />
          <span>Selecionar</span>
        </button>

        {/* Menu Mais */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="p-2 rounded-xl border border-border bg-card hover:bg-muted transition-colors flex-shrink-0"
              aria-label="Mais opções"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={onToggleSelectionMode} className="sm:hidden">
              <CheckSquare className="h-4 w-4 mr-2" /> Modo seleção
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenSectionManage}>
              Gerenciar seções
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenImport}>
              Importar cardápio (CSV)
            </DropdownMenuItem>
            {!disableDailyMenu && (
              <DropdownMenuItem onClick={onOpenDailyMenu}>
                Cardápio do dia
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Novo produto — destaque */}
        <button
          onClick={onNewProduct}
          className="hidden sm:flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-primary/90 transition-colors flex-shrink-0"
        >
          <Plus className="h-4 w-4" /> Novo
        </button>
      </div>
    </div>
  );
};

export default MenuToolbar;