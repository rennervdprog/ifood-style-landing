import { describe, expect, it } from "vitest";
import { canOpenPixDiretoRefundCase, isPixDiretoPayment, PHYSICAL_PAYMENT_METHODS } from "../refundEligibility";

describe("refundEligibility", () => {
  it("permite somente PIX Direto em pedido concluído", () => {
    expect(canOpenPixDiretoRefundCase("pix_direto", "entregue")).toBe(true);
    expect(canOpenPixDiretoRefundCase("pix_direto", "finalizado")).toBe(true);
  });

  it("bloqueia PIX Direto que ainda não chegou à etapa de conclusão", () => {
    expect(canOpenPixDiretoRefundCase("pix_direto", "preparando")).toBe(false);
    expect(canOpenPixDiretoRefundCase("pix_direto", "cancelado")).toBe(false);
  });

  it("bloqueia todas as modalidades físicas e legadas", () => {
    for (const method of PHYSICAL_PAYMENT_METHODS) {
      expect(isPixDiretoPayment(method)).toBe(false);
      expect(canOpenPixDiretoRefundCase(method, "entregue")).toBe(false);
    }
    expect(canOpenPixDiretoRefundCase("pix", "entregue")).toBe(false);
    expect(canOpenPixDiretoRefundCase(undefined, "entregue")).toBe(false);
  });
});
