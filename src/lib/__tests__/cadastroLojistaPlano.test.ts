/**
 * Testes ESTÁTICOS da correção do cadastro de lojista (plano/CNPJ/defaults).
 *
 * Bug (Cantinho Do Tempero, 31/10/2026): a loja nasce pelo trigger de
 * fallback com INSERT mínimo; os DEFAULTs da coluna preenchiam o resto
 * (plan_type='essencial' por coincidência, commission_rate=6 legado) e a
 * RPC register_as_lojista nunca reconciliava `stores` — só o store_plans.
 * cnpj_cpf ficava NULL apesar de o formulário coletar o documento.
 * No front, o update de enriquecimento do profile usava colunas
 * inexistentes (birth_date/address_number) e era rejeitado INTEIRO em
 * silêncio; e o patch pós-RPC do pdv_only sobrescrevia a mensalidade
 * correta (R$ 120 da RPC/template) por um 69.00 legado.
 *
 * Estes testes travam a correção na migration e no CadastroLojista.
 * A prova comportamental é o gesto real em conta de teste (relatório).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATION = "20261031140000_cadastro_lojista_plano_cnpj.sql";
const sql = readFileSync(join(process.cwd(), "supabase", "migrations", MIGRATION), "utf8");
const sqlCode = sql
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n")
  .toLowerCase();

const front = readFileSync(join(process.cwd(), "src", "pages", "CadastroLojista.tsx"), "utf8");

function sliceBetween(text: string, start: string, end: string): string {
  const i = text.indexOf(start);
  expect(i, `trecho inicial não encontrado: ${start}`).toBeGreaterThanOrEqual(0);
  const j = text.indexOf(end, i);
  expect(j, `trecho final não encontrado: ${end}`).toBeGreaterThan(i);
  return text.slice(i, j + end.length);
}

describe("migration do cadastro — register_as_lojista reconcilia a loja", () => {
  it("redefine a função com a MESMA assinatura", () => {
    expect(sqlCode).toContain("create or replace function public.register_as_lojista(");
    expect(sqlCode).toContain("_selected_plan text default null::text");
    expect(sqlCode).toContain("_skip_otp_check boolean default false");
  });

  it("mapeia o plano escolhido para o vocabulário de stores.plan_type", () => {
    expect(sqlCode).toContain("_store_plan_type := 'essencial'");
    expect(sqlCode).toContain("_store_plan_type := 'pdv_only'");
  });

  it("o INSERT da loja grava plan_type, commission_rate e cnpj_cpf da seleção", () => {
    const insert = sliceBetween(sqlCode, "insert into public.stores (", "returning id into _store_id");
    expect(insert).toContain("plan_type");
    expect(insert).toContain("commission_rate");
    expect(insert).toContain("cnpj_cpf");
    expect(insert).toContain("_store_plan_type");
    expect(insert).toContain("nullif(_document_digits, '')");
  });

  it("o UPDATE (loja do fallback) reconcilia plan_type, comissão e CNPJ", () => {
    const update = sliceBetween(sqlCode, "update public.stores", "where id = _store_id");
    expect(update).toContain("plan_type = _store_plan_type");
    expect(update).toContain("commission_rate = _commission_rate");
    expect(update).toContain("cnpj_cpf = coalesce(nullif(_document_digits, '')");
  });

  it("o documento é normalizado para dígitos antes de gravar", () => {
    expect(sqlCode).toContain("regexp_replace(coalesce(_document, ''), '\\d', '', 'g')");
  });

  it("store_plans continua sendo escrito pela RPC (não regrediu)", () => {
    expect(sqlCode).toContain("insert into public.store_plans (");
    expect(sqlCode).toContain("when _plan_type = 'fixed' then 5000.00");
  });
});

describe("CadastroLojista — payloads que o PostgREST aceita", () => {
  it("o update de profile NÃO usa colunas inexistentes (birth_date/address_number)", () => {
    const block = sliceBetween(front, 'from("profiles").update({', "profileUpdateErr.message");
    expect(block).not.toContain("birth_date");
    expect(block).not.toContain("address_number");
    // a coluna do número em profiles é `number`
    expect(block).toContain("number: addressNumber.trim()");
    // e o erro passou a ser observado (nada de falha silenciosa)
    expect(block).toContain("profileUpdateErr");
  });

  it("o update de endereço da loja grava a UF (address_state) vinda do CEP", () => {
    const block = sliceBetween(front, 'from("stores").update({', 'eq("id", storeRow.id)');
    expect(block).toContain("address_state: addressState");
    expect(front).toContain("setAddressState(result.uf || \"\")");
  });

  it("o patch do pdv_only NÃO sobrescreve a mensalidade com o 69.00 legado", () => {
    expect(front).not.toContain("monthly_fee: 69");
    const block = sliceBetween(front, 'from("store_plans").update({', 'eq("store_id", storeRow.id)');
    expect(block).not.toContain("monthly_fee");
    expect(block).toContain('plan_type: "pdv_only"');
  });
});
