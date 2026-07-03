// Testes Deno para a RPC pdv_finalize_sale (Fase 3 — idempotência).
//
// Roda contra o Supabase EXTERNO usando EXTERNAL_SUPABASE_URL +
// EXTERNAL_SUPABASE_SERVICE_KEY (service role — bypass de RLS).
//
// Execução: via ferramenta supabase--test_edge_functions ou
//   deno test --allow-net --allow-env supabase/functions/_shared/pdv_finalize_sale_test.ts

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const URL =
  Deno.env.get("EXTERNAL_SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL")!;
const KEY =
  Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const sb = createClient(URL, KEY, { auth: { persistSession: false } });

async function getFixture() {
  const { data: stores } = await sb.from("stores").select("id").limit(1);
  const storeId = stores?.[0]?.id;
  if (!storeId) throw new Error("No store to test against");
  const { data: products } = await sb
    .from("products")
    .select("id")
    .eq("store_id", storeId)
    .limit(1);
  const productId = products?.[0]?.id;
  if (!productId) throw new Error("No product for store");
  const { data: session, error: se } = await sb
    .from("pdv_sessions")
    .insert({ store_id: storeId, status: "open", opening_amount: 0 } as any)
    .select("id")
    .single();
  if (se) throw se;
  return { storeId, productId, sessionId: session.id as string };
}

async function cleanup(sessionId: string) {
  const { data: orders } = await sb
    .from("orders")
    .select("id")
    .eq("pdv_session_id", sessionId);
  const orderIds = (orders ?? []).map((o: any) => o.id);
  if (orderIds.length > 0) {
    await sb.from("order_items").delete().in("order_id", orderIds);
    await sb.from("pdv_movements" as any).delete().in("order_id", orderIds);
    await sb.from("orders").delete().in("id", orderIds);
  }
  await sb.from("pdv_sessions").delete().eq("id", sessionId);
}

function buildPayload(
  fx: { storeId: string; productId: string; sessionId: string },
  opts: { clientUuid?: string | null },
) {
  const p: Record<string, unknown> = {
    store_id: fx.storeId,
    session_id: fx.sessionId,
    table_identifier: "TEST",
    subtotal: 10,
    pdv_discount: 0,
    commission_rate: 0,
    total_price: 10,
    payment_method: "dinheiro",
    payments: [{ method: "dinheiro", amount: 10 }],
    items: [{ product_id: fx.productId, quantity: 1, unit_price: 10 }],
  };
  if (opts.clientUuid !== null) p.client_uuid = opts.clientUuid ?? crypto.randomUUID();
  return p;
}

Deno.test("pdv_finalize_sale: cria order com client_uuid", async () => {
  const fx = await getFixture();
  try {
    const { data, error } = await sb.rpc("pdv_finalize_sale", {
      _payload: buildPayload(fx, {}),
    });
    assertEquals(error, null);
    assert((data as any)?.order_id, "order_id ausente");
    assertEquals((data as any)?.idempotent, false);
  } finally {
    await cleanup(fx.sessionId);
  }
});

Deno.test("pdv_finalize_sale: mesmo client_uuid é idempotente", async () => {
  const fx = await getFixture();
  try {
    const clientUuid = crypto.randomUUID();
    const payload = buildPayload(fx, { clientUuid });
    const first = await sb.rpc("pdv_finalize_sale", { _payload: payload });
    assertEquals(first.error, null);
    const orderIdFirst = (first.data as any)?.order_id;
    assert(orderIdFirst);

    const second = await sb.rpc("pdv_finalize_sale", { _payload: payload });
    assertEquals(second.error, null);
    assertEquals((second.data as any)?.order_id, orderIdFirst);
    assertEquals((second.data as any)?.idempotent, true);

    const { data: orders } = await sb
      .from("orders")
      .select("id")
      .eq("client_uuid", clientUuid);
    assertEquals(orders?.length, 1);
  } finally {
    await cleanup(fx.sessionId);
  }
});

Deno.test("pdv_finalize_sale: sem client_uuid continua funcionando", async () => {
  const fx = await getFixture();
  try {
    const { data, error } = await sb.rpc("pdv_finalize_sale", {
      _payload: buildPayload(fx, { clientUuid: null }),
    });
    assertEquals(error, null);
    assert((data as any)?.order_id);
  } finally {
    await cleanup(fx.sessionId);
  }
});

Deno.test("pdv_finalize_sale: sessão fechada rejeita", async () => {
  const fx = await getFixture();
  try {
    await sb.from("pdv_sessions").update({ status: "closed" } as any).eq("id", fx.sessionId);
    const { error } = await sb.rpc("pdv_finalize_sale", {
      _payload: buildPayload(fx, {}),
    });
    assert(error, "esperado erro para sessão fechada");
  } finally {
    await sb.from("pdv_sessions").update({ status: "open" } as any).eq("id", fx.sessionId);
    await cleanup(fx.sessionId);
  }
});

Deno.test("pdv_finalize_sale: grava backup em pdv_outbox_backup", async () => {
  const fx = await getFixture();
  try {
    const clientUuid = crypto.randomUUID();
    const { error } = await sb.rpc("pdv_finalize_sale", {
      _payload: buildPayload(fx, { clientUuid }),
    });
    assertEquals(error, null);
    const { data: backup } = await sb
      .from("pdv_outbox_backup" as any)
      .select("id")
      .eq("client_uuid", clientUuid);
    assert((backup?.length ?? 0) >= 1, "backup não gravado");
    await sb.from("pdv_outbox_backup" as any).delete().eq("client_uuid", clientUuid);
  } finally {
    await cleanup(fx.sessionId);
  }
});
