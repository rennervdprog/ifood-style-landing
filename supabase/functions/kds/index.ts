/**
 * KDS (Kitchen Display System) — acesso público por token assinado (HMAC).
 * Sem alteração de schema. Token = base64url(storeId) + "." + HMAC(storeId, SECRET)
 *
 * Actions (POST body { action }):
 *  - "generate-token"  (requer Authorization Bearer do lojista; valida que é dono da loja)
 *      body: { action, store_id }
 *      => { token }
 *  - "get-orders"      (público)
 *      body: { action, token }
 *      => { orders: [...] }
 *  - "update-status"   (público — token valida acesso)
 *      body: { action, token, order_id, status }
 *      => { ok: true }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Roda no projeto Supabase que hospeda esta função (externo, em produção).
// Usa as env vars padrão disponíveis em qualquer projeto Supabase.
const SB_URL =
  Deno.env.get("SUPABASE_URL") ||
  Deno.env.get("EXTERNAL_SUPABASE_URL") ||
  "";
const SB_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
  Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") ||
  "";
// Segredo HMAC (nunca sai do edge). Reusa a service key como base.
const HMAC_SECRET = SB_KEY;

const enc = new TextEncoder();
const b64url = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
};
const b64urlDecode = (s: string) => {
  s = s.replaceAll("-", "+").replaceAll("_", "/");
  while (s.length % 4) s += "=";
  return atob(s);
};

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(HMAC_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return b64url(sig);
}

async function signToken(storeId: string): Promise<string> {
  const head = b64url(enc.encode(storeId));
  const sig = await hmac(storeId);
  return `${head}.${sig}`;
}

async function verifyToken(token: string): Promise<string | null> {
  if (!token || !token.includes(".")) return null;
  const [head, sig] = token.split(".");
  let storeId: string;
  try {
    storeId = b64urlDecode(head);
  } catch {
    return null;
  }
  const expected = await hmac(storeId);
  // timing-safe compare
  if (sig.length !== expected.length) return null;
  let ok = 0;
  for (let i = 0; i < sig.length; i++) ok |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  return ok === 0 ? storeId : null;
}

// Cozinha só pode marcar pedidos como prontos. Aceitar pedido continua exclusivo do admin.
const ALLOWED_STATUSES = new Set([
  "pronto_para_entrega",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  if (!SB_URL || !SB_KEY) return json({ error: "supabase not configured" }, 500);

  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400); }

  const ext = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

  try {
    if (body.action === "generate-token") {
      const storeId = String(body.store_id || "");
      if (!storeId) return json({ error: "store_id required" }, 400);

      // Auth: validar que o caller é dono da loja (ou admin)
      const authHeader = req.headers.get("Authorization") || "";
      const jwt = authHeader.replace(/^Bearer\s+/i, "");
      if (!jwt) return json({ error: "unauthorized" }, 401);
      const { data: userRes, error: userErr } = await ext.auth.getUser(jwt);
      if (userErr || !userRes?.user) return json({ error: "invalid token" }, 401);
      const uid = userRes.user.id;

      const { data: store, error: sErr } = await ext
        .from("stores")
        .select("id, owner_id")
        .eq("id", storeId)
        .maybeSingle();
      if (sErr || !store) return json({ error: "store not found" }, 404);

      if (store.owner_id !== uid) {
        const { data: roleRow } = await ext
          .from("user_roles")
          .select("role")
          .eq("user_id", uid)
          .in("role", ["admin"])
          .maybeSingle();
        if (!roleRow) return json({ error: "forbidden" }, 403);
      }

      const token = await signToken(storeId);
      return json({ token });
    }

    if (body.action === "get-orders") {
      const storeId = await verifyToken(String(body.token || ""));
      if (!storeId) return json({ error: "invalid token" }, 401);

      const { data: orders, error } = await ext
        .from("orders")
        .select("id, code, status, created_at, total, notes, client_id, order_items(id, quantity, notes, products(name))")
        .eq("store_id", storeId)
        .in("status", ["preparando", "pronto_para_entrega"])
        .order("created_at", { ascending: true })
        .limit(60);
      if (error) return json({ error: error.message }, 500);

      const { data: store } = await ext
        .from("stores")
        .select("name")
        .eq("id", storeId)
        .maybeSingle();

      return json({ orders: orders || [], store_name: store?.name || "" });
    }

    if (body.action === "update-status") {
      const storeId = await verifyToken(String(body.token || ""));
      if (!storeId) return json({ error: "invalid token" }, 401);
      const orderId = String(body.order_id || "");
      const status = String(body.status || "");
      if (!orderId || !ALLOWED_STATUSES.has(status)) {
        return json({ error: "invalid params" }, 400);
      }
      // garantir que o pedido pertence à loja do token
      const { data: ord } = await ext
        .from("orders")
        .select("id, store_id")
        .eq("id", orderId)
        .maybeSingle();
      if (!ord || ord.store_id !== storeId) return json({ error: "forbidden" }, 403);

      const { error: upErr } = await ext
        .from("orders")
        .update({ status })
        .eq("id", orderId);
      if (upErr) return json({ error: upErr.message }, 500);
      return json({ ok: true });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e: any) {
    return json({ error: e?.message || "unexpected error" }, 500);
  }
});
