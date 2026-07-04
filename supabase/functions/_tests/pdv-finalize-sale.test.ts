/**
 * Auditoria da RPC `pdv_finalize_sale` no Supabase EXTERNO.
 *
 * Cobre:
 *  - venda simples (order + item + movement)
 *  - idempotência via client_uuid
 *  - sessão fechada é rejeitada
 *  - store_id/session_id ausentes são rejeitados
 *  - split de pagamento gera N movements
 *
 * Skip automático se faltar EXTERNAL_SUPABASE_URL/SERVICE_KEY.
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const URL_ = Deno.env.get("EXTERNAL_SUPABASE_URL") || "";
const KEY_ = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || "";
const skip = !URL_ || !KEY_;

const opts = { ignore: skip, sanitizeOps: false, sanitizeResources: false };
const sb = skip ? null : createClient(URL_, KEY_);

// Loja pastelao-carioca (fixture real, com produtos).
const STORE_ID = "b97f3a1a-d558-41e5-b8a2-ebd65b5381b4";
const PRODUCT_ID = "4c5edf70-4381-41d2-97e2-5d0c54938796"; // Batata Frita

let sessionId = "";
const createdOrders: string[] = [];
const createdUuids: string[] = [];

async function openSession() {
  const { data, error } = await sb!
    .from("pdv_sessions")
    .insert({ store_id: STORE_ID, opening_amount: 0, status: "open" })
    .select("id")
    .single();
  if (error) throw error;
  sessionId = data!.id;
}

async function closeSession() {
  if (!sessionId) return;
  await sb!
    .from("pdv_sessions")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", sessionId);
}

async function cleanup() {
  for (const id of createdOrders) {
    await sb!.from("pdv_movements").delete().eq("order_id", id);
    await sb!.from("order_items").delete().eq("order_id", id);
    await sb!.from("orders").delete().eq("id", id);
  }
  for (const u of createdUuids) {
    await sb!.from("pdv_outbox_backup").delete().eq("client_uuid", u);
  }
  await closeSession();
}

function payload(overrides: Record<string, unknown> = {}) {
  const client_uuid = crypto.randomUUID();
  createdUuids.push(client_uuid);
  return {
    client_uuid,
    store_id: STORE_ID,
    session_id: sessionId,
    subtotal: 7,
    pdv_discount: 0,
    commission_rate: 0,
    total_price: 7,
    payment_method: "dinheiro",
    payments: [{ method: "dinheiro", amount: 7 }],
    items: [{ product_id: PRODUCT_ID, quantity: 1, unit_price: 7 }],
    ...overrides,
  };
}

Deno.test({ name: "pdv_finalize_sale: venda simples cria order+item+movement", ...opts, fn: async () => {
  await openSession();
  try {
    const { data, error } = await sb!.rpc("pdv_finalize_sale", { _payload: payload() });
    assertEquals(error, null);
    const orderId = (data as any).order_id as string;
    assert(orderId);
    createdOrders.push(orderId);

    const { data: items } = await sb!.from("order_items").select("id").eq("order_id", orderId);
    assertEquals(items!.length, 1);
    const { data: movs } = await sb!.from("pdv_movements").select("id, amount, type")
      .eq("order_id", orderId);
    assertEquals(movs!.length, 1);
    assertEquals(Number(movs![0].amount), 7);
    assertEquals(movs![0].type, "sale");
  } finally {
    await cleanup();
  }
}});

Deno.test({ name: "pdv_finalize_sale: idempotência por client_uuid", ...opts, fn: async () => {
  await openSession();
  try {
    const p = payload();
    const first = await sb!.rpc("pdv_finalize_sale", { _payload: p });
    assertEquals(first.error, null);
    const orderId = (first.data as any).order_id as string;
    createdOrders.push(orderId);

    const second = await sb!.rpc("pdv_finalize_sale", { _payload: p });
    assertEquals(second.error, null);
    assertEquals((second.data as any).order_id, orderId);
    assertEquals((second.data as any).idempotent, true);

    // Não duplica itens/movements
    const { data: items } = await sb!.from("order_items").select("id").eq("order_id", orderId);
    assertEquals(items!.length, 1);
    const { data: movs } = await sb!.from("pdv_movements").select("id").eq("order_id", orderId);
    assertEquals(movs!.length, 1);
  } finally {
    await cleanup();
  }
}});

Deno.test({ name: "pdv_finalize_sale: rejeita sessão fechada", ...opts, fn: async () => {
  await openSession();
  await closeSession(); // fecha antes de vender
  try {
    const { error } = await sb!.rpc("pdv_finalize_sale", { _payload: payload() });
    assert(error, "deveria retornar erro");
    assert(/não está aberta/i.test(error!.message));
  } finally {
    sessionId = ""; // já fechada
    await cleanup();
  }
}});

Deno.test({ name: "pdv_finalize_sale: rejeita payload sem store_id/session_id", ...opts, fn: async () => {
  const { error } = await sb!.rpc("pdv_finalize_sale", {
    _payload: { client_uuid: crypto.randomUUID(), total_price: 1, payments: [], items: [] },
  });
  assert(error, "deveria retornar erro");
  assert(/obrigat/i.test(error!.message));
}});

Deno.test({ name: "pdv_finalize_sale: split gera 1 movement por pagamento", ...opts, fn: async () => {
  await openSession();
  try {
    const p = payload({
      total_price: 10,
      subtotal: 10,
      payment_method: "dinheiro",
      payments: [
        { method: "dinheiro", amount: 6 },
        { method: "pix", amount: 4 },
      ],
      items: [{ product_id: PRODUCT_ID, quantity: 1, unit_price: 10 }],
    });
    const { data, error } = await sb!.rpc("pdv_finalize_sale", { _payload: p });
    assertEquals(error, null);
    const orderId = (data as any).order_id as string;
    createdOrders.push(orderId);
    const { data: movs } = await sb!.from("pdv_movements").select("payment_method, amount")
      .eq("order_id", orderId).order("amount", { ascending: false });
    assertEquals(movs!.length, 2);
    assertEquals(movs![0].payment_method, "dinheiro");
    assertEquals(movs![1].payment_method, "pix");
  } finally {
    await cleanup();
  }
}});