const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const SQL = `
INSERT INTO public.admin_settings (key, value)
VALUES ('addons_module_enabled', to_jsonb(true))
ON CONFLICT (key) DO UPDATE SET value = to_jsonb(true);
NOTIFY pgrst, 'reload schema';
`;
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const token = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: SQL }),
  });
  return new Response(JSON.stringify({ status: r.status, body: await r.text() }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});