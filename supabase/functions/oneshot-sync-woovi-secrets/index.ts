const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type" };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const REF = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const PAT = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const payload = [
    { name: "WOOVI_APP_ID", value: Deno.env.get("WOOVI_APP_ID")! },
    { name: "WOOVI_WEBHOOK_SECRET", value: Deno.env.get("WOOVI_WEBHOOK_SECRET")! },
  ];
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/secrets`, {
    method: "POST",
    headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return new Response(JSON.stringify({ status: r.status, body: await r.text() }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
