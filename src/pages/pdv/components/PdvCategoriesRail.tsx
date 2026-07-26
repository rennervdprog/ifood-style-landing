import { Layers } from "lucide-react";
import type { MenuSection } from "@/pages/pdv/types";

interface Props {
  sections: MenuSection[];
  activeSection: string | null;
  setActiveSection: (id: string | null) => void;
}

/**
 * Sidebar esquerda com categorias — layout "PDV pro" 3 colunas (desktop).
 * Usa `pdv_color` da seção pra colorir a faixa; fallback para o primary.
 */
export const PdvCategoriesRail = ({ sections, activeSection, setActiveSection }: Props) => {
  return (
    <aside className="w-32 lg:w-40 shrink-0 border-r border-border bg-muted/20 flex flex-col overflow-hidden">
      <div className="px-2 py-2 border-b border-border shrink-0 flex items-center gap-1.5">
        <Layers className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Categorias</span>
      </div>
      <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
        <button
          onClick={() => setActiveSection(null)}
          className={`w-full text-left px-2 py-2 rounded-lg text-xs font-black transition-all border-l-4 ${
            !activeSection
              ? "bg-primary/10 border-primary text-foreground"
              : "bg-card border-transparent hover:bg-muted/40 text-muted-foreground"
          }`}
        >
          Todos
        </button>
        {sections.map((s) => {
          const color = s.pdv_color || "hsl(var(--primary))";
          const active = activeSection === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setActiveSection(active ? null : s.id)}
              style={{ borderLeftColor: active ? color : "transparent" }}
              className={`w-full text-left px-2 py-2 rounded-lg text-xs font-black transition-all border-l-4 ${
                active ? "bg-primary/10 text-foreground" : "bg-card hover:bg-muted/40 text-muted-foreground"
              }`}
            >
              <span
                className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
                style={{ background: color }}
              />
              <span className="align-middle">{s.name}</span>
            </button>
          );
        })}
        {sections.length === 0 && (
          <p className="text-[10px] text-muted-foreground px-2 py-3 text-center">Sem categorias</p>
        )}
      </div>
    </aside>
  );
};