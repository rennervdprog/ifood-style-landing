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
  out.cols = await run(`
    ALTER TABLE public.store_plans
      ADD COLUMN IF NOT EXISTS essencial_upgrade_response TEXT,
      ADD COLUMN IF NOT EXISTS essencial_upgrade_response_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS essencial_upgrade_notified_at TIMESTAMPTZ;
  `);
  out.rpc = await run(`
    CREATE OR REPLACE FUNCTION public.respond_essencial_upgrade(_response TEXT)
    RETURNS JSONB
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
      _uid UUID := auth.uid();
      _store_id UUID;
      _plan_id UUID;
    BEGIN
      IF _uid IS NULL THEN
        RETURN jsonb_build_object('error','unauthorized');
      END IF;
      IF _response NOT IN ('accepted','refused') THEN
        RETURN jsonb_build_object('error','invalid_response');
      END IF;
      SELECT s.id, sp.id INTO _store_id, _plan_id
      FROM public.stores s
      JOIN public.store_plans sp ON sp.store_id = s.id AND sp.is_active = true
      WHERE s.owner_id = _uid
      LIMIT 1;
      IF _plan_id IS NULL THEN
        RETURN jsonb_build_object('error','no_active_plan');
      END IF;
      UPDATE public.store_plans
      SET essencial_upgrade_response = _response,
          essencial_upgrade_response_at = NOW(),
          updated_at = NOW()
      WHERE id = _plan_id;
      INSERT INTO public.admin_logs(action, metadata)
      VALUES ('essencial_upgrade_response',
              jsonb_build_object('store_id', _store_id, 'response', _response, 'user_id', _uid));
      RETURN jsonb_build_object('ok', true, 'response', _response);
    END;
    $$;
    GRANT EXECUTE ON FUNCTION public.respond_essencial_upgrade(TEXT) TO authenticated;
  `);
  return new Response(JSON.stringify(out, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});