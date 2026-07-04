import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const EXTERNAL_URL = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY")!;
const STORE_ID = "b97f3a1a-d558-41e5-b8a2-ebd65b5381b4";
const OWNER_ID = "a5248d00-2cbe-432a-8bb0-d6f60e734e7b";

const serviceHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

async function adminFetch(path: string, init: RequestInit = {}) {
  const response = await fetch(`${EXTERNAL_URL}${path}`, {
    ...init,
    headers: { ...serviceHeaders, ...(init.headers || {}) },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  return { response, data };
}

async function createOwnerSession() {
  const { response: userResponse, data: user } = await adminFetch(`/auth/v1/admin/users/${OWNER_ID}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  assertEquals(userResponse.status, 200);
  assert(user?.email);

  const { response: linkResponse, data: link } = await adminFetch("/auth/v1/admin/generate_link", {
    method: "POST",
    body: JSON.stringify({ type: "magiclink", email: user.email }),
  });
  assertEquals(linkResponse.status, 200);

  const actionUrl = new URL(link.action_link);
  const tokenHash = actionUrl.searchParams.get("token_hash") || actionUrl.searchParams.get("token");
  assert(tokenHash);

  const verifyResponse = await fetch(`${EXTERNAL_URL}/auth/v1/verify`, {
    method: "POST",
    headers: { apikey: SERVICE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "magiclink", token_hash: tokenHash }),
  });
  const verifyText = await verifyResponse.text();
  const session = verifyText ? JSON.parse(verifyText) : null;
  assertEquals(verifyResponse.status, 200);
  assert(session?.access_token);
  return session.access_token as string;
}

async function createTempOrder() {
  const { response, data } = await adminFetch("/rest/v1/orders", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      store_id: STORE_ID,
      client_id: null,
      status: "pendente",
      subtotal: 1,
      delivery_fee: 0,
      total_price: 1,
      payment_method: "dinheiro",
      neighborhood: "TESTE DENO",
      address_details: "Pedido temporário para teste automatizado",
      order_source: "manual",
      visible_to_client: false,
    }),
  });
  assertEquals(response.status, 201);
  return data[0].id as string;
}

async function deleteTempOrder(orderId: string) {
  const response = await fetch(`${EXTERNAL_URL}/rest/v1/orders?id=eq.${orderId}&neighborhood=eq.TESTE%20DENO`, {
    method: "DELETE",
    headers: { ...serviceHeaders, Prefer: "return=minimal" },
  });
  await response.text();
}

Deno.test("cancel-order-refund preflight allows browser tracing headers", async () => {
  const response = await fetch(`${EXTERNAL_URL}/functions/v1/cancel-order-refund`, {
    method: "OPTIONS",
    headers: {
      Origin: "http://localhost:8080",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization, x-client-info, apikey, content-type, baggage",
    },
  });
  await response.text();
  assertEquals(response.status, 200);
  assert(response.headers.get("access-control-allow-headers")?.includes("baggage"));
});

Deno.test("cancel-order-refund cancels a Pastelao temporary order", async () => {
  const token = await createOwnerSession();
  const orderId = await createTempOrder();
  try {
    const response = await fetch(`${EXTERNAL_URL}/functions/v1/cancel-order-refund`, {
      method: "POST",
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: orderId, cancel_reason: "out_of_stock" }),
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    assertEquals(response.status, 200);
    assertEquals(data?.success, true);
  } finally {
    await deleteTempOrder(orderId);
  }
});

Deno.test("apply_cancellation_policy RPC works for Pastelao owner", async () => {
  const token = await createOwnerSession();
  const orderId = await createTempOrder();
  try {
    const response = await fetch(`${EXTERNAL_URL}/rest/v1/rpc/apply_cancellation_policy`, {
      method: "POST",
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ _order_id: orderId, _reason: "Teste Deno" }),
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    assertEquals(response.status, 200);
    assertEquals(data?.cancelled, true);
  } finally {
    await deleteTempOrder(orderId);
  }
});