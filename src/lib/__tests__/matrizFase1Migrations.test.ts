/**
 * Testes ESTÁTICOS das migrations da Fase 1 (matriz).
 *
 * RLS e triggers são regras de BANCO — não dá para testar o comportamento
 * real sem um banco. Como não existe infra de banco local/ephemeral no repo,
 * estes testes garantem que cada arquivo SQL contém as policies, triggers,
 * funções e guards idempotentes esperados, e que nenhum deles usa
 * DELETE/UPDATE destrutivo no banco ao vivo.
 *
 * O teste de verdade (tentar se nomear gerente e ver falhar; vincular por
 * convite e ver funcionar) fica para a etapa de aplicação das migrations,
 * com a palavra do Renner — ver o relatório da Fase 1.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

const M1 = "20261028130000_matriz_fase1_store_networks.sql";
const M2 = "20261028131000_matriz_fase1_profile_link_lock.sql";
const M3 = "20261028132000_matriz_fase1_store_managers_invites.sql";
const M4 = "20261028133000_matriz_fase1_network_functions.sql";

function readMigration(name: string): string {
  return readFileSync(join(MIGRATIONS_DIR, name), "utf8");
}

describe("migrations da Fase 1 existem", () => {
  it.each([M1, M2, M3, M4])("existe %s", (name) => {
    expect(() => readMigration(name)).not.toThrow();
  });
});

describe("M1 — store_networks idempotente + trava C2", () => {
  const sql = readMigration(M1);

  it("usa CREATE TABLE IF NOT EXISTS + DO com checagem de coluna (a tabela já existe ao vivo)", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.store_networks");
    expect(sql).toContain("IF NOT EXISTS (SELECT 1 FROM information_schema.columns");
    expect(sql).not.toMatch(/^CREATE TABLE public\.store_networks/m);
  });

  it("plan_type aceita pdv_only (C6)", () => {
    expect(sql).toContain("'pdv_only'");
    expect(sql).toContain("store_networks_plan_type_check");
  });

  it("rede nasce aprovada por default (decisão 5)", () => {
    expect(sql).toContain("is_approved boolean NOT NULL DEFAULT true");
    expect(sql).toContain("ALTER COLUMN is_approved SET DEFAULT true");
  });

  it("remove o INSERT direto: policy auth_insert_own_network sai e INSERT é revogado", () => {
    expect(sql).toContain("DROP POLICY IF EXISTS auth_insert_own_network");
    expect(sql).toContain("REVOKE INSERT ON TABLE public.store_networks FROM authenticated");
  });

  it("trigger impede o dono de mudar campo de administração", () => {
    expect(sql).toContain("prevent_network_self_admin");
    expect(sql).toContain("trigger_prevent_network_self_admin");
    for (const col of ["is_approved", "max_units", "plan_type", "monthly_fee", "owner_id", "matriz_store_id"]) {
      expect(sql).toContain(`OLD.${col} IS DISTINCT FROM NEW.${col}`);
    }
  });

  it("não toca em monthly-billing nem repasse (fora dos comentários)", () => {
    const code = sql
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n")
      .toLowerCase();
    expect(code).not.toContain("monthly-billing");
    expect(code).not.toContain("monthly_billing");
    expect(code).not.toContain("repasse");
  });
});

describe("M2 — trava do perfil (C1), duas camadas", () => {
  const sql = readMigration(M2);

  it("camada (a): policy de UPDATE com WITH CHECK que trava os 3 campos de vínculo", () => {
    expect(sql).toContain('"Users can update own profile"');
    expect(sql).toContain("profile_link_fields_unchanged");
    expect(sql).toContain("WITH CHECK");
  });

  it("camada (b): trigger estendido bloqueia unit_store_id e network_id", () => {
    expect(sql).toContain("prevent_role_self_change");
    expect(sql).toContain("OLD.unit_store_id IS DISTINCT FROM NEW.unit_store_id");
    expect(sql).toContain("OLD.network_id IS DISTINCT FROM NEW.network_id");
    // O bloqueio antigo continua: role e is_approved.
    expect(sql).toContain("OLD.role IS DISTINCT FROM NEW.role");
    expect(sql).toContain("OLD.is_approved IS DISTINCT FROM NEW.is_approved");
  });

  it("preserva os escapes: bypass_role_guard, service_role/postgres e admin", () => {
    expect(sql).toContain("app.bypass_role_guard");
    expect(sql).toContain("service_role");
    expect(sql).toContain("is_platform_admin(auth.uid())");
  });
});

describe("M3 — store_managers + network_invites", () => {
  const sql = readMigration(M3);

  it("cria as duas tabelas com RLS ligada", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.store_managers");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.network_invites");
    expect(sql).toContain("ALTER TABLE public.store_managers ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("ALTER TABLE public.network_invites ENABLE ROW LEVEL SECURITY");
  });

  it("1 gerente por subloja ativa e 1 subloja ativa por gerente (unique parcial)", () => {
    expect(sql).toContain("store_managers_one_active_per_store");
    expect(sql).toContain("store_managers_one_active_per_user");
    expect(sql).toContain("WHERE is_active");
  });

  it("convite: código único, 1 pendente por (loja, e-mail), validade 7 dias", () => {
    expect(sql).toContain("network_invites_code_key");
    expect(sql).toContain("network_invites_one_pending_per_email");
    expect(sql).toContain("now() + interval '7 days'");
    expect(sql).toContain("'pending'");
    expect(sql).toContain("'accepted'");
    expect(sql).toContain("'declined'");
    expect(sql).toContain("'expired'");
  });

  it("sem escrita direta: só admin via policy; INSERT/UPDATE/DELETE revogados para authenticated", () => {
    expect(sql).toContain("REVOKE INSERT, UPDATE, DELETE ON TABLE public.store_managers FROM authenticated");
    expect(sql).toContain("REVOKE INSERT, UPDATE, DELETE ON TABLE public.network_invites FROM authenticated");
  });
});

describe("M4 — funções recriadas com CREATE OR REPLACE", () => {
  const sql = readMigration(M4);

  it("recria as 6 funções sem DROP", () => {
    for (const fn of [
      "is_unit_manager",
      "is_network_owner",
      "get_user_routing_context",
      "register_as_matriz",
      "create_network_unit",
      "link_unit_user",
    ]) {
      expect(sql).toContain(`CREATE OR REPLACE FUNCTION public.${fn}`);
    }
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.unlink_unit_user");
    expect(sql).not.toMatch(/DROP FUNCTION/);
  });

  it("is_unit_manager lê store_managers e mantém o fallback legado documentado", () => {
    expect(sql).toContain("FROM public.store_managers");
    expect(sql).toContain("unit_store_id = _store_id");
    expect(sql).toContain("TRANSIÇÃO");
  });

  it("register_as_matriz nasce aprovada (decisão 5) e trava _user_id de outro usuário", () => {
    expect(sql).toContain("is_approved)\n  values (_network_name, _logo_url, _uid, _plan_type, _monthly_fee, true)");
    expect(sql).toContain("Você só pode criar uma rede para você mesmo.");
  });

  it("create_network_unit conta só sublojas no limite (M1)", () => {
    expect(sql).toContain("AND NOT COALESCE(is_matriz, false)");
  });

  it("link_unit_user valida tudo (A9) e escreve em store_managers", () => {
    expect(sql).toContain("INSERT INTO public.store_managers");
    expect(sql).toContain("já é dono de uma loja própria");
    expect(sql).toContain("já é gerente de outra subloja");
    expect(sql).toContain("já tem um gerente vinculado");
    expect(sql).toContain("não foi encontrado. Peça para a pessoa se cadastrar primeiro.");
  });

  it("unlink_unit_user existe (A9) e só dono/admin desvinculam", () => {
    expect(sql).toContain("Só o dono da rede ou o admin podem desvincular gerente desta loja.");
    expect(sql).toContain("is_active = false, unlinked_at = now()");
  });

  it("nenhuma migration da Fase 1 faz DELETE/UPDATE destrutivo em dados ao vivo", () => {
    for (const name of [M1, M2, M3, M4]) {
      const s = readMigration(name);
      // DELETE de linhas e TRUNCATE são proibidos aqui (Fase 0 é outra fase,
      // e nada desta fase apaga dado). UPDATEs permitidos são só os das
      // próprias funções / do perfil vinculado por elas.
      expect(s).not.toMatch(/^\s*DELETE FROM/m);
      expect(s).not.toMatch(/TRUNCATE/i);
    }
  });
});
