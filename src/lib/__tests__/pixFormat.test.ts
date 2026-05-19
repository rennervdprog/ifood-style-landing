import { describe, it, expect } from "vitest";
import {
  formatPixKeyDisplay,
  sanitizePixKeyForAsaas,
  validatePixKey,
} from "@/lib/pixFormat";

describe("formatPixKeyDisplay", () => {
  it("formata CPF progressivamente", () => {
    expect(formatPixKeyDisplay("12345678901", "cpf")).toBe("123.456.789-01");
    expect(formatPixKeyDisplay("12345", "cpf")).toBe("123.45");
  });

  it("formata CNPJ completo", () => {
    expect(formatPixKeyDisplay("12345678000199", "cnpj")).toBe("12.345.678/0001-99");
  });

  it("formata telefone DDD + 9 dígitos", () => {
    expect(formatPixKeyDisplay("14991624997", "phone")).toBe("(14) 99162-4997");
  });

  it("normaliza email para minúsculas", () => {
    expect(formatPixKeyDisplay("FOO@BAR.com", "email")).toBe("foo@bar.com");
  });

  it("retorna vazio para input vazio", () => {
    expect(formatPixKeyDisplay("", "cpf")).toBe("");
    expect(formatPixKeyDisplay("   ", "cpf")).toBe("");
  });
});

describe("sanitizePixKeyForAsaas", () => {
  it("CPF/CNPJ vira só dígitos", () => {
    expect(sanitizePixKeyForAsaas("123.456.789-01", "cpf")).toBe("12345678901");
    expect(sanitizePixKeyForAsaas("12.345.678/0001-99", "cnpj")).toBe("12345678000199");
  });

  it("telefone vira +55 + 11 dígitos", () => {
    expect(sanitizePixKeyForAsaas("(14) 99162-4997", "phone")).toBe("+5514991624997");
    expect(sanitizePixKeyForAsaas("5514991624997", "phone")).toBe("+5514991624997");
  });

  it("email vira lowercase", () => {
    expect(sanitizePixKeyForAsaas("Foo@BAR.com", "email")).toBe("foo@bar.com");
  });
});

describe("validatePixKey", () => {
  it("rejeita vazio", () => {
    expect(validatePixKey("", "cpf")).toMatch(/obrigatória/i);
  });

  it("valida CPF com 11 dígitos", () => {
    expect(validatePixKey("123.456.789-01", "cpf")).toBeNull();
    expect(validatePixKey("123", "cpf")).toMatch(/11 dígitos/);
  });

  it("valida CNPJ com 14 dígitos", () => {
    expect(validatePixKey("12.345.678/0001-99", "cnpj")).toBeNull();
    expect(validatePixKey("123", "cnpj")).toMatch(/14 dígitos/);
  });

  it("valida telefone E.164 brasileiro", () => {
    expect(validatePixKey("(14) 99162-4997", "phone")).toBeNull();
    expect(validatePixKey("123", "phone")).toMatch(/inválido/i);
  });

  it("valida email", () => {
    expect(validatePixKey("foo@bar.com", "email")).toBeNull();
    expect(validatePixKey("nao-eh-email", "email")).toMatch(/inválido/i);
  });

  it("valida chave aleatória pelo tamanho mínimo", () => {
    expect(validatePixKey("a".repeat(36), "random")).toBeNull();
    expect(validatePixKey("curto", "random")).toMatch(/inválida/i);
  });
});