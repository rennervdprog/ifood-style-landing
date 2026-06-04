/**
 * useBRLInput — Hook para inputs monetários no padrão brasileiro
 *
 * Converte digitação livre em formato R$ 1.234,56
 * Retorna o valor numérico real para uso nos cálculos.
 *
 * Uso:
 *   const price = useBRLInput(0)
 *   <input value={price.display} onChange={e => price.onChange(e.target.value)} />
 *   console.log(price.value) // 1234.56
 */

import { useState, useCallback } from "react";

interface BRLInput {
  /** Valor exibido no input (ex: "1.234,56") */
  display: string;
  /** Valor numérico real (ex: 1234.56) */
  value: number;
  /** Handler para o onChange do input */
  onChange: (raw: string) => void;
  /** Reseta para um valor específico */
  reset: (value?: number) => void;
}

/**
 * Formata número para exibição pt-BR sem símbolo R$
 * Ex: 1234.56 → "1.234,56"
 */
export function formatBRLDisplay(value: number): string {
  if (isNaN(value) || value === 0) return "";
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Converte digitação contínua em centavos para número.
 * Ex: "1" → 0.01, "123" → 1.23, "123456" → 1234.56
 */
export function parseBRLCentsInput(raw: string): number {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return 0;
  const num = Number(digits) / 100;
  return Number.isFinite(num) ? num : 0;
}

/**
 * Converte string digitada no padrão pt-BR para número
 * Aceita: "1.234,56" | "1234,56" | "1234.56" | "1234"
 */
export function parseBRL(raw: string): number {
  if (!raw) return 0;
  // Remove tudo exceto dígitos e separadores
  let clean = raw.replace(/[^\d.,]/g, "");
  // Se tem ponto E vírgula: ponto = milhar, vírgula = decimal → "1.234,56"
  if (clean.includes(".") && clean.includes(",")) {
    clean = clean.replace(/\./g, "").replace(",", ".");
  }
  // Só vírgula: "1234,56" → decimal brasileiro
  else if (clean.includes(",")) {
    clean = clean.replace(",", ".");
  }
  // Só ponto: pode ser milhar ("1.234") ou decimal ("12.56")
  // Se a parte depois do ponto tem 3 dígitos, é milhar
  else if (clean.includes(".")) {
    const parts = clean.split(".");
    if (parts[parts.length - 1].length === 3) {
      clean = clean.replace(/\./g, ""); // remove milhar
    }
  }
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

export function getBRLDisplayWholeDigits(display: string): string {
  return (display.split(",")[0] || "").replace(/\D/g, "");
}

/**
 * Converte digitação monetária formatada em valor real, sem tratar números puros como centavos.
 * Ex: "2500" → 2500, "2.500,00" → 2500, "R$ 2,005" → 25 ao digitar no fim.
 */
export function parseBRLTypingInput(raw: string): number {
  if (!raw) return 0;

  const clean = raw.replace(/[^\d.,]/g, "");
  if (!clean) return 0;

  if (clean.includes(",")) {
    const [integerPart, ...fractionParts] = clean.split(",");
    const fractionDigits = fractionParts.join("").replace(/\D/g, "");

    if (fractionDigits.length > 2 && fractionDigits.startsWith("00")) {
      const wholeDigits = `${integerPart.replace(/\D/g, "")}${fractionDigits.slice(2)}`;
      const num = Number(wholeDigits || 0);
      return Number.isFinite(num) ? num : 0;
    }
  }

  return parseBRL(raw);
}

export function useBRLInput(initialValue: number = 0): BRLInput {
  const [display, setDisplay] = useState<string>(
    initialValue > 0 ? formatBRLDisplay(initialValue) : ""
  );
  const [value, setValue] = useState<number>(initialValue);

  const onChange = useCallback((raw: string) => {
    const nextValue = parseBRLTypingInput(raw);
    setValue(nextValue);
    setDisplay(nextValue > 0 ? formatBRLDisplay(nextValue) : "");
  }, []);

  const reset = useCallback((newValue: number = 0) => {
    setValue(newValue);
    setDisplay(newValue > 0 ? formatBRLDisplay(newValue) : "");
  }, []);

  return { display, value, onChange, reset };
}

/**
 * Versão simples para campos de percentual (0-100)
 * Aceita "2,5" ou "2.5" → 2.5
 */
export function parsePercent(raw: string): number {
  if (!raw) return 0;
  const clean = raw.replace(",", ".");
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : Math.min(100, Math.max(0, num));
}
