import { describe, expect, it } from "vitest";
import {
  canOpenPixDiretoRefundCase,
  isPixDiretoPayment,
  isRefundWindowOpen,
  PHYSICAL_PAYMENT_METHODS,
} from "../refundEligibility";

const now = Date.parse("2025-06-17T00:00:00Z");
const openDeadline = "2025-06-17T00:00:01Z";
const expiredDeadline = "2025-06-16T23:59:59Z";

describe("refundEligibility", () => {
  it("permite somente PIX Direto em pedido concluído dentro da janela", () => {
    expect(canOpenPixDiretoRefundCase("pix_direto", "entregue", openDeadline, now)).toBe(true);
    expect(canOpenPixDiretoRefundCase("pix_direto", "finalizado", openDeadline, now)).toBe(true);
  });

  it("bloqueia PIX Direto quando a janela de 24 horas expirou", () => {
    expect(canOpenPixDiretoRefundCase("pix_direto", "entregue", expiredDeadline, now)).toBe(false);
    expect(canOpenPixDiretoRefundCase("pix_direto", "entregue", "2025-06-16T00:00:00Z", now)).toBe(false);
  });

  it("bloqueia prazo ausente ou inválido", () => {
    expect(isRefundWindowOpen(null, now)).toBe(false);
    expect(isRefundWindowOpen("invalido", now)).toBe(false);
    expect(canOpenPixDiretoRefundCase("pix_direto", "entregue", undefined, now)).toBe(false);
  });

  it("bloqueia PIX Direto que ainda não chegou à etapa de conclusão", () => {
    expect(canOpenPixDiretoRefundCase("pix_direto", "preparando", openDeadline, now)).toBe(false);
    expect(canOpenPixDiretoRefundCase("pix_direto", "cancelado", openDeadline, now)).toBe(false);
  });

  it("bloqueia todas as modalidades físicas e legadas", () => {
    for (const method of PHYSICAL_PAYMENT_METHODS) {
      expect(isPixDiretoPayment(method)).toBe(false);
      expect(canOpenPixDiretoRefundCase(method, "entregue", openDeadline, now)).toBe(false);
    }
    expect(canOpenPixDiretoRefundCase("pix", "entregue", openDeadline, now)).toBe(false);
    expect(canOpenPixDiretoRefundCase(undefined, "entregue", openDeadline, now)).toBe(false);
  });
});
