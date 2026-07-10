// Confirma recebimento de Pix Direto: chama RPC confirm_pix_proof
// (que muda status pra 'preparando') e apaga o comprovante do Storage.
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

  let body: { order_id?: string };
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const orderId = body?.order_id;
  if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) return json({ error: "invalid_order_id" }, 400);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // 1) Chama a RPC como o usuário (usa o JWT dele) — a RPC valida owner.
  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: proofPath, error } = await asUser.rpc("confirm_pix_proof", { p_order_id: orderId });
  if (error) return json({ error: error.message }, 400);

  // 2) Apaga o arquivo do storage (best-effort, com service role).
  if (proofPath) {
    try {
      const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
      await admin.storage.from("pix-proofs").remove([proofPath as string]);
    } catch (_e) { /* ignore */ }
  }

  return json({ ok: true, order_id: orderId, proof_removed: !!proofPath });
});