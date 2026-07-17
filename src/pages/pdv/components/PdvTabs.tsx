import { ShoppingCart, History, Receipt, BarChart3, LayoutGrid } from "lucide-react";
import type { PdvTab } from "@/pages/pdv/types";

interface Props {
  tab: PdvTab;
  onChange: (t: PdvTab) => void;
}

const TABS: { id: PdvTab; label: string; icon: any }[] = [
  { id: "venda", label: "Vender", icon: ShoppingCart },
  { id: "mesas", label: "Mesas", icon: LayoutGrid },
  { id: "historico", label: "Histórico", icon: History },
  { id: "turnos", label: "Turnos", icon: Receipt },
  { id: "relatorios", label: "Relatórios", icon: BarChart3 },
];

export const PdvTabs = ({ tab, onChange }: Props) => (
  <div
    role="tablist"
    aria-label="Seções do PDV"
    className="flex border-b border-border bg-card shrink-0"
  >
    {TABS.map(({ id, label, icon: Icon }) => (
      <button
        key={id}
        role="tab"
        aria-selected={tab === id}
        aria-label={label}
        onClick={() => onChange(id)}
        className={`flex-1 sm:flex-initial px-4 py-2 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
          tab === id
            ? "border-primary text-primary"
            : "border-transparent text-muted-foreground hover:text-foreground"
        }`}
      >
        <Icon className="h-3.5 w-3.5" /> {label}
      </button>
    ))}
  </div>
);