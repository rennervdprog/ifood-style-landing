import { describe, expect, it } from "vitest";
import { resolveSearchStores } from "../storeVisibility";

const store = (id: string, extra: Record<string, unknown> = {}) => ({ id, ...extra });

describe("resolveSearchStores (busca /cliente/busca)", () => {
  it("sem motoboy online, mostra todas (só-retirada + entrega, fechadas)", () => {
    const all = [
      store("pickup", { delivery_enabled: false }),
      store("delivery", { delivery_enabled: true }),
    ];
    expect(resolveSearchStores(all, [])).toEqual(all);
  });

  it("loja só-retirada passa sempre, sem exigir motoboy", () => {
    const all = [
      store("pickup", { delivery_enabled: false }),
      store("delivery-com-motoboy", { delivery_enabled: true }),
      store("delivery-sem-motoboy", { delivery_enabled: true }),
    ];
    const withDrivers = [store("delivery-com-motoboy", { delivery_enabled: true })];
    expect(resolveSearchStores(all, withDrivers)).toEqual([
      store("pickup", { delivery_enabled: false }),
      store("delivery-com-motoboy", { delivery_enabled: true }),
    ]);
  });

  it("loja pdv_only nunca aparece", () => {
    const all = [
      store("pdv", { plan_type: "pdv_only", delivery_enabled: false }),
      store("pickup", { delivery_enabled: false }),
    ];
    expect(resolveSearchStores(all, [])).toEqual([store("pickup", { delivery_enabled: false })]);
  });

  it("delivery_enabled ausente conta como entrega (precisa de motoboy)", () => {
    const all = [store("sem-campo"), store("pickup", { delivery_enabled: false })];
    // Sem motoboy online: fallback mostra todas (só-retirada primeiro).
    expect(resolveSearchStores(all, [])).toEqual([
      store("pickup", { delivery_enabled: false }),
      store("sem-campo"),
    ]);
    expect(resolveSearchStores(all, [store("sem-campo")])).toEqual([
      store("pickup", { delivery_enabled: false }),
      store("sem-campo"),
    ]);
  });

  it("lista vazia ou só pdv_only devolve vazio", () => {
    expect(resolveSearchStores([], [])).toEqual([]);
    expect(resolveSearchStores(null, null)).toEqual([]);
    expect(resolveSearchStores([store("pdv", { plan_type: "pdv_only" })], [])).toEqual([]);
  });
});
