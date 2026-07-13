const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
async function q(sql: string) {
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const token = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  return JSON.parse(await r.text());
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const out: Record<string, unknown> = {};

  // Top queries by total time
  out.top_by_total_time = await q(`
    SELECT round(total_exec_time::numeric,0) AS total_ms,
           calls,
           round(mean_exec_time::numeric,2) AS mean_ms,
           round((shared_blks_read + shared_blks_hit)::numeric,0) AS blks_touched,
           shared_blks_read AS blks_from_disk,
           left(regexp_replace(query, '\\s+', ' ', 'g'), 200) AS query
    FROM pg_stat_statements
    WHERE query NOT ILIKE '%pg_stat%'
    ORDER BY total_exec_time DESC
    LIMIT 15;
  `);

  // Top queries by disk reads (I/O offenders)
  out.top_by_disk_reads = await q(`
    SELECT shared_blks_read AS blks_from_disk,
           calls,
           round(mean_exec_time::numeric,2) AS mean_ms,
           round(total_exec_time::numeric,0) AS total_ms,
           left(regexp_replace(query, '\\s+', ' ', 'g'), 200) AS query
    FROM pg_stat_statements
    WHERE shared_blks_read > 0
    ORDER BY shared_blks_read DESC
    LIMIT 15;
  `);

  // Top queries by call count (chatty ones)
  out.top_by_calls = await q(`
    SELECT calls,
           round(mean_exec_time::numeric,2) AS mean_ms,
           round(total_exec_time::numeric,0) AS total_ms,
           left(regexp_replace(query, '\\s+', ' ', 'g'), 200) AS query
    FROM pg_stat_statements
    WHERE query NOT ILIKE '%pg_stat%'
    ORDER BY calls DESC
    LIMIT 15;
  `);

  // Biggest tables
  out.biggest_tables = await q(`
    SELECT schemaname, relname,
           pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) AS total,
           pg_size_pretty(pg_relation_size(schemaname||'.'||relname)) AS table_only,
           n_live_tup, n_dead_tup
    FROM pg_stat_user_tables
    ORDER BY pg_total_relation_size(schemaname||'.'||relname) DESC
    LIMIT 20;
  `);

  // Sequential scan offenders
  out.seq_scan_offenders = await q(`
    SELECT relname, seq_scan, seq_tup_read, idx_scan,
           n_live_tup,
           CASE WHEN idx_scan > 0 THEN round((seq_scan::numeric / idx_scan)*100)/100 ELSE NULL END AS seq_per_idx
    FROM pg_stat_user_tables
    WHERE seq_scan > 100 AND n_live_tup > 1000
    ORDER BY seq_tup_read DESC
    LIMIT 20;
  `);

  // Cron jobs and frequency
  out.cron_jobs = await q(`
    SELECT jobname, schedule, active, command
    FROM cron.job
    ORDER BY jobname;
  `).catch(() => ({ note: "no pg_cron" }));

  return new Response(JSON.stringify(out, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});