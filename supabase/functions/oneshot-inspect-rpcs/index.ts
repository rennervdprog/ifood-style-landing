const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
const SQL = `SELECT proname, pg_get_functiondef(oid) AS def FROM pg_proc WHERE proname IN ('approve_plan_change','reject_plan_change','register_as_lojista','calculate_prorata_credit','respond_essencial_upgrade') ORDER BY proname`;
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const token = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: SQL }),
  });
  return new Response(await r.text(), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});