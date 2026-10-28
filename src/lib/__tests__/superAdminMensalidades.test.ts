import { describe, it, expect } from "vitest";
import {
  MENSALIDADES_PLAN_TYPES,
  buildMensalidadeRow,
  sortMensalidadeRows,
  computeMensalidadesStats,
  upcomingCharges,
  formatShortDate,
  type MensalidadeRow,
  type MensalidadePlanInput,
  type MensalidadeStoreInput,
} from "../superAdminMensalidades";

// Fase 6 — Mensalidades redesenhado. Decisão do Renner (28/10 ~06:58):
// inclui os planos Somente PDV — MRR vira R$ 1.071,50 (igual ao Consolidado).
// "Hoje" fixo para os cálculos de atraso/meses serem determinísticos.
const NOW = new Date("2026-10-28T12:00:00.000Z");

function plan(over: Partial<MensalidadePlanInput>): MensalidadePlanInput {
  return {
    store_id: "s1",
    plan_type: "fixed",
    monthly_fee: 89.9,
    next_billing_date: "2026-11-04T12:00:00.000Z",
    last_billed_at: null,
    trial_ends_at: null,
    started_at: "2026-09-28T12:00:00.000Z",
    is_active: true,
    ...over,
  };
}

function store(over: Partial<MensalidadeStoreInput> = {}): MensalidadeStoreInput {
  return { id: "s1", name: "Ric Burguer", is_test: false, status: "ativo", ...over };
}

function row(over: Partial<MensalidadeRow>): MensalidadeRow {
  return {
    store_id: "s1",
    name: "Loja",
    store_status: "ativo",
    plan_type: "fixed",
    monthly: 89.9,
    status: "em_dia",
    daysLate: 0,
    nextBilling: "2026-11-04T12:00:00.000Z",
    lastBilled: null,
    trialEnds: null,
    monthsActive: 1,
    ltv: 89.9,
    ...over,
  };
}

describe("MENSALIDADES_PLAN_TYPES", () => {
  it("inclui pdv_only (decisão da Fase 6) e não inclui commission_only", () => {
    expect(MENSALIDADES_PLAN_TYPES).toContain("pdv_only");
    expect(MENSALIDADES_PLAN_TYPES).toContain("fixed");
    expect(MENSALIDADES_PLAN_TYPES).toContain("supporter");
    expect(MENSALIDADES_PLAN_TYPES).toContain("autonomy");
    expect(MENSALIDADES_PLAN_TYPES).not.toContain("commission_only");
  });
});

describe("formatShortDate", () => {
  it("extrai DD/MM da parte de calendário, sem fuso", () => {
    expect(formatShortDate("2026-11-04T14:41:11.878+00")).toBe("04/11");
    expect(formatShortDate("2026-11-20 12:00:00+00")).toBe("20/11");
    expect(formatShortDate("2027-01-21T00:00:00.000Z")).toBe("21/01");
  });
  it("devolve vazio sem vencimento", () => {
    expect(formatShortDate(null)).toBe("");
    expect(formatShortDate(undefined)).toBe("");
    expect(formatShortDate("")).toBe("");
  });
});

