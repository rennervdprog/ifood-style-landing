/**
 * Testes das regras do painel da Matriz e das sublojas — Fase 2.
 *
 * Regras puras de src/lib/networkUnits.ts (espelham as migrations
 * 20261028140000 / 20261028141000 / 20261028142000). A fonte da verdade é
 * o banco; aqui fica o que o app usa para decidir o que mostrar.
 */
import { describe, it, expect } from "vitest";
import {
  CHECKLIST_KEYS,
  checklistDoneCount,
  checklistMissingLabels,
  checklistMissingKeys,
  isChecklistReady,
  resolveUnitDisplayStatus,
  UNIT_STATUS_LABELS,
  canPublishUnit,
  onlySublojas,
  findMatrizStore,
  slugifyUnitName,
  validateCreateUnitForm,
  parseMoneyField,
  buildInviteLink,
  isInvitePastDue,
  parseInviteActionResult,
  type UnitChecklist,
  type CreateUnitForm,
} from "../networkUnits";

const fullChecklist: UnitChecklist = {
  store_id: "s1",
  is_draft: true,
  address: true,
  hours: true,
  menu: true,
  driver: true,
  ready: true,
};

const emptyForm: CreateUnitForm = {
  name: "",
  slug: "",
  category: "restaurante",
  address_street: "",
  address_number: "",
  address_neighborhood: "",
  address_city: "",
  address_state: "",
  address_cep: "",
  delivery_fee: "",
  delivery_radius: "",
  minimum_order_value: "",
};

describe("checklist da subloja (C9/M8)", () => {
  it("conta os itens prontos e detecta pronto", () => {
    expect(checklistDoneCount(fullChecklist)).toBe(4);
    expect(isChecklistReady(fullChecklist)).toBe(true);
    expect(checklistMissingLabels(fullChecklist)).toEqual([]);
    expect(checklistMissingKeys(fullChecklist)).toEqual([]);
  });

  it("lista o que falta, na ordem da tela", () => {
    const partial = { ...fullChecklist, hours: false, driver: false };
    expect(checklistDoneCount(partial)).toBe(2);
    expect(isChecklistReady(partial)).toBe(false);
    expect(checklistMissingKeys(partial)).toEqual(["hours", "driver"]);
    expect(checklistMissingLabels(partial)).toEqual([
      "Horário configurado",
      "Entregador aceito",
    ]);
  });

  it("tem 4 itens e todos têm rótulo", () => {
    expect(CHECKLIST_KEYS).toEqual(["address", "hours", "menu", "driver"]);
  });
});

describe("status exibido da subloja (decisão 2: matriz não vende)", () => {
  it("rascunho manda sobre qualquer outro estado", () => {
    expect(resolveUnitDisplayStatus({ is_draft: true, force_closed: true, status: "ativo" })).toBe("draft");
    expect(UNIT_STATUS_LABELS.draft).toBe("RASCUNHO");
  });

  it("pausada quando force_closed, ativa quando status ativo", () => {
    expect(resolveUnitDisplayStatus({ is_draft: false, force_closed: true, status: "ativo" })).toBe("paused");
    expect(resolveUnitDisplayStatus({ is_draft: false, force_closed: false, status: "ativo" })).toBe("active");
    expect(resolveUnitDisplayStatus({ is_draft: false, status: "analise" })).toBe("pending");
  });

  it("só publica rascunho com checklist pronto", () => {
    expect(canPublishUnit({ is_draft: true }, fullChecklist)).toBe(true);
    expect(canPublishUnit({ is_draft: true }, { ...fullChecklist, menu: false })).toBe(false);
    expect(canPublishUnit({ is_draft: false }, fullChecklist)).toBe(false);
    expect(canPublishUnit({ is_draft: true }, null)).toBe(false);
  });
});

describe("matriz-guia fora da lista de sublojas", () => {
  const stores = [
    { id: "m", is_matriz: true },
    { id: "u1", is_matriz: false },
    { id: "u2", is_matriz: null },
  ];

  it("onlySublojas exclui a matriz", () => {
    expect(onlySublojas(stores).map((s) => s.id)).toEqual(["u1", "u2"]);
  });

  it("findMatrizStore acha a guia", () => {
    expect(findMatrizStore(stores)?.id).toBe("m");
    expect(findMatrizStore([{ id: "u1", is_matriz: false }])).toBeUndefined();
  });
});

