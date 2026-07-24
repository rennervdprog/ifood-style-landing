import { describe, it, expect } from "vitest";
import { resolveUserRouting } from "@/hooks/useUserRouting";

describe("resolveUserRouting", () => {
  it("admin → /super-admin", () => {
    const r = resolveUserRouting({ adminRow: { role: "admin" } });
    expect(r.isAdmin).toBe(true);
    expect(r.homeRoute).toBe("/super-admin");
  });

  it("lojista delivery → /admin", () => {
    const r = resolveUserRouting({
      profile: { role: "lojista", is_approved: true },
      ownedStore: { id: "s1", slug: "lanches" },
      storePlanType: "commission_only",
    });
    expect(r.isLojista).toBe(true);
    expect(r.isPdvOnly).toBe(false);
    expect(r.homeRoute).toBe("/admin");
  });

  it("lojista pdv_only → /admin/pdv (sem passar por /admin)", () => {
    const r = resolveUserRouting({
      profile: { role: "lojista", is_approved: true },
      ownedStore: { id: "s1", slug: "loja" },
      storePlanType: "pdv_only",
    });
    expect(r.homeRoute).toBe("/admin/pdv");
    expect(r.isPdvOnly).toBe(true);
  });

  it("lojista_matriz via network fallback → /matriz", () => {
    const r = resolveUserRouting({
      matrizNetwork: { id: "n1", is_approved: true },
    });
    expect(r.isMatriz).toBe(true);
    expect(r.homeRoute).toBe("/matriz");
  });

  it("motoboy via drivers → /entregador", () => {
    const r = resolveUserRouting({ driver: { user_id: "u1", is_active: true } });
    expect(r.isMotoboy).toBe(true);
    expect(r.homeRoute).toBe("/entregador");
  });

  it("motoboy via store_drivers fallback → /entregador", () => {
    const r = resolveUserRouting({ storeDriver: { id: "sd1" } });
    expect(r.isMotoboy).toBe(true);
    expect(r.homeRoute).toBe("/entregador");
  });

  it("reseller (sem role parceiro) → /revendedor", () => {
    const r = resolveUserRouting({ reseller: { id: "r1" } });
    expect(r.isReseller).toBe(true);
    expect(r.homeRoute).toBe("/revendedor");
  });

  it("cliente explícito → /cliente", () => {
    const r = resolveUserRouting({ profile: { role: "cliente" } });
    expect(r.homeRoute).toBe("/cliente");
  });

  it("usuário sem sinais → /cliente (default seguro)", () => {
    const r = resolveUserRouting({});
    expect(r.homeRoute).toBe("/cliente");
  });

  it("admin tem precedência sobre outros roles", () => {
    const r = resolveUserRouting({
      adminRow: { role: "admin" },
      profile: { role: "lojista", is_approved: true },
      ownedStore: { id: "s1", slug: "x" },
      storePlanType: "pdv_only",
    });
    expect(r.homeRoute).toBe("/super-admin");
  });
});