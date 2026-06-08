/**
 * reconcile-payments
 *
 * Cron 15min: encontra financial_transactions ainda "pending" cujo paymentId
 * já foi pago no Asaas (webhook perdido / atraso). Marca como paga e dispara
 * o mesmo efeito do webhook (avança plano da loja ou zera saldos físicos).
 *
 * Auth: CRON_SECRET via Authorization Bearer ou x-cron-secret.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret) return json({ error: "CRON_SECRET not configured" }, 500);
  const auth = req.headers.get("authorization") || "";
  const xs = req.headers.get("x-cron-secret") || "";
  const okAuth = auth === `Bearer ${cronSecret}` || xs === cronSecret;
  if (!okAuth) return json({ error: "Unauthorized" }, 401);

  const URL_ = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
  const KEY_ = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")
    || Deno.env.get("EXTERNAL_SERVICE_ROLE_KEY")
    || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(URL_, KEY_);

  const ASAAS_KEY = Deno.env.get("ASAAS_API_KEY") || "";
  const ASAAS_BASE = ASAAS_KEY.startsWith("$aact_prod_")
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";
  if (!ASAAS_KEY) return json({ error: "ASAAS_API_KEY missing" }, 500);

  // Pega últimas 200 transações pendentes das últimas 48h
  const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
  const { data: pendings, error } = await supabase
    .from("financial_transactions")
    .select("id, store_id, status, amount, reference_code, transaction_kind, metadata, mercado_pago_payment_id")
    .eq("status", "pending")
    .gte("created_at", since)
    .limit(200);
  if (error) return json({ error: error.message }, 500);

  let checked = 0, reconciled = 0, errors = 0;
  for (const tx of pendings || []) {
    const pid = tx.mercado_pago_payment_id || tx.reference_code;
    if (!pid || !String(pid).startsWith("pay_")) continue;
    checked++;
    try {
      const r = await fetch(`${ASAAS_BASE}/payments/${pid}`, {
        headers: { access_token: ASAAS_KEY },
      });
      if (!r.ok) continue;
      const p = await r.json();
      const isPaid = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(p?.status);
      if (!isPaid) continue;

      const nowIso = new Date().toISOString();
      await supabase.from("financial_transactions")
        .update({ status: "paid", settled_at: nowIso })
        .eq("id", tx.id);

      const ref = String(tx.reference_code || "");
      const isMonthly = ref.startsWith("#MENS-") || ref.startsWith("#ASSIN-");
      if (isMonthly) {
        const next = new Date(); next.setUTCDate(next.getUTCDate() + 30);
        await supabase.from("store_plans").update({
          last_billed_at: nowIso, next_billing_date: next.toISOString(), last_billing_attempt_at: null,
        }).eq("store_id", tx.store_id).eq("is_active", true);
      } else {
        const meta: any = tx.metadata || {};
        const planType: string = meta.plan_type || "";
        const upd: Record<string, unknown> = { updated_at: nowIso };
        if (planType === "fixed" || planType === "supporter") upd.repasse_pendente = 0;
        else if (planType === "commission_only") { upd.comissao_pendente = 0; upd.pending_commission = 0; }
        else { upd.repasse_pendente = 0; upd.comissao_pendente = 0; upd.pending_commission = 0; }
        await supabase.from("store_balances").update(upd).eq("store_id", tx.store_id);
      }

      await supabase.from("financial_audit_log").insert({
        actor_type: "system",
        action: "payment_reconciled",
        entity_type: "financial_transaction",
        entity_id: tx.id,
        amount: tx.amount,
        metadata: { payment_id: pid, source: "reconcile-payments" },
      });
      reconciled++;
    } catch (e) {
      errors++;
      console.error("[reconcile-payments] err", pid, e);
    }
  }

  return json({ ok: true, checked, reconciled, errors, scanned: pendings?.length || 0 });
});