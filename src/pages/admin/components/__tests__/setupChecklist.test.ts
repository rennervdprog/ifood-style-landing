import { describe, expect, it } from "vitest";
import { buildSetupSteps, type SetupChecklistInput } from "../SetupChecklist";

const base: SetupChecklistInput = {
  imageUrl: null,
  storeHours: null,
  menuProductCount: 0,
  deliveryMode: "own",
  maxDeliveryKm: null,
  deliveryRadius: null,
  estimatedDeliveryTime: null,
  isOwnDelivery: true,
  hasLinkedDrivers: false,
  driversLoading: false,
  whatsappConnected: false,
};

describe("buildSetupSteps — Primeiros passos", () => {
  it("sem hasAnyOrder (cascas antigas), o passo do pedido de teste não entra", () => {
    const steps = buildSetupSteps(base);
    expect(steps.map((s) => s.key)).toEqual(["logo", "hours", "menu", "delivery", "driver", "whatsapp"]);
  });

  it("com hasAnyOrder=false, o pedido de teste é o último passo, pendente e com link da vitrine", () => {
    const steps = buildSetupSteps({ ...base, hasAnyOrder: false, storeSlug: "minha-loja" });
    expect(steps).toHaveLength(7);
    const last = steps[steps.length - 1];
    expect(last.key).toBe("test-order");
    expect(last.done).toBe(false);
    expect(last.href).toBe("/minha-loja");
    expect(last.label).toContain("pedido de teste");
  });

  it("com hasAnyOrder=true, o pedido de teste está concluído", () => {
    const steps = buildSetupSteps({ ...base, hasAnyOrder: true, storeSlug: "minha-loja" });
    const last = steps[steps.length - 1];
    expect(last.key).toBe("test-order");
    expect(last.done).toBe(true);
  });

  it("sem slug, o passo do pedido de teste fica sem link (cai na navegação)", () => {
    const steps = buildSetupSteps({ ...base, hasAnyOrder: false, storeSlug: null });
    const last = steps[steps.length - 1];
    expect(last.key).toBe("test-order");
    expect(last.href).toBeUndefined();
    expect(last.tab).toBe("orders");
  });

  it("loja sem entrega própria tem 6 passos com o pedido de teste", () => {
    const steps = buildSetupSteps({ ...base, isOwnDelivery: false, hasAnyOrder: false });
    expect(steps.map((s) => s.key)).toEqual(["logo", "hours", "menu", "delivery", "whatsapp", "test-order"]);
  });

  it("loja completa e com pedido: todos os passos concluídos", () => {
    const steps = buildSetupSteps({
      imageUrl: "https://exemplo/logo.png",
      storeHours: [{ is_closed_all_day: false }],
      menuProductCount: 12,
      deliveryMode: "own",
      maxDeliveryKm: 8,
      deliveryRadius: null,
      estimatedDeliveryTime: "30-45 min",
      isOwnDelivery: true,
      hasLinkedDrivers: true,
      driversLoading: false,
      whatsappConnected: true,
      hasAnyOrder: true,
      storeSlug: "loja-pronta",
    });
    expect(steps.every((s) => s.done)).toBe(true);
  });
});
