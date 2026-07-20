import { ShoppingCart, History, Receipt, BarChart3, LayoutGrid, CreditCard, Settings } from "lucide-react";
import type { PdvTab } from "@/pages/pdv/types";

interface Props {
  tab: PdvTab;
  onChange: (t: PdvTab) => void;
  /** Mostra as abas "Meu Plano" e "Configurações" (apenas lojas PDV Only,
   *  que não têm acesso ao painel `/admin` completo). */
  showMeuPlano?: boolean;
}

const BASE_TABS: { id: PdvTab; label: string; icon: any }[] = [
  { id: "venda", label: "Vender", icon: ShoppingCart },
  { id: "mesas", label: "Mesas", icon: LayoutGrid },
  { id: "historico", label: "Histórico", icon: History },
  { id: "turnos", label: "Turnos", icon: Receipt },
  { id: "relatorios", label: "Relatórios", icon: BarChart3 },
];

export const PdvTabs = ({ tab, onChange, showMeuPlano }: Props) => {
  const tabs = showMeuPlano
    ? [
        ...BASE_TABS,
        { id: "meu_plano" as PdvTab, label: "Meu Plano", icon: CreditCard },
        { id: "configuracoes" as PdvTab, label: "Configurações", icon: Settings },
      ]
    : BASE_TABS;
  return (
  <div
    role="tablist"
    aria-label="Seções do PDV"
    className="hidden md:flex border-b border-border bg-card shrink-0 overflow-x-auto no-scrollbar"
  >
    {tabs.map(({ id, label, icon: Icon }) => (
      <button
        key={id}
        role="tab"
        aria-selected={tab === id}
        aria-label={label}
        onClick={() => onChange(id)}
        className={`flex-1 sm:flex-initial min-w-0 px-2 sm:px-4 py-2 text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1 sm:gap-1.5 border-b-2 transition-colors whitespace-nowrap ${
          tab === id
            ? "border-primary text-primary"
            : "border-transparent text-muted-foreground hover:text-foreground"
        }`}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{label}</span>
      </button>
    ))}
  </div>
  );
};