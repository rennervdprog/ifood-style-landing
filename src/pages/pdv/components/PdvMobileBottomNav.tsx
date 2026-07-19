import { useState } from "react";
import {
  ShoppingCart, LayoutGrid, History, BarChart3, MoreHorizontal,
  Receipt, CreditCard, Settings, X,
} from "lucide-react";
import type { PdvTab } from "@/pages/pdv/types";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface Props {
  tab: PdvTab;
  onChange: (t: PdvTab) => void;
  showMeuPlano?: boolean;
}

const PRIMARY: { id: PdvTab; label: string; icon: any }[] = [
  { id: "venda", label: "Vender", icon: ShoppingCart },
  { id: "mesas", label: "Mesas", icon: LayoutGrid },
  { id: "historico", label: "Histórico", icon: History },
  { id: "relatorios", label: "Relatórios", icon: BarChart3 },
];

/**
 * Barra de navegação inferior estilo nativo, exclusiva para mobile.
 * Mostra 4 abas principais + botão "Mais" que abre bottom sheet
 * com as secundárias (Turnos, Meu Plano, Configurações).
 */
export const PdvMobileBottomNav = ({ tab, onChange, showMeuPlano }: Props) => {
  const [moreOpen, setMoreOpen] = useState(false);

  const secondary: { id: PdvTab; label: string; icon: any }[] = [
    { id: "turnos", label: "Turnos", icon: Receipt },
    ...(showMeuPlano
      ? [
          { id: "meu_plano" as PdvTab, label: "Meu Plano", icon: CreditCard },
          { id: "configuracoes" as PdvTab, label: "Configurações", icon: Settings },
        ]
      : []),
  ];

  const moreActive = secondary.some((s) => s.id === tab);

  const pick = (t: PdvTab) => {
    onChange(t);
    try { (navigator as any).vibrate?.(10); } catch {}
  };

  return (
    <>
      <nav
        role="tablist"
        aria-label="Navegação do PDV"
        className="md:hidden shrink-0 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid grid-cols-5">
          {PRIMARY.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={active}
                aria-current={active ? "page" : undefined}
                aria-label={label}
                onClick={() => pick(id)}
                className={`relative flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] transition-all active:scale-95 ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-b-full bg-primary" />
                )}
                <Icon className={`h-[22px] w-[22px] ${active ? "stroke-[2.5]" : ""}`} />
                <span className={`text-[10px] leading-none ${active ? "font-black" : "font-semibold"}`}>
                  {label}
                </span>
              </button>
            );
          })}
          <button
            role="tab"
            aria-label="Mais opções"
            onClick={() => setMoreOpen(true)}
            className={`relative flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] transition-all active:scale-95 ${
              moreActive ? "text-primary" : "text-muted-foreground"
            }`}
          >
            {moreActive && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-b-full bg-primary" />
            )}
            <MoreHorizontal className="h-[22px] w-[22px]" />
            <span className={`text-[10px] leading-none ${moreActive ? "font-black" : "font-semibold"}`}>
              Mais
            </span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl border-t p-0 pb-[env(safe-area-inset-bottom)]"
        >
          <SheetHeader className="px-4 pt-4 pb-2 flex-row items-center justify-between">
            <SheetTitle className="text-base font-black">Mais opções</SheetTitle>
            <button
              onClick={() => setMoreOpen(false)}
              aria-label="Fechar"
              className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-2 p-4 pt-2">
            {secondary.map(({ id, label, icon: Icon }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  onClick={() => {
                    pick(id);
                    setMoreOpen(false);
                  }}
                  className={`min-h-[88px] rounded-xl border p-3 flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95 ${
                    active
                      ? "bg-primary/10 border-primary/40 text-primary"
                      : "bg-card border-border text-foreground hover:bg-muted/50"
                  }`}
                >
                  <Icon className="h-6 w-6" />
                  <span className="text-xs font-bold">{label}</span>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};