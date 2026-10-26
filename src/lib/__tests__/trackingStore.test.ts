import { describe, expect, it } from "vitest";
import {
  TRACKING_STORE_COLUMNS,
  composeTrackingStore,
  type TrackingStoreRow,
} from "../trackingStore";

const STORE_ROW: TrackingStoreRow = {
  name: "Loja Demonstração",
  slug: "pdv-teste-fase-1-2",
  pix_direto_enabled: true,
  pix_direto_key: "teste-fix-rastreio",
  pix_direto_key_type: "telefone",
  pix_direto_beneficiary: "Loja Teste",
  pix_direto_instructions: "Pague e envie o comprovante.",
};

describe("TRACKING_STORE_COLUMNS", () => {
  it("não pede whatsapp_number em stores (a coluna não existe — era o bug)", () => {
    expect(TRACKING_STORE_COLUMNS).not.toContain("whatsapp_number");
  });

  it("pede nome, slug e os campos do Pix Direto", () => {
    for (const col of [
      "name",
      "slug",
      "pix_direto_enabled",
      "pix_direto_key",
      "pix_direto_key_type",
      "pix_direto_beneficiary",
      "pix_direto_instructions",
    ]) {
      expect(TRACKING_STORE_COLUMNS).toContain(col);
    }
  });
});

describe("composeTrackingStore", () => {
  it("devolve nome, chave Pix e o WhatsApp conectado da loja", () => {
    const store = composeTrackingStore(STORE_ROW, { phone_number: "5522992796291" });
    expect(store).not.toBeNull();
    expect(store?.name).toBe("Loja Demonstração");
    expect(store?.pix_direto_key).toBe("teste-fix-rastreio");
    expect(store?.whatsapp_number).toBe("5522992796291");
  });

  it("sem WhatsApp conectado, whatsapp_number é null e o resto continua", () => {
    const store = composeTrackingStore(STORE_ROW, null);
    expect(store?.name).toBe("Loja Demonstração");
    expect(store?.pix_direto_key).toBe("teste-fix-rastreio");
    expect(store?.whatsapp_number).toBeNull();
  });

  it("config sem número também vira null", () => {
    const store = composeTrackingStore(STORE_ROW, { phone_number: null });
    expect(store?.whatsapp_number).toBeNull();
  });

  it("sem linha da loja, devolve null", () => {
    expect(composeTrackingStore(null, { phone_number: "5522992796291" })).toBeNull();
  });
});
