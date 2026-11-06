import { describe, it, expect } from "vitest";
import { asDeliveryAddress, deliveryQuoteBreakdown, deliveryQuoteFailureMessage } from "@/lib/deliveryQuote";

// Fase 6B (P2-7): quando a cotação falha por não resolver o endereço, a
// mensagem orienta preencher o CEP — é ele que localiza a rua.
describe("deliveryQuoteFailureMessage — P2-7 (CEP)", () => {
  it("address_not_resolved sugere preencher o CEP", () => {
    const msg = deliveryQuoteFailureMessage({ ok: false, reason: "address_not_resolved" });
    expect(msg).toContain("CEP");
    expect(msg).toMatch(/localizar/i);
  });

  it("delivery_quote_failed sugere preencher o CEP", () => {
    const msg = deliveryQuoteFailureMessage({ ok: false, reason: "delivery_quote_failed" });
    expect(msg).toContain("CEP");
  });

  it("delivery_quote_unavailable sugere preencher o CEP", () => {
    const msg = deliveryQuoteFailureMessage({ ok: false, reason: "delivery_quote_unavailable" });
    expect(msg).toContain("CEP");
  });

  it("address_unavailable (cotação) sugere preencher o CEP", () => {
    const msg = deliveryQuoteFailureMessage({ ok: false, reason: "address_unavailable" });
    expect(msg).toContain("CEP");
    expect(msg).toMatch(/rua/i);
  });

  it("outros motivos não viram mensagem de CEP (ex.: fora da área)", () => {
    const msg = deliveryQuoteFailureMessage({
      ok: false,
      reason: "outside_delivery_area",
      distance: { km: 12, max_km: 5 },
    });
    expect(msg).not.toContain("CEP");
    expect(msg).toContain("12.0 km");
  });
});

// Checkout sem CEP (2026-11-06): o endereço monta sem CEP e o resumo do
// cliente não mostra mais a linha "Taxa operacional".
describe("checkout sem CEP — 2026-11-06", () => {
  it("asDeliveryAddress monta o endereço SEM cep", () => {
    const a = asDeliveryAddress({
      street: "Av. Getúlio Vargas",
      number: "100",
      neighborhood: "Centro",
      city: "Araruama",
      state: "RJ",
      cep: "",
    });
    expect(a).not.toBeNull();
    expect(a?.cep).toBe("");
    expect(a?.city).toBe("Araruama");
  });

  it("asDeliveryAddress ignora CEP parcial em vez de travar", () => {
    const a = asDeliveryAddress({
      street: "Av. Getúlio Vargas",
      number: "100",
      neighborhood: "Centro",
      cep: "28979",
    });
    expect(a).not.toBeNull();
    expect(a?.cep).toBe("");
  });

  it("asDeliveryAddress mantém CEP válido de 8 dígitos", () => {
    const a = asDeliveryAddress({
      street: "Av. Getúlio Vargas",
      number: "100",
      neighborhood: "Centro",
      cep: "28979-129",
    });
    expect(a?.cep).toBe("28979129");
  });

  it("deliveryQuoteBreakdown não expõe 'Taxa operacional' pro cliente", () => {
    const quote = {
      ok: true,
      fulfillment: "delivery",
      destination: null,
      distance: { km: 0.8, source: "haversine", max_km: 15, eligible: true },
      pricing: {
        store_delivery_base: 4,
        platform_fee_customer: 0.99,
        platform_fee_store_absorbed: 0,
        delivery_fee: 4.99,
        vip_override_applied: null,
        split_mode: "cliente",
        plan_type: "fixed",
      },
      policy_version: 1,
    } as any;
    expect(deliveryQuoteBreakdown(quote)).toBeNull();
  });

  it("deliveryQuoteBreakdown mantém o aviso de frete grátis", () => {
    const quote = {
      ok: true,
      fulfillment: "delivery",
      destination: null,
      distance: { km: 0.8, source: "haversine", max_km: 15, eligible: true },
      pricing: {
        store_delivery_base: 4,
        platform_fee_customer: 0,
        platform_fee_store_absorbed: 0,
        delivery_fee: 0,
        vip_override_applied: null,
        split_mode: "cliente",
        plan_type: "fixed",
        free_delivery_applied: true,
      },
      policy_version: 1,
    } as any;
    expect(deliveryQuoteBreakdown(quote)).toContain("Frete grátis");
  });
});
