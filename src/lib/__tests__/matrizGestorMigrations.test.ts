/**
 * Testes ESTÁTICOS da migration do Painel Matriz Gestor (2026-10-29).
 *
 * Mesmo padrão das Fases 1–4b: sem banco local, o teste garante que o
 * SQL contém as RPCs, as checagens de dono e os grants esperados — e
 * nenhum DELETE/UPDATE destrutivo fora do escopo das próprias RPCs.
 * O comportamento real só é verificável quando a migration for aplicada
 * (com a palavra do Renner).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");
const sql = readFileSync(join(MIGRATIONS_DIR, "20261029100000_matriz_gestor_rpcs.sql"), "utf8");

describe("matriz gestor — RPCs", () => {
  it("cria as 4 funções do Gestor como SECURITY DEFINER", () => {
    for (const fn of [
      "get_network_monthly_fee",
      "set_network_unit_paused",
      "set_network_delivery_fee",
      "apply_network_opening_hours",
    ]) {
      expect(sql).toContain(`FUNCTION public.${fn}`);
    }
    expect(sql.match(/SECURITY DEFINER/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("todas conferem o dono da rede ou admin antes de agir", () => {
    expect(sql.match(/is_platform_admin/g)?.length).toBeGreaterThanOrEqual(4);
    expect(sql).toContain("owner_id <> _caller_id");
    expect(sql).toContain("auth.uid()");
  });

  it("o wrapper de mensalidade delega para calculate_network_monthly_fee", () => {
    expect(sql).toContain("RETURN public.calculate_network_monthly_fee(_network_id);");
  });

  it("pausa individual respeita a pausa da rede e não pausa a loja-guia", () => {
    expect(sql).toContain("is_matriz");
    expect(sql).toContain("A rede está pausada");
    expect(sql).toContain("force_closed = _paused");
  });

  it("grants: nada para PUBLIC/anon; authenticated e service_role sim", () => {
    for (const fn of [
      "get_network_monthly_fee(uuid)",
      "set_network_unit_paused(uuid, boolean)",
      "set_network_delivery_fee(uuid, numeric)",
      "apply_network_opening_hours(uuid, uuid)",
    ]) {
      expect(sql).toContain(`REVOKE EXECUTE ON FUNCTION public.${fn} FROM PUBLIC, anon;`);
      expect(sql).toContain(`GRANT EXECUTE ON FUNCTION public.${fn} TO authenticated, service_role;`);
    }
  });

  it("não liga flag de cobrança nem altera mensalidades", () => {
    expect(sql).not.toContain("billing_enabled");
    expect(sql).not.toContain("monthly_fee =");
    expect(sql).not.toMatch(/DELETE FROM public\.stores/);
    expect(sql).not.toMatch(/DROP TABLE/);
  });
});
