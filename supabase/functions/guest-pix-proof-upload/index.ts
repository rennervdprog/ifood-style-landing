// Upload de comprovante Pix Direto para pedido GUEST (sem login).
// Verifica is_guest + últimos 4 do telefone + status + prazo.
// Faz upload via service role no bucket privado `pix-proofs` e atualiza o pedido.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Max-Age": "86400",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const ALLOWED = new Set(["image/jpeg", "image/png", "application/pdf"]);
const MAX_BYTES = 5 * 1024 * 1024;

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.split(",", 2)[1] : b64;
  const bin = atob(clean);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let p: any;
  try { p = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const orderId = String(p?.order_id || "").trim();
  const last4 = String(p?.last4 || "").replace(/\D/g, "");
  const contentType = String(p?.content_type || "").trim().toLowerCase();
  const ext = String(p?.ext || "jpg").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "jpg";
  const fileB64 = String(p?.file_base64 || "");
  if (!orderId || last4.length !== 4 || !fileB64) return json({ error: "invalid_params" }, 400);
  if (!ALLOWED.has(contentType)) return json({ error: "invalid_content_type" }, 400);

  let bytes: Uint8Array;
  try { bytes = base64ToBytes(fileB64); } catch { return json({ error: "invalid_file" }, 400); }
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) return json({ error: "file_too_large" }, 400);

  try {
    const sb = createClient(
      (Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL"))!,
      (Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!,
      { auth: { persistSession: false } },
    );

    const { data: order } = await sb.from("orders")
      .select("id, client_id, store_id, status, is_guest, payment_method, pix_expires_at")
      .eq("id", orderId).maybeSingle();
    if (!order || !(order as any).is_guest) return json({ error: "not_found" }, 404);
    if ((order as any).payment_method !== "pix_direto") return json({ error: "not_pix_direto" }, 400);
    if ((order as any).status !== "aguardando_comprovante") return json({ error: "invalid_status" }, 409);
    if ((order as any).pix_expires_at && new Date((order as any).pix_expires_at).getTime() < Date.now()) {
      return json({ error: "expired" }, 410);
    }

    // Confere últimos 4 do telefone
    const [{ data: guest }, { data: profile }] = await Promise.all([
      sb.from("guest_customers").select("phone").eq("user_id", (order as any).client_id).maybeSingle(),
      sb.from("profiles").select("phone").eq("user_id", (order as any).client_id).maybeSingle(),
    ]);
    const phone = String((guest as any)?.phone || (profile as any)?.phone || "");
    if (!phone || phone.slice(-4) !== last4) return json({ error: "not_found" }, 404);

    const path = `${(order as any).store_id}/${(order as any).id}.${ext}`;
    const { error: upErr } = await sb.storage.from("pix-proofs")
      .upload(path, bytes, { upsert: true, contentType });
    if (upErr) {
      console.error("[guest-pix-proof-upload] storage:", upErr);
      return json({ error: "upload_failed" }, 500);
    }

    const { error: updErr } = await sb.from("orders")
      .update({
        pix_proof_url: path,
        pix_proof_uploaded_at: new Date().toISOString(),
        status: "comprovante_enviado",
      } as any)
      .eq("id", orderId)
      .eq("status", "aguardando_comprovante");
    if (updErr) {
      console.error("[guest-pix-proof-upload] order update:", updErr);
      return json({ error: "order_update_failed" }, 500);
    }

    // Notifica loja (best-effort)
    try {
      await sb.functions.invoke("pix-direto-notify", { body: { order_id: orderId, event: "proof_uploaded" } });
    } catch (_) { /* ignore */ }

    return json({ ok: true });
  } catch (e) {
    console.error("[guest-pix-proof-upload] unhandled:", e);
    return json({ error: "internal_error" }, 500);
  }
});