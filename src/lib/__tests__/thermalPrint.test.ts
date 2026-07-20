import { describe, it, expect, beforeEach, vi } from "vitest";
import { printPdvReceipt, printThermalReceipt } from "../thermalPrint";

beforeEach(() => {
  document.body.innerHTML = "";
  vi.stubGlobal("print", vi.fn());
});

function getContainerHtml(): string {
  return document.getElementById("thermal-print-container")?.innerHTML ?? "";
}

function countOccurrences(html: string, needle: string): number {
  return html.split(needle).length - 1;
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

describe("printPdvReceipt — fase 3", () => {
  it("usa order_number sequencial quando disponível", () => {
    printPdvReceipt(
      {
        id: "abcdef1234",
        order_number: 42,
        created_at: "2026-06-28T15:00:00Z",
        subtotal: 10,
        total_price: 10,
        payment_method: "dinheiro",
        order_items: [{ quantity: 1, unit_price: 10, products: { name: "X" } }],
      },
      "Loja",
    );
    const html = getContainerHtml();
    expect(html).toContain("VENDA PDV #42");
    expect(html).toContain("ref: ABCDEF12");
  });

  it("imprime banner de origem MESA/COMANDA", () => {
    printPdvReceipt(
      {
        id: "mesa0000",
        created_at: "2026-06-28T15:00:00Z",
        subtotal: 10, total_price: 10, payment_method: "dinheiro",
        table_identifier: "Mesa 7",
        order_items: [{ quantity: 1, unit_price: 10, products: { name: "X" } }],
      },
      "Loja",
    );
    expect(getContainerHtml()).toContain("MESA / COMANDA MESA 7");
  });

  it("imprime observação geral do pedido", () => {
    printPdvReceipt(
      {
        id: "obs00000",
        created_at: "2026-06-28T15:00:00Z",
        subtotal: 10, total_price: 10, payment_method: "pix",
        notes: "Sem cebola, por favor",
        order_items: [{ quantity: 1, unit_price: 10, products: { name: "X" } }],
      },
      "Loja",
    );
    const html = getContainerHtml();
    expect(html).toContain("OBSERVAÇÃO");
    expect(html).toContain("Sem cebola");
  });

  it("imprime 2 vias por padrão (cozinha + cliente)", () => {
    printPdvReceipt(
      {
        id: "vias0000",
        created_at: "2026-06-28T15:00:00Z",
        subtotal: 10, total_price: 10, payment_method: "pix",
        order_items: [{ quantity: 1, unit_price: 10, products: { name: "X" } }],
      },
      "Loja",
    );
    const html = getContainerHtml();
    expect(html).toContain("VIA INTERNA");
    expect(html).toContain("VIA CLIENTE");
    expect(countOccurrences(html, "VENDA PDV")).toBe(2);
    expect(html).toContain("page-break-after:always");
  });

  it("respeita copies=1 (não duplica)", () => {
    printPdvReceipt(
      {
        id: "via1xxxx",
        created_at: "2026-06-28T15:00:00Z",
        subtotal: 10, total_price: 10, payment_method: "pix",
        order_items: [{ quantity: 1, unit_price: 10, products: { name: "X" } }],
      },
      "Loja",
      { copies: 1 },
    );
    const html = getContainerHtml();
    expect(countOccurrences(html, "VENDA PDV")).toBe(1);
    expect(html).not.toContain("page-break-after:always");
  });

  it("aplica largura 58mm via @page", () => {
    printPdvReceipt(
      {
        id: "w58xxxxx",
        created_at: "2026-06-28T15:00:00Z",
        subtotal: 10, total_price: 10, payment_method: "pix",
        order_items: [{ quantity: 1, unit_price: 10, products: { name: "X" } }],
      },
      "Loja",
      { paperWidth: 58 },
    );
    const style = document.getElementById("thermal-print-page-style");
    expect(style?.textContent).toContain("58mm");
  });

  it("imprime telefone e CNPJ da loja no cabeçalho", () => {
    printPdvReceipt(
      {
        id: "cnpj0000",
        created_at: "2026-06-28T15:00:00Z",
        subtotal: 10, total_price: 10, payment_method: "pix",
        order_items: [{ quantity: 1, unit_price: 10, products: { name: "X" } }],
      },
      "Loja",
      { storePhone: "(11) 99999-9999", storeCnpj: "12.345.678/0001-00" },
    );
    const html = getContainerHtml();
    expect(html).toContain("(11) 99999-9999");
    expect(html).toContain("12.345.678/0001-00");
  });

  it("splitByPrinter imprime via COZINHA quando há item printer_target=kitchen", () => {
    printPdvReceipt(
      {
        id: "kitc0000",
        created_at: "2026-06-28T15:00:00Z",
        subtotal: 20, total_price: 20, payment_method: "dinheiro",
        order_items: [
          { quantity: 1, unit_price: 15, products: { name: "X-Burger" }, printer_target: "kitchen" },
          { quantity: 1, unit_price: 5,  products: { name: "Coca 350ml" }, printer_target: "counter" },
        ],
      },
      "Loja",
      { splitByPrinter: true },
    );
    const html = getContainerHtml();
    expect(html).toContain("VIA COZINHA");
    expect(html).toContain("COZINHA — PREPARAR");
    expect(html).toContain("X-Burger");
    expect(html).toContain("VIA CLIENTE");
    // preços só na via cliente
    expect(html).toContain("20,00");
  });
});

describe("printThermalReceipt — delivery", () => {
  const baseOrder = {
    id: "del00001",
    created_at: "2026-06-28T15:00:00Z",
    subtotal: 50,
    delivery_fee: 10,
    total_price: 60,
    payment_method: "pix" as const,
    neighborhood: "Centro",
    address_details: "Rua A, 100",
    order_items: [{ id: "i1", quantity: 1, unit_price: 50, products: { name: "Pizza M" } }],
  };

  it("imprime banner DELIVERY, endereço e cliente", () => {
    printThermalReceipt(baseOrder, "Pizzaria", "João");
    const html = getContainerHtml();
    expect(html).toContain("DELIVERY");
    expect(html).toContain("João");
    expect(html).toContain("Rua A, 100");
    expect(html).toContain("Centro");
  });

  it("renderiza endereço estruturado quando disponível", () => {
    printThermalReceipt(
      {
        ...baseOrder,
        delivery_address: {
          street: "Rua das Flores", number: "123", complement: "Apto 4",
          neighborhood: "Jardins", city: "São Paulo", state: "SP",
          cep: "01234-567", reference: "ao lado da padaria",
        },
      },
      "Pizzaria", "Maria",
    );
    const html = getContainerHtml();
    expect(html).toContain("Rua das Flores, 123");
    expect(html).toContain("Apto 4");
    expect(html).toContain("Jardins");
    expect(html).toContain("São Paulo/SP");
    expect(html).toContain("01234-567");
    expect(html).toContain("ao lado da padaria");
  });

  it("banner RETIRADA quando delivery_mode=retirada e oculta endereço", () => {
    printThermalReceipt(
      { ...baseOrder, delivery_mode: "retirada" },
      "Pizzaria", "Carlos",
    );
    const html = getContainerHtml();
    expect(html).toContain("RETIRADA");
    expect(html).toContain("retirar no balcão");
  });

  it("imprime cupom em linha própria + observação geral", () => {
    printThermalReceipt(
      {
        ...baseOrder,
        coupon_code: "PROMO10",
        coupon_discount: 5,
        notes: "Entregar na portaria",
      },
      "Pizzaria", "Ana",
    );
    const html = getContainerHtml();
    expect(html).toContain("Cupom (PROMO10)");
    expect(html).toContain("OBSERVAÇÃO");
    expect(html).toContain("Entregar na portaria");
  });

  it("suporta split de pagamento no delivery", () => {
    printThermalReceipt(
      {
        ...baseOrder,
        payment_method: "maquininha_credito",
        payments: [
          { method: "maquininha_credito", amount: 40 },
          { method: "dinheiro", amount: 20 },
        ],
      },
      "Pizzaria", "Pedro",
    );
    const html = getContainerHtml();
    expect(html).toContain("Pagamento (dividido)");
    expect(html).toContain("40,00");
    expect(html).toContain("20,00");
  });

  it("imprime recebido + troco quando dinheiro com cash_received", () => {
    printThermalReceipt(
      {
        ...baseOrder,
        payment_method: "dinheiro",
        cash_received: 100,
        troco: 40,
      },
      "Pizzaria", "Lia",
    );
    const html = getContainerHtml();
    expect(html).toContain("Recebido");
    expect(html).toContain("Troco");
    expect(html).toContain("40,00");
  });

  it("imprime TROCO PARA quando needs_change sem cash_received", () => {
    printThermalReceipt(
      {
        ...baseOrder,
        payment_method: "dinheiro",
        needs_change: true,
        change_for: 100,
      },
      "Pizzaria", "Lia",
    );
    expect(getContainerHtml()).toContain("TROCO PARA");
  });

  it("agendamento aparece em destaque", () => {
    printThermalReceipt(
      { ...baseOrder, scheduled_for: "2026-07-01T20:00:00Z" },
      "Pizzaria", "Lia",
    );
    expect(getContainerHtml()).toContain("PEDIDO AGENDADO");
  });

  it("nº de pedido sequencial quando disponível", () => {
    printThermalReceipt(
      { ...baseOrder, order_number: 1024 },
      "Pizzaria", "Lia",
    );
    const html = getContainerHtml();
    expect(html).toContain("PEDIDO #1024");
    expect(html).toContain("ref:");
  });

  it("imprime 2 vias por padrão", () => {
    printThermalReceipt(baseOrder, "Pizzaria", "Lia");
    const html = getContainerHtml();
    expect(html).toContain("VIA COZINHA");
    expect(html).toContain("VIA CLIENTE");
    expect(countOccurrences(html, "PEDIDO #")).toBeGreaterThanOrEqual(2);
  });
});