/**
 * Testes Fase 4b: P1 (rede só-PDV base 0) e P2 (override > template >
 * guardado) no espelho puro da RPC — src/lib/networkBilling.ts.
 */
import { describe, it, expect } from "vitest";
import {
  calcNetworkFeeDetailed,
  resolveNetworkBaseFee,
  isNetworkVip,
} from "../networkBilling";

describe("P1 — rede só-PDV base 0 (REGRA)", () => {
  it("0 delivery + 2 só-PDV → base 0, base_reason pdv_only_network, vip sistêmico", () => {
    const r = calcNetworkFeeDetailed({
      storedFee: 120, templateFee: 120, overrideFee: null,
      deliveryUnitCount: 0, pdvOnlyUnitCount: 2, gmv60d: 6000,
    });
    expect(r.baseMonthlyFee).toBe(0);
    expect(r.baseReason).toBe("pdv_only_network");
    expect(r.isVip).toBe(false);
    expect(r.vipKind).toBe("systemic");
    expect(r.totalMonthlyFee).toBe(0);
  });

  it("P1 vence override: 0 delivery + 1 só-PDV + override 75 → base 0", () => {
    const r = calcNetworkFeeDetailed({
      storedFee: 120, templateFee: 120, overrideFee: 75,
      deliveryUnitCount: 0, pdvOnlyUnitCount: 1, gmv60d: 6000,
    });
    expect(r.baseMonthlyFee).toBe(0);
    expect(r.baseReason).toBe("pdv_only_network");
  });

  it("rede sem unidade nenhuma NÃO é só-PDV: base normal do template", () => {
    const r = calcNetworkFeeDetailed({
      storedFee: 90, templateFee: 89.9, overrideFee: null,
      deliveryUnitCount: 0, pdvOnlyUnitCount: 0, gmv60d: 6000,
    });
    expect(r.baseMonthlyFee).toBe(89.9);
    expect(r.baseReason).toBe("template");
  });

  it("rede mista inalterada: base cheia + R$ 39,90 só sobre delivery além de 3", () => {
    const r = calcNetworkFeeDetailed({
      storedFee: 90, templateFee: 89.9, overrideFee: null,
      deliveryUnitCount: 4, pdvOnlyUnitCount: 2, gmv60d: 6000,
    });
    expect(r.baseMonthlyFee).toBe(89.9);
    expect(r.extraUnitCount).toBe(1);
    expect(r.extraFee).toBeCloseTo(39.9, 2);
    expect(r.totalMonthlyFee).toBeCloseTo(129.8, 2);
  });

  it("unidade só-PDV continua fora dos extras (não paga os R$ 39,90)", () => {
    const r = calcNetworkFeeDetailed({
      storedFee: 90, templateFee: 89.9, overrideFee: null,
      deliveryUnitCount: 3, pdvOnlyUnitCount: 5, gmv60d: 6000,
    });
    expect(r.extraUnitCount).toBe(0);
    expect(r.totalMonthlyFee).toBeCloseTo(89.9, 2);
  });
});

describe("P2 — precedência e selo no cálculo da rede", () => {
  it("guardado 90 + override 90 → base 90 (não 89,90), selo VIP (diverge do template)", () => {
    const r = calcNetworkFeeDetailed({
      storedFee: 90, templateFee: 89.9, overrideFee: 90,
      deliveryUnitCount: 2, pdvOnlyUnitCount: 0, gmv60d: 6000,
    });
    expect(r.baseMonthlyFee).toBe(90);
    expect(r.baseReason).toBe("override");
    expect(r.isVip).toBe(true);
    expect(r.vipKind).toBe("granted");
  });

  it("override igual ao template → base do template, SEM selo VIP", () => {
    const r = calcNetworkFeeDetailed({
      storedFee: 90, templateFee: 89.9, overrideFee: 89.9,
      deliveryUnitCount: 2, pdvOnlyUnitCount: 0, gmv60d: 6000,
    });
    expect(r.baseMonthlyFee).toBe(89.9);
    expect(r.isVip).toBe(false);
    expect(r.vipKind).toBe("none");
  });

  it("sem override → template; sem template → guardado", () => {
    expect(
      calcNetworkFeeDetailed({
        storedFee: 90, templateFee: 89.9, overrideFee: null,
        deliveryUnitCount: 1, pdvOnlyUnitCount: 0, gmv60d: 6000,
      }).baseMonthlyFee,
    ).toBe(89.9);
    expect(
      calcNetworkFeeDetailed({
        storedFee: 90, templateFee: null, overrideFee: null,
        deliveryUnitCount: 1, pdvOnlyUnitCount: 0, gmv60d: 6000,
      }).baseReason,
    ).toBe("stored_fallback");
  });

  it("gratuidade GMV continua zerando o total (qualquer base)", () => {
    const r = calcNetworkFeeDetailed({
      storedFee: 90, templateFee: 89.9, overrideFee: 90,
      deliveryUnitCount: 5, pdvOnlyUnitCount: 0, gmv60d: 5000,
    });
    expect(r.freeByGmv).toBe(true);
    expect(r.totalMonthlyFee).toBe(0);
  });

  it("helpers de precedência/selo concordam com o cálculo detalhado", () => {
    expect(resolveNetworkBaseFee({ storedFee: 90, templateFee: 89.9, overrideFee: 90 })).toBe(90);
    expect(isNetworkVip({ storedFee: 90, templateFee: 89.9, overrideFee: 89.9 })).toBe(false);
  });
});
