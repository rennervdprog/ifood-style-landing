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
  // Test Asaas from here
  if (key) {
    const base = key.startsWith("$aact_prod_") ? "https://api.asaas.com/v3" : "https://sandbox.asaas.com/api/v3";
    const r = await fetch(`${base}/customers?cpfCnpj=53142159851`, { headers: { access_token: key } });
    out.asaas_ping = { status: r.status, body: (await r.text()).slice(0, 500) };
  }
  return new Response(JSON.stringify(out, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});