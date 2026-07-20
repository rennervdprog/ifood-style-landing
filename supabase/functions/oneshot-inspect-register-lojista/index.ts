const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
async function run(query: string) {
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const t = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  return { status: r.status, body: await r.text() };
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const out: Record<string, unknown> = {};
  // Audit all public RPCs — flag misconfigurations
  out.rpcs = await run(`
    SELECT p.proname as name,
           pg_get_function_identity_arguments(p.oid) as args,
           CASE p.prosecdef WHEN true THEN 'DEFINER' ELSE 'INVOKER' END as sec,
           COALESCE((SELECT string_agg(c, ',') FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%'), '') as search_path,
           l.lanname as lang,
           r.rolname as owner,
           has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth,
           has_function_privilege('service_role', p.oid, 'EXECUTE') as svc,
           p.provolatile as vol
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    JOIN pg_language l ON l.oid=p.prolang
    JOIN pg_roles r ON r.oid=p.proowner
    WHERE n.nspname='public' AND l.lanname IN ('plpgsql','sql')
      AND p.proname NOT LIKE 'pgrst_%'
    ORDER BY p.proname;`);
  return new Response(JSON.stringify(out, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});