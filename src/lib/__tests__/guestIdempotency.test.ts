import { describe, it, expect, beforeEach } from "vitest";
import {
  GUEST_IDEMPOTENCY_KEY_PREFIX,
  guestIdempotencyStorageKey,
  getGuestIdempotencyKey,
  clearGuestIdempotencyKey,
} from "@/lib/guestIdempotency";

// Fase 6B (P2-3): a chave de idempotência do guest vive no sessionStorage,
// uma por loja, e sobrevive à remontagem da página até o pedido confirmar.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STORE_A = "8197bdd8-f041-410d-acc0-af9ecb448f55";
const STORE_B = "11111111-2222-3333-4444-555555555555";

beforeEach(() => {
  sessionStorage.clear();
});

describe("guestIdempotencyStorageKey", () => {
  it("usa o prefixo itasuper_guest_idem:<storeId>", () => {
    expect(guestIdempotencyStorageKey(STORE_A)).toBe(
      `${GUEST_IDEMPOTENCY_KEY_PREFIX}${STORE_A}`,
    );
  });
});

describe("getGuestIdempotencyKey", () => {
  it("gera um UUID válido na primeira chamada", () => {
    expect(getGuestIdempotencyKey(STORE_A)).toMatch(UUID_RE);
  });

  it("reutiliza a mesma chave na segunda chamada (remontagem da página)", () => {
    const first = getGuestIdempotencyKey(STORE_A);
    expect(getGuestIdempotencyKey(STORE_A)).toBe(first);
    expect(sessionStorage.getItem(guestIdempotencyStorageKey(STORE_A))).toBe(first);
  });

  it("gera chaves diferentes para lojas diferentes", () => {
    expect(getGuestIdempotencyKey(STORE_A)).not.toBe(getGuestIdempotencyKey(STORE_B));
  });

  it("descarta valor guardado em branco e gera uma chave nova", () => {
    sessionStorage.setItem(guestIdempotencyStorageKey(STORE_A), "   ");
    expect(getGuestIdempotencyKey(STORE_A)).toMatch(UUID_RE);
  });

  it("sem storeId, devolve um UUID novo (sem persistir nada)", () => {
    const key = getGuestIdempotencyKey(undefined);
    expect(key).toMatch(UUID_RE);
    expect(sessionStorage.length).toBe(0);
  });
});

describe("clearGuestIdempotencyKey", () => {
  it("limpa a chave e a próxima chamada gera outra", () => {
    const first = getGuestIdempotencyKey(STORE_A);
    clearGuestIdempotencyKey(STORE_A);
    expect(sessionStorage.getItem(guestIdempotencyStorageKey(STORE_A))).toBeNull();
    const second = getGuestIdempotencyKey(STORE_A);
    expect(second).toMatch(UUID_RE);
    expect(second).not.toBe(first);
  });

  it("limpa só a loja pedida — a outra chave continua", () => {
    const keyA = getGuestIdempotencyKey(STORE_A);
    const keyB = getGuestIdempotencyKey(STORE_B);
    clearGuestIdempotencyKey(STORE_A);
    expect(getGuestIdempotencyKey(STORE_B)).toBe(keyB);
    expect(getGuestIdempotencyKey(STORE_A)).not.toBe(keyA);
  });

  it("sem storeId, não faz nada (não quebra)", () => {
    expect(() => clearGuestIdempotencyKey(undefined)).not.toThrow();
    expect(() => clearGuestIdempotencyKey(null)).not.toThrow();
  });
});
