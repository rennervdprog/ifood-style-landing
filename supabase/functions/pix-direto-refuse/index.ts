// Recusa Pix Direto: chama RPC refuse_pix_proof (comprovante fica 7 dias para disputa).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  let body: { order_id?: string; reason?: string };
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const orderId = body?.order_id;
  const reason = (body?.reason ?? "").trim().slice(0, 300);
  if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) return json({ error: "invalid_order_id" }, 400);
  if (!reason) return json({ error: "missing_reason" }, 400);

  const asUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } }, auth: { persistSession: false } },
  );
  const { error } = await asUser.rpc("refuse_pix_proof", { p_order_id: orderId, p_reason: reason });
  if (error) return json({ error: error.message }, 400);
  return json({ ok: true, order_id: orderId });
});