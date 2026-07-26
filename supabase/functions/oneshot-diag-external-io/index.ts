const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
async function q(sql: string) {
  const url = Deno.env.get("EXTERNAL_SUPABASE_URL")!;
  const key = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY")!;
  const r = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sql }),
  });
  const t = await r.text(); try { return JSON.parse(t); } catch { return { raw: t, status: r.status }; }
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const out: Record<string, unknown> = {};
  out.top_by_total_time = await q(`SELECT round(total_exec_time::numeric,0) AS total_ms, calls, round(mean_exec_time::numeric,2) AS mean_ms, shared_blks_read AS disk, left(regexp_replace(query,'\\s+',' ','g'),240) AS query FROM pg_stat_statements WHERE query NOT ILIKE '%pg_stat%' ORDER BY total_exec_time DESC LIMIT 20;`);
  out.top_by_disk_reads = await q(`SELECT shared_blks_read AS disk, calls, round(mean_exec_time::numeric,2) AS mean_ms, left(regexp_replace(query,'\\s+',' ','g'),240) AS query FROM pg_stat_statements WHERE shared_blks_read > 0 ORDER BY shared_blks_read DESC LIMIT 20;`);
  out.top_by_calls = await q(`SELECT calls, round(mean_exec_time::numeric,2) AS mean_ms, round(total_exec_time::numeric,0) AS total_ms, left(regexp_replace(query,'\\s+',' ','g'),240) AS query FROM pg_stat_statements WHERE query NOT ILIKE '%pg_stat%' ORDER BY calls DESC LIMIT 20;`);
  out.seq_scans = await q(`SELECT relname, seq_scan, seq_tup_read, idx_scan, n_live_tup FROM pg_stat_user_tables WHERE seq_scan > 100 AND n_live_tup > 500 ORDER BY seq_tup_read DESC LIMIT 20;`);
  out.cron = await q(`SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;`);
  return new Response(JSON.stringify(out, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});
