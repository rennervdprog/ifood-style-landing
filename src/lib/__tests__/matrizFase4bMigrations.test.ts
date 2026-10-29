/**
 * Testes ESTÁTICOS da Fase 4b (decisões do Renner, 28/10/2026): P1, P2,
 * B3 (migration nova) e B4 (edge monthly-billing sem colunas fantasmas).
 * Mesmo padrão das Fases 1–4: sem infra de banco local, garante que o
 * SQL contém as regras e que a edge não seleciona colunas inexistentes.
 * Também garante que a migration antiga da Fase 4 NÃO foi alterada.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");
const OLD = "20261028220000_matriz_fase4_cobranca_rede.sql";
const NEW = "20261028230000_matriz_fase4b_p1_p2_b3.sql";
const EDGE = join(process.cwd(), "supabase", "functions", "monthly-billing", "index.ts");
const ADMIN = join(process.cwd(), "src", "components", "AdminPlanManager.tsx");

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

describe("migration nova da Fase 4b existe; a antiga não foi tocada", () => {
  it(`existe ${NEW}`, () => {
    expect(() => readMigration(NEW)).not.toThrow();
  });

  it("a migration antiga NÃO ganha P1/P2/B3 (regra: RPC nova em arquivo novo)", () => {
    const old = codeWithoutComments(readMigration(OLD));
    expect(old).not.toContain("monthly_fee_override");
    expect(old).not.toContain("pdv_only_network");
    expect(old).not.toContain("base_reason");
  });
});

describe("P2 — monthly_fee_override (nova migration)", () => {
  const sql = readMigration(NEW);
  const code = codeWithoutComments(sql);

  it("adiciona monthly_fee_override nullable com guard idempotente", () => {
    expect(sql).toContain("column_name = 'monthly_fee_override'");
    expect(code).toContain("add column monthly_fee_override numeric");
    expect(code).not.toContain("add column monthly_fee_override numeric not null");
  });

  it("precedência: override antes do template, template antes do guardado", () => {
    const overridePos = code.indexOf("monthly_fee_override is not null");
    const templatePos = code.indexOf("_template_fee is not null");
    const storedPos = code.indexOf("_base := coalesce(_network.monthly_fee, 0)");
    expect(overridePos).toBeGreaterThan(-1);
    expect(templatePos).toBeGreaterThan(-1);
    expect(storedPos).toBeGreaterThan(-1);
    expect(overridePos).toBeLessThan(templatePos);
    expect(templatePos).toBeLessThan(storedPos);
  });

  it("selo VIP por divergência de valor (override distinto da referência)", () => {
    expect(code).toContain("is distinct from");
    expect(code).toContain("coalesce(_template_fee, _network.monthly_fee)");
    expect(code).toContain("'is_vip'");
    expect(code).toContain("'vip_kind'");
  });
});

describe("P1 — rede só-PDV base 0 (nova migration)", () => {
  const sql = readMigration(NEW);
  const code = codeWithoutComments(sql);

  it("0 delivery + >= 1 só-PDV → base 0 com base_reason pdv_only_network", () => {
    expect(code).toContain("_delivery_count = 0 and _pdv_only_count > 0");
    expect(code).toContain("_base := 0");
    expect(code).toContain("'pdv_only_network'");
    expect(code).toContain("'base_reason'");
  });

  it("P1 aparece antes do branch de override (regra vence override)", () => {
    const p1Pos = code.indexOf("_delivery_count = 0 and _pdv_only_count > 0");
    const overridePos = code.indexOf("monthly_fee_override is not null");
    expect(p1Pos).toBeGreaterThan(-1);
    expect(p1Pos).toBeLessThan(overridePos);
  });

  it("breakdown expõe override, template e guardado para auditoria", () => {
    for (const key of [
      "'monthly_fee_override'",
      "'template_monthly_fee'",
      "'stored_monthly_fee'",
    ]) {
      expect(code).toContain(key);
    }
  });
});

describe("B3 — admin_logs recriada (nova migration, arquivo apenas)", () => {
  const sql = readMigration(NEW);
  const code = codeWithoutComments(sql);

  it("CREATE TABLE IF NOT EXISTS com as colunas que logVip/VipHistoryPanel usam", () => {
    expect(code).toContain("create table if not exists public.admin_logs");
    for (const col of [
      "admin_user_id uuid",
      "action text not null",
      "target_type text not null",
      "target_id uuid",
      "details jsonb",
      "created_at timestamp with time zone not null default now()",
    ]) {
      expect(code).toContain(col);
    }
  });

  it("recria a função log_admin_action do arquivo original de 29/04/2026", () => {
    expect(code).toContain("create or replace function public.log_admin_action(");
  });

  it("não reescreve dado existente (nenhum UPDATE/DELETE em tabelas vivas)", () => {
    expect(code).not.toContain("update public.store_networks");
    expect(code).not.toContain("update public.store_plans");
    expect(code).not.toContain("delete from");
  });
});

describe("B4 — edge monthly-billing sem colunas fantasmas", () => {
  const edge = readFileSync(EDGE, "utf8");

  it("select de plan_templates usa só colunas reais", () => {
    expect(edge).toContain(
      '.select("plan_type, monthly_fee, commission_rate, pdv_commission_rate, revenue_threshold, platform_fee_included")',
    );
  });

  it("nenhuma comparação fantasma tpl.pix_fee / tpl.delivery_split / tpl.pdv_fixed", () => {
    expect(edge).not.toContain("tpl.pix_fee");
    expect(edge).not.toContain("tpl.delivery_split");
    expect(edge).not.toContain("tpl.pdv_fixed");
    expect(edge).not.toContain("pix_fee, delivery_split, pdv_fixed");
  });

  it("selo VIP da loja usa padrões operacionais (1,99 / 0,99) e distingue sistêmico", () => {
    expect(edge).toContain("1.99");
    expect(edge).toContain("0.99");
    expect(edge).not.toContain("!== 2.00");
    expect(edge).toContain('vip_kind');
    expect(edge).toContain('"systemic"');
  });

  it("rede: repassa breakdown da RPC (não recomputa a base) e expõe vip/base_reason", () => {
    expect(edge).toContain("monthly_fee_override");
    expect(edge).toContain("base_reason: breakdown.base_reason");
    expect(edge).toContain("vip_kind: netVipKind");
  });
});

describe("AdminPlanManager — identificação VIP por valor + motivo (Fase 4b)", () => {
  const src = readFileSync(ADMIN, "utf8");

  it("usa detectVipDivergence (não a regra antiga de não-nulidade)", () => {
    expect(src).toContain("detectVipDivergence");
    expect(src).toContain("pendingVip");
  });

  it("campo de motivo exibido quando há divergência; log grava before/after/motivo", () => {
    expect(src).toContain("Motivo da condição VIP");
    expect(src).toContain("resolveVipReason(vipReason)");
    expect(src).toContain("diverged_fields: pendingVip.divergedFields");
  });

  it("troca de plano re-roda a detecção, preserva override e registra (nunca apaga)", () => {
    expect(src).toContain("vip_preserved_on_plan_change");
    expect(src).toContain("vipPreservedWarning");
    expect(src).toContain("override negociado preservado");
  });

  it("B2: rótulo vitalício = sem upgrade automático; sem isenção de cobrança", () => {
    expect(src).toContain("Vitalício (sem upgrade automático)");
    expect(src).toContain("Não isenta a cobrança mensal");
    expect(src).not.toContain("Nenhuma cobrança será gerada");
  });

  it("histórico VIP exibe o motivo e a ação de preservação", () => {
    expect(src).toContain("vip_preserved_on_plan_change");
    expect(src).toContain("Motivo:</span>");
  });
});
