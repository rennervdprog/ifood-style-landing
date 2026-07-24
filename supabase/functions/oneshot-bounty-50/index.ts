const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
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
  const sql = `
    ALTER TABLE public.resellers ALTER COLUMN bounty_amount_cents SET DEFAULT 5000;
    UPDATE public.resellers SET bounty_amount_cents = 5000 WHERE bounty_amount_cents = 15000;
    SELECT count(*) AS resellers, min(bounty_amount_cents) AS min_bounty, max(bounty_amount_cents) AS max_bounty FROM public.resellers;
  `;
  const r = await q(sql);
  return new Response(JSON.stringify(r), { headers: { ...cors, "Content-Type": "application/json" } });
});
