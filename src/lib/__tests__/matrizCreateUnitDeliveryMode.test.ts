/**
 * Teste ESTÁTICO da migration do Item 1 (modo de entrega na criação).
 *
 * Mesmo padrão das Fases 1–4 e do checklist só-retirada: sem infra de
 * banco no repo, garante que o arquivo SQL contém a regra esperada e
 * nenhum comando destrutivo. A prova de verdade (RPC ao vivo + criação
 * pela UI) fica para a etapa de aplicação, com a palavra do Renner.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATION = "20261117150000_matriz_create_unit_delivery_enabled.sql";
const sql = readFileSync(join(process.cwd(), "supabase", "migrations", MIGRATION), "utf8");
const code = sql
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n")
  .toLowerCase();

describe("migration Item 1: create_network_unit ganha _delivery_enabled", () => {
  it("derruba a assinatura antiga de 12 args antes de recriar (sem overload silencioso)", () => {
    expect(code).toContain(
      "drop function if exists public.create_network_unit(text, text, text, text, text, text, text, text, text, numeric, numeric, numeric);",
    );
    const dropIdx = code.indexOf("drop function if exists public.create_network_unit");
    const createIdx = code.indexOf("create or replace function public.create_network_unit");
    expect(dropIdx).toBeGreaterThan(-1);
    expect(createIdx).toBeGreaterThan(dropIdx);
  });

  it("o parâmetro novo é o ÚLTIMO, booleano, com default false (chamadas antigas intactas)", () => {
    expect(code).toContain(
      "_minimum_order_value numeric default null::numeric, _delivery_enabled boolean default false)",
    );
  });

  it("grava delivery_enabled no INSERT (NULL explícito vira false, como o checklist)", () => {
    expect(code).toContain("delivery_enabled,");
    expect(code).toContain("coalesce(_delivery_enabled, false),");
  });

  it("mantém o corpo da 190000 (auto-clone da fonte) e refaz os grants na assinatura nova", () => {
    expect(code).toContain("public.network_menu_source(_network.id)");
    expect(code).toContain("public.clone_menu_from_matriz(_source_store_id, _store_id)");
    expect(code).toContain(
      "revoke execute on function public.create_network_unit(text, text, text, text, text, text, text, text, text, numeric, numeric, numeric, boolean) from public, anon;",
    );
    expect(code).toContain(
      "grant execute on function public.create_network_unit(text, text, text, text, text, text, text, text, text, numeric, numeric, numeric, boolean) to authenticated, service_role;",
    );
  });

  it("não toca loja existente, não redefine outra função, nada destrutivo", () => {
    expect(code).not.toContain("update public.stores");
    expect(code).not.toContain("update stores");
    expect(code).not.toContain("delete from");
    expect(code).not.toContain("publish_network_unit");
    expect(code).not.toContain("network_unit_checklist");
    expect(code).not.toContain("truncate");
  });
});
