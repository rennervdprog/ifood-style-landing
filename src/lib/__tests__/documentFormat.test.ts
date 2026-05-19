import { describe, it, expect } from "vitest";
import { sanitizeDocument, validateDocument } from "@/lib/documentFormat";

describe("sanitizeDocument", () => {
  it("remove tudo que não for dígito", () => {
    expect(sanitizeDocument("123.456.789-01")).toBe("12345678901");
    expect(sanitizeDocument("12.345.678/0001-99")).toBe("12345678000199");
    expect(sanitizeDocument("abc")).toBe("");
  });
});

describe("validateDocument", () => {
  it("aceita CPF (11) e CNPJ (14)", () => {
    expect(validateDocument("123.456.789-01")).toBe(true);
    expect(validateDocument("12.345.678/0001-99")).toBe(true);
  });
  it("rejeita tamanhos inválidos", () => {
    expect(validateDocument("")).toBe(false);
    expect(validateDocument("123")).toBe(false);
    expect(validateDocument("1".repeat(20))).toBe(false);
  });
});