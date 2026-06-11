const TOKEN = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
const PROJECT_REF = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF") || "qkjhguziuchqsbxzruea";

Deno.serve(async () => {
  const sql = `
    DROP FUNCTION IF EXISTS public.create_network_unit(text, text, text, text, text);
    SELECT proname, pg_get_function_identity_arguments(oid) AS args
    FROM pg_proc WHERE proname = 'create_network_unit';
  `;
  const r = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  return new Response(await r.text(), { status: r.status, headers: { "Content-Type": "application/json" } });
});