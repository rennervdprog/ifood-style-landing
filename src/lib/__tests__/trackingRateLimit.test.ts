import { describe, expect, it } from "vitest";
import {
  TRACKING_MAX_WRONG_PER_IP,
  TRACKING_MAX_WRONG_PER_ORDER,
  TRACKING_RATE_LIMIT_WINDOW_MINUTES,
  isIpRateLimited,
  isOrderRateLimited,
  rateLimitWindowStart,
} from "../trackingRateLimit";

describe("trackingRateLimit (Fase 5 — rate limit no rastreio público)", () => {
  it("janela é de 10 minutos", () => {
    const now = new Date("2026-10-26T10:00:00.000Z");
    expect(rateLimitWindowStart(now).toISOString()).toBe("2026-10-26T09:50:00.000Z");
    expect(TRACKING_RATE_LIMIT_WINDOW_MINUTES).toBe(10);
  });

  it("por pedido: 9 erradas passam, 10 travam (a 11ª volta 429)", () => {
    expect(TRACKING_MAX_WRONG_PER_ORDER).toBe(10);
    expect(isOrderRateLimited(0)).toBe(false);
    expect(isOrderRateLimited(9)).toBe(false);
    expect(isOrderRateLimited(10)).toBe(true);
    expect(isOrderRateLimited(11)).toBe(true);
  });

  it("por IP: 29 passam, 30 travam (teto mais frouxo)", () => {
    expect(TRACKING_MAX_WRONG_PER_IP).toBe(30);
    expect(isIpRateLimited(29)).toBe(false);
    expect(isIpRateLimited(30)).toBe(true);
    expect(isIpRateLimited(31)).toBe(true);
  });
});
