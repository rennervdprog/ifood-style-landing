/**
 * Barra de status estilo "keycap" — sempre visível no rodapé do PDV durante
 * a venda. Estética de balcão profissional (Linx/Bematech): operador vê os
 * atalhos sem precisar memorizar.
 */
const KEYS: { k: string; label: string }[] = [
  { k: "F1", label: "Ajuda" },
  { k: "F2", label: "Buscar" },
  { k: "F3", label: "Desconto" },
  { k: "F4", label: "Pagamento" },
  { k: "F6", label: "Sangria" },
  { k: "F7", label: "Reforço" },
  { k: "F8", label: "Finalizar" },
  { k: "F10", label: "Fechar caixa" },
  { k: "ESC", label: "Limpar" },
];

export const PdvStatusBar = () => (
  <div className="hidden md:flex h-9 border-t border-border bg-card/95 backdrop-blur-sm items-center gap-1.5 px-3 shrink-0 overflow-x-auto no-scrollbar">
    {KEYS.map(({ k, label }) => (
      <div
        key={k}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/40 border border-border/70 whitespace-nowrap"
      >
        <kbd className="px-1.5 py-0.5 rounded bg-background border border-border text-[10px] font-black text-foreground pdv-mono leading-none">
          {k}
        </kbd>
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
      </div>
    ))}
  </div>
);