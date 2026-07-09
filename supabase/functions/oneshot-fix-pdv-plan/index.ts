// Corrige RPC admin_create_test_store para criar linha em store_plans com plan_type='pdv_only'.
// Também adiciona 'pdv_only' ao enum store_plan_type (precisa ser em transação separada).
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

async function run(query: string) {
  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF")!;
  const t = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN")!;
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  return { status: r.status, body: await r.text() };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const out: Record<string, unknown> = {};

  // 1) Adiciona 'pdv_only' ao enum (idempotente)
  out.enum_add = await run(`ALTER TYPE public.store_plan_type ADD VALUE IF NOT EXISTS 'pdv_only';`);

  // 2) Recria a RPC pra também popular store_plans e (se faltar) inserir template padrão
  out.fn = await run(`
    -- garante template padrão pdv_only na tabela plan_templates
    INSERT INTO public.plan_templates (plan_type, monthly_fee, commission_rate, is_active)
    VALUES ('pdv_only', 69.00, 0, true)
    ON CONFLICT (plan_type) DO NOTHING;

    CREATE OR REPLACE FUNCTION public.admin_create_test_store(
      _name text,
      _category store_category,
      _plan_type text DEFAULT NULL
    )
    RETURNS uuid
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $fn$
    DECLARE
      _store_id uuid;
      _tpl_fee numeric := 0;
      _tpl_rate numeric := 0;
      _effective_plan text := COALESCE(_plan_type, 'commission_only');
    BEGIN
      IF NOT public.is_platform_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Apenas administradores podem criar lojas de teste.';
      END IF;

      -- pega valores default do template (se existir)
      SELECT monthly_fee, commission_rate INTO _tpl_fee, _tpl_rate
      FROM public.plan_templates WHERE plan_type = _effective_plan AND is_active = true
      LIMIT 1;

      INSERT INTO public.stores (name, category, owner_id, status, slug, plan_type, is_visible)
      VALUES (
        _name, _category, auth.uid(), 'ativo',
        'test-' || lower(replace(_name, ' ', '-')) || '-' || substr(gen_random_uuid()::text, 1, 4),
        _effective_plan,
        CASE WHEN _effective_plan = 'pdv_only' THEN false ELSE true END
      )
      RETURNING id INTO _store_id;

      -- plano ativo na store_plans (fonte de verdade para useStorePlan)
      INSERT INTO public.store_plans (store_id, plan_type, monthly_fee, commission_rate, is_active, pdv_enabled)
      VALUES (
        _store_id,
        _effective_plan::store_plan_type,
        COALESCE(_tpl_fee, 0),
        COALESCE(_tpl_rate, 0),
        true,
        _effective_plan = 'pdv_only'
      );

      INSERT INTO public.menu_sections (store_id, name, sort_order)
      VALUES (_store_id, 'Destaques', 0);

      INSERT INTO public.opening_hours (store_id, day_of_week, is_closed_all_day, open_time, close_time)
      SELECT _store_id, d.day, false, '08:00', '23:00'
      FROM generate_series(0, 6) AS d(day);

      IF _effective_plan = 'pdv_only' THEN
        INSERT INTO public.store_addons (store_id, addon_code, enabled, price_override, activated_at)
        VALUES (_store_id, 'pdv', true, 0, now())
        ON CONFLICT (store_id, addon_code) DO UPDATE
          SET enabled = true, price_override = 0, cancels_at = NULL;
      END IF;

      RETURN _store_id;
    END;
    $fn$;

    NOTIFY pgrst, 'reload schema';
  `);

  // 3) Backfill: pra lojas pdv_only já criadas sem store_plans, cria a linha
  out.backfill = await run(`
    INSERT INTO public.store_plans (store_id, plan_type, monthly_fee, commission_rate, is_active, pdv_enabled)
    SELECT s.id, 'pdv_only'::store_plan_type,
           COALESCE((SELECT monthly_fee FROM public.plan_templates WHERE plan_type='pdv_only' AND is_active LIMIT 1), 69),
           0, true, true
    FROM public.stores s
    WHERE s.plan_type = 'pdv_only'
      AND NOT EXISTS (SELECT 1 FROM public.store_plans p WHERE p.store_id = s.id AND p.is_active);
  `);

  return new Response(JSON.stringify(out, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});