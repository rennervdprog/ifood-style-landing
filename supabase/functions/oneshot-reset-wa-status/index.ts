const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const REF = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const PAT = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `update public.platform_whatsapp_config
              set status='disconnected', phone_number=null, connected_at=null, updated_at=now()
              returning id, instance_name, status;`,
    }),
  });
  const t = await r.text();
  return new Response(t, { status: r.status, headers: { ...cors, "Content-Type": "application/json" } });
});