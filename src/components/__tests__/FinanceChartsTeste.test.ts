import { describe, it, expect } from "vitest";
import { computeYDomainMax } from "@/components/FinanceChartsTeste";

describe("computeYDomainMax (teto do eixo Y — Evolução)", () => {
  it("pico R$ 978,98 (PDV 22/10) → teto 1100", () => {
    const data = [
      { delivery: 22, pdv: 416.99 },
      { delivery: 100.99, pdv: 978.98 },
      { delivery: 368.78, pdv: 0 },
    ];
    expect(computeYDomainMax(data)).toBe(1100);
  });

  it("pico R$ 350 → teto 400 (10% de folga, centena seguinte)", () => {
    expect(computeYDomainMax([{ delivery: 350, pdv: 0 }])).toBe(400);
  });

  it("sem dados → 100 (nunca 0)", () => {
    expect(computeYDomainMax([])).toBe(100);
    expect(computeYDomainMax([{ delivery: 0, pdv: 0 }])).toBe(100);
  });

  it("considera o maior entre delivery e PDV", () => {
    expect(computeYDomainMax([{ delivery: 900, pdv: 100 }])).toBe(1000);
    expect(computeYDomainMax([{ delivery: 100, pdv: 900 }])).toBe(1000);
  });
});
