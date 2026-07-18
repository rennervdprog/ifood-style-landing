import { useEffect } from "react";

interface ShortcutHandlers {
  onSearchFocus?: () => void;
  onToggleDiscount?: () => void;
  onCyclePayment?: () => void;
  onFinalize?: () => void;
  onClearSale?: () => void;
  onHelp?: () => void;          // F1
  onSangria?: () => void;       // F6
  onSuprimento?: () => void;    // F7
  onCloseSession?: () => void;  // F10
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
  onHelp,
  onSangria,
  onSuprimento,
  onCloseSession,
  enabled = true,
}: ShortcutHandlers) {
  useEffect(() => {
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
      // F8 finaliza venda — mas NÃO dispara enquanto o operador digita
      // em um campo marcado com `data-pdv-no-hotkey` (ex.: valor recebido).
      // Bug do relatório: F8 podia finalizar prematuramente durante a digitação.
      if (e.key === "F8") {
        const t = e.target as HTMLElement | null;
        if (t?.hasAttribute?.("data-pdv-no-hotkey")) return;
        e.preventDefault();
        onFinalize?.();
        return;
      }

      // F10 sempre funciona (fechar caixa) — operação sagrada
      if (e.key === "F10") {
        e.preventDefault();
        onCloseSession?.();
        return;
      }

      // F1 (ajuda) sempre funciona — atalho global
      if (e.key === "F1") {
        e.preventDefault();
        onHelp?.();
        return;
      }

      // Demais atalhos exigem contexto de venda ativo
      if (!enabled) return;

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
        case "F6":
          e.preventDefault();
          onSangria?.();
          break;
        case "F7":
          e.preventDefault();
          onSuprimento?.();
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
  }, [enabled, onSearchFocus, onToggleDiscount, onCyclePayment, onFinalize, onClearSale, onHelp, onSangria, onSuprimento, onCloseSession]);
}