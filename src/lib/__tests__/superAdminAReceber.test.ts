import { describe, it, expect } from "vitest";
import {
  buildMarkPaidConfirm,
  buildWhatsAppMessage,
  receivableKindOrigin,
  DELIVERY_FEE_LABEL,
  type StoreReceivable,
} from "@/lib/superAdminAReceber";

// brl() usa espaço inquebrável (U+00A0) depois do "R$" — normalizar
// antes de comparar literais com "R$ 29,70".
const norm = (s: string) => s.replace(/\u00A0/g, " ");
// Duda lanches Teste R$ 29,70 (30 entregas), Pastelão R$ 7,00
// (taxa R$ 6,00 + PDV R$ 1,00), PDV Only Teste R$ 18,00 (só PDV).
const DUDA: StoreReceivable = {
  store_id: "duda",
  name: "Duda lanches Teste",
  plan_type: "essencial",
  phone: null,
  mensalidade: 0,
  mensalidade_overdue_days: 0,
  comissao: 0,
  entrega_fee: 29.7,
  pdv_fee: 0,
  total: 29.7,
};

const PASTELAO: StoreReceivable = {
  store_id: "pastelao",
  name: "Pastelão Carioca",
  plan_type: "essencial",
  phone: null,
  mensalidade: 0,
  mensalidade_overdue_days: 0,
  comissao: 0,
  entrega_fee: 6,
  pdv_fee: 1,
  total: 7,
};

describe("DELIVERY_FEE_LABEL", () => {
  it("a taxa é R$ 0,99 — a tela original escreve 'R$2/entrega' (errado)", () => {
    expect(DELIVERY_FEE_LABEL).toBe("R$ 0,99/entrega");
  });
});

describe("buildWhatsAppMessage", () => {
  it("usa o rótulo correto R$ 0,99/entrega e nunca 'R$2'", () => {
    const msg = norm(buildWhatsAppMessage(DUDA));
    expect(msg).toContain("Taxa R$ 0,99/entrega");
    expect(msg).not.toContain("R$2");
    expect(msg).toContain("R$ 29,70");
    expect(msg).toContain("Duda lanches Teste");
  });

  it("mensalidade vencida mostra os dias de atraso", () => {
    const row: StoreReceivable = {
      ...DUDA,
      mensalidade: 89.9,
      mensalidade_overdue_days: 12,
      entrega_fee: 0,
      total: 89.9,
    };
    expect(norm(buildWhatsAppMessage(row))).toContain("Mensalidade: R$ 89,90 (12d atraso)");
  });

  it("lista todos os tipos devidos e o total", () => {
    const msg = buildWhatsAppMessage(PASTELAO);
    expect(msg).toContain("Taxa R$ 0,99/entrega");
    expect(msg).toContain("PDV:");
    expect(msg).toContain("7,00");
  });
});

describe("buildMarkPaidConfirm", () => {
  it("mostra loja, tipo e valor — ex.: 'Dar baixa de R$ 29,70 da taxa de entrega da Duda'", () => {
    const c = buildMarkPaidConfirm(DUDA, "entrega_fee", 29.7);
    expect(c.title).toBe("Dar baixa como pago?");
    expect(norm(c.description)).toContain("R$ 29,70");
    expect(c.description).toContain("taxa de entrega");
    expect(c.description).toContain("Duda lanches Teste");
  });

  it("PDV usa 'do PDV', não 'da pdv'", () => {
    const c = buildMarkPaidConfirm(PASTELAO, "pdv_fee", 1);
    expect(c.description).toContain("do PDV");
    expect(c.description).toContain("Pastelão Carioca");
  });
});

describe("receivableKindOrigin", () => {
  it("taxa exata mostra a contagem (30 entregas)", () => {
    expect(receivableKindOrigin(DUDA, "entrega_fee")).toBe("30 entregas a R$ 0,99");
  });

  it("taxa residual não inventa contagem (Pastelão R$ 6,00)", () => {
    expect(receivableKindOrigin(PASTELAO, "entrega_fee")).toBe("Saldo acumulado da taxa");
  });

  it("mensalidade vencida mostra os dias; em dia, só o plano", () => {
    const vencida: StoreReceivable = { ...DUDA, mensalidade_overdue_days: 12 };
    expect(receivableKindOrigin(vencida, "mensalidade")).toBe("Vencida há 12d");
    expect(receivableKindOrigin(DUDA, "mensalidade")).toBe("Mensalidade do plano");
  });

  it("comissão e PDV têm origem fixa", () => {
    expect(receivableKindOrigin(DUDA, "comissao")).toBe("% sobre vendas físicas (dinheiro/cartão)");
    expect(receivableKindOrigin(DUDA, "pdv_fee")).toBe("Acumulado das vendas de balcão");
  });
});
