/**
 * Testes ESTÁTICOS das migrations da Fase 2 (matriz).
 *
 * Mesmo padrão da Fase 1: RLS e triggers são regras de BANCO — sem infra
 * de banco local/ephemeral no repo, estes testes garantem que cada arquivo
 * SQL contém as colunas, funções e guards esperados, e que nenhum deles
 * usa DELETE/UPDATE destrutivo no banco ao vivo.
 *
 * O teste de verdade (virar matriz marca 1 loja só; subloja nasce
 * rascunho e só vende após publicar; convite aceito vincula; trigger não
 * recria loja em rebaixamento; cadastro normal continua criando loja)
 * fica para a etapa de aplicação das migrations, com a palavra do Renner.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

const M1 = "20261028140000_matriz_fase2_draft_pause_trigger.sql";
const M2 = "20261028141000_matriz_fase2_register_unit_rewrite.sql";
const M3 = "20261028142000_matriz_fase2_invites_checklist_publish.sql";
const M4 = "20261028143000_matriz_fase2_bugfixes.sql";

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

describe("migrations da Fase 2 existem", () => {
  it.each([M1, M2, M3, M4])("existe %s", (name) => {
    expect(() => readMigration(name)).not.toThrow();
  });
});

describe("M1 — rascunho, pausa, trigger e fim do fallback legado", () => {
  const sql = readMigration(M1);

  it("cria stores.is_draft e store_networks.is_paused com guard idempotente", () => {
    expect(sql).toContain("column_name = 'is_draft'");
    expect(sql).toContain("ADD COLUMN is_draft boolean NOT NULL DEFAULT false");
    expect(sql).toContain("column_name = 'is_paused'");
    expect(sql).toContain("ADD COLUMN is_paused boolean NOT NULL DEFAULT false");
  });

  it("is_unit_manager não lê mais profiles.unit_store_id", () => {
    const code = codeWithoutComments(sql);
    expect(code).toContain("create or replace function public.is_unit_manager");
    expect(code).toContain("from public.store_managers");
    expect(code).not.toContain("unit_store_id");
  });

  it("trigger: INSERT cria loja, UPDATE nunca cria (TG_OP)", () => {
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.ensure_lojista_has_store()");
    expect(sql).toContain("IF TG_OP = 'INSERT' THEN");
    expect(sql).toContain("DROP TRIGGER IF EXISTS trg_ensure_lojista_has_store ON public.profiles");
    expect(sql).toContain("AFTER INSERT OR UPDATE OF role, is_approved ON public.profiles");
  });

  it("não tem DELETE destrutivo", () => {
    expect(codeWithoutComments(sql)).not.toContain("delete from");
  });
});

describe("M2 — register_as_matriz marca 1 loja só (A4) + anônimo 30 min", () => {
  const sql = readMigration(M2);

  it("remove a assinatura antiga antes de recriar (não dá para mudar nº de args com OR REPLACE)", () => {
    expect(sql).toContain(
      "DROP FUNCTION IF EXISTS public.register_as_matriz(text, uuid, text, text, numeric, numeric, numeric, integer);",
    );
    expect(sql).toContain(
      "DROP FUNCTION IF EXISTS public.create_network_unit(text, text, text, text, text, text, text, text, text);",
    );
    expect(sql).toContain("_matriz_store_id uuid DEFAULT NULL::uuid");
  });

  it("marca 1 loja só: a escolhida, ou a mais recente; desmarca as outras matrizes do dono", () => {
    expect(sql).toContain("order by created_at desc limit 1");
    expect(sql).toContain("update stores set is_matriz = false, network_id = null");
    expect(sql).toContain("and coalesce(is_matriz, false)");
    // A loja escolhida precisa pertencer ao dono e não estar em outra rede.
    expect(sql).toContain("and owner_id = _uid and network_id is null");
  });

  it("caminho anônimo só vale até 30 minutos após a criação do usuário", () => {
    expect(sql).toContain("auth.users where id = _uid");
    expect(sql).toContain("now() - interval '30 minutes'");
    expect(sql).toContain("Sessão expirada. Entre novamente para criar a rede.");
  });

  it("create_network_unit: nasce rascunho, endereço obrigatório, slug único, plano R$ 0", () => {
    expect(sql).toContain("is_draft = true");
    expect(sql).toContain("is_visible = false");
    expect(sql).toContain("'analise'::store_status");
    expect(sql).toContain("Endereço incompleto: preencha rua, número, bairro, cidade e CEP.");
    expect(sql).toContain("Já existe uma loja com este endereço (slug).");
    // Plano da subloja: mensalidade 0, sem vencimento (decisão 1).
    expect(sql).toContain("0,\n    true,\n    NULL");
    expect(sql).toContain("next_billing_date");
  });

  it("não toca em monthly-billing nem repasse (fora dos comentários)", () => {
    const code = codeWithoutComments(sql);
    expect(code).not.toContain("monthly-billing");
    expect(code).not.toContain("monthly_billing");
    expect(code).not.toContain("repasse");
  });
});

describe("M3 — convites, checklist, publicar e pausa", () => {
  const sql = readMigration(M3);

  it("existem as 7 funções novas", () => {
    for (const fn of [
      "invite_unit_manager",
      "accept_network_invite",
      "decline_network_invite",
      "get_network_invite",
      "network_unit_checklist",
      "publish_network_unit",
      "set_network_paused",
    ]) {
      expect(sql).toContain(`CREATE OR REPLACE FUNCTION public.${fn}`);
    }
  });

  it("convite: 7 dias, reenvio expira o anterior, vínculo só por aceite", () => {
    expect(sql).toContain("status = 'expired'");
    expect(sql).toContain("accept_network_invite");
    expect(sql).toContain("INSERT INTO public.store_managers");
    expect(sql).toContain("Este convite é para outro e-mail");
  });

  it("checklist: endereço, horário, cardápio, entregador + pronto", () => {
    expect(sql).toContain("network_unit_checklist");
    expect(sql).toContain("opening_hours");
    expect(sql).toContain("is_available");
    expect(sql).toContain("status = 'accepted'");
    expect(sql).toContain("'ready'");
  });

  it("publicar exige checklist e tira o rascunho da vitrine", () => {
    expect(sql).toContain("publish_network_unit");
    expect(sql).toContain("Falta concluir:");
    expect(sql).toContain("SET is_draft = false, is_visible = true, status = 'ativo'");
  });

  it("pausa marca a rede e fecha as sublojas publicadas (decisão 9)", () => {
    expect(sql).toContain("set_network_paused");
    expect(sql).toContain("SET is_paused = _paused");
    expect(sql).toContain("SET force_closed = _paused");
    expect(sql).toContain("AND NOT COALESCE(is_draft, false)");
  });

  it("get_network_invite pode ser chamada sem login (o código é o segredo)", () => {
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.get_network_invite(text) TO anon, authenticated, service_role");
  });

  it("não tem DELETE destrutivo nem toque em billing/repasse", () => {
    const code = codeWithoutComments(sql);
    expect(code).not.toContain("delete from");
    expect(code).not.toContain("monthly_billing");
    expect(code).not.toContain("repasse");
  });
});

describe("M4 — bugfixes: array_append no publicar + vencido persiste", () => {
  const sql = readMigration(M4);

  it("publicar usa array_append nos 4 itens e nenhum `||` com array", () => {
    expect(sql).toContain("array_append(_missing, 'endereço')");
    expect(sql).toContain("array_append(_missing, 'horário')");
    expect(sql).toContain("array_append(_missing, 'cardápio')");
    expect(sql).toContain("array_append(_missing, 'entregador')");
    // O padrão quebrado (`text[] || 'literal'` vira concatenação de
    // arrays e dá "malformed array literal") não pode voltar.
    // (O cabeçalho do arquivo cita o padrão antigo; por isso o teste
    // olha só o código, sem comentários.)
    expect(codeWithoutComments(sql)).not.toContain("_missing ||");
    expect(sql).toContain("RAISE EXCEPTION 'Falta concluir: %.'");
  });

  it("accept/decline: DROP da assinatura antiga + retorno jsonb estruturado", () => {
    expect(sql).toContain("DROP FUNCTION IF EXISTS public.accept_network_invite(text);");
    expect(sql).toContain("DROP FUNCTION IF EXISTS public.decline_network_invite(text);");
    expect(sql).toContain("CREATE FUNCTION public.accept_network_invite(_code text)");
    expect(sql).toContain("CREATE FUNCTION public.decline_network_invite(_code text)");
    expect(sql).toContain("RETURNS jsonb");
    // Vencido: grava 'expired' e DEVOLVE o erro (não levanta exceção,
    // senão a exceção aborta a transação e o UPDATE some junto).
    expect(sql).toContain("RETURN jsonb_build_object('ok', false, 'error'");
    expect(sql).toContain("RETURN jsonb_build_object('ok', true, 'store_id', _invite.store_id)");
    expect(sql).toContain("RETURN jsonb_build_object('ok', true)");
    // Grants reaplicados (o DROP remove os antigos).
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.accept_network_invite(text) TO authenticated, service_role");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.decline_network_invite(text) TO authenticated, service_role");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.publish_network_unit(uuid) TO authenticated, service_role");
  });

  it("não tem DELETE destrutivo nem toque em billing/repasse", () => {
    const code = codeWithoutComments(sql);
    expect(code).not.toContain("delete from");
    expect(code).not.toContain("monthly_billing");
    expect(code).not.toContain("repasse");
  });
});
