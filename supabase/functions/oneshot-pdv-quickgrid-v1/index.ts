const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
async function run(query: string) {
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const t = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  return { status: r.status, body: await r.text() };
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const out: Record<string, unknown> = {};
  out.alter_products = await run(`
    ALTER TABLE public.products
      ADD COLUMN IF NOT EXISTS pdv_short_code TEXT,
      ADD COLUMN IF NOT EXISTS pdv_sort_order INT;
    CREATE UNIQUE INDEX IF NOT EXISTS ix_products_pdv_short_code
      ON public.products(store_id, pdv_short_code) WHERE pdv_short_code IS NOT NULL;
  `);
  out.alter_sections = await run(`
    ALTER TABLE public.menu_sections
      ADD COLUMN IF NOT EXISTS pdv_color TEXT;
  `);
  return new Response(JSON.stringify(out, null, 2), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});