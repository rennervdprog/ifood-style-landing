/**
 * Testes ESTÁTICOS da migration da fonte do clone (opção B, decisão do
 * Renner 28/10): a fonte do cardápio passa a ser a subloja publicada
 * mais antiga da rede — nunca o guia, que não pode ter cardápio
 * (travas trg_no_products_on_matriz / trg_no_menu_on_matriz).
 *
 * Mesmo padrão da Fase 3: sem infra de banco local no repo, estes
 * testes garantem que o SQL contém a regra centralizada
 * network_menu_source com os predicados certos, que o auto-clone usa
 * ela (e não mais o guia), que o painel resolve a fonte por ela, e
 * que nenhuma trava do guia foi relaxada. O teste de verdade (auto-
 * clone da fonte, fallback, sem fonte, sync manual da fonte) fica
 * para a etapa de aplicação, com a palavra do Renner.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");
const M = "20261028190000_matriz_fase3_fonte_subloja1.sql";
const PANEL = join(process.cwd(), "src", "pages", "MatrizDashboardV2.tsx");

function readFile(path: string): string {
  return readFileSync(path, "utf8");
}

function codeWithoutComments(sql: string): string {
  return sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n")
    .toLowerCase();
}

describe("migration da fonte (opção B) existe", () => {
  it(`existe ${M}`, () => {
    expect(() => readFile(join(MIGRATIONS_DIR, M))).not.toThrow();
  });
});

describe("network_menu_source — regra centralizada, num só lugar", () => {
  const sql = readFile(join(MIGRATIONS_DIR, M));
  const code = codeWithoutComments(sql);

  it("define network_menu_source como STABLE + SECURITY DEFINER", () => {
    expect(code).toContain("create or replace function public.network_menu_source(_network_id uuid)");
    expect(code).toContain("returns uuid");
    expect(code).toContain("stable");
    expect(code).toContain("security definer");
  });

  it("exclui o guia (nunca fonte): NOT is_matriz", () => {
    expect(code).toContain("not coalesce(s.is_matriz, false)");
  });

  it("só considera publicada: NOT is_draft, is_visible, NOT force_closed", () => {
    expect(code).toContain("not coalesce(s.is_draft, false)");
    expect(code).toContain("coalesce(s.is_visible, false)");
    expect(code).toContain("not coalesce(s.force_closed, false)");
  });

  it("só considera rede não pausada: NOT sn.is_paused", () => {
    expect(code).toContain("not coalesce(sn.is_paused, false)");
  });

  it("resolve a mais antiga, com desempate determinístico, e NULL se nenhuma", () => {
    expect(code).toContain("order by s.created_at asc, s.id asc");
    expect(code).toContain("limit 1");
  });

  it("trava execução: revoga anon/PUBLIC, concede authenticated + service_role", () => {
    expect(code).toContain("revoke execute on function public.network_menu_source(uuid) from public, anon");
    expect(code).toContain("grant execute on function public.network_menu_source(uuid) to authenticated, service_role");
  });
});

describe("auto-clone usa a fonte resolvida, não o guia", () => {
  const sql = readFile(join(MIGRATIONS_DIR, M));
  const code = codeWithoutComments(sql);

  it("create_network_unit chama network_menu_source", () => {
    expect(code).toContain("create or replace function public.create_network_unit");
    expect(code).toContain("_source_store_id := public.network_menu_source(_network.id)");
    expect(code).toContain("perform public.clone_menu_from_matriz(_source_store_id, _store_id)");
  });

  it("nenhum resto da seleção do guia no código da migration nova", () => {
    expect(code).not.toContain("_guide_store_id");
    expect(code).not.toContain("coalesce(is_matriz, false)\n   order by created_at asc limit 1");
  });
});

describe("nenhuma trava do guia relaxada", () => {
  const sql = readFile(join(MIGRATIONS_DIR, M));
  const code = codeWithoutComments(sql);

  it("não dropa nem altera os triggers/guards do guia", () => {
    expect(code).not.toContain("drop trigger");
    expect(code).not.toContain("trg_no_products_on_matriz");
    expect(code).not.toContain("trg_no_menu_on_matriz");
    expect(code).not.toContain("guard_matriz_flag");
    expect(code).not.toContain("disable trigger");
  });
});

describe("painel resolve a fonte por network_menu_source", () => {
  const panel = readFile(PANEL);

  it("MenuSyncModal chama network_menu_source e não fixa mais o guia", () => {
    expect(panel).toContain('rpc("network_menu_source"');
    expect(panel).toContain("_network_id: networkId");
    expect(panel).not.toContain("matrizStoreId");
    expect(panel).not.toContain("matrizStoreName");
  });

  it("modal explica quando não há fonte publicada", () => {
    expect(panel).toContain("Nenhuma subloja publicada na rede para usar como fonte");
  });
});
