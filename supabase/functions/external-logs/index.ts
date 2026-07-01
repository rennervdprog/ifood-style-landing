/**
 * external-logs
 * Pega logs recentes de uma edge function do projeto Supabase EXTERNO
 * via Management API (analytics endpoint).
 * Body: { function_name: string, hours?: number }
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b, null, 2), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const TOKEN = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN");
const PROJECT_REF =
  Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF") || "qkjhguziuchqsbxzruea";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!TOKEN) return json({ error: "EXTERNAL_SUPABASE_ACCESS_TOKEN missing" }, 500);

  let body: any = {};
  try { body = await req.json(); } catch {}
  const fn = body.function_name;
  const hours = Number(body.hours ?? 1);
  if (!fn) return json({ error: "function_name required" }, 400);

  const since = Date.now() - hours * 3600_000;

  // Query analytics for function_edge_logs filtered by function_id
  // Primeiro pega o function_id pelo slug
  const fnRes = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/functions/${fn}`,
    { headers: { Authorization: `Bearer ${TOKEN}` } },
  );
  const fnData = await fnRes.json();
  if (!fnRes.ok) return json({ step: "get_function", error: fnData }, 500);

  const sql = `
    select id, function_logs.timestamp, event_message, m.function_id, m.level
    from function_logs
    cross join unnest(metadata) as m
    where m.function_id = '${fnData.id}'
    order by timestamp desc
    limit 60
  `;

  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/analytics/endpoints/logs.all?sql=${encodeURIComponent(sql)}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  const txt = await r.text();
  let parsed: unknown = txt; try { parsed = JSON.parse(txt); } catch {}

  // Também busca o body atualmente deployado
  const bodyRes = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/functions/${fn}/body`,
    { headers: { Authorization: `Bearer ${TOKEN}` } },
  );
  const bodyTxt = await bodyRes.text();
  const bodyPreview = bodyTxt.slice(0, 500);
  const bodyLen = bodyTxt.length;

  return json({
    function: { id: fnData.id, slug: fnData.slug, version: fnData.version, status: fnData.status, verify_jwt: fnData.verify_jwt },
    deployed_body: { length: bodyLen, preview: bodyPreview },
    logs_status: r.status,
    logs: parsed,
  });
});