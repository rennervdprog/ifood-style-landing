// One-shot: aplica migração de pré-pedido no Supabase EXTERNO.
// Usa EXTERNAL_SUPABASE_ACCESS_TOKEN (PAT) via Management API. Idempotente.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

-- ============== EXPOSE NO stores_public ==============
-- Recria a view incluindo as flags de pré-pedido (sem quebrar colunas existentes).
DO $$
DECLARE
  has_view boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_views WHERE schemaname='public' AND viewname='stores_public'
  ) INTO has_view;
  IF has_view THEN
    EXECUTE 'DROP VIEW public.stores_public CASCADE';
  END IF;
END $$;

CREATE VIEW public.stores_public AS
SELECT
  id, owner_id, name, slug, category, description, image_url, banner_url,
  address, address_city, address_state, address_neighborhood, latitude, longitude,
  is_open, force_closed, status, rating, delivery_fee, min_order, accepts_pickup,
  pdv_enabled, commission_rate, created_at,
  preorder_enabled, preorder_minutes_before
FROM public.stores
WHERE status IN ('ativo','bloqueado');

GRANT SELECT ON public.stores_public TO anon, authenticated;

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

  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: SQL }),
  });
  const text = await r.text();
  let data: unknown = text;
  try { data = JSON.parse(text); } catch {}
  return new Response(JSON.stringify({ status: r.status, ok: r.ok, data }, null, 2), {
    status: r.ok ? 200 : 500,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});