import { describe, it, expect } from "vitest";
import { formatCep } from "../cep";

describe("formatCep", () => {
  it("formata 8 dígitos com hífen", () => {
    expect(formatCep("01310100")).toBe("01310-100");
  });
  it("não adiciona hífen com <=5 dígitos", () => {
    expect(formatCep("013")).toBe("013");
    expect(formatCep("01310")).toBe("01310");
  });
  it("ignora não-dígitos e trunca em 8", () => {
    expect(formatCep("abc01310-100xyz99")).toBe("01310-100");
  });
  it("string vazia retorna vazio", () => {
    expect(formatCep("")).toBe("");
  });
});