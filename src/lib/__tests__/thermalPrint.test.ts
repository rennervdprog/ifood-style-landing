import { describe, it, expect, beforeEach, vi } from "vitest";
import { printPdvReceipt } from "../thermalPrint";

beforeEach(() => {
  document.body.innerHTML = "";
  vi.stubGlobal("print", vi.fn());
});

function getContainerHtml(): string {
  return document.getElementById("thermal-print-container")?.innerHTML ?? "";
}

describe("printPdvReceipt", () => {
  it("imprime cabeçalho, ID e total", () => {
    printPdvReceipt(
      {
        id: "abcdef1234",
        created_at: "2026-06-28T15:00:00Z",
        subtotal: 30,
        total_price: 30,
        payment_method: "dinheiro",
        order_items: [{ quantity: 1, unit_price: 30, products: { name: "Pizza M" } }],
      },
      "Pizzaria Lagoinha",
    );
    const html = getContainerHtml();
    expect(html).toContain("ITASUPER");
    expect(html).toContain("Pizzaria Lagoinha");
    expect(html).toContain("VENDA PDV #ABCDEF12");
    expect(html).toContain("Pizza M");
    expect(html).toContain("30,00");
  });

  it("mostra troco quando pagamento em dinheiro com valor recebido", () => {
    printPdvReceipt(
      {
        id: "abcd0000",
        created_at: "2026-06-28T15:00:00Z",
        subtotal: 30,
        total_price: 30,
        payment_method: "dinheiro",
        cash_received: 50,
        troco: 20,
        order_items: [{ quantity: 1, unit_price: 30, products: { name: "Pizza M" } }],
      },
      "Loja",
    );
    const html = getContainerHtml();
    expect(html).toContain("Recebido");
    expect(html).toContain("Troco");
    expect(html).toContain("20,00");
  });

  it("renderiza split de pagamentos quando há mais de um método", () => {
    printPdvReceipt(
      {
        id: "split000",
        created_at: "2026-06-28T15:00:00Z",
        subtotal: 100,
        total_price: 100,
        payment_method: "maquininha_credito",
        payments: [
          { method: "maquininha_credito", amount: 60 },
          { method: "dinheiro", amount: 40 },
        ],
        order_items: [{ quantity: 1, unit_price: 100, products: { name: "Combo" } }],
      },
      "Loja",
    );
    const html = getContainerHtml();
    expect(html).toContain("Pagamento (dividido)");
    expect(html).toContain("60,00");
    expect(html).toContain("40,00");
  });

  it("mostra desconto quando aplicado", () => {
    printPdvReceipt(
      {
        id: "disc0000",
        created_at: "2026-06-28T15:00:00Z",
        subtotal: 50,
        pdv_discount: 5,
        total_price: 45,
        payment_method: "pix",
        order_items: [{ quantity: 1, unit_price: 50, products: { name: "X" } }],
      },
      "Loja",
    );
    const html = getContainerHtml();
    expect(html).toContain("Desconto");
    expect(html).toContain("5,00");
  });
});