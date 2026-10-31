import { describe, it, expect } from "vitest";
import { getFunctionErrorMessage } from "../functionError";

// O supabase-js transforma qualquer não-2xx de Edge Function num erro
// genérico ("Edge Function returned a non-2xx status code"); o motivo
// real volta no corpo JSON, acessível em error.context (a Response).
// Foi esse engolir de mensagem que transformou um "Sessão inválida" /
// "Sem permissão" na ativação do PDV em "retornou edge function" na
// tela do lojista (reunião Cantinho Do Tempero, 2026-10-31).

function httpError(body: unknown, opts?: { jsonThrows?: boolean }) {
  return Object.assign(new Error("Edge Function returned a non-2xx status code"), {
    context: {
      clone: () => ({
        json: async () => {
          if (opts?.jsonThrows) throw new Error("not json");
          return body;
        },
      }),
    },
  });
}

describe("getFunctionErrorMessage", () => {
  it("extrai o motivo real do corpo da função (401 Sessão inválida)", async () => {
    const msg = await getFunctionErrorMessage(httpError({ error: "Sessão inválida." }), "fallback");
    expect(msg).toBe("Sessão inválida.");
  });

  it("extrai o motivo real do corpo da função (403 Sem permissão)", async () => {
    const msg = await getFunctionErrorMessage(httpError({ error: "Sem permissão." }), "fallback");
    expect(msg).toBe("Sem permissão.");
  });

  it("corpo sem campo error → fallback (não vaza a mensagem genérica)", async () => {
    const msg = await getFunctionErrorMessage(httpError({ code: "BOOT_ERROR" }), "fallback");
    expect(msg).toBe("fallback");
  });

  it("corpo não-JSON → fallback", async () => {
    const msg = await getFunctionErrorMessage(httpError(null, { jsonThrows: true }), "fallback");
    expect(msg).toBe("fallback");
  });

  it("erro comum com mensagem própria (rede/fetch) → usa a mensagem", async () => {
    const msg = await getFunctionErrorMessage(new Error("Failed to fetch"), "fallback");
    expect(msg).toBe("Failed to fetch");
  });

  it("erro genérico sem context → fallback", async () => {
    const msg = await getFunctionErrorMessage(
      new Error("Edge Function returned a non-2xx status code"),
      "fallback",
    );
    expect(msg).toBe("fallback");
  });

  it("erro nulo/indefinido → fallback", async () => {
    expect(await getFunctionErrorMessage(null, "fallback")).toBe("fallback");
    expect(await getFunctionErrorMessage(undefined, "fallback")).toBe("fallback");
  });
});
