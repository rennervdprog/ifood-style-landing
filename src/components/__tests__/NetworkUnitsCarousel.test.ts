/**
 * Item 3 (17/11/2026): o card da unidade na página do grupo mostra o modo
 * real — "Retirada" quando delivery_enabled é false/NULL, "Entrega" quando
 * true. Antes, o rótulo vinha só de delivery_mode (sempre 'own'), então
 * toda unidade exibia "• Entrega", mesmo só-retirada.
 */
import { describe, it, expect } from "vitest";
import { getUnitDeliveryLabels } from "@/components/NetworkUnitsCarousel";

describe("getUnitDeliveryLabels (Item 3)", () => {
  it("unidade só-retirada (flag false) com delivery_mode 'own' mostra Retirada", () => {
    expect(getUnitDeliveryLabels(false, "own")).toEqual(["Retirada"]);
  });

  it("flag NULL histórico conta como só-retirada (mesma semântica do checklist)", () => {
    expect(getUnitDeliveryLabels(null, "own")).toEqual(["Retirada"]);
  });

  it("unidade com entrega (flag true) e mode 'own' mostra Entrega", () => {
    expect(getUnitDeliveryLabels(true, "own")).toEqual(["Entrega"]);
  });

  it("flag true preserva a lógica atual por delivery_mode (both → Retirada + Entrega)", () => {
    expect(getUnitDeliveryLabels(true, "both")).toEqual(["Retirada", "Entrega"]);
  });

  it("flag true com mode 'pickup' mostra Retirada", () => {
    expect(getUnitDeliveryLabels(true, "pickup")).toEqual(["Retirada"]);
  });

  it("flag true sem mode mostra Retirada (fallback atual preservado)", () => {
    expect(getUnitDeliveryLabels(true, null)).toEqual(["Retirada"]);
  });
});
