import { memo, useCallback } from "react";
import { Pizza, Beef, Beer, Utensils, Fish, IceCream, Coffee, Flame, Pill, Cake, ChefHat, Circle } from "lucide-react";

const categories = [
  { icon: Utensils, label: "Todos", value: "all" },
  { icon: Beef, label: "Lanches", value: "lanches" },
  { icon: Pizza, label: "Pizzas", value: "pizzas" },
  { icon: ChefHat, label: "Restaurante", value: "restaurante" },
  { icon: Beer, label: "Adegas", value: "adegas" },
  { icon: Fish, label: "Japonesa", value: "japonesa" },
  { icon: IceCream, label: "Doces", value: "sobremesas" },
  { icon: Coffee, label: "Café", value: "cafeteria" },
  { icon: Flame, label: "Churrasco", value: "churrasco" },
  { icon: Pill, label: "Farmácias", value: "farmacias" },
  { icon: Cake, label: "Docerias", value: "docerias" },
  { icon: Circle, label: "Esfihas", value: "esfihas" },
];

interface Props {
  selected: string;
  onSelect: (value: string) => void;
}

const CategoryScroll = memo(({ selected, onSelect }: Props) => {
  return (
    <div className="flex gap-3 overflow-x-auto hide-scrollbar py-4 px-4">
      {categories.map((cat) => {
        const active = selected === cat.value;
        return (
          <button
            key={cat.value}
            onClick={() => onSelect(cat.value)}
            className={`flex flex-col items-center gap-1.5 min-w-[64px] transition-all ${
              active ? "scale-105" : ""
            }`}
          >
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${
                active
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <cat.icon className="h-6 w-6" />
            </div>
            <span
              className={`text-[11px] font-bold ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {cat.label}
            </span>
          </button>
        );
      })}
    </div>
  );
});

CategoryScroll.displayName = "CategoryScroll";

export default CategoryScroll;
