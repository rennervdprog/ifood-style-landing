// Inspeciona schema reseller no supabase externo
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
async function q(sql: string) {
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const t = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  return JSON.parse(await r.text());
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const sql = `SELECT table_name, string_agg(column_name, ',' ORDER BY ordinal_position) AS cols
  FROM information_schema.columns
  WHERE table_schema='public'
  AND table_name IN ('resellers','reseller_referrals','reseller_commissions','reseller_withdrawals','reseller_cron_runs','store_plans','signup_attempts','stores','profiles')
  GROUP BY table_name ORDER BY table_name;`;
  const rows = await q(sql);
  const crons = await q(`SELECT jobname, schedule, command FROM cron.job WHERE jobname LIKE 'reseller%';`);
  return new Response(JSON.stringify({ rows, crons }, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});