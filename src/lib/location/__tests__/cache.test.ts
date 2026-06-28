import { describe, it, expect, beforeEach } from "vitest";
import { cacheGet, cacheSet, cacheClear, TTL } from "../cache";

describe("location/cache", () => {
  beforeEach(() => {
    cacheClear();
    try { sessionStorage.clear(); } catch { /* noop */ }
  });

  it("retorna null quando vazio", () => {
    expect(cacheGet("x")).toBeNull();
  });

  it("guarda e recupera valor em memória", () => {
    cacheSet("k", { a: 1 }, 1000);
    expect(cacheGet<{ a: number }>("k")).toEqual({ a: 1 });
  });

  it("expira após TTL", async () => {
    cacheSet("k", "v", 5);
    await new Promise((r) => setTimeout(r, 10));
    expect(cacheGet("k")).toBeNull();
  });

  it("persiste em sessionStorage quando opts.persist=true", () => {
    cacheSet("p", 42, 60_000, { persist: true });
    cacheClear(); // limpa só memória
    expect(cacheGet<number>("p", { persist: true })).toBe(42);
  });

  it("cacheClear com prefixo só limpa o prefixo", () => {
    cacheSet("a:1", 1, 60_000);
    cacheSet("b:1", 2, 60_000);
    cacheClear("a:");
    expect(cacheGet("a:1")).toBeNull();
    expect(cacheGet("b:1")).toBe(2);
  });

  it("TTLs documentados existem", () => {
    expect(TTL.gps).toBeGreaterThan(0);
    expect(TTL.cep).toBeGreaterThan(TTL.gps);
  });
});