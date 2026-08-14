// Webhook Woovi/OpenPix — confirma pagamentos de mensalidade/comissão da plataforma.
// URL: <functions>/woovi-webhook?webhookSecret=<WOOVI_WEBHOOK_SECRET>
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-signature",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const PAID_EVENTS = new Set([
  "OPENPIX:CHARGE_COMPLETED",
  "OPENPIX:TRANSACTION_RECEIVED",
  "CHARGE_COMPLETED",
]);
const FAILED_EVENTS = new Set(["OPENPIX:CHARGE_EXPIRED", "CHARGE_EXPIRED"]);

/**
 * Verifica a assinatura RSA-SHA256 enviada pela Woovi/OpenPix no header
 * `x-webhook-signature` (base64) contra o corpo bruto da requisição.
 * A chave pública fica em WOOVI_PUBLIC_KEY (PEM ou base64 do PEM).
 */
async function verifyWooviSignature(rawBody: string, signatureB64: string | null): Promise<boolean> {
  if (!signatureB64) return false;
  let pem = Deno.env.get("WOOVI_PUBLIC_KEY") || "";
  if (!pem) return false;
  try {
    if (!pem.includes("BEGIN")) pem = atob(pem);
    const der = Uint8Array.from(
      atob(pem.replace(/-----(BEGIN|END)[^-]+-----/g, "").replace(/\s+/g, "")),
      (c) => c.charCodeAt(0),
    );
    const key = await crypto.subtle.importKey(
      "spki",
      der,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const sig = Uint8Array.from(atob(signatureB64), (c) => c.charCodeAt(0));
    return await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      sig,
      new TextEncoder().encode(rawBody),
    );
  } catch (e) {
    console.error("[woovi-webhook] signature verify error", e);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const rawBody = await req.text();

  // 1) Assinatura criptográfica (fonte da verdade quando WOOVI_PUBLIC_KEY existe)
  const publicKey = Deno.env.get("WOOVI_PUBLIC_KEY") || "";
  const signature = req.headers.get("x-webhook-signature");
  if (publicKey) {
    const valid = await verifyWooviSignature(rawBody, signature);
    if (!valid) {
      console.warn("[woovi-webhook] assinatura inválida — requisição rejeitada");
      return json({ error: "invalid_signature" }, 401);
    }
  } else {
    // 2) Fallback legado: secret na query string (menos seguro, só até a chave pública ser configurada)
    const secret = Deno.env.get("WOOVI_WEBHOOK_SECRET") || "";
    const url = new URL(req.url);
    if (!secret || url.searchParams.get("webhookSecret") !== secret) {
      return json({ error: "unauthorized" }, 401);
    }
    console.warn("[woovi-webhook] WOOVI_PUBLIC_KEY ausente — validando apenas por query secret");
  }

  const EXTERNAL_URL = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
  const EXTERNAL_KEY = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(EXTERNAL_URL, EXTERNAL_KEY);

  let payload: any = {};
  try { payload = JSON.parse(rawBody); } catch { /* ignore */ }

  const event = String(payload?.event || payload?.evento || "");
  const charge = payload?.charge || payload?.pixQrCode || {};
  const externalRef = String(charge?.correlationID || payload?.pix?.charge?.correlationID || "");
  const paymentId = String(charge?.identifier || "");

  console.log(`[woovi-webhook] event=${event} ref=${externalRef} id=${paymentId}`);

  if (!externalRef && !paymentId) return json({ ok: true, ignored: "no_identifier" });

  let tx: any = null;
  if (externalRef) {
    const { data } = await supabase
      .from("financial_transactions")
      .select("id, store_id, status, amount, reference_code, transaction_kind, metadata")
      .eq("reference_code", externalRef)
      .maybeSingle();
    tx = data;
  }
  if (!tx && paymentId) {
    const { data } = await supabase
      .from("financial_transactions")
      .select("id, store_id, status, amount, reference_code, transaction_kind, metadata")
      .eq("mercado_pago_payment_id", paymentId)
      .maybeSingle();
    tx = data;
  }
  if (!tx) return json({ ok: true, ignored: "transaction_not_found", ref: externalRef });

  if (PAID_EVENTS.has(event)) {
    if (tx.status === "paid") return json({ ok: true, idempotent: true, transaction_id: tx.id });

    const nowIso = new Date().toISOString();
    const { data: updRows, error: updErr } = await supabase
      .from("financial_transactions")
      .update({ status: "paid", settled_at: nowIso })
      .eq("id", tx.id)
      .neq("status", "paid")
      .select("id");
    if (updErr) return json({ ok: false, error: "tx_update_failed" }, 500);
    if (!updRows?.length) return json({ ok: true, idempotent: true, transaction_id: tx.id });

    const ref = String(tx.reference_code || "");
    const isMonthly = ref.startsWith("#MENS-") || ref.startsWith("#ASSIN-");
    const meta: any = tx.metadata || {};

    if (isMonthly) {
      const next = new Date();
      next.setUTCDate(next.getUTCDate() + 30);
      await supabase.from("store_plans").update({
        last_billed_at: nowIso,
        next_billing_date: next.toISOString(),
        last_billing_attempt_at: null,
      }).eq("store_id", tx.store_id).eq("is_active", true);

      const pdvBilled = Number(meta.pdv_pending_billed || 0);
      if (pdvBilled > 0) {
        await supabase.rpc("decrement_pdv_commission_pending", { _store_id: tx.store_id, _amount: pdvBilled });
      }
    } else {
      const paidAmount = Number(tx.amount || 0);
      const balanceBilled = Number(meta.balance_billed ?? paidAmount);
      const pdvBilled = Number(meta.pdv_pending_billed ?? 0);
      if (balanceBilled > 0) {
        await supabase.rpc("reconcile_debit_store_balance", {
          _store_id: tx.store_id,
          _amount: balanceBilled,
          _plan_type: meta.plan_type || "",
        });
      }
      if (pdvBilled > 0) {
        await supabase.rpc("decrement_pdv_commission_pending", { _store_id: tx.store_id, _amount: pdvBilled });
      }
    }
    return json({ ok: true, type: "payment_confirmed", transaction_id: tx.id });
  }

  if (FAILED_EVENTS.has(event)) {
    await supabase.from("financial_transactions").update({ status: "failed" }).eq("id", tx.id);
    return json({ ok: true, type: "payment_failed" });
  }

  return json({ ok: true, ignored: event });
});