import { describe, it, expect } from "vitest";
import {
  toCents,
  fromCents,
  addMoney,
  subtractMoney,
  sumMoney,
  multiplyMoney,
  averageMoney,
  formatBRL,
  cn,
} from "@/lib/utils";

describe("money helpers — precisão (sem floating-point drift)", () => {
  it("toCents converte string e número", () => {
    expect(toCents(10.5)).toBe(1050);
    expect(toCents("10.50")).toBe(1050);
    expect(toCents(null)).toBe(0);
    expect(toCents(undefined)).toBe(0);
    expect(toCents("abc")).toBe(0);
  });

  it("fromCents reverte sem perda", () => {
    expect(fromCents(1050)).toBe(10.5);
    expect(fromCents(0)).toBe(0);
  });

  it("addMoney resolve 0.1 + 0.2 sem floating-point bug", () => {
    expect(addMoney(0.1, 0.2)).toBe(0.3);
    expect(addMoney(1.99, 2.01, 3)).toBe(7);
  });

  it("subtractMoney mantém precisão", () => {
    expect(subtractMoney(10, 0.1, 0.2)).toBe(9.7);
    expect(subtractMoney(5, 5)).toBe(0);
  });

  it("sumMoney aceita array vazio e nulls", () => {
    expect(sumMoney([])).toBe(0);
    expect(sumMoney([null, undefined, 1.5, "2.5"])).toBe(4);
  });

  it("multiplyMoney arredonda em centavos", () => {
    expect(multiplyMoney(10, 0.1)).toBe(1);
    expect(multiplyMoney(0.1, 3)).toBe(0.3);
  });

  it("averageMoney protege divisão por zero", () => {
    expect(averageMoney(100, 0)).toBe(0);
    expect(averageMoney(10, 4)).toBe(2.5);
  });
});

describe("formatBRL", () => {
  it("formata valores típicos", () => {
    // \u00a0 = non-breaking space (Intl usa NBSP entre R$ e número)
    expect(formatBRL(10).replace(/\s/g, " ")).toBe("R$ 10,00");
    expect(formatBRL(0).replace(/\s/g, " ")).toBe("R$ 0,00");
    expect(formatBRL(1234.5).replace(/\s/g, " ")).toBe("R$ 1.234,50");
  });
  it("tolera nulls e strings", () => {
    expect(formatBRL(null).replace(/\s/g, " ")).toBe("R$ 0,00");
    expect(formatBRL("12.34").replace(/\s/g, " ")).toBe("R$ 12,34");
  });
});

describe("cn (tailwind merge)", () => {
  it("mescla classes e remove conflitos", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-foreground", false && "hidden", "font-bold")).toBe("text-foreground font-bold");
  });
});