import { memo, useCallback } from "react";
import { Pizza, Beef, Beer, Utensils, Fish, IceCream, Coffee, Flame, Pill, Cake, ChefHat, Circle, UtensilsCrossed } from "lucide-react";

const categories = [
  { icon: Utensils, label: "Todos", value: "all" },
  { icon: Beef, label: "Lanches", value: "lanches" },
  { icon: Pizza, label: "Pizzas", value: "pizzas" },
  { icon: UtensilsCrossed, label: "Pastéis", value: "pasteis" },
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
     <div className="flex gap-4 overflow-x-auto hide-scrollbar py-6 px-4">
       {categories.map((cat) => {
         const active = selected === cat.value;
         return (
           <button
             key={cat.value}
             onClick={() => onSelect(cat.value)}
             className={`flex flex-col items-center gap-2 min-w-[70px] transition-all duration-300 ${
               active ? "scale-110" : "hover:scale-105"
             }`}
           >
             <div
               className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center transition-all duration-300 relative group overflow-hidden ${
                 active
                   ? "bg-primary text-white shadow-xl shadow-primary/30 ring-4 ring-primary/10"
                   : "bg-card border border-border text-muted-foreground hover:border-primary/20 hover:bg-muted/50"
               }`}
             >
               {active && (
                 <span className="absolute inset-0 bg-gradient-to-tr from-black/10 to-transparent pointer-events-none" />
               )}
               <cat.icon className={`h-7 w-7 transition-transform duration-300 ${active ? "animate-bounce-subtle" : "group-hover:scale-110"}`} />
             </div>
             <span
               className={`text-[10px] uppercase tracking-wider font-black transition-colors ${
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
