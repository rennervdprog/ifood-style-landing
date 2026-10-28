/**
 * Testes ESTÁTICOS da migration da Fase 3 (herança de cardápio).
 *
 * Mesmo padrão da Fase 2: sem infra de banco local no repo, estes testes
 * garantem que o SQL contém as colunas, funções e guards esperados, que
 * o mapa old→new casa POR CÓDIGO (nunca por nome+preço), e que nenhum
 * statement destrutivo ou de cobrança entrou na migration.
 *
 * O teste de verdade (cópia sem duplicar, re-sync, divergência, e o
 * caminho que hoje dá "0 produtos copiados") fica para a etapa de
 * aplicação da migration, com a palavra do Renner.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");
const M = "20261028170000_matriz_fase3_heranca_cardapio.sql";

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

describe("migration da Fase 3 existe", () => {
  it(`existe ${M}`, () => {
    expect(() => readMigration(M)).not.toThrow();
  });
});

describe("código estável (network_code)", () => {
  const sql = readMigration(M);
  const code = codeWithoutComments(sql);

  it.each(["menu_sections", "products", "addon_groups", "addon_items"])(
    "adiciona network_code em %s com guard idempotente",
    (table) => {
      expect(sql).toContain(`table_name = '${table}' AND column_name = 'network_code'`);
      expect(sql).toContain(`ADD COLUMN network_code uuid`);
    },
  );

  it("adiciona products.last_synced_price (base da regra de preço próprio)", () => {
    expect(sql).toContain("column_name = 'last_synced_price'");
    expect(sql).toContain("ADD COLUMN last_synced_price numeric");
  });

  it("cria índices únicos parciais (um código, uma cópia por loja)", () => {
    expect(code).toContain("create unique index if not exists menu_sections_store_network_code_uniq");
    expect(code).toContain("create unique index if not exists products_store_network_code_uniq");
    expect(code).toContain("create unique index if not exists addon_groups_store_network_code_uniq");
    expect(code).toContain("create unique index if not exists addon_items_group_network_code_uniq");
  });

  it("faz backfill de código para quem não tem", () => {
    expect(code).toContain("set network_code = gen_random_uuid() where network_code is null");
  });
});

describe("clone reescrito — causas do '0 produtos copiados' corrigidas", () => {
  const sql = readMigration(M);
  const code = codeWithoutComments(sql);

  it("usa sort_order (coluna real) e nunca display_order no código", () => {
    expect(code).toContain("sort_order");
    expect(code).not.toContain("display_order");
  });

  it("não referencia colunas inexistentes (is_required, group_id)", () => {
    expect(code).not.toContain("is_required");
    expect(code).not.toContain("group_id = pag");
    expect(code).toContain("addon_group_id");
  });

  it("devolve as chaves que o painel lê (categories_copied/products_copied)", () => {
    expect(code).toContain("'categories_copied'");
    expect(code).toContain("'products_copied'");
    expect(code).toContain("'products_skipped'");
  });

  it("casa o mapa POR CÓDIGO, nunca por nome+preço", () => {
    expect(code).toContain("t.network_code = s.network_code");
    expect(code).not.toContain("i.name = s.name and i.price = s.price");
  });

  it("insere só o que falta (idempotente — não duplica)", () => {
    expect(code).toContain("not exists (select 1 from public.products t where t.store_id = _target_store_id and t.network_code = s.network_code)");
    expect(code).toContain("not exists (select 1 from public.menu_sections t where t.store_id = _target_store_id and t.network_code = s.network_code)");
  });

  it("o preço copiado já nasce como último sync", () => {
    expect(code).toContain("network_code, last_synced_price");
  });
});

describe("re-sync e divergência", () => {
  const sql = readMigration(M);
  const code = codeWithoutComments(sql);

  it("cria resync_menu_from_matriz com flag de sobrescrever preço", () => {
    expect(code).toContain("create or replace function public.resync_menu_from_matriz(_source_store_id uuid, _target_store_id uuid, _overwrite_price boolean default false)");
    expect(code).toContain("_overwrite_price");
  });

  it("preço próprio é pulado sem overwrite; com overwrite, conta separado", () => {
    expect(code).toContain("products_price_skipped");
    expect(code).toContain("products_price_overwritten");
    expect(code).toContain("t.price <> t.last_synced_price");
  });

  it("cria network_menu_divergence com os 6 status", () => {
    expect(code).toContain("create or replace function public.network_menu_divergence(_source_store_id uuid, _target_store_id uuid)");
    for (const s of ["novo_na_matriz", "preco_proprio", "desatualizado", "removido_na_matriz", "divergente"]) {
      expect(code).toContain(`'${s}'`);
    }
  });

  it("o re-sync apenas CONTA o que sumiu da matriz (nunca apaga)", () => {
    expect(code).toContain("products_removed_from_matriz");
    expect(code).not.toMatch(/delete from public\.products/);
  });
});

describe("grants e limites de escopo", () => {
  const sql = readMigration(M);
  const code = codeWithoutComments(sql);

  it("revoga anon e dá execute para authenticated + service_role nas 3 funções", () => {
    for (const fn of [
      "clone_menu_from_matriz(uuid, uuid)",
      "resync_menu_from_matriz(uuid, uuid, boolean)",
      "network_menu_divergence(uuid, uuid)",
    ]) {
      expect(code).toContain(`revoke execute on function public.${fn} from public, anon`);
      expect(code).toContain(`grant execute on function public.${fn} to authenticated, service_role`);
    }
  });

  it("não toca em billing, repasse ou cobrança", () => {
    expect(code).not.toContain("monthly-billing");
    expect(code).not.toContain("monthly_billing");
    expect(code).not.toContain("repasse");
    expect(code).not.toContain("subscription");
  });

  it("nenhum DELETE destrutivo na migration", () => {
    expect(code).not.toContain("delete from");
    expect(code).not.toContain("drop table");
    expect(code).not.toContain("truncate");
  });
});
