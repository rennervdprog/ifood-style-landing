import { useMemo } from "react";
import { AppIcon } from "@/components/ui/app-icon";

const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  pizzaria:     { label: "Pizzaria",    icon: "pizza" },
  pizza:        { label: "Pizza",       icon: "pizza" },
  mercado:      { label: "Mercado",     icon: "cart-large-minimalistic" },
  supermercado: { label: "Mercado",     icon: "cart-large-minimalistic" },
  marmitaria:   { label: "Marmita",     icon: "fork" },
  restaurante:  { label: "Restaurante", icon: "chef-hat" },
  hamburgueria: { label: "Burger",      icon: "hamburger" },
  lanchonete:   { label: "Lanches",     icon: "hamburger" },
  doceria:      { label: "Doces",       icon: "cake" },
  confeitaria:  { label: "Doces",       icon: "cake" },
  sorveteria:   { label: "Sorvete",     icon: "cup-hot" },
  cafeteria:    { label: "Café",        icon: "cup-hot" },
  acai:         { label: "Açaí",        icon: "cup-hot" },
  adega:        { label: "Bebidas",     icon: "bottle" },
  pasteis:      { label: "Pastel",      icon: "donut" },
  pastel:       { label: "Pastel",      icon: "donut" },
  churrascaria: { label: "Churrasco",   icon: "fire" },
  peixaria:     { label: "Peixaria",    icon: "shop" },
};

const norm = (c?: string | null) =>
  (c || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

const metaFor = (cat?: string | null) => {
  const k = norm(cat).replace(/\s+/g, "_");
  return (
    CATEGORY_META[k] ||
    CATEGORY_META[k.replace(/s$/, "")] ||
    { label: (cat || "Outras").replace(/_/g, " "), icon: "shop" }
  );
};

interface Props {
  stores: any[];
  active: string | null;
  onChange: (cat: string | null) => void;
}

const CategoryChips = ({ stores, active, onChange }: Props) => {
  const categories = useMemo(() => {
    const map = new Map<string, { key: string; label: string; icon: string; count: number }>();
    for (const s of stores) {
      const k = norm(s.category);
      if (!k) continue;
      const meta = metaFor(s.category);
      const cur = map.get(k);
      if (cur) cur.count += 1;
      else map.set(k, { key: k, label: meta.label, icon: meta.icon, count: 1 });
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
        {categories.map(({ key, label, icon }) => {
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
              <AppIcon name={icon} variant={isActive ? "bold-duotone" : "linear"} className="h-3.5 w-3.5" />
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