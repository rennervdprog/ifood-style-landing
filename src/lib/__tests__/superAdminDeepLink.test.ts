import { describe, it, expect } from "vitest";
import {
  parseSuperAdminDeepLink,
  buildSuperAdminDeepLink,
} from "@/lib/superAdminDeepLink";

describe("parseSuperAdminDeepLink", () => {
  it("sem params -> dashboard", () => {
    expect(parseSuperAdminDeepLink("")).toEqual({ tab: "dashboard" });
    expect(parseSuperAdminDeepLink("?")).toEqual({ tab: "dashboard" });
  });

  it("aba válida com seção válida", () => {
    expect(parseSuperAdminDeepLink("?aba=financeiro&secao=saques")).toEqual({
      tab: "financeiro",
      financeSection: "saques",
    });
    expect(parseSuperAdminDeepLink("?aba=stores&secao=cidades")).toEqual({
      tab: "stores",
      storesSection: "cidades",
    });
    expect(parseSuperAdminDeepLink("?aba=atrasados")).toEqual({ tab: "atrasados" });
  });

  it("aba antiga (legada) mapeia para a consolidada", () => {
    expect(parseSuperAdminDeepLink("?aba=saques")).toEqual({
      tab: "financeiro",
      financeSection: "saques",
    });
    expect(parseSuperAdminDeepLink("?aba=pagamentos")).toEqual({
      tab: "financeiro",
      financeSection: "areceber",
    });
    expect(parseSuperAdminDeepLink("?aba=cidades")).toEqual({
      tab: "stores",
      storesSection: "cidades",
    });
    expect(parseSuperAdminDeepLink("?aba=logs")).toEqual({
      tab: "auditoria",
      auditoriaSection: "logs",
    });
  });

  it("aba inválida -> dashboard; seção inválida para a aba é ignorada", () => {
    expect(parseSuperAdminDeepLink("?aba=inexistente")).toEqual({ tab: "dashboard" });
    expect(parseSuperAdminDeepLink("?aba=financeiro&secao=inexistente")).toEqual({
      tab: "financeiro",
    });
    expect(parseSuperAdminDeepLink("?aba=dashboard&secao=saques")).toEqual({
      tab: "dashboard",
    });
  });
});

describe("buildSuperAdminDeepLink", () => {
  it("omite a seção quando é a padrão da aba", () => {
    expect(buildSuperAdminDeepLink({ tab: "dashboard" })).toBe("?aba=dashboard");
    expect(
      buildSuperAdminDeepLink({ tab: "financeiro", financeSection: "consolidado" }),
    ).toBe("?aba=financeiro");
    expect(
      buildSuperAdminDeepLink({ tab: "stores", storesSection: "lojas" }),
    ).toBe("?aba=stores");
  });

  it("inclui a seção quando não é a padrão", () => {
    expect(
      buildSuperAdminDeepLink({ tab: "financeiro", financeSection: "saques" }),
    ).toBe("?aba=financeiro&secao=saques");
    expect(
      buildSuperAdminDeepLink({ tab: "auditoria", auditoriaSection: "logs" }),
    ).toBe("?aba=auditoria&secao=logs");
  });

  it("Fase 2 — as seções resgatadas têm deep link", () => {
    expect(parseSuperAdminDeepLink("?aba=financeiro&secao=repasses-falha")).toEqual({
      tab: "financeiro",
      financeSection: "repasses-falha",
    });
    expect(parseSuperAdminDeepLink("?aba=financeiro&secao=comissoes")).toEqual({
      tab: "financeiro",
      financeSection: "comissoes",
    });
    expect(
      buildSuperAdminDeepLink({ tab: "financeiro", financeSection: "repasses-falha" }),
    ).toBe("?aba=financeiro&secao=repasses-falha");
    expect(
      buildSuperAdminDeepLink({ tab: "financeiro", financeSection: "comissoes" }),
    ).toBe("?aba=financeiro&secao=comissoes");
  });

  it("round-trip: parse(build(x)) preserva aba e seção", () => {
    const cases = [
      { tab: "financeiro", financeSection: "conciliacao" },
      { tab: "stores", storesSection: "entrega" },
      { tab: "app-page", appPageSection: "links" },
      { tab: "auditoria", auditoriaSection: "debug-loja" },
      { tab: "atrasados" },
      { tab: "financeiro", financeSection: "repasses-falha" },
      { tab: "financeiro", financeSection: "comissoes" },
    ] as const;
    for (const c of cases) {
      const built = buildSuperAdminDeepLink(c);
      expect(parseSuperAdminDeepLink(built)).toEqual(c);
    }
  });
});
