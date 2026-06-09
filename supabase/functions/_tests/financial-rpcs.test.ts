/**
 * Testes das 4 RPCs financeiras criadas hoje (Supabase EXTERNO).
 *
 * Estratégia: cria 1 loja-teste isolada, executa cada RPC com cenários
 * válidos e inválidos, valida saldo final, depois apaga a loja (rollback
 * manual — RPCs não rodam dentro de transação do client).
 *
 * Requer secrets: EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_SERVICE_KEY.
 * Pule (skip) automaticamente se não houver credenciais — assim CI não
 * quebra em ambientes sem acesso ao externo.
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const URL_ = Deno.env.get("EXTERNAL_SUPABASE_URL") || "";
const KEY_ = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || "";
const skip = !URL_ || !KEY_;

const opts = { ignore: skip, sanitizeOps: false, sanitizeResources: false };
const sb = skip ? null : createClient(URL_, KEY_);

let storeId = "";

async function setupStore() {
  // Cria loja-teste com saldos zerados
  const { data, error } = await sb!
    .from("stores")
    .insert({ name: `__rpc_test_${Date.now()}`, slug: `__rpc_test_${Date.now()}`, status: "active" })
    .select("id")
    .single();
  if (error) throw error;
  storeId = data.id;
  await sb!.from("store_balances").upsert({
    store_id: storeId,
    repasse_pendente: 100,
    comissao_pendente: 50,
  });
}

async function teardownStore() {
  if (!storeId) return;
  await sb!.from("store_balances").delete().eq("store_id", storeId);
  await sb!.from("stores").delete().eq("id", storeId);
  storeId = "";
}

async function getBal() {
  const { data } = await sb!
    .from("store_balances")
    .select("repasse_pendente, comissao_pendente")
    .eq("store_id", storeId)
    .single();
  return data!;
}

// ---------- debit_store_repasse ----------
Deno.test({ name: "debit_store_repasse: debita valor válido", ...opts, fn: async () => {
  await setupStore();
  try {
    const { error } = await sb!.rpc("debit_store_repasse", { _store_id: storeId, _amount: 30 });
    assertEquals(error, null);
    const b = await getBal();
    assertEquals(Number(b.repasse_pendente), 70);
  } finally { await teardownStore(); }
}});

Deno.test({ name: "debit_store_repasse: falha com saldo insuficiente", ...opts, fn: async () => {
  await setupStore();
  try {
    const { error } = await sb!.rpc("debit_store_repasse", { _store_id: storeId, _amount: 99999 });
    assert(error, "Deveria falhar com saldo insuficiente");
    const b = await getBal();
    assertEquals(Number(b.repasse_pendente), 100); // não mexeu
  } finally { await teardownStore(); }
}});

Deno.test({ name: "debit_store_repasse: ignora valor <= 0", ...opts, fn: async () => {
  await setupStore();
  try {
    await sb!.rpc("debit_store_repasse", { _store_id: storeId, _amount: 0 });
    const b = await getBal();
    assertEquals(Number(b.repasse_pendente), 100);
  } finally { await teardownStore(); }
}});

// ---------- debit_store_commission ----------
Deno.test({ name: "debit_store_commission: debita valor válido", ...opts, fn: async () => {
  await setupStore();
  try {
    const { error } = await sb!.rpc("debit_store_commission", { _store_id: storeId, _amount: 20 });
    assertEquals(error, null);
    const b = await getBal();
    assertEquals(Number(b.comissao_pendente), 30);
  } finally { await teardownStore(); }
}});

Deno.test({ name: "debit_store_commission: falha com saldo insuficiente", ...opts, fn: async () => {
  await setupStore();
  try {
    const { error } = await sb!.rpc("debit_store_commission", { _store_id: storeId, _amount: 9999 });
    assert(error, "Deveria falhar");
    const b = await getBal();
    assertEquals(Number(b.comissao_pendente), 50);
  } finally { await teardownStore(); }
}});

// ---------- credit_store_commission ----------
Deno.test({ name: "credit_store_commission: credita valor", ...opts, fn: async () => {
  await setupStore();
  try {
    const { error } = await sb!.rpc("credit_store_commission", { _store_id: storeId, _amount: 10 });
    assertEquals(error, null);
    const b = await getBal();
    assertEquals(Number(b.comissao_pendente), 60);
  } finally { await teardownStore(); }
}});

Deno.test({ name: "credit_store_commission: ignora valor <= 0", ...opts, fn: async () => {
  await setupStore();
  try {
    await sb!.rpc("credit_store_commission", { _store_id: storeId, _amount: -5 });
    const b = await getBal();
    assertEquals(Number(b.comissao_pendente), 50);
  } finally { await teardownStore(); }
}});

// ---------- reconcile_debit_store_balance ----------
Deno.test({ name: "reconcile_debit_store_balance: plano comissao deduz só comissão", ...opts, fn: async () => {
  await setupStore();
  try {
    await sb!.rpc("reconcile_debit_store_balance", { _store_id: storeId, _amount: 15, _plan_type: "comissao" });
    const b = await getBal();
    assertEquals(Number(b.comissao_pendente), 35);
    assertEquals(Number(b.repasse_pendente), 100); // intacto
  } finally { await teardownStore(); }
}});

Deno.test({ name: "reconcile_debit_store_balance: plano repasse deduz só repasse", ...opts, fn: async () => {
  await setupStore();
  try {
    await sb!.rpc("reconcile_debit_store_balance", { _store_id: storeId, _amount: 25, _plan_type: "repasse" });
    const b = await getBal();
    assertEquals(Number(b.repasse_pendente), 75);
    assertEquals(Number(b.comissao_pendente), 50); // intacto
  } finally { await teardownStore(); }
}});

Deno.test({ name: "reconcile_debit_store_balance: plano híbrido deduz proporcional", ...opts, fn: async () => {
  await setupStore();
  try {
    // híbrido = divide entre os dois, sem dobrar
    await sb!.rpc("reconcile_debit_store_balance", { _store_id: storeId, _amount: 30, _plan_type: "hibrido" });
    const b = await getBal();
    const totalDebited = (100 - Number(b.repasse_pendente)) + (50 - Number(b.comissao_pendente));
    // total debitado deve ser ~30 (não 60 como era no bug antigo)
    assert(Math.abs(totalDebited - 30) < 0.01, `Esperava ~30 debitados, foi ${totalDebited}`);
  } finally { await teardownStore(); }
}});