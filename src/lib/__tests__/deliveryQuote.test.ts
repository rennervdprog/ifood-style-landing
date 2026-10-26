import { describe, it, expect } from "vitest";
import { deliveryQuoteFailureMessage } from "@/lib/deliveryQuote";

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