describe("buildMensalidadeRow", () => {
  it("plano fixed em dia, com LTV = mensalidade x meses", () => {
    const r = buildMensalidadeRow(plan({}), store(), NOW);
    expect(r).not.toBeNull();
    expect(r!.status).toBe("em_dia");
    expect(r!.daysLate).toBe(0);
    expect(r!.monthsActive).toBe(1);
    expect(r!.ltv).toBeCloseTo(89.9, 2);
    expect(r!.trialEnds).toBeNull();
  });

  it("plano pdv_only entra (Silvia: R$ 130, venc 20/11, 4 meses, LTV 520)", () => {
    const r = buildMensalidadeRow(
      plan({
        store_id: "silvia",
        plan_type: "pdv_only",
        monthly_fee: 130,
        next_billing_date: "2026-11-20T12:00:00.000Z",
        started_at: "2026-06-21T18:04:07.792987+00:00",
      }),
      store({ id: "silvia", name: "Restaurante Cantinho da Silvia" }),
      NOW,
    );
    expect(r).not.toBeNull();
    expect(r!.plan_type).toBe("pdv_only");
    expect(r!.status).toBe("em_dia");
    expect(r!.monthsActive).toBe(4);
    expect(r!.ltv).toBeCloseTo(520, 2);
  });

  it("trial ativo vira status trial e guarda o fim do trial", () => {
    const r = buildMensalidadeRow(
      plan({ trial_ends_at: "2027-01-21T00:00:00.000Z" }),
      store(),
      NOW,
    );
    expect(r!.status).toBe("trial");
    expect(r!.trialEnds).toBe("2027-01-21T00:00:00.000Z");
  });

  it("vencimento passado com mensalidade > 0 vira atrasado com dias", () => {
    const r = buildMensalidadeRow(
      plan({ monthly_fee: 69, next_billing_date: "2026-10-20T12:00:00.000Z" }),
      store(),
      NOW,
    );
    expect(r!.status).toBe("atrasado");
    expect(r!.daysLate).toBe(8);
  });

  it("mensalidade R$ 0 com vencimento passado continua em dia, mas com atraso p/ ordenar", () => {
    const r = buildMensalidadeRow(
      plan({ monthly_fee: 0, next_billing_date: "2026-09-18T00:00:00.000Z" }),
      store(),
      NOW,
    );
    expect(r!.status).toBe("em_dia");
    expect(r!.daysLate).toBe(40);
  });

  it("plano inativo vira inativo e loja de teste é descartada", () => {
    expect(
      buildMensalidadeRow(plan({ is_active: false }), store(), NOW)!.status,
    ).toBe("inativo");
    expect(
      buildMensalidadeRow(plan({}), store({ is_test: true }), NOW),
    ).toBeNull();
  });

  it("sem vencimento não tem atraso", () => {
    const r = buildMensalidadeRow(plan({ next_billing_date: null }), store(), NOW);
    expect(r!.daysLate).toBe(0);
    expect(r!.status).toBe("em_dia");
  });
});

