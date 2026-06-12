import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const brl = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const now = new Date();
    const since24h = new Date(now.getTime() - 86400000).toISOString();

    // 1) Inadimplência (planos fixos com next_billing_date no passado)
    const { data: latePlans } = await admin
      .from("store_plans")
      .select("store_id, monthly_fee, next_billing_date")
      .eq("is_active", true)
      .eq("plan_type", "fixed")
      .lt("next_billing_date", now.toISOString());
    const lateAmt = (latePlans || []).reduce((s: number, p: any) => s + Number(p.monthly_fee || 0), 0);

    // 2) Saques atrasados (solicitado > 24h)
    const { data: lateWithdrawals } = await admin
      .from("withdrawal_requests")
      .select("id, amount, created_at")
      .eq("status", "solicitado")
      .lt("created_at", since24h);
    const lateWAmt = (lateWithdrawals || []).reduce((s: number, w: any) => s + Number(w.amount || 0), 0);

    // 3) Webhooks Asaas com erro
    const { data: errWebhooks } = await admin
      .from("asaas_webhook_events")
      .select("id, event_type, created_at, error, processed")
      .or("processed.eq.false,error.not.is.null")
      .gte("created_at", since24h);

    // 4) Fila de revisão de transferências
    const { data: review } = await admin
      .from("asaas_transfer_review_queue")
      .select("id, created_at");

    const summary = {
      generated_at: now.toISOString(),
      inadimplencia: { count: latePlans?.length || 0, total: lateAmt, label: `${latePlans?.length || 0} lojas · ${brl(lateAmt)}` },
      saques_atrasados: { count: lateWithdrawals?.length || 0, total: lateWAmt, label: `${lateWithdrawals?.length || 0} saques · ${brl(lateWAmt)}` },
      asaas_webhook_errors: { count: errWebhooks?.length || 0 },
      transfer_review_queue: { count: review?.length || 0 },
    };

    // Log para auditoria
    await admin.from("admin_logs").insert({
      admin_user_id: "00000000-0000-0000-0000-000000000000",
      action: "daily_finance_digest",
      target_type: "finance",
      details: summary,
    });

    return json({ success: true, ...summary });
  } catch (e) {
    console.error("daily-finance-digest error:", e);
    return json({ error: "Erro interno" }, 500);
  }
});