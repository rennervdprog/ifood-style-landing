import { CheckSquare, MoreHorizontal, Plus, Search, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type ProductFilter = "all" | "active" | "paused" | "out_of_stock" | "no_image";

interface MenuToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  filter: ProductFilter;
  onFilterChange: (filter: ProductFilter) => void;
  filterCounts?: Partial<Record<ProductFilter, number>>;
  selectionMode: boolean;
  onToggleSelectionMode: () => void;
  onNewProduct: () => void;
  onOpenImport: () => void;
  onOpenDailyMenu: () => void;
  onOpenSectionManage: () => void;
  disableDailyMenu?: boolean;
}

const PRIMARY_FILTERS: { id: ProductFilter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "active", label: "Ativos" },
  { id: "paused", label: "Pausados" },
  { id: "out_of_stock", label: "Esgotados" },
];

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
}: MenuToolbarProps) => (
  <div className="sticky top-0 z-20 -mx-2 border-b border-border bg-background/95 px-2 py-3 backdrop-blur">
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Buscar produto"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="h-10 w-full border border-border bg-card py-2 pl-10 pr-10 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
        />
        {search && <button onClick={() => onSearchChange("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Limpar busca"><X className="h-4 w-4" /></button>}
      </div>

      <div className="no-scrollbar flex min-w-0 overflow-x-auto border border-border bg-card">
        {PRIMARY_FILTERS.map((item) => (
          <button
            key={item.id}
            onClick={() => onFilterChange(item.id)}
            className={cn(
              "shrink-0 border-r border-border px-3 py-2 text-xs font-bold last:border-r-0",
              filter === item.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {item.label}
            {filterCounts?.[item.id] ? <span className="ml-1.5 text-[10px] tabular-nums">{filterCounts[item.id]}</span> : null}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button onClick={onToggleSelectionMode} className={cn("hidden h-10 items-center gap-2 border px-3 text-xs font-bold sm:inline-flex", selectionMode ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-muted")}>
          <CheckSquare className="h-4 w-4" /> Selecionar vários
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="inline-flex h-10 w-10 items-center justify-center border border-border bg-card text-foreground hover:bg-muted" aria-label="Mais opções"><MoreHorizontal className="h-4 w-4" /></button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-xs">Mais ações</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onToggleSelectionMode} className="sm:hidden"><CheckSquare className="mr-2 h-4 w-4" />Selecionar vários</DropdownMenuItem>
            <DropdownMenuCheckboxItem checked={filter === "no_image"} onCheckedChange={() => onFilterChange(filter === "no_image" ? "all" : "no_image")}>Sem imagem {filterCounts?.no_image ? `(${filterCounts.no_image})` : ""}</DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onOpenSectionManage}>Gerenciar seções</DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenImport}>Importar cardápio (CSV)</DropdownMenuItem>
            {!disableDailyMenu && <DropdownMenuItem onClick={onOpenDailyMenu}>Cardápio do dia</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
        <button onClick={onNewProduct} className="inline-flex h-10 items-center gap-2 bg-primary px-3 text-sm font-black text-primary-foreground hover:bg-primary/90"><Plus className="h-4 w-4" /><span className="hidden sm:inline">Novo produto</span><span className="sm:hidden">Novo</span></button>
      </div>
    </div>
  </div>
);

export default MenuToolbar;
