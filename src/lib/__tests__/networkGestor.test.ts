/**
 * Testes da lib pura do Painel Matriz Gestor (networkGestor).
 * Agregações de período, deltas, breakdown da mensalidade (espelho da
 * RPC calculate_network_monthly_fee) e CSV — sem banco, sem React.
 */
import { describe, it, expect } from "vitest";
import {
  aggregatePeriodOrders,
  buildSalesCsv,
  dailySeriesLast7Days,
  daysSince,
  deltaPct,
  fallbackFeeBreakdown,
  orderStatusPresentation,
  parseFeeBreakdown,
  periodWindows,
  type OrderRowLite,
} from "../networkGestor";

const NOW = new Date(2026, 9, 29, 12, 0, 0); // 29/10/2026, meio-dia local

describe("periodWindows", () => {
  it("hoje: atual desde 00:00, anterior é o dia de ontem", () => {
    const w = periodWindows("hoje", NOW);
    expect(w.currentStart).toEqual(new Date(2026, 9, 29, 0, 0, 0, 0));
    expect(w.previousStart).toEqual(new Date(2026, 9, 28, 0, 0, 0, 0));
    expect(w.previousEnd).toEqual(new Date(2026, 9, 29, 0, 0, 0, 0));
  });

  it("7d: atual cobre 7 dias incluindo hoje; anterior, os 7 antes", () => {
    const w = periodWindows("7d", NOW);
    expect(w.currentStart).toEqual(new Date(2026, 9, 23, 0, 0, 0, 0));
    expect(w.previousStart).toEqual(new Date(2026, 9, 16, 0, 0, 0, 0));
  });

  it("30d: janelas de 30 dias", () => {
    const w = periodWindows("30d", NOW);
    expect(w.currentStart).toEqual(new Date(2026, 8, 30, 0, 0, 0, 0));
    expect(w.previousStart).toEqual(new Date(2026, 7, 31, 0, 0, 0, 0));
  });
});

describe("deltaPct", () => {
  it("calcula variação simples", () => {
    expect(deltaPct(110, 100)).toBeCloseTo(10);
    expect(deltaPct(50, 100)).toBeCloseTo(-50);
  });
  it("sem base (anterior 0): 100 quando houve venda, null quando zero", () => {
    expect(deltaPct(10, 0)).toBe(100);
    expect(deltaPct(0, 0)).toBeNull();
  });
});

describe("aggregatePeriodOrders", () => {
  const rows: OrderRowLite[] = [
    { store_id: "a", total_price: 100, created_at: "2026-10-29T10:00:00" },
    { store_id: "a", total_price: 50, created_at: "2026-10-29T11:00:00" },
    { store_id: "b", total_price: 30, created_at: "2026-10-29T09:00:00" },
    { store_id: "a", total_price: 100, created_at: "2026-10-28T10:00:00" }, // ontem
    { store_id: "b", total_price: 60, created_at: "2026-10-28T10:00:00" }, // ontem
    { store_id: "a", total_price: 999, created_at: "2026-10-20T10:00:00" }, // fora das janelas
  ];

  it("soma rede e por loja, com ticket e deltas", () => {
    const agg = aggregatePeriodOrders(rows, periodWindows("hoje", NOW), ["a", "b"]);
    expect(agg.sales).toBe(180);
    expect(agg.orders).toBe(3);
    expect(agg.ticket).toBeCloseTo(60);
    expect(agg.prevSales).toBe(160);
    expect(agg.salesDelta).toBeCloseTo(12.5);
    const a = agg.perStore.get("a")!;
    expect(a.sales).toBe(150);
    expect(a.orders).toBe(2);
    expect(a.ticket).toBeCloseTo(75);
    const b = agg.perStore.get("b")!;
    expect(b.salesDelta).toBeCloseTo(-50);
  });

  it("loja sem pedidos aparece zerada no mapa", () => {
    const agg = aggregatePeriodOrders(rows, periodWindows("hoje", NOW), ["a", "b", "c"]);
    expect(agg.perStore.get("c")?.sales).toBe(0);
    expect(agg.perStore.get("c")?.salesDelta).toBeNull();
  });
});

