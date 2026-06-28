import { describe, it, expect } from "vitest";
import { haversineMeters, isValidCoordinate } from "../distance";

describe("haversineMeters", () => {
  it("retorna 0 para o mesmo ponto", () => {
    const p = { lat: -23.55, lng: -46.63 };
    expect(haversineMeters(p, p)).toBeCloseTo(0, 5);
  });

  it("calcula ~111km para 1 grau de latitude", () => {
    const d = haversineMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });

  it("São Paulo → Rio ≈ 360km", () => {
    const sp = { lat: -23.5505, lng: -46.6333 };
    const rj = { lat: -22.9068, lng: -43.1729 };
    const km = haversineMeters(sp, rj) / 1000;
    expect(km).toBeGreaterThan(355);
    expect(km).toBeLessThan(365);
  });
});

describe("isValidCoordinate", () => {
  it("aceita coords finitas", () => {
    expect(isValidCoordinate(-23.5, -46.6)).toBe(true);
  });
  it("rejeita null/undefined/NaN/Infinity", () => {
    expect(isValidCoordinate(null, null)).toBe(false);
    expect(isValidCoordinate(undefined, undefined)).toBe(false);
    expect(isValidCoordinate(NaN, 0)).toBe(false);
    expect(isValidCoordinate(0, Infinity)).toBe(false);
  });
});