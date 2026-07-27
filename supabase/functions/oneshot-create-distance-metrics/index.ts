const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
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
  const out: Record<string, unknown> = {};
  out["table"] = await q(`
    CREATE TABLE IF NOT EXISTS public.distance_metrics_daily (
      day date NOT NULL,
      source text NOT NULL,
      count bigint NOT NULL DEFAULT 0,
      PRIMARY KEY (day, source)
    );
  `);
  out["grants"] = await q(`
    GRANT SELECT ON public.distance_metrics_daily TO authenticated;
    GRANT ALL ON public.distance_metrics_daily TO service_role;
  `);
  out["rls"] = await q(`
    ALTER TABLE public.distance_metrics_daily ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "admins read metrics" ON public.distance_metrics_daily;
    CREATE POLICY "admins read metrics" ON public.distance_metrics_daily
      FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'super_admin'::app_role));
  `);
  out["fn"] = await q(`
    CREATE OR REPLACE FUNCTION public.distance_metrics_bump(_source text, _n integer)
    RETURNS void
    LANGUAGE sql
    SECURITY DEFINER
    SET search_path = public
    AS $$
      INSERT INTO public.distance_metrics_daily(day, source, count)
      VALUES (current_date, _source, _n)
      ON CONFLICT (day, source) DO UPDATE SET count = distance_metrics_daily.count + EXCLUDED.count;
    $$;
  `);
  out["fn_grant"] = await q(`
    GRANT EXECUTE ON FUNCTION public.distance_metrics_bump(text, integer) TO service_role, authenticated;
  `);
  return new Response(JSON.stringify(out, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});