import { describe, it, expect, beforeEach } from "vitest";
import {
  AFFILIATE_HOLD_DAYS,
  AFFILIATE_MIN_PAYOUT,
  AFFILIATE_PAYOUT_DAYS,
  AFFILIATE_RATE_PERCENT,
  REFERRAL_STORAGE_KEY,
  computeAffiliateCredit,
  creditReleaseDate,
  isPayoutDayValid,
  normalizeReferralCode,
  parseReferralFromSearch,
  storeReferralCode,
  getStoredReferralCode,
  clearStoredReferralCode,
} from "../affiliates";

describe("constantes do programa de afiliados", () => {
  it("taxas: Essencial 100% e Somente PDV 50%", () => {
    expect(AFFILIATE_RATE_PERCENT.essencial).toBe(100);
    expect(AFFILIATE_RATE_PERCENT.pdv).toBe(50);
  });

  it("hold de 30 dias, lote nos dias 5 e 20, mínimo de R$ 100", () => {
    expect(AFFILIATE_HOLD_DAYS).toBe(30);
    expect(AFFILIATE_PAYOUT_DAYS).toEqual([5, 20]);
    expect(AFFILIATE_MIN_PAYOUT).toBe(100);
  });
});

describe("computeAffiliateCredit", () => {
  it("Essencial: mensalidade de R$ 89,90 vira crédito de R$ 89,90", () => {
    expect(computeAffiliateCredit("essencial", 89.9)).toEqual({
      ratePercent: 100,
      creditAmount: 89.9,
    });
  });

  it("Somente PDV: mensalidade de R$ 120 vira crédito de R$ 60", () => {
    expect(computeAffiliateCredit("pdv", 120)).toEqual({
      ratePercent: 50,
      creditAmount: 60,
    });
  });

  it("a base é o valor pago, não o de tabela (PDV customizado de R$ 130)", () => {
    expect(computeAffiliateCredit("pdv", 130).creditAmount).toBe(65);
  });

  it("arredonda em centavos", () => {
    expect(computeAffiliateCredit("essencial", 89.999).creditAmount).toBe(90);
    expect(computeAffiliateCredit("pdv", 89.999).creditAmount).toBe(45);
  });

  it("valor zerado ou inválido não gera crédito", () => {
    expect(computeAffiliateCredit("essencial", 0).creditAmount).toBe(0);
    expect(computeAffiliateCredit("pdv", -10).creditAmount).toBe(0);
    expect(computeAffiliateCredit("pdv", Number.NaN).creditAmount).toBe(0);
  });
});

describe("creditReleaseDate", () => {
  it("libera exatamente 30 dias depois", () => {
    expect(creditReleaseDate("2026-11-10T15:30:00.000Z")).toBe(
      "2026-12-10T15:30:00.000Z",
    );
  });

  it("cruza a virada do mês e do ano", () => {
    expect(creditReleaseDate("2026-01-31T00:00:00.000Z")).toBe(
      "2026-03-02T00:00:00.000Z",
    );
    expect(creditReleaseDate("2026-12-25T12:00:00.000Z")).toBe(
      "2027-01-24T12:00:00.000Z",
    );
  });
});

describe("isPayoutDayValid", () => {
  it("aceita os dias de lote (5 e 20)", () => {
    expect(isPayoutDayValid(5)).toBe(true);
    expect(isPayoutDayValid(20)).toBe(true);
  });

  it("rejeita qualquer outro dia", () => {
    expect(isPayoutDayValid(1)).toBe(false);
    expect(isPayoutDayValid(10)).toBe(false);
    expect(isPayoutDayValid(0)).toBe(false);
    expect(isPayoutDayValid(31)).toBe(false);
    expect(isPayoutDayValid(5.5)).toBe(false);
  });
});

describe("normalizeReferralCode", () => {
  it("aplica trim e maiúsculas", () => {
    expect(normalizeReferralCode("  ab12 ")).toBe("AB12");
  });

  it("remove o que não é A-Z0-9 (a mesma normalização da RPC no banco)", () => {
    expect(normalizeReferralCode("ab-12_x!")).toBe("AB12X");
    expect(normalizeReferralCode("código")).toBe("CDIGO");
  });

  it("tolera null, undefined e vazio", () => {
    expect(normalizeReferralCode(null)).toBe("");
    expect(normalizeReferralCode(undefined)).toBe("");
    expect(normalizeReferralCode("")).toBe("");
    expect(normalizeReferralCode("   ")).toBe("");
  });
});

describe("parseReferralFromSearch", () => {
  it("extrai o ?ref com ou sem o '?' inicial", () => {
    expect(parseReferralFromSearch("?ref=abc123")).toBe("ABC123");
    expect(parseReferralFromSearch("ref=abc123")).toBe("ABC123");
  });

  it("convive com os outros parâmetros da URL (promo, city)", () => {
    expect(parseReferralFromSearch("?promo=LONDRINA10&ref=zz9&city=x")).toBe("ZZ9");
  });

  it("sem ref — ou ref sem nenhum caractere válido — retorna null", () => {
    expect(parseReferralFromSearch("?promo=X")).toBeNull();
    expect(parseReferralFromSearch("?ref=")).toBeNull();
    expect(parseReferralFromSearch("?ref=---")).toBeNull();
    expect(parseReferralFromSearch("")).toBeNull();
    expect(parseReferralFromSearch(null)).toBeNull();
    expect(parseReferralFromSearch(undefined)).toBeNull();
  });
});

describe("código de indicação guardado (localStorage)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("guarda normalizado, lê de volta e limpa", () => {
    storeReferralCode(" ab-1 ");
    expect(localStorage.getItem(REFERRAL_STORAGE_KEY)).toBe("AB1");
    expect(getStoredReferralCode()).toBe("AB1");
    clearStoredReferralCode();
    expect(getStoredReferralCode()).toBeNull();
    expect(localStorage.getItem(REFERRAL_STORAGE_KEY)).toBeNull();
  });

  it("código sem caracteres válidos não guarda nada", () => {
    storeReferralCode("---");
    expect(getStoredReferralCode()).toBeNull();
  });

  it("sem nada guardado, a leitura é null", () => {
    expect(getStoredReferralCode()).toBeNull();
  });
});
