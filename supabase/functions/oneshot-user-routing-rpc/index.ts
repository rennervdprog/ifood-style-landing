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
  const sql = `
    CREATE OR REPLACE FUNCTION public.get_user_routing_context(_user_id uuid)
    RETURNS jsonb
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $$
      SELECT jsonb_build_object(
        'adminRow',       (SELECT jsonb_build_object('role', role) FROM public.user_roles WHERE user_id = _user_id AND role = 'admin' LIMIT 1),
        'profile',        (SELECT to_jsonb(p) FROM (SELECT role, is_approved, network_id, unit_store_id FROM public.profiles WHERE user_id = _user_id LIMIT 1) p),
        'ownedStore',     (SELECT jsonb_build_object('id', id, 'slug', slug) FROM public.stores WHERE owner_id = _user_id LIMIT 1),
        'matrizNetwork',  (SELECT jsonb_build_object('id', id, 'is_approved', is_approved) FROM public.store_networks WHERE owner_id = _user_id LIMIT 1),
        'driver',         (SELECT jsonb_build_object('user_id', user_id, 'is_active', is_active) FROM public.drivers WHERE user_id = _user_id LIMIT 1),
        'storeDriver',    (SELECT jsonb_build_object('id', id) FROM public.store_drivers WHERE driver_user_id = _user_id LIMIT 1),
        'reseller',       (SELECT jsonb_build_object('id', id) FROM public.resellers WHERE user_id = _user_id LIMIT 1),
        'storePlanType',  (
          SELECT sp.plan_type
          FROM public.store_plans sp
          JOIN public.stores s ON s.id = sp.store_id
          WHERE s.owner_id = _user_id AND sp.is_active = true
          LIMIT 1
        )
      );
    $$;

    GRANT EXECUTE ON FUNCTION public.get_user_routing_context(uuid) TO authenticated;

    SELECT public.get_user_routing_context(auth.uid()) AS sample_shape;
  `;
  const r = await q(sql);
  return new Response(JSON.stringify(r, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});