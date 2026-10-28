import { describe, it, expect } from "vitest";
import {
  getStoresWithDebt,
  summarizeFailedPayouts,
  computeStoreSettlement,
  summarizeSettlement,
} from "@/lib/superAdminConsolidado";

// Fase 4 — Consolidado redesenhado. Casos reais de 27/10/2026:
// Duda lanches Teste R$ 29,70 (30 entregas), Pastelão R$ 6,00,
// Doceria Da Cleide R$ 5,94, Loja Demonstração R$ 3,96 — tudo taxa
// de entrega. Repasses com falha: 2 do Pastelão, R$ 39,00 cada, 01/07.
const STORES = [
  { id: "duda", name: "Duda lanches Teste" },
  { id: "pastelao", name: "Pastelão Carioca" },
  { id: "cleide", name: "Doceria Da Cleide" },
  { id: "demo", name: "Loja Demonstração" },
  { id: "pdv-teste", name: "PDV Only Teste" },
];

describe("getStoresWithDebt", () => {
  it("lista só quem deve, da maior dívida para a menor", () => {
    const list = getStoresWithDebt(
      [
        { store_id: "demo", comissao_pendente: 0, repasse_pendente: 3.96 },
        { store_id: "duda", comissao_pendente: 0, repasse_pendente: 29.7 },
        { store_id: "pastelao", comissao_pendente: 0, repasse_pendente: 6 },
        { store_id: "cleide", comissao_pendente: 0, repasse_pendente: 5.94 },
        { store_id: "pdv-teste", comissao_pendente: 0, repasse_pendente: 0 },
      ],
      STORES
    );
    expect(list.map((s) => s.name)).toEqual([
      "Duda lanches Teste",
      "Pastelão Carioca",
      "Doceria Da Cleide",
      "Loja Demonstração",
    ]);
    expect(list.map((s) => s.total)).toEqual([29.7, 6, 5.94, 3.96]);
    expect(list[0].deliveries).toBe(30);
    expect(list[0].originLabel).toBe("Taxa de entrega · 30 entregas a R$ 0,99");
  });

  it("loja sem nome conhecido vira 'Loja' e não quebra", () => {
    const list = getStoresWithDebt(
      [{ store_id: "desconhecida", comissao_pendente: 10, repasse_pendente: 0 }],
      STORES
    );
    expect(list[0].name).toBe("Loja");
    expect(list[0].originLabel).toBe("Comissão %");
  });

  it("origem mista: comissão + taxa de entrega", () => {
    const list = getStoresWithDebt(
      [{ store_id: "duda", comissao_pendente: 5, repasse_pendente: 1.98 }],
      STORES
    );
    expect(list[0].total).toBe(6.98);
    expect(list[0].deliveries).toBe(2);
    expect(list[0].originLabel).toBe("Comissão + taxa de entrega");
  });

  it("lista vazia quando ninguém deve", () => {
    expect(getStoresWithDebt([], STORES)).toEqual([]);
    expect(
      getStoresWithDebt(
        [{ store_id: "duda", comissao_pendente: 0, repasse_pendente: 0 }],
        STORES
      )
    ).toEqual([]);
  });
});

describe("summarizeFailedPayouts", () => {
  it("resume os 2 repasses do Pastelão (R$ 39,00 cada, 01/07/2026)", () => {
    const s = summarizeFailedPayouts(
      [
        { store_id: "pastelao", amount: 39, created_at: "2026-07-01T04:12:44Z" },
        { store_id: "pastelao", amount: 39, created_at: "2026-07-01T04:18:24Z" },
      ],
      STORES
    );
    expect(s.count).toBe(2);
    expect(s.total).toBe(78);
    expect(s.latestDate).toBe("2026-07-01T04:18:24Z");
    expect(s.storeNames).toEqual(["Pastelão Carioca"]);
    expect(s.topStore).toEqual({ name: "Pastelão Carioca", count: 2, total: 78 });
  });

  it("sem falhas: zeros e null", () => {
    const s = summarizeFailedPayouts([], STORES);
    expect(s).toEqual({
      count: 0,
      total: 0,
      latestDate: null,
      storeNames: [],
      topStore: null,
    });
  });

  it("várias lojas: nomes sem repetir, da mais recente para a mais antiga", () => {
    const s = summarizeFailedPayouts(
      [
        { store_id: "duda", amount: 10, created_at: "2026-10-20T10:00:00Z" },
        { store_id: "pastelao", amount: 39, created_at: "2026-10-21T10:00:00Z" },
        { store_id: "duda", amount: 20, created_at: "2026-10-19T10:00:00Z" },
      ],
      STORES
    );
    expect(s.count).toBe(3);
    expect(s.total).toBe(69);
    expect(s.storeNames).toEqual(["Pastelão Carioca", "Duda lanches Teste"]);
    expect(s.topStore?.name).toBe("Duda lanches Teste");
  });
});

