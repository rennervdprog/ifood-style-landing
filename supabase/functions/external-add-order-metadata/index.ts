const TOKEN = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
const PROJECT_REF = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF") || "qkjhguziuchqsbxzruea";

const SQL = `
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS metadata jsonb;
SELECT 'ok' AS result;
`;

Deno.serve(async () => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: SQL }),
  });
  return new Response(await r.text(), { status: r.status, headers: { "Content-Type": "application/json" } });
});