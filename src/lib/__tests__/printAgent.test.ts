import { describe, it, expect } from "vitest";
import {
  AUTO_PRINT_SWEEP_STATUSES,
  generatePairingCode,
  pairingExpiryISO,
  printAgentStatus,
} from "../printAgent";

describe("printAgent", () => {
  it("código de pareamento tem sempre 6 dígitos", () => {
    for (let i = 0; i < 50; i++) {
      expect(generatePairingCode()).toMatch(/^\d{6}$/);
    }
  });

  it("expiração do código é 30 min à frente", () => {
    const from = new Date("2026-11-01T10:00:00.000Z");
    expect(pairingExpiryISO(from)).toBe("2026-11-01T10:30:00.000Z");
  });

  it("varredura cobre pendente e preparando (aceite automático não perde a notinha)", () => {
    expect([...AUTO_PRINT_SWEEP_STATUSES]).toEqual(["pendente", "preparando"]);
  });

  it("status do agente: revogado vence qualquer outro estado", () => {
    expect(
      printAgentStatus({ token_hash: "h", last_seen_at: new Date().toISOString(), revoked_at: new Date().toISOString() }),
    ).toBe("revogado");
  });

  it("status do agente: sem token é aguardando pareamento", () => {
    expect(printAgentStatus({ pairing_code: "123456", token_hash: null })).toBe("aguardando");
  });

  it("status do agente: visto há pouco é conectado; há muito, offline", () => {
    const now = new Date("2026-11-01T12:00:00.000Z").getTime();
    expect(printAgentStatus({ token_hash: "h", last_seen_at: "2026-11-01T11:59:30.000Z" }, now)).toBe("conectado");
    expect(printAgentStatus({ token_hash: "h", last_seen_at: "2026-11-01T11:40:00.000Z" }, now)).toBe("offline");
    expect(printAgentStatus({ token_hash: "h", last_seen_at: null }, now)).toBe("offline");
  });
});
