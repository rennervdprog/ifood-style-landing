import { describe, it, expect, beforeEach } from "vitest";
import {
  EMPTY_SIGNUP_VALUES,
  SIGNUP_DRAFT_KEY,
  clearSignupDraft,
  firstErrorField,
  loadSignupDraft,
  saveSignupDraft,
  validateSignupStep,
  type SignupValues,
} from "@/lib/signupSteps";

// Cadastro em 3 passos (2026-10-25): mesmas regras do cadastro antigo,
// só o momento muda — validação por passo, erro inline no campo.

const validStep1: SignupValues = {
  ...EMPTY_SIGNUP_VALUES,
  email: "teste@email.com",
  whatsapp: "(14) 99999-9999",
  fullName: "Maria Silva",
  password: "Senha123!",
};

const validStep2: SignupValues = {
  ...EMPTY_SIGNUP_VALUES,
  cep: "28979-129",
  number: "1345",
  street: "Av. Getúlio Vargas",
  neighborhood: "Centro",
};

const validStep3: SignupValues = {
  ...EMPTY_SIGNUP_VALUES,
  deliveryPin: "1234",
  confirmPin: "1234",
  pinAcknowledged: true,
  acceptedTerms: true,
};

describe("validateSignupStep — passo 1 (Sua conta)", () => {
  it("passo 1 válido não tem erros", () => {
    expect(validateSignupStep(1, validStep1, true)).toEqual({});
  });

  it("e-mail inválido", () => {
    const errors = validateSignupStep(1, { ...validStep1, email: "nao-email" }, true);
    expect(errors.email).toBe("Informe um e-mail válido.");
    expect(Object.keys(errors)).toEqual(["email"]);
  });

  it("WhatsApp sem DDD / curto", () => {
    expect(validateSignupStep(1, { ...validStep1, whatsapp: "99999" }, true).whatsapp).toBe(
      "Informe um WhatsApp válido com DDD.",
    );
  });

  it("nome com menos de 3 caracteres", () => {
    expect(validateSignupStep(1, { ...validStep1, fullName: "Al" }, true).fullName).toBe(
      "Informe seu nome completo.",
    );
  });

  it("senha vazia", () => {
    expect(validateSignupStep(1, { ...validStep1, password: "" }, false).password).toBe(
      "Crie uma senha.",
    );
  });

  it("senha sem as 5 regras", () => {
    expect(validateSignupStep(1, { ...validStep1, password: "abc" }, false).password).toBe(
      "Sua senha precisa atender as 5 regras acima.",
    );
  });

  it("vários erros de uma vez (não um por vez, como no toast antigo)", () => {
    const errors = validateSignupStep(
      1,
      { ...EMPTY_SIGNUP_VALUES, email: "ruim", whatsapp: "1", fullName: "A", password: "" },
      false,
    );
    expect(Object.keys(errors).sort()).toEqual(["email", "fullName", "password", "whatsapp"]);
  });
});

describe("validateSignupStep — passo 2 (Endereço)", () => {
  it("passo 2 válido não tem erros", () => {
    expect(validateSignupStep(2, validStep2, true)).toEqual({});
  });

  it("CEP com menos de 8 dígitos", () => {
    expect(validateSignupStep(2, { ...validStep2, cep: "12345" }, true).cep).toBe(
      "Informe um CEP válido com 8 dígitos.",
    );
  });

  it("número, rua e bairro obrigatórios", () => {
    const errors = validateSignupStep(
      2,
      { ...validStep2, number: "", street: "", neighborhood: "" },
      true,
    );
    expect(errors.number).toBe("Informe o número.");
    expect(errors.street).toBe("Informe a rua.");
    expect(errors.neighborhood).toBe("Informe o bairro.");
  });

  it("complemento e referência são opcionais", () => {
    expect(validateSignupStep(2, { ...validStep2, complement: "", referencePoint: "" }, true)).toEqual({});
  });
});

describe("validateSignupStep — passo 3 (PIN)", () => {
  it("passo 3 válido não tem erros", () => {
    expect(validateSignupStep(3, validStep3, true)).toEqual({});
  });

  it("PIN com menos de 4 dígitos", () => {
    expect(validateSignupStep(3, { ...validStep3, deliveryPin: "12", confirmPin: "12" }, true).deliveryPin).toBe(
      "Defina um PIN de entrega com 4 dígitos numéricos.",
    );
  });

  it("PINs diferentes", () => {
    expect(
      validateSignupStep(3, { ...validStep3, deliveryPin: "1234", confirmPin: "4321" }, true).confirmPin,
    ).toBe("Os PINs informados não coincidem.");
  });

  it("checkbox do PIN e termos obrigatórios", () => {
    const errors = validateSignupStep(
      3,
      { ...validStep3, pinAcknowledged: false, acceptedTerms: false },
      true,
    );
    expect(errors.pinAcknowledged).toBe("Confirme que este PIN será usado em todas as suas entregas.");
    expect(errors.acceptedTerms).toBe(
      "Você precisa aceitar os Termos de Uso e a Política de Privacidade.",
    );
  });
});

describe("firstErrorField", () => {
  it("devolve o primeiro campo com erro, na ordem do passo", () => {
    expect(
      firstErrorField(1, { email: "x", password: "y", whatsapp: "z" }),
    ).toBe("email");
    expect(firstErrorField(2, { neighborhood: "x", cep: "y" })).toBe("cep");
    expect(firstErrorField(3, {})).toBeNull();
  });
});

describe("rascunho local (localStorage)", () => {
  beforeEach(() => {
    clearSignupDraft();
  });

  it("salva e restaura valores + passo", () => {
    saveSignupDraft(validStep2, 2);
    const draft = loadSignupDraft();
    expect(draft?.step).toBe(2);
    expect(draft?.values.cep).toBe("28979-129");
    expect(draft?.values.street).toBe("Av. Getúlio Vargas");
  });

  it("sem rascunho, devolve null", () => {
    expect(loadSignupDraft()).toBeNull();
  });

  it("passo inválido volta para 1", () => {
    localStorage.setItem(SIGNUP_DRAFT_KEY, JSON.stringify({ values: validStep1, step: 9 }));
    expect(loadSignupDraft()?.step).toBe(1);
  });

  it("rascunho corrompido não quebra", () => {
    localStorage.setItem(SIGNUP_DRAFT_KEY, "{corrompido");
    expect(loadSignupDraft()).toBeNull();
  });

  it("apagar remove o rascunho", () => {
    saveSignupDraft(validStep1, 1);
    clearSignupDraft();
    expect(loadSignupDraft()).toBeNull();
  });
});
