import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PAID_EVENTS = new Set(["OPENPIX:CHARGE_COMPLETED", "OPENPIX:TRANSACTION_RECEIVED", "CHARGE_COMPLETED"]);
const EXPIRED_EVENTS = new Set(["OPENPIX:CHARGE_EXPIRED", "CHARGE_EXPIRED"]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-signature",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status });

/** Valida RSA-SHA256 se a chave pública sandbox estiver configurada. */
async function verifySignature(rawBody: string, signatureB64: string | null, keyValue: string): Promise<boolean> {
  if (!signatureB64 || !keyValue) return false;
  try {
    const pem = keyValue.includes("BEGIN") ? keyValue : atob(keyValue);
    const der = Uint8Array.from(
      atob(pem.replace(/-----(BEGIN|END)[^-]+-----/g, "").replace(/\s+/g, "")),
      (char) => char.charCodeAt(0),
    );
    const key = await crypto.subtle.importKey(
      "spki", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"],
    );
    const signature = Uint8Array.from(atob(signatureB64), (char) => char.charCodeAt(0));
    return await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5", key, signature, new TextEncoder().encode(rawBody),
    );
  } catch (error) {
    console.error("[woovi-sandbox-webhook] signature error", error);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const rawBody = await req.text();
  const publicKey = Deno.env.get("WOOVI_SANDBOX_PUBLIC_KEY") || "";
  if (publicKey) {
    const valid = await verifySignature(rawBody, req.headers.get("x-webhook-signature"), publicKey);
    if (!valid) return json({ error: "invalid_signature" }, 401);
  } else {
    // Fallback temporário exclusivo de homologação. Nunca é usado no webhook real.
    const secret = Deno.env.get("WOOVI_SANDBOX_WEBHOOK_SECRET") || "";
    const url = new URL(req.url);
    if (!secret || url.searchParams.get("sandboxSecret") !== secret) {
      return json({ error: "unauthorized" }, 401);
    }
  }

  const externalUrl = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")
    || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY")
    || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    || "";
  if (!externalUrl || !serviceKey) return json({ error: "Configuração Supabase ausente" }, 500);
  const supabase = createClient(externalUrl, serviceKey);

  let payload: any;
  try { payload = JSON.parse(rawBody); } catch { return json({ error: "invalid_json" }, 400); }

  const event = String(payload?.event || payload?.evento || "");
  const charge = payload?.charge || payload?.pix?.charge || {};
  const referenceCode = String(charge?.correlationID || "");
  const paymentId = String(charge?.identifier || charge?.transactionID || "");
  if (!referenceCode && !paymentId) return json({ ok: true, ignored: "no_identifier" });

  let transaction: any = null;
  if (referenceCode) {
    const { data } = await supabase
      .from("financial_transactions")
      .select("id, store_id, status, amount, reference_code, metadata")
      .eq("reference_code", referenceCode)
      .eq("provider", "woovi_sandbox")
      .maybeSingle();
    transaction = data;
  }
  if (!transaction && paymentId) {
    const { data } = await supabase
      .from("financial_transactions")
      .select("id, store_id, status, amount, reference_code, metadata")
      .eq("mercado_pago_payment_id", paymentId)
      .eq("provider", "woovi_sandbox")
      .maybeSingle();
    transaction = data;
  }
  if (!transaction) return json({ ok: true, ignored: "sandbox_transaction_not_found" });
  const transactionReference = String(transaction.reference_code || "");
  const isSandboxMonthly = transactionReference.startsWith("#MENS-SBX-");
  const isSandboxWeeklyRepasse = transactionReference.startsWith("#REP-SBX-");
  if (!isSandboxMonthly && !isSandboxWeeklyRepasse) {
    return json({ ok: true, ignored: "not_a_supported_sandbox_charge" });
  }

  const { data: store } = await supabase
    .from("stores")
    .select("id, is_test, status")
    .eq("id", transaction.store_id)
    .maybeSingle();
  if (!store?.is_test) return json({ error: "sandbox_transaction_not_linked_to_test_store" }, 403);

  if (PAID_EVENTS.has(event)) {
    // Mensalidade e repasse semanal usam liquidações atômicas distintas, mas
    // ambas preservam idempotência e são restritas à loja marcada como teste.
    const settlementRpc = isSandboxMonthly
      ? "settle_monthly_subscription_payment"
      : "settle_commission_charge_payment";
    const { data: settlement, error: settlementError } = await supabase
      .rpc(settlementRpc, {
        _transaction_id: transaction.id,
        _settled_at: new Date().toISOString(),
      })
      .maybeSingle();
    if (settlementError) {
      console.error("[woovi-sandbox-webhook] settlement error", settlementError);
      return json({ error: "sandbox_settlement_failed" }, 500);
    }
    if (settlement?.already_applied) {
      return json({ ok: true, idempotent: true, transaction_id: transaction.id });
    }
    const pdvBilled = Number(settlement?.pdv_commission_decremented || 0);

    // Replica a política de reativação: não liberar se ainda existir saldo financeiro
    // relevante ou alguma cobrança de comissão pendente na própria loja de teste.
    const { data: balanceAfterPayment } = await supabase
      .from("store_balances")
      .select("repasse_pendente, comissao_pendente")
      .eq("store_id", transaction.store_id)
      .maybeSingle();
    const remainingBalance = Number(balanceAfterPayment?.repasse_pendente || 0)
      + Number(balanceAfterPayment?.comissao_pendente || 0);
    const { count: unresolvedCharges } = await supabase
      .from("financial_transactions")
      .select("id", { count: "exact", head: true })
      .eq("store_id", transaction.store_id)
      .eq("transaction_kind", "commission_charge")
      .eq("status", "pending");

    if ((unresolvedCharges || 0) === 0 && remainingBalance < 500) {
      await supabase
        .from("stores")
        .update({ status: "ativo", billing_blocked_at: null, billing_block_reason: null })
        .eq("id", transaction.store_id)
        .eq("is_test", true)
        .eq("status", "bloqueado")
        .not("billing_blocked_at", "is", null);
    }

    return json({
      ok: true,
      type: isSandboxMonthly ? "sandbox_monthly_confirmed" : "sandbox_weekly_repasse_confirmed",
      transaction_id: transaction.id,
      pdv_billed: pdvBilled,
    });
  }

  if (EXPIRED_EVENTS.has(event)) {
    if (transaction.status === "paid") return json({ ok: true, idempotent: true, ignored: "already_paid" });
    const { data: failedRows, error: failureError } = await supabase
      .from("financial_transactions")
      .update({ status: "failed" })
      .eq("id", transaction.id)
      .neq("status", "paid")
      .select("id");
    if (failureError) return json({ error: "sandbox_failure_update_failed" }, 500);

    if (failedRows?.length) {
      const { data: balanceAfterFailure } = await supabase
        .from("store_balances")
        .select("repasse_pendente, comissao_pendente")
        .eq("store_id", transaction.store_id)
        .maybeSingle();
      const remainingBalance = Number(balanceAfterFailure?.repasse_pendente || 0)
        + Number(balanceAfterFailure?.comissao_pendente || 0);
      const { count: unresolvedCharges } = await supabase
        .from("financial_transactions")
        .select("id", { count: "exact", head: true })
        .eq("store_id", transaction.store_id)
        .eq("transaction_kind", "commission_charge")
        .eq("status", "pending");
      if ((unresolvedCharges || 0) === 0 && remainingBalance < 500) {
        await supabase
          .from("stores")
          .update({ status: "ativo", billing_blocked_at: null, billing_block_reason: null })
          .eq("id", transaction.store_id)
          .eq("is_test", true)
          .eq("status", "bloqueado")
          .not("billing_blocked_at", "is", null);
      }
    }
    return json({ ok: true, type: "sandbox_payment_expired", transaction_id: transaction.id, idempotent: !failedRows?.length });
  }

  return json({ ok: true, ignored: event || "unknown_event" });
});
