import { useEffect } from "react";

interface ShortcutHandlers {
  onSearchFocus?: () => void;
  onToggleDiscount?: () => void;
  onCyclePayment?: () => void;
  onFinalize?: () => void;
  onClearSale?: () => void;
  enabled?: boolean;
}

/**
 * Atalhos de teclado padrão de PDV profissional (estilo Linx/Bematech):
 *  - F2  → focar busca de produtos
 *  - F3  → abrir/fechar desconto
 *  - F4  → ciclar formas de pagamento
 *  - F8  → finalizar venda
 *  - ESC → limpar venda atual (com confirmação implícita do handler)
 *
 * Os atalhos são ignorados quando o usuário está digitando em <input>/<textarea>
 * (exceto F8, que sempre funciona — é o "fechar venda" sagrado).
 */
export function usePdvShortcuts({
  onSearchFocus,
  onToggleDiscount,
  onCyclePayment,
  onFinalize,
  onClearSale,
  enabled = true,
}: ShortcutHandlers) {
  useEffect(() => {
    if (!enabled) return;

    const isTyping = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return false;
      const tag = t.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        t.isContentEditable
      );
    };

    const handler = (e: KeyboardEvent) => {
      // F8 sempre funciona (finalizar venda)
      if (e.key === "F8") {
        e.preventDefault();
        onFinalize?.();
        return;
      }

      // Demais atalhos não funcionam enquanto está digitando
      if (isTyping(e) && e.key !== "Escape") return;

      switch (e.key) {
        case "F2":
          e.preventDefault();
          onSearchFocus?.();
          break;
        case "F3":
          e.preventDefault();
          onToggleDiscount?.();
          break;
        case "F4":
          e.preventDefault();
          onCyclePayment?.();
          break;
        case "Escape":
          // Permite ESC dentro de input para "blur"
          if (isTyping(e)) {
            (e.target as HTMLElement).blur();
            return;
          }
          e.preventDefault();
          onClearSale?.();
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, onSearchFocus, onToggleDiscount, onCyclePayment, onFinalize, onClearSale]);
}