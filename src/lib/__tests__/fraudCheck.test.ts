import { describe, expect, it } from "vitest";
import { previewStoreAccess } from "../fraudCheck";

const storeBase = {
  address_city: "São Paulo",
  latitude: -23.5505,
  longitude: -46.6333,
};

describe("previewStoreAccess", () => {
  it("permite a mesma cidade dentro do raio configurado", () => {
    const result = previewStoreAccess(
      { ...storeBase, max_delivery_km: 15 },
      { lat: -23.6000, lng: -46.6500 },
      "Sao Paulo",
    );

    expect(result.allowed).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.distanceKm).toBeGreaterThan(0);
    expect(result.distanceKm).toBeLessThan(15);
  });

  it("bloqueia cidade diferente mesmo quando as coordenadas não estão disponíveis", () => {
    const result = previewStoreAccess(
      { address_city: "São Paulo" },
      null,
      "Itatinga",
    );

    expect(result).toEqual({ allowed: false, distanceKm: null, reason: "city" });
  });

  it("bloqueia distância acima do limite da loja", () => {
    const result = previewStoreAccess(
      { ...storeBase, max_delivery_km: 5 },
      { lat: -23.6500, lng: -46.6333 },
      "São Paulo",
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("distance");
    expect(result.distanceKm).toBeGreaterThan(5);
  });

  it("permite preview sem coordenadas para não impedir retirada ou navegação", () => {
    const result = previewStoreAccess(storeBase, null, "São Paulo");

    expect(result).toEqual({ allowed: true, distanceKm: null, reason: null });
  });

  it("usa delivery_radius quando max_delivery_km não existe", () => {
    const result = previewStoreAccess(
      { ...storeBase, delivery_radius: 5 },
      { lat: -23.6500, lng: -46.6333 },
      "São Paulo",
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("distance");
  });
});
