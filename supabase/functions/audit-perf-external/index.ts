// One-shot: audita desempenho no Supabase EXTERNO após criação de índices.
// Consulta pg_stat_statements, pg_indexes e tamanhos das tabelas via Mgmt API.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TABLES = [
  "drivers","store_drivers","fcm_tokens","profiles",
  "store_balances","financial_transactions","orders","order_items","products","menu_sections",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const REF = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF");
  const PAT = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN");
  if (!REF || !PAT) {
    return new Response(JSON.stringify({ error: "missing env" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  async function runSql(query: string) {
    const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const text = await r.text();
    try { return { ok: r.ok, status: r.status, data: JSON.parse(text) }; }
    catch { return { ok: r.ok, status: r.status, data: text }; }
  }

  const tableList = TABLES.map((t) => `'${t}'`).join(",");

  const queries: Record<string, string> = {
    // Top 20 queries mais custosas (pg_stat_statements)
    top_queries: `
      SELECT
        substring(regexp_replace(query, '\\s+', ' ', 'g') for 220) AS query,
        calls,
        round(total_exec_time::numeric, 1) AS total_ms,
        round(mean_exec_time::numeric, 3) AS mean_ms,
        round(max_exec_time::numeric, 2) AS max_ms,
        rows
      FROM pg_stat_statements s
      JOIN pg_database d ON d.oid = s.dbid
      WHERE d.datname = current_database()
        AND query NOT ILIKE '%pg_stat_statements%'
        AND query NOT ILIKE '%information_schema%'
      ORDER BY total_exec_time DESC
      LIMIT 20
    `,
    // Uso dos índices que acabamos de criar
    new_index_usage: `
      SELECT schemaname, relname AS table, indexrelname AS index,
             idx_scan, idx_tup_read, idx_tup_fetch
      FROM pg_stat_user_indexes
      WHERE indexrelname IN (
        'idx_drivers_online_active','idx_drivers_user',
        'idx_store_drivers_store','idx_store_drivers_driver',
        'idx_fcm_tokens_user_token','idx_profiles_role_approved',
        'idx_store_balances_store','idx_financial_transactions_store_created',
        'idx_orders_store_status_created','idx_orders_client_created',
        'idx_orders_driver_status','idx_order_items_order',
        'idx_products_store_section','idx_driver_locations_driver_created',
        'idx_fcm_tokens_user','idx_order_messages_order_created',
        'idx_coupon_uses_coupon_user'
      )
      ORDER BY idx_scan DESC
    `,
    // Sequential scans nas tabelas alvo — se seq_scan >> idx_scan, falta índice
    scan_ratio: `
      SELECT relname AS table, seq_scan, seq_tup_read, idx_scan,
             COALESCE(idx_tup_fetch,0) AS idx_tup_fetch, n_live_tup AS rows
      FROM pg_stat_user_tables
      WHERE relname IN (${tableList})
      ORDER BY seq_tup_read DESC
    `,
    // Tamanho das tabelas + índices
    sizes: `
      SELECT relname AS table,
             pg_size_pretty(pg_relation_size(relid)) AS heap,
             pg_size_pretty(pg_indexes_size(relid)) AS indexes,
             pg_size_pretty(pg_total_relation_size(relid)) AS total
      FROM pg_stat_user_tables
      WHERE relname IN (${tableList})
      ORDER BY pg_total_relation_size(relid) DESC
    `,
  };

  const out: Record<string, unknown> = {};
  for (const [k, q] of Object.entries(queries)) {
    out[k] = await runSql(q);
  }
  return new Response(JSON.stringify(out, null, 2), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});