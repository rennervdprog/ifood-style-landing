// Fase 6D Opção A2 — o helper do front só monta a chamada (fetch direto,
// para ler o corpo do erro mesmo em 4xx) e normaliza o telefone. As edges
// em si são validadas ao vivo nas cópias -teste (ver PR).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { callClaimFunction, normalizeClaimPhone } from "../claimAccount";

describe("normalizeClaimPhone", () => {
  it("aceita DDD + número com máscara e prefixa 55", () => {
    expect(normalizeClaimPhone("(14) 98888-5555")).toBe("5514988885555");
  });

  it("aceita número já com 55 e máscara", () => {
    expect(normalizeClaimPhone("+55 (14) 98888-5555")).toBe("5514988885555");
  });

  it("rejeita número curto demais", () => {
    expect(normalizeClaimPhone("99888")).toBeNull();
    expect(normalizeClaimPhone("")).toBeNull();
  });
});

describe("callClaimFunction", () => {
  const fetchMock = vi.fn();
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("devolve status + JSON mesmo quando a edge responde 4xx", async () => {
    fetchMock.mockResolvedValue({
      status: 429,
      json: async () => ({ error: "rate_limited", retry_after_seconds: 3600 }),
    });
    const res = await callClaimFunction<{ error: string; retry_after_seconds: number }>(
      "claim-send-otp",
      { phone: "5514988885555", guest_user_id: "guest-id" },
    );
    expect(res.status).toBe(429);
    expect(res.data.error).toBe("rate_limited");
    expect(res.data.retry_after_seconds).toBe(3600);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/functions/v1/claim-send-otp");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body)).phone).toBe("5514988885555");
  });

  it("devolve corpo vazio quando a resposta não é JSON", async () => {
    fetchMock.mockResolvedValue({ status: 500, json: async () => { throw new Error("bad json"); } });
    const res = await callClaimFunction("claim-check", { phone: "5514988885555" });
    expect(res.status).toBe(500);
    expect(res.data).toEqual({});
  });
});
