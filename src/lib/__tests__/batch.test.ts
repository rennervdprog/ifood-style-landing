import { describe, expect, it } from "vitest";
import { chunk } from "../batch";

describe("chunk", () => {
  it("divide uma lista longa em lotes com o tamanho solicitado", () => {
    expect(chunk(["a", "b", "c", "d", "e"], 2)).toEqual([
      ["a", "b"],
      ["c", "d"],
      ["e"],
    ]);
  });

  it("rejeita tamanhos de lote inválidos", () => {
    expect(() => chunk(["a"], 0)).toThrow("inteiro positivo");
  });
});
