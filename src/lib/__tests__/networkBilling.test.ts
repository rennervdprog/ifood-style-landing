import { describe, it, expect } from "vitest";
import {
  countDeliveryUnits,
  countPdvOnlyUnits,
  isPublishedUnit,
  resolveUnitPlanMonthlyFee,
  shouldSkipUnitPlanBill,
  buildNetworkChargeDescription,
} from "../networkBilling";
import { calcNetworkMonthlyFee } from "../networkLinkRules";

describe("countDeliveryUnits (decisão 6 + publicação)", () => {
  it("só-PDV não conta; rascunho não conta; matriz não conta", () => {
    const units = [
      { is_matriz: true, status: "ativo", plan_type: "fixed" },
      { is_matriz: false, status: "ativo", plan_type: "fixed" },
      { is_matriz: false, status: "ativo", plan_type: "fixed" },
      { is_matriz: false, status: "ativo", plan_type: "pdv_only" },
      { is_matriz: false, status: "analise", plan_type: "fixed" },
    ];
    expect(countDeliveryUnits(units)).toBe(2);
    expect(countPdvOnlyUnits(units)).toBe(1);
    expect(isPublishedUnit({ is_matriz: false, status: "analise" })).toBe(false);
    expect(isPublishedUnit({ is_matriz: true, status: "ativo" })).toBe(false);
  });

  it("Cantinho do Tempero: 5 de delivery + 0 só-PDV → base + 2 extras", () => {
    const units = Array.from({ length: 5 }, () => ({
      is_matriz: false,
      status: "ativo",
      plan_type: "fixed",
    }));
    expect(countDeliveryUnits(units)).toBe(5);
    expect(
      calcNetworkMonthlyFee({
        baseMonthlyFee: 89.9,
        deliveryUnitCount: countDeliveryUnits(units),
        gmv60d: 6000,
      }),
    ).toBeCloseTo(169.7, 2);
  });

  it("rede com ≤3 sublojas: só a base", () => {
    expect(
      calcNetworkMonthlyFee({ baseMonthlyFee: 89.9, deliveryUnitCount: 3, gmv60d: 6000 }),
    ).toBeCloseTo(89.9, 2);
    expect(
      calcNetworkMonthlyFee({ baseMonthlyFee: 89.9, deliveryUnitCount: 0, gmv60d: 6000 }),
    ).toBeCloseTo(89.9, 2);
  });

  it("gratuidade por GMV: ≤ R$ 5.000 → 0, mesmo com 5 sublojas", () => {
    expect(
      calcNetworkMonthlyFee({ baseMonthlyFee: 89.9, deliveryUnitCount: 5, gmv60d: 5000 }),
    ).toBe(0);
    expect(
      calcNetworkMonthlyFee({ baseMonthlyFee: 89.9, deliveryUnitCount: 5, gmv60d: 5000.01 }),
    ).toBeCloseTo(169.7, 2);
  });
});

describe("resolveUnitPlanMonthlyFee (plano da subloja pulado)", () => {
  const base = { inNetwork: true, networkBillingEnabled: true, monthlyFee: 89.9 };

  it("subloja de delivery com flag ligada: mensalidade zerada", () => {
    expect(resolveUnitPlanMonthlyFee({ ...base, planType: "fixed" })).toBe(0);
  });

  it("guia-matriz com flag ligada: mensalidade zerada (não tem plano próprio)", () => {
    expect(resolveUnitPlanMonthlyFee({ ...base, planType: "fixed" })).toBe(0);
  });

  it("subloja só-PDV com flag ligada: continua pagando os R$ 120", () => {
    expect(
      resolveUnitPlanMonthlyFee({ ...base, planType: "pdv_only", monthlyFee: 120 }),
    ).toBe(120);
  });

  it("flag desligada: cobrança de hoje, inalterada (inclusive subloja legada)", () => {
    expect(
      resolveUnitPlanMonthlyFee({
        inNetwork: true,
        networkBillingEnabled: false,
        planType: "fixed",
        monthlyFee: 89.9,
      }),
    ).toBe(89.9);
  });

  it("loja fora de rede: inalterada mesmo com flag (flag é por rede)", () => {
    expect(
      resolveUnitPlanMonthlyFee({
        inNetwork: false,
        networkBillingEnabled: true,
        planType: "fixed",
        monthlyFee: 89.9,
      }),
    ).toBe(89.9);
  });
});

describe("shouldSkipUnitPlanBill (pular fatura da subloja)", () => {
  const base = {
    inNetwork: true,
    networkBillingEnabled: true,
    planType: "fixed",
    monthlyFee: 89.9,
    pdvPending: 0,
    addonsTotal: 0,
    billingCreditCents: 0,
  };

  it("subloja zerada e sem mais nada: pula (sem transação, sem PIX)", () => {
    expect(shouldSkipUnitPlanBill(base)).toBe(true);
  });

  it("subloja com add-on PDV: NÃO pula — fatura só o add-on", () => {
    expect(shouldSkipUnitPlanBill({ ...base, addonsTotal: 49 })).toBe(false);
  });

  it("subloja com comissão PDV pendente: NÃO pula", () => {
    expect(shouldSkipUnitPlanBill({ ...base, pdvPending: 12.5 })).toBe(false);
  });

  it("só-PDV nunca é pulada por esta regra", () => {
    expect(
      shouldSkipUnitPlanBill({ ...base, planType: "pdv_only", monthlyFee: 120 }),
    ).toBe(false);
  });

  it("flag desligada: nunca pula", () => {
    expect(
      shouldSkipUnitPlanBill({ ...base, networkBillingEnabled: false }),
    ).toBe(false);
  });
});

describe("buildNetworkChargeDescription", () => {
  it("base + extras + referência, dentro do limite da Woovi", () => {
    const desc = buildNetworkChargeDescription({
      networkName: "Cantinho do Tempero",
      baseMonthlyFee: 89.9,
      extraFee: 79.8,
      referenceCode: "#REDE-AB12CD34",
    });
    expect(desc).toContain("Cantinho do Tempero");
    expect(desc).toContain("R$89.90");
    expect(desc).toContain("R$79.80");
    expect(desc).toContain("#REDE-AB12CD34");
    expect(desc.length).toBeLessThanOrEqual(140);
  });

  it("sem extras, não menciona extras", () => {
    const desc = buildNetworkChargeDescription({
      networkName: "Graal",
      baseMonthlyFee: 0,
      extraFee: 0,
      referenceCode: "#REDE-00000000",
    });
    expect(desc).not.toContain("extras");
  });
});
