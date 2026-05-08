import { useEffect, useRef } from "react";

/**
 * Hook que detecta entrada de leitor de código de barras USB (HID).
 *
 * Heurística: leitores enviam ~10-20 caracteres em < 50ms terminando com Enter.
 * Se a digitação for muito rápida e tiver pelo menos 4 chars antes do Enter,
 * tratamos como leitura de código de barras e disparamos onScan(code).
 *
 * Ignora quando o foco está em campo de texto (deixa o leitor preencher input
 * normalmente, ex: campo de busca já filtra produtos).
 */
export function usePdvBarcodeScanner(onScan: (code: string) => void, enabled = true) {
  const bufferRef = useRef("");
  const lastKeyTimeRef = useRef(0);
  const startTimeRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (isInInput) return;

      const now = Date.now();
      const delta = now - lastKeyTimeRef.current;

      // Reset se demorou muito desde última tecla
      if (delta > 100) {
        bufferRef.current = "";
        startTimeRef.current = now;
      }
      lastKeyTimeRef.current = now;

      if (e.key === "Enter") {
        const totalTime = now - startTimeRef.current;
        const code = bufferRef.current;
        bufferRef.current = "";
        // só considera scan se foi rápido (< 200ms total) e tem >= 4 chars
        if (code.length >= 4 && totalTime < 200) {
          e.preventDefault();
          onScan(code);
        }
        return;
      }

      if (e.key.length === 1) {
        bufferRef.current += e.key;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, onScan]);
}