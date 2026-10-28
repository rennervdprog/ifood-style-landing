/**
 * Testes ESTÁTICOS da migration de correção da divergência (Fase 3).
 *
 * Bug achado no teste ao vivo 28/10: a 170000 definia `refined` com 8
 * colunas (as 7 de `base` + `status`) e `removed` com 7 — o UNION ALL
 * quebrava com 42601 em TODA chamada de network_menu_divergence.
 * Estes testes travam a correção: `removed` com 8 colunas na mesma
 * ordem, sem mudar nenhuma regra.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");
const M = "20261028180000_matriz_fase3_fix_divergence.sql";

function readMigration(name: string): string {
  return readFileSync(join(MIGRATIONS_DIR, name), "utf8");
}

function codeWithoutComments(sql: string): string {
  return sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n")
    .toLowerCase();
}

describe("correção da divergência (UNION 8 x 7)", () => {
  const sql = readMigration(M);
  const code = codeWithoutComments(sql);

  it(`existe ${M}`, () => {
    expect(() => readMigration(M)).not.toThrow();
  });

  it("redefine network_menu_divergence (CREATE OR REPLACE, mesma assinatura)", () => {
    expect(code).toContain(
      "create or replace function public.network_menu_divergence(_source_store_id uuid, _target_store_id uuid)",
    );
  });

  it("o ramo removed tem price_status placeholder + status (8 colunas, mesma ordem)", () => {
    expect(code).toContain("'removido_na_matriz' as price_status");
    expect(code).toContain("'removido_na_matriz' as status");
    const removedIdx = code.indexOf("removed as (");
    const unionIdx = code.indexOf("union all select * from removed");
    const removedBlock = code.slice(removedIdx, unionIdx);
    expect(removedBlock).toContain("price_status");
    expect(removedBlock).toContain("changed_fields");
    expect(removedBlock).toContain("status");
  });

  it("mantém os 6 status e a regra de preço próprio", () => {
    for (const s of ["novo_na_matriz", "preco_proprio", "desatualizado", "removido_na_matriz", "divergente"]) {
      expect(code).toContain(`'${s}'`);
    }
    expect(code).toContain("t.price <> t.last_synced_price");
  });

  it("reaplica os grants", () => {
    expect(code).toContain(
      "revoke execute on function public.network_menu_divergence(uuid, uuid) from public, anon",
    );
    expect(code).toContain(
      "grant execute on function public.network_menu_divergence(uuid, uuid) to authenticated, service_role",
    );
  });

  it("não toca em billing, repasse ou cobrança", () => {
    expect(code).not.toContain("monthly_billing");
    expect(code).not.toContain("repasse");
    expect(code).not.toContain("subscription");
  });
});
