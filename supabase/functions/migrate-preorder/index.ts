// One-shot: aplica migração de pré-pedido no Supabase EXTERNO.
// Usa EXTERNAL_SUPABASE_ACCESS_TOKEN (PAT) via Management API. Idempotente.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SQL_ENUM = `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'order_status' AND e.enumlabel = 'scheduled'
  ) THEN
    ALTER TYPE public.order_status ADD VALUE 'scheduled';
  END IF;
END $$;
`;

const SQL = `
-- ============== STORES ==============
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS preorder_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS preorder_minutes_before integer NOT NULL DEFAULT 60;

-- ============== ORDERS ==============
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS release_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS is_preorder boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_orders_release_at
  ON public.orders (release_at)
  WHERE status = 'scheduled' AND release_at IS NOT NULL;

-- (stores_public será regenerada em passo separado, fora desta função, lendo a definição atual)

-- ============== FUNÇÃO DE RELEASE ==============
CREATE OR REPLACE FUNCTION public.release_scheduled_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  released_count integer := 0;
BEGIN
  WITH moved AS (
    UPDATE public.orders
       SET status = 'pending',
           updated_at = now()
     WHERE status = 'scheduled'
       AND release_at IS NOT NULL
       AND release_at <= now()
    RETURNING id
  )
  SELECT count(*) INTO released_count FROM moved;

  RETURN released_count;
END $$;

GRANT EXECUTE ON FUNCTION public.release_scheduled_orders() TO service_role;

-- ============== CRON A CADA MINUTO ==============
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('release-scheduled-orders-every-minute');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'release-scheduled-orders-every-minute',
  '* * * * *',
  $cron$ SELECT public.release_scheduled_orders(); $cron$
);
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const REF = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const PAT = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  if (!REF || !PAT) {
    return new Response(JSON.stringify({ error: "missing EXTERNAL_SUPABASE_* envs" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  async function run(q: string) {
    const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: q }),
    });
    const t = await r.text();
    let d: unknown = t;
    try { d = JSON.parse(t); } catch {}
    return { status: r.status, ok: r.ok, data: d };
  }

  // One-off SQL via body { sql: "..." }
  try {
    const body = await req.clone().json().catch(() => ({}));
    if (body && typeof body.sql === "string") {
      const out = await run(body.sql);
      return new Response(JSON.stringify(out, null, 2), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }
  } catch {}

  const step1 = await run(SQL_ENUM);
  if (!step1.ok) return new Response(JSON.stringify({ step: 1, ...step1 }, null, 2), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  const step2 = await run(SQL);
  return new Response(JSON.stringify({ step1, step2 }, null, 2), {
    status: step2.ok ? 200 : 500,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});