describe("slug da subloja", () => {
  it("tira acento, minúsculas, só [a-z0-9-]", () => {
    expect(slugifyUnitName("Cantinho do Tempero — Centro")).toBe("cantinho-do-tempero-centro");
    expect(slugifyUnitName("  Pizzaria D'Água  ")).toBe("pizzaria-d-agua");
    expect(slugifyUnitName("Açaí & Cia!")).toBe("acai-cia");
  });
});

describe("validação do formulário de criação (C9/M8)", () => {
  it("form vazio lista os obrigatórios", () => {
    const problems = validateCreateUnitForm(emptyForm);
    expect(problems).toContain("Preencha nome da unidade.");
    expect(problems).toContain("Preencha rua.");
    expect(problems).toContain("Preencha número.");
    expect(problems).toContain("Preencha bairro.");
    expect(problems).toContain("Preencha cidade.");
    expect(problems).toContain("Preencha cep.");
  });

  it("form completo passa", () => {
    expect(
      validateCreateUnitForm({
        ...emptyForm,
        name: "Cantinho — Centro",
        slug: "cantinho-centro",
        address_street: "Av. Getúlio Vargas",
        address_number: "1345",
        address_neighborhood: "Centro",
        address_city: "Araruama",
        address_cep: "28970-000",
        delivery_fee: "6,99",
      }),
    ).toEqual([]);
  });

  it("slug inválido e valor negativo são barrados", () => {
    const problems = validateCreateUnitForm({
      ...emptyForm,
      name: "X",
      slug: "Slug_Com Espaço",
      address_street: "Rua A",
      address_number: "1",
      address_neighborhood: "Centro",
      address_city: "Araruama",
      address_cep: "28970-000",
      delivery_fee: "-5",
    });
    expect(problems).toContain("O slug só aceita letras minúsculas, números e hífen.");
    expect(problems).toContain("A taxa de entrega precisa ser um valor maior ou igual a zero.");
  });
});

describe("campos monetários e link do convite", () => {
  it("parseMoneyField aceita vírgula e vazio vira null", () => {
    expect(parseMoneyField("6,99")).toBe(6.99);
    expect(parseMoneyField("  ")).toBeNull();
    expect(parseMoneyField("abc")).toBeNull();
  });

  it("buildInviteLink monta /convite-rede/:code", () => {
    expect(buildInviteLink("https://itasuper.com.br/", "abc-123")).toBe(
      "https://itasuper.com.br/convite-rede/abc-123",
    );
  });

  it("isInvitePastDue usa a validade", () => {
    const now = new Date("2026-10-28T12:00:00Z");
    expect(isInvitePastDue("2026-10-28T11:00:00Z", now)).toBe(true);
    expect(isInvitePastDue("2026-11-04T12:00:00Z", now)).toBe(false);
  });
});

describe("resultado estruturado de accept/decline (bugfix Fase 2)", () => {
  it("aceite ok devolve storeId", () => {
    expect(parseInviteActionResult({ ok: true, store_id: "loja-1" })).toEqual({
      ok: true,
      storeId: "loja-1",
    });
  });

  it("vencido devolve ok:false com a mensagem do banco", () => {
    expect(
      parseInviteActionResult({ ok: false, error: "Este convite venceu (7 dias)." }),
    ).toEqual({ ok: false, error: "Este convite venceu (7 dias)." });
  });

  it("recusa ok não tem erro", () => {
    expect(parseInviteActionResult({ ok: true })).toEqual({ ok: true, storeId: undefined });
  });

  it("resposta malformada vira erro genérico", () => {
    expect(parseInviteActionResult(null)).toEqual({
      ok: false,
      error: "Resposta inesperada do servidor.",
    });
    expect(parseInviteActionResult({})).toEqual({
      ok: false,
      error: "Resposta inesperada do servidor.",
    });
    expect(parseInviteActionResult({ ok: false })).toEqual({
      ok: false,
      error: "Convite inválido.",
    });
  });
});