describe("computeStoreSettlement + summarizeSettlement", () => {
  const stores = [
    { id: "loja-a", name: "Loja A" },
    { id: "loja-b", name: "Loja B" },
  ];
  // Loja A: plano fixed (taxa 0). Loja B: plano com 5% de comissão.
  const plans = [
    { store_id: "loja-a", plan_type: "fixed", commission_rate: 0 },
    { store_id: "loja-b", plan_type: "percent", commission_rate: 5 },
  ];
  const getStoreRate = (storeId: string) => {
    const plan = plans.find((p) => p.store_id === storeId);
    if (!plan) return 0.05;
    if (plan.plan_type === "fixed") return 0;
    return Number(plan.commission_rate) / 100;
  };

  it("soma subtotal por loja, separa PDV e calcula comissão só no físico", () => {
    const settlement = computeStoreSettlement(
      [
        { store_id: "loja-a", subtotal: 100, delivery_fee: 5, payment_method: "dinheiro", order_source: "delivery" },
        { store_id: "loja-a", subtotal: 50, delivery_fee: 0, payment_method: "pix", order_source: "delivery" },
        { store_id: "loja-b", subtotal: 200, delivery_fee: 0, payment_method: "dinheiro", order_source: "pdv", commission_rate: 2 },
        { store_id: "loja-b", subtotal: 40, delivery_fee: 4, payment_method: "dinheiro", order_source: "delivery" },
      ],
      stores,
      "all",
      plans,
      getStoreRate
    );
    expect(settlement).toHaveLength(2);
    // Ordenado por totalSales desc: Loja B (240) antes da Loja A (150).
    expect(settlement[0].name).toBe("Loja B");
    expect(settlement[0].totalSales).toBe(240);
    expect(settlement[0].pdvSales).toBe(200);
    expect(settlement[0].pdvOrders).toBe(1);
    expect(settlement[0].pdvCommission).toBe(4); // 2% de 200
    expect(settlement[0].physicalSales).toBe(40);
    expect(settlement[0].commissionDue).toBe(2); // 5% de 40
    expect(settlement[1].name).toBe("Loja A");
    expect(settlement[1].totalSales).toBe(150);
    expect(settlement[1].commissionDue).toBe(0); // plano fixed → taxa 0
  });

  it("sem pedidos: liquidação vazia; totais zerados", () => {
    const settlement = computeStoreSettlement([], stores, "all", plans, getStoreRate);
    expect(settlement).toEqual([]);
    expect(summarizeSettlement(settlement)).toEqual({
      totalVolume: 0,
      grossProfit: 0,
      totalOrders: 0,
      storesWithSales: 0,
    });
  });

  it("filtro por loja selecionada", () => {
    const settlement = computeStoreSettlement(
      [
        { store_id: "loja-a", subtotal: 100, payment_method: "dinheiro", order_source: "delivery" },
        { store_id: "loja-b", subtotal: 200, payment_method: "dinheiro", order_source: "delivery" },
      ],
      stores,
      "loja-b",
      plans,
      getStoreRate
    );
    expect(settlement).toHaveLength(1);
    expect(settlement[0].name).toBe("Loja B");
    expect(summarizeSettlement(settlement).totalVolume).toBe(200);
    expect(summarizeSettlement(settlement).totalOrders).toBe(1);
    expect(summarizeSettlement(settlement).storesWithSales).toBe(1);
  });
});
