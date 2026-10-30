import { describe, it, expect } from "vitest";
import {
  isValidClaimEmail,
  isValidClaimPassword,
  isGuestEmail,
  validateClaimForm,
} from "../claimValidation";

describe("isValidClaimEmail", () => {
  it("aceita e-mail comum", () => {
    expect(isValidClaimEmail("cliente@example.com")).toBe(true);
  });
  it("aceita e-mail com subdomínio e +", () => {
    expect(isValidClaimEmail("nome+tag@mail.example.com.br")).toBe(true);
  });
  it("rejeita sem @, sem domínio e vazio", () => {
    expect(isValidClaimEmail("sem-arroba")).toBe(false);
    expect(isValidClaimEmail("a@b")).toBe(false);
    expect(isValidClaimEmail("")).toBe(false);
    expect(isValidClaimEmail("a @b.com")).toBe(false);
  });
  it("ignora espaços nas bordas", () => {
    expect(isValidClaimEmail("  cliente@example.com  ")).toBe(true);
  });
});

describe("isValidClaimPassword", () => {
  it("aceita 6 ou mais caracteres", () => {
    expect(isValidClaimPassword("123456")).toBe(true);
    expect(isValidClaimPassword("SenhaForte123!")).toBe(true);
  });
  it("rejeita menos de 6 caracteres", () => {
    expect(isValidClaimPassword("12345")).toBe(false);
    expect(isValidClaimPassword("")).toBe(false);
  });
});

describe("isGuestEmail", () => {
  it("reconhece o e-mail sintético de guest", () => {
    expect(isGuestEmail("guest+5514988887777@guest.itasuper.app")).toBe(true);
  });
  it("rejeita conta de verdade, null e undefined", () => {
    expect(isGuestEmail("cliente@example.com")).toBe(false);
    expect(isGuestEmail("guest+5514988887777@example.com")).toBe(false);
    expect(isGuestEmail(null)).toBe(false);
    expect(isGuestEmail(undefined)).toBe(false);
  });
});

describe("validateClaimForm", () => {
  it("retorna null quando está tudo certo", () => {
    expect(validateClaimForm("cliente@example.com", "Senha123", "Senha123")).toBe(null);
  });
  it("prioriza e-mail inválido", () => {
    expect(validateClaimForm("ruim", "123", "diferente")).toBe("invalid_email");
  });
  it("senha fraca antes de divergência", () => {
    expect(validateClaimForm("cliente@example.com", "123", "diferente")).toBe("weak_password");
  });
  it("senhas diferentes", () => {
    expect(validateClaimForm("cliente@example.com", "Senha123", "Outra123")).toBe("password_mismatch");
  });
});
