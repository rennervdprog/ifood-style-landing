const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
async function q(sql: string) {
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const t = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  return { status: r.status, body: JSON.parse(await r.text()) };
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const out: Record<string, unknown> = {};
  out["alter"] = await q(`
    ALTER TABLE public.saved_addresses
      ADD COLUMN IF NOT EXISTS latitude double precision,
      ADD COLUMN IF NOT EXISTS longitude double precision,
      ADD COLUMN IF NOT EXISTS pin_confirmed boolean NOT NULL DEFAULT false;
  `);
  out["grants"] = await q(`
    GRANT SELECT (latitude, longitude, pin_confirmed), UPDATE (latitude, longitude, pin_confirmed)
      ON public.saved_addresses TO authenticated;
  `);
  out["verify"] = await q(`
    SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema='public' AND table_name='saved_addresses'
       AND column_name IN ('latitude','longitude','pin_confirmed')
     ORDER BY column_name;
  `);
  return new Response(JSON.stringify(out, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});