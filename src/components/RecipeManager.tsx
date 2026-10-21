import { useMemo, useState } from "react";
import { ChevronRight, Search, X } from "lucide-react";
import { formatBRL } from "@/lib/utils";

interface Props {
  products: any[];
  recipesByProduct: Map<string, any[]>;
  onOpenRecipe: (product: any) => void;
}

type RecipeFilter = "all" | "with" | "without";

/**
 * Aba "Fichas técnicas" do Cardápio: lista todos os produtos da loja com
 * o status da receita (quantos ingredientes / sem ficha) e abre o editor
 * de ficha que já existe (ProductRecipe). Os ingredientes são produtos à
 * venda ou insumos de estoque (metadata.is_ingredient).
 */
export default function RecipeManager({ products, recipesByProduct, onOpenRecipe }: Props) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<RecipeFilter>("all");

  const withRecipe = useMemo(
    () => products.filter((p) => (recipesByProduct.get(p.id) || []).length > 0),
    [products, recipesByProduct],
  );
  const withoutRecipe = useMemo(
    () => products.filter((p) => (recipesByProduct.get(p.id) || []).length === 0),
    [products, recipesByProduct],
  );

  const matches = (p: any) =>
    !search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase());
  const visibleWith = filter === "without" ? [] : withRecipe.filter(matches);
  const visibleWithout = filter === "with" ? [] : withoutRecipe.filter(matches);

  const renderRow = (p: any) => {
    const ings = recipesByProduct.get(p.id) || [];
    const has = ings.length > 0;
    return (
      <button
        key={p.id}
        onClick={() => onOpenRecipe(p)}
        className="w-full flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:bg-muted/40"
      >
        {p.image_url ? (
          <img src={p.image_url} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <span className="text-base font-black text-primary">
              {(p.name || "?").trim().charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-bold">{p.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {has
              ? ings.map((i: any) => i.products?.name || "Ingrediente").join(" · ")
              : "Toque para montar a ficha"}
          </p>
          <p className="text-[11px] text-muted-foreground/70">
            {formatBRL(Number(p.price || 0))}
          </p>
        </div>
        {has ? (
          <span className="shrink-0 rounded-full bg-green-600 px-2.5 py-1 text-[10.5px] font-extrabold text-white">
            {ings.length} ingrediente{ings.length === 1 ? "" : "s"}
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-stone-400 px-2.5 py-1 text-[10.5px] font-extrabold text-white">
            Sem ficha
          </span>
        )}
        <ChevronRight className="h-[17px] w-[17px] shrink-0 text-muted-foreground/60" />
      </button>
    );
  };

  const filterBtn = (id: RecipeFilter, label: string, count: number) => (
    <button
      key={id}
      onClick={() => setFilter(id)}
      className={`shrink-0 flex-1 px-3 py-2 text-xs font-bold transition-colors ${
        filter === id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {label}
      {count > 0 && <span className="ml-1.5 text-[10px] tabular-nums">{count}</span>}
    </button>
  );

  return (
    <div>
      {/* Resumo */}
      <div className="grid grid-cols-3 divide-x divide-border overflow-hidden rounded-xl border border-border bg-card">
        <div className="py-3 text-center">
          <p className="text-[17px] font-black leading-none">{products.length}</p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Produtos</p>
        </div>
        <div className="py-3 text-center">
          <p className="text-[17px] font-black leading-none text-green-600">{withRecipe.length}</p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Com ficha</p>
        </div>
        <div className="py-3 text-center">
          <p className="text-[17px] font-black leading-none text-primary">{withoutRecipe.length}</p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Sem ficha</p>
        </div>
      </div>

      {/* Busca */}
      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Buscar produto"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 w-full border border-border bg-card py-2 pl-10 pr-10 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Limpar busca"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="mt-2.5 flex overflow-hidden border border-border bg-card">
        {filterBtn("all", "Todos", products.length)}
        {filterBtn("with", "Com ficha", withRecipe.length)}
        {filterBtn("without", "Sem ficha", withoutRecipe.length)}
      </div>

      {/* Grupos */}
      {visibleWith.length > 0 && (
        <>
          <div className="mb-2 mt-[18px] flex items-center justify-between px-0.5">
            <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">Com ficha</h3>
            <span className="text-[11px] font-semibold text-muted-foreground">
              {visibleWith.length} produto{visibleWith.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="space-y-2">{visibleWith.map(renderRow)}</div>
        </>
      )}
      {visibleWithout.length > 0 && (
        <>
          <div className="mb-2 mt-[18px] flex items-center justify-between px-0.5">
            <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">Sem ficha</h3>
            <span className="text-[11px] font-semibold text-muted-foreground">
              {visibleWithout.length} produto{visibleWithout.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="space-y-2">{visibleWithout.map(renderRow)}</div>
        </>
      )}
      {products.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Nenhum produto cadastrado. Cadastre produtos na aba Produtos para montar as fichas.
        </p>
      )}
      {products.length > 0 && visibleWith.length === 0 && visibleWithout.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">Nenhum produto encontrado</p>
      )}
    </div>
  );
}
