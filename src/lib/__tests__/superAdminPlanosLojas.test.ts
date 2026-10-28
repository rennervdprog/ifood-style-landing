import { describe, it, expect } from "vitest";
import {
  PDV_ONLY_FEE,
  resolveDisplayPlanTeste,
  computePlanosStats,
  computeDistributionExtras,
  buildStorePlanRow,
  sortStorePlanRows,
  groupStorePlanRows,
  formatShortDate,
  daysSince,
  formatBRL,
  type StorePlanInput,
  type StoreInput,
} from "../superAdminPlanosLojas";

// Fase 7 — Planos das lojas redesenhado. Decisão do Renner (28/10 ~07:33):
// inclui o Somente PDV como plano de primeira classe (cartão, selo, botão).
// "Hoje" fixo para os cálculos de dias serem determinísticos.
const NOW = new Date("2026-10-28T12:00:00.000Z");

function plan(over: Partial<StorePlanInput> & { store_id: string }): StorePlanInput {
  return {
    plan_type: "fixed",
    monthly_fee: 89.9,
    commission_rate: 0,
    next_billing_date: "2026-11-04T12:00:00.000Z",
    trial_ends_at: null,
    started_at: "2026-09-28T00:00:00.000Z",
    is_active: true,
    essencial_lifetime_free: false,
    ...over,
  };
}

function store(over: Partial<StoreInput> & { id: string }): StoreInput {
  return { name: "Loja", status: "ativo", is_test: false, ...over };
}

describe("PDV_ONLY_FEE", () => {
  it("é R$ 120/mês (template Somente PDV)", () => {
    expect(PDV_ONLY_FEE).toBe(120);
  });
});

describe("resolveDisplayPlanTeste", () => {
  it("pdv_only passa direto com nome (o original deixava o selo sem nome)", () => {
    expect(resolveDisplayPlanTeste({ plan_type: "pdv_only", monthly_fee: 130 })).toBe("pdv_only");
    expect(resolveDisplayPlanTeste({ plan_type: "pdv_only", monthly_fee: 69 })).toBe("pdv_only");
  });

  it("fixed com fee 130 continua supporter (retrocompat) e pdv_only 130 não vira supporter", () => {
    expect(resolveDisplayPlanTeste({ plan_type: "fixed", monthly_fee: 130 })).toBe("supporter");
    expect(resolveDisplayPlanTeste({ plan_type: "pdv_only", monthly_fee: 130 })).toBe("pdv_only");
  });

  it("sem plano retorna null; commission_only e fixed passam direto", () => {
    expect(resolveDisplayPlanTeste(null)).toBeNull();
    expect(resolveDisplayPlanTeste(undefined)).toBeNull();
    expect(resolveDisplayPlanTeste({ plan_type: "commission_only", monthly_fee: 0 })).toBe("commission_only");
    expect(resolveDisplayPlanTeste({ plan_type: "fixed", monthly_fee: 89.9 })).toBe("fixed");
  });
});

describe("computePlanosStats", () => {
  it("soma fixed + pdv_only e separa a receita sem teste (R$ 1.085,49 / R$ 1.071,50)", () => {
    const stores = [
      store({ id: "silvia", name: "Restaurante Cantinho da Silvia" }),
      store({ id: "ric", name: "Ric Burguer" }),
      store({ id: "e2e6", name: "Loja Teste E2E 6", is_test: true }),
      store({ id: "sandbox", name: "Sandbox Billing", is_test: true }),
      store({ id: "sem", name: "Teste Boutique Boutique" }),
    ];
    const plans = [
      plan({ store_id: "silvia", plan_type: "pdv_only", monthly_fee: 130 }),
      plan({ store_id: "ric", plan_type: "fixed", monthly_fee: 89.9 }),
      plan({ store_id: "e2e6", plan_type: "fixed", monthly_fee: 10 }),
      plan({ store_id: "sandbox", plan_type: "fixed", monthly_fee: 3.99 }),
    ];
    const stats = computePlanosStats(stores, plans);
    // 130 + 89,90 + 10 + 3,99 = 233,89 (com teste); sem teste: 219,90.
    expect(stats.totalRevenue).toBeCloseTo(233.89, 2);
    expect(stats.revenueExcludingTest).toBeCloseTo(219.9, 2);
    expect(stats.distribution.pdv_only).toBe(1);
    expect(stats.distribution.fixed).toBe(3);
    expect(stats.distribution.no_plan).toBe(1);
    expect(stats.withPlan).toBe(4);
    expect(stats.withoutPlan).toBe(1);
    expect(stats.paying).toBe(4);
  });

  it("conta supporter por fee 75/130 de fixed e calcula as vagas", () => {
    const stores = [store({ id: "a", name: "A" }), store({ id: "b", name: "B" })];
    const plans = [
      plan({ store_id: "a", plan_type: "fixed", monthly_fee: 75 }),
      plan({ store_id: "b", plan_type: "fixed", monthly_fee: 130 }),
    ];
    const stats = computePlanosStats(stores, plans);
    expect(stats.distribution.supporter).toBe(2);
    expect(stats.supporterUsed).toBe(2);
    expect(stats.supporterAvailable).toBe(8);
  });
});

