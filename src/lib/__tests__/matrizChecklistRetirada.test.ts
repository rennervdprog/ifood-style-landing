/**
 * Teste ESTÁTICO da migration da exceção do checklist (só-retirada).
 *
 * Mesmo padrão das Fases 1–4: sem infra de banco no repo, garante que o
 * arquivo SQL contém a regra esperada e nenhum comando destrutivo. A prova
 * de verdade (RPC ao vivo + publicação pela UI) fica para a etapa de
 * aplicação, com a palavra do Renner.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATION = "20261117140000_matriz_checklist_retirada_sem_motoboy.sql";
const sql = readFileSync(join(process.cwd(), "supabase", "migrations", MIGRATION), "utf8");
const code = sql
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n")
  .toLowerCase();

describe("migration checklist só-retirada existe e redefine a RPC", () => {
  it("redefine network_unit_checklist com a exceção por delivery_enabled", () => {
    expect(code).toContain("create or replace function public.network_unit_checklist");
    expect(code).toContain("coalesce(_store.delivery_enabled, false)");
    expect(code).toContain("(not _delivery_enabled) or exists");
    expect(code).toContain("'delivery_enabled', _delivery_enabled");
    expect(code).toContain("'driver_required', _delivery_enabled");
  });

  it("mantém o grant da função", () => {
    expect(code).toContain(
      "grant execute on function public.network_unit_checklist(uuid) to authenticated, service_role",
    );
  });

  it("não redefine publish_network_unit, não toca billing, nada destrutivo", () => {
    expect(code).not.toContain("publish_network_unit");
    expect(code).not.toContain("monthly");
    expect(code).not.toContain("delete from");
    expect(code).not.toContain("update public.stores");
    expect(code).not.toContain("drop ");
  });
});
