/**
 * Testes RPC do Plano Essencial (plan_type='fixed', monthly_fee=130, commission_rate=0)
 * e do fluxo de repasse acoplado a ele (split de taxa da plataforma na taxa de entrega).
 *
 * Roda contra o Supabase EXTERNO (qkjhguziuchqsbxzruea).
 * Requer secrets: EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_SERVICE_KEY.
 *
 * Cada teste cria sua própria loja isolada (prefixo __essencial_test_) e
 * limpa no finally — RPCs não rodam dentro de transação do client.
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const URL_ = Deno.env.get("EXTERNAL_SUPABASE_URL") || "";
const KEY_ = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || "";
const skip = !URL_ || !KEY_;
const opts = { ignore: skip, sanitizeOps: false, sanitizeResources: false };
const sb = skip ? null : createClient(URL_, KEY_);

type StoreOpts = {
  planType?: "fixed" | "commission_only" | "hybrid";
  monthlyFee?: number;
  commissionRate?: number;
  deliveryMode?: "own" | "platform";
  platformFeeSplit?: "cliente" | "meio_a_meio" | "lojista";
  platformSplitOverride?: number | null;
  revenueThreshold?: number | null;
  upgradeMonthlyFee?: number | null;
  upgradeTriggerMonths?: number | null;
};

async function makeStore(o: StoreOpts = {}): Promise<string> {
  const tag = `__essencial_test_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const { data: store, error: e1 } = await sb!
    .from("stores")
    .insert({
      name: tag,
      slug: tag,
      status: "ativo",
      category: "lanches",
      delivery_mode: o.deliveryMode ?? "own",
      platform_fee_split: o.platformFeeSplit ?? "cliente",
    })
    .select("id")
    .single();
  if (e1) throw e1;

  const { error: e2 } = await sb!.from("store_plans").insert({
    store_id: store.id,
    plan_type: o.planType ?? "fixed",
    monthly_fee: o.monthlyFee ?? 130,
    commission_rate: o.commissionRate ?? 0,
    is_active: true,
    platform_delivery_split_override: o.platformSplitOverride ?? null,
    revenue_threshold: o.revenueThreshold ?? null,
    upgrade_monthly_fee: o.upgradeMonthlyFee ?? null,
    upgrade_trigger_months: o.upgradeTriggerMonths ?? null,
  });
  if (e2) throw e2;

  await sb!.from("store_balances").upsert({
    store_id: store.id,
    repasse_pendente: 0,
    comissao_pendente: 0,
  });
  return store.id;
}

async function dropStore(id: string) {
  if (!id) return;
  await sb!.from("orders").delete().eq("store_id", id);
  await sb!.from("store_balances").delete().eq("store_id", id);
  await sb!.from("store_plans").delete().eq("store_id", id);
  await sb!.from("stores").delete().eq("id", id);
}

async function getRepasse(id: string): Promise<number> {
  const { data } = await sb!
    .from("store_balances")
    .select("repasse_pendente")
    .eq("store_id", id)
    .single();
  return Number(data?.repasse_pendente ?? 0);
}

// =====================================================================
// get_store_commission_rate
// =====================================================================

Deno.test({ name: "essencial: get_store_commission_rate → 0 para plano fixed", ...opts, fn: async () => {
  const id = await makeStore({ planType: "fixed", monthlyFee: 130, commissionRate: 8 });
  try {
    const { data, error } = await sb!.rpc("get_store_commission_rate", { _store_id: id });
    assertEquals(error, null);
    assertEquals(Number(data), 0, "plano fixed (Essencial) não deve cobrar comissão");
  } finally { await dropStore(id); }
}});

Deno.test({ name: "essencial: get_store_commission_rate → rate do plano commission_only", ...opts, fn: async () => {
  const id = await makeStore({ planType: "commission_only", monthlyFee: 0, commissionRate: 7.5 });
  try {
    const { data, error } = await sb!.rpc("get_store_commission_rate", { _store_id: id });
    assertEquals(error, null);
    assertEquals(Number(data), 7.5);
  } finally { await dropStore(id); }
}});

// =====================================================================
// get_store_platform_fee_charge (taxa de plataforma cobrada do lojista
// na taxa de entrega — base do repasse do Essencial)
// =====================================================================

Deno.test({ name: "essencial: platform_fee_charge → 0 quando delivery_mode != own", ...opts, fn: async () => {
  const id = await makeStore({ deliveryMode: "platform", platformFeeSplit: "lojista" });
  try {
    const { data } = await sb!.rpc("get_store_platform_fee_charge", { _store_id: id });
    assertEquals(Number(data), 0);
  } finally { await dropStore(id); }
}});

Deno.test({ name: "essencial: platform_fee_charge → 0 quando split=cliente", ...opts, fn: async () => {
  const id = await makeStore({ deliveryMode: "own", platformFeeSplit: "cliente", platformSplitOverride: 4 });
  try {
    const { data } = await sb!.rpc("get_store_platform_fee_charge", { _store_id: id });
    assertEquals(Number(data), 0, "cliente paga → loja não tem repasse");
  } finally { await dropStore(id); }
}});

Deno.test({ name: "essencial: platform_fee_charge → override total quando split=lojista", ...opts, fn: async () => {
  const id = await makeStore({ deliveryMode: "own", platformFeeSplit: "lojista", platformSplitOverride: 3 });
  try {
    const { data } = await sb!.rpc("get_store_platform_fee_charge", { _store_id: id });
    assertEquals(Number(data), 3);
  } finally { await dropStore(id); }
}});

Deno.test({ name: "essencial: platform_fee_charge → metade quando split=meio_a_meio", ...opts, fn: async () => {
  const id = await makeStore({ deliveryMode: "own", platformFeeSplit: "meio_a_meio", platformSplitOverride: 4 });
  try {
    const { data } = await sb!.rpc("get_store_platform_fee_charge", { _store_id: id });
    assertEquals(Number(data), 2);
  } finally { await dropStore(id); }
}});

// =====================================================================
// get_fixed_plan_platform_split (delegate)
// =====================================================================

Deno.test({ name: "essencial: get_fixed_plan_platform_split == get_store_platform_fee_charge", ...opts, fn: async () => {
  const id = await makeStore({ deliveryMode: "own", platformFeeSplit: "lojista", platformSplitOverride: 2.5 });
  try {
    const a = await sb!.rpc("get_fixed_plan_platform_split", { _store_id: id });
    const b = await sb!.rpc("get_store_platform_fee_charge", { _store_id: id });
    assertEquals(Number(a.data), Number(b.data));
    assertEquals(Number(a.data), 2.5);
  } finally { await dropStore(id); }
}});

// =====================================================================
// count_supporter_plans (sanity)
// =====================================================================

Deno.test({ name: "essencial: count_supporter_plans retorna inteiro >= 0", ...opts, fn: async () => {
  const { data, error } = await sb!.rpc("count_supporter_plans");
  assertEquals(error, null);
  assert(Number.isInteger(Number(data)));
  assert(Number(data) >= 0);
}});

// =====================================================================
// check_plan_upgrade
// =====================================================================

Deno.test({ name: "essencial: check_plan_upgrade → no_threshold_configured", ...opts, fn: async () => {
  const id = await makeStore({ revenueThreshold: null });
  try {
    const { data, error } = await sb!.rpc("check_plan_upgrade", { _store_id: id });
    assertEquals(error, null);
    assertEquals((data as any).action, "none");
    assertEquals((data as any).reason, "no_threshold_configured");
  } finally { await dropStore(id); }
}});

Deno.test({ name: "essencial: check_plan_upgrade → none quando faturamento abaixo do threshold", ...opts, fn: async () => {
  const id = await makeStore({
    revenueThreshold: 99999999,
    upgradeMonthlyFee: 260,
    upgradeTriggerMonths: 2,
  });
  try {
    const { data, error } = await sb!.rpc("check_plan_upgrade", { _store_id: id });
    assertEquals(error, null);
    // ação pode ser 'none' (faturamento insuficiente) — nunca 'upgrade'
    assert((data as any).action !== "upgrade", `não devia upgradar: ${JSON.stringify(data)}`);
  } finally { await dropStore(id); }
}});

// =====================================================================
// Trigger accrue_fixed_plan_split (gera repasse quando pedido físico
// na taxa de entrega é finalizado no plano Essencial)
// =====================================================================

async function insertOrder(storeId: string, payment: string, deliveryFee: number) {
  const { data, error } = await sb!
    .from("orders")
    .insert({
      store_id: storeId,
      status: "pendente",
      subtotal: 50,
      delivery_fee: deliveryFee,
      total_price: 50 + deliveryFee,
      payment_method: payment,
      neighborhood: "Centro",
      address_details: "Rua de teste, 0",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

Deno.test({ name: "essencial trigger: pedido em dinheiro finalizado acumula repasse (split=lojista)", ...opts, fn: async () => {
  const id = await makeStore({
    deliveryMode: "own",
    platformFeeSplit: "lojista",
    platformSplitOverride: 2,
  });
  try {
    const orderId = await insertOrder(id, "dinheiro", 8);
    const before = await getRepasse(id);
    const { error } = await sb!.from("orders").update({ status: "finalizado" }).eq("id", orderId);
    assertEquals(error, null);
    const after = await getRepasse(id);
    assertEquals(after - before, 2, "deve acumular R$2 de repasse");
  } finally { await dropStore(id); }
}});

Deno.test({ name: "essencial trigger: pix_machine é tratado como físico", ...opts, fn: async () => {
  const id = await makeStore({
    deliveryMode: "own",
    platformFeeSplit: "meio_a_meio",
    platformSplitOverride: 4,
  });
  try {
    const orderId = await insertOrder(id, "pix_machine", 10);
    await sb!.from("orders").update({ status: "finalizado" }).eq("id", orderId);
    const after = await getRepasse(id);
    assertEquals(after, 2, "split meio_a_meio sobre base 4 → R$2");
  } finally { await dropStore(id); }
}});

Deno.test({ name: "essencial trigger: NÃO acumula quando split=cliente", ...opts, fn: async () => {
  const id = await makeStore({
    deliveryMode: "own",
    platformFeeSplit: "cliente",
    platformSplitOverride: 4,
  });
  try {
    const orderId = await insertOrder(id, "dinheiro", 10);
    await sb!.from("orders").update({ status: "finalizado" }).eq("id", orderId);
    const after = await getRepasse(id);
    assertEquals(after, 0, "cliente paga taxa → loja não acumula repasse");
  } finally { await dropStore(id); }
}});

Deno.test({ name: "essencial trigger: NÃO acumula quando pagamento é online (pix)", ...opts, fn: async () => {
  const id = await makeStore({
    deliveryMode: "own",
    platformFeeSplit: "lojista",
    platformSplitOverride: 3,
  });
  try {
    const orderId = await insertOrder(id, "pix", 10);
    await sb!.from("orders").update({ status: "finalizado" }).eq("id", orderId);
    const after = await getRepasse(id);
    assertEquals(after, 0, "pagamento online não gera repasse físico");
  } finally { await dropStore(id); }
}});

Deno.test({ name: "essencial trigger: NÃO acumula quando delivery_fee = 0", ...opts, fn: async () => {
  const id = await makeStore({
    deliveryMode: "own",
    platformFeeSplit: "lojista",
    platformSplitOverride: 3,
  });
  try {
    const orderId = await insertOrder(id, "dinheiro", 0);
    await sb!.from("orders").update({ status: "finalizado" }).eq("id", orderId);
    const after = await getRepasse(id);
    assertEquals(after, 0);
  } finally { await dropStore(id); }
}});

Deno.test({ name: "essencial trigger: NÃO acumula quando delivery_mode = platform", ...opts, fn: async () => {
  const id = await makeStore({
    deliveryMode: "platform",
    platformFeeSplit: "lojista",
    platformSplitOverride: 3,
  });
  try {
    const orderId = await insertOrder(id, "dinheiro", 10);
    await sb!.from("orders").update({ status: "finalizado" }).eq("id", orderId);
    const after = await getRepasse(id);
    assertEquals(after, 0, "plataforma cuidando da entrega → sem repasse do Essencial");
  } finally { await dropStore(id); }
}});

Deno.test({ name: "essencial trigger: idempotente — re-update para finalizado não duplica", ...opts, fn: async () => {
  const id = await makeStore({
    deliveryMode: "own",
    platformFeeSplit: "lojista",
    platformSplitOverride: 2,
  });
  try {
    const orderId = await insertOrder(id, "dinheiro", 8);
    await sb!.from("orders").update({ status: "finalizado" }).eq("id", orderId);
    // re-aplica o mesmo status (OLD = NEW = 'finalizado' → trigger sai cedo)
    await sb!.from("orders").update({ status: "finalizado", needs_change: false }).eq("id", orderId);
    const after = await getRepasse(id);
    assertEquals(after, 2, "não pode duplicar repasse");
  } finally { await dropStore(id); }
}});

// =====================================================================
// Integração com debit_store_repasse — pagamento do repasse do Essencial
// =====================================================================

Deno.test({ name: "essencial: ciclo completo — acumula via trigger e zera via debit_store_repasse", ...opts, fn: async () => {
  const id = await makeStore({
    deliveryMode: "own",
    platformFeeSplit: "lojista",
    platformSplitOverride: 2,
  });
  try {
    // 3 pedidos físicos finalizados → R$6 acumulados
    for (let i = 0; i < 3; i++) {
      const oid = await insertOrder(id, "dinheiro", 8);
      await sb!.from("orders").update({ status: "finalizado" }).eq("id", oid);
    }
    const acc = await getRepasse(id);
    assertEquals(acc, 6);

    // simula pagamento integral
    const { error } = await sb!.rpc("debit_store_repasse", { _store_id: id, _amount: 6 });
    assertEquals(error, null);
    const after = await getRepasse(id);
    assertEquals(after, 0, "saldo precisa zerar após pagamento do repasse");
  } finally { await dropStore(id); }
}});