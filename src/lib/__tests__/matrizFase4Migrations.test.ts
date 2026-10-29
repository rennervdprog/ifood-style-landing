/**
 * Testes ESTÁTICOS da migration da Fase 4 (cobrança da rede).
 *
 * Mesmo padrão das Fases 1–3: sem infra de banco local no repo, estes
 * testes garantem que o SQL contém as colunas, funções e guards
 * esperados, que nenhuma linha existente é reescrita, e que a cobrança
 * nova nasce atrás da flag billing_enabled (desligada por default).
 *
 * O teste de verdade (cobrar 1 rede em sandbox, pular o plano da
 * subloja, liquidar via webhook) fica para a etapa de aplicação da
 * migration, com a palavra do Renner — o plano de teste está no PR.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");
const M = "20261028220000_matriz_fase4_cobranca_rede.sql";

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

describe("migration da Fase 4 existe", () => {
  it(`existe ${M}`, () => {
    expect(() => readMigration(M)).not.toThrow();
  });
});

describe("flag e colunas de cobrança (cobrança viva inalterada)", () => {
  const sql = readMigration(M);
  const code = codeWithoutComments(sql);

  it("adiciona billing_enabled com guard idempotente e default false", () => {
    expect(sql).toContain("column_name = 'billing_enabled'");
    expect(sql).toContain("ADD COLUMN billing_enabled boolean NOT NULL DEFAULT false");
  });

  it("adiciona next_billing_date e last_billing_attempt_at", () => {
    expect(sql).toContain("column_name = 'next_billing_date'");
    expect(sql).toContain("column_name = 'last_billing_attempt_at'");
    expect(sql).toContain("ADD COLUMN next_billing_date timestamptz");
    expect(sql).toContain("ADD COLUMN last_billing_attempt_at timestamptz");
  });

  it("alinha o default guardado para R$ 89,90 (Essencial) — só linhas novas", () => {
    expect(code).toContain("alter column monthly_fee set default 89.90");
  });
});

describe("calculate_network_monthly_fee (decisões 1, 2 e 6)", () => {
  const sql = readMigration(M);
  const code = codeWithoutComments(sql);

  it("cria a função com a assinatura esperada", () => {
    expect(code).toContain(
      "create or replace function public.calculate_network_monthly_fee(_network_id uuid)",
    );
  });

  it("base vem do template ativo, com fallback para o valor guardado", () => {
    expect(code).toContain("from public.plan_templates pt");
    expect(code).toContain("pt.plan_type = _network.plan_type");
    expect(code).toContain("_base := coalesce(_network.monthly_fee, 0)");
  });

  it("extras: R$ 39,90 além das 3 primeiras sublojas de delivery", () => {
    expect(code).toContain("_extra_count := greatest(0, _delivery_count - 3)");
    expect(code).toContain("_extra_fee := _extra_count * 39.90");
  });

  it("só conta subloja publicada (status 'ativo', não-matriz)", () => {
    expect(code).toContain("and not coalesce(s.is_matriz, false)");
    expect(code).toContain("and s.status = 'ativo'");
  });

  it("só-PDV fora da conta de delivery (decisão 6)", () => {
    expect(code).toContain("= 'pdv_only'");
    expect(code).toContain("_pdv_only_count");
  });

  it("gratuidade: GMV 60d <= R$ 5.000 → total 0", () => {
    expect(code).toContain("_free := _gmv <= 5000");
    expect(code).toContain("_total := case when _free then 0 else _base + _extra_fee end");
  });

  it("GMV soma pedidos entregue/finalizado dos últimos 60 dias, sem filtro de origem", () => {
    expect(code).toContain("o.status in ('entregue', 'finalizado')");
    expect(code).toContain("o.created_at >= now() - interval '60 days'");
    expect(code).toContain("sum(o.total_price)");
  });

  it("devolve o breakdown completo que a edge usa", () => {
    for (const key of [
      "'base_monthly_fee'",
      "'delivery_unit_count'",
      "'pdv_only_unit_count'",
      "'extra_unit_count'",
      "'extra_fee'",
      "'gmv_60d'",
      "'free_by_gmv'",
      "'total_monthly_fee'",
    ]) {
      expect(code).toContain(key);
    }
  });

  it("a função de cálculo NÃO é SECURITY DEFINER nem aberta a anon", () => {
    expect(code).not.toContain("calculate_network_monthly_fee(uuid)\nreturns jsonb\nlanguage plpgsql\nsecurity definer");
    expect(code).toContain("revoke execute on function public.calculate_network_monthly_fee(uuid) from public, anon");
    expect(code).toContain("grant execute on function public.calculate_network_monthly_fee(uuid) to service_role");
  });
});

describe("settle_network_monthly_payment (liquidação da rede)", () => {
  const sql = readMigration(M);
  const code = codeWithoutComments(sql);

  it("cria a função de liquidação com idempotência", () => {
    expect(code).toContain(
      "create or replace function public.settle_network_monthly_payment(",
    );
    expect(code).toContain("'monthly_settlement_applied_at'");
  });

  it("só liquida transação de mensalidade de rede", () => {
    expect(code).toContain("'network_monthly_subscription'");
    expect(code).toContain("a transação não é uma mensalidade de rede");
  });

  it("avança o vencimento da rede em 30 dias e limpa a trava", () => {
    expect(code).toContain("next_billing_date = v_settled_at + interval '30 days'");
    expect(code).toContain("last_billing_attempt_at = null");
  });

  it("não toca em store_plans nem em repasse", () => {
    expect(code).not.toContain("update public.store_plans");
    expect(code).not.toContain("repasse");
  });
});

describe("limites de escopo — nenhuma reescrita de dado vivo", () => {
  const sql = readMigration(M);
  const code = codeWithoutComments(sql);

  it("nenhum DELETE, DROP TABLE ou TRUNCATE", () => {
    expect(code).not.toContain("delete from");
    expect(code).not.toContain("drop table");
    expect(code).not.toContain("truncate");
  });

  it("nenhum UPDATE em massa em redes ou lojas existentes (só a liquidação, por id)", () => {
    expect(code).not.toContain("update public.stores");
    expect(code).not.toMatch(/update public\.store_networks\s+set[^=]*=/);
    expect(code).toContain("where sn.id = v_network_id");
  });

  it("documenta as divergências plano x realidade no cabeçalho", () => {
    expect(sql).toContain("DIVERGÊNCIAS PLANO x REALIDADE");
    expect(sql).toContain("Duda lanches");
    expect(sql).toContain("matriz_store_id NULL");
  });
});
