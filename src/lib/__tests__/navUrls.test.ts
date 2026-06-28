import { describe, it, expect, beforeEach } from "vitest";
import {
  buildFullAddress,
  buildWazeUrl,
  buildGoogleMapsUrl,
  buildGoogleMapsMultiStopUrl,
  buildPreferredNavUrl,
  getPreferredNavigator,
  setPreferredNavigator,
} from "../navUrls";

describe("buildFullAddress", () => {
  it("monta endereço completo com street+number", () => {
    const s = buildFullAddress({
      street: "Rua Augusta",
      number: "100",
      neighborhood: "Consolação",
      city: "São Paulo",
      state: "SP",
      cep: "01310-100",
    });
    expect(s).toContain("Rua Augusta, 100");
    expect(s).toContain("São Paulo");
    expect(s).toContain("CEP 01310-100");
    expect(s).toContain("Brasil");
  });

  it("usa fallbackAddress quando não há street", () => {
    const s = buildFullAddress({ fallbackAddress: "Av X 42", city: "Itatinga", state: "SP" });
    expect(s).toContain("Av X 42");
    expect(s).toContain("Itatinga");
  });
});

describe("buildWazeUrl / buildGoogleMapsUrl", () => {
  it("Waze usa ll= quando há coords válidas", () => {
    const u = buildWazeUrl({ lat: -23.5, lng: -46.6, street: "x" });
    expect(u).toContain("ll=-23.5,-46.6");
    expect(u).toContain("navigate=yes");
  });
  it("Waze usa q= quando não há coords", () => {
    const u = buildWazeUrl({ street: "Rua A", number: "1", city: "SP", state: "SP" });
    expect(u).toContain("q=");
    expect(u).not.toContain("ll=");
  });
  it("Google Maps usa query= com coords", () => {
    const u = buildGoogleMapsUrl({ lat: -23.5, lng: -46.6 });
    expect(u).toContain("query=-23.5,-46.6");
  });
  it("coords inválidas (0,0) caem no fallback texto", () => {
    const u = buildWazeUrl({ lat: 0, lng: 0, street: "Rua A", city: "SP", state: "SP" });
    expect(u).toContain("q=");
  });
});

describe("buildGoogleMapsMultiStopUrl", () => {
  const stop = (n: number) => ({ lat: -23.5 - n / 100, lng: -46.6 - n / 100 });

  it("lista vazia retorna URL base", () => {
    expect(buildGoogleMapsMultiStopUrl([])).toBe("https://www.google.com/maps");
  });

  it("1 parada vira destination, sem waypoints", () => {
    const u = buildGoogleMapsMultiStopUrl([stop(1)]);
    expect(u).toContain("destination=-23.51,-46.61");
    expect(u).not.toContain("waypoints=");
  });

  it("2 paradas: 1 waypoint + destination", () => {
    const u = buildGoogleMapsMultiStopUrl([stop(1), stop(2)]);
    expect(u).toContain("waypoints=-23.51,-46.61");
    expect(u).toContain("destination=-23.52,-46.62");
  });

  it("inclui origin quando fornecido", () => {
    const u = buildGoogleMapsMultiStopUrl([stop(1)], { lat: -23.0, lng: -46.0 });
    expect(u).toContain("origin=-23,-46");
  });

  it("limita em 10 paradas (9 waypoints + 1 dest)", () => {
    const many = Array.from({ length: 15 }, (_, i) => stop(i + 1));
    const u = buildGoogleMapsMultiStopUrl(many);
    const wp = new URL(u).searchParams.get("waypoints") || "";
    expect(wp.split("|").length).toBe(9);
  });

  it("mescla coords e endereço texto", () => {
    const u = buildGoogleMapsMultiStopUrl([
      { lat: -23.5, lng: -46.6 },
      { street: "Rua B", city: "SP", state: "SP" },
    ]);
    expect(u).toContain("waypoints=-23.5,-46.6");
    expect(u).toContain("destination=");
    expect(decodeURIComponent(u)).toContain("Rua B");
  });
});

describe("preferência de navegador", () => {
  beforeEach(() => { try { localStorage.clear(); } catch { /* noop */ } });

  it("padrão é waze", () => {
    expect(getPreferredNavigator()).toBe("waze");
  });
  it("persiste escolha google", () => {
    setPreferredNavigator("google");
    expect(getPreferredNavigator()).toBe("google");
  });
  it("buildPreferredNavUrl respeita override", () => {
    setPreferredNavigator("waze");
    const u = buildPreferredNavUrl({ lat: -23.5, lng: -46.6 }, "google");
    expect(u).toContain("google.com/maps");
  });
});