/**
 * list-external-functions
 *
 * Função temporária de auditoria: usa o EXTERNAL_SUPABASE_ACCESS_TOKEN
 * (Personal Access Token do Supabase) para listar via Management API
 * todas as edge functions e cron jobs deployados no projeto externo.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const TOKEN = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN");
  const PROJECT_REF = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF") || "qkjhguziuchqsbxzruea";

  if (!TOKEN) return json({ error: "EXTERNAL_SUPABASE_ACCESS_TOKEN not configured" }, 500);

  try {
    const fnRes = await fetch(
      `https://api.supabase.com/v1/projects/${PROJECT_REF}/functions`,
      { headers: { Authorization: `Bearer ${TOKEN}` } },
    );
    const functions = await fnRes.json();

    return json({
      project_ref: PROJECT_REF,
      status: fnRes.status,
      functions_count: Array.isArray(functions) ? functions.length : 0,
      functions: Array.isArray(functions)
        ? functions.map((f: any) => ({
            slug: f.slug,
            name: f.name,
            status: f.status,
            version: f.version,
            verify_jwt: f.verify_jwt,
            updated_at: f.updated_at ? new Date(f.updated_at).toISOString() : null,
          }))
        : functions,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});