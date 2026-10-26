import { describe, expect, it } from "vitest";
import { isPixDiretoAvailable } from "../pixDiretoAvailability";

describe("isPixDiretoAvailable (Fase 5 — Pix Direto sem ver a chave)", () => {
  it("habilitado + configurado → oferece", () => {
    expect(isPixDiretoAvailable({ pix_direto_enabled: true, pix_direto_key_configured: true })).toBe(true);
  });

  it("habilitado mas sem chave configurada → não oferece", () => {
    expect(isPixDiretoAvailable({ pix_direto_enabled: true, pix_direto_key_configured: false })).toBe(false);
    expect(isPixDiretoAvailable({ pix_direto_enabled: true })).toBe(false);
  });

  it("desabilitado → não oferece mesmo com chave configurada", () => {
    expect(isPixDiretoAvailable({ pix_direto_enabled: false, pix_direto_key_configured: true })).toBe(false);
  });

  it("loja nula → não oferece", () => {
    expect(isPixDiretoAvailable(null)).toBe(false);
    expect(isPixDiretoAvailable(undefined)).toBe(false);
  });
});
