/**
 * Teste end-to-end do fluxo de loja MATRIZ no Supabase EXTERNO.
 *
 * Fluxo coberto:
 *  1. Cria auth user (lojista matriz)
 *  2. register_as_lojista + register_as_matriz  → vira matriz
 *  3. create_network_unit                       → cria 1 unidade
 *  4. Define horário (opening_hours)
 *  5. Cria 1 produto na unidade
 *  6. Cria auth user cliente + pedido na unidade
 *  7. Loja aceita (status=preparando)
 *  8. Finaliza (status=finalizado) e valida persistência
 *
 * Registros ficam no banco externo (não há rollback).
 * Requer secrets EXTERNAL_SUPABASE_URL / EXTERNAL_SUPABASE_SERVICE_KEY.
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const URL_ = Deno.env.get("EXTERNAL_SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || "";
const skip = !URL_ || !SERVICE_KEY;

const TS = Date.now();
const MATRIZ_EMAIL = `teste-matriz+${TS}@itasuper.com.br`;
const CLIENT_EMAIL = `teste-cliente+${TS}@itasuper.com.br`;
const PASSWORD = "Teste@12345!";

const admin = skip ? null : createClient(URL_, SERVICE_KEY, { auth: { persistSession: false } });

// anon client é usado para sign-in com password (gera JWT real do usuário)
async function getAnonKey(): Promise<string> {
  // tenta env primeiro (publishable / anon)
  const anonEnv =
    Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") ||
    Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ||
    "";
  if (anonEnv) return anonEnv;
  // fallback: usa a anon hardcoded no client (qkjhguziuchqsbxzruea)
  return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFramhndXppdWNocXNieHpydWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNDg4NTUsImV4cCI6MjA5MDYyNDg1NX0.2sTeKchqAEN2gCqnH1_Zn9cJmUSmZgryt05A66tgm2Y";
}

async function clientAs(jwt: string) {
  const anon = await getAnonKey();
  const c = createClient(URL_, anon, { auth: { persistSession: false } });
  // injeta JWT manualmente
  (c as any).rest.headers = { ...(c as any).rest?.headers, Authorization: `Bearer ${jwt}` };
  c.realtime.setAuth(jwt);
  // PostgREST helper: passar header em cada query via .functions
  // forma robusta: recriar com global headers
  return createClient(URL_, anon, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}

async function signUpAndLogin(email: string): Promise<{ userId: string; jwt: string }> {
  // admin cria já confirmado
  const { data: created, error: cErr } = await admin!.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (cErr) throw new Error(`createUser ${email}: ${cErr.message}`);
  const userId = created!.user!.id;

  // login p/ obter JWT
  const anon = await getAnonKey();
  const loginC = createClient(URL_, anon, { auth: { persistSession: false } });
  const { data: sess, error: sErr } = await loginC.auth.signInWithPassword({ email, password: PASSWORD });
  if (sErr || !sess?.session) throw new Error(`signIn ${email}: ${sErr?.message}`);
  return { userId, jwt: sess.session.access_token };
}

let matrizUserId = "";
let clientUserId = "";
let unitStoreId = "";
let networkId = "";
let productId = "";
let orderId = "";
const CREATED_USER_IDS: string[] = [];
const CREATED_STORE_IDS: string[] = [];

const opts = { ignore: skip, sanitizeOps: false, sanitizeResources: false };

Deno.test({ name: "1. cria auth user matriz + vira matriz", ...opts }, async () => {
  const { userId, jwt } = await signUpAndLogin(MATRIZ_EMAIL);
  matrizUserId = userId;
  CREATED_USER_IDS.push(userId);

  const cli = await clientAs(jwt);
  // 1) register_as_lojista (cria 1ª loja "Primeira Unidade")
  const { data: storeId, error: regErr } = await cli.rpc("register_as_lojista" as any, {
    _full_name: "Teste Matriz",
    _document: "00000000000",
    _store_name: `Unidade Origem ${TS}`,
    _store_category: "lanches",
    _avatar_url: null,
    _whatsapp: null,
    _selected_plan: "fixed",
  });
  assertEquals(regErr, null, `register_as_lojista: ${regErr?.message}`);
  assert(typeof storeId === "string", "storeId deve ser uuid");
  CREATED_STORE_IDS.push(storeId as string);

  // 2) register_as_matriz
  const { error: matrizErr } = await cli.rpc("register_as_matriz" as any, {
    _network_name: `Rede Teste ${TS}`,
    _user_id: userId,
    _plan_type: "fixed",
    _monthly_fee: 90,
    _revenue_threshold: 5000,
    _upgrade_monthly_fee: 180,
    _upgrade_trigger_months: 2,
  });
  assertEquals(matrizErr, null, `register_as_matriz: ${matrizErr?.message}`);

  // valida rede criada
  const { data: net } = await admin!.from("store_networks" as any).select("id").eq("owner_id", userId).maybeSingle();
  assert(net?.id, "rede matriz não foi criada");
  networkId = net.id;
});

Deno.test({ name: "2. matriz cria unidade via RPC", ...opts }, async () => {
  // re-login para JWT fresco
  const anon = await getAnonKey();
  const c = createClient(URL_, anon, { auth: { persistSession: false } });
  const { data: sess } = await c.auth.signInWithPassword({ email: MATRIZ_EMAIL, password: PASSWORD });
  const cli = await clientAs(sess!.session!.access_token);

  const slug = `unid-teste-${TS}`;
  const { data: storeId, error } = await cli.rpc("create_network_unit" as any, {
    _name: `Unidade Teste ${TS}`,
    _slug: slug,
    _category: "lanches",
    _address_city: "Itatinga",
    _address_cep: null,
  });
  assertEquals(error, null, `create_network_unit: ${error?.message}`);
  assert(typeof storeId === "string", "storeId da unidade deve ser uuid");
  unitStoreId = storeId as string;
  CREATED_STORE_IDS.push(unitStoreId);

  // valida vínculo da unidade à rede
  const { data: st } = await admin!.from("stores").select("id, network_id, status").eq("id", unitStoreId).maybeSingle();
  assertEquals((st as any)?.network_id, networkId, "unidade não vinculada à rede");
});

Deno.test({ name: "3. define horário da unidade (24h)", ...opts }, async () => {
  const rows = Array.from({ length: 7 }, (_, d) => ({
    store_id: unitStoreId,
    day_of_week: d,
    open_time: "00:00",
    close_time: "23:59",
    is_closed_all_day: false,
  }));
  const { error } = await admin!.from("opening_hours").upsert(rows as any, { onConflict: "store_id,day_of_week" } as any);
  assertEquals(error, null, `opening_hours: ${error?.message}`);

  // ativa loja para que aceite pedidos
  await admin!.from("stores").update({ status: "ativo", is_test: true }).eq("id", unitStoreId);
});

Deno.test({ name: "4. cria 1 produto na unidade", ...opts }, async () => {
  // seção do cardápio
  const { data: sec, error: secErr } = await admin!
    .from("menu_sections")
    .insert({ store_id: unitStoreId, name: "Lanches", display_order: 0 } as any)
    .select("id")
    .single();
  assertEquals(secErr, null, `menu_sections: ${secErr?.message}`);

  const { data: prod, error: pErr } = await admin!
    .from("products")
    .insert({
      store_id: unitStoreId,
      section_id: sec!.id,
      name: "Burger Teste",
      price: 25.0,
      is_available: true,
    } as any)
    .select("id")
    .single();
  assertEquals(pErr, null, `products: ${pErr?.message}`);
  productId = prod!.id;
});

Deno.test({ name: "5. cliente faz pedido na unidade", ...opts }, async () => {
  const { userId } = await signUpAndLogin(CLIENT_EMAIL);
  clientUserId = userId;
  CREATED_USER_IDS.push(userId);

  // insere pedido via service role (RLS permite, mas service ignora)
  const { data: order, error: oErr } = await admin!
    .from("orders")
    .insert({
      client_id: clientUserId,
      store_id: unitStoreId,
      status: "pendente",
      subtotal: 25.0,
      delivery_fee: 5.0,
      total_price: 30.0,
      payment_method: "pix",
      delivery_address: "Rua Teste, 123",
    } as any)
    .select("id")
    .single();
  assertEquals(oErr, null, `orders insert: ${oErr?.message}`);
  orderId = order!.id;

  const { error: oiErr } = await admin!.from("order_items").insert({
    order_id: orderId,
    product_id: productId,
    quantity: 1,
    unit_price: 25.0,
  } as any);
  assertEquals(oiErr, null, `order_items: ${oiErr?.message}`);
});

Deno.test({ name: "6. loja aceita o pedido (preparando)", ...opts }, async () => {
  const { error } = await admin!.from("orders").update({ status: "preparando" }).eq("id", orderId);
  assertEquals(error, null, `aceitar: ${error?.message}`);
  const { data: o } = await admin!.from("orders").select("status").eq("id", orderId).single();
  assertEquals((o as any).status, "preparando");
});

Deno.test({ name: "7. finaliza pedido", ...opts }, async () => {
  const { error } = await admin!
    .from("orders")
    .update({ status: "finalizado", confirmed_at: new Date().toISOString() })
    .eq("id", orderId);
  assertEquals(error, null, `finalizar: ${error?.message}`);

  const { data: o } = await admin!.from("orders").select("status, store_id").eq("id", orderId).single();
  assertEquals((o as any).status, "finalizado");
  assertEquals((o as any).store_id, unitStoreId);
});

Deno.test({ name: "8. resumo do fluxo", ...opts }, () => {
  console.log("\n=== RESUMO MATRIZ FLOW ===");
  console.log("matriz user:", matrizUserId, MATRIZ_EMAIL);
  console.log("client user:", clientUserId, CLIENT_EMAIL);
  console.log("network_id :", networkId);
  console.log("unit store :", unitStoreId);
  console.log("product    :", productId);
  console.log("order      :", orderId, "status=finalizado");
  console.log("==========================\n");
  assert(matrizUserId && unitStoreId && orderId);
});