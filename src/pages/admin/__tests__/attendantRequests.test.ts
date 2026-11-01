import { describe, expect, it } from "vitest";
import {
  attendantContextLabel,
  attendantWaLink,
  formatAttendantPhone,
} from "../useAttendantRequests";

describe("aviso de atendente — helpers", () => {
  it("monta o link do WhatsApp só com dígitos", () => {
    expect(attendantWaLink("+55 14 99162-4997")).toBe("https://wa.me/5514991624997");
  });

  it("formata o telefone brasileiro", () => {
    expect(formatAttendantPhone("5514991624997")).toBe("(14) 99162-4997");
    expect(formatAttendantPhone("14991624997")).toBe("(14) 99162-4997");
  });

  it("rotula os contextos conhecidos e cai no texto padrão", () => {
    expect(attendantContextLabel("menu")).toContain("menu do WhatsApp");
    expect(attendantContextLabel("palavra_chave")).toContain("atendente");
    expect(attendantContextLabel("desconhecido")).toContain("atendente no WhatsApp");
  });
});
