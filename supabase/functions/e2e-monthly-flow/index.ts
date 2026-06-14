// e2e-monthly-flow — testa ciclo completo de MENSALIDADE (e checagem do split/repasse)
// 1) chama monthly-billing para a loja sandbox (cria PIX Asaas)
// 2) confirma o pagamento via receiveInCash + webhook PAYMENT_RECEIVED
// 3) valida que financial_transactions virou paid, store_plans avançou next_billing_date
// 4) reporta o estado de store_balances (repasse/comissão) — sanidade pós-pagamento
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-e2e-secret",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const steps: Array<Record<string, unknown>> = [];
  const log = (step: string, ok: boolean, info?: unknown, error?: string) => {
    steps.push({ step, ok, info, error });
    console.log(`[e2e-monthly-flow] ${step} ok=${ok}`, info ?? "", error ?? "");
  };

  try {
    // Auth: x-e2e-secret == E2E_ADMIN_SECRET OU Bearer == service-role key
    const EXTERNAL_URL = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
    const SVC = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const NATIVE_SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || SVC;
    const e2eSecret = Deno.env.get("E2E_ADMIN_SECRET") || "";
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const hdr = req.headers.get("x-e2e-secret") || "";
    const ok = (e2eSecret && hdr === e2eSecret) || token === SVC || token === NATIVE_SVC;
    if (!ok) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(EXTERNAL_URL, SVC);

    // 1) Escolhe loja sandbox com plano ativo e mensalidade > 0
    const body = await req.json().catch(() => ({}));
    const storeId: string = body?.store_id || "667bef59-0b67-4da5-9837-ce07b7427d09"; // Sandbox Sushi
    const { data: plan } = await admin
      .from("store_plans")
      .select("id, store_id, plan_type, monthly_fee, is_active, next_billing_date, last_billed_at")
      .eq("store_id", storeId).eq("is_active", true).maybeSingle();
    if (!plan) return json({ error: "Plano não encontrado para store_id", steps }, 400);
    log("pick_plan", true, plan);

    // Limpa lock para garantir cobrança
    await admin.from("store_plans").update({ last_billing_attempt_at: null }).eq("id", plan.id);

    // 2) Dispara monthly-billing
    const projectUrl = Deno.env.get("SUPABASE_URL")!;
    const mb = await fetch(`${projectUrl}/functions/v1/monthly-billing`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${NATIVE_SVC}`,
        apikey: NATIVE_SVC,
      },
      body: JSON.stringify({ store_id: storeId, force: true }),
    });
    const mbBody = await mb.json().catch(() => ({}));
    log("monthly_billing", mb.ok, mbBody, mb.ok ? undefined : `HTTP ${mb.status}`);
    if (!mb.ok) return json({ error: "monthly-billing falhou", steps }, 500);

    // 3) Lê última financial_transaction commission_charge da loja
    await sleep(800);
    const { data: tx } = await admin
      .from("financial_transactions")
      .select("id, reference_code, amount, status, mercado_pago_payment_id, transaction_kind")
      .eq("store_id", storeId)
      .eq("transaction_kind", "commission_charge")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!tx?.mercado_pago_payment_id) {
      return json({ error: "Transaction sem payment_id Asaas", tx, steps }, 500);
    }
    const paymentId = tx.mercado_pago_payment_id;
    log("read_tx", true, tx);

    // 4) Asaas receiveInCash (sandbox)
    const ASAAS = Deno.env.get("ASAAS_API_KEY")!;
    const isSandbox = !ASAAS.startsWith("$aact_prod_");
    if (!isSandbox) return json({ error: "ASAAS_API_KEY é PROD — abortei", steps }, 400);
    const base = "https://sandbox.asaas.com/api/v3";
    const today = new Date().toISOString().split("T")[0];
    const rc = await fetch(`${base}/payments/${paymentId}/receiveInCash`, {
      method: "POST",
      headers: { "Content-Type": "application/json", access_token: ASAAS },
      body: JSON.stringify({ paymentDate: today, value: Number(tx.amount), notifyCustomer: false }),
    });
    const rcj = await rc.json().catch(() => ({}));
    log("asaas_receive_cash", rc.ok, { status: rc.status, asaas_status: rcj?.status }, rc.ok ? undefined : `HTTP ${rc.status}`);

    // 5) Dispara webhook PAYMENT_RECEIVED
    const WTOK = Deno.env.get("ASAAS_WEBHOOK_TOKEN")!;
    const wr = await fetch(`${projectUrl}/functions/v1/asaas-webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "asaas-access-token": WTOK },
      body: JSON.stringify({
        id: `evt_e2em_${Date.now()}`,
        event: "PAYMENT_RECEIVED",
        payment: { id: paymentId, externalReference: tx.reference_code, value: Number(tx.amount), status: "RECEIVED" },
      }),
    });
    const wj = await wr.json().catch(() => ({}));
    log("webhook", wr.ok, wj, wr.ok ? undefined : `HTTP ${wr.status}`);

    // 6) Poll final
    let finalTx: any = null, finalPlan: any = null;
    for (let i = 0; i < 10; i++) {
      await sleep(1200);
      const { data: t } = await admin.from("financial_transactions").select("id,status,settled_at,reference_code,amount").eq("id", tx.id).maybeSingle();
      const { data: p } = await admin.from("store_plans").select("id,next_billing_date,last_billed_at,last_billing_attempt_at").eq("id", plan.id).maybeSingle();
      finalTx = t; finalPlan = p;
      if (t?.status === "paid") break;
    }
    const { data: bal } = await admin.from("store_balances").select("repasse_pendente,comissao_pendente,pending_commission,updated_at").eq("store_id", storeId).maybeSingle();
    log("final", true, { tx: finalTx, plan: finalPlan, balance: bal });

    const issues: string[] = [];
    if (finalTx?.status !== "paid") issues.push(`transaction não virou paid (status=${finalTx?.status})`);
    if (!finalPlan?.next_billing_date) issues.push("next_billing_date não foi atualizado");
    if (finalPlan?.last_billing_attempt_at) issues.push("last_billing_attempt_at não foi liberado");

    return json({ ok: issues.length === 0, store_id: storeId, payment_id: paymentId, issues, steps });
  } catch (e) {
    console.error("[e2e-monthly-flow] fatal", e);
    return json({ error: String((e as Error).message || e), steps }, 500);
  }
});