import { describe, it, expect } from "vitest";
import {
  matrizSignupErrorMessage,
  MATRIZ_SIGNUP_GENERIC_ERROR,
} from "../matrizSignupError";

describe("matrizSignupErrorMessage — item 2b", () => {
  it("deixa passar as mensagens úteis da RPC, verbatim", () => {
    expect(
      matrizSignupErrorMessage({ message: "Você só pode criar uma rede para você mesmo." }),
    ).toBe("Você só pode criar uma rede para você mesmo.");
    expect(
      matrizSignupErrorMessage({ message: "Sessão expirada. Entre novamente para criar a rede." }),
    ).toBe("Sessão expirada. Entre novamente para criar a rede.");
    expect(
      matrizSignupErrorMessage({
        message: "A loja-matriz escolhida não pertence a este usuário ou já está em outra rede.",
      }),
    ).toBe("A loja-matriz escolhida não pertence a este usuário ou já está em outra rede.");
    expect(
      matrizSignupErrorMessage({
        message: "Não é possível transformar em matriz uma loja que já possui pedidos ou produtos.",
      }),
    ).toBe("Não é possível transformar em matriz uma loja que já possui pedidos ou produtos.");
  });

  it("aceita a mensagem conhecida com espaços ao redor", () => {
    expect(
      matrizSignupErrorMessage({ message: "  Sessão expirada. Entre novamente para criar a rede.\n" }),
    ).toBe("Sessão expirada. Entre novamente para criar a rede.");
  });

  it("não vaza detalhe interno do Postgres", () => {
    expect(
      matrizSignupErrorMessage({
        message:
          'duplicate key value violates unique constraint "store_networks_matriz_store_id_unique"',
      }),
    ).toBe(MATRIZ_SIGNUP_GENERIC_ERROR);
    expect(
      matrizSignupErrorMessage({ message: "null value in column \"name\" violates not-null constraint" }),
    ).toBe(MATRIZ_SIGNUP_GENERIC_ERROR);
  });

  it("não mostra erro de transporte em inglês", () => {
    expect(matrizSignupErrorMessage({ message: "Failed to fetch" })).toBe(
      MATRIZ_SIGNUP_GENERIC_ERROR,
    );
    expect(matrizSignupErrorMessage({ message: "Network request failed" })).toBe(
      MATRIZ_SIGNUP_GENERIC_ERROR,
    );
  });

  it("mensagens curtas da RPC caem na genérica", () => {
    expect(matrizSignupErrorMessage({ message: "Não autenticado." })).toBe(
      MATRIZ_SIGNUP_GENERIC_ERROR,
    );
    expect(matrizSignupErrorMessage({ message: "Usuário não encontrado." })).toBe(
      MATRIZ_SIGNUP_GENERIC_ERROR,
    );
  });

  it("erro sem mensagem, vazio ou nulo cai na genérica", () => {
    expect(matrizSignupErrorMessage({})).toBe(MATRIZ_SIGNUP_GENERIC_ERROR);
    expect(matrizSignupErrorMessage({ message: "" })).toBe(MATRIZ_SIGNUP_GENERIC_ERROR);
    expect(matrizSignupErrorMessage({ message: "   " })).toBe(MATRIZ_SIGNUP_GENERIC_ERROR);
    expect(matrizSignupErrorMessage(null)).toBe(MATRIZ_SIGNUP_GENERIC_ERROR);
    expect(matrizSignupErrorMessage(undefined)).toBe(MATRIZ_SIGNUP_GENERIC_ERROR);
    expect(matrizSignupErrorMessage(new Error())).toBe(MATRIZ_SIGNUP_GENERIC_ERROR);
  });
});
