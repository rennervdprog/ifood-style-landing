import { describe, it, expect } from "vitest";
import {
  summarizeCredits,
  receivedTotal,
  nextPayoutDate,
  payoutProgress,
  buildReferralLink,
  formatBRL,
  type AffiliateCreditLike,
  type AffiliatePayoutLike,
} from "@/lib/affiliatePanel";

const credit = (
  partial: Partial<AffiliateCreditLike>,
): AffiliateCreditLike => ({
  credit_amount: 0,
  status: "pending",
  release_at: "2026-12-01T00:00:00.000Z",
  payout_id: null,
  ...partial,
});

const payout = (
  partial: Partial<AffiliatePayoutLike>,
): AffiliatePayoutLike => ({
  amount: 0,
  status: "scheduled",
  ...partial,
});

describe("summarizeCredits", () => {
  it("sem créditos: tudo zero e nenhuma liberação", () => {
    expect(summarizeCredits([])).toEqual({
      available: 0,
      pending: 0,
      nextReleaseAt: null,
      paidCreditsTotal: 0,
    });
  });

  it("só pendentes: soma e pega a liberação mais próxima", () => {
    const summary = summarizeCredits([
      credit({
        credit_amount: "65.00",
        release_at: "2026-11-18T12:00:00.000Z",
      }),
      credit({
        credit_amount: 89.9,
        release_at: "2026-11-27T12:00:00.000Z",
      }),
    ]);
    expect(summary.pending).toBe(154.9);
    expect(summary.available).toBe(0);
    expect(summary.nextReleaseAt).toBe("2026-11-18T12:00:00.000Z");
  });

  it("mistura estados: cancelled não entra em nenhum saldo", () => {
    const summary = summarizeCredits([
      credit({ credit_amount: 89.9, status: "paid", payout_id: "p1" }),
      credit({ credit_amount: 89.9, status: "available" }),
      credit({ credit_amount: 65, status: "pending" }),
      credit({ credit_amount: 500, status: "cancelled" }),
    ]);
    expect(summary.available).toBe(89.9);
    expect(summary.pending).toBe(65);
    expect(summary.paidCreditsTotal).toBe(89.9);
  });
});

describe("receivedTotal", () => {
  it("soma só lotes pagos; agendado/falho não conta", () => {
    const total = receivedTotal(
      [],
      [
        payout({ amount: "89.90", status: "paid" }),
        payout({ amount: 200, status: "scheduled" }),
        payout({ amount: 50, status: "failed" }),
      ],
    );
    expect(total).toBe(89.9);
  });

  it("crédito pago sem lote conta; com lote não duplica", () => {
    const total = receivedTotal(
      [
        credit({ credit_amount: 89.9, status: "paid", payout_id: "p1" }),
        credit({ credit_amount: 30, status: "paid", payout_id: null }),
      ],
      [payout({ amount: 89.9, status: "paid" })],
    );
    expect(total).toBe(119.9);
  });
});

describe("nextPayoutDate", () => {
  const at = (iso: string) => new Date(`${iso}T12:00:00`);
  const ymd = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;

  it("antes do dia no mês: cai neste mês", () => {
    expect(ymd(nextPayoutDate(5, at("2026-11-03")))).toBe("2026-11-05");
    expect(ymd(nextPayoutDate(20, at("2026-11-11")))).toBe("2026-11-20");
  });

  it("no próprio dia: o lote é hoje", () => {
    expect(ymd(nextPayoutDate(5, at("2026-11-05")))).toBe("2026-11-05");
    expect(ymd(nextPayoutDate(20, at("2026-11-20")))).toBe("2026-11-20");
  });

  it("depois do dia: vira para o mês seguinte", () => {
    expect(ymd(nextPayoutDate(5, at("2026-11-06")))).toBe("2026-12-05");
    expect(ymd(nextPayoutDate(20, at("2026-11-21")))).toBe("2026-12-20");
  });

  it("virada de ano: dezembro → janeiro do ano seguinte", () => {
    expect(ymd(nextPayoutDate(20, at("2026-12-21")))).toBe("2027-01-20");
    expect(ymd(nextPayoutDate(5, at("2026-12-31")))).toBe("2027-01-05");
  });
});

describe("payoutProgress", () => {
  it("zero liberado: falta tudo", () => {
    expect(payoutProgress(0)).toEqual({
      min: 100,
      reached: false,
      missing: 100,
      percent: 0,
    });
  });

  it("abaixo do mínimo: mostra quanto falta e o percentual", () => {
    const p = payoutProgress(89.9);
    expect(p.reached).toBe(false);
    expect(p.missing).toBe(10.1);
    expect(p.percent).toBe(89.9);
  });

  it("no mínimo exato: atingiu", () => {
    const p = payoutProgress(100);
    expect(p.reached).toBe(true);
    expect(p.missing).toBe(0);
    expect(p.percent).toBe(100);
  });

  it("acima do mínimo: percentual trava em 100", () => {
    const p = payoutProgress(250);
    expect(p.reached).toBe(true);
    expect(p.percent).toBe(100);
  });
});

describe("buildReferralLink", () => {
  it("monta a URL do cadastro com o código", () => {
    expect(buildReferralLink("https://itasuper.com.br", "MARINA")).toBe(
      "https://itasuper.com.br/cadastro-lojista?ref=MARINA",
    );
  });

  it("tolera barra no fim da origem", () => {
    expect(buildReferralLink("https://itasuper.com.br/", "MARINA")).toBe(
      "https://itasuper.com.br/cadastro-lojista?ref=MARINA",
    );
  });
});

describe("formatBRL", () => {
  it("formata reais em pt-BR", () => {
    // O Intl usa espaço não-quebrável depois do "R$" — normalize p/ comparar.
    const plain = (s: string) => s.replace(/ /g, " ");
    expect(plain(formatBRL(89.9))).toBe("R$ 89,90");
    expect(plain(formatBRL(130))).toBe("R$ 130,00");
  });
});
