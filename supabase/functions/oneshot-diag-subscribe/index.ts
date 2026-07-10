const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
async function q(sql: string) {
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const token = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  return JSON.parse(await r.text());
}
async function fetchLogs(fn: string) {
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const token = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const sql = `select id, timestamp, event_message from function_edge_logs cross join unnest(metadata) as m cross join unnest(m.request) as req where req.path like '%${fn}%' order by timestamp desc limit 20`;
  const url = `https://api.supabase.com/v1/projects/${ref}/analytics/endpoints/logs.all?sql=${encodeURIComponent(sql)}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return { status: r.status, body: await r.text() };
}
Deno.serve(async () => {
  const out: Record<string, unknown> = {};
  const key = Deno.env.get("ASAAS_API_KEY");
  out.asaas_key_present = !!key;
  out.asaas_key_mode = key?.startsWith("$aact_prod_") ? "prod" : "sandbox";
  // Test RPC signature via management API
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const token = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  async function q(sql: string) {
    const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: sql }),
    });
    return { status: r.status, body: await r.text() };
  }
  out.rpc_sig = await q(`select proname, pg_get_function_identity_arguments(oid) as args from pg_proc where proname='generate_financial_reference';`);
  // Try to actually generate a reference
  out.rpc_test = await q(`select public.generate_financial_reference('ASSIN') as v;`);
  out.tx_kind_enum = await q(`select unnest(enum_range(NULL::text)) as v where false; select column_name, data_type, udt_name from information_schema.columns where table_schema='public' and table_name='financial_transactions' and column_name in ('transaction_kind','status','provider');`);
  out.tx_triggers = await q(`select tgname, pg_get_triggerdef(oid) from pg_trigger where tgrelid='public.financial_transactions'::regclass and not tgisinternal;`);
  out.tx_kind_values = await q(`select distinct transaction_kind from public.financial_transactions limit 30;`);
  // Try inserting exactly like the function does
  const tryInsert = `insert into public.financial_transactions (store_id, transaction_kind, amount, reference_code, status, provider, mercado_pago_payment_id, pix_qr_code, pix_qr_code_base64, pix_copy_paste, metadata) values ('b97f3a1a-d558-41e5-b8a2-ebd65b5381b4','commission_charge',90,'#ASSIN-DIAGTEST','pending','asaas','pay_test','x','x','x','{"type":"plan_subscription"}'::jsonb) returning id;`;
  out.tx_insert = await q(tryInsert);
  // cleanup
  await q(`delete from public.financial_transactions where reference_code='#ASSIN-DIAGTEST';`);
  // Test Asaas from here
  if (key) {
    const base = key.startsWith("$aact_prod_") ? "https://api.asaas.com/v3" : "https://sandbox.asaas.com/api/v3";
    const r = await fetch(`${base}/customers?cpfCnpj=53142159851`, { headers: { access_token: key } });
    out.asaas_ping = { status: r.status, body: (await r.text()).slice(0, 500) };
    // Try to create the actual PIX payment like subscribe does
    const customerId = "cus_000185613637";
    const due = new Date(); due.setDate(due.getDate() + 1);
    const pr = await fetch(`${base}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", access_token: key },
      body: JSON.stringify({
        customer: customerId, billingType: "PIX", notificationDisabled: true,
        value: 90, dueDate: due.toISOString().split("T")[0],
        description: "TEST DIAG",
        externalReference: `#DIAG-${Date.now()}`,
      }),
    });
    const prBody = await pr.text();
    out.asaas_payment = { status: pr.status, body: prBody.slice(0, 1500) };
    try {
      const pj = JSON.parse(prBody);
      if (pj?.id) {
        const qr = await fetch(`${base}/payments/${pj.id}/pixQrCode`, { headers: { access_token: key } });
        out.asaas_qr = { status: qr.status, body: (await qr.text()).slice(0, 500) };
      }
    } catch {}
  }
  return new Response(JSON.stringify(out, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});