describe("sortMensalidadeRows", () => {
  it("maior atraso primeiro, depois maior mensalidade; não muta a entrada", () => {
    const input = [
      row({ store_id: "a", name: "A", monthly: 89.9, daysLate: 0 }),
      row({ store_id: "b", name: "B", monthly: 0, daysLate: 40 }),
      row({ store_id: "c", name: "C", monthly: 130, daysLate: 0 }),
      row({ store_id: "d", name: "D", monthly: 69, daysLate: 8 }),
    ];
    const sorted = sortMensalidadeRows(input);
    expect(sorted.map((r) => r.store_id)).toEqual(["b", "d", "c", "a"]);
    expect(input.map((r) => r.store_id)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("computeMensalidadesStats", () => {
  it("MRR soma fixed + pdv_only: 665,50 + 406,00 = 1.071,50", () => {
    const fixed = [89.9, 89.9, 89.9, 89.9, 89.9, 69, 69, 69, 9].map((m, i) =>
      row({ store_id: `f${i}`, monthly: m, ltv: m, monthsActive: 1 }),
    );
    const pdv = [130, 69, 69, 69, 69].map((m, i) =>
      row({ store_id: `p${i}`, plan_type: "pdv_only", monthly: m, ltv: m, monthsActive: 1 }),
    );
    const stats = computeMensalidadesStats([...fixed, ...pdv]);
    expect(stats.mrr).toBeCloseTo(1071.5, 2);
    expect(stats.ativos).toBe(14);
    expect(stats.paying).toBe(14);
    expect(stats.inadCount).toBe(0);
    expect(stats.inadAmt).toBe(0);
  });

  it("inadimplência soma só os atrasados e ignora inativos no MRR", () => {
    const stats = computeMensalidadesStats([
      row({ store_id: "a", monthly: 89.9, status: "em_dia", monthsActive: 4, ltv: 359.6 }),
      row({ store_id: "b", monthly: 69, status: "atrasado", monthsActive: 2, ltv: 138 }),
      row({ store_id: "c", monthly: 69, status: "inativo", monthsActive: 3, ltv: 207 }),
    ]);
    expect(stats.mrr).toBeCloseTo(158.9, 2);
    expect(stats.inadAmt).toBeCloseTo(69, 2);
    expect(stats.inadCount).toBe(1);
    expect(stats.inadPct).toBeCloseTo(50, 2);
    expect(stats.avgMonths).toBeCloseTo(3, 2);
    expect(stats.avgLtv).toBeCloseTo(248.8, 2);
  });
});

describe("upcomingCharges", () => {
  // 28/10 + 7 dias = 04/11. As cobranças de 04/11 são às 14:41 — a janela
  // é por data de calendário, senão elas cairiam fora por ~3h.
  const base = [
    row({ store_id: "ric", name: "Ric Burguer", monthly: 89.9, nextBilling: "2026-11-04T12:00:00.000Z" }),
    row({ store_id: "lag", name: "Pizzaria Lagoinha", monthly: 89.9, nextBilling: "2026-11-04T12:00:00.000Z" }),
    row({ store_id: "mar", name: "Maristela", monthly: 89.9, nextBilling: "2026-11-04T12:00:00.000Z" }),
    row({ store_id: "d1", name: "Duda lanches Teste", monthly: 89.9, nextBilling: "2026-11-04T12:00:00.000Z" }),
    row({ store_id: "d2", name: "Duda lanches", monthly: 89.9, nextBilling: "2026-11-04T12:00:00.000Z" }),
    row({ store_id: "e2e", name: "E2E Boutique", monthly: 69, nextBilling: "2026-11-04T12:00:00.000Z" }),
    row({ store_id: "doc", name: "Doceria Da Cleide", monthly: 0, nextBilling: "2026-11-03T12:00:00.000Z" }),
    row({ store_id: "tri", name: "Loja Demonstração", monthly: 69, status: "trial", nextBilling: "2026-11-02T12:00:00.000Z" }),
    row({ store_id: "rou", name: "E2E Roupas Teste", monthly: 69, nextBilling: "2026-11-09T12:00:00.000Z" }),
    row({ store_id: "sil", name: "Restaurante Cantinho da Silvia", monthly: 130, nextBilling: "2026-11-20T12:00:00.000Z" }),
  ];

  it("6 cobranças em 04/11 somam R$ 518,50 (sem PDV, como o protótipo)", () => {
    const u = upcomingCharges(base.slice(0, 8), NOW);
    expect(u.count).toBe(6);
    expect(u.total).toBeCloseTo(518.5, 2);
    expect(u.dateLabel).toBe("04/11");
    expect(u.names).toEqual([
      "Ric Burguer",
      "Pizzaria Lagoinha",
      "Maristela",
      "Duda lanches Teste",
      "Duda lanches",
      "E2E Boutique",
    ]);
  });

  it("com os 3 PDV de 04/11 vira 9 cobranças e R$ 725,50", () => {
    const pdv = [
      row({ store_id: "sp", name: "Sandbox PDV", plan_type: "pdv_only", monthly: 69, nextBilling: "2026-11-04T14:41:11.878+00" }),
      row({ store_id: "tp", name: "Teste PDV Restaurante", plan_type: "pdv_only", monthly: 69, nextBilling: "2026-11-04T14:41:25.883+00" }),
      row({ store_id: "rp", name: "RennerPdv", plan_type: "pdv_only", monthly: 69, nextBilling: "2026-11-04T14:41:13.591+00" }),
    ];
    const u = upcomingCharges([...base.slice(0, 8), ...pdv], NOW);
    expect(u.count).toBe(9);
    expect(u.total).toBeCloseTo(725.5, 2);
    expect(u.dateLabel).toBe("04/11");
  });

  it("fora da janela, trial, inativo e R$ 0 não contam", () => {
    const u = upcomingCharges(
      [
        row({ store_id: "a", name: "A", monthly: 69, nextBilling: "2026-11-09T12:00:00.000Z" }),
        row({ store_id: "b", name: "B", monthly: 69, status: "trial", nextBilling: "2026-11-02T12:00:00.000Z" }),
        row({ store_id: "c", name: "C", monthly: 69, status: "inativo", nextBilling: "2026-11-02T12:00:00.000Z" }),
        row({ store_id: "d", name: "D", monthly: 0, nextBilling: "2026-11-03T12:00:00.000Z" }),
        row({ store_id: "e", name: "E", monthly: 69, nextBilling: null }),
      ],
      NOW,
    );
    expect(u.count).toBe(0);
    expect(u.total).toBe(0);
    expect(u.dateLabel).toBeNull();
  });

  it("datas espalhadas viram intervalo", () => {
    const u = upcomingCharges(
      [
        row({ store_id: "a", name: "A", monthly: 10, nextBilling: "2026-10-30T12:00:00.000Z" }),
        row({ store_id: "b", name: "B", monthly: 10, nextBilling: "2026-11-04T12:00:00.000Z" }),
      ],
      NOW,
    );
    expect(u.dateLabel).toBe("30/10 a 04/11");
  });
});
