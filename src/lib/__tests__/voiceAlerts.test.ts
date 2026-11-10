import { describe, it, expect } from "vitest";
import { moneyToSpeech, newOrderSpeech, attendantSpeech } from "../voiceAlerts";

describe("moneyToSpeech", () => {
  it("valor redondo fala só os reais", () => {
    expect(moneyToSpeech(45)).toBe("45 reais");
  });

  it("valor com centavos fala reais e centavos", () => {
    expect(moneyToSpeech(45.9)).toBe("45 reais e 90 centavos");
  });

  it("arredonda os centavos como o caixa faz", () => {
    expect(moneyToSpeech(19.99)).toBe("19 reais e 99 centavos");
    expect(moneyToSpeech(0.29)).toBe("29 centavos");
  });

  it("singular de real e centavo", () => {
    expect(moneyToSpeech(1)).toBe("1 real");
    expect(moneyToSpeech(1.01)).toBe("1 real e 1 centavo");
  });

  it("zero fala 0 reais", () => {
    expect(moneyToSpeech(0)).toBe("0 reais");
  });
});

describe("newOrderSpeech", () => {
  it("com número e total monta a frase completa", () => {
    expect(newOrderSpeech(12, 45.9)).toBe(
      "Novo pedido! Pedido número 12. Total de 45 reais e 90 centavos.",
    );
  });

  it("sem número e sem total fala só o aviso", () => {
    expect(newOrderSpeech(null, null)).toBe("Novo pedido!");
    expect(newOrderSpeech(undefined, undefined)).toBe("Novo pedido!");
  });

  it("só com número omite o total", () => {
    expect(newOrderSpeech(7, null)).toBe("Novo pedido! Pedido número 7.");
  });
});

describe("attendantSpeech", () => {
  it("frase fixa do atendimento no WhatsApp", () => {
    expect(attendantSpeech()).toBe("Cliente solicitando atendimento no WhatsApp.");
  });
});
