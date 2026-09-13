import { describe, expect, it } from "vitest";
import { compareLegalVersions, isLegalVersionAtLeast } from "@/lib/legalVersions";

describe("compareLegalVersions", () => {
  it("ordena por número, não por string", () => {
    // O bug que motivou o helper: com `>=` de string, "10.0" perde para "4.2".
    expect(compareLegalVersions("10.0", "4.2")).toBeGreaterThan(0);
    expect(compareLegalVersions("4.2", "10.0")).toBeLessThan(0);
  });

  it("compara o segundo componente quando o primeiro empata", () => {
    expect(compareLegalVersions("6.6", "6.5")).toBeGreaterThan(0);
    expect(compareLegalVersions("6.5", "6.6")).toBeLessThan(0);
    expect(compareLegalVersions("6.6", "6.6")).toBe(0);
  });

  it("trata comprimentos diferentes", () => {
    expect(compareLegalVersions("6", "6.0")).toBe(0);
    expect(compareLegalVersions("6.1", "6")).toBeGreaterThan(0);
  });

  it("trata null, undefined e lixo como versão zero", () => {
    expect(compareLegalVersions(null, "1.0")).toBeLessThan(0);
    expect(compareLegalVersions(undefined, "1.0")).toBeLessThan(0);
    expect(compareLegalVersions("", "1.0")).toBeLessThan(0);
    expect(compareLegalVersions("abc", "1.0")).toBeLessThan(0);
  });
});

describe("isLegalVersionAtLeast", () => {
  it("aceita igual ou mais nova", () => {
    expect(isLegalVersionAtLeast("4.2", "4.2")).toBe(true);
    expect(isLegalVersionAtLeast("6.6", "4.2")).toBe(true);
    expect(isLegalVersionAtLeast("10.0", "4.2")).toBe(true);
  });

  it("recusa mais antiga", () => {
    expect(isLegalVersionAtLeast("4.1", "4.2")).toBe(false);
    expect(isLegalVersionAtLeast("1.0", "4.2")).toBe(false);
    expect(isLegalVersionAtLeast(null, "4.2")).toBe(false);
  });
});