describe("buildStorePlanRow + sort + group", () => {
  const pending = new Set(["e2e2"]);
  const rows = [
    buildStorePlanRow(store({ id: "silvia", name: "Restaurante Cantinho da Silvia" }), plan({ store_id: "silvia", plan_type: "pdv_only", monthly_fee: 130, next_billing_date: "2026-11-20T12:00:00.000Z", essencial_lifetime_free: true }), undefined, pending),
    buildStorePlanRow(store({ id: "ric", name: "Ric Burguer" }), plan({ store_id: "ric", plan_type: "fixed", monthly_fee: 89.9 }), undefined, pending),
    buildStorePlanRow(store({ id: "e2e2", name: "Loja Teste E2E 2" }), plan({ store_id: "e2e2", plan_type: "commission_only", monthly_fee: 0, commission_rate: 6 }), undefined, pending),
    buildStorePlanRow(store({ id: "sem", name: "Teste Boutique Boutique" }), undefined, undefined, pending),
  ];

  it("a Silvia vira pdv_only com próxima cobrança 20/11 e vitalício marcado", () => {
    const silvia = rows[0];
    expect(silvia.display).toBe("pdv_only");
    expect(silvia.monthly).toBe(130);
    expect(formatShortDate(silvia.nextBilling)).toBe("20/11");
    expect(silvia.lifetimeFree).toBe(true);
  });

  it("marca a loja com solicitação pendente", () => {
    expect(rows[2].hasPendingRequest).toBe(true);
    expect(rows[0].hasPendingRequest).toBe(false);
  });

  it("ordena por mensalidade desc e depois por nome; agrupa pagantes/gratuitos/sem plano", () => {
    const sorted = sortStorePlanRows(rows);
    expect(sorted.map((r) => r.name)).toEqual([
      "Restaurante Cantinho da Silvia",
      "Ric Burguer",
      "Loja Teste E2E 2",
      "Teste Boutique Boutique",
    ]);
    const grouped = groupStorePlanRows(rows);
    expect(grouped.paying).toHaveLength(2);
    expect(grouped.free).toHaveLength(1);
    expect(grouped.noPlan).toHaveLength(1);
    expect(grouped.noPlan[0].name).toBe("Teste Boutique Boutique");
  });
});

describe("computeDistributionExtras", () => {
  it("conta Essencial no valor cheio, Comissão com 6% e o total PDV", () => {
    const plans = [
      plan({ store_id: "a", plan_type: "fixed", monthly_fee: 89.9 }),
      plan({ store_id: "b", plan_type: "fixed", monthly_fee: 69 }),
      plan({ store_id: "c", plan_type: "fixed", monthly_fee: 75 }),
      plan({ store_id: "d", plan_type: "commission_only", monthly_fee: 0, commission_rate: 6 }),
      plan({ store_id: "e", plan_type: "commission_only", monthly_fee: 0, commission_rate: 0 }),
      plan({ store_id: "f", plan_type: "pdv_only", monthly_fee: 130 }),
      plan({ store_id: "g", plan_type: "pdv_only", monthly_fee: 69 }),
    ];
    const extras = computeDistributionExtras(plans, undefined, 89.9);
    expect(extras.fixedFullPrice).toBe(1);
    expect(extras.commissionAt6).toBe(1);
    expect(extras.pdvTotal).toBeCloseTo(199, 2);
  });
});

describe("formatShortDate / daysSince / formatBRL", () => {
  it("formata DD/MM e retorna vazio sem data", () => {
    expect(formatShortDate("2026-11-20T12:00:00.000Z")).toBe("20/11");
    expect(formatShortDate(null)).toBe("");
    expect(formatShortDate("lixo")).toBe("");
  });

  it("conta os dias desde 09/10 até 28/10 (19 dias — a solicitação pendente)", () => {
    expect(daysSince("2026-10-09T00:00:00.000Z", NOW)).toBe(19);
    expect(daysSince(null, NOW)).toBe(0);
  });

  it("formata R$ com vírgula", () => {
    expect(formatBRL(1085.49)).toBe("R$ 1085,49");
    expect(formatBRL(0)).toBe("R$ 0,00");
  });
});