describe("dailySeriesLast7Days", () => {
  it("gera 7 dias terminando hoje, com rótulo 'hoje' no último", () => {
    const rows: OrderRowLite[] = [
      { store_id: "a", total_price: 70, created_at: "2026-10-29T08:00:00" },
      { store_id: "a", total_price: 30, created_at: "2026-10-23T08:00:00" },
    ];
    const series = dailySeriesLast7Days(rows, NOW);
    expect(series).toHaveLength(7);
    expect(series[6].isToday).toBe(true);
    expect(series[6].label).toBe("hoje");
    expect(series[6].sales).toBe(70);
    expect(series[0].sales).toBe(30);
  });
});

describe("fallbackFeeBreakdown (espelho da RPC)", () => {
  it("5 unidades delivery, GMV alto: base + 2 extras", () => {
    const b = fallbackFeeBreakdown({
      planType: "fixed", baseMonthlyFee: 89.9, deliveryUnitCount: 5, pdvOnlyUnitCount: 0, gmv60d: 58300,
    });
    expect(b.extraUnitCount).toBe(2);
    expect(b.extraFee).toBeCloseTo(79.8);
    expect(b.totalMonthlyFee).toBeCloseTo(169.7);
    expect(b.freeByGmv).toBe(false);
  });

  it("GMV 60d até R$ 5.000: gratuidade zera o total", () => {
    const b = fallbackFeeBreakdown({
      planType: "fixed", baseMonthlyFee: 89.9, deliveryUnitCount: 5, pdvOnlyUnitCount: 0, gmv60d: 5000,
    });
    expect(b.freeByGmv).toBe(true);
    expect(b.totalMonthlyFee).toBe(0);
  });

  it("só-PDV não conta como unidade de delivery", () => {
    const b = fallbackFeeBreakdown({
      planType: "fixed", baseMonthlyFee: 89.9, deliveryUnitCount: 3, pdvOnlyUnitCount: 2, gmv60d: 9000,
    });
    expect(b.extraUnitCount).toBe(0);
    expect(b.totalMonthlyFee).toBeCloseTo(89.9);
  });
});

describe("parseFeeBreakdown", () => {
  it("lê o JSON da RPC da Fase 4b", () => {
    const b = parseFeeBreakdown({
      plan_type: "fixed", base_monthly_fee: 89.9, base_reason: null,
      is_vip: false, delivery_unit_count: 5, pdv_only_unit_count: 1,
      free_units_included: 3, extra_unit_count: 2, extra_unit_fee: 39.9,
      extra_fee: 79.8, gmv_60d: 58300, free_gmv_threshold: 5000,
      free_by_gmv: false, total_monthly_fee: 169.7,
    });
    expect(b?.totalMonthlyFee).toBeCloseTo(169.7);
    expect(b?.pdvOnlyUnitCount).toBe(1);
  });
  it("rejeita payload inesperado", () => {
    expect(parseFeeBreakdown(null)).toBeNull();
    expect(parseFeeBreakdown({ foo: 1 })).toBeNull();
  });
});

describe("buildSalesCsv", () => {
  it("gera cabeçalho, linhas com vírgula decimal e total", () => {
    const csv = buildSalesCsv([
      { unitName: "Loja A", orders: 10, sales: 250.5, ticket: 25.05 },
      { unitName: "Loja B", orders: 0, sales: 0, ticket: 0 },
    ]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("Unidade;Pedidos;Vendas (R$);Ticket médio (R$)");
    expect(csv).toContain('"Loja A";10;250,50;25,05');
    expect(csv).toContain("TOTAL;10;250,50;25,05");
  });
});

describe("orderStatusPresentation e daysSince", () => {
  it("mapeia status reais de pedido", () => {
    expect(orderStatusPresentation("em_preparo").label).toBe("Em preparo");
    expect(orderStatusPresentation("saiu_para_entrega").label).toBe("Saiu p/ entrega");
    expect(orderStatusPresentation("finalizado").label).toBe("Entregue");
    expect(orderStatusPresentation("cancelado").label).toBe("Cancelado");
  });
  it("daysSince conta dias inteiros", () => {
    expect(daysSince(new Date(2026, 9, 27, 23, 0), NOW)).toBe(2);
    expect(daysSince(new Date(2026, 9, 29, 1, 0), NOW)).toBe(0);
  });
});
