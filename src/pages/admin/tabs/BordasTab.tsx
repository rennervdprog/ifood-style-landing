import { useState } from "react";
import PizzaBorderManager from "@/components/PizzaBorderManager";
import PizzaFlavorManager from "@/components/PizzaFlavorManager";
import { Pizza, Circle } from "lucide-react";

interface Props {
  storeId: string;
  category: string;
}

type PizzaConfigTab = "sabores" | "bordas";

const BordasTab = ({ storeId, category }: Props) => {
  const [tab, setTab] = useState<PizzaConfigTab>("sabores");
  if (category !== "pizzas") return null;

  const tabs: { key: PizzaConfigTab; label: string; icon: typeof Pizza }[] = [
    { key: "sabores", label: "Regras", icon: Pizza },
    { key: "bordas", label: "Bordas", icon: Circle },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-black text-foreground">Configurações da Pizzaria</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Gerencie sabores, meio a meio, cálculo de preço e bordas das suas pizzas.
        </p>
      </div>

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

      {tab === "sabores" && <PizzaFlavorManager storeId={storeId} />}
      {tab === "bordas" && <PizzaBorderManager storeId={storeId} />}
    </div>
  );
};

export default BordasTab;
