import { describe, it, expect } from "vitest";
import { isBillableOrder, filterBillableOrders } from "@/lib/superAdminBillable";

describe("isBillableOrder", () => {
  it("pedido em andamento ou finalizado fatura", () => {
    for (const status of ["pendente", "preparando", "pronto_para_entrega", "em_transito", "finalizado", "entregue"]) {
      expect(isBillableOrder({ status })).toBe(true);
    }
  });

  it("cancelado e aguardando pagamento não faturam", () => {
    expect(isBillableOrder({ status: "cancelado" })).toBe(false);
    expect(isBillableOrder({ status: "aguardando_pagamento" })).toBe(false);
  });

  it("sem status conta como faturável (igual ao filtro original)", () => {
    expect(isBillableOrder({})).toBe(true);
    expect(isBillableOrder({ status: null })).toBe(true);
  });
});

describe("filterBillableOrders", () => {
  it("mantém só os faturáveis, na mesma ordem", () => {
    const orders = [
      { id: 1, status: "finalizado" },
      { id: 2, status: "cancelado" },
      { id: 3, status: "aguardando_pagamento" },
      { id: 4, status: "pendente" },
    ];
    expect(filterBillableOrders(orders).map((o) => o.id)).toEqual([1, 4]);
  });
});
