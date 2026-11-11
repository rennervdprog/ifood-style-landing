import { describe, it, expect } from "vitest";
import {
  computeToCompensate,
  isCompensableCredit,
  summarizeAffiliateForAdmin,
  type AdminAffiliateCreditLike,
  type AdminAffiliatePayoutLike,
} from "@/lib/superAdminAfiliados";

const credit = (
  partial: Partial<AdminAffiliateCreditLike>,
): AdminAffiliateCreditLike => ({
  credit_amount: 0,
  status: "pending",
  compensated_payout_id: null,
  invoice_status: "paid",
  ...partial,
});

const payout = (
  partial: Partial<AdminAffiliatePayoutLike>,
): AdminAffiliatePayoutLike => ({
  amount: 0,
  status: "paid",
  ...partial,
});

const APPROVED_DAY20 = { status: "approved", payout_day: 20 };
const FROM = new Date(2026, 10, 11); // 11/11/2026 (local)

// Cenário do preview da Fase 3 ("caso Marina"): liberado 244,80,
// a compensar 89,90 → líquido 154,90 no lote do dia 20.
const marinaCredits: AdminAffiliateCreditLike[] = [
  credit({ credit_amount: 89.9, status: "available" }),
  credit({ credit_amount: 154.9, status: "available" }),
  credit({ credit_amount: 65, status: "pending" }),
  credit({
    credit_amount: 89.9,
    status: "paid",
    invoice_status: "cancelled", // fatura estornada depois do pagamento
  }),
  credit({
    credit_amount: 89.9,
    status: "paid",
    invoice_status: "paid", // pago saudável: não compensa
  }),
];
const marinaPayouts: AdminAffiliatePayoutLike[] = [
  payout({ amount: 179.8, status: "paid" }),
];

describe("isCompensableCredit / computeToCompensate (clawback)", () => {
  it("conta crédito paid com fatura cancelada e ainda não compensado", () => {
    expect(
      isCompensableCredit(
        credit({ status: "paid", invoice_status: "cancelled" }),
      ),
    ).toBe(true);
    expect(
      isCompensableCredit(
        credit({ status: "paid", invoice_status: "failed" }),
      ),
    ).toBe(true);
  });

  it("não conta quem já foi compensado, nem fatura viva, nem sem join", () => {
    expect(
      isCompensableCredit(
        credit({
          status: "paid",
          invoice_status: "cancelled",
          compensated_payout_id: "payout-1",
        }),
      ),
    ).toBe(false);
    expect(
      isCompensableCredit(
        credit({ status: "paid", invoice_status: "paid" }),
      ),
    ).toBe(false);
    expect(
      isCompensableCredit(
        credit({ status: "paid", invoice_status: null }),
      ),
    ).toBe(false);
    expect(
      isCompensableCredit(
        credit({ status: "available", invoice_status: "cancelled" }),
      ),
    ).toBe(false);
  });

  it("soma só os compensáveis, em centavos exatos", () => {
    expect(computeToCompensate(marinaCredits)).toBe(89.9);
    expect(computeToCompensate([])).toBe(0);
  });
});

describe("summarizeAffiliateForAdmin", () => {
  it("caso Marina: líquido = liberado − a compensar, pode pagar", () => {
    const s = summarizeAffiliateForAdmin(
      APPROVED_DAY20,
      marinaCredits,
      marinaPayouts,
      FROM,
    );
    expect(s.available).toBe(244.8);
    expect(s.pending).toBe(65);
    expect(s.toCompensate).toBe(89.9);
    expect(s.net).toBe(154.9);
    expect(s.receivedTotal).toBe(179.8);
    expect(s.canPay).toBe(true);
    expect(s.missingForMin).toBe(0);
    expect(s.neverReceived).toBe(false);
    expect(s.nextBatchDate).toEqual(new Date(2026, 10, 20));
  });

  it("abaixo do mínimo: botão trava e mostra quanto falta", () => {
    const s = summarizeAffiliateForAdmin(
      { status: "approved", payout_day: 5 },
      [credit({ credit_amount: 65, status: "available" })],
      [],
      FROM,
    );
    expect(s.net).toBe(65);
    expect(s.canPay).toBe(false);
    expect(s.missingForMin).toBe(35);
    expect(s.neverReceived).toBe(true);
    // Dia 5 já passou em 11/11 → lote vigente é 05/12.
    expect(s.nextBatchDate).toEqual(new Date(2026, 11, 5));
  });

  it("compensação maior que o liberado: líquido negativo não paga", () => {
    const s = summarizeAffiliateForAdmin(
      APPROVED_DAY20,
      [
        credit({ credit_amount: 50, status: "available" }),
        credit({
          credit_amount: 89.9,
          status: "paid",
          invoice_status: "failed",
        }),
      ],
      marinaPayouts,
      FROM,
    );
    expect(s.net).toBe(-39.9);
    expect(s.canPay).toBe(false);
    expect(s.missingForMin).toBe(139.9);
  });

  it("suspenso não recebe mesmo com líquido acima do mínimo", () => {
    const s = summarizeAffiliateForAdmin(
      { status: "suspended", payout_day: 20 },
      marinaCredits,
      marinaPayouts,
      FROM,
    );
    expect(s.net).toBe(154.9);
    expect(s.canPay).toBe(false);
  });

  it("sem créditos: tudo zero e nunca recebeu", () => {
    const s = summarizeAffiliateForAdmin(APPROVED_DAY20, [], [], FROM);
    expect(s.available).toBe(0);
    expect(s.toCompensate).toBe(0);
    expect(s.net).toBe(0);
    expect(s.canPay).toBe(false);
    expect(s.neverReceived).toBe(true);
  });

  it("valores string do Postgres são normalizados", () => {
    const s = summarizeAffiliateForAdmin(
      APPROVED_DAY20,
      [credit({ credit_amount: "120.50", status: "available" })],
      [payout({ amount: "120.50", status: "paid" })],
      FROM,
    );
    expect(s.available).toBe(120.5);
    expect(s.receivedTotal).toBe(120.5);
    expect(s.canPay).toBe(true);
  });
});
