/**
 * Testes da identificação VIP por divergência de valor (Fase 4b).
 * Regra do Renner (28/10/2026): VIP = valor salvo DIFERENTE do template
 * / padrão — nunca mera não-nulidade. Override igual ao default NÃO é VIP.
 */
import { describe, it, expect } from "vitest";
import {
  detectVipDivergence,
  defaultPdvFixedFee,
  classifyVipKind,
  vipKindLabel,
  resolveVipReason,
  resolveNetworkBaseFee,
  isNetworkVip,
  VIP_NO_REASON,
} from "../vipDetection";

const TEMPLATE_FIXED = { monthly_fee: 89.9, commission_rate: 0 };

describe("detectVipDivergence (loja)", () => {
  it("valores iguais ao template: NÃO é VIP", () => {
    expect(
      detectVipDivergence(
        { monthly_fee: 89.9, commission_rate: 0, pdv_fixed_fee_per_sale: 1 },
        TEMPLATE_FIXED,
        1,
      ).isVip,
    ).toBe(false);
  });

  it("override PIX igual ao padrão (1,99) NÃO é VIP — limpa falso-VIP", () => {
    const r = detectVipDivergence(
      {
        monthly_fee: 89.9, commission_rate: 0,
        pix_operational_fee_override: 1.99, pdv_fixed_fee_per_sale: 1,
      },
      TEMPLATE_FIXED,
      1,
    );
    expect(r.isVip).toBe(false);
    expect(r.divergedFields).not.toContain("pix_operational_fee_override");
  });

  it("override de entrega igual ao padrão (2,00) NÃO é VIP", () => {
    expect(
      detectVipDivergence(
        {
          monthly_fee: 89.9, commission_rate: 0,
          platform_delivery_split_override: 2.0, pdv_fixed_fee_per_sale: 1,
        },
        TEMPLATE_FIXED,
        1,
      ).isVip,
    ).toBe(false);
  });

  it("mensalidade divergente É VIP e lista o campo", () => {
    const r = detectVipDivergence(
      { monthly_fee: 9, commission_rate: 0, pdv_fixed_fee_per_sale: 1 },
      TEMPLATE_FIXED,
      1,
    );
    expect(r.isVip).toBe(true);
    expect(r.divergedFields).toContain("monthly_fee");
  });

  it("override PIX divergente (ex.: 0 = isento) É VIP", () => {
    const r = detectVipDivergence(
      {
        monthly_fee: 89.9, commission_rate: 0,
        pix_operational_fee_override: 0, pdv_fixed_fee_per_sale: 1,
      },
      TEMPLATE_FIXED,
      1,
    );
    expect(r.isVip).toBe(true);
    expect(r.divergedFields).toContain("pix_operational_fee_override");
  });

  it("PDV fixo divergente do padrão do plano É VIP; igual, não", () => {
    expect(
      detectVipDivergence(
        { monthly_fee: 89.9, commission_rate: 0, pdv_fixed_fee_per_sale: 0 },
        TEMPLATE_FIXED,
        1,
      ).isVip,
    ).toBe(true);
    expect(
      detectVipDivergence(
        { monthly_fee: 89.9, commission_rate: 0, pdv_fixed_fee_per_sale: 1 },
        TEMPLATE_FIXED,
        1,
      ).isVip,
    ).toBe(false);
  });

  it("string do banco ('89.90') não conta como divergência de 89.9", () => {
    expect(
      detectVipDivergence(
        { monthly_fee: "89.90" as any, commission_rate: 0, pdv_fixed_fee_per_sale: 1 },
        TEMPLATE_FIXED,
        1,
      ).isVip,
    ).toBe(false);
  });
});

describe("defaultPdvFixedFee", () => {
  it("fixed/autonomy = 1; demais = 0", () => {
    expect(defaultPdvFixedFee("fixed")).toBe(1);
    expect(defaultPdvFixedFee("autonomy")).toBe(1);
    expect(defaultPdvFixedFee("hybrid")).toBe(0);
    expect(defaultPdvFixedFee("commission_only")).toBe(0);
  });
});

describe("classifyVipKind / vipKindLabel", () => {
  it("divergência → concedido; gratuidade sistêmica vence a divergência", () => {
    expect(classifyVipKind({ diverges: true, isSystemicFree: false })).toBe("granted");
    expect(classifyVipKind({ diverges: true, isSystemicFree: true })).toBe("systemic");
    expect(classifyVipKind({ diverges: false, isSystemicFree: false })).toBe("none");
    expect(vipKindLabel("granted")).toBe("VIP concedido");
    expect(vipKindLabel("systemic")).toBe("VIP sistêmico");
    expect(vipKindLabel("none")).toBeNull();
  });
});

describe("resolveVipReason", () => {
  it("vazio/nulo → 'sem motivo informado'; texto passa limpo", () => {
    expect(resolveVipReason("")).toBe(VIP_NO_REASON);
    expect(resolveVipReason("   ")).toBe(VIP_NO_REASON);
    expect(resolveVipReason(null)).toBe(VIP_NO_REASON);
    expect(resolveVipReason("  negociação 28/10 ")).toBe("negociação 28/10");
  });
});

describe("rede: precedência e selo VIP (P2)", () => {
  it("override vence template: guardado 90 + override 90 → base 90 (não 89,90)", () => {
    expect(
      resolveNetworkBaseFee({ storedFee: 90, templateFee: 89.9, overrideFee: 90 }),
    ).toBe(90);
  });

  it("sem override → template 89,90 (não o guardado 90)", () => {
    expect(
      resolveNetworkBaseFee({ storedFee: 90, templateFee: 89.9, overrideFee: null }),
    ).toBe(89.9);
  });

  it("sem template → guardado; sem nada → 0", () => {
    expect(
      resolveNetworkBaseFee({ storedFee: 90, templateFee: null, overrideFee: null }),
    ).toBe(90);
    expect(
      resolveNetworkBaseFee({ storedFee: null, templateFee: null, overrideFee: null }),
    ).toBe(0);
  });

  it("override igual ao template NÃO é VIP; divergente É VIP", () => {
    expect(
      isNetworkVip({ storedFee: 90, templateFee: 89.9, overrideFee: 89.9 }),
    ).toBe(false);
    expect(
      isNetworkVip({ storedFee: 90, templateFee: 89.9, overrideFee: 90 }),
    ).toBe(true);
    expect(
      isNetworkVip({ storedFee: 90, templateFee: 89.9, overrideFee: null }),
    ).toBe(false);
  });

  it("sem template, override diverge do guardado → VIP", () => {
    expect(
      isNetworkVip({ storedFee: 90, templateFee: null, overrideFee: 75 }),
    ).toBe(true);
    expect(
      isNetworkVip({ storedFee: 90, templateFee: null, overrideFee: 90 }),
    ).toBe(false);
  });
});
