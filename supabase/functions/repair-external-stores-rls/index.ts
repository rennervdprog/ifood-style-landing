const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const REPAIR_SQL = `
SELECT policyname, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'stores'
ORDER BY policyname;

DROP POLICY IF EXISTS "Store owners can read linked driver profiles" ON public.profiles;
CREATE POLICY "Store owners can read linked driver profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.store_drivers sd
    WHERE sd.driver_user_id = profiles.user_id
      AND public.is_store_owner(auth.uid(), sd.store_id)
  )
);

DROP POLICY IF EXISTS "Platform admin can read all stores" ON public.stores;
DROP POLICY IF EXISTS "Store drivers can read linked stores" ON public.stores;
DROP POLICY IF EXISTS "Store drivers can read assigned store" ON public.stores;
DROP POLICY IF EXISTS "Store owners can read own stores" ON public.stores;
DROP POLICY IF EXISTS "Authenticated can read stores" ON public.stores;
DROP POLICY IF EXISTS "Authenticated can read active stores" ON public.stores;
DROP POLICY IF EXISTS "Authenticated can browse active stores" ON public.stores;
DROP POLICY IF EXISTS "Authenticated can read stores for orders" ON public.stores;
DROP POLICY IF EXISTS "Public can read active stores" ON public.stores;
DROP POLICY IF EXISTS "Public can read active stores via view" ON public.stores;
DROP POLICY IF EXISTS "Anyone can read active stores" ON public.stores;
DROP POLICY IF EXISTS "Anyone can read stores" ON public.stores;
DROP POLICY IF EXISTS "Qualquer pessoa pode visualizar lojas" ON public.stores;
DROP POLICY IF EXISTS "Clients can read stores from their orders" ON public.stores;
DROP POLICY IF EXISTS "unit_manager_select" ON public.stores;

CREATE POLICY "Public can read stores"
ON public.stores
FOR SELECT
TO public
USING (true);

NOTIFY pgrst, 'reload schema';

SELECT policyname, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'stores'
ORDER BY policyname;
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const externalCronSecret = Deno.env.get("EXTERNAL_CRON_SECRET") || "";
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const internalToken = req.headers.get("x-internal-token") || "";
  if (token !== serviceRole && internalToken !== externalCronSecret) return json({ error: "Unauthorized" }, 401);

  const ref = Deno.env.get("EXTERNAL_SUPABASE_PROJECT_REF");
  const managementToken = Deno.env.get("EXTERNAL_SUPABASE_ACCESS_TOKEN");
  if (!ref || !managementToken) return json({ error: "External management config missing" }, 500);

  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${managementToken}` },
    body: JSON.stringify({ query: REPAIR_SQL }),
  });
  const text = await res.text();
  let response: unknown = text;
  try { response = JSON.parse(text); } catch {}

  return json({ ok: res.ok, status: res.status, response }, res.ok ? 200 : 500);
});