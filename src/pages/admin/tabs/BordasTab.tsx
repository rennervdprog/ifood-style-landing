import { useState } from "react";
import PizzaBorderManager from "@/components/PizzaBorderManager";
import PizzaFlavorManager from "@/components/PizzaFlavorManager";
import PastelBorderManager from "@/components/PastelBorderManager";
import PastelFlavorManager from "@/components/PastelFlavorManager";
import { Pizza, Circle, UtensilsCrossed } from "lucide-react";

interface Props {
  storeId: string;
  category: string;
  categories?: string[] | null;
}

type ConfigTab = "sabores" | "bordas";

const BordasTab = ({ storeId, category, categories }: Props) => {
  const cats = [category, ...((categories || []) as string[])].filter(Boolean);
  const isPizza = cats.includes("pizzas");
  const isPastel = cats.includes("pasteis");
  const [kind, setKind] = useState<"pizza" | "pastel">(isPizza ? "pizza" : "pastel");
  const [tab, setTab] = useState<ConfigTab>("sabores");

  if (!isPizza && !isPastel) return null;

  const tabs: { key: ConfigTab; label: string; icon: typeof Pizza }[] = [
    { key: "sabores", label: "Regras", icon: kind === "pizza" ? Pizza : UtensilsCrossed },
    { key: "bordas", label: "Bordas", icon: Circle },
  ];

  const title = kind === "pizza" ? "Configurações da Pizzaria" : "Configurações da Pastelaria";
  const subtitle = kind === "pizza"
    ? "Gerencie sabores, meio a meio, cálculo de preço e bordas das suas pizzas."
    : "Gerencie sabores, meio a meio, cálculo de preço e bordas dos seus pastéis.";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-black text-foreground">{title}</h1>
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      </div>

      {isPizza && isPastel && (
        <div className="flex gap-2 bg-muted/40 p-1 rounded-xl">
          <button
            onClick={() => setKind("pizza")}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
              kind === "pizza" ? "bg-background text-primary shadow-sm" : "text-muted-foreground"
            }`}
          >
            <Pizza className="h-3.5 w-3.5" /> Pizza
          </button>
          <button
            onClick={() => setKind("pastel")}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
              kind === "pastel" ? "bg-background text-primary shadow-sm" : "text-muted-foreground"
            }`}
          >
            <UtensilsCrossed className="h-3.5 w-3.5" /> Pastel
          </button>
        </div>
      )}

      <div className="flex gap-2 border-b border-border overflow-x-auto">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 transition-colors ${
              tab === key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {kind === "pizza" && tab === "sabores" && <PizzaFlavorManager storeId={storeId} />}
      {kind === "pizza" && tab === "bordas" && <PizzaBorderManager storeId={storeId} />}
      {kind === "pastel" && tab === "sabores" && <PastelFlavorManager storeId={storeId} />}
      {kind === "pastel" && tab === "bordas" && <PastelBorderManager storeId={storeId} />}
    </div>
  );
};

export default BordasTab;
