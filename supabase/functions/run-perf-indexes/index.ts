// One-shot: cria índices no Supabase EXTERNO via Management API.
// Executa cada statement isoladamente (CONCURRENTLY não roda em transação).

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STATEMENTS: string[] = [
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_drivers_online_active ON public.drivers (is_online, is_active) WHERE is_online = true`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_drivers_user ON public.drivers (user_id)`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_store_drivers_store ON public.store_drivers (store_id)`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_store_drivers_driver ON public.store_drivers (driver_user_id)`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fcm_tokens_user_token ON public.fcm_tokens (user_id, token)`,
  `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name IN ('role','approval_status','status','approved','is_approved')`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_store_balances_store ON public.store_balances (store_id)`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_financial_transactions_store_created ON public.financial_transactions (store_id, created_at DESC)`,
  `ANALYZE public.drivers`,
  `ANALYZE public.store_drivers`,
  `ANALYZE public.fcm_tokens`,
  `ANALYZE public.profiles`,
  `ANALYZE public.store_balances`,
  `ANALYZE public.financial_transactions`,
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const REF = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF");
  const PAT = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN");
  if (!REF || !PAT) {
    return new Response(JSON.stringify({ error: "missing EXTERNAL_SUPABASE_PROJECT_REF or EXTERNAL_SUPABASE_ACCESS_TOKEN" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const results: any[] = [];
  for (const q of STATEMENTS) {
    const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: q }),
    });
    const text = await r.text();
    let data: unknown = text;
    try { data = JSON.parse(text); } catch {}
    results.push({ statement: q.slice(0, 80), status: r.status, ok: r.ok, data });
  }

  return new Response(JSON.stringify({ results }, null, 2), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});