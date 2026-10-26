import { describe, it, expect } from "vitest";
import { computeGuestCheckoutGates } from "@/lib/guestCheckoutGates";
import type { StoreStatusResult } from "@/lib/storeStatus";

// Fase 4 do plano guest/bot (P1-1) — travas do guest no front, com as mesmas
// regras e mensagens do checkout logado (CheckoutPage.tsx).
const OPEN: StoreStatusResult = { isOpen: true, reason: "Aberto até 22:00" };
const CLOSED_TODAY: StoreStatusResult = {
  isOpen: false,
  reason: "Abre hoje às 18:00",
  nextOpenTime: "18:00",
  nextOpenDay: "Hoje",
};
const CLOSED_TOMORROW: StoreStatusResult = {
  isOpen: false,
  reason: "Abre Amanhã às 18:00",
  nextOpenTime: "18:00",
  nextOpenDay: "Amanhã",
};
const CLOSED_NO_NEXT: StoreStatusResult = { isOpen: false, reason: "Fechado" };
const PREORDER: StoreStatusResult = {
  isOpen: false,
  reason: "Abre hoje às 18:00",
  nextOpenTime: "18:00",
  nextOpenDay: "Hoje",
  acceptingPreorder: true,
  releaseAt: "2026-10-26T21:00:00.000Z",
};

describe("computeGuestCheckoutGates — Fase 4", () => {
  it("loja aberta + acima do mínimo → nada trava", () => {
    const g = computeGuestCheckoutGates({ subtotal: 92.99, minimumOrderValue: 15, storeStatus: OPEN });
    expect(g.isStoreClosed).toBe(false);
    expect(g.isPreorder).toBe(false);
    expect(g.belowMinimum).toBe(false);
    expect(g.minimumMissing).toBe(0);
    expect(g.submitError).toBeNull();
    expect(g.minimumButtonLabel).toBeNull();
  });

  it("abaixo do mínimo (Pastelão: mínimo 15, subtotal 9) → trava com a mensagem do checkout logado", () => {
    const g = computeGuestCheckoutGates({ subtotal: 9, minimumOrderValue: 15, storeStatus: OPEN });
    expect(g.belowMinimum).toBe(true);
    expect(g.minimumMissing).toBe(6);
    expect(g.submitError).toContain("Pedido mínimo desta loja:");
    expect(g.submitError).toContain("15,00");
    expect(g.submitError).toContain("6,00");
    expect(g.minimumButtonLabel).toContain("Faltam");
    expect(g.minimumButtonLabel).toContain("6,00");
  });

  it("exatamente no mínimo → não trava", () => {
    const g = computeGuestCheckoutGates({ subtotal: 15, minimumOrderValue: 15, storeStatus: OPEN });
    expect(g.belowMinimum).toBe(false);
    expect(g.submitError).toBeNull();
  });

  it("mínimo 0 → nunca trava por mínimo", () => {
    const g = computeGuestCheckoutGates({ subtotal: 0, minimumOrderValue: 0, storeStatus: OPEN });
    expect(g.belowMinimum).toBe(false);
    expect(g.submitError).toBeNull();
  });

  it("loja fechada → trava com a mensagem de fechada + botão 'Abre às 18:00'", () => {
    const g = computeGuestCheckoutGates({ subtotal: 92.99, minimumOrderValue: 15, storeStatus: CLOSED_TODAY });
    expect(g.isStoreClosed).toBe(true);
    expect(g.submitError).toContain("Loja fechada.");
    expect(g.submitError).toContain("Abre hoje às 18:00");
    expect(g.closedButtonLabel).toBe("Abre às 18:00");
  });

  it("loja fechada, abre amanhã → botão 'Abre Amanhã às 18:00'", () => {
    const g = computeGuestCheckoutGates({ subtotal: 92.99, minimumOrderValue: 15, storeStatus: CLOSED_TOMORROW });
    expect(g.isStoreClosed).toBe(true);
    expect(g.closedButtonLabel).toBe("Abre Amanhã às 18:00");
  });

  it("loja fechada sem próxima abertura → botão 'Loja fechada'", () => {
    const g = computeGuestCheckoutGates({ subtotal: 92.99, minimumOrderValue: 15, storeStatus: CLOSED_NO_NEXT });
    expect(g.isStoreClosed).toBe(true);
    expect(g.closedButtonLabel).toBe("Loja fechada");
  });

  it("pré-pedido ativo → não trava (o pedido vira agendado, como no checkout logado)", () => {
    const g = computeGuestCheckoutGates({ subtotal: 92.99, minimumOrderValue: 15, storeStatus: PREORDER });
    expect(g.isStoreClosed).toBe(false);
    expect(g.isPreorder).toBe(true);
    expect(g.submitError).toBeNull();
  });

  it("fechada + abaixo do mínimo → a trava de fechada vence", () => {
    const g = computeGuestCheckoutGates({ subtotal: 9, minimumOrderValue: 15, storeStatus: CLOSED_TODAY });
    expect(g.isStoreClosed).toBe(true);
    expect(g.belowMinimum).toBe(true);
    expect(g.submitError).toContain("Loja fechada.");
  });

  it("status ainda carregando (null) → não inventa trava de fechada; o mínimo (que não depende do horário) continua valendo", () => {
    const g = computeGuestCheckoutGates({ subtotal: 9, minimumOrderValue: 15, storeStatus: null });
    expect(g.isStoreClosed).toBe(false);
    expect(g.belowMinimum).toBe(true);
    expect(g.submitError).toContain("Pedido mínimo desta loja:");
  });
});
