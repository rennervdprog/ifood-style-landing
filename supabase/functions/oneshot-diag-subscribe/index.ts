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
  out.asaas_key_present = !!Deno.env.get("ASAAS_API_KEY");
  // Query recent function invocations for subscribe-plan-payment
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const token = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const sql = `select id, timestamp, event_message, metadata from function_edge_logs f cross join unnest(metadata) m where (m.function_id like '%subscribe-plan-payment%' or event_message ilike '%subscribe-plan-payment%' or event_message ilike '%Asaas%') order by timestamp desc limit 30`;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/analytics/endpoints/logs.all?sql=${encodeURIComponent(sql)}`, { headers: { Authorization: `Bearer ${token}` } });
  out.logs = { status: r.status, body: (await r.text()).slice(0, 8000) };
  return new Response(JSON.stringify(out, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});