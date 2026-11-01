import { describe, it, expect } from "vitest";
import { isValidGoogleReviewUrl, googleReviewUrlFromSettings } from "../googleReview";

describe("isValidGoogleReviewUrl", () => {
  it("aceita os formatos do Perfil da Empresa do Google", () => {
    expect(isValidGoogleReviewUrl("https://g.page/r/Cabc123/review")).toBe(true);
    expect(isValidGoogleReviewUrl("https://search.google.com/local/writereview?placeid=ChIJ123")).toBe(true);
    expect(isValidGoogleReviewUrl("https://maps.app.goo.gl/xyzAbc")).toBe(true);
    expect(isValidGoogleReviewUrl("https://www.google.com/maps/place/Loja/@-22.8,-42.3")).toBe(true);
  });

  it("rejeita vazio, sem https e domínios de terceiros", () => {
    expect(isValidGoogleReviewUrl("")).toBe(false);
    expect(isValidGoogleReviewUrl("   ")).toBe(false);
    expect(isValidGoogleReviewUrl("g.page/r/Cabc123/review")).toBe(false);
    expect(isValidGoogleReviewUrl("http://g.page/r/Cabc123/review")).toBe(false);
    expect(isValidGoogleReviewUrl("https://evil.com/g.page/r/x")).toBe(false);
    expect(isValidGoogleReviewUrl("https://g.page.evil.com/r/x")).toBe(false);
    expect(isValidGoogleReviewUrl("não é url")).toBe(false);
  });
});

describe("googleReviewUrlFromSettings", () => {
  it("extrai o link válido e normaliza espaços", () => {
    expect(
      googleReviewUrlFromSettings({ google_review_url: "  https://g.page/r/Cabc/review  " })
    ).toBe("https://g.page/r/Cabc/review");
  });

  it("devolve vazio quando ausente ou inválido", () => {
    expect(googleReviewUrlFromSettings(null)).toBe("");
    expect(googleReviewUrlFromSettings(undefined)).toBe("");
    expect(googleReviewUrlFromSettings({})).toBe("");
    expect(googleReviewUrlFromSettings({ google_review_url: 42 })).toBe("");
    expect(googleReviewUrlFromSettings({ google_review_url: "https://evil.com/x" })).toBe("");
  });
});
