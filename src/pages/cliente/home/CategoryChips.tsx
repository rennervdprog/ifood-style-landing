import { useMemo } from "react";
import {
  Pizza, ShoppingBasket, Utensils, Cake, Beer, IceCream, Coffee, Sandwich,
  Drumstick, Fish, Cookie, Store as StoreIcon,
} from "lucide-react";

const CATEGORY_META: Record<string, { label: string; Icon: any }> = {
  pizzaria: { label: "Pizzaria", Icon: Pizza },
  pizza: { label: "Pizza", Icon: Pizza },
  mercado: { label: "Mercado", Icon: ShoppingBasket },
  supermercado: { label: "Mercado", Icon: ShoppingBasket },
  marmitaria: { label: "Marmita", Icon: Utensils },
  restaurante: { label: "Restaurante", Icon: Utensils },
  hamburgueria: { label: "Burger", Icon: Sandwich },
  lanchonete: { label: "Lanches", Icon: Sandwich },
  doceria: { label: "Doces", Icon: Cake },
  confeitaria: { label: "Doces", Icon: Cake },
  sorveteria: { label: "Sorvete", Icon: IceCream },
  cafeteria: { label: "Café", Icon: Coffee },
  acai: { label: "Açaí", Icon: IceCream },
  adega: { label: "Bebidas", Icon: Beer },
  pasteis: { label: "Pastel", Icon: Cookie },
  pastel: { label: "Pastel", Icon: Cookie },
  churrascaria: { label: "Churrasco", Icon: Drumstick },
  peixaria: { label: "Peixaria", Icon: Fish },
};

const norm = (c?: string | null) =>
  (c || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

const metaFor = (cat?: string | null) => {
  const k = norm(cat).replace(/\s+/g, "_");
  return (
    CATEGORY_META[k] ||
    CATEGORY_META[k.replace(/s$/, "")] ||
    { label: (cat || "Outras").replace(/_/g, " "), Icon: StoreIcon }
  );
};

interface Props {
  stores: any[];
  active: string | null;
  onChange: (cat: string | null) => void;
}

const CategoryChips = ({ stores, active, onChange }: Props) => {
  const categories = useMemo(() => {
    const map = new Map<string, { key: string; label: string; Icon: any; count: number }>();
    for (const s of stores) {
      const k = norm(s.category);
      if (!k) continue;
      const meta = metaFor(s.category);
      const cur = map.get(k);
      if (cur) cur.count += 1;
      else map.set(k, { key: k, label: meta.label, Icon: meta.Icon, count: 1 });
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [stores]);

  if (categories.length === 0) return null;

  return (
    <div className="-mx-4 px-4 overflow-x-auto no-scrollbar">
      <div className="flex items-center gap-2 pb-1">
        <button
          onClick={() => onChange(null)}
          className={`shrink-0 h-9 px-3 rounded-full text-xs font-bold border transition-all ${
            active === null
              ? "bg-foreground text-background border-foreground"
              : "bg-card text-foreground border-border"
          }`}
        >
          Todas
        </button>
        {categories.map(({ key, label, Icon }) => {
          const isActive = active === key;
          return (
            <button
              key={key}
              onClick={() => onChange(isActive ? null : key)}
              className={`shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-xs font-bold border transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-foreground border-border hover:bg-muted/50"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CategoryChips;
export { norm as normalizeCategory };